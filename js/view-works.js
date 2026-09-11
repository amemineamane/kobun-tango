/* =====================================================================
 * js/view-works.js — 作品ページ（#/work/:workId）
 * ---------------------------------------------------------------------
 * 作品の一覧は「教科書」（#/textbook、js/view-passages.js）が兼ねる。
 * 入口を 1 本にしたので、このファイルは作品 1 件の詳細だけを描く。
 * 旧 URL の #/works は router.js が #/textbook に転送する。
 *
 * 作品ページの「収録語」は
 *     passages.vocab の wordId  ∪  品詞分解（data/tokens/*.js）の w
 *     ∪  data/workWords.js の手動タグ
 * の和集合（計算は js/data-index.js の wordsByWork）。
 * ===================================================================== */
(function () {
  'use strict';

  var K = window.KOBUN;
  var U = K.util;
  var C = K.components;
  var el = U.el;

  /* ---------------------------------------------------------------
   * 作品詳細
   * ------------------------------------------------------------- */
  function renderDetail(params, query, container) {
    var work = K.index.getWork(params.workId);
    if (!work) {
      container.appendChild(el('div', { class: 'notice error' }, [
        el('h2', { text: '作品が見つかりません' }),
        el('p', { text: 'id = ' + params.workId + ' の作品はありません。' }),
        el('p', {}, [el('a', { href: '#/textbook', text: '教科書へ' })])
      ]));
      return;
    }

    var words = K.index.wordsByWork.get(work.id) || [];

    // 収録語の「由来」を分ける（文章 / 手動タグ）
    var inPassage = new Set();
    K.index.passagesOfWork(work.id).forEach(function (p) {
      (p.vocab || []).forEach(function (v) { if (v.wordId != null) inPassage.add(v.wordId); });
      // 品詞分解の w も「文章に出てくる語」の根拠
      (K.index.tokensOf(p.id) || []).forEach(function (list) {
        (list || []).forEach(function (t) { if (t && t.w != null) inPassage.add(t.w); });
      });
    });

    // 入試（共通テスト・センター試験）の出題歴。新しい順。無ければ []
    var exams = K.index.examsOfWork(work.id);

    var section = el('section', { class: 'view view-work' }, [
      el('div', { class: 'crumbs' }, [el('a', { href: '#/textbook', text: '← 教科書' })]),
      el('header', { class: 'work-head' }, [
        el('h1', { class: 'view-title', text: work.title }),
        exams.length ? el('p', { class: 'work-exam-badges' }, C.examBadges(exams)) : null,
        el('p', { class: 'work-meta muted', text: work.author + '　/　' + work.era + '　/　' + work.genre }),
        el('p', { class: 'work-summary', text: work.summary })
      ])
    ]);

    /* --- 入試での出題 ---------------------------------------------
     * 年・試験・本試験/第1日程・出題箇所を 1 か所にまとめて出す。
     * 本文が未収録の作品では、このカードと summary・収録語がページの中身になる。
     * ------------------------------------------------------------- */
    if (exams.length) {
      section.appendChild(el('div', { class: 'card exam-card' }, [
        el('h2', { class: 'card-title', text: '入試での出題' }),
        el('ul', { class: 'exam-list' }, exams.map(function (e) {
          return el('li', { class: 'exam-list-item' }, [
            C.examBadge(e),
            el('span', { class: 'exam-list-part', text: e.part || '' }),
            (e.section && e.section !== '—')
              ? el('span', { class: 'exam-list-section muted', text: '出題箇所：' + e.section })
              : null
          ]);
        })),
        el('p', { class: 'muted small', text: '大学入学共通テスト（2021 年度〜）・センター試験（2016〜2020 年度）の国語・古文の出典です。試験の設問・注・リード文は載せていません（大学入試センターの著作物のため）。' }),
        el('p', { class: 'home-more' }, [
          el('a', { href: '#/textbook?grade=' + encodeURIComponent(K.index.EXAM_GRADE), text: 'ほかの出典作品を見る →' })
        ])
      ]));
    }

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
    } else {
      /* 本文が未収録の作品（入試の出典として作品情報だけ登録したものが中心）。
         何も出さないとページが空に見えるので、理由と次の一手を書いておく。 */
      section.appendChild(el('div', { class: 'card' }, [
        el('h2', { class: 'card-title', text: '文章（教材）' }),
        el('p', { class: 'muted', text: exams.length
          ? '本文は未収録です。信頼できる翻刻を確認できた作品から順に収めているため、この作品は作品情報（作者・時代・ジャンルと出題された場面）だけを載せています。'
          : 'この作品の文章はまだ収録していません。' }),
        exams.length ? el('p', { class: 'home-more' }, [
          el('a', { href: '#/textbook?grade=' + encodeURIComponent(K.index.EXAM_GRADE), text: '本文つきの出典作品を読む →' })
        ]) : null
      ]));
    }

    /* --- 収録語 --- */
    var listWrap = el('div', { class: 'word-list' });
    words.forEach(function (w) {
      var row = C.wordRow(w);
      var head = row.querySelector('.word-row-head');
      if (inPassage.has(w.id)) {
        head.appendChild(el('span', {
          class: 'badge src src-passage', text: '文章',
          title: 'この作品の文章に出てくる語（passages.vocab または品詞分解の w）'
        }));
      } else {
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
      el('p', { class: 'muted small', text: '「data/passages.js の文章の語」「品詞分解（data/tokens）の重要語」「data/workWords.js の手動タグ」の和集合です。' }),
      // 収録語が 1 語も無い作品（本文未収録の出典作品）では、
      // 空のデッキに送っても仕方がないのでボタンを出さない
      words.length ? el('div', { class: 'deck-links' }, [
        el('a', { class: 'btn btn-primary', href: '#/study' + qs, text: 'この作品の単語で学習' }),
        el('a', { class: 'btn', href: '#/quiz' + qs, text: 'この作品の単語でクイズ' }),
        el('a', { class: 'btn btn-ghost', href: '#/words' + qs, text: '一覧で見る' })
      ]) : null,
      words.length ? listWrap : el('p', { class: 'muted', text: 'まだ紐づいた語がありません。本文を収めるか、data/workWords.js にこの作品で押さえたい語を足すと、ここに並びます。' })
    ]));

    /* --- 共有 --- */
    section.appendChild(C.shareButtons({
      label: 'この作品を共有',
      text: '『' + work.title + '』の単語と文章｜古文単語帳',
      url: C.absUrl('#/work/' + work.id),
      contentType: 'work', itemId: work.id
    }));

    container.appendChild(section);
  }

  K.views = K.views || {};
  K.views.work = { render: renderDetail };
})();
