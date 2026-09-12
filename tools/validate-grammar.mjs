/* =====================================================================
 * tools/validate-grammar.mjs — 古典文法データ（data/grammar.js）の検査
 * ---------------------------------------------------------------------
 * 使い方:  node tools/validate-grammar.mjs
 *          （D:\kobun_app で実行。node 18 以上）
 *
 * data/*.js は「window.KOBUN に代入するだけ」のスクリプトなので、
 * Node 側に window を用意して vm で評価すればそのまま読める。
 * **js/data-index.js も同じ要領で読み込む**ので、
 * 用例の抽出（match 規則の照合）は画面とまったく同じコードを通る
 * ＝「検証では通ったのに画面で出ない」が起きない。
 *
 * チェック内容:
 *   [構造]   id の重複（カテゴリ横断）／必須フィールドの欠落／
 *            table が 6 要素か／meanings が空でないか／
 *            related の id が実在するか／keigo の wordId が 330 語にあるか
 *   [match]  各エントリの match がコーパス（data/tokens/*.js）に
 *            1 件以上ヒットするか（0 件は **警告**。用例がまだ無いだけで
 *            データの誤りとは限らないため）
 *            識別の cases[].match も同じように見る
 *   [取りこぼし]
 *            コーパスに出てくる助動詞・助詞のトークン（p ＋ b ＋ m の組）のうち、
 *            grammar.js のどのエントリにも当たらないものを一覧表示（警告）。
 *            敬語（m に（尊敬）（謙譲）（丁寧）を持つ語）も同様に見る。
 *   [集計]   コーパスに実際に出ている用法ラベル（m の「（　）」の中身）を
 *            品詞・基本形ごとに集計して出す（-v / --verbose で全件）。
 *
 * エラーがあれば異常終了（exit 1）。警告だけなら 0。
 * ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERBOSE = process.argv.slice(2).some((a) => a === '-v' || a === '--verbose');

/* --- data/*.js ＋ js/data-index.js を Node 上で評価する -------------- */
const sandbox = { window: {}, console };
vm.createContext(sandbox);

function run(rel) {
  const p = path.join(ROOT, rel);
  const src = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  vm.runInContext(src, sandbox, { filename: p });
}

for (const f of ['site.js', 'words.js', 'works.js', 'relations.js', 'workWords.js', 'passages.js', 'grammar.js']) {
  run(path.join('data', f));
}
const tokensDir = path.join(ROOT, 'data', 'tokens');
const tokenFiles = fs.existsSync(tokensDir)
  ? fs.readdirSync(tokensDir).filter((f) => f.endsWith('.js')).sort()
  : [];
for (const f of tokenFiles) run(path.join('data', 'tokens', f));

/* js/data-index.js は DOM を触らないので、そのまま評価できる。
   util.js は searchKeys の正規化にだけ使われる（無くても動くが揃えておく）。 */
run(path.join('js', 'util.js'));
run(path.join('js', 'data-index.js'));

const K = sandbox.window.KOBUN;
const G = K.grammar;
const idx = K.index;
const words = K.words || [];

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`[ERROR] ${where} ${msg}`);
const warn = (where, msg) => warnings.push(`[WARN ] ${where} ${msg}`);

if (!G) {
  console.log('[ERROR] data/grammar.js が window.KOBUN.grammar を作っていません');
  process.exit(1);
}

const wordById = new Map(words.map((w) => [w.id, w]));

/* =====================================================================
 * 1. 構造の検査
 * ===================================================================== */
const FORMS = 6;
const seenId = new Map();          // id -> 'aux' など
const allEntries = [];             // { entry, category }

function pushEntry(entry, category, at) {
  if (!entry || !entry.id) { err(at, 'id がありません'); return; }
  if (seenId.has(entry.id)) {
    err(at, `id "${entry.id}" が重複しています（先に ${seenId.get(entry.id)} で使用）`);
  }
  seenId.set(entry.id, category);
  allEntries.push({ entry, category });
}

/* --- 助動詞 --- */
const auxiliaries = G.auxiliaries || [];
if (!auxiliaries.length) err('grammar.auxiliaries', '空です');
for (const a of auxiliaries) {
  const at = `auxiliaries(${a && a.id})`;
  pushEntry(a, 'aux', at);
  if (!a) continue;
  for (const k of ['name', 'kind', 'attach', 'conj', 'table', 'meanings', 'tips', 'match']) {
    if (!a[k]) err(at, `必須フィールド "${k}" がありません`);
  }
  if (Array.isArray(a.table) && a.table.length !== FORMS) {
    err(at, `table が ${a.table.length} 要素です（未然・連用・終止・連体・已然・命令 の ${FORMS} 要素にしてください）`);
  }
  if (!Array.isArray(a.meanings) || !a.meanings.length) err(at, 'meanings が空です');
  for (const m of a.meanings || []) {
    if (!m.label) err(at, 'meanings に label がありません');
    if (!m.gloss) err(at, `meanings「${m.label}」に gloss（訳）がありません`);
    if (!m.how) warn(at, `meanings「${m.label}」に how（見分け方）がありません`);
  }
}

/* --- 助詞 --- */
const particles = G.particles || [];
if (!particles.length) err('grammar.particles', '空です');
const PARTICLE_KINDS = ['格助詞', '接続助詞', '係助詞', '副助詞', '終助詞', '間投助詞'];
for (const p of particles) {
  const at = `particles(${p && p.id})`;
  pushEntry(p, 'particle', at);
  if (!p) continue;
  for (const k of ['name', 'kind', 'attach', 'meanings', 'tips', 'match']) {
    if (!p[k]) err(at, `必須フィールド "${k}" がありません`);
  }
  if (p.kind && PARTICLE_KINDS.indexOf(p.kind) < 0) {
    err(at, `kind "${p.kind}" は助詞の分類（${PARTICLE_KINDS.join('／')}）にありません`);
  }
  if (!Array.isArray(p.meanings) || !p.meanings.length) err(at, 'meanings が空です');
}

/* --- 敬語 --- */
const keigoWords = (G.keigo && G.keigo.words) || [];
if (!keigoWords.length) err('grammar.keigo.words', '空です');
const KEIGO_KINDS = ((G.keigo && G.keigo.groups) || []).map((g) => g.kind);
for (const w of keigoWords) {
  const at = `keigo(${w && w.id})`;
  pushEntry(w, 'keigo', at);
  if (!w) continue;
  for (const k of ['word', 'kind', 'meaning', 'match']) {
    if (!w[k]) err(at, `必須フィールド "${k}" がありません`);
  }
  if (w.kind && KEIGO_KINDS.length && KEIGO_KINDS.indexOf(w.kind) < 0) {
    err(at, `kind "${w.kind}" は敬語の分類（${KEIGO_KINDS.join('／')}）にありません`);
  }
  if (w.wordId != null && !wordById.has(w.wordId)) {
    err(at, `wordId ${w.wordId} は data/words.js にありません`);
  }
  if (w.wordId == null && !('wordId' in w)) {
    warn(at, 'wordId のキー自体がありません（330 語に無いなら null と明記してください）');
  }
}

/* --- 活用 --- */
const conjGroups = (G.conjugation && G.conjugation.groups) || [];
if (!conjGroups.length) err('grammar.conjugation.groups', '空です');
for (const g of conjGroups) {
  for (const r of g.rows || []) {
    const at = `conjugation(${r && r.id})`;
    pushEntry(r, 'conj', at);
    if (!r) continue;
    for (const k of ['name', 'example', 'table', 'how']) {
      if (!r[k]) err(at, `必須フィールド "${k}" がありません`);
    }
    if (Array.isArray(r.table) && r.table.length !== FORMS) {
      err(at, `table が ${r.table.length} 要素です（${FORMS} 要素にしてください）`);
    }
  }
}

/* --- 識別 --- */
const idents = G.identification || [];
if (!idents.length) err('grammar.identification', '空です');
for (const e of idents) {
  const at = `identification(${e && e.id})`;
  pushEntry(e, 'ident', at);
  if (!e) continue;
  for (const k of ['title', 'cases', 'tips', 'match']) {
    if (!e[k]) err(at, `必須フィールド "${k}" がありません`);
  }
  if (!Array.isArray(e.cases) || e.cases.length < 2) {
    err(at, 'cases が 2 件未満です（識別なので 2 通り以上必要）');
  }
  for (const c of e.cases || []) {
    if (!c.label) err(at, 'cases に label がありません');
    if (!c.how) err(at, `cases「${c.label}」に how（見分け方）がありません`);
    if (!c.match) err(at, `cases「${c.label}」に match がありません（用例が引けません）`);
  }
}

/* --- 係り結び --- */
if (!G.kakari || !Array.isArray(G.kakari.rows) || !G.kakari.rows.length) {
  err('grammar.kakari', 'rows が空です');
}

/* --- related の id が実在するか --- */
for (const { entry, category } of allEntries) {
  for (const id of entry.related || []) {
    if (!seenId.has(id)) err(`${category}(${entry.id})`, `related の "${id}" が見つかりません`);
  }
}

/* =====================================================================
 * 2. match 規則がコーパスに当たるか
 * ===================================================================== */
const noHit = [];
for (const { entry, category } of allEntries) {
  if (category === 'conj') continue;   // 活用は c の対応表が view 側にあるので別扱い
  if (!entry.match) continue;
  const hits = idx.grammarExamples(entry, { limit: 1 });
  if (!hits.length) {
    noHit.push(`${category}/${entry.id}（${entry.name || entry.word || entry.title}）`);
  }
}

const caseNoHit = [];
for (const e of idents) {
  for (const c of e.cases || []) {
    if (!c.match) continue;
    if (!idx.grammarExamples(null, { match: c.match, limit: 1 }).length) {
      caseNoHit.push(`${e.id} / ${c.label}`);
    }
  }
}

/* =====================================================================
 * 3. 取りこぼし（コーパスにあるのに grammar.js が拾えない組み合わせ）
 * ===================================================================== */
const PARTICLE_POS = ['助動詞', '格助詞', '係助詞', '副助詞', '接続助詞', '終助詞', '間投助詞'];
const stats = idx.grammarTokenStats(PARTICLE_POS);
const missed = [];
let missedTokens = 0;
for (const st of stats) {
  const hit = idx.grammarOfToken(st.token);
  if (!hit || !hit.entry) {
    missed.push(st);
    missedTokens += st.count;
  }
}

/* 敬語（m に（尊敬）（謙譲）（丁寧）を持つ語）の取りこぼし */
const keigoStats = idx.grammarTokenStats(['動詞', '接頭語', '接尾語', '形容詞', '名詞'])
  .filter((st) => /^[（(](尊敬|謙譲|丁寧)/.test(st.m || ''));
const keigoMissed = [];
let keigoMissedTokens = 0;
for (const st of keigoStats) {
  const hit = idx.grammarOfToken(st.token);
  if (!hit || !hit.entry) { keigoMissed.push(st); keigoMissedTokens += st.count; }
}

/* =====================================================================
 * 4. 出力
 * ===================================================================== */
const auxLabels = new Map();   // 'b' -> Set<label>
for (const st of stats) {
  if (st.p !== '助動詞') continue;
  if (!auxLabels.has(st.b)) auxLabels.set(st.b, new Map());
  const m = auxLabels.get(st.b);
  m.set(st.label || '(ラベルなし)', (m.get(st.label || '(ラベルなし)') || 0) + st.count);
}

console.log('=== 古典文法データ検証（data/grammar.js） ===');
console.log(`  助動詞       : ${auxiliaries.length} 語`);
console.log(`  助詞         : ${particles.length} 語（係り結びの表 ${((G.kakari || {}).rows || []).length} 行）`);
console.log(`  敬語         : ${keigoWords.length} 語（うち 330 語にある ${keigoWords.filter((w) => w.wordId != null).length} 語）`);
console.log(`  活用         : ${conjGroups.reduce((n, g) => n + (g.rows || []).length, 0)} 種（${conjGroups.length} 群）`);
console.log(`  識別         : ${idents.length} 項目（ケース計 ${idents.reduce((n, e) => n + (e.cases || []).length, 0)}）`);
console.log(`  コーパス     : 品詞分解 ${tokenFiles.length} 編`);
console.log('');

console.log('--- コーパスに出ている助動詞の用法ラベル（m の「（　）」の中身） ---');
const auxKeys = Array.from(auxLabels.keys()).sort();
for (const b of auxKeys) {
  const m = auxLabels.get(b);
  const total = Array.from(m.values()).reduce((x, y) => x + y, 0);
  const labels = Array.from(m.entries()).sort((x, y) => y[1] - x[1])
    .map(([l, n]) => `${l}(${n})`).join('・');
  console.log(`  ${b}${' '.repeat(Math.max(0, 6 - b.length))} ${String(total).padStart(3)} 件　${labels}`);
}
console.log('');

if (VERBOSE) {
  console.log('--- 助詞・助動詞の全組み合わせ（品詞／基本形／用法） ---');
  for (const st of stats) console.log(`  ${String(st.count).padStart(3)}  ${st.p}\t${st.b}\t${st.m}`);
  console.log('');
}

console.log('--- 取りこぼし（コーパスにあるのに grammar.js のどの match にも当たらない組） ---');
if (!missed.length && !keigoMissed.length) {
  console.log('  なし（助動詞・助詞・敬語のトークンはすべて文法エントリに対応しています）');
} else {
  for (const st of missed) {
    console.log(`  ${String(st.count).padStart(3)}  ${st.p}\t${st.b}\t${st.m}`);
    warn('match', `取りこぼし: ${st.p} "${st.b}" ${st.m}（${st.count} 件）に対応する文法エントリがありません`);
  }
  for (const st of keigoMissed) {
    console.log(`  ${String(st.count).padStart(3)}  ${st.p}（敬語）\t${st.b}\t${st.m}`);
    warn('match', `取りこぼし（敬語）: "${st.b}" ${st.m}（${st.count} 件）に対応する敬語エントリがありません`);
  }
  console.log(`  → 助詞・助動詞 ${missedTokens} トークン／敬語 ${keigoMissedTokens} トークン`);
}
console.log('');

console.log('--- 用例が 0 件のエントリ（データの誤りではなく、教材にまだ例が無いだけのこともある） ---');
if (!noHit.length) {
  console.log('  なし');
} else {
  for (const s of noHit) {
    console.log(`  ${s}`);
    warn('examples', `${s} の match はコーパスに 1 件もヒットしません`);
  }
}
if (caseNoHit.length) {
  console.log('  【識別のケース】');
  for (const s of caseNoHit) {
    console.log(`  ${s}`);
    warn('examples', `識別 ${s} の match はコーパスに 1 件もヒットしません`);
  }
}
console.log('');

for (const w of warnings) console.log(w);
if (warnings.length) console.log('');
for (const e of errors) console.log(e);

if (errors.length === 0) {
  console.log(`OK: エラー 0 件（警告 ${warnings.length} 件）`);
} else {
  console.log(`NG: エラー ${errors.length} 件 / 警告 ${warnings.length} 件`);
}

process.exit(errors.length === 0 ? 0 : 1);
