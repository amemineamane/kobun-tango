/* =====================================================================
 * js/store.js — 学習履歴ストア（localStorage）
 * ---------------------------------------------------------------------
 * 【保存キー】
 *   kobun.v1.progress … { "<学習キー>": { status, seen, correct, wrong, updatedAt } }
 *   kobun.v1.prefs    … 画面の設定（フィルタの記憶など）
 *   kobun.v1.quizlog  … クイズの結果履歴（最新 50 件）
 *
 * 【学習キー】2 種類ある。どちらも文字列として保存する。
 *   "39"                    … data/words.js の **id**（330 語）。
 *   "p:<passageId>:<index>" … data/passages.js の文章固有語
 *                             （330 語に無く、その文章の中だけで覚える語）。
 *
 * 【重要】330 語のキーは必ず id を使う。
 *   SCHEMA.md にあるとおり kana は重複しうる（ながむ／ゐる）ので、
 *   kana をキーにすると別語の履歴が混ざる。
 *   文章固有語は id を持たないので、作品・文章をまたいで衝突しない
 *   "p:" 接頭辞つきのキーにしてある（数値キーとも混ざらない）。
 *   summary() は「330 語の進捗」を出すので、数値キーだけを数える。
 *
 * 【status】
 *   'new'   未学習（既定。エントリ自体が無い場合もこれ）
 *   'weak'  苦手（「まだ」を押した／クイズで間違えた）
 *   'known' 覚えた
 *
 * 【拡張の余地】
 *   間隔反復（SRS）を入れるなら、このオブジェクトに
 *   ease / interval / dueAt を足して、setStatus のところで更新する。
 *   保存形式が変わるときは "v1" を "v2" に上げ、v1 からの移行を書く。
 * ===================================================================== */
(function () {
  'use strict';

  var PREFIX = 'kobun.v1.';
  var K_PROGRESS = PREFIX + 'progress';
  var K_PREFS = PREFIX + 'prefs';
  var K_QUIZLOG = PREFIX + 'quizlog';

  var available = (function () {
    try {
      var t = PREFIX + 'test';
      localStorage.setItem(t, '1');
      localStorage.removeItem(t);
      return true;
    } catch (e) { return false; }
  })();

  var memory = {}; // localStorage が使えない環境（プライベートモード等）の代替

  function readRaw(key, fallback) {
    if (!available) return memory[key] !== undefined ? memory[key] : fallback;
    try {
      var s = localStorage.getItem(key);
      return s == null ? fallback : JSON.parse(s);
    } catch (e) { return fallback; }
  }

  function writeRaw(key, value) {
    if (!available) { memory[key] = value; return; }
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { memory[key] = value; }
  }

  var progress = readRaw(K_PROGRESS, {});
  var prefs = readRaw(K_PREFS, {});

  var Store = {
    available: available,

    STATUSES: ['new', 'weak', 'known'],
    STATUS_LABEL: { 'new': '未学習', 'weak': '苦手', 'known': '覚えた' },

    /** 学習状態を返す（未登録なら 'new'） */
    getStatus: function (id) {
      var e = progress[String(id)];
      return (e && e.status) || 'new';
    },

    getEntry: function (id) {
      return progress[String(id)] || null;
    },

    /** 学習状態を設定する。status に 'new' を渡すとエントリを消す */
    setStatus: function (id, status) {
      var k = String(id);
      if (status === 'new') {
        if (progress[k]) {
          // 回答回数は残しておきたいので status だけ戻す
          progress[k].status = 'new';
          progress[k].updatedAt = Date.now();
        }
      } else {
        var e = progress[k] || { seen: 0, correct: 0, wrong: 0 };
        e.status = status;
        e.updatedAt = Date.now();
        progress[k] = e;
      }
      writeRaw(K_PROGRESS, progress);
      document.dispatchEvent(new CustomEvent('kobun:progress', { detail: { id: String(id) } }));
    },

    /** クイズ／フラッシュカードの回答を記録する */
    recordAnswer: function (id, correct) {
      var k = String(id);
      var e = progress[k] || { status: 'new', seen: 0, correct: 0, wrong: 0 };
      e.seen = (e.seen || 0) + 1;
      if (correct) {
        e.correct = (e.correct || 0) + 1;
        if (e.status !== 'known') e.status = 'known';
      } else {
        e.wrong = (e.wrong || 0) + 1;
        e.status = 'weak';
      }
      e.updatedAt = Date.now();
      progress[k] = e;
      writeRaw(K_PROGRESS, progress);
      document.dispatchEvent(new CustomEvent('kobun:progress', { detail: { id: String(id) } }));
    },

    /** 330 語全体の集計 { total, known, weak, newCount }
     *  文章固有語（"p:" で始まるキー）は数えない。 */
    summary: function (totalWords) {
      var known = 0, weak = 0;
      Object.keys(progress).forEach(function (k) {
        if (!/^\d+$/.test(k)) return;
        var s = progress[k].status;
        if (s === 'known') known++;
        else if (s === 'weak') weak++;
      });
      return { total: totalWords, known: known, weak: weak, newCount: totalWords - known - weak };
    },

    /** 任意のキー集合（文章・作品のデッキなど）の集計。
     *  ids には数値 id と "p:..." 文字列キーを混ぜてよい。 */
    summaryOf: function (ids) {
      var known = 0, weak = 0;
      (ids || []).forEach(function (id) {
        var s = Store.getStatus(id);
        if (s === 'known') known++;
        else if (s === 'weak') weak++;
      });
      var total = (ids || []).length;
      return { total: total, known: known, weak: weak, newCount: total - known - weak };
    },

    /** 全消去 */
    resetProgress: function () {
      progress = {};
      writeRaw(K_PROGRESS, progress);
      document.dispatchEvent(new CustomEvent('kobun:progress', { detail: { id: null } }));
    },

    /** バックアップ用（将来 UI を付ける） */
    exportJSON: function () {
      return JSON.stringify({ version: 1, progress: progress, quizlog: readRaw(K_QUIZLOG, []) }, null, 2);
    },

    /* --- 画面設定 --------------------------------------------------- */
    getPref: function (key, fallback) {
      return prefs[key] === undefined ? fallback : prefs[key];
    },
    setPref: function (key, value) {
      prefs[key] = value;
      writeRaw(K_PREFS, prefs);
    },

    /* --- クイズ履歴 ------------------------------------------------- */
    pushQuizResult: function (result) {
      var log = readRaw(K_QUIZLOG, []);
      log.unshift(Object.assign({ at: Date.now() }, result));
      writeRaw(K_QUIZLOG, log.slice(0, 50));
    },
    getQuizLog: function () { return readRaw(K_QUIZLOG, []); }
  };

  window.KOBUN = window.KOBUN || {};
  window.KOBUN.store = Store;
})();
