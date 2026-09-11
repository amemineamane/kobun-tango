/* =====================================================================
 * js/analytics.js — アクセス解析（Google アナリティクス 4 / Cloudflare Web Analytics）
 * ---------------------------------------------------------------------
 * 【設定は data/site.js の 1 か所】
 *   KOBUN.site.analytics = { ga4: 'G-XXXXXXXXXX', cloudflare: '<token>' }
 *   両方とも空文字なら **何も読み込まない**（外部通信はゼロのまま）。
 *
 * 【動く条件】
 *   ・http / https のときだけ計測する（file:// では何もしない）。
 *   ・localhost・127.0.0.1・*.local は「デバッグモード」。
 *     外部スクリプトは読み込まず、送るはずだった内容を console.debug に出す。
 *     手元で動作確認するためのもので、外には 1 バイトも出ない。
 *
 * 【公開 API】画面側はこの 2 つ（＋ deck ヘルパ）しか使わない。
 *   KOBUN.analytics.pageview(path, title)   path 省略時はいまのハッシュ
 *   KOBUN.analytics.event(name, params)
 *   KOBUN.analytics.deck(query)  → { deck: 'level', deck_id: 'S' }
 *   無効なときは全部 no-op（呼び出し側に分岐を書かなくてよい）。
 *
 * 【送らないもの（プライバシー）】
 *   ・検索語（?q=）… パスからも params からも必ず落とす。
 *     検索イベントは「件数」と「検索したかどうか」だけを送る。
 *   ・学習履歴の中身（どの語を覚えたか）… 完走時の集計値だけを送る。
 *   ・語ごとの「覚えた／まだ」（study_mark）… 量が多いので送らない。
 *
 * 【読み込み順】index.html で js/store.js の後・js/router.js の前。
 *   （data/site.js を読んだ後であること。router がページビューを呼ぶ）
 * ===================================================================== */
(function () {
  'use strict';

  var K = window.KOBUN = window.KOBUN || {};
  var U = K.util;

  function str(v) { return v == null ? '' : String(v).trim(); }

  var cfg = (K.site && K.site.analytics) || {};
  var GA4_ID = str(cfg.ga4);
  var CF_TOKEN = str(cfg.cloudflare);
  var configured = !!(GA4_ID || CF_TOKEN);

  var proto = (location.protocol || '').toLowerCase();
  var isHttp = (proto === 'http:' || proto === 'https:');
  var host = (location.hostname || '').toLowerCase();
  var isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1)$/.test(host) || /\.local$/.test(host);

  /** 実際に外へ送る（公開環境） */
  var live = configured && isHttp && !isLocal;
  /** 送らずにコンソールへ出すだけ（手元の確認用） */
  var debug = configured && isHttp && isLocal;

  /* ------------------------------------------------------------------
   * パス・パラメータの正規化
   * ---------------------------------------------------------------- */

  /** ページビューのパスに残してよいクエリ（検索語 q は入れない） */
  var SAFE_QUERY_KEYS = ['level', 'pos', 'row', 'work', 'passage', 'status', 'sort', 'grade', 'mode', 'count', 'to'];

  /** 念のため、値そのものが個人情報になりうるキーは捨てる */
  var BANNED_PARAM_KEYS = ['q', 'query', 'term', 'search_term', 'keyword'];

  /** いまのハッシュから「#」と検索語を除いたパスを作る（例: /words?level=S） */
  function currentPath() {
    var hash = location.hash || '';
    if (hash.charAt(0) === '#') hash = hash.slice(1);
    if (!hash) hash = '/';
    var qi = hash.indexOf('?');
    var path = qi < 0 ? hash : hash.slice(0, qi);
    if (path.charAt(0) !== '/') path = '/' + path;
    var query = (U && U.parseQuery) ? U.parseQuery(qi < 0 ? '' : hash.slice(qi)) : {};
    var safe = {};
    SAFE_QUERY_KEYS.forEach(function (k) { if (query[k]) safe[k] = query[k]; });
    var qs = (U && U.buildQuery) ? U.buildQuery(safe) : '';
    return path + qs;
  }

  /** GA4 の page_location 用（手元の file:// パスや検索語を漏らさない形にする） */
  function pageLocation(path) {
    var base = location.origin + location.pathname;
    return base + '#' + path;
  }

  /** 送るパラメータを掃除する（空値・禁止キーを落とし、文字列は短く切る） */
  function cleanParams(params) {
    var out = {};
    if (!params) return out;
    Object.keys(params).forEach(function (k) {
      if (BANNED_PARAM_KEYS.indexOf(k) >= 0) return;
      var v = params[k];
      if (v == null || v === '') return;
      if (typeof v === 'string') v = v.slice(0, 100);
      out[k] = v;
    });
    return out;
  }

  /* ------------------------------------------------------------------
   * 計測タグの読み込み（live のときだけ）
   * ---------------------------------------------------------------- */

  function loadGa4(id) {
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
      window.gtag = function () { window.dataLayer.push(arguments); };
    }
    window.gtag('js', new Date());
    /* ページビューは自前で送る（ハッシュルーティングなので自動計測だと
       画面遷移が 1 回しか数えられない）。IP の匿名化も明示しておく。 */
    window.gtag('config', id, { send_page_view: false, anonymize_ip: true });

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    (document.head || document.documentElement).appendChild(s);
  }

  function loadCloudflare(token) {
    var s = document.createElement('script');
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    // SPA なので spa: true（履歴の変化も 1 ページビューとして数えさせる）
    s.setAttribute('data-cf-beacon', JSON.stringify({ token: token, spa: true }));
    (document.head || document.documentElement).appendChild(s);
  }

  /* ------------------------------------------------------------------
   * 公開 API
   * ---------------------------------------------------------------- */

  var lastPath = null;

  var A = {
    /** 設定があり、http(s) で開かれている（＝送るか、デバッグ表示する） */
    enabled: live || debug,
    /** 実際に外部へ送る */
    live: live,
    /** コンソールに出すだけ */
    debug: debug,
    ga4: GA4_ID,
    cloudflare: CF_TOKEN,
    /** data/site.js に設定が書かれているか（プライバシー表記の出し分けに使う） */
    configured: configured,

    /**
     * ページビュー。router が描画を終えたときに呼ぶ。
     * @param path  省略すると、いまのハッシュから検索語を除いたパスを使う
     * @param title 画面タイトル
     */
    pageview: function (path, title) {
      if (!A.enabled) return;
      var p = str(path) || currentPath();
      if (p === lastPath) return;   // 同じ画面の描き直し（フィルタ操作など）は数えない
      lastPath = p;
      var payload = {
        page_path: p,
        page_title: str(title) || document.title,
        page_location: pageLocation(p)
      };
      if (debug) { console.debug('[analytics] pageview', payload); return; }
      if (GA4_ID && window.gtag) window.gtag('event', 'page_view', payload);
      /* Cloudflare は beacon が自分で拾う（spa: true）。こちらからは送らない。 */
    },

    /**
     * イベント。名前は GA4 の推奨イベント名に寄せる。
     * @param name   'quiz_complete' など
     * @param params 集計しやすい最小限のパラメータ
     */
    event: function (name, params) {
      if (!A.enabled) return;
      var n = str(name);
      if (!n) return;
      var p = cleanParams(params);
      if (debug) { console.debug('[analytics] event', n, p); return; }
      if (GA4_ID && window.gtag) window.gtag('event', n, p);
    },

    /**
     * デッキ（母集団）の種類を 1 つに決める。
     * 学習・クイズのイベントで「どんな条件で回したか」を集計するためのもの。
     * @returns { deck: 'passage'|'work'|'level'|'pos'|'all', deck_id: string }
     */
    deck: function (query) {
      var q = query || {};
      if (q.passage) return { deck: 'passage', deck_id: String(q.passage) };
      if (q.work) return { deck: 'work', deck_id: String(q.work) };
      if (q.level) return { deck: 'level', deck_id: String(q.level) };
      if (q.pos) return { deck: 'pos', deck_id: String(q.pos) };
      return { deck: 'all', deck_id: '' };
    }
  };

  K.analytics = A;

  if (live) {
    if (GA4_ID) loadGa4(GA4_ID);
    if (CF_TOKEN) loadCloudflare(CF_TOKEN);
  } else if (debug) {
    console.debug('[analytics] デバッグモード（localhost）。外部へは送信しません。', {
      ga4: GA4_ID || '(未設定)', cloudflare: CF_TOKEN ? '(設定あり)' : '(未設定)'
    });
  }
})();
