/* =====================================================================
 * js/view-works.js — 作品一覧（#/works）と作品詳細（#/work/:workId）
 * ---------------------------------------------------------------------
 * 作品ページの「収録語」は
 *     例文 tokens の wordId  ∪  data/workWords.js  ∪  passages.vocab の wordId
 * の和集合（計算は js/data-index.js の wordsByWork）。
 * ===================================================================== */
(function () {
  'use strict';

  var K = window.KOBUN;
  var U = K.util;
  var C = K.components;
  var el = U.el;

  /* ---------------------------------------------------------------
   * 作品一覧
   * ------------------------------------------------------------- */
  function renderList(params, query, container) {
    var section = el('section', { class: 'view view-works' }, [
      el('h1', { class: 'view-title', text: '作品' }),
      el('p', { class: 'view-lead', text: '作品ごとに、収録された文章・例文・単語をまとめて確認できます。' })
    ]);

    var grid = el('div', { class: 'work-grid' });
    K.index.works.forEach(function (w) {
      var words = K.index.wordsByWork.get(w.id) || [];
      var examples = K.index.examplesByWork.get(w.id) || [];
      var passages = K.index.passagesOfWork(w.id);
      grid.appendChild(el('a', { class: 'work-card', href: '#/work/' + w.id }, [
        el('h2', { class: 'work-card-title', text: w.title }),
        el('p', { class: 'work-card-meta muted', text: w.author + '　/　' + w.era + '　/　' + w.genre }),
        el('p', { class: 'work-card-summary', text: w.summary }),
        el('p', { class: 'work-card-stats' }, [
          passages.length ? el('span', { class: 'badge count', text: '文章 ' + passages.length }) : null,
          el('span', { class: 'badge count', text: '例文 ' + examples.length }),
          el('span', { class: 'badge count', text: '収録語 ' + words.length })
        ])
      ]));
    });
    section.appendChild(grid);
    container.appendChild(section);
  }

  /* ---------------------------------------------------------------
   * 作品詳細
   * ------------------------------------------------------------- */
  function renderDetail(params, query, container) {
    var work = K.index.getWork(params.workId);
    if (!work) {
      container.appendChild(el('div', { class: 'notice error' }, [
        el('h2', { text: '作品が見つかりません' }),
        el('p', { text: 'id = ' + params.workId + ' の作品はありません。' }),
        el('p', {}, [el('a', { href: '#/works', text: '作品一覧へ' })])
      ]));
      return;
    }

    var words = K.index.wordsByWork.get(work.id) || [];
    var examples = K.index.examplesByWork.get(work.id) || [];

    // 収録語の「由来」を分ける（例文 / 文章 / 手動タグ）
    var inExample = new Set();
    examples.forEach(function (ex) {
      (ex.tokens || []).forEach(function (t) { if (t.wordId != null) inExample.add(t.wordId); });
    });
    var inPassage = new Set();
    K.index.passagesOfWork(work.id).forEach(function (p) {
      (p.vocab || []).forEach(function (v) { if (v.wordId != null) inPassage.add(v.wordId); });
    });

    var section = el('section', { class: 'view view-work' }, [
      el('div', { class: 'crumbs' }, [el('a', { href: '#/works', text: '← 作品一覧' })]),
      el('header', { class: 'work-head' }, [
        el('h1', { class: 'view-title', text: work.title }),
        el('p', { class: 'work-meta muted', text: work.author + '　/　' + work.era + '　/　' + work.genre }),
        el('p', { class: 'work-summary', text: work.summary })
      ])
    ]);

    /* --- 文章（教材） --- */
    var passages = K.index.passagesOfWork(work.id);
    if (passages.length) {
      var pgrid = el('div', { class: 'passage-grid' });
      passages.forEach(function (p) {
        var deck = K.index.deckOfPassage(p.id);
        var psum = K.store.summaryOf(deck.map(function (x) { return x.id; }));
        pgrid.appendChild(el('a', { class: 'passage-card', href: '#/passage/' + p.id }, [
          el('div', { class: 'passage-card-head' },
            [el('span', { class: 'passage-card-title', text: p.title })].concat(
              (p.grade || []).map(function (g) { return el('span', { class: 'badge grade', text: g }); })
            )),
          p.section ? el('p', { class: 'passage-card-section muted', text: p.section }) : null,
          el('p', { class: 'passage-card-lead', text: p.paragraphs[0].text.slice(0, 40) + (p.paragraphs[0].text.length > 40 ? '…' : '') }),
          el('p', { class: 'passage-card-stats' }, [
            el('span', { class: 'badge count', text: '段落 ' + p.paragraphs.length }),
            el('span', { class: 'badge count', text: '語 ' + psum.total }),
            el('span', { class: 'badge count', text: '覚えた ' + psum.known + ' / ' + psum.total })
          ])
        ]));
      });
      section.appendChild(el('div', { class: 'card' }, [
        el('h2', { class: 'card-title' }, [
          '文章（教材）', el('span', { class: 'muted small', text: '（' + passages.length + '）' })
        ]),
        el('p', { class: 'muted small', text: '原文と現代語訳、その文章に出てくる語をまとめて読めます。' }),
        pgrid
      ]));
    }

    /* --- 例文 --- */
    var exCard = el('div', { class: 'card' }, [
      el('h2', { class: 'card-title' }, ['例文', el('span', { class: 'muted small', text: '（' + examples.length + '）' })])
    ]);
    if (examples.length === 0) {
      exCard.appendChild(el('p', { class: 'muted', text: 'まだ例文がありません。data/examples.js に workId: "' + work.id + '" の例文を足してください。' }));
    } else {
      examples.forEach(function (ex) { exCard.appendChild(C.exampleCard(ex, { showWork: false })); });
    }
    section.appendChild(exCard);

    /* --- 収録語 --- */
    var listWrap = el('div', { class: 'word-list' });
    words.forEach(function (w) {
      var row = C.wordRow(w);
      var head = row.querySelector('.word-row-head');
      if (inExample.has(w.id)) {
        head.appendChild(el('span', {
          class: 'badge src src-example', text: '例文', title: 'この作品の例文（data/examples.js）に出てくる語'
        }));
      }
      if (inPassage.has(w.id)) {
        head.appendChild(el('span', {
          class: 'badge src src-passage', text: '文章', title: 'この作品の文章（data/passages.js）に出てくる語'
        }));
      }
      if (!inExample.has(w.id) && !inPassage.has(w.id)) {
        head.appendChild(el('span', {
          class: 'badge src src-tag', text: 'タグ', title: 'data/workWords.js で手動タグ付けした語'
        }));
      }
      var note = K.index.workWordNote.get(work.id + '/' + w.id);
      if (note) row.appendChild(el('div', { class: 'word-row-note muted', text: note }));
      listWrap.appendChild(row);
    });

    var qs = U.buildQuery({ work: work.id });
    section.appendChild(el('div', { class: 'card' }, [
      el('h2', { class: 'card-title' }, ['収録語', el('span', { class: 'muted small', text: '（' + words.length + '）' })]),
      el('p', { class: 'muted small', text: '「例文 tokens の wordId」「data/passages.js の文章の語」「data/workWords.js の手動タグ」の和集合です。' }),
      el('div', { class: 'deck-links' }, [
        el('a', { class: 'btn btn-primary', href: '#/study' + qs, text: 'この作品の単語で学習' }),
        el('a', { class: 'btn', href: '#/quiz' + qs, text: 'この作品の単語でクイズ' }),
        el('a', { class: 'btn btn-ghost', href: '#/words' + qs, text: '一覧で見る' })
      ]),
      words.length ? listWrap : el('p', { class: 'muted', text: 'まだ紐づいた語がありません。' })
    ]));

    container.appendChild(section);
  }

  K.views = K.views || {};
  K.views.works = { render: renderList };
  K.views.work = { render: renderDetail };
})();
