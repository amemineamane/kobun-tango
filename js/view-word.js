/* =====================================================================
 * js/view-word.js — 単語詳細画面（#/word/:id）
 * ---------------------------------------------------------------------
 * 直リンクできることを重視している。#/word/39 で「をかし」が開く。
 * 表示するもの:
 *   ・見出し（かな・漢字・品詞・重要度）と語義
 *   ・学習状態の切り替え
 *   ・関連語カード（relations.js を双方向に解決したもの）
 *   ・**この語が出てくる文章**（品詞分解の w ∪ passages.js の vocab）
 *   ・登場作品へのリンク
 *   ・五十音順の前後の語へのナビ
 *
 * 【「例文」枠を「この語が出てくる文章」に統合した経緯】
 *   かつては「例文（data/examples.js）」と「この語が出てくる文章（vocab）」の
 *   2 枠があり、同じ本文が両方に出て分かりにくかった。
 *   教科書教材の原文全部に品詞分解（data/tokens/*.js）が付いたので、
 *   **段落単位** の 1 枠にまとめ、examples.js は退避した（DESIGN.md 5.2）。
 *   表示は 2 段構え。
 *     1. 品詞分解の w が付いた段落 … 原文（タップ可）＋訳を出す
 *     2. vocab にだけ載っている文章 … 文章名のチップだけ出す
 * ===================================================================== */
(function () {
  'use strict';

  var K = window.KOBUN;
  var U = K.util;
  var C = K.components;
  var el = U.el;

  /** 関連語を type ごとにまとめる */
  function groupRelations(rels) {
    var map = new Map();
    rels.forEach(function (r) {
      if (!map.has(r.type)) map.set(r.type, []);
      map.get(r.type).push(r);
    });
    return map;
  }

  var TYPE_HINT = {
    '類義': '意味が近い語',
    '対義': '反対・対になる語',
    '派生': '同じ語根から出た語',
    '派生元': '元になった語',
    '同音注意': '仮名が同じで意味が違う語',
    '混同注意': '取り違えやすい語',
    '段階': '程度の等級でつながる語'
  };

  /** 「S 最重要：共通テストで必ず問われる中核語（114 語）」の 1 行 */
  function levelNote(word) {
    var lv = K.index.getLevel(word.level);
    if (!lv) return null;
    return el('p', { class: 'word-level-note muted' }, [
      el('b', { text: word.level + ' ' + lv.label }),
      '：' + lv.desc + '　',
      el('a', { href: '#/words?level=' + lv.code, text: lv.code + ' の ' + lv.count + ' 語を一覧で見る →' })
    ]);
  }

  function render(params, query, container) {
    var word = K.index.getWord(params.id);
    if (!word) {
      container.appendChild(el('div', { class: 'notice error' }, [
        el('h2', { text: '単語が見つかりません' }),
        el('p', { text: 'id = ' + params.id + ' の語はありません。' }),
        el('p', {}, [el('a', { href: '#/words', text: '単語一覧へ' })])
      ]));
      return;
    }

    // アクセス解析（設定が無ければ no-op）
    if (K.analytics) {
      K.analytics.event('word_view', { word_id: String(word.id), level: word.level || '' });
    }

    var sorted = K.index.sortedByKana;
    var pos = sorted.findIndex(function (w) { return w.id === word.id; });
    var prev = pos > 0 ? sorted[pos - 1] : null;
    var next = pos >= 0 && pos < sorted.length - 1 ? sorted[pos + 1] : null;

    var section = el('section', { class: 'view view-word' });

    /* --- 見出し ---------------------------------------------------- */
    section.appendChild(el('div', { class: 'crumbs' }, [
      el('a', { href: '#/words', text: '← 単語一覧' })
    ]));

    section.appendChild(el('header', { class: 'word-head' }, [
      el('div', { class: 'word-head-badges' }, [
        C.levelBadge(word),
        C.posBadge(word),
        el('span', { class: 'badge row', text: word.kanaRow }),
        C.statusBadge(word.id)
      ]),
      el('h1', { class: 'word-title' }, [
        el('span', { class: 'word-title-kana', text: word.kana }),
        word.kanji ? el('span', { class: 'word-title-kanji', text: '〔' + word.kanji + '〕' }) : null
      ]),
      el('p', { class: 'word-romaji muted', text: word.romaji + '　/　見出し形：' + word.headwords.join('・') }),
      // 重要度は記号だけでは伝わらない。このランクが何を意味するかを 1 行で添える
      levelNote(word)
    ]));

    /* --- 語義 ------------------------------------------------------ */
    var ol = el('ol', { class: 'meaning-list' });
    word.meanings.forEach(function (m) { ol.appendChild(el('li', { text: m })); });
    section.appendChild(el('div', { class: 'card' }, [
      el('h2', { class: 'card-title', text: '語義' }),
      ol
    ]));

    /* --- 学習状態 -------------------------------------------------- */
    var entry = K.store.getEntry(word.id);
    section.appendChild(el('div', { class: 'card' }, [
      el('h2', { class: 'card-title', text: '学習状態' }),
      C.statusButtons(word.id),
      entry && entry.seen
        ? el('p', { class: 'muted small', text: '出題 ' + entry.seen + ' 回 ／ 正解 ' + (entry.correct || 0) + ' ・ 不正解 ' + (entry.wrong || 0) })
        : null
    ]));

    /* --- 関連語 ---------------------------------------------------- */
    var rels = K.index.relationsOf(word.id);
    var relCard = el('div', { class: 'card' }, [
      el('h2', { class: 'card-title', text: '関連語' })
    ]);
    if (rels.length === 0) {
      relCard.appendChild(el('p', { class: 'muted', text: 'まだ登録されていません。data/relations.js に { from, to, type, note } を足すとここに出ます。' }));
    } else {
      groupRelations(rels).forEach(function (list, type) {
        relCard.appendChild(el('h3', { class: 'rel-type' }, [
          el('span', { class: 'badge rel rel-' + type, text: type }),
          el('span', { class: 'muted small', text: TYPE_HINT[type] || '' })
        ]));
        var wrap = el('div', { class: 'rel-cards' });
        list.forEach(function (r) {
          wrap.appendChild(el('a', { class: 'rel-card', href: '#/word/' + r.word.id }, [
            el('div', { class: 'rel-card-head' }, [
              C.levelBadge(r.word),
              el('span', { class: 'rel-card-kana', text: r.word.kana }),
              r.word.kanji ? el('span', { class: 'rel-card-kanji', text: '〔' + r.word.kanji + '〕' }) : null
            ]),
            el('div', { class: 'rel-card-meaning', text: r.word.primaryMeaning }),
            r.note ? el('div', {
              class: 'rel-card-note' + (/要確認/.test(r.note) ? ' needs-check' : ''),
              text: r.note
            }) : null
          ]));
        });
        relCard.appendChild(wrap);
      });
    }
    section.appendChild(relCard);

    /* --- この語が出てくる文章 ---------------------------------------- *
     * 品詞分解のある段落は原文ごと出す（その語を強調し、タップで品詞分解）。
     * 品詞分解がまだ無い文章は、文章名のチップだけを下にまとめる。
     * ---------------------------------------------------------------- */
    var hits = K.index.paragraphsOfWord(word.id);
    var passages = K.index.passagesOfWord(word.id);
    var shownPassageIds = new Set(hits.map(function (h) { return h.passage.id; }));
    var chipOnly = passages.filter(function (p) { return !shownPassageIds.has(p.id); });

    var hitCard = el('div', { class: 'card' }, [
      el('h2', { class: 'card-title' }, [
        'この語が出てくる文章',
        el('span', { class: 'muted small', text: '（' + passages.length + '）' })
      ])
    ]);

    hits.forEach(function (h) {
      var wk = K.index.getWork(h.passage.workId);
      var entries = K.index.entriesOfPassage(h.passage.id);
      // その文章での語義（vocab に載っていれば meaningIndex の語義）
      var e = entries.filter(function (x) { return x.word && x.word.id === word.id; })[0];
      hitCard.appendChild(el('article', { class: 'example-card' }, [
        el('div', { class: 'example-head' }, [
          el('a', {
            class: 'example-work',
            href: '#/passage/' + h.passage.id,
            text: (wk ? wk.title + '「' : '「') + h.passage.title + '」'
          }),
          el('span', { class: 'example-section', text: '第 ' + (h.index + 1) + ' 段落' })
        ]),
        el('div', { class: 'example-body' }, [
          C.passageTokenLine(entries, h.tokens, { highlightWordId: word.id, passageId: h.passage.id }),
          el('p', { class: 'example-translation', text: h.translation })
        ]),
        e ? el('p', {
          class: 'example-note' + (/要確認/.test(e.note) ? ' needs-check' : ''),
          text: 'この文章では「' + e.surface + '／' + e.meaning + '」' + (e.note ? '　' + e.note : '')
        }) : null,
        el('p', { class: 'example-hint muted', text: '原文の語をタップすると品詞分解が出ます。' })
      ]));
    });

    if (chipOnly.length) {
      var plist = el('div', { class: 'chip-list' });
      chipOnly.forEach(function (p) {
        var wk = K.index.getWork(p.workId);
        var e = K.index.entriesOfPassage(p.id).filter(function (x) {
          return x.word && x.word.id === word.id;
        })[0];
        plist.appendChild(el('a', { class: 'work-chip', href: '#/passage/' + p.id }, [
          el('span', { class: 'work-chip-title', text: (wk ? wk.title + '「' : '「') + p.title + '」' }),
          e ? el('span', { class: 'work-chip-genre muted', text: '本文：' + e.surface + '／' + e.meaning }) : null
        ]));
      });
      if (hits.length) {
        hitCard.appendChild(el('p', { class: 'muted small', text: 'このほか、まだ品詞分解を付けていない文章に出てきます。' }));
      }
      hitCard.appendChild(plist);
    }

    if (!passages.length) {
      hitCard.appendChild(el('p', {
        class: 'muted',
        text: 'この語が出てくる文章はまだ登録されていません。data/tokens/<文章id>.js のトークンに w: ' + word.id + ' を付けるか、data/passages.js の vocab に足すと、ここに自動で出ます。'
      }));
    }
    section.appendChild(hitCard);

    /* --- 登場作品 -------------------------------------------------- */
    var works = K.index.worksOf(word.id);
    if (works.length) {
      var wl = el('div', { class: 'chip-list' });
      works.forEach(function (w) {
        var note = K.index.workWordNote.get(w.id + '/' + word.id);
        wl.appendChild(el('a', { class: 'work-chip', href: '#/work/' + w.id, title: note || '' }, [
          el('span', { class: 'work-chip-title', text: w.title }),
          el('span', { class: 'work-chip-genre muted', text: w.genre })
        ]));
      });
      var noteList = works.map(function (w) {
        return { work: w, note: K.index.workWordNote.get(w.id + '/' + word.id) };
      }).filter(function (x) { return x.note; });
      section.appendChild(el('div', { class: 'card' }, [
        el('h2', { class: 'card-title', text: '登場作品' }),
        wl,
        noteList.length ? el('ul', { class: 'work-notes' }, noteList.map(function (x) {
          return el('li', {}, [el('b', { text: x.work.title + '：' }), x.note]);
        })) : null
      ]));
    }

    /* --- 共有 ------------------------------------------------------ */
    section.appendChild(C.shareButtons({
      label: 'この語を共有',
      // 語義は代表の 1 つだけ（並び順＝入試で問われる順なので先頭が中心の意味）
      text: '『' + word.kana + '』＝' + word.primaryMeaning + '｜古文単語帳',
      url: C.absUrl('#/word/' + word.id),
      contentType: 'word', itemId: word.id
    }));

    /* --- 前後ナビ -------------------------------------------------- */
    section.appendChild(el('nav', { class: 'prev-next' }, [
      prev ? el('a', { class: 'pn pn-prev', href: '#/word/' + prev.id }, [
        el('span', { class: 'pn-label muted', text: '← 前の語' }),
        el('span', { class: 'pn-kana', text: prev.kana })
      ]) : el('span', { class: 'pn pn-empty' }),
      next ? el('a', { class: 'pn pn-next', href: '#/word/' + next.id }, [
        el('span', { class: 'pn-label muted', text: '次の語 →' }),
        el('span', { class: 'pn-kana', text: next.kana })
      ]) : el('span', { class: 'pn pn-empty' })
    ]));

    container.appendChild(section);
  }

  K.views = K.views || {};
  K.views.word = { render: render };
})();
