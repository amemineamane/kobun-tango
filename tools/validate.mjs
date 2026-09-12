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
 *   [workWords]  workId・wordId 実在 / 組み合わせ重複
 *   [passages]   id 重複 / workId・wordId 実在 /
 *                paragraphs の text・translation /
 *                **vocab[].surface が paragraphs[].text に実際に出現するか** /
 *                meaningIndex が meanings の範囲内か /
 *                wordId 無しの vocab に meaning があるか /
 *                同じ wordId を 1 文章に 2 回書いていないか /
 *                wordId ありの surface が見出し語・漢字表記と字面で繋がるか（警告）
 *   [grammar]    古典文法（data/grammar.js）。tools/validate-grammar.mjs を
 *                子プロセスとして呼ぶ（id の重複・table の要素数・match が
 *                コーパスに当たるか・取りこぼし）。文法データは用例を持たず
 *                「match 規則」でコーパスと結びつくので、検査も
 *                js/data-index.js を通して画面と同じ経路で行う。
 *   [tokens]     品詞分解（data/tokens/*.js）。最後に tools/validate-tokens.mjs を
 *                子プロセスとして呼び、その出力をそのまま流す。
 *                品詞分解は 1 文章 1 ファイルで分担して書き足していくので、
 *                検査も独立して回せるよう別ファイルのままにしてある
 *                （品詞分解だけ見たいときは node tools/validate-tokens.mjs）。
 *                どちらかにエラーがあれば、このコマンドは異常終了する。
 * ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// data/examples.js は役目を終えて docs/legacy/ に退避した（DESIGN.md 5.2 の経緯）。
// 教材の品詞分解は data/tokens/*.js が持ち、tools/validate-tokens.mjs が見る。
const DATA_FILES = ['words.js', 'works.js', 'relations.js', 'workWords.js', 'passages.js'];

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

/* --- examples ------------------------------------------------------- *
 * data/examples.js（例文＋品詞分解）はここで検査していたが、
 * 教材の原文そのものに品詞分解が付いた（data/tokens/*.js）ので役目を終え、
 * docs/legacy/examples.js に退避した。検査は tools/validate-tokens.mjs が引き継ぐ。
 * 経緯は DESIGN.md「5.2 例文を足すには」参照。
 * ------------------------------------------------------------------- */

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
console.log(`  作品タグ     : ${workWords.length} 件`);
console.log(`  文章（教材） : ${passages.length} 編 / 段落計 ${passageParaTotal}`);
console.log(`  文章の語     : ${passageVocabTotal} 件（うち 330 語に無い文章固有語 ${passageExtraTotal} 件）`);
console.log(`  作品に紐づく語: ${taggedWordIds.size} 語（workWords ∪ passages.vocab。品詞分解の w は validate-tokens.mjs 側で数える）`);
console.log('');

for (const w of warnings) console.log(w);
if (warnings.length) console.log('');
for (const e of errors) console.log(e);

if (errors.length === 0) {
  console.log(`OK: エラー 0 件（警告 ${warnings.length} 件）`);
} else {
  console.log(`NG: エラー ${errors.length} 件 / 警告 ${warnings.length} 件`);
}

/* --- 品詞分解の検査を続けて走らせる --------------------------------- *
 * 別ファイル（tools/validate-tokens.mjs）のまま呼ぶ。
 * 出力は stdio: 'inherit' でそのまま画面に流れる。
 * ------------------------------------------------------------------- */
console.log('');
const tokenValidator = path.join(ROOT, 'tools', 'validate-tokens.mjs');
let tokenFailed = false;
if (fs.existsSync(tokenValidator)) {
  const r = spawnSync(process.execPath, [tokenValidator], { stdio: 'inherit' });
  tokenFailed = r.status !== 0;
} else {
  console.log('（tools/validate-tokens.mjs が無いので品詞分解の検査は飛ばしました）');
}

/* --- 古典文法の検査を続けて走らせる --------------------------------- *
 * data/grammar.js は用例を持たず、コーパス（data/tokens/*.js）と
 * match 規則で結びつく。品詞分解のあとに走らせるのは、
 * 「取りこぼし」の一覧が最新の品詞分解を前提にしているため。
 * ------------------------------------------------------------------- */
console.log('');
const grammarValidator = path.join(ROOT, 'tools', 'validate-grammar.mjs');
let grammarFailed = false;
if (fs.existsSync(grammarValidator)) {
  const r = spawnSync(process.execPath, [grammarValidator], { stdio: 'inherit' });
  grammarFailed = r.status !== 0;
} else {
  console.log('（tools/validate-grammar.mjs が無いので文法データの検査は飛ばしました）');
}

process.exit(errors.length === 0 && !tokenFailed && !grammarFailed ? 0 : 1);
