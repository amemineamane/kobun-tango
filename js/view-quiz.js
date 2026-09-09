/* =====================================================================
 * js/view-quiz.js — 4択クイズ（#/quiz）
 * ---------------------------------------------------------------------
 * SCHEMA.md の例のとおり、誤答（ディストラクタ）は **同じ品詞の別語** から取る。
 * 同じ品詞から 3 つ取れない場合だけ、全体から補う。
 * 出題は単語一覧と同じクエリで絞れる（#/quiz?level=S&pos=敬語）。
 *
 * #/quiz?passage=<id> なら、その文章に出てくる語だけが出題対象になる。
 * このとき誤答の母集団もその文章の語なので「同じ文章の他の語」が並ぶ。
 * 8 語に満たない小さな文章では母集団を 330 語に広げ、同品詞から補う。
 *
 * 出題形式:
 *   'w2m' 語 → 意味（既定）
 *   'm2w' 意味 → 語
 *
 * 結果は localStorage に記録する（正解なら status を 'known'、
 * 不正解なら 'weak' に。store.recordAnswer が面倒を見る）。
 * ===================================================================== */
(function () {
  'use strict';

  var K = window.KOBUN;
  var U = K.util;
  var C = K.components;
  var el = U.el;

  /** 同品詞から誤答を 3 つ選ぶ */
  function pickDistractors(answer, pool, mode) {
    var used = new Set([answer.primaryMeaning]);
    var samePos = pool.filter(function (w) {
      return w.pos === answer.pos && w.id !== answer.id;
    });
    var chosen = [];
    function take(list) {
      U.shuffle(list).forEach(function (w) {
        if (chosen.length >= 3) return;
        var key = mode === 'm2w' ? w.kana : w.primaryMeaning;
        var ansKey = mode === 'm2w' ? answer.kana : answer.primaryMeaning;
        if (key === ansKey) return;              // 見た目が同じ選択肢は除く
        if (used.has(key)) return;
        used.add(key);
        chosen.push(w);
      });
    }
    take(samePos);
    if (chosen.length < 3) {
      take(pool.filter(function (w) { return w.id !== answer.id && chosen.indexOf(w) < 0; }));
    }
    if (chosen.length < 3) {
      take(K.index.words.filter(function (w) { return w.id !== answer.id && chosen.indexOf(w) < 0; }));
    }
    return chosen.slice(0, 3);
  }

  function buildQuestions(deck, count, mode) {
    var pool = deck.length >= 8 ? deck : K.index.words; // 誤答の母集団
    return U.shuffle(deck).slice(0, count).map(function (w) {
      var distractors = pickDistractors(w, pool, mode);
      var choices = U.shuffle([w].concat(distractors));
      return { word: w, choices: choices };
    });
  }

  function render(params, query, container) {
    var state = Object.assign({ sort: 'kana' }, query);
    var mode = state.mode === 'm2w' ? 'm2w' : 'w2m';
    var count = Number(state.count) || Number(K.store.getPref('quizCount', 10)) || 10;

    // ?passage= があればその文章の語（文章固有語を含む）が出題対象になる
    var deck = C.applyFilters(C.deckSource(state), state);
    var questions = [];
    var qi = 0;
    var answers = [];   // { word, chosen, correct }
    var locked = false;

    var section = el('section', { class: 'view view-quiz' });
    var filterWrap = el('div');
    var setupWrap = el('div', { class: 'quiz-setup' });
    var stage = el('div', { class: 'quiz-stage' });

    function onChange(patch) {
      Object.assign(state, patch);
      K.router.setQuery(patch);
    }

    function drawFilters() {
      U.clear(filterWrap);
      filterWrap.appendChild(C.filterBar(state, onChange, { showSort: false }));
    }

    function drawSetup() {
      U.clear(setupWrap);
      setupWrap.appendChild(el('div', { class: 'quiz-options' }, [
        el('label', { class: 'field' }, [
          el('span', { class: 'field-label', text: '出題形式' }),
          el('select', {
            onChange: function (e) { onChange({ mode: e.target.value }); }
          }, [
            (function () { var o = el('option', { value: 'w2m', text: '語 → 意味' }); if (mode === 'w2m') o.selected = true; return o; })(),
            (function () { var o = el('option', { value: 'm2w', text: '意味 → 語' }); if (mode === 'm2w') o.selected = true; return o; })()
          ])
        ]),
        el('label', { class: 'field' }, [
          el('span', { class: 'field-label', text: '問題数' }),
          el('select', {
            onChange: function (e) {
              K.store.setPref('quizCount', Number(e.target.value));
              onChange({ count: e.target.value });
            }
          }, [5, 10, 20, 30].map(function (n) {
            var o = el('option', { value: n, text: n + ' 問' });
            if (n === count) o.selected = true;
            return o;
          }))
        ]),
        el('p', { class: 'muted small', text: '出題対象：' + deck.length + ' 語（誤答は同じ品詞の語から選びます）' })
      ]));
    }

    function start() {
      questions = buildQuestions(deck, Math.min(count, deck.length), mode);
      qi = 0;
      answers = [];
      locked = false;
      drawQuestion();
    }

    function drawStart() {
      U.clear(stage);
      if (deck.length < 4) {
        stage.appendChild(el('div', { class: 'notice' }, [
          el('p', { text: '4択にするには最低 4 語必要です（今の条件では ' + deck.length + ' 語）。フィルタをゆるめてください。' })
        ]));
        return;
      }
      stage.appendChild(el('div', { class: 'card quiz-start' }, [
        el('p', {}, [
          el('b', { text: String(Math.min(count, deck.length)) }), ' 問出題します。'
        ]),
        el('button', { class: 'btn btn-primary btn-lg', type: 'button', text: 'はじめる', onClick: start })
      ]));
    }

    function drawQuestion() {
      U.clear(stage);
      if (qi >= questions.length) { drawResult(); return; }
      var q = questions[qi];
      var w = q.word;

      var promptText = mode === 'm2w' ? w.primaryMeaning : w.kana;
      var promptSub = mode === 'm2w'
        ? '（' + w.pos + '・' + w.levelLabel + '）'
        : (w.kanji ? '〔' + w.kanji + '〕' : '');

      var choicesWrap = el('div', { class: 'quiz-choices' });
      var feedback = el('div', { class: 'quiz-feedback' });

      q.choices.forEach(function (c, n) {
        var label = mode === 'm2w' ? c.kana : c.primaryMeaning;
        var btn = el('button', {
          type: 'button',
          class: 'quiz-choice',
          onClick: function () { choose(c, btn); }
        }, [
          el('span', { class: 'choice-num', text: String(n + 1) }),
          el('span', { class: 'choice-label', text: label })
        ]);
        choicesWrap.appendChild(btn);
      });

      function choose(c, btn) {
        if (locked) return;
        locked = true;
        var correct = c.id === w.id;
        K.store.recordAnswer(w.id, correct);
        answers.push({ word: w, chosen: c, correct: correct });

        Array.prototype.forEach.call(choicesWrap.children, function (b, n) {
          b.disabled = true;
          var cw = q.choices[n];
          if (cw.id === w.id) b.classList.add('is-correct');
        });
        if (!correct) btn.classList.add('is-wrong');

        U.clear(feedback);
        feedback.appendChild(el('p', { class: 'feedback-line ' + (correct ? 'ok' : 'ng'), text: correct ? '正解' : '不正解' }));
        feedback.appendChild(el('div', { class: 'feedback-word' }, [
          el('a', { href: C.wordHref(w), class: 'feedback-kana', text: w.kana }),
          w.kanji ? el('span', { class: 'muted', text: '〔' + w.kanji + '〕' }) : null,
          el('span', { class: 'badge pos', text: w.pos }),
          C.levelBadge(w)
        ]));
        feedback.appendChild(el('p', { class: 'feedback-meaning', text: w.meanings.join('／') }));
        if (w.isPassageWord) {
          feedback.appendChild(el('p', {
            class: 'muted small',
            text: '本文の形：' + w.surface + '　（「' + w.passageTitle + '」の脚注語）'
          }));
        }
        // 用例＝この語が出てくる段落（品詞分解の w が根拠）
        var usage = C.usageFor(w.id);
        if (usage) {
          feedback.appendChild(usage.line);
          feedback.appendChild(el('p', { class: 'example-translation', text: usage.translation }));
        }
        feedback.appendChild(el('button', {
          class: 'btn btn-primary', type: 'button',
          text: qi + 1 >= questions.length ? '結果を見る' : '次の問題 →',
          onClick: function () { qi++; locked = false; drawQuestion(); }
        }));
        feedback.querySelector('.btn').focus();
      }

      stage.appendChild(el('div', { class: 'quiz-progress' }, [
        el('div', { class: 'progress' }, [
          el('div', { class: 'progress-fill', style: { width: (qi / questions.length * 100) + '%' } })
        ]),
        el('p', { class: 'progress-text muted', text: '第 ' + (qi + 1) + ' 問 / ' + questions.length })
      ]));
      stage.appendChild(el('div', { class: 'card quiz-card' }, [
        el('p', { class: 'quiz-prompt-label muted', text: mode === 'm2w' ? 'この意味の語は？' : 'この語の意味は？' }),
        el('p', { class: 'quiz-prompt', text: promptText }),
        promptSub ? el('p', { class: 'quiz-prompt-sub muted', text: promptSub }) : null,
        choicesWrap,
        feedback
      ]));
    }

    function drawResult() {
      var correct = answers.filter(function (a) { return a.correct; }).length;
      K.store.pushQuizResult({ total: answers.length, correct: correct, mode: mode, filter: state });

      U.clear(stage);
      var wrongs = answers.filter(function (a) { return !a.correct; });
      var pct = Math.round(correct / (answers.length || 1) * 100);

      var resultCard = el('div', { class: 'card quiz-result' }, [
        el('h2', { text: '結果' }),
        el('p', { class: 'score' }, [
          el('span', { class: 'big', text: String(correct) }),
          ' / ' + answers.length + ' 問正解',
          el('span', { class: 'score-pct muted', text: '（' + Math.round(correct / (answers.length || 1) * 100) + '%）' })
        ]),
        el('div', { class: 'progress score-bar' }, [
          el('div', {
            class: 'progress-fill',
            style: { width: (correct / (answers.length || 1) * 100) + '%' }
          })
        ]),
        el('p', { class: 'muted', text: '正解した語は「覚えた」、間違えた語は「苦手」として保存しました。' }),
        el('div', { class: 'deck-links' }, [
          el('button', { class: 'btn btn-primary', type: 'button', text: 'もう一度', onClick: start }),
          wrongs.length ? el('button', {
            class: 'btn', type: 'button', text: '間違えた語だけ出題',
            onClick: function () {
              deck = wrongs.map(function (a) { return a.word; });
              count = deck.length;
              start();
            }
          }) : null,
          el('a', { class: 'btn btn-ghost', href: '#/words' + U.buildQuery({ status: 'weak' }), text: '苦手な語を一覧で見る' })
        ])
      ]);

      /* 共有。リンク先は「結果画面」ではなく **同じ条件でクイズを始められる URL**
         にする（結果は端末の中にしかないので、開いた人が同じ土俵で挑戦できる形が良い）。
         問題数は実際に解いた数を渡す。 */
      var shareQuery = {};
      ['q', 'level', 'pos', 'row', 'work', 'passage', 'status', 'mode'].forEach(function (k) {
        if (state[k]) shareQuery[k] = state[k];
      });
      shareQuery.count = answers.length;
      resultCard.appendChild(C.shareButtons({
        label: '結果を共有',
        text: '古文単語クイズ ' + answers.length + ' 問中 ' + correct + ' 問正解（正答率 ' + pct + '%）！【' +
          C.deckLabel(state) + '】',
        url: C.absUrl('#/quiz' + U.buildQuery(shareQuery))
      }));
      stage.appendChild(resultCard);

      if (wrongs.length) {
        var list = el('div', { class: 'word-list' });
        wrongs.forEach(function (a) { list.appendChild(C.wordRow(a.word)); });
        stage.appendChild(el('div', { class: 'card' }, [
          el('h2', { class: 'card-title', text: '間違えた語（' + wrongs.length + '）' }),
          list
        ]));
      }
    }

    /* 数字キーで回答 */
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

    section.appendChild(el('h1', { class: 'view-title', text: 'クイズ（4択）' }));
    section.appendChild(filterWrap);
    section.appendChild(setupWrap);
    section.appendChild(stage);
    container.appendChild(section);

    drawFilters();
    drawSetup();
    drawStart();
  }

  K.views = K.views || {};
  K.views.quiz = { render: render };
})();
