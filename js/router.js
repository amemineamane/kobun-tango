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
 *
 * 旧 URL（REDIRECTS）:
 *   #/works    → #/textbook   （作品一覧を教科書に統合）
 *   #/passages → #/textbook   （文章一覧を教科書に統合）
 *   ブックマークや外部リンクを壊さないため、履歴に残さず差し替える。
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

  var ROUTES = [
    { pattern: '/', view: 'home' },
    { pattern: '/help', view: 'help' },
    { pattern: '/words', view: 'words' },
    { pattern: '/word/:id', view: 'word' },
    { pattern: '/textbook', view: 'textbook' },
    { pattern: '/work/:workId', view: 'work' },
    { pattern: '/passage/:id', view: 'passage' },
    { pattern: '/study', view: 'study' },
    { pattern: '/quiz', view: 'quiz' }
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

      /* アクセス解析のページビュー（設定が無ければ no-op）。
         パスの組み立て・検索語の除外は js/analytics.js 側の仕事なので、
         ここでは「描き終わった」ことと画面の見出しだけを渡す。 */
      if (K.analytics) K.analytics.pageview(null, Router.screenTitle(container));
    },

    /** いま描かれている画面の見出し（無ければ <title>） */
    screenTitle: function (container) {
      var h = container && container.querySelector && container.querySelector('h1, h2');
      var t = h && h.textContent ? h.textContent.trim() : '';
      return t ? t + '｜古文単語帳' : document.title;
    },

    updateNav: function (route) {
      /* 「教科書」タブは配下（作品ページ・文章ページ）でも点灯させる。
         入口が 1 本なので、いま自分がどのタブの中にいるかが常に分かる。 */
      var map = {
        home: 'home', help: 'help',
        words: 'words', word: 'words',
        textbook: 'textbook', work: 'textbook', passage: 'textbook',
        study: 'study', quiz: 'quiz'
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
