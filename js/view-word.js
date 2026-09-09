/* =====================================================================
 * js/view-word.js — 単語詳細画面（#/word/:id）
 * ---------------------------------------------------------------------
 * 直リンクできることを重視している。#/word/39 で「をかし」が開く。
 * 表示するもの:
 *   ・見出し（かな・漢字・品詞・重要度）と語義
 *   ・学習状態の切り替え
 *   ・関連語カード（relations.js を双方向に解決したもの）
 *   ・この語を含む例文（examples.js の tokens に wordId があるもの）
 *   ・この語が出てくる文章（passages.js の vocab に wordId があるもの）
 *   ・登場作品へのリンク
 *   ・五十音順の前後の語へのナビ
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

    /* --- 例文 ------------------------------------------------------ */
    var examples = K.index.examplesOf(word.id);
    var exCard = el('div', { class: 'card' }, [
      el('h2', { class: 'card-title' }, [
        '例文', el('span', { class: 'muted small', text: '（' + examples.length + '）' })
      ])
    ]);
    if (examples.length === 0) {
      exCard.appendChild(el('p', { class: 'muted', text: 'この語を含む例文はまだありません。data/examples.js の tokens に wordId: ' + word.id + ' を付けた語があれば、ここに自動で出ます。' }));
    } else {
      examples.forEach(function (ex) {
        exCard.appendChild(C.exampleCard(ex, { highlightWordId: word.id }));
      });
    }
    section.appendChild(exCard);

    /* --- この語が出てくる文章（教材） -------------------------------- */
    var passages = K.index.passagesOfWord(word.id);
    if (passages.length) {
      var plist = el('div', { class: 'chip-list' });
      passages.forEach(function (p) {
        var wk = K.index.getWork(p.workId);
        // この文章での語義（meaningIndex）と本文の形を出す
        var e = K.index.entriesOfPassage(p.id).filter(function (x) {
          return x.word && x.word.id === word.id;
        })[0];
        plist.appendChild(el('a', { class: 'work-chip', href: '#/passage/' + p.id }, [
          el('span', { class: 'work-chip-title', text: (wk ? wk.title + '「' : '「') + p.title + '」' }),
          e ? el('span', { class: 'work-chip-genre muted', text: '本文：' + e.surface + '／' + e.meaning }) : null
        ]));
      });
      section.appendChild(el('div', { class: 'card' }, [
        el('h2', { class: 'card-title' }, [
          'この語が出てくる文章', el('span', { class: 'muted small', text: '（' + passages.length + '）' })
        ]),
        plist
      ]));
    }

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
