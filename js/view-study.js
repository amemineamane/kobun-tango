/* =====================================================================
 * js/view-study.js — フラッシュカード（#/study）
 * ---------------------------------------------------------------------
 * 単語一覧と同じクエリでデッキを作る（#/study?level=S&pos=敬語）。
 * 表：見出し語 → タップ／Space で 裏：語義（＋用例があれば 1 つ）
 * 「覚えた／まだ」で localStorage に記録する（キーは id）。
 *
 * 【めくる前は判定させない】
 *   表面では「覚えた／まだ」のボタンを disabled にし、← → もスワイプも
 *   受け付けない（押されたらボタンの下に「先にめくって答えを確認」と出す）。
 *   答えを見ずに記録が付くと、進捗が学習の実態とずれるため。
 *
 * 【操作は 3 通り・入口は answer() 1 つ】
 *   キーボード … Space / Enter でめくる、→ 覚えた、← まだ
 *   ボタン     … まだ／めくる／覚えた
 *   スワイプ   … 裏面で右へ 80px 以上＝覚えた、左へ 80px 以上＝まだ
 *                （Pointer Events。指でもマウスのドラッグでも同じ。
 *                  縦スクロールは touch-action: pan-y で妨げない）
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
    var reported = false;   // study_complete を 1 周につき 1 回だけ送るための印

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

    /* 「覚えた／まだ」の入口はここ 1 つ。ボタン・キーボード・スワイプが
       すべてこの関数を呼ぶ（記録の仕方を変えるときに触る場所を 1 か所にする）。 */
    function answer(status) {
      var w = deck[i];
      if (!w) return;
      if (!flipped) { needFlip(); return; }   // めくる前は選べない
      K.store.setStatus(w.id, status);
      if (status === 'known') done.known++; else done.weak++;
      i++;
      flipped = false;
      draw();
    }

    function flip() { flipped = !flipped; draw(); }

    /* めくる前に「覚えた／まだ」を押した／スワイプしたときの一言。
       ボタンの下に出して 1.6 秒で消す（role="status" なので読み上げにも乗る）。 */
    var hintEl = null;
    var hintTimer = null;
    function needFlip() {
      if (!hintEl) return;
      hintEl.textContent = '先にめくって答えを確認してください。';
      clearTimeout(hintTimer);
      hintTimer = setTimeout(function () { if (hintEl) hintEl.textContent = ''; }, 1600);
    }

    /* ---------------------------------------------------------------
     * スワイプで「覚えた／まだ」（裏面だけ）
     * -------------------------------------------------------------
     * Pointer Events で書くので、指でもマウスのドラッグでも同じ動きになる。
     * 縦スクロールは邪魔しない（CSS の touch-action: pan-y ＋
     * 最初の数ピクセルで「縦に振った」と判断したら横の追従をやめる）。
     * 判定は裏面だけ。表面では動かしても戻るだけで、ヒントを出す。
     * 記録は必ず answer() を通す（ボタン・キーボードと同じ道）。
     * ------------------------------------------------------------- */
    var SWIPE_MIN = 80;    // これ以上ヨコに動かしたら確定
    var SWIPE_SLOP = 8;    // これ未満は「タップ」。めくる動作を邪魔しない
    var FLY_MS = 180;      // 確定したカードが画面外へ飛ぶ時間
    var swiped = false;    // スワイプの終わりを click（＝めくる）に拾わせない印

    function reducedMotion() {
      try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
      catch (e) { return false; }
    }

    function attachSwipe(card, labelKnown, labelWeak) {
      var startX = 0, startY = 0, dx = 0;
      var active = false, axis = '', pid = null, finished = false;

      function paint(x) {
        // 表面は「動くけれど決まらない」ことが伝わる程度に減衰させる
        var move = flipped ? x : x * 0.28;
        card.style.transform = 'translateX(' + move + 'px) rotate(' + (move / 22) + 'deg)';
        if (!flipped) return;
        var t = Math.min(1, Math.abs(x) / SWIPE_MIN);
        labelKnown.style.opacity = x > 0 ? t : 0;
        labelWeak.style.opacity = x < 0 ? t : 0;
      }

      function reset() {
        card.classList.remove('is-dragging');
        card.classList.add('is-returning');
        card.style.transform = '';
        labelKnown.style.opacity = 0;
        labelWeak.style.opacity = 0;
        setTimeout(function () { card.classList.remove('is-returning'); }, 220);
      }

      function fly(status) {
        finished = true;
        if (reducedMotion()) { answer(status); return; }
        var dir = status === 'known' ? 1 : -1;
        card.classList.remove('is-dragging');
        card.classList.add('is-flying');
        card.style.transform =
          'translateX(' + (dir * (window.innerWidth || 400)) + 'px) rotate(' + (dir * 18) + 'deg)';
        setTimeout(function () { answer(status); }, FLY_MS);
      }

      card.addEventListener('pointerdown', function (e) {
        if (finished) return;
        if (e.button != null && e.button > 0) return;           // 右クリックなどは無視
        if (e.target.closest && e.target.closest('a,button')) return;
        active = true; axis = ''; dx = 0; swiped = false;
        startX = e.clientX; startY = e.clientY; pid = e.pointerId;
      });

      card.addEventListener('pointermove', function (e) {
        if (!active || e.pointerId !== pid) return;
        dx = e.clientX - startX;
        var dy = e.clientY - startY;
        if (!axis) {
          if (Math.abs(dx) < SWIPE_SLOP && Math.abs(dy) < SWIPE_SLOP) return;
          axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
          if (axis === 'x') {
            card.classList.add('is-dragging');
            try { card.setPointerCapture(pid); } catch (err) { /* 無くても動く */ }
          }
        }
        if (axis !== 'x') return;    // 縦に振ったらスクロールに譲る
        paint(dx);
      });

      function end() {
        if (!active) return;
        active = false;
        try { card.releasePointerCapture(pid); } catch (err) { /* 取っていなければ何もしない */ }
        pid = null;
        if (axis !== 'x') return;
        swiped = Math.abs(dx) >= SWIPE_SLOP;
        if (Math.abs(dx) >= SWIPE_MIN) {
          if (flipped) { fly(dx > 0 ? 'known' : 'weak'); return; }
          needFlip();                // 表面では判定しない
        }
        reset();
      }

      card.addEventListener('pointerup', end);
      card.addEventListener('pointercancel', end);
    }

    function draw() {
      U.clear(stage);

      if (deck.length === 0) {
        stage.appendChild(el('div', { class: 'notice' }, [
          el('p', { text: '条件に合う語がありません。上のフィルタをゆるめてください。' })
        ]));
        return;
      }

      if (i >= deck.length) {
        // アクセス解析：1 周ぶんの集計を 1 件だけ（語ごとの「覚えた／まだ」は送らない）
        if (K.analytics && !reported) {
          reported = true;
          K.analytics.event('study_complete', Object.assign(K.analytics.deck(state), {
            count: deck.length, known: done.known, weak: done.weak
          }));
        }

        var doneCard = el('div', { class: 'study-done card' }, [
          el('h2', { text: 'デッキを 1 周しました' }),
          el('p', {}, [
            el('span', { class: 'big', text: String(deck.length) }), ' 語中　',
            el('b', { text: '覚えた ' + done.known }), '　／　',
            el('b', { text: 'まだ ' + done.weak })
          ]),
          el('div', { class: 'deck-links' }, [
            el('button', {
              class: 'btn btn-primary', type: 'button', text: 'もう一周',
              onClick: function () { i = 0; flipped = false; done = { known: 0, weak: 0 }; reported = false; if (shuffled) deck = U.shuffle(deck); draw(); }
            }),
            el('button', {
              class: 'btn', type: 'button', text: '「まだ」の語だけで復習',
              onClick: function () {
                deck = deck.filter(function (w) { return K.store.getStatus(w.id) !== 'known'; });
                i = 0; flipped = false; done = { known: 0, weak: 0 }; reported = false; draw();
              }
            }),
            el('a', { class: 'btn btn-ghost', href: '#/quiz' + U.buildQuery(state), text: 'クイズに進む' })
          ])
        ]);

        /* 完走したときだけ共有を出す（途中では出さない）。
           リンク先は同じ条件で学習を始められる URL にする。 */
        var shareQuery = {};
        ['q', 'level', 'pos', 'row', 'work', 'passage', 'status'].forEach(function (k) {
          if (state[k]) shareQuery[k] = state[k];
        });
        doneCard.appendChild(C.shareButtons({
          label: '結果を共有',
          text: '古文単語帳のフラッシュカードで【' + C.deckLabel(state) + '】' + deck.length +
            ' 語を 1 周しました！',
          url: C.absUrl('#/study' + U.buildQuery(shareQuery)),
          contentType: 'study', itemId: K.analytics ? K.analytics.deck(state).deck_id : ''
        }));
        stage.appendChild(doneCard);
        return;
      }

      var w = deck[i];
      // 用例＝この語が出てくる段落（品詞分解の w が根拠）
      var usage = C.usageFor(w.id);

      // スワイプ中に浮き出るラベル（既定は透明。attachSwipe が濃さを動かす）
      var labelKnown = el('div', { class: 'swipe-label swipe-known', 'aria-hidden': 'true', text: '覚えた' });
      var labelWeak = el('div', { class: 'swipe-label swipe-weak', 'aria-hidden': 'true', text: 'まだ' });

      /* スワイプの使い方は初回の裏面で 1 度だけ出す（見たら prefs に記録）。 */
      var swipeHint = null;
      if (flipped && !K.store.getPref('studySwipeHintSeen', false)) {
        swipeHint = el('p', { class: 'flashcard-swipe-hint muted small', text: '← まだ　／　覚えた →　（スワイプでも選べます）' });
        K.store.setPref('studySwipeHintSeen', true);
      }

      var card = el('div', {
        class: 'flashcard' + (flipped ? ' flipped' : ''),
        tabindex: '0',
        role: 'button',
        'aria-label': flipped
          ? '裏面。タップで表に戻ります。右スワイプで覚えた、左スワイプでまだ'
          : '表面。タップで語義を表示します',
        onClick: function (e) {
          if (e.target.closest && e.target.closest('a,button')) return;
          if (swiped) return;   // スワイプの終わりをクリックとして拾わない
          flip();
        }
      }, [
        labelKnown,
        labelWeak,
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
            usage
              ? el('div', { class: 'flashcard-example' }, [
                el('h3', { class: 'small muted', text: '用例（' + usage.label + '）' }),
                usage.line,
                el('p', { class: 'example-translation', text: usage.translation })
              ])
              : null,
            el('p', { class: 'flashcard-more' }, [
              el('a', {
                href: C.wordHref(w),
                text: w.isPassageWord ? '「' + w.passageTitle + '」を読む →' : '詳細ページを開く →'
              })
            ]),
            swipeHint
          ])
          : el('p', { class: 'flashcard-hint muted', text: 'タップ（または Space）で語義を表示' })
      ]);

      attachSwipe(card, labelKnown, labelWeak);

      var bar = el('div', { class: 'study-bar' }, [
        el('div', { class: 'progress' }, [
          el('div', { class: 'progress-fill', style: { width: (i / deck.length * 100) + '%' } })
        ]),
        el('p', { class: 'progress-text muted', text: (i + 1) + ' / ' + deck.length + '　（覚えた ' + done.known + '・まだ ' + done.weak + '）' })
      ]);

      /* めくる前は「覚えた／まだ」を選べない（答えを見てから決めてもらう）。
         disabled にすると押しても何も起きず理由が分からないので、
         枠だけ押せる別ボタンにはせず、包むラッパでクリックを拾ってヒントを出す。 */
      function judgeBtn(cls, label, status) {
        var btn = el('button', {
          class: 'btn ' + cls, type: 'button', text: label,
          disabled: !flipped,
          'aria-disabled': flipped ? null : 'true',
          onClick: function () { answer(status); }
        });
        if (flipped) return btn;
        // disabled のボタンはクリックイベントを出さないので、覆いで拾う
        return el('span', {
          class: 'judge-slot',
          onClick: needFlip
        }, [btn]);
      }

      var actions = el('div', { class: 'study-actions' + (flipped ? '' : ' is-front') }, [
        judgeBtn('btn-weak', 'まだ（←）', 'weak'),
        el('button', {
          class: 'btn btn-flip' + (flipped ? '' : ' btn-primary'), type: 'button',
          text: flipped ? '表に戻す' : 'めくる（Space）', onClick: flip
        }),
        judgeBtn('btn-known', '覚えた（→）', 'known')
      ]);

      hintEl = el('p', { class: 'study-hint muted small', role: 'status', 'aria-live': 'polite' });

      stage.appendChild(bar);
      stage.appendChild(card);
      stage.appendChild(actions);
      stage.appendChild(hintEl);
      card.focus();
    }

    function onKey(e) {
      if (!document.body.contains(stage)) { document.removeEventListener('keydown', onKey); return; }
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
      // ← → はめくった後だけ。表面では answer() がヒントを出して何もしない
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
