/* =====================================================================
 * tools/sync-tokens.mjs — data/tokens/*.js の読み込み設定を作り直す
 * ---------------------------------------------------------------------
 * 使い方:  node tools/sync-tokens.mjs
 *          （D:\kobun_app で実行。node 18 以上。引数なし）
 *
 * なぜ要るか:
 *   品詞分解は「1 文章 = 1 ファイル」で少しずつ足していく。足すたびに
 *     ・index.html の <script> を 1 行
 *     ・sw.js の PRECACHE を 1 行
 *   手で書き足すことになるが、**存在しないファイルを書くと 404 になり**、
 *   逆に**書き忘れるとその文章だけ品詞分解が出ない**。どちらも気づきにくい。
 *   このスクリプトは data/tokens/ の実際の中身から両方を作り直すので、
 *   ファイルを足したら（あるいは消したら）これを 1 回走らせるだけでよい。
 *
 * 何をするか:
 *   index.html の「tokens:begin」〜「tokens:end」の HTML コメントのあいだと、
 *   sw.js の同じ名前のブロックコメントのあいだを、実ファイルの一覧で差し替える。
 *   ?v=... は index.html にすでにある版をそのまま使う
 *   （版を上げたいときは、このあと node tools/bump-version.mjs を走らせる）。
 * ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(ROOT, 'index.html');
const swPath = path.join(ROOT, 'sw.js');
const tokensDir = path.join(ROOT, 'data', 'tokens');

const files = fs.existsSync(tokensDir)
  ? fs.readdirSync(tokensDir).filter((f) => f.endsWith('.js')).sort()
  : [];

/** begin/end のあいだを body に差し替える。見つからなければ null */
function replaceBlock(src, beginMark, endMark, body) {
  const b = src.indexOf(beginMark);
  const e = src.indexOf(endMark);
  if (b < 0 || e < 0 || e < b) return null;
  return src.slice(0, b + beginMark.length) + '\n' + body + src.slice(e);
}

/* --- index.html ------------------------------------------------------ */
let html = fs.readFileSync(indexPath, 'utf8');
const version = (html.match(/\?v=([^"'\s]+)/) || [])[1] || '1';
const scriptLines = files
  .map((f) => `<script src="data/tokens/${f}?v=${version}"></script>`)
  .join('\n');
const newHtml = replaceBlock(html, '<!-- tokens:begin -->', '<!-- tokens:end -->',
  scriptLines + (scriptLines ? '\n' : ''));
if (newHtml === null) {
  console.error('index.html に <!-- tokens:begin --> / <!-- tokens:end --> が見つかりません。');
  process.exit(1);
}
if (newHtml !== html) {
  fs.writeFileSync(indexPath, newHtml, 'utf8');
  console.log(`index.html の品詞分解 <script> を ${files.length} 件に更新しました。`);
} else {
  console.log('index.html はすでに最新です。');
}

/* --- sw.js ----------------------------------------------------------- */
let sw = fs.readFileSync(swPath, 'utf8');
const precacheLines = files.map((f) => `  './data/tokens/${f}',`).join('\n');
const newSw = replaceBlock(sw, '/* tokens:begin */', '  /* tokens:end */',
  precacheLines + (precacheLines ? '\n' : ''));
if (newSw === null) {
  console.error('sw.js に /* tokens:begin */ / /* tokens:end */ が見つかりません。');
  process.exit(1);
}
if (newSw !== sw) {
  fs.writeFileSync(swPath, newSw, 'utf8');
  console.log(`sw.js の PRECACHE を ${files.length} 件に更新しました。`);
} else {
  console.log('sw.js はすでに最新です。');
}

if (files.length === 0) {
  console.log('（data/tokens/ が空です）');
} else {
  console.log('読み込む品詞分解: ' + files.map((f) => path.basename(f, '.js')).join(', '));
}
console.log('版を上げるなら、このあと node tools/bump-version.mjs を実行してください。');
