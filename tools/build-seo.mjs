/* =====================================================================
 * tools/build-seo.mjs — 検索エンジン向けの静的ページを生成する
 * ---------------------------------------------------------------------
 * 使い方:  node tools/build-seo.mjs
 *          （D:\kobun_app で実行。node 18 以上。引数なし・依存ゼロ）
 *
 * なぜ要るか:
 *   アプリはハッシュルーティング（#/word/39）なので、検索エンジンからは
 *   「index.html 1 枚のサイト」に見える。単語 330 語・文章・作品の中身は
 *   JavaScript を実行しないと現れず、実行されても URL が 1 つしか無いので
 *   「をかし 古文 意味」のような検索に個別ページを出せない。
 *   そこで data/*.js から **実 HTML** を機械的に生成し、クローラには
 *   こちらを読ませる（アプリ本体は今までどおり index.html のまま）。
 *
 * 何を作るか（すべてこのスクリプトの出力。手で編集しない）:
 *   w/<id>.html          単語ページ（330 件）
 *   w/index.html         単語一覧（重要度別・五十音別）
 *   p/<passageId>.html   文章ページ（原文・現代語訳・品詞分解の表）
 *   p/index.html         文章一覧（作品ごと）
 *   k/<workId>.html      作品ページ
 *   k/index.html         作品一覧
 *   sitemap.xml          上のすべて＋トップ
 *   robots.txt           Sitemap: 行つき
 *
 * 方針:
 *   ・アプリと同じ css/style.css を読む。JS でのリダイレクトはしない
 *     （クローラにもユーザーにも実コンテンツをそのまま読ませる）。
 *     ページ末尾の小さな <script> は「PWA としてインストール済みで
 *     スタンドアロン表示のとき」だけアプリ側のハッシュ URL に置き換える。
 *   ・アプリ名・URL・制作者は data/site.js から取る（ハードコードしない）。
 *   ・データを足したら再実行すれば追随する（生成物は毎回作り直す）。
 *
 * 実行する順番（README「データを足したら」参照）:
 *   sync-tokens → build-seo → validate → bump-version → commit → push
 * ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* --- data/*.js を Node 上で評価して window.KOBUN を組み立てる --------- *
 * tools/validate.mjs と同じやり方。ブラウザが読むのと同じファイルを使う。 */
const DATA_FILES = ['site.js', 'words.js', 'works.js', 'relations.js', 'workWords.js', 'passages.js'];
const sandbox = { window: {}, console };
vm.createContext(sandbox);

function runFile(p) {
  const src = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  vm.runInContext(src, sandbox, { filename: p });
}
for (const f of DATA_FILES) runFile(path.join(ROOT, 'data', f));

const tokensDir = path.join(ROOT, 'data', 'tokens');
const tokenFiles = fs.existsSync(tokensDir)
  ? fs.readdirSync(tokensDir).filter((f) => f.endsWith('.js')).sort()
  : [];
for (const f of tokenFiles) runFile(path.join(tokensDir, f));

const K = sandbox.window.KOBUN;
const SITE = K.site;
const words = K.words || [];
const works = K.works || [];
const passages = K.passages || [];
const relations = K.relations || [];
const workWords = K.workWords || [];
const tokens = K.tokens || {};

/* --- 定数 ------------------------------------------------------------ */
const BASE = SITE.url.endsWith('/') ? SITE.url : SITE.url + '/';
const OGP = BASE + 'assets/ogp.png';
const TODAY = (() => {
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
})();

/** index.html が使っているキャッシュバスター（?v=...）を借りる。
 *  版を上げるのは tools/bump-version.mjs の仕事（生成ページも書き換える）。 */
const VERSION = (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .match(/\?v=([^"'\s]+)/) || [])[1] || '1';

const LEVEL_ORDER = ['S', 'A', 'B'];
const LEVEL_DESC = {
  S: '共通テストで必ず問われる中核語',
  A: '合否を分ける頻出語',
  B: '難関大で差がつく語'
};
const KANA_ROWS = ['あ行', 'か行', 'さ行', 'た行', 'な行', 'は行', 'ま行', 'や行', 'ら行', 'わ行'];
/** 関連語を逆向きに出すときのラベル（js/data-index.js の INVERSE_TYPE と同じ） */
const INVERSE_TYPE = { 派生: '派生元', 段階: '段階' };

/* --- 入試の出題（共通テスト・センター試験） --------------------------
 * data/works.js の work.exam（配列）と data/passages.js の passage.exam。
 * 画面側（js/components.js の C.examBadge）と同じ見た目・同じ言い回しにする。
 * ------------------------------------------------------------------ */
/** その作品の出題歴を新しい順に */
const examsOf = (wk) => (((wk && wk.exam) || []).slice()
  .sort((a, b) => (b.year || 0) - (a.year || 0)));

/** 「2025 年度 共通テスト 本試験 若菜下（文章II）」のような 1 行 */
function examLabel(e, withSection = false) {
  return [
    `${e.year} 年度`, e.test, e.part,
    withSection && e.section && e.section !== '—' ? e.section : ''
  ].filter(Boolean).join('　');
}

/** 出題バッジ（クラス名はアプリと共通。css/style.css の .badge.exam） */
function examBadgeHtml(e) {
  if (!e || e.year == null) return '';
  const part = e.part && e.part !== '本試験'
    ? `<span class="exam-part">${esc(e.part)}</span>` : '';
  return `<span class="badge exam" title="${esc(examLabel(e, true))} に出題">` +
    `<span class="exam-year">${esc(e.year)}</span>` +
    (e.test ? `<span class="exam-test">${esc(e.test)}</span>` : '') +
    part + '</span>';
}

/* --- 小道具 ---------------------------------------------------------- */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** meta description 用に詰める（全角 120 字を目安に切る） */
function clamp(s, max = 118) {
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : t.slice(0, max - 1) + '…';
}

const jsonld = (obj) =>
  '<script type="application/ld+json">\n' +
  JSON.stringify(obj, null, 1).replace(/</g, '\\u003c') +
  '\n</script>';

function writeFile(rel, body) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body, 'utf8');
}

/** 生成ディレクトリの *.html を消してから作り直す（消えたデータの残骸を残さない） */
function cleanDir(dir) {
  const p = path.join(ROOT, dir);
  if (!fs.existsSync(p)) return;
  for (const f of fs.readdirSync(p)) {
    if (f.endsWith('.html')) fs.unlinkSync(path.join(p, f));
  }
}

/* --- 索引 ------------------------------------------------------------ */
const wordById = new Map(words.map((w) => [w.id, w]));
const workById = new Map(works.map((w) => [w.id, w]));
const sortedByKana = words.slice().sort((a, b) => a.kanaOrder - b.kanaOrder);

/** 関連語（片方向のデータを双方向に展開） */
const relationsByWord = new Map();
function pushRel(from, to, type, note) {
  if (!wordById.has(from) || !wordById.has(to)) return;
  if (!relationsByWord.has(from)) relationsByWord.set(from, []);
  relationsByWord.get(from).push({ word: wordById.get(to), type, note });
}
relations.forEach((r) => {
  pushRel(r.from, r.to, r.type, r.note);
  pushRel(r.to, r.from, INVERSE_TYPE[r.type] || r.type, r.note);
});
relationsByWord.forEach((list) => {
  list.sort((a, b) => (a.type === b.type ? a.word.kanaOrder - b.word.kanaOrder : a.type.localeCompare(b.type, 'ja')));
});

/** 作品 → 収録語 / 単語 → 登場作品（vocab ∪ 品詞分解の w ∪ workWords の和集合） */
const wordIdsByWork = new Map(works.map((w) => [w.id, new Set()]));
const workIdsByWord = new Map();
function linkWordWork(wordId, workId) {
  if (!wordById.has(wordId) || !wordIdsByWork.has(workId)) return;
  wordIdsByWork.get(workId).add(wordId);
  if (!workIdsByWord.has(wordId)) workIdsByWord.set(wordId, new Set());
  workIdsByWord.get(wordId).add(workId);
}
passages.forEach((p) => {
  (p.vocab || []).forEach((v) => { if (v.wordId != null) linkWordWork(v.wordId, p.workId); });
  (tokens[p.id] || []).forEach((para) => {
    para.forEach((t) => { if (t.w != null) linkWordWork(t.w, p.workId); });
  });
});
workWords.forEach((ww) => linkWordWork(ww.wordId, ww.workId));

/** 作品 → 文章 */
const passagesByWork = new Map(works.map((w) => [w.id, []]));
passages.forEach((p) => {
  if (passagesByWork.has(p.workId)) passagesByWork.get(p.workId).push(p);
});

/**
 * 単語 → その語が出てくる段落。
 * 品詞分解（tokens）があれば w === wordId のトークンで確定させ、
 * 無ければ vocab[].surface の文字列一致に落とす（アプリと同じ考え方）。
 * 返す html は原文で、その語を <strong> で囲んである。
 */
const paragraphsByWord = new Map();
passages.forEach((p) => {
  const paras = p.paragraphs || [];
  const tk = tokens[p.id];
  paras.forEach((para, i) => {
    const hit = new Map(); // wordId -> html
    if (tk && tk[i]) {
      const ids = new Set(tk[i].filter((t) => t.w != null).map((t) => t.w));
      ids.forEach((id) => {
        const html = tk[i].map((t) => (t.w === id ? '<strong>' + esc(t.s) + '</strong>' : esc(t.s))).join('');
        hit.set(id, html);
      });
    } else {
      (p.vocab || []).forEach((v) => {
        if (v.wordId == null || !v.surface) return;
        if (para.text.indexOf(v.surface) < 0) return;
        hit.set(v.wordId, esc(para.text).split(esc(v.surface)).join('<strong>' + esc(v.surface) + '</strong>'));
      });
    }
    hit.forEach((html, id) => {
      if (!wordById.has(id)) return;
      if (!paragraphsByWord.has(id)) paragraphsByWord.set(id, []);
      paragraphsByWord.get(id).push({ passage: p, index: i, html, translation: para.translation });
    });
  });
});

/* =====================================================================
 * ページの骨格
 * ===================================================================== */

/**
 * 1 枚の HTML を組み立てる。生成ページはすべて 1 階層下（w/ p/ k/）にあるので、
 * アプリの資産へは '../' で届く。
 *
 * @param {object} o
 *   o.rel        このページの相対パス（'w/39.html'）
 *   o.title      <title>
 *   o.desc       <meta name="description">
 *   o.graph      JSON-LD の @graph に入れる配列
 *   o.crumbs     [{ label, href }]（最後の要素はリンクにしない）
 *   o.appHash    「アプリで開く」の飛び先（'#/word/39'）
 *   o.body       <section class="view"> の中身（パンくずと h1 を含む）
 */
function renderPage(o) {
  const url = BASE + o.rel;
  const crumbHtml = o.crumbs.map((c, i) => {
    const last = i === o.crumbs.length - 1;
    const item = last
      ? `<span aria-current="page">${esc(c.label)}</span>`
      : `<a href="${esc(c.href)}">${esc(c.label)}</a>`;
    return (i ? '<span class="muted" aria-hidden="true">›</span>' : '') + item;
  }).join('');

  const appLink = o.appHash
    ? `<p class="deck-links"><a class="btn btn-primary" href="../${esc(o.appHash)}">アプリで開く</a>` +
      `<a class="btn" href="../">古文単語帳のトップへ</a></p>`
    : `<p class="deck-links"><a class="btn btn-primary" href="../">古文単語帳のトップへ</a></p>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<link rel="canonical" href="${esc(url)}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(OGP)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(SITE.name)}">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@AmemineAmane">
<meta name="twitter:creator" content="@AmemineAmane">
<link rel="icon" href="../assets/favicon.svg?v=${VERSION}" type="image/svg+xml">
<link rel="icon" href="../assets/icon-192.png?v=${VERSION}" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="../assets/apple-touch-icon.png?v=${VERSION}">
<meta name="theme-color" content="#faf7f0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1b1917" media="(prefers-color-scheme: dark)">
<link rel="stylesheet" href="../css/style.css?v=${VERSION}">
${jsonld({ '@context': 'https://schema.org', '@graph': o.graph })}
<!-- このファイルは tools/build-seo.mjs が data/*.js から生成しています。手で編集しないこと。 -->
</head>
<body>

<header class="site-header">
  <div class="site-header-inner">
    <p class="site-title"><a href="../">${esc(SITE.name)}</a></p>
    <nav class="site-nav" aria-label="かんたんメニュー">
      <a href="../w/index.html">単語一覧</a>
      <a href="../p/index.html">教科書の文章</a>
      <a href="../k/index.html">作品</a>
    </nav>
    <a class="site-help-link" href="../#/help">使い方</a>
  </div>
</header>

<main id="app">
<section class="view">
<nav class="crumbs" aria-label="パンくずリスト">${crumbHtml}</nav>
${o.body}
${appLink}
</section>
</main>

<footer class="site-footer">
  <p class="muted small">制作：${esc(SITE.author.name)}　/　<a href="../#/terms">利用規約・プライバシーポリシー</a>　/　<a href="../">${esc(SITE.name)}</a></p>
</footer>

<!-- ホーム画面に追加（PWA）としてスタンドアロン起動しているときだけ、
     アプリ側の画面に置き換える。通常のブラウザ表示では何もしない
     （クローラにも読者にも、このページの本文をそのまま読ませるため）。 -->
<script>
(function () {
  try {
    var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    if (standalone) location.replace('../${o.appHash || ''}');
  } catch (e) { /* 何もしない */ }
})();
</script>

</body>
</html>
`;
}

/** パンくずの JSON-LD */
function breadcrumbLd(rel, crumbs) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      item: c.abs || (i === crumbs.length - 1 ? BASE + rel : undefined)
    }))
  };
}

const authorLd = {
  '@type': 'Person',
  name: SITE.author.name,
  url: SITE.author.x || BASE
};

/* =====================================================================
 * 単語ページ  w/<id>.html
 * ===================================================================== */
function wordPage(word) {
  const rel = `w/${word.id}.html`;
  const head = word.kana + (word.kanji ? `〔${word.kanji}〕` : '');
  const title = `${word.kana}（${word.kanji || word.kana}）の意味・語義｜${SITE.name}`;
  const hits = paragraphsByWord.get(word.id) || [];
  const rels = relationsByWord.get(word.id) || [];
  const workIds = Array.from(workIdsByWord.get(word.id) || []);
  const firstHit = hits[0];
  const where = firstHit
    ? `${(workById.get(firstHit.passage.workId) || {}).title || ''}「${firstHit.passage.title}」の原文と現代語訳つきで用例も確認できます。`
    : '関連語・重要度つきで覚える古文単語帳。';
  const desc = clamp(
    `古文単語「${head}」（${word.pos}・重要度${word.level} ${word.levelLabel}）の意味は` +
    word.meanings.slice(0, 3).join('／') + '。' + where
  );

  const crumbs = [
    { label: 'ホーム', href: '../', abs: BASE },
    { label: '古文単語 330 語', href: 'index.html', abs: BASE + 'w/index.html' },
    { label: head, href: rel }
  ];

  const idx = sortedByKana.findIndex((w) => w.id === word.id);
  const prev = idx > 0 ? sortedByKana[idx - 1] : null;
  const next = idx >= 0 && idx < sortedByKana.length - 1 ? sortedByKana[idx + 1] : null;

  let body = `<header class="word-head">
<p class="word-head-badges">
<span class="badge level level-${word.level}"><span class="level-code">${word.level}</span><span class="level-name">${esc(word.levelLabel)}</span></span>
<span class="badge pos">${esc(word.pos)}</span>
<span class="badge row">${esc(word.kanaRow)}</span>
</p>
<h1 class="view-title word-title"><span class="word-title-kana">${esc(word.kana)}</span>${word.kanji ? `<span class="word-title-kanji">〔${esc(word.kanji)}〕</span>` : ''}</h1>
<p class="word-romaji muted">${esc(word.romaji)}　/　見出し形：${esc(word.headwords.join('・'))}</p>
<p class="word-level-note muted"><b>重要度 ${word.level} ${esc(word.levelLabel)}</b>：${esc(LEVEL_DESC[word.level] || '')}</p>
</header>

<div class="card">
<h2 class="card-title">「${esc(head)}」の意味・語義</h2>
<ol class="meaning-list">${word.meanings.map((m) => `<li>${esc(m)}</li>`).join('')}</ol>
</div>
`;

  /* 関連語 */
  if (rels.length) {
    const byType = new Map();
    rels.forEach((r) => {
      if (!byType.has(r.type)) byType.set(r.type, []);
      byType.get(r.type).push(r);
    });
    let inner = '';
    byType.forEach((list, type) => {
      inner += `<h3 class="rel-type"><span class="badge rel">${esc(type)}</span></h3><div class="rel-cards">`;
      list.forEach((r) => {
        inner += `<a class="rel-card" href="${r.word.id}.html">
<div class="rel-card-head"><span class="badge level level-${r.word.level}"><span class="level-code">${r.word.level}</span><span class="level-name">${esc(r.word.levelLabel)}</span></span>
<span class="rel-card-kana">${esc(r.word.kana)}</span>${r.word.kanji ? `<span class="rel-card-kanji">〔${esc(r.word.kanji)}〕</span>` : ''}</div>
<div class="rel-card-meaning">${esc(r.word.primaryMeaning)}</div>${r.note ? `<div class="rel-card-note">${esc(r.note)}</div>` : ''}</a>`;
      });
      inner += '</div>';
    });
    body += `<div class="card"><h2 class="card-title">「${esc(word.kana)}」の関連語（${rels.length}）</h2>${inner}</div>\n`;
  }

  /* この語が出てくる文章 */
  if (hits.length) {
    let inner = '';
    hits.forEach((h) => {
      const wk = workById.get(h.passage.workId);
      const v = (h.passage.vocab || []).filter((x) => x.wordId === word.id)[0];
      const meaning = v && v.meaningIndex != null ? word.meanings[v.meaningIndex] : null;
      inner += `<article class="example-card">
<p class="example-head"><a class="example-work" href="../p/${esc(h.passage.id)}.html">${esc((wk ? wk.title : '') + '「' + h.passage.title + '」')}</a>
<span class="example-section">第 ${h.index + 1} 段落</span></p>
<p class="passage-text">${h.html}</p>
<p class="example-translation">${esc(h.translation || '')}</p>
${meaning ? `<p class="example-note">この文章では「${esc(v.surface)}／${esc(meaning)}」${v.note ? '　' + esc(v.note) : ''}</p>` : ''}
</article>`;
    });
    body += `<div class="card"><h2 class="card-title">「${esc(word.kana)}」が出てくる教科書の文章（${hits.length}）</h2>${inner}</div>\n`;
  }

  /* 登場作品 */
  if (workIds.length) {
    const chips = workIds.map((id) => {
      const wk = workById.get(id);
      return `<a class="work-chip" href="../k/${esc(id)}.html"><span class="work-chip-title">${esc(wk.title)}</span><span class="work-chip-genre muted">${esc(wk.genre)}</span></a>`;
    }).join('');
    body += `<div class="card"><h2 class="card-title">この語が出てくる作品</h2><div class="chip-list">${chips}</div></div>\n`;
  }

  /* 五十音順の前後 */
  body += `<nav class="prev-next" aria-label="五十音順のとなりの語">
${prev ? `<a class="pn" href="${prev.id}.html"><span class="pn-label muted">← ${esc(prev.kanaRow)}</span><span class="pn-kana">${esc(prev.kana)}</span></a>` : '<span class="pn pn-empty"></span>'}
${next ? `<a class="pn pn-next" href="${next.id}.html"><span class="pn-label muted">${esc(next.kanaRow)} →</span><span class="pn-kana">${esc(next.kana)}</span></a>` : '<span class="pn pn-empty"></span>'}
</nav>
<p class="muted small">この単語は「${esc(SITE.name)}」の古文単語 ${words.length} 語のうちの 1 語です。<a href="index.html">単語一覧</a>／<a href="../p/index.html">教科書の文章一覧</a>／<a href="../k/index.html">作品一覧</a></p>
`;

  const graph = [
    {
      '@type': 'DefinedTerm',
      '@id': BASE + rel + '#term',
      name: word.kana,
      alternateName: word.kanji || undefined,
      description: word.meanings.join('／'),
      termCode: String(word.id),
      inLanguage: 'ja',
      url: BASE + rel,
      inDefinedTermSet: {
        '@type': 'DefinedTermSet',
        name: `${SITE.name}（古文単語 ${words.length} 語）`,
        url: BASE + 'w/index.html',
        inLanguage: 'ja'
      }
    },
    breadcrumbLd(rel, crumbs)
  ];

  return renderPage({ rel, title, desc, graph, crumbs, appHash: `#/word/${word.id}`, body });
}

/* =====================================================================
 * 文章ページ  p/<passageId>.html
 * ===================================================================== */
const POS_SKIP = '記号';

function passagePage(p) {
  const rel = `p/${p.id}.html`;
  const wk = workById.get(p.workId);
  const workTitle = wk ? wk.title : '';
  const title = `${p.title}（${workTitle}）の現代語訳と品詞分解｜${SITE.name}`;
  const tk = tokens[p.id] || null;
  const vocab = p.vocab || [];
  const firstText = (p.paragraphs[0] || {}).text || '';
  /* 入試の出典から採った文章は、出題年・試験名を見出しと description に出す。
     part / section は works.js 側（同じ年の出題）から借りる。 */
  const pexam = p.exam
    ? Object.assign({}, examsOf(wk).filter((e) => e.year === p.exam.year)[0] || {}, p.exam)
    : null;
  const examSentence = pexam
    ? `${pexam.year} 年度${pexam.test || ''}${pexam.part && pexam.part !== '本試験' ? '（' + pexam.part + '）' : ''}の出典作品。`
    : '';
  const desc = clamp(
    `${workTitle}「${p.title}」${p.section ? '（' + p.section + '）' : ''}の原文「${firstText.slice(0, 24)}…」と現代語訳、` +
    `${tk ? '全文の品詞分解（品詞・活用・語義）' : '重要語の語義'}。${examSentence}この文章に出てくる古文単語 ${vocab.length} 語の意味つき。`
  );

  const crumbs = [
    { label: 'ホーム', href: '../', abs: BASE },
    { label: '教科書の文章', href: 'index.html', abs: BASE + 'p/index.html' },
    { label: workTitle, href: `../k/${p.workId}.html`, abs: BASE + `k/${p.workId}.html` },
    { label: p.title, href: rel }
  ];

  let body = `<header class="passage-head">
<p class="word-head-badges">${wk ? `<span class="badge pos">${esc(wk.genre)}</span>` : ''}${(p.grade || []).map((g) => `<span class="badge grade">${esc(g)}</span>`).join('')}${pexam ? examBadgeHtml(pexam) : ''}</p>
<h1 class="view-title passage-title">${esc(p.title)}（${esc(workTitle)}）の現代語訳と品詞分解</h1>
<p class="muted">${esc(workTitle)}${wk ? '　/　' + esc(wk.author) : ''}${p.section ? '　/　' + esc(p.section) : ''}${wk ? '　/　' + esc(wk.era) : ''}</p>
${pexam ? `<p class="passage-exam-note small">${esc(examSentence)}<a href="../k/${esc(p.workId)}.html">出題歴を見る →</a></p>\n` : ''}<p class="view-lead">${esc(workTitle)}「${esc(p.title)}」の原文を段落ごとに現代語訳と並べ、${tk ? '全語の品詞分解を表にしました。' : '重要語の語義をまとめました。'}作品の解説は<a href="../k/${esc(p.workId)}.html">${esc(workTitle)}のページ</a>へ。</p>
</header>
`;

  /* 段落ごとに 原文 → 現代語訳 → 品詞分解の表 */
  let tokenRowCount = 0;
  p.paragraphs.forEach((para, i) => {
    body += `<div class="card">
<h2 class="card-title">第 ${i + 1} 段落　原文と現代語訳</h2>
<p class="passage-text">${esc(para.text)}</p>
<div class="passage-trans"><p>${esc(para.translation || '')}</p></div>
`;
    if (tk && tk[i]) {
      const rows = tk[i].filter((t) => t.p !== POS_SKIP);
      tokenRowCount += rows.length;
      body += `<h3 class="rel-type">第 ${i + 1} 段落の品詞分解</h3>
<div class="table-scroll"><table class="token-table">
<thead><tr><th>表層形</th><th>基本形</th><th>品詞</th><th>活用</th><th>語義・用法</th></tr></thead>
<tbody>
${rows.map((t) => {
        const w = t.w != null ? wordById.get(t.w) : null;
        const katsuyo = [t.c, t.f].filter(Boolean).join('・');
        return `<tr><td class="td-surface">${esc(t.s)}</td><td class="td-base">${esc(t.b || '')}</td>` +
          `<td class="td-pos"><span class="badge pos">${esc(t.p || '')}</span></td>` +
          `<td class="td-base">${esc(katsuyo)}</td>` +
          `<td class="td-meaning">${esc(t.m || '')}` +
          (w ? `<div class="td-link"><a href="../w/${w.id}.html">→ ${esc(w.kana)}</a></div>` : '') +
          (t.n ? `<div class="td-note">${esc(t.n)}</div>` : '') + '</td></tr>';
      }).join('\n')}
</tbody></table></div>
`;
    }
    body += '</div>\n';
  });

  /* この文章の重要語 */
  if (vocab.length) {
    const rows = vocab.map((v, i) => {
      const w = v.wordId != null ? wordById.get(v.wordId) : null;
      if (w) {
        const meaning = v.meaningIndex != null ? w.meanings[v.meaningIndex] : w.primaryMeaning;
        return `<a class="word-row lv-${w.level}" href="../w/${w.id}.html">
<div class="word-row-head"><span class="badge level level-${w.level}"><span class="level-code">${w.level}</span><span class="level-name">${esc(w.levelLabel)}</span></span>
<span class="word-kana">${esc(v.surface)}</span><span class="word-kanji">${esc(w.kana)}${w.kanji ? '〔' + esc(w.kanji) + '〕' : ''}・${esc(w.pos)}</span></div>
<div class="word-row-meaning">${esc(meaning)}</div>${v.note ? `<div class="word-row-note muted">${esc(v.note)}</div>` : ''}</a>`;
      }
      return `<div class="word-row lv-P">
<div class="word-row-head"><span class="badge level level-P"><span class="level-code">P</span><span class="level-name">文章の語</span></span>
<span class="word-kana">${esc(v.surface)}</span>${v.pos ? `<span class="word-kanji">${esc(v.pos)}</span>` : ''}</div>
<div class="word-row-meaning">${esc(v.meaning || '')}</div>${v.note ? `<div class="word-row-note muted">${esc(v.note)}</div>` : ''}</div>`;
    }).join('\n');
    body += `<div class="card"><h2 class="card-title">「${esc(p.title)}」に出てくる古文単語（${vocab.length}）</h2>
<p class="muted small">青いバッジ（S／A／B）の語は入試頻出の 330 語です。語をタップすると意味・関連語・ほかの用例が見られます。</p>
<div class="word-list">${rows}</div></div>\n`;
  }

  if (p.note) body += `<p class="muted small">${esc(p.note)}</p>\n`;

  /* 同じ作品の他の文章 */
  const siblings = (passagesByWork.get(p.workId) || []).filter((x) => x.id !== p.id);
  if (siblings.length) {
    body += `<div class="card"><h2 class="card-title">${esc(workTitle)}のほかの教材</h2><div class="chip-list">` +
      siblings.map((s) => `<a class="chip" href="${esc(s.id)}.html"><span class="chip-kana">${esc(s.title)}</span>${s.section ? `<span class="chip-extra">${esc(s.section)}</span>` : ''}</a>`).join('') +
      `</div></div>\n`;
  }

  const graph = [
    {
      '@type': 'Article',
      '@id': BASE + rel + '#article',
      headline: `${p.title}（${workTitle}）の現代語訳と品詞分解`,
      description: desc,
      inLanguage: 'ja',
      url: BASE + rel,
      mainEntityOfPage: BASE + rel,
      image: OGP,
      dateModified: TODAY,
      author: authorLd,
      publisher: authorLd,
      isPartOf: wk ? { '@type': 'Book', name: wk.title, author: { '@type': 'Person', name: wk.author }, url: BASE + `k/${wk.id}.html` } : undefined,
      about: (pexam ? [{
        '@type': 'Thing',
        name: `${pexam.year} 年度${pexam.test || ''}${pexam.part ? '（' + pexam.part + '）' : ''} 国語（古文）の出典`
      }] : []).concat(
        vocab.filter((v) => v.wordId != null && wordById.has(v.wordId)).slice(0, 20).map((v) => ({
          '@type': 'DefinedTerm',
          name: wordById.get(v.wordId).kana,
          url: BASE + `w/${v.wordId}.html`
        }))
      )
    },
    breadcrumbLd(rel, crumbs)
  ];

  return {
    html: renderPage({ rel, title, desc, graph, crumbs, appHash: `#/passage/${p.id}`, body }),
    tokenRowCount
  };
}

/* =====================================================================
 * 作品ページ  k/<workId>.html
 * ===================================================================== */
function workPage(wk) {
  const rel = `k/${wk.id}.html`;
  const list = passagesByWork.get(wk.id) || [];
  const wordIds = Array.from(wordIdsByWork.get(wk.id) || [])
    .map((id) => wordById.get(id))
    .sort((a, b) => a.kanaOrder - b.kanaOrder);
  const exams = examsOf(wk);
  const examYears = exams.map((e) => `${e.year} 年度${e.test || ''}`).join('・');
  /* 本文が未収録の作品（入試の出典として作品情報だけ登録したもの）は、
     「教材 0 編・単語 0 語」と書いても意味が無いので、書誌と出題歴を前に出す。 */
  const title = list.length
    ? `${wk.title}（${wk.author}）の教材と古文単語｜${SITE.name}`
    : `${wk.title}（${wk.author}）の解説${exams.length ? 'と入試での出題' : ''}｜${SITE.name}`;
  const desc = clamp(list.length
    ? `${wk.title}（${wk.author}・${wk.era}／${wk.genre}）の教科書教材 ${list.length} 編の原文と現代語訳、` +
      `この作品で押さえたい古文単語 ${wordIds.length} 語。` +
      (exams.length ? `${examYears}の古文の出典。` : '') + wk.summary
    : `${wk.title}（${wk.author}・${wk.era}／${wk.genre}）の作者・成立時代・ジャンルとあらすじ。` +
      (exams.length ? `${examYears}の国語（古文）の出典。` : '') + wk.summary
  );

  const crumbs = [
    { label: 'ホーム', href: '../', abs: BASE },
    { label: '作品一覧', href: 'index.html', abs: BASE + 'k/index.html' },
    { label: wk.title, href: rel }
  ];

  let body = `<header class="work-head">
<p class="word-head-badges"><span class="badge pos">${esc(wk.genre)}</span></p>
<h1 class="view-title">${esc(wk.title)}</h1>
${exams.length ? `<p class="work-exam-badges">${exams.map(examBadgeHtml).join('')}</p>\n` : ''}<p class="work-meta muted">${esc(wk.author)}　/　${esc(wk.era)}　/　${esc(wk.genre)}</p>
<p class="work-summary">${esc(wk.summary)}</p>
</header>
`;

  /* 入試での出題（年・試験・本試験/第1日程・出題箇所） */
  if (exams.length) {
    body += `<div class="card exam-card"><h2 class="card-title">${esc(wk.title)}の入試での出題</h2>
<ul class="exam-list">` +
      exams.map((e) => `<li class="exam-list-item">${examBadgeHtml(e)}` +
        `<span class="exam-list-part">${esc(e.part || '')}</span>` +
        ((e.section && e.section !== '—') ? `<span class="exam-list-section muted">出題箇所：${esc(e.section)}</span>` : '') +
        '</li>').join('') +
      `</ul>
<p class="muted small">大学入学共通テスト（2021 年度〜）・センター試験（2016〜2020 年度）の国語（古文）の出典です。収めているのは著作権保護期間の満了した原文と、このサイトで書き下ろした現代語訳だけで、試験の設問・注・リード文は載せていません。</p>
<p class="home-more"><a href="index.html">ほかの作品を見る →</a></p></div>\n`;
  }

  if (list.length) {
    body += `<div class="card"><h2 class="card-title">${esc(wk.title)}の教材（${list.length}）</h2><div class="passage-grid">` +
      list.map((p) => `<a class="passage-card" href="../p/${esc(p.id)}.html">
<div class="passage-card-head"><span class="passage-card-title">${esc(p.title)}</span></div>
<p class="passage-card-section muted">${esc(p.section || '')}${(p.grade || []).length ? '　/　' + esc(p.grade.join('・')) : ''}</p>
<p class="passage-card-lead">${esc(((p.paragraphs[0] || {}).text || '').slice(0, 40))}…</p>
<p class="passage-card-stats"><span class="badge count">${p.paragraphs.length} 段落</span><span class="badge count">${(p.vocab || []).length} 語</span></p></a>`).join('') +
      `</div></div>\n`;
  } else {
    body += `<div class="card"><h2 class="card-title">${esc(wk.title)}の教材</h2><p class="muted">${exams.length
      ? '本文は未収録です。信頼できる翻刻を確認できた作品から順に収めているため、この作品は作品情報（作者・時代・ジャンルと出題された場面）だけを載せています。'
      : '文章はまだ収録していません。'}</p>` +
      (exams.length ? `<p class="home-more"><a href="../p/index.html">本文つきの教材を読む →</a></p>` : '') +
      `</div>\n`;
  }

  if (wordIds.length) {
    body += `<div class="card"><h2 class="card-title">${esc(wk.title)}で押さえたい古文単語（${wordIds.length}）</h2><div class="chip-list">` +
      wordIds.map((w) => `<a class="chip" href="../w/${w.id}.html"><span class="chip-kana">${esc(w.kana)}</span>${w.kanji ? `<span class="chip-kanji">〔${esc(w.kanji)}〕</span>` : ''}<span class="chip-meaning">${esc(w.primaryMeaning)}</span></a>`).join('') +
      `</div></div>\n`;
  }

  const graph = [
    {
      '@type': 'Book',
      '@id': BASE + rel + '#work',
      name: wk.title,
      author: { '@type': 'Person', name: wk.author },
      genre: wk.genre,
      description: `${wk.summary}（成立：${wk.era}）` +
        (exams.length ? `　大学入学共通テスト・センター試験 国語（古文）の出典：${exams.map((e) => examLabel(e, true)).join('／')}` : ''),
      inLanguage: 'ja',
      url: BASE + rel,
      about: exams.length ? exams.map((e) => ({
        '@type': 'Thing',
        name: `${e.year} 年度${e.test || ''}${e.part ? '（' + e.part + '）' : ''} 国語（古文）の出典`
      })) : undefined,
      hasPart: list.map((p) => ({
        '@type': 'CreativeWork',
        name: p.title,
        url: BASE + `p/${p.id}.html`
      }))
    },
    breadcrumbLd(rel, crumbs)
  ];

  return renderPage({ rel, title, desc, graph, crumbs, appHash: `#/work/${wk.id}`, body });
}

/* =====================================================================
 * 一覧ページ
 * ===================================================================== */
function collectionLd(rel, name, desc, crumbs) {
  return [
    {
      '@type': 'CollectionPage',
      '@id': BASE + rel + '#page',
      name,
      description: desc,
      inLanguage: 'ja',
      url: BASE + rel,
      isPartOf: { '@type': 'WebSite', name: SITE.name, url: BASE }
    },
    breadcrumbLd(rel, crumbs)
  ];
}

function wordIndexPage() {
  const rel = 'w/index.html';
  const title = `古文単語 ${words.length} 語の一覧（重要度・五十音順）｜${SITE.name}`;
  const desc = clamp(
    `大学入試・共通テスト向けの古文単語 ${words.length} 語を重要度（S 最重要 ${words.filter((w) => w.level === 'S').length} 語／A 頻出／B 応用）と五十音順で一覧。` +
    '語をたどると意味・関連語・教科書教材での用例が読めます。'
  );
  const crumbs = [
    { label: 'ホーム', href: '../', abs: BASE },
    { label: '古文単語 330 語', href: rel }
  ];

  let body = `<h1 class="view-title">古文単語 ${words.length} 語 一覧</h1>
<p class="view-lead">大学入試・共通テストで問われる古文単語を重要度（S 最重要／A 頻出／B 応用）で分けて並べています。語をたどると意味・語義、関連語、教科書教材での用例（原文と現代語訳）が読めます。<a href="../p/index.html">教科書の文章一覧</a>／<a href="../k/index.html">作品一覧</a></p>
`;

  LEVEL_ORDER.forEach((lv) => {
    const list = words.filter((w) => w.level === lv).sort((a, b) => a.kanaOrder - b.kanaOrder);
    if (!list.length) return;
    body += `<div class="card"><h2 class="card-title">重要度 ${lv} ${esc(list[0].levelLabel)}（${list.length} 語）</h2>
<p class="muted small">${esc(LEVEL_DESC[lv] || '')}</p>
<div class="word-list">` +
      list.map((w) => `<a class="word-row lv-${w.level}" href="${w.id}.html">
<div class="word-row-head"><span class="badge pos">${esc(w.pos)}</span><span class="word-kana">${esc(w.kana)}</span>${w.kanji ? `<span class="word-kanji">〔${esc(w.kanji)}〕</span>` : ''}</div>
<div class="word-row-meaning">${esc(w.meanings.join('／'))}</div></a>`).join('') +
      `</div></div>\n`;
  });

  body += `<div class="card"><h2 class="card-title">五十音順でさがす</h2>`;
  KANA_ROWS.forEach((row) => {
    const list = sortedByKana.filter((w) => w.kanaRow === row);
    if (!list.length) return;
    body += `<h3 class="rel-type">${esc(row)}（${list.length} 語）</h3><div class="chip-list">` +
      list.map((w) => `<a class="chip" href="${w.id}.html"><span class="chip-kana">${esc(w.kana)}</span><span class="chip-meaning">${esc(w.primaryMeaning)}</span></a>`).join('') +
      `</div>`;
  });
  body += `</div>\n`;

  return renderPage({
    rel, title, desc,
    graph: collectionLd(rel, `古文単語 ${words.length} 語 一覧`, desc, crumbs),
    crumbs, appHash: '#/words', body
  });
}

function passageIndexPage() {
  const rel = 'p/index.html';
  const title = `教科書の古典教材 ${passages.length} 編の現代語訳・品詞分解一覧｜${SITE.name}`;
  const desc = clamp(
    `中学・高校の教科書に載る古典教材 ${passages.length} 編（${works.slice(0, 5).map((w) => w.title).join('・')} ほか）の原文・現代語訳・品詞分解の一覧。` +
    '文章ごとにその文章に出てくる古文単語の意味も確認できます。'
  );
  const crumbs = [
    { label: 'ホーム', href: '../', abs: BASE },
    { label: '教科書の文章', href: rel }
  ];

  let body = `<h1 class="view-title">教科書の古典教材 ${passages.length} 編</h1>
<p class="view-lead">中学・高校の教科書に定番として載る古典教材と、大学入学共通テスト・センター試験で出典になった作品の本文を、原文・現代語訳・全文の品詞分解つきで収録しています。作品名から作品の解説へ、教材名から本文へ進めます。<a href="../w/index.html">古文単語 ${words.length} 語の一覧</a>／<a href="../k/index.html">作品一覧</a></p>
`;

  works.forEach((wk) => {
    const list = passagesByWork.get(wk.id) || [];
    if (!list.length) return;
    body += `<div class="card">
<h2 class="card-title"><a href="../k/${esc(wk.id)}.html">${esc(wk.title)}</a></h2>
${examsOf(wk).length ? `<p class="textbook-work-exam">${examsOf(wk).map(examBadgeHtml).join('')}</p>\n` : ''}<p class="muted small">${esc(wk.author)}　/　${esc(wk.era)}　/　${esc(wk.genre)}</p>
<div class="passage-grid">` +
      list.map((p) => `<a class="passage-card" href="${esc(p.id)}.html">
<div class="passage-card-head"><span class="passage-card-title">${esc(p.title)}</span>${p.exam ? examBadgeHtml(Object.assign({}, examsOf(wk).filter((e) => e.year === p.exam.year)[0] || {}, p.exam)) : ''}</div>
<p class="passage-card-section muted">${esc(p.section || '')}${(p.grade || []).length ? '　/　' + esc(p.grade.join('・')) : ''}</p>
<p class="passage-card-lead">${esc(((p.paragraphs[0] || {}).text || '').slice(0, 40))}…</p>
<p class="passage-card-stats"><span class="badge count">${p.paragraphs.length} 段落</span><span class="badge count">${(p.vocab || []).length} 語</span>${tokens[p.id] ? '<span class="badge count">品詞分解あり</span>' : ''}</p></a>`).join('') +
      `</div></div>\n`;
  });

  return renderPage({
    rel, title, desc,
    graph: collectionLd(rel, `教科書の古典教材 ${passages.length} 編`, desc, crumbs),
    crumbs, appHash: '#/textbook', body
  });
}

function workIndexPage() {
  const rel = 'k/index.html';
  const title = `古典作品 ${works.length} 作の解説と収録教材・古文単語｜${SITE.name}`;
  const desc = clamp(
    `${works.map((w) => w.title).slice(0, 8).join('・')} など古典作品 ${works.length} 作の作者・成立時代・ジャンルと、` +
    '教科書教材の現代語訳・その作品で押さえたい古文単語の一覧。'
  );
  const crumbs = [
    { label: 'ホーム', href: '../', abs: BASE },
    { label: '作品一覧', href: rel }
  ];

  let body = `<h1 class="view-title">古典作品 ${works.length} 作</h1>
<p class="view-lead">教材を収録している古典作品と、大学入学共通テスト・センター試験の出典になった作品の一覧です。作品ごとに、収録している教材（原文・現代語訳・品詞分解）・入試での出題歴・その作品で押さえたい古文単語がまとまっています。<a href="../w/index.html">古文単語 ${words.length} 語の一覧</a>／<a href="../p/index.html">教科書の文章一覧</a></p>
<div class="passage-grid">
`;
  works.forEach((wk) => {
    const list = passagesByWork.get(wk.id) || [];
    const n = (wordIdsByWork.get(wk.id) || new Set()).size;
    body += `<a class="passage-card" href="${esc(wk.id)}.html">
<div class="passage-card-head"><span class="passage-card-title">${esc(wk.title)}</span><span class="badge pos">${esc(wk.genre)}</span>${examsOf(wk).map(examBadgeHtml).join('')}</div>
<p class="passage-card-section muted">${esc(wk.author)}　/　${esc(wk.era)}</p>
<p class="passage-card-lead">${esc(wk.summary.slice(0, 70))}…</p>
<p class="passage-card-stats"><span class="badge count">教材 ${list.length} 編</span><span class="badge count">収録語 ${n} 語</span></p></a>`;
  });
  body += `</div>\n`;

  return renderPage({
    rel, title, desc,
    graph: collectionLd(rel, `古典作品 ${works.length} 作`, desc, crumbs),
    crumbs, appHash: '#/textbook', body
  });
}

/* =====================================================================
 * sitemap.xml / robots.txt
 * ===================================================================== */
function buildSitemap(urls) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) =>
      `  <url>\n    <loc>${esc(u.loc)}</loc>\n    <lastmod>${TODAY}</lastmod>\n` +
      `    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    ).join('\n') + '\n</urlset>\n';
}

function buildRobots() {
  return [
    '# tools/build-seo.mjs が生成しています。手で編集しないこと。',
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${BASE}sitemap.xml`,
    ''
  ].join('\n');
}

/* =====================================================================
 * 実行
 * ===================================================================== */
cleanDir('w');
cleanDir('p');
cleanDir('k');

const sitemap = [{ loc: BASE, changefreq: 'weekly', priority: '1.0' }];

words.forEach((w) => {
  writeFile(`w/${w.id}.html`, wordPage(w));
  sitemap.push({ loc: `${BASE}w/${w.id}.html`, changefreq: 'monthly', priority: '0.7' });
});
writeFile('w/index.html', wordIndexPage());
sitemap.push({ loc: `${BASE}w/index.html`, changefreq: 'weekly', priority: '0.9' });

let tokenRows = 0;
passages.forEach((p) => {
  const out = passagePage(p);
  tokenRows += out.tokenRowCount;
  writeFile(`p/${p.id}.html`, out.html);
  sitemap.push({ loc: `${BASE}p/${p.id}.html`, changefreq: 'monthly', priority: '0.8' });
});
writeFile('p/index.html', passageIndexPage());
sitemap.push({ loc: `${BASE}p/index.html`, changefreq: 'weekly', priority: '0.9' });

works.forEach((wk) => {
  writeFile(`k/${wk.id}.html`, workPage(wk));
  sitemap.push({ loc: `${BASE}k/${wk.id}.html`, changefreq: 'monthly', priority: '0.7' });
});
writeFile('k/index.html', workIndexPage());
sitemap.push({ loc: `${BASE}k/index.html`, changefreq: 'weekly', priority: '0.9' });

writeFile('sitemap.xml', buildSitemap(sitemap));
writeFile('robots.txt', buildRobots());

console.log(`単語ページ   w/*.html        ${words.length} 件`);
console.log(`文章ページ   p/*.html        ${passages.length} 件（品詞分解の行 ${tokenRows}）`);
console.log(`作品ページ   k/*.html        ${works.length} 件`);
console.log(`一覧ページ   w/p/k index      3 件`);
console.log(`sitemap.xml                  ${sitemap.length} URL（lastmod ${TODAY}）`);
console.log(`robots.txt                   Sitemap: ${BASE}sitemap.xml`);
console.log(`合計 ${words.length + passages.length + works.length + 3} ページ（?v=${VERSION}）`);
console.log('公開前に node tools/bump-version.mjs を実行してください（生成ページの ?v= も揃います）。');
