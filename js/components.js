/* =====================================================================
 * js/components.js — 画面をまたいで使う部品
 * ---------------------------------------------------------------------
 *   C.wordRow(word)        単語一覧の 1 行
 *   C.wordChip(word)       関連語カードなどの小さい単語チップ
 *   C.levelBadge(word)     S / A / B のバッジ（記号＋ラベル）
 *   C.levelLegend(opts)    重要度の意味を説明する凡例
 *   C.deckLabel(query)     クエリを 1 行の日本語にする
 *   C.statusBadge(id)      学習状態のバッジ
 *   C.statusButtons(id)    「未学習／苦手／覚えた」の切り替えボタン
 *   C.sentence(example)    原文をトークンに割ってタップできる形で描く
 *   C.exampleCard(example, opts)  例文カード（原文＋訳＋品詞分解）
 *   C.tokenPopup(token)    品詞分解のポップアップを出す
 *   C.filterBar(spec)      一覧・学習・クイズで共通のフィルタ UI
 *   C.applyFilters(words, query)  フィルタ条件で単語を絞る（共通ロジック）
 *   C.deckSource(query)    デッキの母集団を決める（?passage= があれば文章の語）
 *   C.wordHref(word)       単語のリンク先（文章固有語は文章ページへ）
 *   C.passageLine(passage, text)  文章の原文 1 段落を、重要語つきで描く
 * ===================================================================== */
(function () {
  'use strict';

  var K = window.KOBUN;
  var U = K.util;
  var el = U.el;
  var C = {};

  /* ---------------------------------------------------------------
   * バッジ・チップ
   * ------------------------------------------------------------- */
  /**
   * 重要度バッジ。
   * 記号（S/A/B）だけでは初見で意味が分からないので、**必ずラベルを併記**する
   *   （S 最重要／A 頻出／B 応用／P 文章の語）。
   * 記号と語は別 span に分けてあり、色帯（.level-code）とラベルを CSS で描き分ける。
   */
  C.levelBadge = function (word) {
    var lv = K.index.getLevel(word.level);
    var name = (lv && lv.label) || word.levelLabel || word.level;
    return el('span', {
      class: 'badge level level-' + word.level,
      title: name + (lv && lv.desc ? '：' + lv.desc : '')
    }, [
      el('span', { class: 'level-code', text: word.level }),
      el('span', { class: 'level-name', text: name })
    ]);
  };

  /**
   * 重要度の凡例。S/A/B が何を意味するかは色とバッジだけでは伝わらないので、
   * 単語一覧・ホーム・使い方ページで同じ説明を出す。
   * @param opts { links: true でその重要度で絞った一覧へのリンクにする }
   */
  C.levelLegend = function (opts) {
    opts = opts || {};
    var wrap = el('div', { class: 'level-legend' });
    K.index.levels.forEach(function (l) {
      var body = [
        el('span', { class: 'badge level level-' + l.code }, [
          el('span', { class: 'level-code', text: l.code }),
          el('span', { class: 'level-name', text: l.label })
        ]),
        el('span', { class: 'level-legend-desc', text: l.desc }),
        el('span', { class: 'level-legend-count muted', text: l.count + ' 語' })
      ];
      wrap.appendChild(opts.links
        ? el('a', { class: 'level-legend-item is-link', href: '#/words?level=' + l.code }, body)
        : el('span', { class: 'level-legend-item' }, body));
    });
    return wrap;
  };

  C.posBadge = function (word) {
    return el('span', { class: 'badge pos', text: word.pos });
  };

  C.statusBadge = function (id) {
    var s = K.store.getStatus(id);
    return el('span', {
      class: 'badge status status-' + s,
      dataset: { statusFor: id },
      text: K.store.STATUS_LABEL[s]
    });
  };

  /**
   * 単語のリンク先。
   * 330 語は単語詳細へ。文章固有語（id が "p:..."）は単語詳細を持たないので
   * その語が出てくる文章ページへ送る。
   */
  C.wordHref = function (word) {
    if (word && word.isPassageWord) return '#/passage/' + word.passageId;
    return '#/word/' + word.id;
  };

  C.wordChip = function (word, extraLabel) {
    return el('a', { class: 'chip', href: C.wordHref(word) }, [
      el('span', { class: 'chip-kana', text: word.kana }),
      word.kanji ? el('span', { class: 'chip-kanji', text: '〔' + word.kanji + '〕' }) : null,
      el('span', { class: 'chip-meaning', text: word.primaryMeaning }),
      extraLabel ? el('span', { class: 'chip-extra', text: extraLabel }) : null
    ]);
  };

  /* ---------------------------------------------------------------
   * 単語一覧の 1 行
   * ------------------------------------------------------------- */
  C.wordRow = function (word) {
    // 行の左端を重要度の色帯にする（一覧を上から眺めたときに S/A/B が拾える）。
    // 語義は 1 語ずつ span に分け、区切りの「／」は CSS 側で薄く描く。
    return el('a', {
      class: 'word-row lv-' + word.level,
      href: C.wordHref(word),
      dataset: { wordId: word.id }
    }, [
      el('div', { class: 'word-row-head' }, [
        C.levelBadge(word),
        el('span', { class: 'word-kana', text: word.kana }),
        word.kanji ? el('span', { class: 'word-kanji', text: '〔' + word.kanji + '〕' }) : null,
        word.isPassageWord && word.surface !== word.kana
          ? el('span', { class: 'word-kanji', text: '（本文：' + word.surface + '）' })
          : null,
        C.posBadge(word),
        C.statusBadge(word.id)
      ]),
      el('div', { class: 'word-row-meaning' }, word.meanings.map(function (m) {
        return el('span', { class: 'mn', text: m });
      })),
      word.isPassageWord
        ? el('div', { class: 'word-row-note muted', text: '「' + word.passageTitle + '」の脚注語（330 語には無い語）' })
        : null
    ]);
  };

  /* ---------------------------------------------------------------
   * 学習状態の切り替え
   * ------------------------------------------------------------- */
  C.statusButtons = function (id, onChange) {
    var wrap = el('div', { class: 'status-buttons', role: 'group', 'aria-label': '学習状態' });
    K.store.STATUSES.forEach(function (s) {
      var btn = el('button', {
        type: 'button',
        class: 'status-btn status-' + s + (K.store.getStatus(id) === s ? ' selected' : ''),
        dataset: { status: s },
        text: K.store.STATUS_LABEL[s],
        onClick: function () {
          K.store.setStatus(id, s);
          Array.prototype.forEach.call(wrap.children, function (b) {
            b.classList.toggle('selected', b.dataset.status === s);
          });
          if (onChange) onChange(s);
        }
      });
      wrap.appendChild(btn);
    });
    return wrap;
  };

  /* ---------------------------------------------------------------
   * 品詞分解ポップアップ
   * ------------------------------------------------------------- */
  var popupEl = null;

  function closePopup() {
    if (popupEl && popupEl.parentNode) popupEl.parentNode.removeChild(popupEl);
    popupEl = null;
  }
  C.closePopup = closePopup;

  document.addEventListener('click', function (e) {
    if (!popupEl) return;
    if (popupEl.contains(e.target)) return;
    if (e.target.closest && e.target.closest('.tok')) return;
    closePopup();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePopup(); });
  // ポップアップは document.body に付けるので、画面が切り替わっても残ってしまう
  // （ルーターは #app の中しか消さない）。ハッシュが変わったら必ず閉じる。
  window.addEventListener('hashchange', closePopup);

  /**
   * トークンの品詞分解をポップアップで出す。
   * anchor の直下に絶対配置する。画面外にはみ出さないよう左右を調整。
   */
  C.tokenPopup = function (token, anchor) {
    closePopup();
    var word = token.wordId != null ? K.index.getWord(token.wordId) : null;

    popupEl = el('div', { class: 'token-popup', role: 'dialog' }, [
      el('button', { class: 'popup-close', type: 'button', text: '×', 'aria-label': '閉じる', onClick: closePopup }),
      el('div', { class: 'popup-surface' }, [
        el('span', { class: 'popup-surface-text', text: token.surface }),
        token.base && token.base !== token.surface
          ? el('span', { class: 'popup-base', text: '（辞書形：' + token.base + '）' })
          : null
      ]),
      el('div', { class: 'popup-grammar' }, [
        el('span', { class: 'badge pos', text: token.pos || '—' }),
        token.detail ? el('span', { class: 'popup-detail', text: token.detail }) : null
      ]),
      token.meaning ? el('div', { class: 'popup-meaning', text: token.meaning }) : null,
      token.note ? el('div', {
        class: 'popup-note' + (/要確認/.test(token.note) ? ' needs-check' : ''),
        text: token.note
      }) : null,
      word ? el('a', { class: 'popup-link', href: '#/word/' + word.id, onClick: closePopup }, [
        '重要語「' + word.kana + '」の詳細へ →'
      ]) : null
    ]);

    document.body.appendChild(popupEl);
    var r = anchor.getBoundingClientRect();
    var pw = popupEl.offsetWidth;
    var left = r.left + window.scrollX + r.width / 2 - pw / 2;
    left = Math.max(8, Math.min(left, document.documentElement.clientWidth - pw - 8));
    var top = r.bottom + window.scrollY + 6;
    // 下にはみ出すなら上に出す
    if (r.bottom + popupEl.offsetHeight + 12 > window.innerHeight) {
      top = r.top + window.scrollY - popupEl.offsetHeight - 6;
      if (top < window.scrollY + 4) top = r.bottom + window.scrollY + 6;
    }
    popupEl.style.left = left + 'px';
    popupEl.style.top = top + 'px';
  };

  /* ---------------------------------------------------------------
   * 原文（トークン列）
   * ------------------------------------------------------------- */
  /**
   * @param example 例文
   * @param opts    { highlightWordId: number }  その語を強調表示する
   */
  C.sentence = function (example, opts) {
    opts = opts || {};
    var wrap = el('p', { class: 'sentence', lang: 'ja' });
    (example.tokens || []).forEach(function (t) {
      if (t.pos === '記号') {
        wrap.appendChild(el('span', { class: 'tok tok-punct', text: t.surface }));
        return;
      }
      var cls = 'tok';
      if (t.wordId != null) cls += ' tok-word';
      if (opts.highlightWordId != null && t.wordId === opts.highlightWordId) cls += ' tok-hl';
      if (t.note && /要確認/.test(t.note)) cls += ' tok-check';
      var span = el('button', {
        type: 'button',
        class: cls,
        text: t.surface,
        title: (t.pos || '') + (t.detail ? '・' + t.detail : ''),
        onClick: function (e) { e.stopPropagation(); C.tokenPopup(t, span); }
      });
      wrap.appendChild(span);
    });
    return wrap;
  };

  /** 品詞分解の一覧表（例文カードの「品詞分解を見る」で開く） */
  C.tokenTable = function (example) {
    var tbody = el('tbody');
    (example.tokens || []).forEach(function (t) {
      if (t.pos === '記号') return;
      var word = t.wordId != null ? K.index.getWord(t.wordId) : null;
      tbody.appendChild(el('tr', {}, [
        el('td', { class: 'td-surface', text: t.surface }),
        el('td', { class: 'td-base', text: t.base || '' }),
        el('td', { class: 'td-pos' }, [
          el('span', { class: 'badge pos', text: t.pos || '' }),
          t.detail ? el('span', { class: 'td-detail', text: t.detail }) : null
        ]),
        el('td', { class: 'td-meaning' }, [
          t.meaning || '',
          t.note ? el('div', {
            class: 'td-note' + (/要確認/.test(t.note) ? ' needs-check' : ''),
            text: t.note
          }) : null
        ]),
        el('td', { class: 'td-link' }, [
          word ? el('a', { href: '#/word/' + word.id, text: word.kana }) : el('span', { class: 'muted', text: '—' })
        ])
      ]));
    });
    return el('div', { class: 'table-scroll' }, [
      el('table', { class: 'token-table' }, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', { text: '語' }), el('th', { text: '辞書形' }),
            el('th', { text: '品詞・活用' }), el('th', { text: '意味' }), el('th', { text: '重要語' })
          ])
        ]),
        tbody
      ])
    ]);
  };

  /**
   * 例文カード。
   * @param opts { highlightWordId, showWork(boolean), open(boolean) }
   */
  C.exampleCard = function (example, opts) {
    opts = opts || {};
    var work = K.index.getWork(example.workId);
    var body = el('div', { class: 'example-body' }, [
      C.sentence(example, { highlightWordId: opts.highlightWordId }),
      example.reading ? el('p', { class: 'example-reading', text: example.reading }) : null,
      el('p', { class: 'example-translation', text: example.translation || '' }),
      example.note ? el('p', { class: 'example-note', text: example.note }) : null
    ]);

    var details = el('details', { class: 'token-details' }, [
      el('summary', { text: '品詞分解の一覧を見る' }),
      C.tokenTable(example)
    ]);
    if (opts.open) details.open = true;

    return el('article', { class: 'example-card' }, [
      el('div', { class: 'example-head' }, [
        opts.showWork !== false && work
          ? el('a', { class: 'example-work', href: '#/work/' + work.id, text: work.title })
          : null,
        el('span', { class: 'example-section', text: example.section || '' })
      ]),
      body,
      el('p', { class: 'example-hint muted', text: '原文の語をタップすると品詞分解が出ます。' }),
      details
    ]);
  };

  /* ---------------------------------------------------------------
   * 文章（passages）の原文
   * -------------------------------------------------------------
   * 原文はトークン列を持たない（品詞分解しない）ので、
   * vocab[].surface を **文字列一致** で探してハイライトする。
   *   ・長い surface から順に試すので、「たまへ」と「のたまへ」のように
   *     一方が他方を含んでいても、長いほうが優先される。
   *   ・同じ surface が何度出てきても、すべてハイライトされる
   *     （走査位置を進めるだけなので重複や無限ループにならない）。
   * ------------------------------------------------------------- */

  /** entries から「長い順に並べた検索表」を作る（文章ごとに 1 回でよい） */
  function buildMatcher(entries) {
    return entries.slice().sort(function (a, b) {
      return b.surface.length - a.surface.length;
    });
  }

  /** vocab のエントリを、tokenPopup が読める形（トークン風）に変換する */
  function entryToToken(e, matched) {
    var w = e.word;
    return {
      surface: matched,
      base: (e.entry && e.entry.base) || (w ? w.kana : ''),
      pos: w ? w.pos : (e.entry.pos || ''),
      detail: w ? ('重要語 ' + w.level + '：' + w.levelLabel) : 'この文章の脚注語',
      meaning: e.meaning,
      note: e.note,
      wordId: w ? w.id : null
    };
  }

  /**
   * 文章の 1 段落を描く。vocab の surface をハイライトし、タップで語義を出す。
   * @param entries K.index.entriesOfPassage(id) の戻り
   * @param text    paragraphs[].text
   */
  C.passageLine = function (entries, text) {
    var wrap = el('p', { class: 'passage-text', lang: 'ja' });
    var list = buildMatcher(entries || []);
    var i = 0;
    var plain = '';

    function flush() {
      if (plain) { wrap.appendChild(document.createTextNode(plain)); plain = ''; }
    }

    while (i < text.length) {
      var hit = null;
      for (var n = 0; n < list.length; n++) {
        var s = list[n].surface;
        if (s && text.substr(i, s.length) === s) { hit = list[n]; break; }
      }
      if (!hit) { plain += text.charAt(i); i++; continue; }
      flush();
      (function (e, matched) {
        var btn = el('button', {
          type: 'button',
          class: 'pv' + (e.word ? ' pv-word' : ' pv-extra') +
            (/要確認/.test(e.note) ? ' pv-check' : ''),
          text: matched,
          title: (e.word ? e.word.kana : matched) + '：' + e.meaning,
          onClick: function (ev) { ev.stopPropagation(); C.tokenPopup(entryToToken(e, matched), btn); }
        });
        wrap.appendChild(btn);
      })(hit, hit.surface);
      i += hit.surface.length;
    }
    flush();
    return wrap;
  };

  /* ---------------------------------------------------------------
   * デッキの母集団
   * -------------------------------------------------------------
   * 既定は 330 語。?passage=<id> があれば「その文章の語」だけを母集団にする
   * （330 語に無い文章固有語もカード・クイズに出す）。
   * 一覧・学習・クイズの 3 画面がこの 1 か所を通る。
   * ------------------------------------------------------------- */
  C.deckSource = function (query) {
    var q = query || {};
    if (q.passage) {
      var deck = K.index.deckOfPassage(q.passage);
      if (deck.length) return deck;
    }
    return K.index.words;
  };

  /* ---------------------------------------------------------------
   * フィルタ（一覧・学習・クイズで共通）
   * ------------------------------------------------------------- */
  var STATUS_OPTIONS = [
    { value: '', label: 'すべて' },
    { value: 'new', label: '未学習' },
    { value: 'weak', label: '苦手' },
    { value: 'known', label: '覚えた' },
    { value: 'notknown', label: '覚えた以外' }
  ];

  /** 「絞り込みが効いている」と見なすキー（sort は常に値があるので含めない） */
  var FILTER_KEYS = ['q', 'level', 'pos', 'row', 'work', 'passage', 'status'];

  var SORT_LABEL = { kana: '五十音順', level: '重要度順', pos: '品詞順' };

  /**
   * クエリを 1 行の日本語にする（ホームの「続きから」やおすすめの見出し用）。
   * summaryChips と同じ語彙を使うので、一覧のチップと言い方がぶれない。
   */
  C.deckLabel = function (query) {
    var q = query || {};
    var parts = [];
    if (q.passage) {
      var p = K.index.getPassage(q.passage);
      parts.push('「' + (p ? p.title : q.passage) + '」の語');
    } else if (q.work) {
      var w = K.index.getWork(q.work);
      parts.push((w ? w.title : q.work) + 'の語');
    }
    if (q.level) {
      var lv = K.index.getLevel(q.level);
      parts.push('重要度 ' + q.level + (lv ? ' ' + lv.label : ''));
    }
    if (q.pos) parts.push(q.pos);
    if (q.row) parts.push(q.row);
    if (q.status) {
      var s = STATUS_OPTIONS.filter(function (o) { return o.value === q.status; })[0];
      parts.push(s ? s.label : q.status);
    }
    if (q.q) parts.push('検索「' + q.q + '」');
    return parts.length ? parts.join('・') : '330 語すべて';
  };

  /* フィルタ UI の開閉状態。
     既定は「一覧＝広い画面なら開く／学習・クイズ＝畳む」。
     学習とクイズはカードを先に見せたいので、条件は summary のチップで示すだけにする。
     一度ユーザーが開閉したらそれを覚える
     （条件を変えるたびに UI を作り直すので、ここに持たないと勝手に閉じる）。 */
  var filterOpenState = {};
  function filterPanelOpen(kind) {
    if (filterOpenState[kind] !== undefined) return filterOpenState[kind];
    if (kind === 'deck') return false;
    try { return window.matchMedia('(min-width: 641px)').matches; }
    catch (e) { return true; }
  }

  /** summary に出す「いま効いている条件」のチップ列 */
  function summaryChips(q, opts) {
    var wrap = el('span', { class: 'filter-chips' });
    function chip(t) { wrap.appendChild(el('span', { class: 'filter-chip', text: t })); }

    if (q.q) chip('検索：' + q.q);
    if (q.level) {
      var lv = K.index.getLevel(q.level);
      chip('重要度 ' + q.level + (lv ? ' ' + lv.label : ''));
    }
    if (q.pos) chip(q.pos);
    if (q.row) chip(q.row);
    if (q.passage) {
      var p = K.index.getPassage(q.passage);
      chip('文章：' + (p ? p.title : q.passage));
    } else if (q.work) {
      var w = K.index.getWork(q.work);
      chip('作品：' + (w ? w.title : q.work));
    }
    if (q.status) {
      var s = STATUS_OPTIONS.filter(function (o) { return o.value === q.status; })[0];
      chip(s ? s.label : q.status);
    }
    if (opts.showSort !== false && q.sort && q.sort !== 'kana') {
      chip(SORT_LABEL[q.sort] || q.sort);
    }
    if (!wrap.childNodes.length) {
      wrap.appendChild(el('span', { class: 'filter-none', text: 'すべての語（条件なし）' }));
    }
    return wrap;
  }

  /**
   * クエリ条件で単語を絞り込む共通ロジック。
   * query: { q, level, pos, row, work, passage, status, sort }
   *
   * `passage` は「どの語を母集団にするか」の指定なので、ここでは扱わない
   * （C.deckSource が済ませている）。passage が指定されているときは、
   * 作品での絞り込みは意味が重なるので無視する。
   */
  C.applyFilters = function (words, query) {
    var q = query || {};
    var out = words.filter(function (w) {
      if (q.level && w.level !== q.level) return false;
      if (q.pos && w.pos !== q.pos) return false;
      if (q.row && w.kanaRow !== q.row) return false;
      if (q.work && !q.passage) {
        var list = K.index.wordsByWork.get(q.work);
        if (!list || !list.some(function (x) { return x.id === w.id; })) return false;
      }
      if (q.status) {
        var s = K.store.getStatus(w.id);
        if (q.status === 'notknown') { if (s === 'known') return false; }
        else if (s !== q.status) return false;
      }
      if (q.q) {
        w.__score = U.matchScore(w, q.q);
        if (!w.__score) return false;
      } else {
        w.__score = 1;
      }
      return true;
    });

    var sort = q.sort || 'kana';
    out.sort(function (a, b) {
      if (q.q && a.__score !== b.__score) return b.__score - a.__score;
      if (sort === 'level') {
        if (a.levelOrder !== b.levelOrder) return a.levelOrder - b.levelOrder;
        return a.kanaOrder - b.kanaOrder;
      }
      if (sort === 'pos') {
        if (a.posOrder !== b.posOrder) return a.posOrder - b.posOrder;
        return a.kanaOrder - b.kanaOrder;
      }
      return a.kanaOrder - b.kanaOrder;
    });
    return out;
  };

  /**
   * フィルタ UI をつくる。
   * @param query   現在のクエリ
   * @param onChange function(patch) — 変わった項目だけ渡す
   * @param opts    { showSearch, showSort, showStatus }
   */
  C.filterBar = function (query, onChange, opts) {
    opts = opts || {};
    var q = query || {};

    function select(name, label, options, value) {
      var sel = el('select', {
        id: 'f-' + name,
        onChange: function () { onChange({ [name]: sel.value }); }
      });
      options.forEach(function (o) {
        var op = el('option', { value: o.value, text: o.label });
        if (String(o.value) === String(value || '')) op.selected = true;
        sel.appendChild(op);
      });
      return el('label', { class: 'field', for: 'f-' + name }, [
        el('span', { class: 'field-label', text: label }),
        sel
      ]);
    }

    var fields = [];

    if (opts.showSearch !== false) {
      var input = el('input', {
        type: 'search',
        id: 'f-q',
        value: q.q || '',
        placeholder: 'かな・ローマ字・漢字・意味',
        autocomplete: 'off',
        enterkeyhint: 'search'
      });
      var timer = null;
      input.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () { onChange({ q: input.value }, true); }, 200);
      });
      fields.push(el('label', { class: 'field field-search', for: 'f-q' }, [
        el('span', { class: 'field-label', text: '検索' }),
        input
      ]));
    }

    // 重要度は記号だけだと意味が分からないので、ラベルと語数まで出す
    fields.push(select('level', '重要度',
      [{ value: '', label: 'すべて（' + K.index.words.length + ' 語）' }].concat(K.index.levels.map(function (l) {
        return { value: l.code, label: l.code + ' ' + l.label + '（' + l.count + ' 語）' };
      })), q.level));

    fields.push(select('pos', '品詞',
      [{ value: '', label: 'すべて' }].concat(K.index.posList.map(function (p) {
        return { value: p, label: p };
      })), q.pos));

    fields.push(select('row', '五十音行',
      [{ value: '', label: 'すべて' }].concat(K.index.kanaRows.map(function (r) {
        return { value: r, label: r };
      })), q.row));

    fields.push(select('work', '作品',
      [{ value: '', label: 'すべて' }].concat(K.index.works.map(function (w) {
        var n = (K.index.wordsByWork.get(w.id) || []).length;
        return { value: w.id, label: w.title + '（' + n + '）' };
      })), q.work));

    // 文章（教材）でしぼる。選ぶと母集団がその文章の語だけになる（C.deckSource）
    if (K.index.passages && K.index.passages.length) {
      fields.push(select('passage', '文章',
        [{ value: '', label: 'すべて（330 語）' }].concat(K.index.passages.map(function (p) {
          var work = K.index.getWork(p.workId);
          var n = K.index.deckOfPassage(p.id).length;
          return {
            value: p.id,
            label: (work ? work.title + '「' : '「') + p.title + '」（' + n + '）'
          };
        })), q.passage));
    }

    if (opts.showStatus !== false) {
      fields.push(select('status', '学習状態', STATUS_OPTIONS, q.status));
    }

    if (opts.showSort !== false) {
      fields.push(select('sort', '並び順', [
        { value: 'kana', label: '五十音順' },
        { value: 'level', label: '重要度順' },
        { value: 'pos', label: '品詞順' }
      ], q.sort || 'kana'));
    }

    var hasFilter = FILTER_KEYS.some(function (k) { return q[k]; });
    fields.push(el('button', {
      type: 'button',
      class: 'btn btn-ghost btn-clear' + (hasFilter ? '' : ' hidden'),
      text: '条件をクリア',
      onClick: function () {
        onChange({ q: '', level: '', pos: '', row: '', work: '', passage: '', status: '' });
      }
    }));

    // <details> で包む。スマホでは畳んでおき、閉じていても
    // summary に「いま効いている条件」が並ぶようにする。
    var panel = el('details', { class: 'filter-panel' }, [
      el('summary', { class: 'filter-summary' }, [
        el('span', {
          class: 'filter-summary-label',
          text: opts.showSort === false ? '絞り込み' : '絞り込み・並び替え'
        }),
        summaryChips(q, opts)
      ]),
      el('div', { class: 'filter-bar' }, fields)
    ]);
    var kind = opts.showSort === false ? 'deck' : 'list';
    panel.open = filterPanelOpen(kind);
    panel.addEventListener('toggle', function () { filterOpenState[kind] = panel.open; });
    return panel;
  };

  /** 学習状態バッジをその場で更新する（一覧を再描画せずに済ませる） */
  document.addEventListener('kobun:progress', function (e) {
    var id = e.detail && e.detail.id;
    var sel = id == null ? '[data-status-for]' : '[data-status-for="' + id + '"]';
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (node) {
      var s = K.store.getStatus(node.dataset.statusFor);
      node.className = 'badge status status-' + s;
      node.textContent = K.store.STATUS_LABEL[s];
    });
  });

  K.components = C;
})();
