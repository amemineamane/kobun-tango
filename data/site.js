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
 *   ・analytics は **空文字なら無効**。両方空なら計測スクリプトを一切
 *     読み込まない（外部通信ゼロ）。入れ方は README「アナリティクスの設定」。
 * ===================================================================== */
window.KOBUN = window.KOBUN || {};
window.KOBUN.site = {
  name: '古文単語帳',
  url: 'https://amemineamane.github.io/kobun-tango/',
  description: '入試向けの古文単語 330 語と教科書の定番教材で学ぶ単語帳',
  hashtags: ['古文単語帳'],           // 共有時のハッシュタグ（# なし）
  author: {
    name: '雨峰あまね',
    role: 'ほんのり古典系 VTuber',   // 制作者カードの肩書き（空なら非表示）
    tagline: '古文単語のショートや作品解説の動画＆配信もやっています！',   // 制作者カードの一言（空なら非表示）
    x: 'https://x.com/AmemineAmane',
    youtube: 'https://www.youtube.com/@AmemineAmane',
    booth: 'https://amemineamane.booth.pm/',
    // トップページ末尾の動画カード用。youtubeShorts が空のときの
    // フォールバック（youtubePlaylist が空なら「UU」+ youtubeChannelId の
    // "UC" 以降＝アップロード動画の再生リストを使う）。
    youtubeChannelId: 'UCtAwhpfbWqRkYzyfw7X2uEg',
    youtubePlaylist: 'PLYVYtIKxovfo',   // 「古典解説配信」（9 本）
    // ホーム最下部のグリッドに出す「古典ショート」の再生リスト。
    // 一覧の実体（youtubeShorts）は件数が多く長くなるため data/shorts.js に分けてあり、
    // このファイルの直後に読み込んで author.youtubeShorts を後から埋める。
    // 更新するときは `node tools/fetch-shorts.mjs` を実行する（README 参照）。
    youtubeShortsPlaylist: 'PLFtbG_8r1xCwtagaclMGfnyHMHUjOxpsK',   // 「古典ショートまとめ」
    youtubeShorts: [],   // data/shorts.js が読み込まれるまでの既定値（空なら再生リスト埋め込みにフォールバック）
    // 制作者カード・使い方ページの丸アイコン。立ち絵のバストアップ切り抜き（透過 PNG）。
    // <picture> で同名 .webp を先に試し、失敗したらこの拡張子（png）のまま使う。
    avatar: 'assets/author-icon.png',
    // 立ち絵のイラストレーター。空文字にするとクレジット行を出さない。
    illustrator: { name: '冥甘', x: 'https://x.com/nekopenshiru' }
  },

  /* アクセス解析（js/analytics.js が読む）。
     空文字なら、そのサービスは読み込まない。両方空なら外部通信ゼロ。
     ・ga4        … Google アナリティクス 4 の測定 ID（'G-XXXXXXXXXX'）
     ・cloudflare … Cloudflare Web Analytics のサイトトークン（32 桁の英数字）
     localhost で開いたときは送信せず、console.debug に内容を出すだけ。 */
  analytics: {
    ga4: 'G-3ZBSTP6LZB',
    cloudflare: ''
  }
};
