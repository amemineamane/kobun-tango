/* =====================================================================
 * js/view-grammar.js — 古典文法（#/grammar）
 * ---------------------------------------------------------------------
 * 1 つの view で 4 つの画面を描く（ルーターのパターンは 3 本）。
 *
 *   #/grammar                       一覧（カテゴリのカード＋助動詞の接続別グループ）
 *   #/grammar/drill                 文法ドリル（4 択。品詞分解データから自動生成）
 *   #/grammar/<category>            カテゴリ（aux / particle / keigo / conj / ident）
 *   #/grammar/<category>/<id>       詳細（助動詞・助詞・敬語・識別）
 *
 * 【データを持たない】
 *   文法の内容は data/grammar.js、用例は data/tokens/*.js（教材の品詞分解）。
 *   この画面は KOBUN.index の grammar* メソッドしか読まない。
 *   教材が増えれば用例もドリルの問題も自動で増える。
 *
 * 【用例の出し方】
 *   index.grammarExamples(entry) が match 規則でコーパスを走査し、
 *   「該当トークンを含む 1 文」を最大 20 件（文章ごとに分散）返す。
 *   画面ではその文を描き、該当語を強調して、意味ラベル（m）と活用形（f）を添える。
 *   タップするとその文章ページへ飛ぶ。
 *
 * 【ドリル】
 *   出題は 4 種類。どれも「コーパスに実在するトークン」から作るので、
 *   作った覚えのない問題が出ることはない（答えは m / f / p が根拠）。
 *     meaning … 意味当て  （この『なり』は？ → 断定／伝聞推定／…）
 *     form    … 活用形当て（この『けれ』は何形？）
 *     ident   … 識別      （この『ぬ』は完了か打消か）
 *     keigo   … 敬語の種類（この『たまふ』は尊敬か謙譲か）
 *   誤答は **同じ語の他の意味・他の活用形** から取る（足りないときだけ補う）。
 *   履歴は kobun.v1.grammar（store.pushGrammarResult）。
 *
 * 【クエリ】
 *   #/grammar/drill?kind=meaning&cat=aux&aux=nu&count=10
 *     kind  … 出題の種類（省略＝混ぜて出す）
 *     cat   … 出題元のカテゴリ（aux / particle / keigo / ident）
 *     aux   … 助動詞・助詞などのエントリ id（1 語だけで出題する）
 *     count … 1 セットの問題数（既定 10）
 * ===================================================================== */
(function () {
  'use strict';

  var K = window.KOBUN;
  var U = K.util;
  var C = K.components;
  var el = U.el;

  var FORMS = ['未然形', '連用形', '終止形', '連体形', '已然形', '命令形'];
  var FORM_HEAD = ['未然形', '連用形', '終止形', '連体形', '已然形', '命令形'];

  var DRILL_KINDS = [
    { key: 'meaning', label: '意味当て', desc: '原文の助動詞・助詞が、どの意味で使われているかを答えます。' },
    { key: 'form', label: '活用形当て', desc: 'この形が未然形〜命令形のどれかを答えます。' },
    { key: 'ident', label: '識別', desc: '「ぬ」「なり」「に」などが、どの語のどの形かを答えます。' },
    { key: 'keigo', label: '敬語の種類', desc: '尊敬・謙譲・丁寧のどれかを答えます。' }
  ];

  /* ---------------------------------------------------------------
   * 小道具
   * ------------------------------------------------------------- */

  function entryName(e) {
    if (!e) return '';
    return e.name || e.word || e.title || e.id;
  }

  function grammarHref(e) {
    if (!e) return '#/grammar';
    return '#/grammar/' + e.category + '/' + encodeURIComponent(e.id);
  }

  function catHref(key) { return '#/grammar/' + key; }

  /** 活用表（6 列）。幅が足りない画面では .table-scroll の中で横に流れる */
  function conjTable(opts) {
    var head = el('tr', {}, [el('th', { text: opts.headLabel || '語' })].concat(
      FORM_HEAD.map(function (f) { return el('th', { text: f }); })
    ));
    var tbody = el('tbody');
    (opts.rows || []).forEach(function (r) {
      tbody.appendChild(el('tr', {}, [
        el('th', { class: 'conj-row-head', scope: 'row' }, [
          el('span', { class: 'conj-row-name', text: r.name }),
          r.sub ? el('span', { class: 'conj-row-sub muted', text: r.sub }) : null
        ])
      ].concat((r.table || []).map(function (v, i) {
        return el('td', {
          class: 'conj-cell' + (v === '○' ? ' is-none' : ''),
          text: v,
          'aria-label': FORM_HEAD[i] + '：' + (v === '○' ? 'なし' : v)
        });
      }))));
    });
    return el('div', { class: 'table-scroll' }, [
      el('table', { class: 'token-table conj-table' }, [el('thead', {}, [head]), tbody])
    ]);
  }

  /** 「〜」で強調した太字混じりの文（tips に ** で囲んだ強調を書ける） */
  function richText(s) {
    var wrap = el('span');
    String(s == null ? '' : s).split(/\*\*/).forEach(function (part, i) {
      if (!part) return;
      wrap.appendChild(i % 2 ? el('b', { text: part }) : document.createTextNode(part));
    });
    return wrap;
  }

  function tipsBlock(text, cls) {
    if (!text) return null;
    return el('p', { class: 'grammar-tips' + (cls ? ' ' + cls : '') }, [richText(text)]);
  }

  /* ---------------------------------------------------------------
   * 用例（コーパスから自動抽出）
   * ------------------------------------------------------------- */

  /**
   * 用例 1 件を描く。文全体を文章ページへのリンクにし、該当語だけ強調する。
   * @param ex index.grammarExamples() の 1 要素
   */
  function exampleRow(ex) {
    var work = K.index.getWork(ex.passage.workId);
    var textWrap = el('p', { class: 'grammar-ex-text', lang: 'ja' });
    ex.sentenceTokens.forEach(function (t, i) {
      var s = (t && t.s) || '';
      if (!s) return;
      if (i === ex.hitIndex) textWrap.appendChild(el('em', { class: 'grammar-ex-hit', text: s }));
      else textWrap.appendChild(document.createTextNode(s));
    });

    var meta = [];
    var label = K.index.grammarMeaningLabel(ex.token.m);
    if (label) meta.push(el('span', { class: 'badge grammar-label', text: label }));
    if (ex.token.f) meta.push(el('span', { class: 'grammar-ex-form', text: ex.token.f }));
    if (ex.token.c) meta.push(el('span', { class: 'grammar-ex-form muted', text: ex.token.c }));
    meta.push(el('span', { class: 'grammar-ex-src muted' }, [
      (work ? work.title : '') + '「' + ex.passage.title + '」',
      el('span', { class: 'grammar-ex-para', text: '第 ' + (ex.paraIndex + 1) + ' 段落' })
    ]));

    return el('a', {
      class: 'grammar-ex',
      href: '#/passage/' + encodeURIComponent(ex.passageId),
      title: '「' + ex.passage.title + '」を原文と現代語訳で読む'
    }, [textWrap, el('p', { class: 'grammar-ex-meta' }, meta)]);
  }

  /**
   * 用例のブロック。先頭 6 件は開いたまま、残りは <details> に畳む。
   * @param entry 文法エントリ（match を持つもの）
   * @param opts  { title, empty, limit, match }
   */
  function examplesBlock(entry, opts) {
    opts = opts || {};
    var list = K.index.grammarExamples(entry, { limit: opts.limit || 20, match: opts.match });
    var wrap = el('div', { class: 'grammar-examples' });
    if (!list.length) {
      wrap.appendChild(el('p', {
        class: 'muted small',
        text: opts.empty || '収録している教材の中には、この用法の例がまだありません（教材を足すと自動で出ます）。'
      }));
      return wrap;
    }
    var head = list.slice(0, 6);
    var rest = list.slice(6);
    head.forEach(function (ex) { wrap.appendChild(exampleRow(ex)); });
    if (rest.length) {
      var more = el('details', { class: 'token-details grammar-ex-more' }, [
        el('summary', { text: 'ほかの用例を見る（' + rest.length + ' 件）' })
      ]);
      rest.forEach(function (ex) { more.appendChild(exampleRow(ex)); });
      wrap.appendChild(more);
    }
    return wrap;
  }

  /* ---------------------------------------------------------------
   * 一覧（#/grammar）
   * ------------------------------------------------------------- */

  /** ドリルの履歴から「最近の正答率」を出す（履歴が無ければ null） */
  function recentDrillStat() {
    var log = (K.store.getGrammarLog && K.store.getGrammarLog()) || [];
    if (!log.length) return null;
    var recent = log.slice(0, 5);
    var total = 0, correct = 0;
    recent.forEach(function (r) { total += r.total || 0; correct += r.correct || 0; });
    if (!total) return null;
    return { sets: recent.length, total: total, correct: correct, pct: Math.round(correct / total * 100), last: log[0] };
  }

  function drillCard() {
    var card = el('div', { class: 'card grammar-drill-card' }, [
      el('h2', { class: 'card-title', text: '文法ドリル' }),
      el('p', { text: '教材の品詞分解から 4 択問題を自動で作ります。1 セット 10 問。' })
    ]);

    var stat = recentDrillStat();
    if (stat) {
      card.appendChild(el('div', { class: 'progress score-bar' }, [
        el('div', { class: 'progress-fill', style: { width: stat.pct + '%' } })
      ]));
      card.appendChild(el('p', { class: 'grammar-recent' }, [
        '最近の正答率　',
        el('b', { text: stat.pct + '%' }),
        el('span', { class: 'muted', text: '（直近 ' + stat.sets + ' セット・' + stat.correct + ' / ' + stat.total + ' 問）' })
      ]));
    }

    card.appendChild(el('div', { class: 'deck-links' }, [
      el('a', { class: 'btn btn-primary', href: '#/grammar/drill', text: '10 問にちょうせん' })
    ]));
    var kinds = el('div', { class: 'tile-list' });
    DRILL_KINDS.forEach(function (k) {
      kinds.appendChild(el('a', { class: 'tile', href: '#/grammar/drill?kind=' + k.key }, [
        el('span', { class: 'tile-title', text: k.label }),
        el('span', { class: 'tile-sub muted', text: k.desc })
      ]));
    });
    card.appendChild(kinds);
    return card;
  }

  function renderIndex(query, container) {
    var idx = K.index;
    var section = el('section', { class: 'view view-grammar' });

    section.appendChild(el('h1', { class: 'view-title', text: '古典文法' }));
    section.appendChild(el('p', { class: 'view-lead' }, [
      '助動詞・助詞・敬語・活用・識別を、',
      el('b', { text: '教材の原文から取った用例つき' }),
      ' で確かめられます。用例は教科書の文章 ' + idx.passages.length + ' 編の品詞分解から自動で集めているので、',
      '同じ語が実際にどう使われているかをそのまま読めます。'
    ]));

    /* --- カテゴリのカード -------------------------------------- */
    var grid = el('div', { class: 'entry-grid' });
    idx.grammarCategories.forEach(function (c) {
      grid.appendChild(el('a', { class: 'entry-card', href: catHref(c.key) }, [
        el('span', { class: 'entry-card-head' }, [
          el('span', { class: 'entry-card-title', text: c.label }),
          el('span', { class: 'entry-card-count', text: c.count + ' 項目' })
        ]),
        el('span', { class: 'entry-card-desc', text: c.desc })
      ]));
    });
    section.appendChild(el('div', { class: 'card' }, [
      el('h2', { class: 'card-title', text: '分野から選ぶ' }),
      grid
    ]));

    section.appendChild(drillCard());

    /* --- 助動詞（接続別） -------------------------------------- */
    var auxCard = el('div', { class: 'card' }, [
      el('h2', { class: 'card-title' }, [
        '助動詞',
        el('span', { class: 'muted small', text: '（' + idx.grammarList('aux').length + ' 語）' })
      ]),
      el('p', { class: 'muted small', text: '接続（上にどの活用形が来るか）でまとめてあります。接続を覚えると、同じ字面の語を見分けられます。' })
    ]);
    idx.grammarAuxGroups.forEach(function (g) {
      auxCard.appendChild(el('h3', { class: 'rel-type', text: g.label }));
      var list = el('div', { class: 'grammar-list' });
      g.items.forEach(function (a) { list.appendChild(grammarItem(a)); });
      auxCard.appendChild(list);
    });
    section.appendChild(auxCard);

    /* --- 識別（早見） ------------------------------------------ */
    var identCard = el('div', { class: 'card' }, [
      el('h2', { class: 'card-title' }, [
        '識別',
        el('span', { class: 'muted small', text: '（' + idx.grammarList('ident').length + ' 項目）' })
      ]),
      el('p', { class: 'muted small', text: '同じ字面で別の語になるもの。入試で直接問われるところです。' })
    ]);
    var identList = el('div', { class: 'chip-list' });
    idx.grammarList('ident').forEach(function (e) {
      identList.appendChild(el('a', { class: 'chip', href: grammarHref(e) }, [
        el('span', { class: 'chip-kana', text: e.title })
      ]));
    });
    identCard.appendChild(identList);
    section.appendChild(identCard);

    /* --- 助詞・敬語・活用への入口 ------------------------------ */
    var more = el('div', { class: 'card' }, [
      el('h2', { class: 'card-title', text: 'そのほか' }),
      el('div', { class: 'tile-list' }, [
        el('a', { class: 'tile', href: catHref('particle') }, [
          el('span', { class: 'tile-title', text: '助詞' }),
          el('span', { class: 'tile-sub muted', text: idx.grammarList('particle').length + ' 語＋係り結び' })
        ]),
        el('a', { class: 'tile', href: catHref('keigo') }, [
          el('span', { class: 'tile-title', text: '敬語' }),
          el('span', { class: 'tile-sub muted', text: idx.grammarList('keigo').length + ' 語' })
        ]),
        el('a', { class: 'tile', href: catHref('conj') }, [
          el('span', { class: 'tile-title', text: '活用' }),
          el('span', { class: 'tile-sub muted', text: '動詞 9 種・形容詞・形容動詞' })
        ])
      ])
    ]);
    section.appendChild(more);

    section.appendChild(el('p', { class: 'muted small', text: '文法の解説は高校古典文法（学校文法）の標準的な整理に拠っています。諸説のあるところは各ページに注記があります。' }));

    container.appendChild(section);
    if (K.analytics) K.analytics.event('grammar_view', { category: 'index', id: '' });
  }

  /** 一覧・カテゴリで使う 1 行（名前＋分類＋接続） */
  function grammarItem(e) {
    return el('a', { class: 'grammar-item', href: grammarHref(e) }, [
      el('span', { class: 'grammar-item-name', text: entryName(e) }),
      el('span', { class: 'grammar-item-kind', text: e.kind || '' }),
      e.attach ? el('span', { class: 'grammar-item-attach muted', text: e.attach }) : null
    ]);
  }

  /* ---------------------------------------------------------------
   * カテゴリ（#/grammar/<category>）
   * ------------------------------------------------------------- */

  function crumbs(trail) {
    var nav = el('nav', { class: 'crumbs', 'aria-label': 'パンくずリスト' });
    trail.forEach(function (t, i) {
      if (i) nav.appendChild(el('span', { class: 'muted', 'aria-hidden': 'true', text: '›' }));
      nav.appendChild(t.href
        ? el('a', { href: t.href, text: t.label })
        : el('span', { 'aria-current': 'page', text: t.label }));
    });
    return nav;
  }

  function renderCategory(key, query, container) {
    var idx = K.index;
    var cat = idx.grammarCategory(key);
    if (!cat) { notFound(container, 'カテゴリ「' + key + '」はありません。'); return; }

    var section = el('section', { class: 'view view-grammar' });
    section.appendChild(crumbs([
      { label: '← 文法', href: '#/grammar' },
      { label: cat.label }
    ]));
    section.appendChild(el('h1', { class: 'view-title', text: cat.label }));
    section.appendChild(el('p', { class: 'view-lead', text: cat.desc }));

    if (key === 'aux') {
      idx.grammarAuxGroups.forEach(function (g) {
        var card = el('div', { class: 'card' }, [el('h2', { class: 'card-title', text: g.label })]);
        var list = el('div', { class: 'grammar-list' });
        g.items.forEach(function (a) { list.appendChild(grammarItem(a)); });
        card.appendChild(list);
        section.appendChild(card);
      });
      // 助動詞の活用表を 1 枚にまとめたもの（一覧で見比べられるように）
      section.appendChild(el('div', { class: 'card' }, [
        el('h2', { class: 'card-title', text: '助動詞の活用表（まとめ）' }),
        el('p', { class: 'muted small', text: '「○」はその活用形が無いことを表します。2 つ形があるものは「／」で並べています。' }),
        conjTable({
          headLabel: '助動詞',
          rows: idx.grammarList('aux').map(function (a) {
            return { name: a.name, sub: a.conj, table: a.table };
          })
        })
      ]));
    } else if (key === 'particle') {
      idx.grammarParticleGroups.forEach(function (g) {
        var card = el('div', { class: 'card' }, [el('h2', { class: 'card-title', text: g.label })]);
        var list = el('div', { class: 'grammar-list' });
        g.items.forEach(function (p) { list.appendChild(grammarItem(p)); });
        card.appendChild(list);
        section.appendChild(card);
      });
      section.appendChild(kakariCard());
    } else if (key === 'keigo') {
      section.appendChild(keigoCard());
    } else if (key === 'conj') {
      section.appendChild(conjugationCards());
    } else if (key === 'ident') {
      var card = el('div', { class: 'card' }, [
        el('h2', { class: 'card-title', text: '識別の項目' }),
        el('p', { class: 'muted small', text: '各ページに「どの場合か」の見分け方と、教材から取った用例があります。' })
      ]);
      var ilist = el('div', { class: 'grammar-list' });
      idx.grammarList('ident').forEach(function (e) {
        ilist.appendChild(el('a', { class: 'grammar-item', href: grammarHref(e) }, [
          el('span', { class: 'grammar-item-name', text: e.title }),
          el('span', { class: 'grammar-item-kind', text: e.cases.length + ' 通り' })
        ]));
      });
      card.appendChild(ilist);
      section.appendChild(card);
    }

    section.appendChild(el('div', { class: 'deck-links' }, [
      el('a', {
        class: 'btn btn-primary',
        href: '#/grammar/drill' + (key === 'conj' ? '?kind=form' : '?cat=' + key),
        text: cat.label + 'のドリルに挑戦'
      }),
      el('a', { class: 'btn btn-ghost', href: '#/grammar', text: '← 文法のトップへ' })
    ]));

    container.appendChild(section);
    if (K.analytics) K.analytics.event('grammar_view', { category: key, id: '' });
  }

  /* --- 係り結びの表 ---------------------------------------------- */
  function kakariCard() {
    var kk = K.index.grammarKakari;
    if (!kk) return null;
    var tbody = el('tbody');
    (kk.rows || []).forEach(function (r) {
      tbody.appendChild(el('tr', {}, [
        el('th', { class: 'conj-row-head', scope: 'row', text: r.particle }),
        el('td', { text: r.meaning }),
        el('td', {}, [el('b', { text: r.end })]),
        el('td', { class: 'td-meaning', text: r.note || '' })
      ]));
    });
    var card = el('div', { class: 'card' }, [
      el('h2', { class: 'card-title', text: '係り結び' }),
      el('p', {}, [richText(kk.intro)]),
      el('div', { class: 'table-scroll' }, [
        el('table', { class: 'token-table kakari-table' }, [
          el('thead', {}, [el('tr', {}, [
            el('th', { text: '係助詞' }), el('th', { text: '意味' }),
            el('th', { text: '結び' }), el('th', { text: 'メモ' })
          ])]),
          tbody
        ])
      ])
    ]);
    var ul = el('ul', { class: 'help-list' });
    (kk.notes || []).forEach(function (n) { ul.appendChild(el('li', {}, [richText(n)])); });
    card.appendChild(ul);
    return card;
  }

  /* --- 敬語の表 -------------------------------------------------- */
  function keigoCard() {
    var idx = K.index;
    var wrap = el('div');
    wrap.appendChild(el('div', { class: 'card' }, [
      el('h2', { class: 'card-title', text: '敬語の 3 種類' }),
      el('p', {}, [richText(idx.grammarKeigoIntro)]),
      el('div', { class: 'level-legend' }, idx.grammarKeigoGroups.map(function (g) {
        return el('span', { class: 'level-legend-item' }, [
          el('span', { class: 'badge keigo keigo-' + g.key, text: g.label }),
          el('span', { class: 'level-legend-desc', text: g.desc }),
          el('span', { class: 'level-legend-count muted', text: g.items.length + ' 語' })
        ]);
      }))
    ]));

    idx.grammarKeigoGroups.forEach(function (g) {
      var tbody = el('tbody');
      g.items.forEach(function (w) {
        var word = w.wordId != null ? idx.getWord(w.wordId) : null;
        tbody.appendChild(el('tr', {}, [
          el('th', { class: 'conj-row-head', scope: 'row' }, [
            el('a', { class: 'grammar-keigo-link', href: grammarHref(w), text: w.word }),
            w.kanji ? el('span', { class: 'conj-row-sub muted', text: '〔' + w.kanji + '〕' }) : null
          ]),
          el('td', { class: 'td-base', text: w.plain || '—' }),
          el('td', { class: 'td-meaning', text: w.meaning }),
          el('td', { class: 'td-link' }, [
            word
              ? el('a', { href: '#/word/' + word.id, text: word.kana })
              : el('span', { class: 'muted', text: '—' })
          ])
        ]));
      });
      wrap.appendChild(el('div', { class: 'card' }, [
        el('h2', { class: 'card-title' }, [
          el('span', { class: 'badge keigo keigo-' + g.key, text: g.label }),
          el('span', { class: 'muted small', text: '（' + g.items.length + ' 語）' })
        ]),
        el('p', { class: 'muted small', text: g.desc }),
        el('div', { class: 'table-scroll' }, [
          el('table', { class: 'token-table keigo-table' }, [
            el('thead', {}, [el('tr', {}, [
              el('th', { text: '敬語' }), el('th', { text: 'もとの語' }),
              el('th', { text: '訳' }), el('th', { text: '330 語' })
            ])]),
            tbody
          ])
        ])
      ]));
    });

    var notes = el('div', { class: 'card' }, [el('h2', { class: 'card-title', text: '敬語を読むときの要点' })]);
    idx.grammarKeigoNotes.forEach(function (n) {
      notes.appendChild(el('p', { class: 'grammar-tips' }, [richText(n)]));
    });
    notes.appendChild(el('p', { class: 'muted small' }, [
      '330 語の「敬語」だけを学習・クイズに回すこともできます　',
      el('a', { href: '#/study?pos=' + encodeURIComponent('敬語'), text: '敬語で学習' }),
      '　/　',
      el('a', { href: '#/words?pos=' + encodeURIComponent('敬語'), text: '一覧で見る' })
    ]));
    wrap.appendChild(notes);
    return wrap;
  }

  /* --- 活用表 ---------------------------------------------------- */
  function conjugationCards() {
    var cj = K.index.grammarConjugation;
    var wrap = el('div');
    if (!cj) return wrap;
    wrap.appendChild(el('p', {}, [richText(cj.intro)]));
    (cj.groups || []).forEach(function (g) {
      var card = el('div', { class: 'card' }, [
        el('h2', { class: 'card-title', text: g.title }),
        el('p', { class: 'muted small', text: g.desc }),
        conjTable({
          headLabel: '種類',
          rows: (g.rows || []).map(function (r) {
            return { name: r.name, sub: r.example, table: r.table };
          })
        })
      ]);
      var dl = el('dl', { class: 'help-dl' });
      (g.rows || []).forEach(function (r) {
        dl.appendChild(el('dt', { text: r.name + '（' + r.example + '）' }));
        dl.appendChild(el('dd', {}, [richText(r.how)]));
      });
      card.appendChild(dl);
      wrap.appendChild(card);
    });
    var tips = el('div', { class: 'card' }, [el('h2', { class: 'card-title', text: '見分け方のこつ' })]);
    (cj.tips || []).forEach(function (t) { tips.appendChild(el('p', { class: 'grammar-tips' }, [richText(t)])); });
    wrap.appendChild(tips);
    return wrap;
  }

  /* ---------------------------------------------------------------
   * 詳細（#/grammar/<category>/<id>）
   * ------------------------------------------------------------- */

  function meaningList(entry) {
    var dl = el('dl', { class: 'help-dl grammar-meanings' });
    (entry.meanings || []).forEach(function (m) {
      dl.appendChild(el('dt', {}, [
        el('span', { class: 'badge grammar-label', text: m.label }),
        el('span', { class: 'grammar-gloss', text: m.gloss })
      ]));
      dl.appendChild(el('dd', {}, [richText(m.how || '')]));
    });
    return dl;
  }

  function relatedLinks(entry) {
    var ids = entry.related || [];
    if (!ids.length) return null;
    var list = el('div', { class: 'chip-list' });
    var n = 0;
    ids.forEach(function (id) {
      var e = K.index.getGrammar(id);
      if (!e) return;
      n++;
      list.appendChild(el('a', { class: 'chip', href: grammarHref(e) }, [
        el('span', { class: 'chip-kana', text: entryName(e) }),
        el('span', { class: 'chip-extra', text: e.category === 'ident' ? '識別' : (e.kind || '') })
      ]));
    });
    if (!n) return null;
    return el('div', { class: 'card' }, [
      el('h2', { class: 'card-title', text: '関連する項目' }),
      list
    ]);
  }

  function renderDetail(catKey, id, container) {
    var idx = K.index;
    var entry = idx.getGrammar(id);
    if (!entry || (catKey && entry.category !== catKey)) {
      notFound(container, '文法項目「' + id + '」はありません。');
      return;
    }
    var cat = idx.grammarCategory(entry.category) || { key: entry.category, label: '文法' };

    var section = el('section', { class: 'view view-grammar view-grammar-detail' });
    section.appendChild(crumbs([
      { label: '← 文法', href: '#/grammar' },
      { label: cat.label, href: catHref(cat.key) },
      { label: entryName(entry) }
    ]));

    if (entry.category === 'ident') {
      renderIdentDetail(entry, section);
    } else if (entry.category === 'keigo') {
      renderKeigoDetail(entry, section);
    } else if (entry.category === 'conj') {
      renderConjDetail(entry, section);
    } else {
      renderWordDetail(entry, section);
    }

    var rel = relatedLinks(entry);
    if (rel) section.appendChild(rel);

    section.appendChild(el('div', { class: 'deck-links' }, [
      el('a', {
        class: 'btn btn-primary',
        href: '#/grammar/drill?aux=' + encodeURIComponent(entry.id),
        text: 'この語だけでドリル'
      }),
      el('a', { class: 'btn', href: catHref(cat.key), text: '← ' + cat.label + 'の一覧' })
    ]));

    container.appendChild(section);
    if (K.analytics) K.analytics.event('grammar_view', { category: entry.category, id: entry.id });
  }

  /** 助動詞・助詞の詳細 */
  function renderWordDetail(entry, section) {
    section.appendChild(el('header', { class: 'grammar-head' }, [
      el('p', { class: 'word-head-badges' }, [
        el('span', { class: 'badge pos', text: entry.category === 'aux' ? '助動詞' : entry.kind }),
        entry.category === 'aux' ? el('span', { class: 'badge grammar-label', text: entry.kind }) : null
      ]),
      el('h1', { class: 'view-title grammar-title', text: entry.name }),
      el('p', { class: 'muted', text: entry.kind })
    ]));

    /* 接続・活用の型 */
    var facts = el('dl', { class: 'help-dl grammar-facts' });
    facts.appendChild(el('dt', { text: '接続' }));
    facts.appendChild(el('dd', { text: entry.attach || '—' }));
    if (entry.conj) {
      facts.appendChild(el('dt', { text: '活用の型' }));
      facts.appendChild(el('dd', { text: entry.conj }));
    }
    var factCard = el('div', { class: 'card' }, [
      el('h2', { class: 'card-title', text: '接続と活用' }),
      facts
    ]);
    if (entry.table) {
      factCard.appendChild(conjTable({
        headLabel: '語',
        rows: [{ name: entry.name, sub: entry.conj, table: entry.table }]
      }));
      factCard.appendChild(el('p', { class: 'muted small', text: '「○」はその活用形が無いことを表します。' }));
    }
    section.appendChild(factCard);

    /* 意味ごとの見分け方 */
    section.appendChild(el('div', { class: 'card' }, [
      el('h2', { class: 'card-title' }, [
        '意味と見分け方',
        el('span', { class: 'muted small', text: '（' + (entry.meanings || []).length + ' 通り）' })
      ]),
      meaningList(entry)
    ]));

    /* 用例（コーパスから） */
    section.appendChild(el('div', { class: 'card' }, [
      el('h2', { class: 'card-title', text: '教材に出てくる用例' }),
      el('p', { class: 'muted small', text: '教科書の文章の品詞分解から自動で集めています。文をタップするとその文章のページへ移り、原文と現代語訳で読めます。' }),
      examplesBlock(entry)
    ]));

    /* 識別の要点 */
    if (entry.tips) {
      section.appendChild(el('div', { class: 'card' }, [
        el('h2', { class: 'card-title', text: '識別の要点' }),
        tipsBlock(entry.tips),
        entry.note ? el('p', { class: 'grammar-note needs-check' }, [richText(entry.note)]) : null
      ]));
    }
  }

  /** 識別の詳細 */
  function renderIdentDetail(entry, section) {
    section.appendChild(el('header', { class: 'grammar-head' }, [
      el('p', { class: 'word-head-badges' }, [el('span', { class: 'badge pos', text: '識別' })]),
      el('h1', { class: 'view-title grammar-title', text: entry.title })
    ]));
    if (entry.lead) section.appendChild(el('p', { class: 'view-lead' }, [richText(entry.lead)]));

    (entry.cases || []).forEach(function (c, i) {
      var card = el('div', { class: 'card grammar-case' }, [
        el('h2', { class: 'card-title' }, [
          el('span', { class: 'grammar-case-num', text: String(i + 1) }),
          c.label
        ]),
        el('p', {}, [richText(c.how || '')])
      ]);
      if (c.example) {
        card.appendChild(el('p', { class: 'grammar-case-example', lang: 'ja', text: c.example }));
      }
      card.appendChild(el('h3', { class: 'rel-type', text: '教材の用例' }));
      card.appendChild(examplesBlock(null, {
        match: c.match, limit: 6,
        empty: 'この場合の例は、収録している教材の中にはまだありません。'
      }));
      section.appendChild(card);
    });

    if (entry.tips) {
      section.appendChild(el('div', { class: 'card' }, [
        el('h2', { class: 'card-title', text: '見分けの手順' }),
        tipsBlock(entry.tips),
        entry.note ? el('p', { class: 'grammar-note needs-check' }, [richText(entry.note)]) : null
      ]));
    }
  }

  /** 敬語 1 語の詳細 */
  function renderKeigoDetail(entry, section) {
    var word = entry.wordId != null ? K.index.getWord(entry.wordId) : null;
    section.appendChild(el('header', { class: 'grammar-head' }, [
      el('p', { class: 'word-head-badges' }, [
        el('span', { class: 'badge keigo keigo-' + entry.kind, text: entry.kind + '語' })
      ]),
      el('h1', { class: 'view-title grammar-title', text: entry.word }),
      entry.kanji ? el('p', { class: 'muted', text: '〔' + entry.kanji + '〕' }) : null
    ]));

    var facts = el('dl', { class: 'help-dl grammar-facts' });
    facts.appendChild(el('dt', { text: '敬意の種類' }));
    facts.appendChild(el('dd', { text: entry.kind + '語（' + (entry.kind === '尊敬' ? '動作をする人を高める' : entry.kind === '謙譲' ? '動作を受ける人を高める' : '聞き手を高める') + '）' }));
    facts.appendChild(el('dt', { text: 'もとの語' }));
    facts.appendChild(el('dd', { text: entry.plain || '—' }));
    facts.appendChild(el('dt', { text: '訳' }));
    facts.appendChild(el('dd', { text: entry.meaning }));
    var card = el('div', { class: 'card' }, [el('h2', { class: 'card-title', text: 'この語について' }), facts]);
    if (word) {
      card.appendChild(el('div', { class: 'chip-list' }, [C.wordChip(word, '330 語の詳細へ')]));
    }
    section.appendChild(card);

    section.appendChild(el('div', { class: 'card' }, [
      el('h2', { class: 'card-title', text: '教材に出てくる用例' }),
      examplesBlock(entry)
    ]));
  }

  /** 活用の 1 種類の詳細 */
  function renderConjDetail(entry, section) {
    section.appendChild(el('header', { class: 'grammar-head' }, [
      el('p', { class: 'word-head-badges' }, [
        el('span', { class: 'badge pos', text: entry.groupTitle || '活用' })
      ]),
      el('h1', { class: 'view-title grammar-title', text: entry.name }),
      el('p', { class: 'muted', text: '例：' + entry.example })
    ]));
    section.appendChild(el('div', { class: 'card' }, [
      el('h2', { class: 'card-title', text: '活用表' }),
      conjTable({ headLabel: '種類', rows: [{ name: entry.name, sub: entry.example, table: entry.table }] }),
      el('p', { class: 'grammar-tips' }, [richText(entry.how || '')])
    ]));
    section.appendChild(el('div', { class: 'card' }, [
      el('h2', { class: 'card-title', text: '教材に出てくる用例' }),
      examplesBlock(null, {
        match: conjMatchOf(entry),
        empty: 'この活用の例は、収録している教材の中にはまだありません。'
      })
    ]));
  }

  /** 活用の種類 → 品詞分解の c（活用の種類）への対応 */
  var CONJ_MATCH = {
    yodan: { p: '動詞', c: ['ア行四段', 'カ行四段', 'ガ行四段', 'サ行四段', 'ザ行四段', 'タ行四段', 'ダ行四段', 'ナ行四段', 'ハ行四段', 'バ行四段', 'マ行四段', 'ヤ行四段', 'ラ行四段', 'ワ行四段'] },
    'kami-ichi': { p: '動詞', c: ['ア行上一段', 'カ行上一段', 'ナ行上一段', 'ハ行上一段', 'マ行上一段', 'ヤ行上一段', 'ラ行上一段', 'ワ行上一段'] },
    'kami-ni': { p: '動詞', c: ['ア行上二段', 'カ行上二段', 'ガ行上二段', 'サ行上二段', 'ザ行上二段', 'タ行上二段', 'ダ行上二段', 'ハ行上二段', 'バ行上二段', 'マ行上二段', 'ヤ行上二段', 'ラ行上二段'] },
    'shimo-ichi': { p: '動詞', c: ['カ行下一段'] },
    'shimo-ni': { p: '動詞', c: ['ア行下二段', 'カ行下二段', 'ガ行下二段', 'サ行下二段', 'ザ行下二段', 'タ行下二段', 'ダ行下二段', 'ナ行下二段', 'ハ行下二段', 'バ行下二段', 'マ行下二段', 'ヤ行下二段', 'ラ行下二段', 'ワ行下二段'] },
    kahen: { p: '動詞', c: 'カ変' },
    sahen: { p: '動詞', c: 'サ変' },
    nahen: { p: '動詞', c: 'ナ変' },
    rahen: { p: '動詞', c: 'ラ変' },
    'keiyoshi-ku': { p: '形容詞', c: 'ク活用' },
    'keiyoshi-shiku': { p: '形容詞', c: 'シク活用' },
    'keiyodoshi-nari': { p: '形容動詞', c: 'ナリ活用' },
    'keiyodoshi-tari': { p: '形容動詞', c: 'タリ活用' }
  };
  function conjMatchOf(entry) { return CONJ_MATCH[entry.id] || null; }

  function notFound(container, msg) {
    container.appendChild(el('div', { class: 'notice' }, [
      el('h2', { text: 'ページが見つかりません' }),
      el('p', { text: msg }),
      el('p', {}, [el('a', { href: '#/grammar', text: '文法のトップへ' })])
    ]));
  }

  /* ===============================================================
   * 文法ドリル（#/grammar/drill）
   * ===============================================================
   * 問題はすべてコーパス（data/tokens/*.js）のトークンから作る。
   *   q = {
   *     kind, token, example（用例 1 件）, prompt, promptLabel,
   *     choices: [文字列], answer: 正解の文字列, entry（出題元の文法エントリ）
   *   }
   * 誤答は「同じ語の他の意味」「他の活用形」「同じ識別の他のケース」から取る。
   * =============================================================== */

  /**
   * entry.meanings から、トークンの用法ラベルに当たるものを探す。
   * 品詞分解側が別の言い方をしている用法は meanings[].alias に並べてあるので、
   *   1. label と完全一致
   *   2. alias と完全一致
   *   3. どちらかが他方の前方一致（「伝聞」↔「伝聞推定」）
   * の順に見る。当たらなければ null（そのトークンは出題に使わない）。
   */
  function meaningOf(entry, token) {
    var label = K.index.grammarMeaningLabel(token.m);
    if (!label) return null;
    var list = (entry && entry.meanings) || [];
    var i, j;
    for (i = 0; i < list.length; i++) if (list[i].label === label) return list[i];
    for (i = 0; i < list.length; i++) {
      var al = list[i].alias || [];
      for (j = 0; j < al.length; j++) if (al[j] === label) return list[i];
    }
    for (i = 0; i < list.length; i++) {
      if (label.indexOf(list[i].label) === 0 || list[i].label.indexOf(label) === 0) return list[i];
    }
    return null;
  }

  /** 出題対象のエントリ（クエリで絞れる） */
  function drillEntries(state, categories) {
    var idx = K.index;
    if (state.aux || state.id) {
      var one = idx.getGrammar(state.aux || state.id);
      return one ? [one] : [];
    }
    var cats = state.cat ? [state.cat] : categories;
    var out = [];
    cats.forEach(function (c) { out = out.concat(idx.grammarList(c)); });
    return out;
  }

  /** 選択肢を 4 つに整える（正解 1 ＋ 誤答 3）。足りなければ fallback から補う */
  function makeChoices(answer, wrongs, fallback) {
    var used = {};
    used[answer] = true;
    var chosen = [];
    U.shuffle(wrongs || []).forEach(function (w) {
      if (chosen.length >= 3 || !w || used[w]) return;
      used[w] = true; chosen.push(w);
    });
    U.shuffle(fallback || []).forEach(function (w) {
      if (chosen.length >= 3 || !w || used[w]) return;
      used[w] = true; chosen.push(w);
    });
    if (chosen.length < 3) return null;
    return U.shuffle([answer].concat(chosen));
  }

  /* --- (a) 意味当て ---------------------------------------------- */
  function buildMeaningQuestions(state, max) {
    var idx = K.index;
    var entries = drillEntries(state, ['aux', 'particle']).filter(function (e) {
      return (e.meanings || []).length >= 2 && (e.category === 'aux' || e.category === 'particle');
    });
    var out = [];
    U.shuffle(entries).forEach(function (entry) {
      if (out.length >= max) return;
      var exs = U.shuffle(idx.grammarExamples(entry, { limit: 20 }));
      for (var i = 0; i < exs.length; i++) {
        var ex = exs[i];
        var m = meaningOf(entry, ex.token);
        if (!m) continue;
        var wrongs = entry.meanings.filter(function (x) { return x.label !== m.label; })
          .map(function (x) { return x.label; });
        var fallback = [];
        entries.forEach(function (e2) {
          if (e2.id === entry.id) return;
          (e2.meanings || []).forEach(function (x) { if (x.label !== m.label) fallback.push(x.label); });
        });
        var choices = makeChoices(m.label, wrongs, fallback);
        if (!choices) continue;
        out.push({
          kind: 'meaning', entry: entry, example: ex, token: ex.token,
          promptLabel: '傍線部の「' + ex.token.s + '」（' + entryName(entry) + '）は、どの意味ですか。',
          choices: choices, answer: m.label,
          explain: '（' + m.label + '）' + m.gloss + '　' + (m.how || '')
        });
        break;
      }
    });
    return out;
  }

  /* --- (b) 活用形当て -------------------------------------------- */
  function buildFormQuestions(state, max) {
    var idx = K.index;
    var entries = drillEntries(state, ['aux', 'particle', 'keigo', 'ident']);
    // 活用形は語に限らず問えるので、助動詞を中心にしつつ用言も混ぜる
    var pool = [];
    U.shuffle(entries).forEach(function (entry) {
      if (!entry.match) return;
      idx.grammarExamples(entry, { limit: 6 }).forEach(function (ex) {
        if (ex.token && ex.token.f) pool.push({ entry: entry, ex: ex });
      });
    });
    if (!state.aux && !state.id) {
      // 用言（動詞・形容詞・形容動詞）からも出す
      Object.keys(CONJ_MATCH).forEach(function (k) {
        idx.grammarExamples(null, { match: CONJ_MATCH[k], limit: 4 }).forEach(function (ex) {
          if (ex.token && ex.token.f) pool.push({ entry: idx.getGrammar(k), ex: ex });
        });
      });
    }
    var out = [];
    var seen = {};
    U.shuffle(pool).forEach(function (item) {
      if (out.length >= max) return;
      var ex = item.ex;
      var key = ex.passageId + ':' + ex.paraIndex + ':' + ex.tokenIndex;
      if (seen[key]) return;
      seen[key] = true;
      var choices = makeChoices(ex.token.f, FORMS.filter(function (f) { return f !== ex.token.f; }), FORMS);
      if (!choices) return;
      out.push({
        kind: 'form', entry: item.entry, example: ex, token: ex.token,
        promptLabel: '傍線部の「' + ex.token.s + '」は、何形ですか。',
        choices: choices, answer: ex.token.f,
        explain: (ex.token.b ? '基本形は「' + ex.token.b + '」。' : '') +
          (ex.token.c ? '活用は ' + ex.token.c + '。' : '') + 'ここは ' + ex.token.f + 'です。'
      });
    });
    return out;
  }

  /* --- (c) 識別 -------------------------------------------------- */
  function buildIdentQuestions(state, max) {
    var idx = K.index;
    var entries = (state.aux || state.id)
      ? drillEntries(state, ['ident']).filter(function (e) { return e.category === 'ident'; })
      : idx.grammarList('ident');
    if (!entries.length) return [];
    var allLabels = [];
    idx.grammarList('ident').forEach(function (e) {
      (e.cases || []).forEach(function (c) { allLabels.push(c.label); });
    });

    var out = [];
    U.shuffle(entries).forEach(function (entry) {
      if (out.length >= max) return;
      var cases = U.shuffle((entry.cases || []).slice());
      for (var i = 0; i < cases.length; i++) {
        var c = cases[i];
        var exs = idx.grammarExamples(null, { match: c.match, limit: 8 });
        if (!exs.length) continue;
        var ex = U.shuffle(exs)[0];
        var wrongs = (entry.cases || []).filter(function (x) { return x.label !== c.label; })
          .map(function (x) { return x.label; });
        var choices = makeChoices(c.label, wrongs, allLabels.filter(function (l) { return l !== c.label; }));
        if (!choices) continue;
        out.push({
          kind: 'ident', entry: entry, example: ex, token: ex.token,
          promptLabel: '傍線部の「' + ex.token.s + '」は、次のどれですか。',
          promptSub: entry.title,
          choices: choices, answer: c.label,
          explain: c.how || ''
        });
        break;
      }
    });
    return out;
  }

  /* --- (d) 敬語の種類 -------------------------------------------- */
  var KEIGO_CHOICES = ['尊敬', '謙譲', '丁寧', '敬語ではない'];
  function buildKeigoQuestions(state, max) {
    var idx = K.index;
    var entries = drillEntries(state, ['keigo']).filter(function (e) { return e.category === 'keigo'; });
    var out = [];
    var seenWord = {};
    U.shuffle(entries).forEach(function (entry) {
      if (out.length >= max) return;
      if (seenWord[entry.word]) return;
      var exs = idx.grammarExamples(entry, { limit: 8 });
      if (!exs.length) return;
      seenWord[entry.word] = true;
      var ex = U.shuffle(exs)[0];
      out.push({
        kind: 'keigo', entry: entry, example: ex, token: ex.token,
        promptLabel: '傍線部の「' + ex.token.s + '」は、どの敬語ですか。',
        choices: U.shuffle(KEIGO_CHOICES.slice()), answer: entry.kind,
        explain: '「' + entry.word + '」は' + entry.kind + '語。' +
          (entry.plain && entry.plain !== '—' ? 'もとの語は「' + entry.plain + '」。' : '') + entry.meaning
      });
    });
    return out;
  }

  var BUILDERS = {
    meaning: buildMeaningQuestions,
    form: buildFormQuestions,
    ident: buildIdentQuestions,
    keigo: buildKeigoQuestions
  };

  /** 出題する問題を組み立てる（kind の指定が無ければ 4 種類を混ぜる） */
  function buildDrill(state, count) {
    var kinds = state.kind && BUILDERS[state.kind] ? [state.kind] : ['meaning', 'form', 'ident', 'keigo'];
    var per = Math.ceil(count / kinds.length) + 2;
    var pools = kinds.map(function (k) { return BUILDERS[k](state, per); });
    // 種類を回りながら 1 問ずつ取る（偏らないように）
    var out = [];
    var round = 0, added = true;
    while (added && out.length < count) {
      added = false;
      for (var i = 0; i < pools.length && out.length < count; i++) {
        if (pools[i].length > round) { out.push(pools[i][round]); added = true; }
      }
      round++;
    }
    return U.shuffle(out).slice(0, count);
  }

  function drillDeckLabel(state) {
    var parts = [];
    if (state.aux || state.id) {
      var e = K.index.getGrammar(state.aux || state.id);
      // 識別のタイトルは「「なり」— …」のように鉤括弧を含むので、二重にしない
      if (e) parts.push(e.category === 'ident' ? entryName(e) : '「' + entryName(e) + '」');
    } else if (state.cat) {
      var c = K.index.grammarCategory(state.cat);
      if (c) parts.push(c.label);
    }
    if (state.kind) {
      var k = DRILL_KINDS.filter(function (x) { return x.key === state.kind; })[0];
      if (k) parts.push(k.label);
    }
    return parts.length ? parts.join('・') : '文法ぜんぶ';
  }

  function renderDrill(query, container) {
    var state = Object.assign({}, query);
    var count = Number(state.count) || Number(K.store.getPref('grammarDrillCount', 10)) || 10;
    var questions = [];
    var qi = 0;
    var answers = [];
    var locked = false;

    var section = el('section', { class: 'view view-grammar view-grammar-drill' });
    var setupWrap = el('div', { class: 'quiz-setup' });
    var stage = el('div', { class: 'quiz-stage' });

    function onChange(patch) {
      Object.assign(state, patch);
      K.router.setQuery(patch);
    }

    function drawSetup() {
      U.clear(setupWrap);
      var kindSel = el('select', {
        onChange: function (e) { onChange({ kind: e.target.value }); }
      }, [{ key: '', label: '4 種類を混ぜて出す' }].concat(DRILL_KINDS).map(function (k) {
        var o = el('option', { value: k.key, text: k.label });
        if ((state.kind || '') === k.key) o.selected = true;
        return o;
      }));

      var catSel = el('select', {
        onChange: function (e) { onChange({ cat: e.target.value, aux: '' }); }
      }, [{ key: '', label: 'すべて' }].concat(K.index.grammarCategories.filter(function (c) {
        return c.key !== 'conj';
      })).map(function (c) {
        var o = el('option', { value: c.key || '', text: c.label });
        if ((state.cat || '') === (c.key || '')) o.selected = true;
        return o;
      }));

      setupWrap.appendChild(el('div', { class: 'quiz-options' }, [
        el('label', { class: 'field' }, [
          el('span', { class: 'field-label', text: '出題の種類' }), kindSel
        ]),
        el('label', { class: 'field' }, [
          el('span', { class: 'field-label', text: '分野' }), catSel
        ]),
        el('label', { class: 'field' }, [
          el('span', { class: 'field-label', text: '問題数' }),
          el('select', {
            onChange: function (e) {
              K.store.setPref('grammarDrillCount', Number(e.target.value));
              onChange({ count: e.target.value });
            }
          }, [5, 10, 20].map(function (n) {
            var o = el('option', { value: n, text: n + ' 問' });
            if (n === count) o.selected = true;
            return o;
          }))
        ])
      ]));
      var chips = el('div', { class: 'filter-chips' }, [
        el('span', { class: 'filter-chip', text: drillDeckLabel(state) })
      ]);
      if (state.aux || state.id) {
        chips.appendChild(el('button', {
          type: 'button', class: 'btn btn-ghost btn-clear',
          text: '語の指定を外す',
          onClick: function () { onChange({ aux: '', id: '' }); }
        }));
      }
      setupWrap.appendChild(chips);
      setupWrap.appendChild(el('p', {
        class: 'muted small',
        text: '問題は教材の品詞分解から自動で作られます。誤答は同じ語の他の意味・他の活用形から選ばれます。'
      }));
    }

    function start() {
      questions = buildDrill(state, count);
      qi = 0; answers = []; locked = false;
      drawQuestion();
    }

    function drawStart() {
      U.clear(stage);
      var test = buildDrill(state, count);
      if (test.length < 1) {
        stage.appendChild(el('div', { class: 'notice' }, [
          el('p', { text: 'いまの条件では問題が作れませんでした（教材にその用法の例がまだありません）。条件をゆるめてください。' }),
          el('p', {}, [el('a', { href: '#/grammar/drill', text: '条件なしで出題する' })])
        ]));
        return;
      }
      stage.appendChild(el('div', { class: 'card quiz-start' }, [
        el('p', {}, [el('b', { text: String(test.length) }), ' 問出題します。']),
        el('p', { class: 'muted small', text: '出題範囲：' + drillDeckLabel(state) }),
        el('button', { class: 'btn btn-primary btn-lg', type: 'button', text: 'はじめる', onClick: start })
      ]));
    }

    function drawQuestion() {
      U.clear(stage);
      if (qi >= questions.length) { drawResult(); return; }
      var q = questions[qi];
      var ex = q.example;

      var sentence = el('p', { class: 'grammar-ex-text drill-sentence', lang: 'ja' });
      ex.sentenceTokens.forEach(function (t, i) {
        var s = (t && t.s) || '';
        if (!s) return;
        if (i === ex.hitIndex) sentence.appendChild(el('em', { class: 'grammar-ex-hit', text: s }));
        else sentence.appendChild(document.createTextNode(s));
      });

      var work = K.index.getWork(ex.passage.workId);
      var choicesWrap = el('div', { class: 'quiz-choices' });
      var feedback = el('div', { class: 'quiz-feedback' });

      q.choices.forEach(function (c, n) {
        var btn = el('button', {
          type: 'button', class: 'quiz-choice',
          onClick: function () { choose(c, btn); }
        }, [
          el('span', { class: 'choice-num', text: String(n + 1) }),
          el('span', { class: 'choice-label', text: c })
        ]);
        choicesWrap.appendChild(btn);
      });

      function choose(c, btn) {
        if (locked) return;
        locked = true;
        var correct = c === q.answer;
        answers.push({ q: q, chosen: c, correct: correct });

        Array.prototype.forEach.call(choicesWrap.children, function (b, n) {
          b.disabled = true;
          if (q.choices[n] === q.answer) b.classList.add('is-correct');
        });
        if (!correct) btn.classList.add('is-wrong');

        U.clear(feedback);
        feedback.appendChild(el('p', {
          class: 'feedback-line ' + (correct ? 'ok' : 'ng'),
          text: correct ? '正解' : '不正解'
        }));
        feedback.appendChild(el('p', { class: 'feedback-meaning' }, [
          el('b', { text: q.answer }),
          q.explain ? el('span', { text: '　' + q.explain }) : null
        ]));
        if (q.token.m) {
          feedback.appendChild(el('p', { class: 'muted small', text: '品詞分解：' + [q.token.p, q.token.c, q.token.f].filter(Boolean).join('・') + '　' + q.token.m }));
        }
        var links = el('div', { class: 'deck-links' });
        if (q.entry) {
          links.appendChild(el('a', {
            class: 'btn btn-ghost', href: grammarHref(q.entry),
            text: entryName(q.entry) + 'の解説'
          }));
        }
        links.appendChild(el('a', {
          class: 'btn btn-ghost', href: '#/passage/' + encodeURIComponent(ex.passageId),
          text: (work ? work.title : '') + '「' + ex.passage.title + '」を読む'
        }));
        feedback.appendChild(links);
        feedback.appendChild(el('button', {
          class: 'btn btn-primary', type: 'button',
          text: qi + 1 >= questions.length ? '結果を見る' : '次の問題 →',
          onClick: function () { qi++; locked = false; drawQuestion(); }
        }));
        var next = feedback.querySelector('.btn-primary');
        if (next) next.focus();
      }

      var kindLabel = (DRILL_KINDS.filter(function (k) { return k.key === q.kind; })[0] || {}).label || '';

      stage.appendChild(el('div', { class: 'quiz-progress' }, [
        el('div', { class: 'progress' }, [
          el('div', { class: 'progress-fill', style: { width: (qi / questions.length * 100) + '%' } })
        ]),
        el('p', { class: 'progress-text muted', text: '第 ' + (qi + 1) + ' 問 / ' + questions.length })
      ]));
      stage.appendChild(el('div', { class: 'card quiz-card drill-card' }, [
        el('p', { class: 'quiz-prompt-label muted' }, [
          kindLabel ? el('span', { class: 'badge pos', text: kindLabel }) : null,
          q.promptSub ? el('span', { text: '　' + q.promptSub }) : null
        ]),
        sentence,
        el('p', { class: 'drill-source muted small', text: (work ? work.title : '') + '「' + ex.passage.title + '」' }),
        el('p', { class: 'quiz-prompt drill-prompt', text: q.promptLabel }),
        choicesWrap,
        feedback
      ]));
    }

    function drawResult() {
      var correct = answers.filter(function (a) { return a.correct; }).length;
      var total = answers.length;
      var pct = Math.round(correct / (total || 1) * 100);
      var kinds = {};
      answers.forEach(function (a) { kinds[a.q.kind] = (kinds[a.q.kind] || 0) + 1; });

      if (K.store.pushGrammarResult) {
        K.store.pushGrammarResult({
          total: total, correct: correct,
          kind: state.kind || 'mixed', cat: state.cat || '', entry: state.aux || state.id || ''
        });
      }
      if (K.analytics) {
        K.analytics.event('grammar_drill_complete', {
          kind: state.kind || 'mixed', count: total, correct: correct, score_pct: pct
        });
      }

      U.clear(stage);
      var wrongs = answers.filter(function (a) { return !a.correct; });

      var card = el('div', { class: 'card quiz-result' }, [
        el('h2', { text: '結果' }),
        el('p', { class: 'score' }, [
          el('span', { class: 'big', text: String(correct) }),
          ' / ' + total + ' 問正解',
          el('span', { class: 'score-pct muted', text: '（' + pct + '%）' })
        ]),
        el('div', { class: 'progress score-bar' }, [
          el('div', { class: 'progress-fill', style: { width: pct + '%' } })
        ]),
        el('p', { class: 'muted small', text: '出題範囲：' + drillDeckLabel(state) + '（内訳 ' + Object.keys(kinds).map(function (k) {
          var kd = DRILL_KINDS.filter(function (x) { return x.key === k; })[0];
          return (kd ? kd.label : k) + ' ' + kinds[k] + ' 問';
        }).join('・') + '）' }),
        el('div', { class: 'deck-links' }, [
          el('button', { class: 'btn btn-primary', type: 'button', text: 'もう一度', onClick: start }),
          el('a', { class: 'btn btn-ghost', href: '#/grammar', text: '文法の解説を読む' })
        ])
      ]);

      /* 共有。リンク先は結果ではなく「同じ条件で始められる URL」にする
         （クイズ結果の流儀と同じ。DESIGN.md 4-c） */
      var shareQuery = {};
      ['kind', 'cat', 'aux', 'id'].forEach(function (k) { if (state[k]) shareQuery[k] = state[k]; });
      shareQuery.count = total;
      card.appendChild(C.shareButtons({
        label: '結果を共有',
        text: '古文の文法ドリル ' + total + ' 問中 ' + correct + ' 問正解（正答率 ' + pct + '%）！【' +
          drillDeckLabel(state) + '】',
        url: C.absUrl('#/grammar/drill' + U.buildQuery(shareQuery)),
        contentType: 'grammar',
        itemId: state.aux || state.id || state.cat || state.kind || ''
      }));
      stage.appendChild(card);

      if (wrongs.length) {
        var list = el('div', { class: 'grammar-list' });
        wrongs.forEach(function (a) {
          var e = a.q.entry;
          list.appendChild(el('a', {
            class: 'grammar-item',
            href: e ? grammarHref(e) : '#/grammar'
          }, [
            el('span', { class: 'grammar-item-name', text: a.q.token.s }),
            el('span', { class: 'grammar-item-kind', text: '正解：' + a.q.answer }),
            el('span', { class: 'grammar-item-attach muted', text: 'あなたの答え：' + a.chosen })
          ]));
        });
        stage.appendChild(el('div', { class: 'card' }, [
          el('h2', { class: 'card-title', text: '間違えた問題（' + wrongs.length + '）' }),
          el('p', { class: 'muted small', text: '行をタップすると、その項目の解説へ移ります。' }),
          list
        ]));
      }
    }

    /* 数字キーで回答（クイズと同じ流儀） */
    function onKey(e) {
      if (!document.body.contains(stage)) { document.removeEventListener('keydown', onKey); return; }
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      var n = Number(e.key);
      if (n >= 1 && n <= 4) {
        var btns = stage.querySelectorAll('.quiz-choice');
        if (btns[n - 1] && !btns[n - 1].disabled) { e.preventDefault(); btns[n - 1].click(); }
      }
    }
    document.addEventListener('keydown', onKey);

    section.appendChild(crumbs([
      { label: '← 文法', href: '#/grammar' },
      { label: '文法ドリル' }
    ]));
    section.appendChild(el('h1', { class: 'view-title', text: '文法ドリル（4択）' }));
    section.appendChild(el('p', { class: 'view-lead', text: '教材の原文から作った 4 択問題です。1 〜 4 の数字キーでも答えられます。' }));
    section.appendChild(setupWrap);
    section.appendChild(stage);
    container.appendChild(section);

    drawSetup();
    drawStart();
  }

  /* ---------------------------------------------------------------
   * ルーターからの入口
   * ------------------------------------------------------------- */
  function render(params, query, container) {
    if (!K.index.grammar) {
      notFound(container, 'data/grammar.js が読み込まれていません。');
      return;
    }
    var cat = params.category || '';
    if (!cat) { renderIndex(query, container); return; }
    if (cat === 'drill') { renderDrill(query, container); return; }
    if (params.id) { renderDetail(cat, params.id, container); return; }
    renderCategory(cat, query, container);
  }

  K.views = K.views || {};
  K.views.grammar = { render: render };
})();
