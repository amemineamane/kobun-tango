/* =====================================================================
 * js/util.js — 共通ユーティリティ
 * ---------------------------------------------------------------------
 * DOM 生成の小道具と、検索用の文字列正規化をまとめたもの。
 * 依存なし。他のすべての js より先に読み込む。
 * ===================================================================== */
(function () {
  'use strict';

  var U = {};

  /* --------------------------------------------------------------
   * DOM
   * ------------------------------------------------------------ */

  /** HTML エスケープ。textContent を使えない箇所（テンプレート文字列）用。 */
  U.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  /**
   * 要素をつくる。
   *   U.el('div', { class: 'card', dataset: { id: 3 } }, ['本文', U.el('b', {}, ['太字'])])
   * props の特別扱い:
   *   class / className, text, html, dataset, style(オブジェクト), on{Event}, それ以外は setAttribute
   */
  U.el = function (tag, props, children) {
    var node = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class' || k === 'className') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'dataset') Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else node.setAttribute(k, v === true ? '' : v);
    });
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return node;
  };

  /** 子要素を全部消す */
  U.clear = function (node) { while (node.firstChild) node.removeChild(node.firstChild); return node; };

  /* --------------------------------------------------------------
   * 検索用の正規化（SCHEMA.md の正規化ルールに合わせる）
   * ------------------------------------------------------------
   * words.js の searchKeys / sortKey は
   *   ・濁点/半濁点を清音化    つれづれなり → つれつれなり
   *   ・小書き仮名を大書きに    ゃゅょっ → やゆよつ
   *   ・〜 ／ （） ・ 空白 を除去
   *   ・歴史的仮名遣いを現代読みに  ゐ→い ゑ→え を→お
   * という形で作られている。検索クエリにも同じ変換をかけないと当たらない。
   * さらに入力の揺れを吸収するため、カタカナ→ひらがな も行う。
   */
  var SMALL_KANA = {
    'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お',
    'っ': 'つ', 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ', 'ゎ': 'わ',
    'ゕ': 'か', 'ゖ': 'け'
  };
  var OLD_KANA = { 'ゐ': 'い', 'ゑ': 'え', 'を': 'お' };

  U.normalizeKana = function (s) {
    if (!s) return '';
    var out = String(s).trim();
    // 全角英数を半角に、カタカナをひらがなに
    out = out.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
    });
    out = out.replace(/[ァ-ヶ]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0x60);
    });
    // 濁点・半濁点を落とす（合成文字に分解してから結合記号を削除）
    out = out.normalize('NFD').replace(/[゙゚]/g, '').normalize('NFC');
    // 小書き仮名 → 大書き
    out = out.replace(/[ぁぃぅぇぉっゃゅょゎゕゖ]/g, function (c) { return SMALL_KANA[c]; });
    // 歴史的仮名遣い → 現代読み
    out = out.replace(/[ゐゑを]/g, function (c) { return OLD_KANA[c]; });
    // 記号・空白を除去
    out = out.replace(/[〜～／\/（）\(\)・,、。\s]/g, '');
    return out;
  };

  /** ローマ字クエリの正規化（小文字化・全角半角・記号の除去） */
  U.normalizeRomaji = function (s) {
    if (!s) return '';
    return String(s).trim().toLowerCase()
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); })
      .replace(/[^a-z0-9]/g, '');
  };

  /**
   * ローマ字クエリの表記ゆれを吸収する候補を返す。
   * words.js の romaji は「を」を o、「ふ」を fu と書いている
   *   をかし → okashi（wokashi ではない）
   *   たまふ → tamafu（tamou ではない）
   * ので、ユーザーが wokashi / hu と打っても当たるように変換した候補も試す。
   * ※ 330 語の romaji に wo / wi / we / hu は 1 つも出現しないため、
   *   この置換で別語に化ける心配はない（tools/validate.mjs で確認できる）。
   */
  U.romajiVariants = function (s) {
    var base = U.normalizeRomaji(s);
    if (!base) return [];
    var out = [base];
    var alt = base.replace(/wo/g, 'o').replace(/wi/g, 'i').replace(/we/g, 'e').replace(/hu/g, 'fu');
    if (alt !== base) out.push(alt);
    return out;
  };

  /**
   * 1 語がクエリに当たるか判定する。
   * 戻り値は 0 = 不一致 / 大きいほど良いマッチ（並べ替えに使う）。
   *
   *   3 … searchKeys が前方一致（SCHEMA.md の基本ルール）
   *   2 … romaji が前方一致
   *   2 … kanji を含む
   *   1 … 語義（meanings）に含まれる ← 独自の追加。「意味から引く」ため
   */
  U.matchScore = function (word, rawQuery) {
    if (!rawQuery) return 1;
    var raw = String(rawQuery).trim();
    if (!raw) return 1;

    var nk = U.normalizeKana(raw);
    if (nk) {
      for (var i = 0; i < word.searchKeys.length; i++) {
        if (word.searchKeys[i].indexOf(nk) === 0) return 3;
      }
    }
    var variants = U.romajiVariants(raw);
    for (var v = 0; v < variants.length; v++) {
      if (word.romaji && word.romaji.indexOf(variants[v]) === 0) return 2;
    }
    if (word.kanji && word.kanji.indexOf(raw) >= 0) return 2;
    // 部分一致（前方一致で拾えないとき用）
    if (nk) {
      for (var j = 0; j < word.searchKeys.length; j++) {
        if (word.searchKeys[j].indexOf(nk) > 0) return 1;
      }
    }
    for (var m = 0; m < word.meanings.length; m++) {
      if (word.meanings[m].indexOf(raw) >= 0) return 1;
    }
    return 0;
  };

  /** 配列をシャッフル（Fisher-Yates） */
  U.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  /** #/words?level=S&pos=動詞 の「?」以降を読む */
  U.parseQuery = function (qs) {
    var out = {};
    if (!qs) return out;
    qs.replace(/^\?/, '').split('&').forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf('=');
      var k = i < 0 ? pair : pair.slice(0, i);
      var v = i < 0 ? '' : pair.slice(i + 1);
      try { out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); }
      catch (e) { out[k] = v; }
    });
    return out;
  };

  U.buildQuery = function (obj) {
    var parts = [];
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      if (v == null || v === '') return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.length ? '?' + parts.join('&') : '';
  };

  window.KOBUN = window.KOBUN || {};
  window.KOBUN.util = U;
})();
