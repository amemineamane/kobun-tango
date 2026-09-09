/* =====================================================================
 * js/view-words.js — 単語一覧画面（#/words）
 * ---------------------------------------------------------------------
 * フィルタ条件は URL のクエリに持たせる（#/words?level=S&pos=敬語）。
 * こうしておくと「S ランクの敬語だけ」の画面をブックマークできるし、
 * 学習・クイズ画面へ同じ条件のまま渡せる。
 *
 * ?passage=<id> を付けると、母集団が 330 語ではなく「その文章に出てくる語」
 * になる（330 語に無い文章固有語も混ざる）。切り替えは C.deckSource が担当。
 *
 * 検索ボックスは 1 文字ごとに画面全体を作り直すとフォーカスが飛ぶので、
 * URL は replaceQuery で静かに書き換え、リスト部分だけ差し替えている。
 * ===================================================================== */
(function () {
  'use strict';

  var K = window.KOBUN;
  var U = K.util;
  var C = K.components;
  var el = U.el;

  function render(params, query, container) {
    var state = Object.assign({ sort: 'kana' }, query);

    var listWrap = el('div', { class: 'word-list' });
    var countEl = el('p', { class: 'result-count' });
    var filterWrap = el('div');

    function drawList() {
      // ?passage= があれば母集団はその文章の語（文章固有語を含む）になる
      var source = C.deckSource(state);
      var words = C.applyFilters(source, state);
      U.clear(listWrap);
      U.clear(countEl);

      countEl.appendChild(el('span', { class: 'count-main', text: words.length + ' 語' }));
      if (state.passage) {
        var p = K.index.getPassage(state.passage);
        var psum = K.store.summaryOf(source.map(function (w) { return w.id; }));
        countEl.appendChild(el('span', {
          class: 'count-sub muted',
          text: '（' + (p ? '「' + p.title + '」の ' : '') + source.length + ' 語｜覚えた ' + psum.known + '・苦手 ' + psum.weak + '・未学習 ' + psum.newCount + '）'
        }));
      } else {
        var sum = K.store.summary(K.index.words.length);
        countEl.appendChild(el('span', {
          class: 'count-sub muted',
          text: '（全 ' + K.index.words.length + ' 語｜覚えた ' + sum.known + '・苦手 ' + sum.weak + '・未学習 ' + sum.newCount + '）'
        }));
      }

      if (words.length === 0) {
        listWrap.appendChild(el('div', { class: 'notice' }, [
          el('p', { text: '条件に合う語がありません。' }),
          el('p', { class: 'muted', text: '検索は かな・ローマ字（tamafu）・漢字・意味 のいずれでも引けます。' }),
          el('p', {}, [
            el('button', {
              type: 'button', class: 'btn', text: '条件をクリア',
              onClick: function () {
                onChange({ q: '', level: '', pos: '', row: '', work: '', passage: '', status: '' });
              }
            })
          ])
        ]));
        return;
      }

      // 300 語超を一度に組み立てても十分速いが、DocumentFragment でまとめて入れる
      var frag = document.createDocumentFragment();
      words.forEach(function (w) { frag.appendChild(C.wordRow(w)); });
      listWrap.appendChild(frag);

      // 現在の条件を学習・クイズに引き継ぐリンクを更新
      updateDeckLinks(words.length);
    }

    var deckLinks = el('div', { class: 'deck-links' });
    function updateDeckLinks(n) {
      U.clear(deckLinks);
      var qs = U.buildQuery({
        q: state.q, level: state.level, pos: state.pos, row: state.row,
        work: state.work, passage: state.passage, status: state.status, sort: state.sort
      });
      deckLinks.appendChild(el('a', { class: 'btn btn-primary', href: '#/study' + qs, text: 'この ' + n + ' 語で学習' }));
      deckLinks.appendChild(el('a', { class: 'btn', href: '#/quiz' + qs, text: 'この条件でクイズ' }));
    }

    function drawFilters() {
      U.clear(filterWrap);
      filterWrap.appendChild(C.filterBar(state, onChange, {}));
    }

    /**
     * @param patch  変わった項目
     * @param typing true なら検索欄の入力中（フィルタ UI を作り直さない）
     */
    function onChange(patch, typing) {
      Object.assign(state, patch);
      Object.keys(state).forEach(function (k) { if (state[k] === '') delete state[k]; });
      if (!state.sort) state.sort = 'kana';
      K.router.replaceQuery(patch);
      if (!typing) drawFilters();
      drawList();
    }

    container.appendChild(el('section', { class: 'view view-words' }, [
      el('h1', { class: 'view-title', text: '単語一覧' }),
      el('p', { class: 'view-lead' }, [
        '入試向けの古文単語 330 語。かな・ローマ字（tamafu）・漢字・意味のどれでも引けます。',
        '絞り込んだ条件は、そのまま ',
        el('b', { text: '学習' }), ' と ', el('b', { text: 'クイズ' }), ' に引き継げます。'
      ]),
      filterWrap,
      countEl,
      deckLinks,
      listWrap
    ]));

    drawFilters();
    drawList();
  }

  K.views = K.views || {};
  K.views.words = { render: render };
})();
