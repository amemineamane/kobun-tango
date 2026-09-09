/* =====================================================================
 * tools/bump-version.mjs — index.html のキャッシュバスター更新
 * ---------------------------------------------------------------------
 * 使い方:  node tools/bump-version.mjs
 *          （D:\kobun_app で実行。node 18 以上。引数なし）
 *
 * なぜ要るか:
 *   GitHub Pages は Cache-Control: max-age=600 を返すため、公開直後は
 *   ブラウザ／CDN のキャッシュに「新しい index.html」と「古い js/css」が
 *   混在しうる（例: ルーターだけ新しくて view-*.js が古いままだと
 *   「ページが見つかりません」になる）。
 *   index.html の <link>/<script> に付けた `?v=YYYYMMDDx` を毎回変えれば、
 *   HTML が新しくなったときに参照先 URL 自体が変わるので、
 *   ブラウザは js/css も必ず新しく取りに行く。
 *
 * 何をするか:
 *   index.html 内のすべての `?v=...` を「今日の日付＋連番アルファベット」
 *   （例: 20260909a → 同日 2 回目は 20260909b）に一括で書き換える。
 *   index.html の構造（タグの並び・属性・改行コード）はいっさい変えない。
 *   file:// で直接開く用途にも影響しない（file:// はクエリ文字列を
 *   無視してファイルを解決するので、そのまま動く）。
 * ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(__dirname, '..', 'index.html');

function todayStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/** 'a' -> 'b' ... 'z' -> 'aa' のように繰り上げる（実運用で z を超えることはまず無い） */
function nextLetter(s) {
  const chars = s.split('');
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] === 'z') { chars[i] = 'a'; i--; }
    else { chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1); return chars.join(''); }
  }
  return 'a' + chars.join('');
}

function main() {
  if (!fs.existsSync(indexPath)) {
    console.error('index.html が見つかりません: ' + indexPath);
    process.exit(1);
  }
  const html = fs.readFileSync(indexPath, 'utf8');

  const stamp = todayStamp();
  // 既存の ?v=YYYYMMDDx（日付つきの版）があれば、同じ日付なら連番を進める
  const dated = html.match(/\?v=(\d{8})([a-z]*)/);
  let letter = 'a';
  if (dated && dated[1] === stamp) {
    letter = nextLetter(dated[2] || 'a');
  }
  const version = stamp + letter;

  // ?v=... はプレースホルダ（?v=1 など日付形式でないもの）も含めて全部この値に揃える
  const updated = html.replace(/\?v=[^"'\s]+/g, '?v=' + version);

  if (updated === html) {
    console.log('index.html 内に ?v=... が見つかりませんでした。変更していません。');
    return;
  }

  const marker = '?v=' + version;
  const count = updated.split(marker).length - 1;
  fs.writeFileSync(indexPath, updated, 'utf8');
  console.log('index.html の ?v=... を ' + version + ' に更新しました（' + count + ' 箇所）。');
}

main();
