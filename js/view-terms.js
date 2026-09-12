/* =====================================================================
 * js/view-terms.js — 利用規約・プライバシーポリシー（#/terms）
 * ---------------------------------------------------------------------
 * 使い方ページ（view-help.js）と同じ流儀で書く。
 *   ・本文はすべてこのファイルの中。説明用のデータファイルは作らない。
 *   ・ただし **アプリ名・公開 URL・制作者名・外部リンク・アクセス解析の有無** は
 *     data/site.js（KOBUN.site）から動的に埋める。ハードコードしない。
 *     名義や問い合わせ先を変えるときに触るのは data/site.js だけで済む。
 *
 * #/terms?to=privacy のように ?to= を付けると、その節までスクロールする
 * （ハッシュルーティングなので #anchor が使えない。help と同じ自前実装）。
 * 節の id は 'terms-<to>'（terms / privacy）。
 *
 * 【アクセス解析の記述は実装と一致させること】
 *   「送る情報」の箇条書きは js/analytics.js が実際に送るイベント
 *   （page_view / quiz_complete / study_complete / share / search /
 *     word_view / passage_view / token_tap / grammar_view /
 *     grammar_drill_complete / install_prompt /
 *     app_installed / history_reset）と 1 対 1 で対応している。
 *   イベントを足したり消したりしたら、この本文も直すこと。
 *   KOBUN.site.analytics.ga4 が空のときは節ごと
 *   「現在アクセス解析は使用していません」に切り替わる。
 *
 * ナビ（ヘッダ・下タブ）には入れない。導線は
 *   使い方ページ末尾／ホーム末尾のリンク列／共通フッタの制作者行／
 *   履歴リセットの近く／アナリティクスの表記の近く。
 * ===================================================================== */
(function () {
  'use strict';

  var K = window.KOBUN;
  var U = K.util;
  var el = U.el;

  /** 制定日。変えたら本文末尾の表示も変わる */
  var ESTABLISHED = '2026年9月11日';

  function site() { return K.site || {}; }
  function author() { return (K.site && K.site.author) || {}; }
  function appName() { return site().name || '本アプリ'; }
  function authorName() { return author().name || '制作者'; }

  /** 空文字や PLACEHOLDER のままの URL はリンクにしない（components と同じ判定） */
  function usable(u) {
    return typeof u === 'string' && /^https?:\/\//i.test(u) && !/PLACEHOLDER/i.test(u);
  }

  /** 外部リンク（新しいタブ） */
  function ext(href, text) {
    return el('a', { href: href, target: '_blank', rel: 'noopener noreferrer', text: text || href });
  }

  /** 節（カード）。id は ?to= の飛び先になる。
      children には配列を混ぜてよい（1 段だけ平らにする。
      analyticsPart() のように「見出し＋段落の並び」をまとめて返す関数があるため）。 */
  function sec(id, title, children) {
    var flat = [];
    children.forEach(function (c) {
      if (!c) return;
      if (Array.isArray(c)) flat = flat.concat(c.filter(Boolean));
      else flat.push(c);
    });
    return el('div', { class: 'card help-section', id: 'terms-' + id }, [
      el('h2', { class: 'card-title', text: title })
    ].concat(flat));
  }

  /** 条・項の見出し */
  function h3(text) { return el('h3', { class: 'help-h3', text: text }); }

  function p(children, cls) {
    return el('p', cls ? { class: cls } : {}, [].concat(children));
  }

  /** 箇条書き。文字列でも要素の配列でも渡せる */
  function ul(items) {
    return el('ul', { class: 'help-list' }, items.filter(Boolean).map(function (it) {
      return el('li', {}, [].concat(it));
    }));
  }

  /* ------------------------------------------------------------------
   * アクセス解析の設定（data/site.js を見る）
   * ---------------------------------------------------------------- */
  function analyticsCfg() {
    var a = (K.site && K.site.analytics) || {};
    return {
      ga4: String(a.ga4 || '').trim(),
      cloudflare: String(a.cloudflare || '').trim()
    };
  }

  /* ------------------------------------------------------------------
   * 利用規約
   * ---------------------------------------------------------------- */
  function termsSection() {
    var url = site().url || '';
    var name = appName();
    var who = authorName();

    return sec('terms', '利用規約', [
      h3('第 1 条（適用）'),
      p([
        'この利用規約（以下「本規約」）は、',
        el('b', { text: name }),
        usable(url) ? el('span', {}, ['（', ext(url), '。以下「本アプリ」）']) : '（以下「本アプリ」）',
        ' の利用条件を定めるものです。本アプリを利用された方は、本規約に同意したものとみなします。'
      ]),

      h3('第 2 条（サービスの内容）'),
      ul([
        ['本アプリは、', el('b', { text: who }), ' が個人で制作・公開している無料の学習用ウェブアプリです。'],
        '会員登録・ログインはありません。利用にあたって料金は一切かかりません。',
        '内容の追加・変更・削除、公開の一時停止・終了を、予告なく行うことがあります。',
        '学校・塾・企業などの団体が運営するものではなく、教科書会社や出版社とも関係ありません。'
      ]),

      h3('第 3 条（知的財産権）'),
      ul([
        ['収録している古典の', el('b', { text: '原文' }), ' は、著作権の保護期間が満了した作品です。'],
        ['一方、', el('b', { text: '現代語訳・語義・品詞分解・関連語などの編集したデータ、およびアプリのプログラムとデザイン' }),
          ' は ' + who + ' に帰属します（教科書や市販書籍の訳文を転載したものではありません）。'],
        '個人が自分の学習のために使うこと（画面を見て覚える、印刷して手元で使う、友人にURLを教えるなど）は自由です。許可を取る必要はありません。',
        ['ただし、', el('b', { text: '無断での転載・再配布・改変しての配布・販売、および自動的な収集（スクレイピング等）はご遠慮ください。' })],
        ['出典（アプリ名と URL）を明記したうえでの', el('b', { text: '引用' }), ' は、正当な範囲で行っていただけます。'],
        ['ただし次条の', el('b', { text: '「本文の出典とライセンス」' }),
          ' に挙げた原文については、もとのライセンス（CC BY-SA）が優先します。それらの原文は、もとの著作権者名とページの URL を明記し、同じライセンスで公開する限り、この規約の制限を受けずに転載・再配布していただけます。']
      ]),

      h3('第 3 条の 2（本文の出典とライセンス）'),
      p([
        '古典の原文そのものは保護期間が満了していますが、web で公開されている',
        el('b', { text: '翻刻（写本・版本の字を起こしたもの）や校訂本文（諸本を比べ、句読点や表記を整えたもの）' }),
        ' には、公開者がライセンスを設けている場合があります。本アプリが本文を採った先と、その条件は次のとおりです。'
      ]),
      ul([
        [
          el('b', { text: 'やたナビTEXT の校訂本文' }),
          '（伊勢物語 第一段・第四段／徒然草 第十一段・第八十九段／十訓抄 三の一／とはずがたり 巻一）… ',
          '校訂: ', el('b', { text: '中川聡（Satoshi Nakagawa）' }), '／',
          ext('https://yatanavi.org/text/', 'yatanavi.org/text/'),
          '／ライセンス ',
          ext('https://creativecommons.org/licenses/by-sa/4.0/deed.ja', 'CC BY-SA 4.0'),
          '。同サイトの今昔物語集は翻刻（著作権なし）です。'
        ],
        [
          el('b', { text: '日本語版 Wikisource「源氏物語（渋谷栄一校訂）」' }),
          '（桐壺・若菜下）… 校訂: ', el('b', { text: '渋谷栄一' }), '／',
          ext('https://ja.wikisource.org/wiki/源氏物語_(渋谷栄一校訂)', 'ja.wikisource.org'),
          '／ライセンス ',
          ext('https://creativecommons.org/licenses/by-sa/3.0/deed.ja', 'CC BY-SA 3.0'),
          '。'
        ],
        [
          el('b', { text: '日本語版 Wikisource のその他の翻刻' }),
          '（竹取物語〈國民文庫〉／土佐日記・蜻蛉日記・大鏡・方丈記〈國文大觀〉／更級日記〈有朋堂文庫〉／増鏡〈校註増鏡〉／伊勢物語〈群書類従〉／枕草子／古今和歌集仮名序／おくのほそ道）… ',
          ext('https://ja.wikisource.org/', 'ja.wikisource.org'),
          '。底本はいずれも著作権の保護期間が満了した刊本です。サイトのライセンスは ',
          ext('https://creativecommons.org/licenses/by-sa/4.0/deed.ja', 'CC BY-SA 4.0'),
          '。'
        ],
        [
          '本文は上のいずれについても、教科書で一般的な本文に合わせて',
          el('b', { text: '表記・句読点・段落を整え、抜粋し（省いた箇所は「（中略）」）' }),
          '、旧字体・旧仮名づかいを通行の字体に改めています。',
          'どの教材をどこから採ったか、底本による異同の一覧は、公開リポジトリの ',
          el('code', { text: 'docs/passage-notes.md' }),
          ' と ', el('code', { text: 'docs/copyright-review.md' }), ' にあります。'
        ]
      ]),

      h3('第 4 条（禁止事項）'),
      p('本アプリの利用にあたり、次の行為を禁止します。'),
      ul([
        '法令または公序良俗に反する行為',
        '本アプリの運営を妨げる行為（過度な連続アクセス、自動的な収集、サーバーへの攻撃など）',
        '本アプリの内容を無断で複製・転載・再配布・販売する行為',
        'プログラムを不正に改変して再公開する行為、その他の不正アクセス行為',
        '制作者または第三者の権利を侵害する行為、誹謗中傷',
        'その他、制作者が不適切と判断する行為'
      ]),

      h3('第 5 条（免責事項）'),
      ul([
        ['本アプリの内容について、', el('b', { text: '正確性・完全性・有用性を保証しません。' })],
        ['古語の', el('b', { text: '語義・品詞分解・現代語訳は解釈が分かれる場合があります。' }),
          ' 試験や課題に用いる際は、必ず教科書・辞書など信頼できる資料で確認してください。'],
        '本アプリの利用によって生じたいかなる損害についても、制作者は責任を負いません。',
        ['学習履歴はお使いのブラウザの中にだけ保存されます。ブラウザの設定変更・サイトデータの削除・端末の故障などで',
          el('b', { text: '履歴が消えることがあり、その消失について制作者は責任を負いません。' })],
        '本アプリの提供の中断・停止・終了によって生じた損害についても、責任を負いません。'
      ]),

      h3('第 6 条（未成年の方の利用）'),
      ul([
        '本アプリは中学生・高校生の利用を想定しています。未成年の方は、保護者の同意を得たうえで利用してください。',
        ['本アプリには、', el('b', { text: '氏名・メールアドレスなどの個人情報を入力する欄はありません。' }),
          ' 学習の記録はお使いの端末の中だけに残ります。']
      ]),

      h3('第 7 条（本規約の変更）'),
      p('必要に応じて本規約を変更することがあります。変更後の規約は、このページに掲載した時点から適用されます。重要な変更があるときは、掲載日を更新してお知らせします。'),

      h3('第 8 条（準拠法・管轄裁判所）'),
      p('本規約の解釈には日本法を適用します。本アプリに関して紛争が生じた場合は、制作者の所在地を管轄する日本の裁判所を第一審の専属的合意管轄裁判所とします。'),

      h3('第 9 条（お問い合わせ）'),
      contactBlock()
    ]);
  }

  /* ------------------------------------------------------------------
   * プライバシーポリシー
   * ---------------------------------------------------------------- */

  /** アクセス解析の節（data/site.js の analytics 次第で中身が入れ替わる） */
  function analyticsPart() {
    var cfg = analyticsCfg();
    var out = [h3('2. アクセス解析について')];

    if (!cfg.ga4 && !cfg.cloudflare) {
      out.push(p([
        el('b', { text: '現在アクセス解析は使用していません。' }),
        ' 利用状況を計測する外部サービスは読み込んでおらず、閲覧の記録が外部に送られることはありません。'
      ]));
      return out;
    }

    if (cfg.ga4) {
      out.push(p([
        '本アプリでは、どの画面が読まれているかを把握して改善に役立てるため、Google LLC が提供する ',
        el('b', { text: 'Google アナリティクス 4' }),
        ' を利用しています。'
      ]));
      out.push(p([
        el('b', { text: 'Google LLC に送られる情報' }),
        'は、次のものです。'
      ]));
      out.push(ul([
        '閲覧した画面のパスと画面名（例：単語一覧、重要度 S の絞り込み）',
        'クイズやフラッシュカードを最後まで進めたこと、そのデッキの種類（重要度・品詞・作品・文章）と問題数・正答率',
        '文法ドリルを最後まで進めたこと、その出題の種類（意味当て・活用形当て・識別・敬語）と問題数・正答率',
        '文法の解説ページを開いたこと（その分野と項目の id）',
        '共有ボタンを使ったこと（どの方法で、どの種類のページを共有したか）',
        '単語の検索を行った回数と、その結果の件数',
        '開いた単語・文章（その id と重要度）、原文の語をタップしたこと',
        'ホーム画面に追加したこと、学習履歴のリセットを行ったこと',
        '端末・ブラウザの種類、画面の大きさ、参照元',
        'IP アドレスに基づく概略の地域（IP アドレスは匿名化して送信しています）'
      ]));
      out.push(p([
        el('b', { text: '送らない情報' }),
        'は、次のものです。'
      ]));
      out.push(ul([
        ['入力した', el('b', { text: '検索語そのもの' }), '（送るのは「何件ヒットしたか」だけです）'],
        [el('b', { text: 'どの語を覚えたかという学習履歴の中身' }), '（送るのは「1 周した」「正答率」などの集計値だけです）'],
        [el('b', { text: '氏名・メールアドレスなどの個人情報' }), '（そもそも入力する欄がありません）']
      ]));
      out.push(p([
        'Google アナリティクスの利用規約とプライバシーポリシーは次のページをご確認ください。'
      ], 'muted small'));
      out.push(ul([
        ext('https://policies.google.com/privacy', 'Google プライバシー ポリシー'),
        // Google アナリティクス利用規約 7（プライバシー）が掲示を求めているページ
        [
          ext('https://policies.google.com/technologies/partner-sites',
            'Google のサービスを使用するサイトやアプリから収集した情報の Google による使用'),
          ' … Google がデータをどう扱うかの説明です。'
        ],
        ext('https://marketingplatform.google.com/about/analytics/terms/jp/', 'Google アナリティクス利用規約'),
        [
          ext('https://tools.google.com/dlpage/gaoptout', 'Google アナリティクス オプトアウト アドオン'),
          ' … 計測を望まない場合は、このアドオンを導入すると送信を無効にできます。'
        ]
      ]));
    }

    if (cfg.cloudflare) {
      out.push(p([
        'あわせて ',
        el('b', { text: 'Cloudflare Web Analytics' }),
        ' を利用しています。こちらは Cookie を使わず、個人を識別しない集計（表示された画面と読み込み速度）だけを取得します。'
      ]));
    }

    return out;
  }

  function contactBlock() {
    var a = author();
    var lines = [];
    if (usable(a.x)) {
      lines.push(p([
        '本アプリについてのご連絡・ご要望・権利に関するお申し出は、',
        ext(a.x, 'X（' + authorName() + '）'),
        ' の DM またはリプライでお願いします。'
      ]));
    } else {
      lines.push(p('本アプリについてのご連絡・ご要望・権利に関するお申し出は、制作者の SNS までお願いします。'));
    }
    lines.push(p('個人で運営しているため、返信にお時間をいただくことがあります。', 'muted small'));
    return el('div', {}, lines);
  }

  function privacySection() {
    var cfg = analyticsCfg();
    var usesCookie = !!cfg.ga4;

    return sec('privacy', 'プライバシーポリシー', [
      h3('1. 取得する情報（学習履歴・設定）'),
      ul([
        ['「覚えた／苦手」の記録、クイズと文法ドリルの結果、「続きから」、訳の表示などの画面設定は、',
          el('b', { text: 'お使いのブラウザの localStorage にのみ保存されます。' }),
          ' 制作者や外部のサーバーに送られることはありません。'],
        '会員登録・ログインはなく、氏名・メールアドレス・電話番号などの個人情報を取得することもありません。',
        '記録はブラウザ・端末ごとに別で、同期は行いません。',
        ['削除したいときは、',
          el('a', { href: '#/help?to=history', text: '使い方ページの「学習履歴をリセットする」' }),
          ' から消せます。ブラウザの「サイトデータの削除」でも消えます。']
      ]),

      analyticsPart(),

      h3('3. Cookie などの利用'),
      usesCookie
        ? ul([
            'アクセス解析（Google アナリティクス 4）は、同じ閲覧者かどうかを区別するために Cookie やブラウザの保存領域を利用します。',
            'Cookie はブラウザの設定で拒否・削除できます。拒否しても本アプリの機能は制限されません（学習履歴は Cookie ではなく localStorage に保存しているためです）。',
            '本アプリ自身は、広告のための Cookie を一切使用していません。'
          ])
        : ul([
            '本アプリは、広告や追跡のための Cookie を使用していません。',
            '学習履歴と画面設定は Cookie ではなくブラウザの localStorage に保存され、外部には送られません。'
          ]),

      h3('4. 外部サービスへのリンク'),
      ul([
        '共有ボタンから X・LINE へ、制作者の紹介から YouTube・BOOTH などへ移動できます。',
        'これらのリンク先は本アプリとは別のサービスです。移動した先では各社のプライバシーポリシー・利用規約が適用されますので、それぞれのページをご確認ください。',
        'リンク先での情報の取り扱いについて、制作者は責任を負いません。'
      ]),

      h3('5. ホーム画面に追加（アプリとして使う）したとき'),
      ul([
        ['ホーム画面に追加すると、表示を速くしオフラインでも読めるように、ページや単語・文章のデータが',
          el('b', { text: 'お使いの端末の中に保存（キャッシュ）されます。' })],
        'これは端末内にファイルを置くだけの仕組みで、その情報が外部に送られることはありません。',
        'ホーム画面のアイコンを削除するか、ブラウザのサイトデータを削除すれば、保存されたファイルも消えます。'
      ]),

      h3('6. 本ポリシーの改定'),
      p('必要に応じて本ポリシーを改定することがあります。改定後の内容は、このページに掲載した時点から適用されます。'),

      h3('7. お問い合わせ'),
      contactBlock()
    ]);
  }

  /* ------------------------------------------------------------------
   * 描画
   * ---------------------------------------------------------------- */
  function render(params, query, container) {
    var section = el('section', { class: 'view view-terms view-help' });

    section.appendChild(el('div', { class: 'crumbs' }, [
      el('a', { href: '#/', text: '← ホーム' })
    ]));
    section.appendChild(el('h1', { class: 'view-title', text: '利用規約・プライバシーポリシー' }));
    section.appendChild(el('p', { class: 'view-lead' }, [
      el('b', { text: appName() }),
      ' を安心して使っていただくための取り決めです。前半が利用規約、後半が個人情報・アクセス解析の扱い（プライバシーポリシー）です。'
    ]));

    var toc = el('nav', { class: 'help-toc', 'aria-label': '規約の目次' });
    [['terms', '利用規約'], ['privacy', 'プライバシーポリシー']].forEach(function (t) {
      toc.appendChild(el('a', { href: '#/terms?to=' + t[0], text: t[1] }));
    });
    section.appendChild(toc);

    section.appendChild(termsSection());
    section.appendChild(privacySection());

    section.appendChild(el('p', { class: 'terms-date muted small' }, [
      '制定日：' + ESTABLISHED,
      el('br'),
      '制作：' + authorName()
    ]));

    section.appendChild(el('div', { class: 'home-foot' }, [
      el('a', { href: '#/', text: 'ホームへ戻る' }),
      el('a', { href: '#/help', text: '使い方' }),
      el('a', { href: '#/help?to=history', text: '学習履歴について' })
    ]));

    container.appendChild(section);

    // ?to=privacy などで来たら、その節まで送る（help と同じ仕組み）
    if (query && query.to) {
      var target = section.querySelector('#terms-' + query.to.replace(/[^a-z]/g, ''));
      if (target) {
        setTimeout(function () {
          target.scrollIntoView({ block: 'start' });
          target.classList.add('is-target');
        }, 0);
      }
    }
  }

  K.views = K.views || {};
  K.views.terms = { render: render };
})();
