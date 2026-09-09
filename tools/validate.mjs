/* =====================================================================
 * tools/validate.mjs — データ整合性チェック
 * ---------------------------------------------------------------------
 * 使い方:  node tools/validate.mjs
 *          （D:\kobun_app で実行。node 18 以上）
 *
 * data/*.js は「window.KOBUN に代入する」だけの素直なスクリプトなので、
 * Node 側で window を用意してから vm で評価すれば、そのまま読める。
 * ブラウザで読むファイルと同じものを検査していることになる。
 *
 * チェック内容:
 *   [words]      id の重複 / 必須フィールドの欠落 / levelとlevelOrderの整合
 *   [works]      id の重複
 *   [relations]  from・to が実在する wordId か / 自己参照 / 重複 / type が空でないか
 *   [examples]   id 重複 / workId 実在 / tokens の wordId 実在 /
 *                tokens.surface の連結が text と一致するか / 必須フィールド
 *   [workWords]  workId・wordId 実在 / 組み合わせ重複
 *   [passages]   id 重複 / workId・wordId・exampleIds 実在 /
 *                paragraphs の text・translation /
 *                **vocab[].surface が paragraphs[].text に実際に出現するか** /
 *                meaningIndex が meanings の範囲内か /
 *                wordId 無しの vocab に meaning があるか /
 *                同じ wordId を 1 文章に 2 回書いていないか /
 *                wordId ありの surface が見出し語・漢字表記と字面で繋がるか（警告）
 * ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILES = ['words.js', 'works.js', 'relations.js', 'examples.js', 'workWords.js', 'passages.js'];

/* --- data/*.js を Node 上で評価して window.KOBUN を組み立てる --------- */
const sandbox = { window: {}, console };
vm.createContext(sandbox);
for (const f of DATA_FILES) {
  const p = path.join(ROOT, 'data', f);
  const src = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  vm.runInContext(src, sandbox, { filename: p });
}
const K = sandbox.window.KOBUN;

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`[ERROR] ${where} ${msg}`);
const warn = (where, msg) => warnings.push(`[WARN ] ${where} ${msg}`);

/* --- words ---------------------------------------------------------- */
const words = K.words || [];
const wordById = new Map();
const REQUIRED_WORD_KEYS = [
  'id', 'level', 'levelLabel', 'levelOrder', 'pos', 'posOrder', 'kana',
  'headwords', 'meanings', 'primaryMeaning', 'meaningCount',
  'searchKeys', 'romaji', 'sortKey', 'kanaRow', 'kanaOrder'
];
const LEVEL_ORDER = { S: 1, A: 2, B: 3 };

if (words.length === 0) err('words', '空です');
for (const w of words) {
  const at = `words(id=${w.id})`;
  for (const k of REQUIRED_WORD_KEYS) {
    if (!(k in w)) err(at, `必須フィールド "${k}" がありません`);
  }
  if (typeof w.id !== 'number' || !Number.isInteger(w.id)) err(at, 'id が整数ではありません');
  if (wordById.has(w.id)) err(at, `id が重複しています`);
  wordById.set(w.id, w);
  if (!Array.isArray(w.meanings) || w.meanings.length === 0) err(at, 'meanings が空です');
  if (Array.isArray(w.meanings) && w.meanings.length !== w.meaningCount) {
    err(at, `meaningCount(${w.meaningCount}) と meanings.length(${w.meanings.length}) が不一致`);
  }
  if (Array.isArray(w.meanings) && w.meanings[0] !== w.primaryMeaning) {
    err(at, 'primaryMeaning が meanings[0] と一致しません');
  }
  if (LEVEL_ORDER[w.level] !== w.levelOrder) err(at, `level(${w.level}) と levelOrder(${w.levelOrder}) が不整合`);
  if (!Array.isArray(w.searchKeys) || w.searchKeys.length === 0) err(at, 'searchKeys が空です');
  // js/util.js の romajiVariants は「wokashi と打っても okashi に当てる」ため
  // クエリの wo/wi/we/hu を o/i/e/fu に置き換える。romaji 側にこれらが
  // 出現すると別語に化けるので、出現しないことをここで保証しておく。
  if (typeof w.romaji === 'string' && /(wo|wi|we|hu)/.test(w.romaji)) {
    warn(at, `romaji "${w.romaji}" に wo/wi/we/hu が含まれます（js/util.js の romajiVariants の前提が崩れます）`);
  }
}

/* --- works ---------------------------------------------------------- */
const works = K.works || [];
const workById = new Map();
for (const wk of works) {
  const at = `works(id=${wk.id})`;
  if (!wk.id) err(at, 'id がありません');
  if (workById.has(wk.id)) err(at, 'id が重複しています');
  workById.set(wk.id, wk);
  for (const k of ['title', 'author', 'era', 'genre', 'summary']) {
    if (!wk[k]) warn(at, `"${k}" が空です`);
  }
}

/* --- relations ------------------------------------------------------ */
const relations = K.relations || [];
const relSeen = new Set();
relations.forEach((r, i) => {
  const at = `relations[${i}] (${r.from}→${r.to})`;
  if (!wordById.has(r.from)) err(at, `from=${r.from} が words に存在しません`);
  if (!wordById.has(r.to)) err(at, `to=${r.to} が words に存在しません`);
  if (r.from === r.to) err(at, '自己参照です');
  if (!r.type) err(at, 'type が空です');
  const key = [Math.min(r.from, r.to), Math.max(r.from, r.to), r.type].join('/');
  if (relSeen.has(key)) warn(at, '同じ組み合わせ・同じ type の関連が重複しています');
  relSeen.add(key);
  if (!r.note) warn(at, 'note が空です（あとで読み返すときに困ります）');
});

/* --- examples ------------------------------------------------------- */
const examples = K.examples || [];
const exampleIds = new Set();
examples.forEach((ex, i) => {
  const at = `examples[${i}] (id=${ex.id})`;
  if (!ex.id) err(at, 'id がありません');
  if (exampleIds.has(ex.id)) err(at, 'id が重複しています');
  exampleIds.add(ex.id);
  if (!workById.has(ex.workId)) err(at, `workId="${ex.workId}" が works に存在しません`);
  if (!ex.text) err(at, 'text が空です');
  if (!ex.translation) warn(at, 'translation が空です');
  if (!Array.isArray(ex.tokens) || ex.tokens.length === 0) {
    err(at, 'tokens が空です');
    return;
  }
  const joined = ex.tokens.map((t) => t.surface ?? '').join('');
  if (joined !== ex.text) {
    err(at, `tokens.surface の連結が text と一致しません\n         text  : ${ex.text}\n         tokens: ${joined}`);
  }
  ex.tokens.forEach((t, j) => {
    const tAt = `${at}.tokens[${j}] ("${t.surface}")`;
    if (!t.surface) err(tAt, 'surface が空です');
    if (!t.base) warn(tAt, 'base が空です');
    if (!t.pos) err(tAt, 'pos が空です');
    if (t.wordId != null && !wordById.has(t.wordId)) {
      err(tAt, `wordId=${t.wordId} が words に存在しません`);
    }
    if (t.pos !== '記号' && !t.meaning) warn(tAt, 'meaning が空です');
  });
});

/* --- workWords ------------------------------------------------------ */
const workWords = K.workWords || [];
const wwSeen = new Set();
workWords.forEach((ww, i) => {
  const at = `workWords[${i}] (${ww.workId}/${ww.wordId})`;
  if (!workById.has(ww.workId)) err(at, `workId="${ww.workId}" が works に存在しません`);
  if (!wordById.has(ww.wordId)) err(at, `wordId=${ww.wordId} が words に存在しません`);
  const key = `${ww.workId}/${ww.wordId}`;
  if (wwSeen.has(key)) err(at, '同じ組み合わせが重複しています');
  wwSeen.add(key);
  if (!ww.note) warn(at, 'note が空です');
});

/* --- passages -------------------------------------------------------- *
 * 文章（教材）データ。品詞分解を持たない代わりに、
 * vocab[].surface が本文に本当に出てくることを厳しく見る
 * （出てこないとハイライトされず、学習者が語を探せなくなる）。
 * ---------------------------------------------------------------------- */
const passages = K.passages || [];
const passageIds = new Set();
/** surface が語の見出し・漢字表記と字面で繋がるか（緩いチェック） */
function surfaceLooksRelated(word, surface) {
  const forms = [];
  for (const h of word.headwords || []) forms.push(h);
  if (word.kana) forms.push(word.kana);
  if (word.kanji) for (const k of String(word.kanji).split(/[・／\/]/)) forms.push(k);
  for (const f of forms) {
    if (!f) continue;
    if (surface.startsWith(f.slice(0, 2)) || surface.startsWith(f.slice(0, 1))) return true;
    if (f.startsWith(surface.slice(0, 2)) || f.startsWith(surface.slice(0, 1))) return true;
  }
  return false;
}

passages.forEach((p, i) => {
  const at = `passages[${i}] (id=${p.id})`;
  if (!p.id) err(at, 'id がありません');
  if (passageIds.has(p.id)) err(at, 'id が重複しています');
  passageIds.add(p.id);
  if (!workById.has(p.workId)) err(at, `workId="${p.workId}" が works に存在しません`);
  if (!p.title) err(at, 'title がありません');
  if (!p.note) warn(at, 'note が空です（校閲状況を書いておくと後で助かります）');

  if (!Array.isArray(p.paragraphs) || p.paragraphs.length === 0) {
    err(at, 'paragraphs が空です');
    return;
  }
  p.paragraphs.forEach((par, j) => {
    const pAt = `${at}.paragraphs[${j}]`;
    if (!par.text) err(pAt, 'text が空です');
    if (!par.translation) err(pAt, 'translation が空です');
  });
  const fullText = p.paragraphs.map((par) => par.text || '').join('\n');

  for (const exId of p.exampleIds || []) {
    if (!exampleIds.has(exId)) err(at, `exampleIds の "${exId}" が examples に存在しません`);
  }

  if (!Array.isArray(p.vocab) || p.vocab.length === 0) {
    warn(at, 'vocab が空です（学習デッキが作れません）');
    return;
  }
  const seenWordIds = new Set();
  const seenSurfaces = new Set();
  p.vocab.forEach((v, j) => {
    const vAt = `${at}.vocab[${j}] ("${v.surface}")`;
    if (!v.surface) { err(vAt, 'surface が空です'); return; }
    // ★ いちばん大事なチェック: 本文に出てこない surface はハイライトできない
    if (fullText.indexOf(v.surface) < 0) {
      err(vAt, `surface が paragraphs[].text のどこにも出てきません（原文と綴りが違う可能性）`);
    }
    // 1 文字の仮名は別語の一部（「え」が「消え」に当たるなど）に当たりやすい。
    // 1 文字の漢字はふつう安全なので警告しない。
    if (v.surface.length === 1 && /^[぀-ヿ]$/.test(v.surface)) {
      warn(vAt, 'surface が仮名 1 文字です。別語の一部にも当たってしまうので、2 文字以上の形にしてください');
    }
    if (seenSurfaces.has(v.surface)) err(vAt, 'この文章の中で surface が重複しています');
    seenSurfaces.add(v.surface);

    if (v.wordId != null) {
      const w = wordById.get(v.wordId);
      if (!w) { err(vAt, `wordId=${v.wordId} が words に存在しません`); return; }
      if (seenWordIds.has(v.wordId)) {
        err(vAt, `同じ wordId=${v.wordId} をこの文章で 2 回書いています（1 語 1 回にしてください）`);
      }
      seenWordIds.add(v.wordId);
      if (typeof v.meaningIndex !== 'number') {
        err(vAt, 'meaningIndex がありません（この文脈での語義の添字）');
      } else if (v.meaningIndex < 0 || v.meaningIndex >= w.meanings.length) {
        err(vAt, `meaningIndex=${v.meaningIndex} が範囲外です（"${w.kana}" の meanings は ${w.meanings.length} 個）`);
      }
      if (v.meaning) warn(vAt, 'wordId があるので meaning は不要です（words.js の語義を使います）');
      if (!surfaceLooksRelated(w, v.surface)) {
        warn(vAt, `surface が見出し語 "${w.kana}"${w.kanji ? `／"${w.kanji}"` : ''} と字面で繋がりません（活用形・当て字の確認を）`);
      }
    } else {
      if (!v.meaning) err(vAt, 'wordId が無いので meaning（語義）が必須です');
      if (!v.pos) warn(vAt, 'pos が空です（クイズの誤答選びに使います）');
      if (v.meaningIndex != null) warn(vAt, 'wordId が無いのに meaningIndex があります');
    }
  });
});

/* --- 集計 ----------------------------------------------------------- */
const taggedWordIds = new Set();
for (const ex of examples) for (const t of ex.tokens || []) if (t.wordId != null) taggedWordIds.add(t.wordId);
for (const ww of workWords) taggedWordIds.add(ww.wordId);
for (const p of passages) for (const v of p.vocab || []) if (v.wordId != null) taggedWordIds.add(v.wordId);
const passageVocabTotal = passages.reduce((n, p) => n + (p.vocab?.length || 0), 0);
const passageExtraTotal = passages.reduce(
  (n, p) => n + (p.vocab || []).filter((v) => v.wordId == null).length, 0);
const passageParaTotal = passages.reduce((n, p) => n + (p.paragraphs?.length || 0), 0);
const relatedWordIds = new Set();
for (const r of relations) { relatedWordIds.add(r.from); relatedWordIds.add(r.to); }

console.log('=== 古文単語帳アプリ データ検証 ===');
console.log(`  単語         : ${words.length} 語`);
console.log(`  作品         : ${works.length} 件`);
console.log(`  関連語リンク : ${relations.length} 本（延べ ${relatedWordIds.size} 語がリンクを持つ）`);
console.log(`  例文         : ${examples.length} 文 / トークン計 ${examples.reduce((n, e) => n + (e.tokens?.length || 0), 0)}`);
console.log(`  作品タグ     : ${workWords.length} 件`);
console.log(`  文章（教材） : ${passages.length} 編 / 段落計 ${passageParaTotal}`);
console.log(`  文章の語     : ${passageVocabTotal} 件（うち 330 語に無い文章固有語 ${passageExtraTotal} 件）`);
console.log(`  作品に紐づく語: ${taggedWordIds.size} 語（例文 tokens ∪ workWords ∪ passages.vocab）`);
console.log('');

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
