/* =====================================================================
 * data/examples.js — 例文と品詞分解
 * ---------------------------------------------------------------------
 * 【役割】
 *   古典の原文を「トークン（語）の列」として持つ。ここが本アプリの心臓部で、
 *     ・作品ページの例文一覧
 *     ・単語詳細ページの「この語が出てくる例文」
 *     ・原文タップ → 品詞分解ポップアップ
 *   がすべてこの 1 ファイルから生成される。
 *
 * 【フィールド】
 *   id           例文の安定ID（文字列）。"makura-1" のように 作品id-連番 で付ける。
 *   workId       data/works.js の id
 *   section      段・巻・章など出典の位置（「第一段」「序段」「巻第一」）
 *   text         原文。**tokens の surface を順に連結したものと完全に一致させること**
 *                （tools/validate.mjs がこの一致をチェックする）
 *   reading      読みがな（任意）。ふりがな表示や読み上げの拡張用
 *   translation  現代語訳
 *   note         例文全体への注記（任意）
 *   tokens       品詞分解。配列の 1 要素が 1 語。
 *
 * 【tokens の 1 要素】
 *   surface   原文にあらわれた形（活用した形そのまま）
 *   base      辞書形（終止形）。助詞や記号は surface と同じでよい
 *   pos       品詞。名詞/動詞/形容詞/形容動詞/副詞/連体詞/接続詞/感動詞/
 *             代名詞/助動詞/格助詞/係助詞/接続助詞/副助詞/終助詞/間投助詞/
 *             接頭語/接尾語/記号 など
 *   detail    活用の種類・活用形など（「ハ行四段・連用形」「シク活用・已然形」）
 *   meaning   その文脈での意味
 *   wordId    辞書330語にある語なら data/words.js の id。無ければ省略（null）
 *   note      注記（任意）。**自信のない箇所は「要確認」と書く**
 *
 * 【例文を足すには】
 *   1. works.js に作品があることを確認（無ければ先に足す）。
 *   2. この配列に 1 件足す。id は "作品id-連番"。
 *   3. text を書き、それを語に割って tokens を作る。
 *      surface を順に連結して text と一字一句同じになるように。
 *      句読点も 1 トークン（pos: "記号"）として入れる。
 *   4. 辞書にある語には wordId を付ける。付けた語の詳細ページに
 *      この例文が自動で出るようになる（コード側の変更は不要）。
 *   5. tools/validate.mjs を実行してエラー 0 を確認。
 *
 * 【なぜこの形か】
 *   例文を「文字列＋訳」だけで持つと、単語と例文を結びつけるのに
 *   毎回文字列検索が必要になり、活用形や同音異義語で必ず破綻する。
 *   トークン単位で wordId を持たせておけば、リンクは id で確定し、
 *   あとから「活用練習」「品詞当てクイズ」「音声」なども同じ構造の上に
 *   足せる。拡張の起点として最も重要なファイル。
 *
 * ※ 以下は **一次校閲済（docs/verification.md 参照）**。原文は一般的な教科書本文に拠ったが、
 *   底本によって異同がある。品詞分解と語義は標準的な学校文法に沿って付けたが、
 *   解釈の分かれる箇所には token.note に「要確認」と明記した。
 * ===================================================================== */
window.KOBUN = window.KOBUN || {};
window.KOBUN.examples = [
  /* ================================================================= */
  {
    id: 'makura-1',
    workId: 'makura',
    section: '第一段（春はあけぼの）',
    text: '春はあけぼの。やうやう白くなりゆく山ぎは、少しあかりて、紫だちたる雲の細くたなびきたる。',
    reading:
      'はるはあけぼの。やうやうしろくなりゆくやまぎは、すこしあかりて、むらさきだちたるくものほそくたなびきたる。',
    translation:
      '春は夜明け方（がよい）。だんだん白くなっていく、山の空に接するあたりが少し明るくなって、紫がかった雲が細くたなびいている（のがよい）。',
    note: '「〜がよい」「〜が趣深い」にあたる述語は省略されている（体言止め・連体止め）。',
    tokens: [
      { surface: '春', base: '春', pos: '名詞', detail: '', meaning: '春' },
      { surface: 'は', base: 'は', pos: '係助詞', detail: '主題', meaning: '〜は' },
      { surface: 'あけぼの', base: 'あけぼの', pos: '名詞', detail: '', meaning: '夜がほのぼのと明けるころ。夜明け方', note: '「あかつき」より後、「つとめて」より前の時間帯。' },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' },
      { surface: 'やうやう', base: 'やうやう', pos: '副詞', detail: '', meaning: 'だんだん・しだいに', wordId: 110 },
      { surface: '白く', base: '白し', pos: '形容詞', detail: 'ク活用・連用形', meaning: '白い' },
      { surface: 'なりゆく', base: 'なりゆく', pos: '動詞', detail: 'カ行四段・連体形', meaning: '〜になっていく' },
      { surface: '山ぎは', base: '山ぎは', pos: '名詞', detail: '', meaning: '空の、山に接するあたり', note: '「山の端（は）」は山側の輪郭を指し、「山ぎは」は空側を指すのが通説。要確認：両者を区別しない注釈もある。' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '少し', base: '少し', pos: '副詞', detail: '', meaning: '少し' },
      { surface: 'あかり', base: 'あかる', pos: '動詞', detail: 'ラ行四段・連用形', meaning: '明るくなる' },
      { surface: 'て', base: 'て', pos: '接続助詞', detail: '単純接続', meaning: '〜て' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '紫だち', base: '紫だつ', pos: '動詞', detail: 'タ行四段・連用形', meaning: '紫がかる' },
      { surface: 'たる', base: 'たり', pos: '助動詞', detail: '存続・連体形', meaning: '〜ている' },
      { surface: '雲', base: '雲', pos: '名詞', detail: '', meaning: '雲' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '主格', meaning: '〜が' },
      { surface: '細く', base: '細し', pos: '形容詞', detail: 'ク活用・連用形', meaning: '細い' },
      { surface: 'たなびき', base: 'たなびく', pos: '動詞', detail: 'カ行四段・連用形', meaning: '横に長く引く' },
      { surface: 'たる', base: 'たり', pos: '助動詞', detail: '存続・連体形', meaning: '〜ている（のがよい）', note: '連体形で言い切る余情表現。' },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' }
    ]
  },

  /* ================================================================= */
  {
    id: 'makura-2',
    workId: 'makura',
    section: '第一段（夏は夜）',
    text:
      '夏は夜。月のころはさらなり、闇もなほ、蛍の多く飛びちがひたる。また、ただ一つ二つなど、ほのかにうち光りて行くもをかし。雨など降るもをかし。',
    reading:
      'なつはよる。つきのころはさらなり、やみもなほ、ほたるのおほくとびちがひたる。また、ただひとつふたつなど、ほのかにうちひかりてゆくもをかし。あめなどふるもをかし。',
    translation:
      '夏は夜（がよい）。月の出ているころは言うまでもない、闇夜もやはり、蛍がたくさん飛びかっている（のがよい）。また、ほんの一匹二匹などが、かすかに光って飛んでいくのも趣がある。雨などが降るのも趣がある。',
    tokens: [
      { surface: '夏', base: '夏', pos: '名詞', detail: '', meaning: '夏' },
      { surface: 'は', base: 'は', pos: '係助詞', detail: '主題', meaning: '〜は' },
      { surface: '夜', base: '夜', pos: '名詞', detail: '', meaning: '夜' },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' },
      { surface: '月', base: '月', pos: '名詞', detail: '', meaning: '月' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '連体修飾', meaning: '〜の' },
      { surface: 'ころ', base: 'ころ', pos: '名詞', detail: '', meaning: '時分・ころ' },
      { surface: 'は', base: 'は', pos: '係助詞', detail: '主題', meaning: '〜は' },
      { surface: 'さらなり', base: 'さらなり', pos: '形容動詞', detail: 'ナリ活用・終止形', meaning: '言うまでもない・もちろんだ', wordId: 44 },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '闇', base: '闇', pos: '名詞', detail: '', meaning: '月のない闇夜' },
      { surface: 'も', base: 'も', pos: '係助詞', detail: '添加', meaning: '〜もまた' },
      { surface: 'なほ', base: 'なほ', pos: '副詞', detail: '', meaning: 'やはり・それでも', wordId: 109 },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '蛍', base: '蛍', pos: '名詞', detail: '', meaning: '蛍' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '主格', meaning: '〜が' },
      { surface: '多く', base: '多し', pos: '形容詞', detail: 'ク活用・連用形', meaning: 'たくさん' },
      { surface: '飛びちがひ', base: '飛びちがふ', pos: '動詞', detail: 'ハ行四段・連用形', meaning: '飛びかう' },
      { surface: 'たる', base: 'たり', pos: '助動詞', detail: '存続・連体形', meaning: '〜ている（のがよい）' },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' },
      { surface: 'また', base: 'また', pos: '接続詞', detail: '', meaning: 'また' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: 'ただ', base: 'ただ', pos: '副詞', detail: '', meaning: 'ほんの・わずかに' },
      { surface: '一つ', base: '一つ', pos: '名詞', detail: '数詞', meaning: '一匹' },
      { surface: '二つ', base: '二つ', pos: '名詞', detail: '数詞', meaning: '二匹' },
      { surface: 'など', base: 'など', pos: '副助詞', detail: '例示', meaning: '〜など' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: 'ほのかに', base: 'ほのかなり', pos: '形容動詞', detail: 'ナリ活用・連用形', meaning: 'かすかに' },
      { surface: 'うち光り', base: 'うち光る', pos: '動詞', detail: 'ラ行四段・連用形', meaning: 'ちらっと光る', note: '「うち」は語調を整える接頭語。' },
      { surface: 'て', base: 'て', pos: '接続助詞', detail: '単純接続', meaning: '〜て' },
      { surface: '行く', base: '行く', pos: '動詞', detail: 'カ行四段・連体形', meaning: '飛んでいく' },
      { surface: 'も', base: 'も', pos: '係助詞', detail: '添加', meaning: '〜もまた' },
      { surface: 'をかし', base: 'をかし', pos: '形容詞', detail: 'シク活用・終止形', meaning: '趣がある・風情がある', wordId: 39 },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' },
      { surface: '雨', base: '雨', pos: '名詞', detail: '', meaning: '雨' },
      { surface: 'など', base: 'など', pos: '副助詞', detail: '例示', meaning: '〜など' },
      { surface: '降る', base: '降る', pos: '動詞', detail: 'ラ行四段・連体形', meaning: '降る' },
      { surface: 'も', base: 'も', pos: '係助詞', detail: '添加', meaning: '〜もまた' },
      { surface: 'をかし', base: 'をかし', pos: '形容詞', detail: 'シク活用・終止形', meaning: '趣がある', wordId: 39 },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' }
    ]
  },

  /* ================================================================= */
  {
    id: 'makura-3',
    workId: 'makura',
    section: '第一段（秋は夕暮れ）',
    text:
      '秋は夕暮れ。夕日のさして山の端いと近うなりたるに、烏の寝どころへ行くとて、三つ四つ、二つ三つなど飛びいそぐさへあはれなり。まいて雁などのつらねたるが、いと小さく見ゆるは、いとをかし。',
    reading:
      'あきはゆふぐれ。ゆふひのさしてやまのはいとちかうなりたるに、からすのねどころへゆくとて、みつよつ、ふたつみつなどとびいそぐさへあはれなり。まいてかりなどのつらねたるが、いとちひさくみゆるは、いとをかし。',
    translation:
      '秋は夕暮れ（がよい）。夕日がさして山の稜線にたいそう近くなっているときに、烏がねぐらへ帰ろうとして、三羽四羽、二羽三羽などと飛び急ぐのまでもがしみじみと心を打つ。まして雁などが列をつくっているのが、たいそう小さく見えるのは、とても趣がある。',
    tokens: [
      { surface: '秋', base: '秋', pos: '名詞', detail: '', meaning: '秋' },
      { surface: 'は', base: 'は', pos: '係助詞', detail: '主題', meaning: '〜は' },
      { surface: '夕暮れ', base: '夕暮れ', pos: '名詞', detail: '', meaning: '夕暮れ' },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' },
      { surface: '夕日', base: '夕日', pos: '名詞', detail: '', meaning: '夕日' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '主格', meaning: '〜が' },
      { surface: 'さし', base: 'さす', pos: '動詞', detail: 'サ行四段・連用形', meaning: '（光が）さす' },
      { surface: 'て', base: 'て', pos: '接続助詞', detail: '単純接続', meaning: '〜て' },
      { surface: '山', base: '山', pos: '名詞', detail: '', meaning: '山' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '連体修飾', meaning: '〜の' },
      { surface: '端', base: '端', pos: '名詞', detail: '', meaning: '山の稜線の部分' },
      { surface: 'いと', base: 'いと', pos: '副詞', detail: '', meaning: 'たいそう・非常に', wordId: 99 },
      { surface: '近う', base: '近し', pos: '形容詞', detail: 'ク活用・連用形（ウ音便）', meaning: '近い', note: '「近く」→「近う」のウ音便。' },
      { surface: 'なり', base: 'なる', pos: '動詞', detail: 'ラ行四段・連用形', meaning: '〜になる' },
      { surface: 'たる', base: 'たり', pos: '助動詞', detail: '存続・連体形', meaning: '〜ている' },
      { surface: 'に', base: 'に', pos: '格助詞', detail: '時', meaning: '〜ときに', note: '諸説: 連体形＋「に」を接続助詞（単純接続）とみる注釈もある。' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '烏', base: '烏', pos: '名詞', detail: '', meaning: 'からす' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '主格', meaning: '〜が' },
      { surface: '寝どころ', base: '寝どころ', pos: '名詞', detail: '', meaning: 'ねぐら' },
      { surface: 'へ', base: 'へ', pos: '格助詞', detail: '方向', meaning: '〜へ' },
      { surface: '行く', base: '行く', pos: '動詞', detail: 'カ行四段・終止形', meaning: '帰っていく' },
      { surface: 'とて', base: 'とて', pos: '格助詞', detail: '引用＋目的', meaning: '〜というので' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '三つ', base: '三つ', pos: '名詞', detail: '数詞', meaning: '三羽' },
      { surface: '四つ', base: '四つ', pos: '名詞', detail: '数詞', meaning: '四羽' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '二つ', base: '二つ', pos: '名詞', detail: '数詞', meaning: '二羽' },
      { surface: '三つ', base: '三つ', pos: '名詞', detail: '数詞', meaning: '三羽' },
      { surface: 'など', base: 'など', pos: '副助詞', detail: '例示', meaning: '〜など' },
      { surface: '飛びいそぐ', base: '飛びいそぐ', pos: '動詞', detail: 'ガ行四段・連体形', meaning: '飛び急ぐ' },
      { surface: 'さへ', base: 'さへ', pos: '副助詞', detail: '添加', meaning: '〜までも' },
      { surface: 'あはれなり', base: 'あはれなり', pos: '形容動詞', detail: 'ナリ活用・終止形', meaning: 'しみじみと心を打たれる', wordId: 41 },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' },
      { surface: 'まいて', base: 'まいて', pos: '副詞', detail: '', meaning: 'まして・なおさら', wordId: 219, note: '「まして」のイ音便。' },
      { surface: '雁', base: '雁', pos: '名詞', detail: '', meaning: 'かり（渡り鳥）' },
      { surface: 'など', base: 'など', pos: '副助詞', detail: '例示', meaning: '〜など' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '主格', meaning: '〜が' },
      { surface: 'つらね', base: 'つらぬ', pos: '動詞', detail: 'ナ行下二段・連用形', meaning: '列をつくる' },
      { surface: 'たる', base: 'たり', pos: '助動詞', detail: '存続・連体形', meaning: '〜ている' },
      { surface: 'が', base: 'が', pos: '格助詞', detail: '主格', meaning: '〜のが' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: 'いと', base: 'いと', pos: '副詞', detail: '', meaning: 'たいそう', wordId: 99 },
      { surface: '小さく', base: '小さし', pos: '形容詞', detail: 'ク活用・連用形', meaning: '小さい' },
      { surface: '見ゆる', base: 'みゆ', pos: '動詞', detail: 'ヤ行下二段・連体形', meaning: '見える', wordId: 58 },
      { surface: 'は', base: 'は', pos: '係助詞', detail: '主題', meaning: '〜は' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: 'いと', base: 'いと', pos: '副詞', detail: '', meaning: 'たいそう', wordId: 99 },
      { surface: 'をかし', base: 'をかし', pos: '形容詞', detail: 'シク活用・終止形', meaning: '趣がある', wordId: 39 },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' }
    ]
  },

  /* ================================================================= */
  {
    id: 'makura-4',
    workId: 'makura',
    section: '第一段（冬はつとめて）',
    text:
      '冬はつとめて。雪の降りたるはいふべきにもあらず、霜のいと白きも、またさらでもいと寒きに、火など急ぎおこして、炭もて渡るも、いとつきづきし。',
    reading:
      'ふゆはつとめて。ゆきのふりたるはいふべきにもあらず、しものいとしろきも、またさらでもいとさむきに、ひなどいそぎおこして、すみもてわたるも、いとつきづきし。',
    translation:
      '冬は早朝（がよい）。雪の降っている朝は言うまでもない、霜がたいそう白いのも、またそうでなくてもたいそう寒い朝に、火などを急いでおこして、炭を持って廊下を渡っていくのも、たいそう（冬の朝に）似つかわしい。',
    tokens: [
      { surface: '冬', base: '冬', pos: '名詞', detail: '', meaning: '冬' },
      { surface: 'は', base: 'は', pos: '係助詞', detail: '主題', meaning: '〜は' },
      { surface: 'つとめて', base: 'つとめて', pos: '名詞', detail: '', meaning: '早朝', wordId: 90 },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' },
      { surface: '雪', base: '雪', pos: '名詞', detail: '', meaning: '雪' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '主格', meaning: '〜が' },
      { surface: '降り', base: '降る', pos: '動詞', detail: 'ラ行四段・連用形', meaning: '降る' },
      { surface: 'たる', base: 'たり', pos: '助動詞', detail: '存続・連体形', meaning: '〜ている' },
      { surface: 'は', base: 'は', pos: '係助詞', detail: '主題', meaning: '〜は' },
      { surface: 'いふ', base: 'いふ', pos: '動詞', detail: 'ハ行四段・終止形', meaning: '言う' },
      { surface: 'べき', base: 'べし', pos: '助動詞', detail: '当然・連体形', meaning: '〜べきだ' },
      { surface: 'に', base: 'なり', pos: '助動詞', detail: '断定・連用形', meaning: '〜で' },
      { surface: 'も', base: 'も', pos: '係助詞', detail: '強調', meaning: '〜も' },
      { surface: 'あら', base: 'あり', pos: '動詞', detail: 'ラ行変格・未然形', meaning: 'ある' },
      { surface: 'ず', base: 'ず', pos: '助動詞', detail: '打消・連用形', meaning: '〜ない', note: '「言ふべきにもあらず」で「言うまでもない」の慣用表現。' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '霜', base: '霜', pos: '名詞', detail: '', meaning: '霜' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '主格', meaning: '〜が' },
      { surface: 'いと', base: 'いと', pos: '副詞', detail: '', meaning: 'たいそう', wordId: 99 },
      { surface: '白き', base: '白し', pos: '形容詞', detail: 'ク活用・連体形', meaning: '白い' },
      { surface: 'も', base: 'も', pos: '係助詞', detail: '添加', meaning: '〜も' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: 'また', base: 'また', pos: '接続詞', detail: '', meaning: 'また' },
      { surface: 'さら', base: 'さり', pos: '動詞', detail: 'ラ行変格・未然形', meaning: 'そうである', note: '「然（さ）り」。指示副詞「さ」＋「あり」。' },
      { surface: 'で', base: 'で', pos: '接続助詞', detail: '打消接続', meaning: '〜ないで' },
      { surface: 'も', base: 'も', pos: '係助詞', detail: '添加', meaning: '〜も' },
      { surface: 'いと', base: 'いと', pos: '副詞', detail: '', meaning: 'たいそう', wordId: 99 },
      { surface: '寒き', base: '寒し', pos: '形容詞', detail: 'ク活用・連体形', meaning: '寒い' },
      { surface: 'に', base: 'に', pos: '格助詞', detail: '時', meaning: '〜ときに', note: '諸説: 連体形＋「に」を接続助詞（単純接続）とみる注釈もある。' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '火', base: '火', pos: '名詞', detail: '', meaning: '炭火' },
      { surface: 'など', base: 'など', pos: '副助詞', detail: '例示', meaning: '〜など' },
      { surface: '急ぎ', base: 'いそぐ', pos: '動詞', detail: 'ガ行四段・連用形', meaning: '急いで', wordId: 154, note: '要確認：辞書見出しの「いそぐ」は「準備する・支度する」が第一義。ここは「急いで」の意で取るのが一般的だが、「（火を）用意して」と解する注釈もある。' },
      { surface: 'おこし', base: 'おこす', pos: '動詞', detail: 'サ行四段・連用形', meaning: '（火を）おこす', note: '重要語「おこす（＝よこす・送ってくる）」とは別語。混同注意。' },
      { surface: 'て', base: 'て', pos: '接続助詞', detail: '単純接続', meaning: '〜て' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '炭', base: '炭', pos: '名詞', detail: '', meaning: '炭' },
      { surface: 'もて渡る', base: 'もて渡る', pos: '動詞', detail: 'ラ行四段・連体形', meaning: '持って渡っていく', note: '要確認：「もて」を接頭語とみて一語「もて渡る」とする説と、「持ちて＋渡る」の音変化とみて分ける説がある。ここでは一語とした。' },
      { surface: 'も', base: 'も', pos: '係助詞', detail: '添加', meaning: '〜も' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: 'いと', base: 'いと', pos: '副詞', detail: '', meaning: 'たいそう', wordId: 99 },
      { surface: 'つきづきし', base: 'つきづきし', pos: '形容詞', detail: 'シク活用・終止形', meaning: '似つかわしい・ふさわしい', wordId: 20 },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' }
    ]
  },

  /* ================================================================= */
  {
    id: 'tsurezure-1',
    workId: 'tsurezure',
    section: '序段',
    text:
      'つれづれなるままに、日暮らし、硯にむかひて、心にうつりゆくよしなし事を、そこはかとなく書きつくれば、あやしうこそものぐるほしけれ。',
    reading:
      'つれづれなるままに、ひぐらし、すずりにむかひて、こころにうつりゆくよしなしごとを、そこはかとなくかきつくれば、あやしうこそものぐるほしけれ。',
    translation:
      'することもなく手持ちぶさたなのにまかせて、一日中、硯に向かって、心に浮かんでは消えていくとりとめもないことを、あてもなく書きつけていると、妙に正気を失ったような気持ちになる。',
    note: '「こそ〜けれ」の係り結び。文末が已然形になっている典型例。',
    tokens: [
      { surface: 'つれづれなる', base: 'つれづれなり', pos: '形容動詞', detail: 'ナリ活用・連体形', meaning: 'することがなく退屈だ', wordId: 45 },
      { surface: 'まま', base: 'まま', pos: '名詞', detail: '', meaning: '〜のまま・〜にまかせて' },
      { surface: 'に', base: 'に', pos: '格助詞', detail: '', meaning: '〜に' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '日暮らし', base: '日暮らし', pos: '副詞', detail: '', meaning: '一日中・朝から日暮れまで' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '硯', base: '硯', pos: '名詞', detail: '', meaning: 'すずり' },
      { surface: 'に', base: 'に', pos: '格助詞', detail: '対象', meaning: '〜に' },
      { surface: 'むかひ', base: 'むかふ', pos: '動詞', detail: 'ハ行四段・連用形', meaning: '向かう' },
      { surface: 'て', base: 'て', pos: '接続助詞', detail: '単純接続', meaning: '〜て' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '心', base: '心', pos: '名詞', detail: '', meaning: '心' },
      { surface: 'に', base: 'に', pos: '格助詞', detail: '場所', meaning: '〜に' },
      { surface: 'うつりゆく', base: 'うつりゆく', pos: '動詞', detail: 'カ行四段・連体形', meaning: '次々と移り変わっていく' },
      { surface: 'よしなし事', base: 'よしなし事', pos: '名詞', detail: '複合名詞', meaning: 'とりとめもないこと', wordId: 139, note: '形容詞「よしなし（＝理由がない・つまらない）」＋「事」の複合名詞。辞書見出しは「よしなし」。' },
      { surface: 'を', base: 'を', pos: '格助詞', detail: '対象', meaning: '〜を' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: 'そこはかとなく', base: 'そこはかとなし', pos: '形容詞', detail: 'ク活用・連用形', meaning: 'とりとめもなく・あてもなく' },
      { surface: '書きつくれ', base: '書きつく', pos: '動詞', detail: 'カ行下二段・已然形', meaning: '書きつける' },
      { surface: 'ば', base: 'ば', pos: '接続助詞', detail: '順接確定条件', meaning: '〜すると' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: 'あやしう', base: 'あやし', pos: '形容詞', detail: 'シク活用・連用形（ウ音便）', meaning: '異常なほど・妙に', wordId: 4, note: '「あやしく」のウ音便。ここは「身分が低い」の意ではなく「不思議だ・異様だ」の系統。' },
      { surface: 'こそ', base: 'こそ', pos: '係助詞', detail: '強意（係り結び。結びは已然形）', meaning: '〜こそ' },
      { surface: 'ものぐるほしけれ', base: 'ものぐるほし', pos: '形容詞', detail: 'シク活用・已然形（「こそ」の結び）', meaning: '気が変になりそうだ', wordId: 250 },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' }
    ]
  },

  /* ================================================================= */
  {
    id: 'taketori-1',
    workId: 'taketori',
    section: '冒頭（かぐや姫の生ひ立ち）',
    text: '今は昔、竹取の翁といふものありけり。野山にまじりて竹を取りつつ、よろづのことに使ひけり。',
    reading: 'いまはむかし、たけとりのおきなといふものありけり。のやまにまじりてたけをとりつつ、よろづのことにつかひけり。',
    translation:
      '今となっては昔のことだが、竹取の翁と呼ばれる者がいた。野や山に分け入って竹を取っては、いろいろなことに使っていた。',
    tokens: [
      { surface: '今', base: '今', pos: '名詞', detail: '', meaning: '今' },
      { surface: 'は', base: 'は', pos: '係助詞', detail: '主題', meaning: '〜は' },
      { surface: '昔', base: '昔', pos: '名詞', detail: '', meaning: '昔' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '竹取', base: '竹取', pos: '名詞', detail: '', meaning: '竹を取ること・竹取り' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '連体修飾', meaning: '〜の' },
      { surface: '翁', base: '翁', pos: '名詞', detail: '', meaning: '老人・じいさん' },
      { surface: 'と', base: 'と', pos: '格助詞', detail: '引用', meaning: '〜と' },
      { surface: 'いふ', base: 'いふ', pos: '動詞', detail: 'ハ行四段・連体形', meaning: '言う・呼ぶ' },
      { surface: 'もの', base: 'もの', pos: '名詞', detail: '', meaning: '者' },
      { surface: 'あり', base: 'あり', pos: '動詞', detail: 'ラ行変格・連用形', meaning: 'いた' },
      { surface: 'けり', base: 'けり', pos: '助動詞', detail: '過去（伝聞）・終止形', meaning: '〜たそうだ', note: '人から聞いた過去を語る「けり」。物語の語り出しの型。' },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' },
      { surface: '野山', base: '野山', pos: '名詞', detail: '', meaning: '野や山' },
      { surface: 'に', base: 'に', pos: '格助詞', detail: '場所', meaning: '〜に' },
      { surface: 'まじり', base: 'まじる', pos: '動詞', detail: 'ラ行四段・連用形', meaning: '分け入る' },
      { surface: 'て', base: 'て', pos: '接続助詞', detail: '単純接続', meaning: '〜て' },
      { surface: '竹', base: '竹', pos: '名詞', detail: '', meaning: '竹' },
      { surface: 'を', base: 'を', pos: '格助詞', detail: '対象', meaning: '〜を' },
      { surface: '取り', base: '取る', pos: '動詞', detail: 'ラ行四段・連用形', meaning: '取る' },
      { surface: 'つつ', base: 'つつ', pos: '接続助詞', detail: '反復・継続', meaning: '〜しては' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: 'よろづ', base: 'よろづ', pos: '名詞', detail: '', meaning: 'いろいろ・万事' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '連体修飾', meaning: '〜の' },
      { surface: 'こと', base: 'こと', pos: '名詞', detail: '', meaning: 'こと' },
      { surface: 'に', base: 'に', pos: '格助詞', detail: '対象', meaning: '〜に' },
      { surface: '使ひ', base: '使ふ', pos: '動詞', detail: 'ハ行四段・連用形', meaning: '使う' },
      { surface: 'けり', base: 'けり', pos: '助動詞', detail: '過去・終止形', meaning: '〜ていた' },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' }
    ]
  },

  /* ================================================================= */
  {
    id: 'taketori-2',
    workId: 'taketori',
    section: '冒頭（かぐや姫の発見）',
    text: 'それを見れば、三寸ばかりなる人、いとうつくしうてゐたり。',
    reading: 'それをみれば、さんずんばかりなるひと、いとうつくしうてゐたり。',
    translation: 'それを見ると、三寸ほどの（背丈の）人が、たいそうかわいらしい様子で座っていた。',
    tokens: [
      { surface: 'それ', base: 'それ', pos: '代名詞', detail: '', meaning: 'それ（光る竹の筒の中）' },
      { surface: 'を', base: 'を', pos: '格助詞', detail: '対象', meaning: '〜を' },
      { surface: '見れ', base: '見る', pos: '動詞', detail: 'マ行上一段・已然形', meaning: '見る' },
      { surface: 'ば', base: 'ば', pos: '接続助詞', detail: '順接確定条件', meaning: '〜すると' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '三寸', base: '三寸', pos: '名詞', detail: '数詞', meaning: '約9センチ' },
      { surface: 'ばかり', base: 'ばかり', pos: '副助詞', detail: '程度', meaning: '〜ほど' },
      { surface: 'なる', base: 'なり', pos: '助動詞', detail: '断定・連体形', meaning: '〜である' },
      { surface: '人', base: '人', pos: '名詞', detail: '', meaning: '人' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: 'いと', base: 'いと', pos: '副詞', detail: '', meaning: 'たいそう', wordId: 99 },
      { surface: 'うつくしう', base: 'うつくし', pos: '形容詞', detail: 'シク活用・連用形（ウ音便）', meaning: 'かわいらしい', wordId: 10, note: '「うつくしく」のウ音便。現代語の「美しい」ではなく、小さいものへの愛情。' },
      { surface: 'て', base: 'て', pos: '接続助詞', detail: '単純接続', meaning: '〜で' },
      { surface: 'ゐ', base: 'ゐる', pos: '動詞', detail: 'ワ行上一段・連用形', meaning: '座る', wordId: 61, note: '〔居る〕の方。〔率る〕（＝引き連れる）と同音なので文脈で判別する。' },
      { surface: 'たり', base: 'たり', pos: '助動詞', detail: '存続・終止形', meaning: '〜ていた' },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' }
    ]
  },

  /* ================================================================= */
  {
    id: 'ise-1',
    workId: 'ise',
    section: '第一段（初冠）',
    text: 'むかし、男、初冠して、奈良の京春日の里に、しるよしして、狩りにいにけり。',
    reading: 'むかし、をとこ、うひかうぶりして、ならのみやこかすがのさとに、しるよしして、かりにいにけり。',
    translation:
      '昔、ある男が、元服して、奈良の都の春日の里に、領地を持っている縁で、狩りに出かけた。',
    tokens: [
      { surface: 'むかし', base: 'むかし', pos: '名詞', detail: '', meaning: '昔' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '男', base: '男', pos: '名詞', detail: '', meaning: '男（在原業平を思わせる主人公）' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '初冠', base: '初冠', pos: '名詞', detail: '', meaning: '元服して初めて冠をつけること' },
      { surface: 'し', base: 'す', pos: '動詞', detail: 'サ行変格・連用形', meaning: 'する' },
      { surface: 'て', base: 'て', pos: '接続助詞', detail: '単純接続', meaning: '〜て' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '奈良', base: '奈良', pos: '名詞', detail: '固有名詞', meaning: '奈良' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '連体修飾', meaning: '〜の' },
      { surface: '京', base: '京', pos: '名詞', detail: '', meaning: '都' },
      { surface: '春日', base: '春日', pos: '名詞', detail: '固有名詞', meaning: '春日（奈良の地名）' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '連体修飾', meaning: '〜の' },
      { surface: '里', base: '里', pos: '名詞', detail: '', meaning: '里・村' },
      { surface: 'に', base: 'に', pos: '格助詞', detail: '場所', meaning: '〜に' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: 'しる', base: 'しる', pos: '動詞', detail: 'ラ行四段・連体形', meaning: '領有する・所有する', wordId: 165, note: '現代語の「知る」ではなく「領（し）る」。' },
      { surface: 'よし', base: 'よし', pos: '名詞', detail: '', meaning: '縁故・つて', wordId: 97, note: '辞書見出しの第一義は「理由・わけ」。ここは「縁故・つて」の意で、同じ名詞「よし」の語義の一つ。' },
      { surface: 'し', base: 'す', pos: '動詞', detail: 'サ行変格・連用形', meaning: 'する' },
      { surface: 'て', base: 'て', pos: '接続助詞', detail: '単純接続', meaning: '〜て' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '狩り', base: '狩り', pos: '名詞', detail: '', meaning: '狩り・鷹狩り' },
      { surface: 'に', base: 'に', pos: '格助詞', detail: '目的', meaning: '〜に' },
      { surface: 'いに', base: 'いぬ', pos: '動詞', detail: 'ナ行変格・連用形', meaning: '行く・去る', note: 'ナ変動詞は「いぬ」「しぬ」の二語のみ。' },
      { surface: 'けり', base: 'けり', pos: '助動詞', detail: '過去・終止形', meaning: '〜た' },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' }
    ]
  },

  /* ================================================================= */
  {
    id: 'heike-1',
    workId: 'heike',
    section: '巻第一・祇園精舎',
    text: '祇園精舎の鐘の声、諸行無常の響きあり。沙羅双樹の花の色、盛者必衰のことわりをあらはす。',
    reading:
      'ぎをんしやうじやのかねのこゑ、しよぎやうむじやうのひびきあり。さらさうじゆのはなのいろ、じやうしやひつすいのことわりをあらはす。',
    translation:
      '祇園精舎の鐘の音には、この世のすべては移り変わるという響きがある。沙羅双樹の花の色は、勢い盛んな者も必ず衰えるという道理をあらわしている。',
    tokens: [
      { surface: '祇園精舎', base: '祇園精舎', pos: '名詞', detail: '固有名詞', meaning: '古代インドの寺院。釈迦が説法した地' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '連体修飾', meaning: '〜の' },
      { surface: '鐘', base: '鐘', pos: '名詞', detail: '', meaning: '鐘' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '連体修飾', meaning: '〜の' },
      { surface: '声', base: '声', pos: '名詞', detail: '', meaning: '音' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '諸行無常', base: '諸行無常', pos: '名詞', detail: '', meaning: 'この世のすべては移り変わるということ' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '連体修飾', meaning: '〜の' },
      { surface: '響き', base: '響き', pos: '名詞', detail: '', meaning: '響き' },
      { surface: 'あり', base: 'あり', pos: '動詞', detail: 'ラ行変格・終止形', meaning: 'ある' },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' },
      { surface: '沙羅双樹', base: '沙羅双樹', pos: '名詞', detail: '固有名詞', meaning: '釈迦入滅の地にあったという木' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '連体修飾', meaning: '〜の' },
      { surface: '花', base: '花', pos: '名詞', detail: '', meaning: '花' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '連体修飾', meaning: '〜の' },
      { surface: '色', base: '色', pos: '名詞', detail: '', meaning: '色' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '盛者必衰', base: '盛者必衰', pos: '名詞', detail: '', meaning: '勢い盛んな者も必ず衰えるということ' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '連体修飾', meaning: '〜の' },
      { surface: 'ことわり', base: 'ことわり', pos: '名詞', detail: '', meaning: '道理・筋道', wordId: 87 },
      { surface: 'を', base: 'を', pos: '格助詞', detail: '対象', meaning: '〜を' },
      { surface: 'あらはす', base: 'あらはす', pos: '動詞', detail: 'サ行四段・終止形', meaning: 'あらわす・示す' },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' }
    ]
  },

  /* ================================================================= */
  {
    id: 'hojoki-1',
    workId: 'hojoki',
    section: '冒頭（ゆく河の流れ）',
    text:
      'ゆく河の流れは絶えずして、しかももとの水にあらず。よどみに浮かぶうたかたは、かつ消えかつ結びて、久しくとどまりたるためしなし。',
    reading:
      'ゆくかはのながれはたえずして、しかももとのみづにあらず。よどみにうかぶうたかたは、かつきえかつむすびて、ひさしくとどまりたるためしなし。',
    translation:
      '流れていく川の流れは絶えることがなく、それでいてもとの水ではない。よどみに浮かぶ水の泡は、一方では消え一方ではできて、長くとどまっている例（ためし）はない。',
    tokens: [
      { surface: 'ゆく', base: 'ゆく', pos: '動詞', detail: 'カ行四段・連体形', meaning: '流れていく' },
      { surface: '河', base: '河', pos: '名詞', detail: '', meaning: '川' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '連体修飾', meaning: '〜の' },
      { surface: '流れ', base: '流れ', pos: '名詞', detail: '', meaning: '流れ' },
      { surface: 'は', base: 'は', pos: '係助詞', detail: '主題', meaning: '〜は' },
      { surface: '絶え', base: '絶ゆ', pos: '動詞', detail: 'ヤ行下二段・未然形', meaning: '絶える' },
      { surface: 'ず', base: 'ず', pos: '助動詞', detail: '打消・連用形', meaning: '〜ない' },
      { surface: 'して', base: 'して', pos: '接続助詞', detail: '単純接続', meaning: '〜で' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: 'しかも', base: 'しかも', pos: '接続詞', detail: '', meaning: 'それでいて・そのうえ' },
      { surface: 'もと', base: 'もと', pos: '名詞', detail: '', meaning: 'もと・以前' },
      { surface: 'の', base: 'の', pos: '格助詞', detail: '連体修飾', meaning: '〜の' },
      { surface: '水', base: '水', pos: '名詞', detail: '', meaning: '水' },
      { surface: 'に', base: 'なり', pos: '助動詞', detail: '断定・連用形', meaning: '〜で' },
      { surface: 'あら', base: 'あり', pos: '動詞', detail: 'ラ行変格・未然形', meaning: 'ある' },
      { surface: 'ず', base: 'ず', pos: '助動詞', detail: '打消・終止形', meaning: '〜ない' },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' },
      { surface: 'よどみ', base: 'よどみ', pos: '名詞', detail: '', meaning: '水が流れずにたまっている所' },
      { surface: 'に', base: 'に', pos: '格助詞', detail: '場所', meaning: '〜に' },
      { surface: '浮かぶ', base: '浮かぶ', pos: '動詞', detail: 'バ行四段・連体形', meaning: '浮かぶ' },
      { surface: 'うたかた', base: 'うたかた', pos: '名詞', detail: '', meaning: '水の泡' },
      { surface: 'は', base: 'は', pos: '係助詞', detail: '主題', meaning: '〜は' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: 'かつ', base: 'かつ', pos: '副詞', detail: '', meaning: '一方では' },
      { surface: '消え', base: '消ゆ', pos: '動詞', detail: 'ヤ行下二段・連用形', meaning: '消える' },
      { surface: 'かつ', base: 'かつ', pos: '副詞', detail: '', meaning: '一方では' },
      { surface: '結び', base: '結ぶ', pos: '動詞', detail: 'バ行四段・連用形', meaning: '（泡が）できる' },
      { surface: 'て', base: 'て', pos: '接続助詞', detail: '単純接続', meaning: '〜て' },
      { surface: '、', base: '、', pos: '記号', detail: '読点', meaning: '' },
      { surface: '久しく', base: '久し', pos: '形容詞', detail: 'シク活用・連用形', meaning: '長い間' },
      { surface: 'とどまり', base: 'とどまる', pos: '動詞', detail: 'ラ行四段・連用形', meaning: 'とどまる' },
      { surface: 'たる', base: 'たり', pos: '助動詞', detail: '存続・連体形', meaning: '〜ている' },
      { surface: 'ためし', base: 'ためし', pos: '名詞', detail: '', meaning: '前例・例', wordId: 198 },
      { surface: 'なし', base: 'なし', pos: '形容詞', detail: 'ク活用・終止形', meaning: 'ない' },
      { surface: '。', base: '。', pos: '記号', detail: '句点', meaning: '' }
    ]
  }
];
