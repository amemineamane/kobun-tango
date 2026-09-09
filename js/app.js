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
        '例文 ' + (K.examples || []).length + ' 文　/　関連語 ' + (K.relations || []).length + ' 本';
    }

    // localStorage が使えない環境の注意書き
    if (!K.store.available) {
      var warn = document.getElementById('storage-warning');
      if (warn) warn.hidden = false;
    }

    K.router.start();
  });
})();
