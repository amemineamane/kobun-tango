/* =====================================================================
 * tools/validate-tokens.mjs — 品詞分解データ（data/tokens/*.js）の検査
 * ---------------------------------------------------------------------
 * 使い方:  node tools/validate-tokens.mjs
 *          （D:\kobun_app で実行。node 18 以上。引数なし）
 *
 * なぜ別ファイルか:
 *   tools/validate.mjs は words / works / relations / examples / workWords /
 *   passages を見る「土台のデータ」の検査。品詞分解は文章 1 編 = 1 ファイルで
 *   何人かで分担して書き足していくため、検査も独立して回せるようにしてある。
 *   （両方まとめて回したいときは tools/validate.mjs から呼び出す）
 *
 * 検査すること:
 *   (a) window.KOBUN.tokens のキー（passageId）が data/passages.js に実在するか
 *   (b) 段落数が passages の paragraphs.length と一致するか
 *   (c) **各段落の s を連結したものが paragraphs[i].text と一字一句一致するか**
 *       （いちばん大事。ずれていたら最初に食い違った位置を表示する）
 *   (d) p（品詞）が統一ラベル表にあるか / c・f が決められた値か
 *   (e) w が words に実在するか（無ければエラー）。
 *       その語の headwords・kana・kanji と b が繋がるか（繋がらなければ警告）
 *   (f) passages の vocab[].surface が、その段落のトークン境界に沿って
 *       切り出せるか（ハイライトがトークンをまたいで割ってしまう箇所を警告）
 *   (g) まだ品詞分解を作っていない文章の一覧を出す
 *
 * 終了コード: エラー 0 なら 0、エラーがあれば 1。
 * ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_FILES = ['words.js', 'works.js', 'passages.js'];
const TOKENS_DIR = path.join(ROOT, 'data', 'tokens');

/* --- 統一ラベル表（docs/tokens-guide.md と同じ内容） ------------------ */
const POS_LIST = [
  '名詞', '代名詞', '動詞', '形容詞', '形容動詞', '副詞', '連体詞', '接続詞', '感動詞',
  '助動詞', '格助詞', '係助詞', '副助詞', '接続助詞', '終助詞', '間投助詞',
  '接頭語', '接尾語', '記号'
];
/** 活用する品詞（c・f を書くべき品詞） */
const CONJUGATING = ['動詞', '形容詞', '形容動詞', '助動詞'];
/** 活用形は必ずこの 6 つのどれか（音便などの補足は n に書く） */
const FORMS = ['未然形', '連用形', '終止形', '連体形', '已然形', '命令形'];
/** 活用の種類。動詞は「行＋種類」、変格は行を書かない */
const ROWS = ['ア行', 'カ行', 'ガ行', 'サ行', 'ザ行', 'タ行', 'ダ行', 'ナ行', 'ハ行', 'バ行', 'マ行', 'ヤ行', 'ラ行', 'ワ行'];
const VERB_KINDS = ['四段', '上一段', '上二段', '下一段', '下二段'];
const IRREGULAR = ['カ変', 'サ変', 'ナ変', 'ラ変'];
const ADJ_KINDS = ['ク活用', 'シク活用', 'ナリ活用', 'タリ活用'];
const AUX_KINDS = [
  '四段型', '上二段型', '下二段型', 'ラ変型', 'ナ変型', 'サ変型',
  '形容詞型', '形容動詞型', '特殊型', '無変化型'
];
function isValidConj(c) {
  if (IRREGULAR.indexOf(c) >= 0) return true;
  if (ADJ_KINDS.indexOf(c) >= 0) return true;
  if (AUX_KINDS.indexOf(c) >= 0) return true;
  for (const r of ROWS) {
    if (!c.startsWith(r)) continue;
    if (VERB_KINDS.indexOf(c.slice(r.length)) >= 0) return true;
  }
  return false;
}

/* --- 土台データを読む ------------------------------------------------ */
const sandbox = { window: {}, console };
vm.createContext(sandbox);
for (const f of BASE_FILES) {
  const p = path.join(ROOT, 'data', f);
  const src = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  vm.runInContext(src, sandbox, { filename: p });
}

/* --- data/tokens/*.js を読む（1 ファイルずつ、どのファイル由来か覚える） */
const tokenFiles = fs.existsSync(TOKENS_DIR)
  ? fs.readdirSync(TOKENS_DIR).filter((f) => f.endsWith('.js')).sort()
  : [];
/** passageId -> 定義したファイル名（重複定義の検出用） */
const definedIn = new Map();

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`[ERROR] ${where} ${msg}`);
const warn = (where, msg) => warnings.push(`[WARN ] ${where} ${msg}`);

for (const f of tokenFiles) {
  const p = path.join(TOKENS_DIR, f);
  const src = fs.readFileSync(p, 'utf8');
  if (src.charCodeAt(0) === 0xfeff) {
    err(`data/tokens/${f}`, 'BOM 付きで保存されています。UTF-8 BOM なしで保存してください');
  }
  // 同じ passageId を 2 ファイルで書くと後勝ちで前のファイルが消える。
  // 読み込み前の「キー → 値の参照」を控えておき、差し替えられていないか見る。
  const before = new Map(Object.entries(sandbox.window.KOBUN?.tokens || {}));
  try {
    vm.runInContext(src.replace(/^\uFEFF/, ''), sandbox, { filename: p });
  } catch (e) {
    err(`data/tokens/${f}`, `読み込めません: ${e.message}`);
    continue;
  }
  const nowTokens = sandbox.window.KOBUN?.tokens || {};
  const added = Object.keys(nowTokens).filter((k) => !before.has(k));
  if (added.length === 0) {
    err(`data/tokens/${f}`, 'window.KOBUN.tokens に何も足していません（passageId のキーを確認）');
  }
  for (const k of added) definedIn.set(k, f);
  for (const [k, v] of before) {
    if (nowTokens[k] !== v) {
      err(`data/tokens/${f}`, `passageId "${k}" を上書きしています（${definedIn.get(k)} に書いた内容が消えます）`);
      definedIn.set(k, f);
    }
  }
  const expected = path.basename(f, '.js');
  if (added.length === 1 && added[0] !== expected) {
    warn(`data/tokens/${f}`, `ファイル名と passageId が違います（キー "${added[0]}" → ${added[0]}.js にしてください）`);
  }
}

const K = sandbox.window.KOBUN;
const words = K.words || [];
const passages = K.passages || [];
const tokens = K.tokens || {};
const wordById = new Map(words.map((w) => [w.id, w]));
const passageById = new Map(passages.map((p) => [p.id, p]));

/** その語の「基本形として認められる字面」を集める。
 *  kana は「え〜ず／じ／まじ／で」のように呼応の空所と異形を含むので使わない。
 *  words.js の headwords がその整理済みの配列なので、それと漢字表記だけを見る。 */
function formsOf(w) {
  const out = new Set();
  for (const h of w.headwords || []) if (h) out.add(h);
  if (w.kanji) {
    for (const k of String(w.kanji).split(/[・／\/]/)) {
      const t = k.trim();
      if (t) out.add(t);
    }
  }
  return Array.from(out);
}
/** 330 語の基本形 → wordId（w の付け忘れを拾うため） */
const wordIdByForm = new Map();
for (const w of words) {
  for (const f of formsOf(w)) {
    if (!wordIdByForm.has(f)) wordIdByForm.set(f, []);
    wordIdByForm.get(f).push(w.id);
  }
}
/** words.js の pos（形容詞/形容動詞/動詞/敬語/名詞/副詞/その他）と
 *  トークンの p が同じ語になりうる組み合わせか。
 *  「など」（副詞 108 ＝どうして）と副助詞「など」のような同形異語で
 *  w の付け忘れ警告が出るのを防ぐ。 */
function posCompatible(wordPos, tokenPos) {
  switch (wordPos) {
    case '動詞': case '敬語': return tokenPos === '動詞';
    case '形容詞': return tokenPos === '形容詞';
    case '形容動詞': return tokenPos === '形容動詞';
    case '名詞': return tokenPos === '名詞' || tokenPos === '代名詞';
    case '副詞': return tokenPos === '副詞';
    default: return true; // 'その他'（助詞・助動詞・連語など）は何にでも当たりうる
  }
}
/** 形容動詞の語幹用法か。
 *  「あはれなり」の語幹「あはれ」が名詞のように使われる（＝「あはれ」で 1 語）のは
 *  古文では普通で、そのとき b は見出し語「あはれなり」と一致しない。
 *  つれづれ／おぼろけ／そぞろ／等閑 なども同じ。これを取り違えとは呼ばない。 */
function isAdjNounStem(forms, b) {
  return forms.some(function (f) {
    return /(なり|たり)$/.test(f) && f.slice(0, -2) === b;
  });
}

/* --- 本体の検査 ------------------------------------------------------ */
let tokenTotal = 0;
let taggedTotal = 0;
const doneIds = [];

for (const passageId of Object.keys(tokens)) {
  const file = definedIn.get(passageId) || '?';
  const at0 = `tokens["${passageId}"] (data/tokens/${file})`;
  const paras = tokens[passageId];

  /* (a) passageId が実在するか */
  const passage = passageById.get(passageId);
  if (!passage) {
    err(at0, 'この passageId は data/passages.js にありません');
    continue;
  }
  doneIds.push(passageId);

  if (!Array.isArray(paras)) { err(at0, '値が配列ではありません'); continue; }

  /* (b) 段落数 */
  if (paras.length !== passage.paragraphs.length) {
    err(at0, `段落数が合いません（tokens ${paras.length} / passages ${passage.paragraphs.length}）`);
  }

  const n = Math.min(paras.length, passage.paragraphs.length);
  for (let i = 0; i < n; i++) {
    const at = `${at0} 段落[${i}]`;
    const list = paras[i];
    const text = passage.paragraphs[i].text || '';
    if (!Array.isArray(list) || list.length === 0) {
      err(at, 'トークンの配列が空です');
      continue;
    }
    tokenTotal += list.length;

    /* (c) s の連結が text と一致するか */
    const joined = list.map((t) => (t && t.s) || '').join('');
    const textMatches = joined === text;
    if (!textMatches) {
      let k = 0;
      while (k < joined.length && k < text.length && joined[k] === text[k]) k++;
      err(at,
        `s を連結した文字列が原文と一致しません（${k + 1} 文字目から食い違い）\n` +
        `         原文  : …${text.slice(Math.max(0, k - 10), k)}【${text.slice(k, k + 12) || '(ここで原文が終わり)'}】\n` +
        `         tokens: …${joined.slice(Math.max(0, k - 10), k)}【${joined.slice(k, k + 12) || '(ここで tokens が終わり)'}】`);
    }

    /* トークン境界（(f) で使う）: 0, len(t0), len(t0)+len(t1), … */
    const bounds = new Set([0]);
    let pos = 0;
    list.forEach((t) => { pos += ((t && t.s) || '').length; bounds.add(pos); });

    /* (d)(e) 各トークン */
    list.forEach((t, j) => {
      const tAt = `${at}.[${j}] "${(t && t.s) || ''}"`;
      if (!t || typeof t !== 'object') { err(tAt, 'トークンがオブジェクトではありません'); return; }
      if (!t.s) { err(tAt, 's（表層形）が空です'); return; }
      if (!t.p) { err(tAt, 'p（品詞）が空です'); return; }
      if (POS_LIST.indexOf(t.p) < 0) {
        err(tAt, `p="${t.p}" は統一ラベル表にありません（${POS_LIST.join('／')}）`);
      }

      if (t.p === '記号') {
        if (t.c || t.f) warn(tAt, '記号に c・f は要りません');
        return;
      }
      if (!t.b) warn(tAt, 'b（基本形）が空です');
      if (!t.m) warn(tAt, 'm（語義・用法）が空です');

      /* c・f */
      if (t.c != null) {
        if (!isValidConj(t.c)) err(tAt, `c="${t.c}" は活用の種類の表にありません（docs/tokens-guide.md 参照）`);
        if (CONJUGATING.indexOf(t.p) < 0) warn(tAt, `p="${t.p}" は活用しないのに c があります`);
      }
      if (t.f != null) {
        if (FORMS.indexOf(t.f) < 0) {
          err(tAt, `f="${t.f}" は活用形の表にありません（${FORMS.join('／')}。音便などの補足は n に書く）`);
        }
        if (CONJUGATING.indexOf(t.p) < 0) warn(tAt, `p="${t.p}" は活用しないのに f があります`);
      }
      if (CONJUGATING.indexOf(t.p) >= 0) {
        if (t.f == null) warn(tAt, `p="${t.p}" は活用するので f（活用形）を書いてください`);
        if (t.c == null) warn(tAt, `p="${t.p}" は活用するので c（活用の種類）を書いてください`);
      }

      /* (e) w */
      if (t.w != null) {
        taggedTotal++;
        const w = wordById.get(t.w);
        if (!w) {
          err(tAt, `w=${t.w} が data/words.js に存在しません`);
        } else {
          const forms = formsOf(w);
          const b = t.b || '';
          if (forms.indexOf(b) < 0 && !isAdjNounStem(forms, b)) {
            // 形容動詞の語幹用法（あはれ／つれづれ）は一致しなくて当たり前なので
            // 上で除いてある。残りは複合語か、取り違えの疑い。
            const compound = forms.some((f) => f && b.length > f.length && (b.startsWith(f) || b.endsWith(f)));
            if (compound) {
              if (!t.n) warn(tAt, `b="${b}" は見出し語 "${w.kana}" の複合語のようです。n に一言（「〜＋〜の複合語」）を書いてください`);
            } else {
              warn(tAt, `b="${b}" が w=${t.w} "${w.kana}"${w.kanji ? `／"${w.kanji}"` : ''} の見出し形と一致しません（同形異語の取り違えに注意）`);
            }
          }
        }
      } else if (t.b && wordIdByForm.has(t.b) && !t.n) {
        // 品詞が噛み合うものだけ。n に説明を書いてあれば「別語だと分かって
        // 付けていない」とみなして黙る（docs/tokens-guide.md の約束）。
        const ids = wordIdByForm.get(t.b)
          .filter((id) => posCompatible(wordById.get(id).pos, t.p));
        if (ids.length) {
          warn(tAt, `b="${t.b}" は 330 語の見出し語です。w: ${ids.join(' または ')} を付けてください（別語なら n にその旨を書く）`);
        }
      }
    });

    /* (f) vocab の surface がトークン境界に沿うか
     *     （原文と一致していない段落では境界が信用できないので飛ばす） */
    if (!textMatches) continue;
    (passage.vocab || []).forEach((v, vi) => {
      const sfc = v.surface;
      if (!sfc) return;
      let from = 0;
      for (;;) {
        const idx = text.indexOf(sfc, from);
        if (idx < 0) break;
        from = idx + 1;
        if (!bounds.has(idx) || !bounds.has(idx + sfc.length)) {
          warn(`${at} vocab[${vi}] "${sfc}"`,
            'この位置ではトークン境界に沿って切り出せません（ハイライトが語を割ります）。' +
            'passages.js の surface を語のまとまりに直すか、tokens の切り方を見直してください');
          break;
        }
      }
    });
  }
}

/* (g) まだ作っていない文章 */
const todo = passages.filter((p) => !tokens[p.id]);

/* --- 出力 ------------------------------------------------------------ */
console.log('=== 品詞分解データ（data/tokens/*.js）検証 ===');
console.log(`  ファイル     : ${tokenFiles.length} 個`);
console.log(`  作成済みの文章: ${doneIds.length} / ${passages.length} 編`);
console.log(`  トークン     : ${tokenTotal}（うち 330 語に紐づく ${taggedTotal}）`);
console.log('');

if (todo.length) {
  console.log(`--- 未作成の文章 ${todo.length} 編 ---`);
  for (const p of todo) {
    const chars = p.paragraphs.reduce((s, x) => s + (x.text || '').length, 0);
    console.log(`  ${p.id.padEnd(22)} ${p.title}（${p.paragraphs.length} 段 / ${chars} 字）`);
  }
  console.log('');
} else if (passages.length) {
  console.log('すべての文章に品詞分解があります。');
  console.log('');
}

for (const w of warnings) console.log(w);
if (warnings.length) console.log('');
for (const e of errors) console.log(e);

if (errors.length === 0) {
  console.log(`OK: エラー 0 件（警告 ${warnings.length} 件）`);
  process.exit(0);
} else {
  console.log(`NG: エラー ${errors.length} 件 / 警告 ${warnings.length} 件`);
  process.exit(1);
}
