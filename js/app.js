/* =====================================================================
 * js/app.js — 起動
 * ---------------------------------------------------------------------
 * すべてのデータ・ビューが読み込まれた最後に走る。
 * データが 1 つでも欠けていたら、その旨を画面に出す（file:// で
 * script タグの順序を間違えたときにすぐ気づけるように）。
 * ===================================================================== */
(function () {
  'use strict';

  var K = window.KOBUN;

  function fail(msg) {
    var app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = '';
    var div = document.createElement('div');
    div.className = 'notice error';
    div.innerHTML = '<h2>データを読み込めませんでした</h2><p></p>' +
      '<p class="muted">index.html の &lt;script&gt; の順序（data/*.js → js/*.js）を確認してください。</p>';
    div.querySelector('p').textContent = msg;
    app.appendChild(div);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!K || !K.words || !K.words.length) { fail('data/words.js が読み込まれていません。'); return; }
    if (!K.index) { fail('js/data-index.js が読み込まれていません。'); return; }
    if (!K.router) { fail('js/router.js が読み込まれていません。'); return; }

    // フッターに件数を出す
    var stat = document.getElementById('footer-stat');
    if (stat) {
      stat.textContent =
        '単語 ' + K.words.length + ' 語　/　作品 ' + (K.works || []).length + ' 件　/　' +
        '文章 ' + (K.passages || []).length + ' 編　/　' +
        '品詞分解 ' + K.index.tokensByPassage.size + ' 編　/　関連語 ' + (K.relations || []).length + ' 本';
    }

    /* 共通フッタの制作者行。index.html には直書きせず、data/site.js の値から描く
       （名前や URL を変えるときに触る場所を 1 か所にするため）。
       legal: true で「利用規約・プライバシーポリシー」（#/terms）も同じ行に出す。
       ナビには入れない画面なので、全画面から届く導線はここが本命。 */
    if (stat && stat.parentNode && K.components && K.components.authorLine) {
      var line = K.components.authorLine({ legal: true });
      if (line) stat.parentNode.appendChild(line);
    }

    // localStorage が使えない環境の注意書き
    if (!K.store.available) {
      var warn = document.getElementById('storage-warning');
      if (warn) warn.hidden = false;
    }

    K.router.start();
    registerServiceWorker();
  });

  /* ------------------------------------------------------------------
   * Service Worker（ホーム画面に追加＋オフライン）
   * ------------------------------------------------------------------
   * ・file:// では登録できない仕様なので、http/https のときだけ登録する。
   *   （ダブルクリックで開く使い方は今までどおり動く。SW が無いだけ）
   * ・失敗しても機能は落ちないので console.warn だけにする。
   * ・新しい sw.js が「待機中」になったら、画面下にバーを出して
   *   ユーザーが押したときだけ入れ替える（読んでいる途中で差し替えない）。
   * ---------------------------------------------------------------- */
  var reloadAfterSkipWaiting = false;

  function showUpdateBar(waiting) {
    if (document.getElementById('update-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'update-bar';
    bar.setAttribute('role', 'status');

    var msg = document.createElement('span');
    msg.textContent = '新しいバージョンがあります';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary';
    btn.textContent = '再読み込み';
    btn.addEventListener('click', function () {
      btn.disabled = true;
      reloadAfterSkipWaiting = true;
      waiting.postMessage({ type: 'SKIP_WAITING' });
    });

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn btn-ghost';
    close.textContent = 'あとで';
    close.setAttribute('aria-label', 'この通知を閉じる');
    close.addEventListener('click', function () { bar.remove(); });

    bar.appendChild(msg);
    bar.appendChild(btn);
    bar.appendChild(close);
    document.body.appendChild(bar);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      // すでに待機中の新しい版があるなら、その場で知らせる
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateBar(reg.waiting);

      reg.addEventListener('updatefound', function () {
        var sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', function () {
          // controller があるとき＝初回インストールではなく「更新」
          if (sw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBar(sw);
        });
      });
    }, function (err) {
      console.warn('Service Worker を登録できませんでした:', err);
    });

    // 入れ替えたときだけ再読み込みする（初回インストールでは何もしない）
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!reloadAfterSkipWaiting) return;
      reloadAfterSkipWaiting = false;
      location.reload();
    });
  }
})();
