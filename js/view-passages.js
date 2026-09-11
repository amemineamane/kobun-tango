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
 *   ・**原文のどの語をタップしても品詞・活用・語義が出る**
 *     （data/tokens/<id>.js → C.passageTokenLine → C.tokenPopup）
 *   ・段落ごとに「品詞分解を表で見る」を開く（C.tokenTableOf）
 *   ・この文章の単語一覧（330 語は詳細へリンク、文章固有語はその場で語義）
 *   ・「この文章の単語で学習／クイズ」→ #/study?passage=<id> / #/quiz?passage=<id>
 *
 * 【原文の描き方は 2 通り】
 *   品詞分解あり（data/tokens/<passageId>.js がある）… C.passageTokenLine。
 *     全語タップ可。vocab のハイライトはトークンの上に重ねる。
 *   品詞分解なし … C.passageLine（vocab の surface を文字列一致で拾う従来の描画）。
 *   かつて別枠にあった「品詞分解つき例文（data/examples.js）」は、原文そのものが
 *   品詞分解になったので廃止した（同じ本文の枠が 2 つあると分かりにくいため）。
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

  /** 作品の出題バッジの列（work.exam が無ければ null） */
  function examBadgeRow(work) {
    var badges = C.examBadges(K.index.examsOfWork(work.id));
    if (!badges.length) return null;
    return el('p', { class: 'textbook-work-exam' }, badges);
  }

  /** summary の 1 文目だけを取る（一覧を 1 行に収めるため） */
  function firstSentence(text) {
    var s = String(text || '');
    var i = s.indexOf('。');
    if (i >= 0) s = s.slice(0, i + 1);
    return s.length > 80 ? s.slice(0, 80) + '…' : s;
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
   * 文章がまだ無い作品（作品タグだけの作品）も、収録語の数を添えて出す。
   *
   * 一覧は 2 つのセクションに分かれる。
   *   1. 教科書の定番教材 … data/works.js の順（＝教科書での定番順）
   *   2. 共通テスト・センター試験の出典作品 … work.exam を持つ作品を
   *      **出題年の新しい順**（K.index.examWorks）に並べる。
   *      本文のある作品は文章カード、本文が未収録の作品は畳んだ 1 行で出す。
   * 同じ作品が両方に出ることがある（源氏物語は桐壺＝定番教材、
   * 若菜下＝2025 年共通テストの出典）。文章ごとに置き場所を決めている。
   * ------------------------------------------------------------- */
  function renderTextbook(params, query, container) {
    var state = Object.assign({}, query);
    var EXAM = K.index.EXAM_GRADE;

    var section = el('section', { class: 'view view-textbook' }, [
      el('h1', { class: 'view-title', text: '教科書' }),
      el('p', { class: 'view-lead', text: '教科書に定番として載る古典教材と、大学入学共通テスト・センター試験で出典になった作品を、作品ごとにまとめました。文章を選ぶと原文と現代語訳が読め、「その文章に出てくる単語だけ」で学習・クイズができます。作品名からは、その作品の書誌や収録語をまとめた作品ページへ進めます。' })
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

    /** いま効いている学年フィルタに合う文章か */
    function matchGrade(p) {
      if (!state.grade) return true;
      return (p.grade || []).indexOf(state.grade) >= 0;
    }

    /** 作品 1 件のカード（見出し＋文章カード、または「文章はまだありません」） */
    function workCard(work, list, opts) {
      opts = opts || {};
      var words = K.index.wordsByWork.get(work.id) || [];
      var meta = [work.author, work.era, work.genre].filter(Boolean).join('　/　');

      var head = el('div', { class: 'textbook-work-head' }, [
        el('h2', { class: 'card-title textbook-work-title' }, [
          el('a', { class: 'textbook-work-link', href: '#/work/' + work.id, text: work.title }),
          el('span', { class: 'textbook-work-go muted small', text: '作品ページ →' })
        ]),
        opts.exam ? examBadgeRow(work) : null,
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
          (opts.exam ? '本文は未収録（作品の解説のみ）' : '文章はまだありません')
            + '／収録語 ' + words.length + ' 語　',
          el('a', { href: '#/work/' + work.id, text: '作品ページで見る →' })
        ]);
      }

      return el('div', { class: 'card textbook-work' }, [head, body]);
    }

    /** 本文が未収録の出典作品。一覧が長くなりすぎないよう 1 行に畳む */
    function examBriefRow(work) {
      var words = K.index.wordsByWork.get(work.id) || [];
      var meta = [work.author, work.era, work.genre].filter(Boolean).join('　/　');
      return el('div', { class: 'textbook-brief' }, [
        el('p', { class: 'textbook-brief-head' }, [
          el('a', { class: 'textbook-brief-title', href: '#/work/' + work.id, text: work.title })
        ].concat(C.examBadges(K.index.examsOfWork(work.id)))),
        meta ? el('p', { class: 'textbook-brief-meta muted small', text: meta }) : null,
        el('p', { class: 'textbook-brief-summary', text: firstSentence(work.summary) }),
        el('p', { class: 'textbook-brief-foot' }, [
          el('span', {
            class: 'muted small',
            text: '本文は未収録（作品の解説のみ）' + (words.length ? '／収録語 ' + words.length + ' 語' : '')
          }),
          el('a', { class: 'small', href: '#/work/' + work.id, text: '作品ページ →' })
        ])
      ]);
    }

    function drawList() {
      U.clear(listWrap);
      var shown = 0;

      /* --- 1. 教科書の定番教材 ------------------------------------
       * 入試の出典として入れた文章（grade が '入試'）は下のセクションに回す。
       * 文章がまだ無い作品は収録語つきで出すが、入試の出典作品はここには出さない
       * （下のセクションに必ず出るので、二重に並べない）。
       * ---------------------------------------------------------- */
      var classicWrap = el('div');
      var classicCount = 0;
      K.index.works.forEach(function (work) {
        var all = K.index.passagesOfWork(work.id).filter(function (p) {
          return !K.index.isExamPassage(p);
        });
        var list = all.filter(matchGrade);
        var isExamWork = K.index.examsOfWork(work.id).length > 0;
        if (!list.length && (state.grade || isExamWork)) return;
        classicCount += list.length;
        classicWrap.appendChild(workCard(work, list));
      });

      if (classicWrap.childNodes.length) {
        listWrap.appendChild(el('div', { class: 'textbook-section-head' }, [
          el('h2', { class: 'textbook-section-title', text: '教科書の定番教材' }),
          el('p', { class: 'muted small', text: '中学・高校の教科書に繰り返し採られる教材です。学年の目安は編集部の判断によるものなので、目安として使ってください。' })
        ]));
        listWrap.appendChild(classicWrap);
        shown += classicCount;
      }

      /* --- 2. 共通テスト・センター試験の出典作品 -------------------
       * K.index.examWorks（出題年の新しい順）をそのまま並べる。
       * 本文のある作品は文章カード、未収録の作品は畳んだ 1 行。
       * 学年フィルタで「入試」以外を選んでいるときは、このセクションごと出さない。
       * ---------------------------------------------------------- */
      var examWrap = el('div');
      var examCount = 0;
      var showBrief = !state.grade || state.grade === EXAM;
      K.index.examWorks.forEach(function (work) {
        var all = K.index.passagesOfWork(work.id).filter(K.index.isExamPassage);
        var list = all.filter(matchGrade);
        if (list.length) {
          examCount += list.length;
          examWrap.appendChild(workCard(work, list, { exam: true }));
        } else if (showBrief) {
          examCount += 1;
          examWrap.appendChild(examBriefRow(work));
        }
      });

      if (examWrap.childNodes.length) {
        var withText = K.index.passages.filter(K.index.isExamPassage).length;
        listWrap.appendChild(el('div', { class: 'textbook-section-head is-exam' }, [
          el('h2', { class: 'textbook-section-title', text: '共通テスト・センター試験の出典作品' }),
          el('p', { class: 'small', text: '共通テストは、教科書に載っていない作品から出題されます。だからこそ、初見の文章を単語と文法だけで読む練習が要ります。' }),
          el('p', { class: 'small', text: '2016 年度以降の出典 ' + K.index.examWorks.length + ' 作品を、出題年の新しい順に並べました。本文のある ' + withText + ' 編は原文・現代語訳・品詞分解で読め、その文章に出てくる単語だけで学習できます。' }),
          el('p', { class: 'muted small', text: '収めたのは原文と、このアプリのために書き下ろした現代語訳だけです（試験の設問・注・リード文は載せていません）。本文が未収録の作品も、作者・時代・ジャンルと出題された場面が作品ページで読めます。' })
        ]));
        listWrap.appendChild(examWrap);
        shown += examCount;
      }

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

    // アクセス解析（設定が無ければ no-op）
    if (K.analytics) {
      K.analytics.event('passage_view', {
        passage_id: passage.id, work_id: passage.workId || ''
      });
    }

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

    /* 入試の出典から採った文章は、タイトルのそばに出題バッジを出す。
       part / section は works.js 側（同じ年の出題）から借りて説明に添える。
       「この本文がそのまま出題された」とは限らないので（同じ作品の別の場面を
       収めたものがある）、断定はせず、詳しくは passage.note に書いてある。 */
    var pexam = passage.exam || null;
    var workExam = pexam
      ? K.index.examsOfWork(passage.workId).filter(function (e) { return e.year === pexam.year; })[0]
      : null;
    var examInfo = pexam ? Object.assign({}, workExam || {}, pexam) : null;

    section.appendChild(el('header', { class: 'passage-head' }, [
      el('div', { class: 'word-head-badges' },
        (work ? [el('span', { class: 'badge pos', text: work.genre })] : [])
          .concat(gradeBadges(passage))
          .concat(examInfo ? [C.examBadge(examInfo)] : [])),
      el('h1', { class: 'view-title passage-title', text: passage.title }),
      el('p', { class: 'muted', text: (work ? work.title + '　/　' + work.author : '') + (passage.section ? '　/　' + passage.section : '') }),
      examInfo ? el('p', { class: 'passage-exam-note small' }, [
        el('span', {
          text: examInfo.year + ' 年度' + (examInfo.test || '')
            + (examInfo.part && examInfo.part !== '本試験' ? '（' + examInfo.part + '）' : '')
            + 'の出典作品です。'
        }),
        el('a', { href: '#/textbook?grade=' + encodeURIComponent(K.index.EXAM_GRADE), text: 'ほかの出典作品 →' })
      ]) : null
    ]));

    /* --- 本文 ------------------------------------------------------ */
    var bodyWrap = el('div', { class: 'card' });
    var controls = el('div', { class: 'passage-controls' });
    var paras = el('div');

    // 品詞分解（data/tokens/<id>.js）。無ければ null で、従来の描画に落ちる
    var tokenParas = K.index.tokensOf(passage.id);

    function drawBody() {
      U.clear(paras);
      paras.className = 'passage-body layout-' + layout + (showTranslation ? '' : ' no-translation');
      passage.paragraphs.forEach(function (p, i) {
        var toks = tokenParas ? tokenParas[i] : null;
        var orig = el('div', { class: 'passage-orig' }, [
          toks
            ? C.passageTokenLine(entries, toks, { passageId: passage.id })
            : C.passageLine(entries, p.text, passage.id)
        ]);
        // 段落ごとの「品詞分解を表で見る」。原文タップと同じ内容を一覧で読める
        if (toks) {
          orig.appendChild(el('details', { class: 'token-details' }, [
            el('summary', { text: '品詞分解を表で見る' }),
            C.tokenTableOf(toks.map(C.normalizeToken))
          ]));
        }
        paras.appendChild(el('div', { class: 'passage-para' }, [
          orig,
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

    /* 原文の下線は 2 種類あり、説明が無いと区別できないので凡例を出す。
       品詞分解がある文章は「下線の無い語もタップできる」ことを先に言う。 */
    var legend = el('div', { class: 'passage-legend' }, [
      tokenParas ? el('span', { class: 'legend-item' }, [
        el('span', { class: 'legend-sample is-tok', text: 'どの語も' }),
        el('span', { text: 'タップすると品詞・活用・語義が出ます' })
      ]) : null,
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

    /* かつてここに「品詞分解つき例文」の枠があった。
       同じ本文が「原文と現代語訳」と「例文」の 2 か所に出て分かりにくかったので、
       原文そのものを品詞分解から描くようにして枠ごと廃止した。
       品詞分解がまだ無い文章は、原文が従来どおり文字列で描かれるだけで、
       ここに何も足さない（DESIGN.md「品詞分解を足すには」参照）。 */

    /* --- 共有 ------------------------------------------------------ */
    section.appendChild(C.shareButtons({
      label: 'この文章を共有',
      text: (work ? work.title : '') + '『' + passage.title + '』を原文と現代語訳で読む｜古文単語帳',
      url: C.absUrl('#/passage/' + passage.id),
      contentType: 'passage', itemId: passage.id
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
