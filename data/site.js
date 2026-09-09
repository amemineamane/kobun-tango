/* =====================================================================
 * data/site.js — サイト情報と制作者情報（設定を 1 か所にまとめる）
 * ---------------------------------------------------------------------
 * SNS 共有の文面・共有 URL・制作者リンク・OGP に使う値をここだけで持つ。
 * 画面側（js/components.js の C.shareButtons / C.authorLine）は
 * この KOBUN.site しか読まないので、名前や URL を変えるときはここ 1 か所でよい。
 *
 * 【他の data/*.js との違い】
 *   words.js などと同じく「window.KOBUN に代入するだけの .js」だが、
 *   中身は単語データではなくアプリの設定。data/*.js の **先頭** で読み込む
 *   （index.html の <script> 順。js/*.js より前ならどこでもよい）。
 *
 * 【書き換えるときの注意】
 *   ・url は必ず末尾 "/" つきの絶対 URL（共有 URL を `url + '#/word/39'`
 *     の形で組み立てるため）。
 *   ・author の各 URL は、空文字にするか "PLACEHOLDER" を含む文字列にすると
 *     画面にリンクが出ない（未設定のまま公開しても壊れないようにしてある）。
 *   ・hashtags は「#」を付けずに書く（X の intent が # を付けるため）。
 * ===================================================================== */
window.KOBUN = window.KOBUN || {};
window.KOBUN.site = {
  name: '古文単語帳',
  url: 'https://amemineamane.github.io/kobun-tango/',
  description: '入試向けの古文単語 330 語と教科書の定番教材で学ぶ単語帳',
  hashtags: ['古文単語帳'],           // 共有時のハッシュタグ（# なし）
  author: {
    name: '雨峰あまね',
    x: 'https://x.com/AmemineAmane',
    youtube: 'https://www.youtube.com/@AmemineAmane',
    booth: 'https://amemineamane.booth.pm/'
  }
};
