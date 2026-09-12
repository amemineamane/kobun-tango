/* =====================================================================
 * js/router.js — ハッシュルーター
 * ---------------------------------------------------------------------
 * file:// で直接開けることを最優先にしているので、History API ではなく
 * location.hash を使う。単語詳細に直リンクできる（#/word/12）。
 *
 * 対応パス:
 *   #/                 ホーム（既定。ハッシュ無しで開いたときもここ）
 *   #/help             使い方（?to=history などで節までスクロール）
 *   #/words            単語一覧（?q= &level= &pos= &row= &work= &status= &sort= を取る）
 *   #/word/:id         単語詳細（:id は words.js の id）
 *   #/textbook         教科書（作品ごとの文章一覧。?grade= を取る）
 *   #/work/:workId     作品ページ
 *   #/passage/:id      文章詳細（:id は passages.js の id）
 *   #/study            フラッシュカード（?level= &pos= &work= &passage= &status= を取る）
 *   #/quiz             4択クイズ（同上）
 *   #/grammar                      古典文法の一覧
 *   #/grammar/drill                文法ドリル（?kind= &cat= &aux= &count=）
 *   #/grammar/:category            助動詞／助詞／敬語／活用／識別
 *   #/grammar/:category/:id        文法項目の詳細
 *   #/terms            利用規約・プライバシーポリシー（?to=privacy で節までスクロール）
 *                      ナビには入れない（フッタ・使い方・ホーム末尾からのリンク）
 *
 * 旧 URL（REDIRECTS）:
 *   #/works    → #/textbook   （作品一覧を教科書に統合）
 *   #/passages → #/textbook   （文章一覧を教科書に統合）
 *   ブックマークや外部リンクを壊さないため、履歴に残さず差し替える。
 *
 * 【SEO（DESIGN.md 4-e）】
 *   ハッシュ遷移のたびに document.title を画面の見出しに合わせ、
 *   <link rel="canonical"> を対応する静的ページ（w/39.html など。
 *   tools/build-seo.mjs の生成物）の絶対 URL に書き換える。
 *   対応するページが無い画面（学習・クイズ・使い方）はトップを指す。
 *   共有ボタンの URL は **ハッシュのまま**（履歴・PWA との整合のため。
 *   canonical で「正式な URL は静的ページ」と伝えれば検索側の重複は起きない）。
 *
 * 【ルートを足すには】
 *   1. ROUTES に { pattern, view } を 1 行足す。
 *      pattern は '/word/:id' のように書けば :id が params.id に入る。
 *   2. view は function (params, query, container) を持つオブジェクト
 *      （js/view-*.js が window.KOBUN.views.xxx に自分を登録している）。
 * ===================================================================== */
(function () {
  'use strict';

  var K = window.KOBUN;
  var U = K.util;

  /* index.html に書いてある既定の <title>（ホームと、対応する画面が無いとき用）。
     読み込み時点の値を控えておき、以後は画面ごとに書き換える。 */
  var DEFAULT_TITLE = document.title;

  var ROUTES = [
    { pattern: '/', view: 'home' },
    { pattern: '/help', view: 'help' },
    { pattern: '/words', view: 'words' },
    { pattern: '/word/:id', view: 'word' },
    { pattern: '/textbook', view: 'textbook' },
    { pattern: '/work/:workId', view: 'work' },
    { pattern: '/passage/:id', view: 'passage' },
    { pattern: '/study', view: 'study' },
    { pattern: '/quiz', view: 'quiz' },
    /* 文法は 1 つの view が 4 画面を描き分ける（category が 'drill' ならドリル）。
       :category より前に置く必要はない（正規表現は前方から順に試すが、
       '/grammar' と '/grammar/:category' は文字数が違うので衝突しない）。 */
    { pattern: '/grammar', view: 'grammar' },
    { pattern: '/grammar/:category', view: 'grammar' },
    { pattern: '/grammar/:category/:id', view: 'grammar' },
    { pattern: '/terms', view: 'terms' }
  ];

  /** 旧パス → 新パス。クエリ（?grade= など）はそのまま引き継ぐ。 */
  var REDIRECTS = {
    '/works': '/textbook',
    '/passages': '/textbook'
  };

  function compile(pattern) {
    var keys = [];
    var re = pattern.replace(/:[A-Za-z0-9_]+/g, function (m) {
      keys.push(m.slice(1));
      return '([^/]+)';
    });
    return { re: new RegExp('^' + re + '$'), keys: keys };
  }
  ROUTES.forEach(function (r) { Object.assign(r, compile(r.pattern)); });

  var Router = {
    current: null,

    /** 現在のハッシュを { path, params, query, view } に分解 */
    parse: function () {
      var hash = location.hash || '';
      if (hash.charAt(0) === '#') hash = hash.slice(1);
      if (!hash) hash = '/';
      var qi = hash.indexOf('?');
      var path = qi < 0 ? hash : hash.slice(0, qi);
      var query = U.parseQuery(qi < 0 ? '' : hash.slice(qi));
      if (path.charAt(0) !== '/') path = '/' + path;
      // 末尾のスラッシュは落とす（/words/ → /words）
      if (path.length > 1 && path.charAt(path.length - 1) === '/') path = path.slice(0, -1);

      for (var i = 0; i < ROUTES.length; i++) {
        var m = ROUTES[i].re.exec(path);
        if (m) {
          var params = {};
          ROUTES[i].keys.forEach(function (k, n) {
            try { params[k] = decodeURIComponent(m[n + 1]); }
            catch (e) { params[k] = m[n + 1]; }
          });
          return { path: path, params: params, query: query, view: ROUTES[i].view };
        }
      }
      return { path: path, params: {}, query: query, view: null };
    },

    /** 画面を描き直す */
    render: function () {
      var container = document.getElementById('app');
      if (!container) return;
      var route = Router.parse();

      /* 旧 URL は新しいパスに差し替える。
         戻るボタンで旧 URL に戻ってループしないよう location.replace を使う
         （履歴を 1 つ消費しない）。file:// で replace が使えない環境に備えて
         location.hash 直書きにフォールバックする。
         ハッシュの書き換えは同期的なので、続けて新しいルートを描いてしまう。
         直後に飛んでくる hashchange は同じ画面を描き直すだけで害がない。 */
      var to = REDIRECTS[route.path];
      if (to) {
        var url = '#' + to + U.buildQuery(route.query);
        try { location.replace(location.href.split('#')[0] + url); }
        catch (e) { location.hash = url.slice(1); }
        route = Router.parse();
        if (REDIRECTS[route.path]) {
          // ハッシュを書き換えられなかった場合の保険。表示だけ新しい画面にする
          route = { path: to, params: {}, query: route.query, view: 'textbook' };
        }
      }

      Router.current = route;
      U.clear(container);

      var view = route.view && K.views && K.views[route.view];
      if (!view) {
        container.appendChild(U.el('div', { class: 'notice' }, [
          U.el('h2', { text: 'ページが見つかりません' }),
          U.el('p', { text: route.path + ' に対応する画面はありません。' }),
          U.el('p', {}, [
            U.el('a', { href: '#/', text: 'ホームへ戻る' }),
            '　/　',
            U.el('a', { href: '#/words', text: '単語一覧へ' })
          ])
        ]));
      } else {
        try {
          view.render(route.params, route.query, container);
        } catch (e) {
          console.error(e);
          container.appendChild(U.el('div', { class: 'notice error' }, [
            U.el('h2', { text: '画面の描画に失敗しました' }),
            U.el('pre', { text: String(e && e.stack || e) })
          ]));
        }
      }

      Router.updateNav(route);
      // 画面切り替え時は先頭へ（詳細→詳細のときも読みやすい）
      window.scrollTo(0, 0);

      /* 検索エンジン向けに <title> と canonical を画面に合わせる（4-e. SEO）。
         見出しは解析のページタイトルと同じものを使う。 */
      var title = Router.screenTitle(container);
      Router.updateHead(route, title);

      /* アクセス解析のページビュー（設定が無ければ no-op）。
         パスの組み立て・検索語の除外は js/analytics.js 側の仕事なので、
         ここでは「描き終わった」ことと画面の見出しだけを渡す。 */
      if (K.analytics) K.analytics.pageview(null, title);
    },

    /** いま描かれている画面の見出し（無ければ <title>） */
    screenTitle: function (container) {
      var h = container && container.querySelector && container.querySelector('h1, h2');
      var t = h && h.textContent ? h.textContent.trim() : '';
      return t ? t + '｜古文単語帳' : DEFAULT_TITLE;
    },

    /**
     * ハッシュの画面に対応する静的ページ（tools/build-seo.mjs の生成物）の相対パス。
     * 対応するページが無い画面（学習・クイズ・使い方など）は '' を返し、
     * canonical はサイトのトップになる。
     */
    staticPath: function (route) {
      var idx = K.index;
      if (!idx) return '';
      var w;
      switch (route.view) {
        case 'word':
          w = idx.getWord(route.params.id);
          return w ? 'w/' + w.id + '.html' : '';
        case 'words': return 'w/index.html';
        case 'passage':
          return idx.getPassage(route.params.id) ? 'p/' + route.params.id + '.html' : '';
        case 'textbook': return 'p/index.html';
        case 'work':
          return idx.getWork(route.params.workId) ? 'k/' + route.params.workId + '.html' : '';
        case 'grammar': {
          var cat = route.params.category;
          if (!cat) return 'g/index.html';
          if (cat === 'drill') return 'g/index.html';
          if (!idx.grammarCategory || !idx.grammarCategory(cat)) return '';
          var dir = (cat === 'aux') ? 'jodoshi' : cat; // 静的ページの aux は Windows 予約名回避で jodoshi
          if (!route.params.id) return 'g/' + dir + '/index.html';
          var ge = idx.getGrammar(route.params.id);
          return (ge && ge.category === cat) ? 'g/' + dir + '/' + route.params.id + '.html' : '';
        }
        default: return '';
      }
    },

    /**
     * <title> と <link rel="canonical"> を画面に合わせて書き換える。
     * canonical は必ず **公開ページの絶対 URL**（data/site.js の url が土台）。
     * 手元の file:// や localhost を canonical に出さないため、
     * C.absUrl と違って「いま開いている URL」は使わない。
     */
    updateHead: function (route, title) {
      document.title = (route.view === 'home' || !title) ? DEFAULT_TITLE : title;
      var link = document.querySelector('link[rel="canonical"]');
      if (!link) return;
      var base = (K.site && K.site.url) || location.href.split('#')[0];
      if (base.charAt(base.length - 1) !== '/') base += '/';
      link.setAttribute('href', base + Router.staticPath(route));
    },

    updateNav: function (route) {
      /* 「教科書」タブは配下（作品ページ・文章ページ）でも点灯させる。
         入口が 1 本なので、いま自分がどのタブの中にいるかが常に分かる。 */
      var map = {
        home: 'home', help: 'help',
        words: 'words', word: 'words',
        textbook: 'textbook', work: 'textbook', passage: 'textbook',
        study: 'study', quiz: 'quiz',
        grammar: 'grammar'
      };
      var active = map[route.view] || '';
      Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (a) {
        a.classList.toggle('active', a.dataset.nav === active);
      });
    },

    /** プログラムから遷移する */
    go: function (path) {
      if (location.hash === '#' + path) Router.render();
      else location.hash = path;
    },

    /** 現在のクエリを一部だけ書き換えて遷移（一覧のフィルタで使う） */
    setQuery: function (patch, replace) {
      var route = Router.parse();
      var q = Object.assign({}, route.query, patch);
      Object.keys(q).forEach(function (k) { if (q[k] === '' || q[k] == null) delete q[k]; });
      var url = '#' + route.path + U.buildQuery(q);
      if (replace) {
        // file:// では replaceState が例外になるブラウザがあるので必ず握る
        try {
          history.replaceState(null, '', location.href.split('#')[0] + url);
          Router.render();
          return;
        } catch (e) { /* fallthrough */ }
      }
      if (location.hash === url) Router.render();
      else location.hash = url.slice(1);
    },

    /**
     * URL のクエリだけ書き換えて **再描画しない**。
     * 検索ボックスに文字を打つたびに画面ごと作り直すと入力欄の
     * フォーカスが飛ぶので、一覧側で部分更新したいときに使う。
     */
    replaceQuery: function (patch) {
      var route = Router.parse();
      var q = Object.assign({}, route.query, patch);
      Object.keys(q).forEach(function (k) { if (q[k] === '' || q[k] == null) delete q[k]; });
      var url = '#' + route.path + U.buildQuery(q);
      if (location.hash === url) return q;
      try {
        history.replaceState(null, '', location.href.split('#')[0] + url);
      } catch (e) {
        // file:// で replaceState が使えない場合は hash を直接書き換え、
        // 直後の hashchange を 1 回だけ握りつぶす
        Router.suppressNext = true;
        location.hash = url.slice(1);
      }
      return q;
    },

    suppressNext: false,

    start: function () {
      window.addEventListener('hashchange', function () {
        if (Router.suppressNext) { Router.suppressNext = false; return; }
        Router.render();
      });
      Router.render();
    }
  };

  K.router = Router;
})();
