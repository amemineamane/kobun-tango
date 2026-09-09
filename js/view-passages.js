/* =====================================================================
 * js/view-passages.js — 教科書（#/textbook）と文章詳細（#/passage/:id）
 * ---------------------------------------------------------------------
 * 「教科書に出てくる作品と文章の訳、そしてその文章に出てくる単語」を
 * 1 画面で扱うための画面。データは data/passages.js。
 *
 * #/textbook は **作品ごとにまとまった文章（教材）の一覧**。
 * かつて #/works（作品一覧）と #/passages（文章一覧）に分かれていた入口を
 * 1 本にまとめたもので、旧 URL は router.js が #/textbook に転送する。
 *   作品名をタップ → 作品ページ（#/work/:workId、js/view-works.js）
 *   文章名をタップ → 本文ページ（#/passage/:id、このファイルの下半分）
 *
 * 文章詳細でできること:
 *   ・原文と現代語訳を段落ごとに対応させて読む（上下／横並び、訳の表示切替）
 *   ・原文中の重要語をタップして語義を見る（C.passageLine → C.tokenPopup）
 *   ・この文章の単語一覧（330 語は詳細へリンク、文章固有語はその場で語義）
 *   ・「この文章の単語で学習／クイズ」→ #/study?passage=<id> / #/quiz?passage=<id>
 *
 * 表示の設定（訳の表示・レイアウト）は store の prefs に覚えさせる。
 * ===================================================================== */
(function () {
  'use strict';

  var K = window.KOBUN;
  var U = K.util;
  var C = K.components;
  var el = U.el;

  /** その文章のデッキの進捗 { total, known, weak, newCount } */
  function progressOf(passage) {
    var deck = K.index.deckOfPassage(passage.id);
    return K.store.summaryOf(deck.map(function (w) { return w.id; }));
  }

  function gradeBadges(passage) {
    return (passage.grade || []).map(function (g) {
      return el('span', { class: 'badge grade', text: g });
    });
  }

  /** 文章カード 1 枚（教科書一覧と作品ページで同じ見た目にする） */
  function passageCard(p) {
    var sum = progressOf(p);
    var lead = p.paragraphs.length ? p.paragraphs[0].text : '';
    return el('a', { class: 'passage-card', href: '#/passage/' + p.id }, [
      el('div', { class: 'passage-card-head' },
        [el('span', { class: 'passage-card-title', text: p.title })].concat(gradeBadges(p))),
      p.section ? el('p', { class: 'passage-card-section muted', text: p.section }) : null,
      el('p', { class: 'passage-card-lead', text: lead.slice(0, 40) + (lead.length > 40 ? '…' : '') }),
      el('p', { class: 'passage-card-stats' }, [
        el('span', { class: 'badge count', text: '段落 ' + p.paragraphs.length }),
        el('span', { class: 'badge count', text: '語 ' + sum.total }),
        el('span', {
          class: 'badge count' + (sum.total && sum.known === sum.total ? ' count-done' : ''),
          text: '覚えた ' + sum.known + ' / ' + sum.total
        })
      ])
    ]);
  }

  /* ---------------------------------------------------------------
   * 教科書（#/textbook）
   * 作品ごとに文章（教材）をまとめて並べる。作品の見出しは作品ページへの
   * リンクを兼ねるので、「作品から入る」「文章から入る」が 1 画面で済む。
   * 文章がまだ無い作品（例文・作品タグだけの作品）も、収録語の数を添えて出す。
   * ------------------------------------------------------------- */
  function renderTextbook(params, query, container) {
    var state = Object.assign({}, query);

    var section = el('section', { class: 'view view-textbook' }, [
      el('h1', { class: 'view-title', text: '教科書' }),
      el('p', { class: 'view-lead', text: '教科書に定番として載る古典教材を、作品ごとにまとめました。文章を選ぶと原文と現代語訳が読め、「その文章に出てくる単語だけ」で学習・クイズができます。作品名からは、その作品の収録語や例文をまとめた作品ページへ進めます。' })
    ]);

    var listWrap = el('div');
    var filterWrap = el('div', { class: 'filter-bar' });

    function drawFilters() {
      U.clear(filterWrap);
      var sel = el('select', {
        id: 'f-grade',
        onChange: function () { K.router.setQuery({ grade: sel.value }); }
      });
      [{ value: '', label: 'すべて' }].concat(K.index.grades.map(function (g) {
        return { value: g, label: g };
      })).forEach(function (o) {
        var op = el('option', { value: o.value, text: o.label });
        if (o.value === (state.grade || '')) op.selected = true;
        sel.appendChild(op);
      });
      filterWrap.appendChild(el('label', { class: 'field', for: 'f-grade' }, [
        el('span', { class: 'field-label', text: '学年の目安' }),
        sel
      ]));
      if (state.grade) {
        filterWrap.appendChild(el('button', {
          type: 'button', class: 'btn btn-ghost btn-clear', text: '条件をクリア',
          onClick: function () { K.router.setQuery({ grade: '' }); }
        }));
      }
    }

    function drawList() {
      U.clear(listWrap);
      var shown = 0;

      K.index.works.forEach(function (work) {
        var all = K.index.passagesOfWork(work.id);
        var list = all.filter(function (p) {
          if (!state.grade) return true;
          return (p.grade || []).indexOf(state.grade) >= 0;
        });
        // 学年でしぼっているときは、該当する文章がある作品だけを出す。
        // しぼっていないときは、文章がまだ無い作品も収録語つきで出す。
        if (!list.length && state.grade) return;
        shown += list.length;

        var words = K.index.wordsByWork.get(work.id) || [];
        var meta = [work.author, work.era, work.genre].filter(Boolean).join('　/　');

        var head = el('div', { class: 'textbook-work-head' }, [
          el('h2', { class: 'card-title textbook-work-title' }, [
            el('a', { class: 'textbook-work-link', href: '#/work/' + work.id, text: work.title }),
            el('span', { class: 'textbook-work-go muted small', text: '作品ページ →' })
          ]),
          meta ? el('p', { class: 'textbook-work-meta muted small', text: meta }) : null,
          el('p', { class: 'textbook-work-stats' }, [
            el('span', { class: 'badge count', text: list.length ? '文章 ' + list.length : '文章 なし' }),
            el('span', { class: 'badge count', text: '収録語 ' + words.length })
          ])
        ]);

        var body;
        if (list.length) {
          body = el('div', { class: 'passage-grid' });
          list.forEach(function (p) { body.appendChild(passageCard(p)); });
        } else {
          body = el('p', { class: 'textbook-empty muted' }, [
            '文章はまだありません／収録語 ' + words.length + ' 語　',
            el('a', { href: '#/work/' + work.id, text: '作品ページで見る →' })
          ]);
        }

        listWrap.appendChild(el('div', { class: 'card textbook-work' }, [head, body]));
      });

      if (shown === 0) {
        listWrap.appendChild(el('div', { class: 'notice' }, [
          el('p', { text: '条件に合う文章がありません。' })
        ]));
      }
    }

    section.appendChild(filterWrap);
    section.appendChild(listWrap);
    container.appendChild(section);

    drawFilters();
    drawList();
  }

  /* ---------------------------------------------------------------
   * 文章詳細
   * ------------------------------------------------------------- */
  function renderDetail(params, query, container) {
    var passage = K.index.getPassage(params.id);
    if (!passage) {
      container.appendChild(el('div', { class: 'notice error' }, [
        el('h2', { text: '文章が見つかりません' }),
        el('p', { text: 'id = ' + params.id + ' の文章はありません。' }),
        el('p', {}, [el('a', { href: '#/textbook', text: '教科書へ' })])
      ]));
      return;
    }

    var work = K.index.getWork(passage.workId);

    // ホームの「続きから」用に、最後に開いた文章を覚えておく
    K.store.setRecent('passage', {
      id: passage.id,
      title: passage.title,
      workTitle: work ? work.title : ''
    });

    var entries = K.index.entriesOfPassage(passage.id);
    var deck = K.index.deckOfPassage(passage.id);

    var showTranslation = K.store.getPref('passageTranslation', true);
    var layout = K.store.getPref('passageLayout', 'stack'); // 'stack' | 'side'

    var section = el('section', { class: 'view view-passage' });

    /* --- パンくず・見出し ------------------------------------------ */
    section.appendChild(el('div', { class: 'crumbs' }, [
      el('a', { href: '#/textbook', text: '← 教科書' }),
      work ? el('span', { class: 'muted', text: '　/　' }) : null,
      work ? el('a', { href: '#/work/' + work.id, text: work.title }) : null
    ]));

    section.appendChild(el('header', { class: 'passage-head' }, [
      el('div', { class: 'word-head-badges' },
        (work ? [el('span', { class: 'badge pos', text: work.genre })] : []).concat(gradeBadges(passage))),
      el('h1', { class: 'view-title passage-title', text: passage.title }),
      el('p', { class: 'muted', text: (work ? work.title + '　/　' + work.author : '') + (passage.section ? '　/　' + passage.section : '') })
    ]));

    /* --- 本文 ------------------------------------------------------ */
    var bodyWrap = el('div', { class: 'card' });
    var controls = el('div', { class: 'passage-controls' });
    var paras = el('div');

    function drawBody() {
      U.clear(paras);
      paras.className = 'passage-body layout-' + layout + (showTranslation ? '' : ' no-translation');
      passage.paragraphs.forEach(function (p) {
        paras.appendChild(el('div', { class: 'passage-para' }, [
          el('div', { class: 'passage-orig' }, [C.passageLine(entries, p.text)]),
          showTranslation
            ? el('div', { class: 'passage-trans' }, [el('p', { text: p.translation || '' })])
            : null
        ]));
      });
    }

    function drawControls() {
      U.clear(controls);
      controls.appendChild(el('button', {
        type: 'button',
        class: 'btn btn-ghost',
        text: showTranslation ? '訳を隠す' : '訳を表示',
        onClick: function () {
          showTranslation = !showTranslation;
          K.store.setPref('passageTranslation', showTranslation);
          drawControls(); drawBody();
        }
      }));
      controls.appendChild(el('button', {
        type: 'button',
        class: 'btn btn-ghost',
        text: layout === 'side' ? '上下に並べる' : '横に並べる',
        onClick: function () {
          layout = layout === 'side' ? 'stack' : 'side';
          K.store.setPref('passageLayout', layout);
          drawControls(); drawBody();
        }
      }));
    }

    /* 原文の下線は 2 種類あり、説明が無いと区別できないので凡例を出す */
    var legend = el('div', { class: 'passage-legend' }, [
      el('span', { class: 'legend-item' }, [
        el('span', { class: 'legend-sample is-word', text: '実線の語' }),
        el('span', { text: '重要 330 語（タップで語義・詳細ページへ）' })
      ]),
      el('span', { class: 'legend-item' }, [
        el('span', { class: 'legend-sample is-extra', text: '点線の語' }),
        el('span', { text: 'この文章だけの語（タップで語義）' })
      ])
    ]);

    bodyWrap.appendChild(el('h2', { class: 'card-title', text: '原文と現代語訳' }));
    bodyWrap.appendChild(controls);
    bodyWrap.appendChild(legend);
    bodyWrap.appendChild(paras);
    if (passage.note) {
      bodyWrap.appendChild(el('p', {
        class: 'example-note' + (/要確認/.test(passage.note) ? ' needs-check' : ''),
        text: passage.note
      }));
    }
    section.appendChild(bodyWrap);
    drawControls();
    drawBody();

    /* --- この文章の単語 -------------------------------------------- */
    var sum = K.store.summaryOf(deck.map(function (w) { return w.id; }));
    var qs = U.buildQuery({ passage: passage.id });

    var listWrap = el('div', { class: 'word-list' });
    entries.forEach(function (e) {
      var w = e.word || e.passageWord;
      if (!w) return;
      var row = C.wordRow(w);
      var head = row.querySelector('.word-row-head');
      head.appendChild(el('span', {
        class: 'badge src ' + (e.word ? 'src-example' : 'src-tag'),
        text: e.word ? '330語' : '文章語',
        title: e.word ? 'data/words.js の 330 語。単語詳細ページがあります' : 'この文章の中だけで覚える語（脚注語）'
      }));
      // 本文での形と、この文脈での語義
      var lines = [];
      if (e.word) {
        lines.push('本文の形：' + e.surface + '　→　この文脈では「' + e.meaning + '」');
      }
      if (e.note) lines.push(e.note);
      lines.forEach(function (t) {
        row.appendChild(el('div', {
          class: 'word-row-note muted' + (/要確認/.test(t) ? ' needs-check' : ''),
          text: t
        }));
      });
      listWrap.appendChild(row);
    });

    section.appendChild(el('div', { class: 'card' }, [
      el('h2', { class: 'card-title' }, [
        'この文章の単語',
        el('span', { class: 'muted small', text: '（' + deck.length + '）' })
      ]),
      el('p', { class: 'result-count' }, [
        el('span', { class: 'count-sub muted', text: '覚えた ' + sum.known + '・苦手 ' + sum.weak + '・未学習 ' + sum.newCount })
      ]),
      el('div', { class: 'deck-links' }, [
        el('a', { class: 'btn btn-primary', href: '#/study' + qs, text: 'この文章の単語で学習' }),
        el('a', { class: 'btn', href: '#/quiz' + qs, text: 'この文章の単語でクイズ' }),
        el('a', { class: 'btn btn-ghost', href: '#/words' + qs, text: '一覧で見る' })
      ]),
      deck.length ? listWrap : el('p', { class: 'muted', text: 'まだ語が登録されていません。data/passages.js の vocab に足してください。' })
    ]));

    /* --- 品詞分解つき例文 ------------------------------------------ */
    var exs = (passage.exampleIds || [])
      .map(function (id) { return K.index.exampleById.get(id); })
      .filter(Boolean);
    if (exs.length) {
      var exCard = el('div', { class: 'card' }, [
        el('h2', { class: 'card-title' }, [
          '品詞分解つきで読む',
          el('span', { class: 'muted small', text: '（' + exs.length + '）' })
        ]),
        el('p', { class: 'muted small', text: 'この文章のうち、data/examples.js に品詞分解がある箇所です。' })
      ]);
      exs.forEach(function (ex) { exCard.appendChild(C.exampleCard(ex, { showWork: false })); });
      section.appendChild(exCard);
    }

    /* --- 共有 ------------------------------------------------------ */
    section.appendChild(C.shareButtons({
      label: 'この文章を共有',
      text: (work ? work.title : '') + '『' + passage.title + '』を原文と現代語訳で読む｜古文単語帳',
      url: C.absUrl('#/passage/' + passage.id)
    }));

    /* --- 前後の文章 ------------------------------------------------ */
    var all = K.index.passages;
    var pos = all.indexOf(passage);
    var prev = pos > 0 ? all[pos - 1] : null;
    var next = pos >= 0 && pos < all.length - 1 ? all[pos + 1] : null;
    section.appendChild(el('nav', { class: 'prev-next' }, [
      prev ? el('a', { class: 'pn pn-prev', href: '#/passage/' + prev.id }, [
        el('span', { class: 'pn-label muted', text: '← 前の文章' }),
        el('span', { class: 'pn-kana', text: prev.title })
      ]) : el('span', { class: 'pn pn-empty' }),
      next ? el('a', { class: 'pn pn-next', href: '#/passage/' + next.id }, [
        el('span', { class: 'pn-label muted', text: '次の文章 →' }),
        el('span', { class: 'pn-kana', text: next.title })
      ]) : el('span', { class: 'pn pn-empty' })
    ]));

    container.appendChild(section);
  }

  K.views = K.views || {};
  K.views.textbook = { render: renderTextbook };
  K.views.passage = { render: renderDetail };
})();
