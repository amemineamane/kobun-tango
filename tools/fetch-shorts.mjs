/* =====================================================================
 * tools/fetch-shorts.mjs — 「古典ショート」の一覧とサムネイルを取り直す
 * ---------------------------------------------------------------------
 * 使い方:  node tools/fetch-shorts.mjs [再生リストID]
 *          （D:\kobun_app で実行。node 18 以上・fetch 標準搭載。引数なし可）
 *          省略時は data/site.js の author.youtubeShortsPlaylist を使う。
 *
 * 何をするか:
 *   1. YouTube の再生リストページ（https://www.youtube.com/playlist?list=...）
 *      の HTML を取り、埋め込まれた ytInitialData から shortsLockupViewModel
 *      （ショート専用の再生リストはこの形で並ぶ）を全部拾う。
 *      初回の HTML には先頭 100 本ぶんしか入っていないので、続きは
 *      ytInitialData 内の continuationItemViewModel が持つ token を使って
 *      https://www.youtube.com/youtubei/v1/browse に POST し、取れるだけ取る。
 *      YouTube 内部 API の仕様変更などで続きが取れない環境では、
 *      取れた分（多くの場合 100 本）だけで進める（エラーにはしない）。
 *   2. 各動画の縮小サムネイル URL（同じ JSON の中に、YouTube 側があらかじめ
 *      405×720 程度に縮小して置いてある WebP 画像として入っている）を取り、
 *      Pillow（python3 が使えるとき）で幅 240px・品質 75 にさらに縮小してから
 *      assets/yt/<videoId>.webp に保存する。Pillow が無い環境では、
 *      YouTube から取れた縮小版をそのまま保存する（1 枚 25〜50KB 程度になる）。
 *      assets/yt/ は毎回いったん空にしてから書き直す（古いファイルが残らない）。
 *   3. data/shorts.js の KOBUN.site.author.youtubeShorts 配列
 *      （shorts:begin 〜 shorts:end のあいだ）を、取ってきた全件で書き換える。
 *
 * 【注意】
 *   YouTube 側のページ構造が変わると 0 件になることがある。0 件のときは
 *   data/shorts.js を書き換えずに終了する（空にして「動画カードが消える」
 *   事故を防ぐため）。サムネイルの取得に失敗した 1 本は、その ID だけ
 *   スキップして続行する。sw.js の PRECACHE への追加はこのスクリプトでは
 *   やらない（本数が多いので、通常の fetch に任せる）。
 * ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sitePath = path.join(ROOT, 'data', 'site.js');
const shortsPath = path.join(ROOT, 'data', 'shorts.js');
const ytDir = path.join(ROOT, 'assets', 'yt');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const THUMB_WIDTH = 240;
const THUMB_QUALITY = 75;
const THUMB_CONCURRENCY = 6;

/** data/site.js から現在の youtubeShortsPlaylist を拾う（引数が無いときの既定値） */
function defaultPlaylistId() {
  const src = fs.readFileSync(sitePath, 'utf8');
  const m = src.match(/youtubeShortsPlaylist:\s*'([^']+)'/);
  return m ? m[1] : '';
}

const playlistId = process.argv[2] || defaultPlaylistId();
if (!playlistId) {
  console.error('再生リスト ID が分かりません（引数か data/site.js の youtubeShortsPlaylist で指定してください）。');
  process.exit(1);
}

/** begin/end のあいだを body に差し替える。見つからなければ null */
function replaceBlock(src, beginMark, endMark, body) {
  const b = src.indexOf(beginMark);
  const e = src.indexOf(endMark);
  if (b < 0 || e < 0 || e < b) return null;
  return src.slice(0, b + beginMark.length) + '\n' + body + src.slice(e);
}

/** JS の文字列リテラルに埋めるためのエスケープ（' と \ と改行だけでよい） */
function jsString(s) {
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ').trim() + "'";
}

async function fetchText(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

/** shortsLockupViewModel から { id, title, thumbUrl } を 1 件作る（無ければ null） */
function shortFromViewModel(s) {
  const id = s?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId;
  const title = s?.overlayMetadata?.primaryText?.content || '';
  const thumbUrl = s?.thumbnailViewModel?.thumbnailViewModel?.image?.sources?.[0]?.url || '';
  if (!id || !thumbUrl) return null;
  return { id, title, thumbUrl };
}

/** 任意の JSON オブジェクトを再帰的に歩いて、指定キーが出てくるたびに fn(value) を呼ぶ */
function walkFind(node, key, fn) {
  if (Array.isArray(node)) {
    for (const v of node) walkFind(v, key, fn);
    return;
  }
  if (node && typeof node === 'object') {
    if (node[key] !== undefined) fn(node[key]);
    for (const v of Object.values(node)) walkFind(v, key, fn);
  }
}

/** 初回 HTML から、拾えるだけの shorts と、続きを取るための情報を取り出す */
function parseInitialHtml(html) {
  const apiKeyM = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || html.match(/INNERTUBE_API_KEY\D+([A-Za-z0-9_-]{20,})/);
  const cverM = html.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/) || html.match(/INNERTUBE_CONTEXT_CLIENT_VERSION\D+([0-9.]+)/);
  const vdM = html.match(/"visitorData":"([^"]+)"/);
  const dataM = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);

  const apiKey = apiKeyM ? apiKeyM[1] : '';
  const clientVersion = cverM ? cverM[1].trim() : '';
  const visitorData = vdM ? vdM[1] : '';

  let data = null;
  if (dataM) {
    try { data = JSON.parse(dataM[1]); } catch { /* 無視 */ }
  }

  const shorts = [];
  const seen = new Set();
  let continuationToken = '';

  if (data) {
    walkFind(data, 'shortsLockupViewModel', (s) => {
      const item = shortFromViewModel(s);
      if (item && !seen.has(item.id)) { seen.add(item.id); shorts.push(item); }
    });
    walkFind(data, 'continuationItemViewModel', (c) => {
      const token = c?.continuationCommand?.innertubeCommand?.continuationCommand?.token;
      if (token && !continuationToken) continuationToken = token;
    });
  }

  return { apiKey, clientVersion, visitorData, shorts, continuationToken };
}

/** 続きの 1 ページを取りに行く。取れなければ { shorts: [], continuationToken: '' } */
async function fetchContinuationPage(ctx, token) {
  const url = `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(ctx.apiKey)}&prettyPrint=false`;
  const body = {
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: ctx.clientVersion,
        hl: 'ja',
        gl: 'JP',
        visitorData: ctx.visitorData,
        originalUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
        platform: 'DESKTOP'
      }
    },
    continuation: token
  };
  let text;
  try {
    text = await fetchText(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': UA,
        'Origin': 'https://www.youtube.com',
        'Referer': `https://www.youtube.com/playlist?list=${playlistId}`,
        'X-Goog-Visitor-Id': ctx.visitorData
      },
      body: JSON.stringify(body)
    });
  } catch {
    return { shorts: [], continuationToken: '' };
  }

  let data;
  try { data = JSON.parse(text); } catch { return { shorts: [], continuationToken: '' }; }

  const shorts = [];
  walkFind(data, 'shortsLockupViewModel', (s) => {
    const item = shortFromViewModel(s);
    if (item) shorts.push(item);
  });
  let continuationToken = '';
  walkFind(data, 'continuationItemViewModel', (c) => {
    const t = c?.continuationCommand?.innertubeCommand?.continuationCommand?.token;
    if (t && !continuationToken) continuationToken = t;
  });
  return { shorts, continuationToken };
}

/** 全ページぶん集める。続きが取れなくなったら（0 件 or token 切れ）そこで打ち切る */
async function collectAllShorts() {
  console.log(`再生リスト ${playlistId} を取得中…`);
  const html = await fetchText(`https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ja-JP,ja;q=0.9' }
  });
  const init = parseInitialHtml(html);
  console.log(`  初回ページ: ${init.shorts.length} 本`);

  const all = init.shorts.slice();
  const seen = new Set(all.map((s) => s.id));
  let token = init.continuationToken;
  let page = 0;
  const MAX_PAGES = 40; // 安全弁（1 ページ ~100 本なら 4000 本ぶんで十分すぎる上限）

  while (token && page < MAX_PAGES) {
    page++;
    const { shorts, continuationToken } = await fetchContinuationPage(init, token);
    const fresh = shorts.filter((s) => !seen.has(s.id));
    if (!fresh.length) {
      console.log(`  続き（${page} ページ目）: 0 本（打ち切り）`);
      break;
    }
    fresh.forEach((s) => { seen.add(s.id); all.push(s); });
    console.log(`  続き（${page} ページ目）: +${fresh.length} 本（累計 ${all.length} 本）`);
    if (!continuationToken || continuationToken === token) break;
    token = continuationToken;
  }

  return all;
}

/* ------------------------------------------------------------------
 * サムネイル：取得 → （可能なら）Pillow で縮小 → 保存
 * ---------------------------------------------------------------- */

let pythonChecked = false;
let pythonOk = false;

function checkPython() {
  if (pythonChecked) return pythonOk;
  pythonChecked = true;
  try {
    const res = spawnSync('python3', ['-c', 'import PIL; print(1)'], { encoding: 'utf8' });
    pythonOk = res.status === 0 && /1/.test(res.stdout || '');
  } catch {
    pythonOk = false;
  }
  if (!pythonOk) {
    console.warn('  ! python3 / Pillow が使えないため、サムネイルは YouTube から取れたサイズのまま保存します。');
  }
  return pythonOk;
}

const RESIZE_SCRIPT = `
import sys, io
from PIL import Image
data = sys.stdin.buffer.read()
im = Image.open(io.BytesIO(data)).convert('RGB')
w = ${THUMB_WIDTH}
if im.width > w:
    h = max(1, round(im.height * w / im.width))
    im = im.resize((w, h), Image.LANCZOS)
im.save(sys.stdout.buffer, format='WEBP', quality=${THUMB_QUALITY})
`;

/** Pillow で幅 THUMB_WIDTH・品質 THUMB_QUALITY の WebP に縮小する。失敗したら null */
function resizeToWebp(buf) {
  if (!checkPython()) return null;
  try {
    const res = spawnSync('python3', ['-c', RESIZE_SCRIPT], {
      input: buf,
      maxBuffer: 1024 * 1024 * 20
    });
    if (res.status === 0 && res.stdout && res.stdout.length > 0) return res.stdout;
  } catch { /* 下のフォールバックへ */ }
  return null;
}

async function fetchThumbnailBuffer(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024) return null; // 灰色プレースホルダなどの極端に小さい応答
    return buf;
  } catch {
    return null;
  }
}

/** 簡易な並行実行プール */
async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runOne() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runOne));
  return results;
}

async function main() {
  const shorts = await collectAllShorts();
  if (!shorts.length) {
    console.error('ショートが 1 件も見つかりませんでした。data/shorts.js は書き換えません。');
    process.exit(1);
  }
  console.log(`合計 ${shorts.length} 本を取得しました。サムネイルを保存します…`);

  fs.mkdirSync(ytDir, { recursive: true });
  // 前回ぶんが残らないよう、いったん空にしてから書き直す
  for (const f of fs.readdirSync(ytDir)) {
    if (f.endsWith('.webp')) fs.unlinkSync(path.join(ytDir, f));
  }

  let totalBytes = 0;
  let resizedCount = 0;
  let failCount = 0;

  const kept = await runPool(shorts, THUMB_CONCURRENCY, async (s) => {
    const raw = await fetchThumbnailBuffer(s.thumbUrl);
    if (!raw) { failCount++; console.warn(`  ! ${s.id} のサムネイルを取得できず、スキップします。`); return null; }
    const resized = resizeToWebp(raw);
    const out = resized || raw;
    if (resized) resizedCount++;
    fs.writeFileSync(path.join(ytDir, `${s.id}.webp`), out);
    totalBytes += out.length;
    return { id: s.id, title: s.title };
  });

  const okShorts = kept.filter(Boolean);
  console.log(`サムネイル合計: ${(totalBytes / 1024).toFixed(1)} KB（${okShorts.length} 枚。縮小できたもの ${resizedCount} 枚／失敗 ${failCount} 本）`);

  if (!okShorts.length) {
    console.error('サムネイルを 1 枚も保存できませんでした。data/shorts.js は書き換えません。');
    process.exit(1);
  }

  const body = okShorts
    .map((s) => `  { id: ${jsString(s.id)}, title: ${jsString(s.title)} },`)
    .join('\n');
  const src = fs.readFileSync(shortsPath, 'utf8');
  const next = replaceBlock(src, '/* shorts:begin */', '/* shorts:end */', body + '\n  ');
  if (next === null) {
    console.error('data/shorts.js に /* shorts:begin */ / /* shorts:end */ が見つかりません。');
    process.exit(1);
  }
  if (next !== src) {
    fs.writeFileSync(shortsPath, next, 'utf8');
    console.log(`data/shorts.js の youtubeShorts を ${okShorts.length} 件に更新しました。`);
  } else {
    console.log('data/shorts.js はすでに最新です。');
  }
}

main().catch((err) => {
  console.error('失敗:', err.message || err);
  process.exit(1);
});
