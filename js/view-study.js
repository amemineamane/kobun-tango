/* =====================================================================
 * js/view-study.js — フラッシュカード（#/study）
 * ---------------------------------------------------------------------
 * 単語一覧と同じクエリでデッキを作る（#/study?level=S&pos=敬語）。
 * 表：見出し語 → タップ／Space で 裏：語義（＋例文があれば 1 つ）
 * 「覚えた／まだ」で localStorage に記録する（キーは id）。
 *
 * キーボード:
 *   Space / Enter … めくる
 *   →             … 覚えた
 *   ←             … まだ（苦手）
 * ===================================================================== */
(function () {
  'use strict';

  var K = window.KOBUN;
  var U = K.util;
  var C = K.components;
  var el = U.el;

  function render(params, query, container) {
    var state = Object.assign({ sort: 'kana' }, query);
    // ?passage= があればその文章の語（文章固有語を含む）がデッキになる
    var deck = C.applyFilters(C.deckSource(state), state);
    var shuffled = K.store.getPref('studyShuffle', true);
    if (shuffled) deck = U.shuffle(deck);

    // ホームの「続きから」用に、いま学習しているデッキの条件を覚えておく
    if (deck.length) {
      K.store.setRecent('deck', {
        query: U.buildQuery(state),
        label: C.deckLabel(state),
        count: deck.length
      });
    }

    var i = 0;
    var flipped = false;
    var done = { known: 0, weak: 0 };

    var section = el('section', { class: 'view view-study' });
    var stage = el('div', { class: 'study-stage' });
    var filterWrap = el('div');

    function onChange(patch) {
      Object.assign(state, patch);
      K.router.setQuery(patch);
    }

    function drawFilters() {
      U.clear(filterWrap);
      filterWrap.appendChild(C.filterBar(state, onChange, { showSort: false }));
      filterWrap.appendChild(el('label', { class: 'field field-check' }, [
        el('input', {
          type: 'checkbox', id: 'f-shuffle', checked: shuffled,
          onChange: function (e) {
            K.store.setPref('studyShuffle', e.target.checked);
            K.router.render();
          }
        }),
        el('span', { text: 'カードをシャッフルする' })
      ]));
    }

    function answer(status) {
      var w = deck[i];
      if (!w) return;
      K.store.setStatus(w.id, status);
      if (status === 'known') done.known++; else done.weak++;
      i++;
      flipped = false;
      draw();
    }

    function flip() { flipped = !flipped; draw(); }

    function draw() {
      U.clear(stage);

      if (deck.length === 0) {
        stage.appendChild(el('div', { class: 'notice' }, [
          el('p', { text: '条件に合う語がありません。上のフィルタをゆるめてください。' })
        ]));
        return;
      }

      if (i >= deck.length) {
        stage.appendChild(el('div', { class: 'study-done card' }, [
          el('h2', { text: 'デッキを 1 周しました' }),
          el('p', {}, [
            el('span', { class: 'big', text: String(deck.length) }), ' 語中　',
            el('b', { text: '覚えた ' + done.known }), '　／　',
            el('b', { text: 'まだ ' + done.weak })
          ]),
          el('div', { class: 'deck-links' }, [
            el('button', {
              class: 'btn btn-primary', type: 'button', text: 'もう一周',
              onClick: function () { i = 0; flipped = false; done = { known: 0, weak: 0 }; if (shuffled) deck = U.shuffle(deck); draw(); }
            }),
            el('button', {
              class: 'btn', type: 'button', text: '「まだ」の語だけで復習',
              onClick: function () {
                deck = deck.filter(function (w) { return K.store.getStatus(w.id) !== 'known'; });
                i = 0; flipped = false; done = { known: 0, weak: 0 }; draw();
              }
            }),
            el('a', { class: 'btn btn-ghost', href: '#/quiz' + U.buildQuery(state), text: 'クイズに進む' })
          ])
        ]));
        return;
      }

      var w = deck[i];
      var examples = K.index.examplesOf(w.id);

      var card = el('div', {
        class: 'flashcard' + (flipped ? ' flipped' : ''),
        tabindex: '0',
        role: 'button',
        'aria-label': flipped ? '裏面。タップで表に戻ります' : '表面。タップで語義を表示します',
        onClick: function (e) {
          if (e.target.closest && e.target.closest('a,button')) return;
          flip();
        }
      }, [
        el('div', { class: 'flashcard-badges' }, [
          C.levelBadge(w), C.posBadge(w), C.statusBadge(w.id)
        ]),
        el('div', { class: 'flashcard-front' }, [
          el('div', { class: 'flashcard-kana', text: w.kana }),
          flipped && w.kanji ? el('div', { class: 'flashcard-kanji', text: '〔' + w.kanji + '〕' }) : null
        ]),
        flipped
          ? el('div', { class: 'flashcard-back' }, [
            el('ol', { class: 'meaning-list' }, w.meanings.map(function (m) { return el('li', { text: m }); })),
            w.isPassageWord
              ? el('p', { class: 'muted small', text: '本文の形：' + w.surface + '　（「' + w.passageTitle + '」の脚注語）' })
              : null,
            w.isPassageWord && w.note
              ? el('p', { class: 'muted small' + (/要確認/.test(w.note) ? ' needs-check' : ''), text: w.note })
              : null,
            examples.length
              ? el('div', { class: 'flashcard-example' }, [
                el('h3', { class: 'small muted', text: '例文（' + (K.index.getWork(examples[0].workId) || {}).title + '）' }),
                C.sentence(examples[0], { highlightWordId: w.id }),
                el('p', { class: 'example-translation', text: examples[0].translation })
              ])
              : null,
            el('p', { class: 'flashcard-more' }, [
              el('a', {
                href: C.wordHref(w),
                text: w.isPassageWord ? '「' + w.passageTitle + '」を読む →' : '詳細ページを開く →'
              })
            ])
          ])
          : el('p', { class: 'flashcard-hint muted', text: 'タップ（または Space）で語義を表示' })
      ]);

      var bar = el('div', { class: 'study-bar' }, [
        el('div', { class: 'progress' }, [
          el('div', { class: 'progress-fill', style: { width: (i / deck.length * 100) + '%' } })
        ]),
        el('p', { class: 'progress-text muted', text: (i + 1) + ' / ' + deck.length + '　（覚えた ' + done.known + '・まだ ' + done.weak + '）' })
      ]);

      var actions = el('div', { class: 'study-actions' }, [
        el('button', { class: 'btn btn-weak', type: 'button', text: 'まだ（←）', onClick: function () { answer('weak'); } }),
        el('button', { class: 'btn btn-flip', type: 'button', text: flipped ? '表に戻す' : 'めくる（Space）', onClick: flip }),
        el('button', { class: 'btn btn-known', type: 'button', text: '覚えた（→）', onClick: function () { answer('known'); } })
      ]);

      stage.appendChild(bar);
      stage.appendChild(card);
      stage.appendChild(actions);
      card.focus();
    }

    function onKey(e) {
      if (!document.body.contains(stage)) { document.removeEventListener('keydown', onKey); return; }
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); answer('known'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); answer('weak'); }
    }
    document.addEventListener('keydown', onKey);

    section.appendChild(el('h1', { class: 'view-title', text: '学習（フラッシュカード）' }));
    section.appendChild(filterWrap);
    section.appendChild(stage);
    container.appendChild(section);

    drawFilters();
    draw();
  }

  K.views = K.views || {};
  K.views.study = { render: render };
})();
