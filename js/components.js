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
 *   C.tokenPopup(token)    品詞分解のポップアップを出す
 *   C.usageFor(wordId)     その語の用例（品詞分解のある段落）を 1 つ返す
 *   C.filterBar(spec)      一覧・学習・クイズで共通のフィルタ UI
 *   C.applyFilters(words, query)  フィルタ条件で単語を絞る（共通ロジック）
 *   C.deckSource(query)    デッキの母集団を決める（?passage= があれば文章の語）
 *   C.wordHref(word)       単語のリンク先（文章固有語は文章ページへ）
 *   C.passageLine(entries, text)  文章の原文 1 段落を、重要語つきで描く（品詞分解が無いとき）
 *   C.normalizeToken(t)    data/tokens の短いキー（s/b/p/c/f/m/w/n）を展開する
 *   C.passageTokenLine(entries, tokens, opts)  原文 1 段落を品詞分解から描く
 *   C.tokenTableOf(tokens) 品詞分解の一覧表（data/tokens のトークン配列から）
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

  /**
   * 品詞分解の一覧表（文章ページの「品詞分解を表で見る」で開く）。
   * 受け取るのは「展開済みトークン」（surface/base/pos/detail/meaning/note/wordId）の配列。
   * data/tokens の短いキーのままの配列は C.normalizeToken を通してから渡すこと。
   */
  C.tokenTableOf = function (tokens) {
    var tbody = el('tbody');
    (tokens || []).forEach(function (t) {
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
   * @param entries    K.index.entriesOfPassage(id) の戻り
   * @param text       paragraphs[].text
   * @param passageId  アクセス解析（token_tap）用。無くても描画は変わらない
   */
  C.passageLine = function (entries, text, passageId) {
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
          onClick: function (ev) {
            ev.stopPropagation();
            C.tokenPopup(entryToToken(e, matched), btn);
            if (K.analytics) K.analytics.event('token_tap', { passage_id: passageId || '' });
          }
        });
        wrap.appendChild(btn);
      })(hit, hit.surface);
      i += hit.surface.length;
    }
    flush();
    return wrap;
  };

  /* ---------------------------------------------------------------
   * 文章（passages）の原文 ― 品詞分解つき
   * -------------------------------------------------------------
   * data/tokens/<passageId>.js がある文章は、原文を「文字列の部分一致」では
   * なく **トークン列** から描く。こうすると
   *   ・原文のどの語をタップしても品詞・活用・語義が出る
   *   ・重要語のハイライトが語の途中で切れない
   *   ・「品詞分解を表で見る」を段落ごとに出せる
   * が同時に成り立つ。品詞分解がまだ無い文章は C.passageLine に落ちる。
   * ------------------------------------------------------------- */

  /** data/tokens の短いキーを、tokenPopup / tokenTable が読める形に展開する */
  C.normalizeToken = function (t) {
    var detail = [t.c, t.f].filter(Boolean).join('・');
    return {
      surface: t.s,
      base: t.b || t.s,
      pos: t.p || '',
      detail: detail,
      meaning: t.m || '',
      note: t.n || '',
      wordId: (t.w == null ? null : t.w)
    };
  };

  /**
   * vocab のハイライトをトークンに重ねるための対応表を作る。
   * 段落テキストの文字位置ごとに「そこを覆っている vocab エントリ」を置く。
   * 長い surface から塗るので、「たまへ」と「のたまへ」なら長いほうが残る。
   */
  function paintVocab(entries, text) {
    var paint = new Array(text.length).fill(null);
    buildMatcher(entries || []).forEach(function (e) {
      if (!e.surface) return;
      var from = 0;
      for (;;) {
        var idx = text.indexOf(e.surface, from);
        if (idx < 0) break;
        for (var k = idx; k < idx + e.surface.length; k++) {
          if (!paint[k]) paint[k] = e; // 先に塗った（＝長い）語を残す
        }
        from = idx + e.surface.length;
      }
    });
    return paint;
  }

  /**
   * 文章の 1 段落を、品詞分解のトークン列から描く。
   * @param entries K.index.entriesOfPassage(id) の戻り（ハイライト用。空でよい）
   * @param tokens  data/tokens のトークン配列（この段落ぶん）
   * @param opts    { highlightWordId, passageId }
   *                highlightWordId … その語を強調する
   *                passageId       … アクセス解析（token_tap）用。描画には影響しない
   */
  C.passageTokenLine = function (entries, tokens, opts) {
    opts = opts || {};
    var wrap = el('p', { class: 'passage-text', lang: 'ja' });
    var text = (tokens || []).map(function (t) { return (t && t.s) || ''; }).join('');
    var paint = paintVocab(entries, text);
    var at = 0;

    (tokens || []).forEach(function (t) {
      var s = (t && t.s) || '';
      var start = at;
      at += s.length;
      if (!s) return;
      // 句読点・鉤括弧はタップさせない（素の文字として置く）
      if (t.p === '記号') { wrap.appendChild(document.createTextNode(s)); return; }

      // この語にかかっている vocab（語の先頭の文字で代表させる）
      var hit = paint[start] || null;

      var tk = C.normalizeToken(t);
      if (hit) {
        if (tk.wordId == null && hit.word) tk.wordId = hit.word.id;
        if (!tk.meaning) tk.meaning = hit.meaning;
        if (hit.note) tk.note = tk.note ? tk.note + '　' + hit.note : hit.note;
      }

      // 実線＝330 語（w があるか、vocab の 330 語にかかっている）
      // 点線＝この文章だけの語　／ 下線なし＝それ以外（タップはできる）
      var cls = 'pv pv-tok';
      if (tk.wordId != null) cls += ' pv-word';
      else if (hit && hit.passageWord) cls += ' pv-extra';
      if (opts.highlightWordId != null && tk.wordId === opts.highlightWordId) cls += ' pv-hl';
      if (/要確認/.test(tk.note)) cls += ' pv-check';

      var btn = el('button', {
        type: 'button',
        class: cls,
        text: s,
        title: (tk.pos || '') + (tk.detail ? '・' + tk.detail : '') + (tk.meaning ? '：' + tk.meaning : ''),
        onClick: function (ev) {
          ev.stopPropagation();
          C.tokenPopup(tk, btn);
          if (K.analytics) K.analytics.event('token_tap', { passage_id: opts.passageId || '' });
        }
      });
      wrap.appendChild(btn);
    });
    return wrap;
  };

  /**
   * その語の「用例」を 1 つ返す（学習カードの裏・クイズの答え合わせで使う）。
   * 根拠は品詞分解（data/tokens/*.js）の w が付いた段落。まだ品詞分解の無い
   * 文章にしか出てこない語では null になり、呼び出し側は用例を出さない。
   * @returns {{label: string, line: Element, translation: string}|null}
   */
  C.usageFor = function (wordId) {
    var hits = K.index.paragraphsOfWord(wordId);
    if (hits.length) {
      var h = hits[0];
      var wk = K.index.getWork(h.passage.workId);
      return {
        label: (wk ? wk.title : '') + '「' + h.passage.title + '」',
        line: C.passageTokenLine(
          K.index.entriesOfPassage(h.passage.id), h.tokens,
          { highlightWordId: wordId, passageId: h.passage.id }),
        translation: h.translation
      };
    }
    return null;
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

  /* ---------------------------------------------------------------
   * SNS 共有・制作者情報
   * ---------------------------------------------------------------
   * 文面・URL・制作者リンクの値は data/site.js（KOBUN.site）だけが持つ。
   * ここは「どう見せるか」だけを担当する。
   *
   * アイコンは外部フォントを使えないのでインライン SVG の線画にする
   * （ヘッダのナビと同じ流儀：viewBox 24×24・currentColor・stroke-width 1.8）。
   * 商標ロゴの厳密な再現はしない（X は交差する 2 本、LINE は吹き出し）。
   * ------------------------------------------------------------- */

  var SVG_ATTRS = 'viewBox="0 0 24 24" width="18" height="18" fill="none" ' +
    'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true" focusable="false"';

  var ICON_PATHS = {
    // 端末の共有シート：3 つの点を線でつないだ、よくある共有マーク
    share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/>' +
           '<circle cx="18" cy="18.5" r="2.5"/><path d="M8.3 10.8 15.7 7"/>' +
           '<path d="M8.3 13.2 15.7 17"/>',
    // X：交差する 2 本の線に単純化したもの
    x: '<path d="M4.5 4.5 19.5 19.5"/><path d="M19.5 4.5 4.5 19.5"/>',
    // LINE：吹き出し（尾を左下に出す）
    line: '<path d="M12 4.2c-4.7 0-8.5 2.9-8.5 6.5 0 3.2 2.9 5.8 6.8 6.4l-.7 3.1 ' +
          '3.6-2.6c4.2-.4 7.3-3.2 7.3-6.9 0-3.6-3.8-6.5-8.5-6.5z"/>',
    // リンクをコピー：鎖
    link: '<path d="M10.2 13.8a3.6 3.6 0 0 0 5.1 0l2.8-2.8a3.6 3.6 0 0 0-5.1-5.1l-1.4 1.4"/>' +
          '<path d="M13.8 10.2a3.6 3.6 0 0 0-5.1 0l-2.8 2.8a3.6 3.6 0 0 0 5.1 5.1l1.4-1.4"/>',
    // YouTube：画面と再生マーク
    youtube: '<rect x="2.8" y="5.5" width="18.4" height="13" rx="4"/>' +
             '<path d="M10.4 9.4 15.6 12l-5.2 2.6z"/>',
    // BOOTH：買い物袋
    booth: '<path d="M4.4 8.5h15.2l-1.1 11H5.5z"/><path d="M8.8 8.5V7a3.2 3.2 0 0 1 6.4 0v1.5"/>',
    // ホーム画面に追加：受け皿に下向きの矢印
    install: '<path d="M12 3.5v10"/><path d="M8 10.2 12 14.2 16 10.2"/>' +
             '<path d="M4.5 16v2.5A2 2 0 0 0 6.5 20.5h11a2 2 0 0 0 2-2V16"/>'
  };

  function icon(name) {
    var d = ICON_PATHS[name];
    if (!d) return null;
    return el('span', {
      class: 'share-icon',
      html: '<svg class="share-icon-svg" ' + SVG_ATTRS + '>' + d + '</svg>'
    });
  }

  /**
   * 共有 URL は必ず絶対 URL にする。
   * file:// やローカルサーバー（localhost）で開いているときは
   * 手元の URL を配っても相手が開けないので、KOBUN.site.url で組み立てる。
   * @param hash '#/word/39' のようなハッシュ（省略時はいま開いている画面）
   */
  C.absUrl = function (hash) {
    var h = (hash == null || hash === '') ? (location.hash || '#/') : String(hash);
    if (h.charAt(0) !== '#') h = '#' + h;

    var base = ((K.site && K.site.url) || '').replace(/#.*$/, '');
    var proto = (location.protocol || '').toLowerCase();
    var host = (location.hostname || '').toLowerCase();
    var isLocal = (proto !== 'http:' && proto !== 'https:') ||
      /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1)$/.test(host) ||
      /\.local$/.test(host);

    if (base && isLocal) return base + h;
    var here = location.href.split('#')[0];
    if (/^https?:/i.test(here)) return here + h;
    return (base || here) + h;
  };

  function xIntentUrl(text, url, tags) {
    var q = 'text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
    if (tags && tags.length) q += '&hashtags=' + encodeURIComponent(tags.join(','));
    return 'https://twitter.com/intent/tweet?' + q;
  }

  function lineShareUrl(text, url) {
    return 'https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(url) +
      '&text=' + encodeURIComponent(text);
  }

  /** navigator.clipboard が無い／拒否された環境用のフォールバック */
  function legacyCopy(text) {
    var ta = el('textarea', { readonly: true, 'aria-hidden': 'true' });
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    var ok = false;
    try {
      ta.focus();
      ta.select();
      if (ta.setSelectionRange) ta.setSelectionRange(0, ta.value.length);
      ok = document.execCommand('copy');
    } catch (e) { ok = false; }
    if (ta.parentNode) ta.parentNode.removeChild(ta);
    return !!ok;
  }

  function copyToClipboard(text, done) {
    var nav = window.navigator;
    if (nav && nav.clipboard && nav.clipboard.writeText) {
      try {
        nav.clipboard.writeText(text).then(
          function () { done(true); },
          function () { done(legacyCopy(text)); }
        );
        return;
      } catch (e) { /* 下のフォールバックへ */ }
    }
    done(legacyCopy(text));
  }

  /**
   * 共有ボタン。
   * @param opts {
   *   title:    共有シートのタイトル（既定：サイト名）
   *   text:     共有する文面（X・LINE の本文にも使う）
   *   url:      共有する絶対 URL（既定：いま開いている画面）
   *   hashtags: ['古文単語帳'] のような配列（# は付けない。既定：site.hashtags）
   *   label:    見出しの文字（既定「共有」）
   *   contentType: アクセス解析用（'quiz' | 'study' | 'word' | 'passage' | 'work' | 'app'）
   *   itemId:      アクセス解析用（その語・文章・作品の id。無ければ空）
   * }
   *
   * 端末の共有シート（navigator.share）が使えるのは主にスマホなので、
   * 「navigator.share があり、かつ指がタップする画面（pointer: coarse）」の
   * ときだけ 1 つの「共有」ボタンにまとめ、それ以外（PC）では
   * X・LINE・リンクをコピーの 3 つを出す。
   * PC の Chrome にも navigator.share はあるが、共有シートより
   * 「X で投稿」「リンクをコピー」が並んでいるほうが早いため。
   */
  C.shareButtons = function (opts) {
    opts = opts || {};
    var site = K.site || {};
    var url = opts.url || C.absUrl(null);
    var title = opts.title || site.name || document.title || '';
    var text = opts.text || title;
    var tags = opts.hashtags || site.hashtags || [];

    var wrap = el('div', { class: 'share-bar' });
    wrap.appendChild(el('span', { class: 'share-bar-label', text: opts.label || '共有' }));

    var row = el('div', { class: 'share-actions' });
    var toast = el('span', { class: 'share-toast', role: 'status', 'aria-live': 'polite' });
    var toastTimer = null;
    function say(msg) {
      toast.textContent = msg;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.textContent = ''; }, 2000);
    }

    function btnLabel(t) { return el('span', { class: 'share-btn-label', text: t }); }

    /** アクセス解析（設定が無ければ no-op）。何を共有したかだけを送る */
    function track(method) {
      if (!K.analytics) return;
      K.analytics.event('share', {
        method: method,
        content_type: opts.contentType || '',
        item_id: opts.itemId == null ? '' : String(opts.itemId)
      });
    }

    var xLink = el('a', {
      class: 'share-btn share-x',
      href: xIntentUrl(text, url, tags),
      target: '_blank',
      rel: 'noopener noreferrer',
      onClick: function () { track('x'); }
    }, [icon('x'), btnLabel('X で投稿')]);

    var lineLink = el('a', {
      class: 'share-btn share-line',
      href: lineShareUrl(text, url),
      target: '_blank',
      rel: 'noopener noreferrer',
      onClick: function () { track('line'); }
    }, [icon('line'), btnLabel('LINE で送る')]);

    var copyBtn = el('button', {
      type: 'button',
      class: 'share-btn share-copy',
      onClick: function () {
        copyToClipboard(url, function (ok) {
          say(ok ? 'コピーしました' : 'コピーできませんでした');
          if (ok) track('copy');
        });
      }
    }, [icon('link'), btnLabel('リンクをコピー')]);

    var useNative = false;
    try {
      useNative = !!(window.navigator && window.navigator.share) &&
        !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    } catch (e) { useNative = false; }

    if (useNative) {
      // 共有シートが開けなかったときだけ X・LINE を出す（畳んでおく）
      var fallback = el('span', { class: 'share-fallback', hidden: true }, [xLink, lineLink]);
      row.appendChild(el('button', {
        type: 'button',
        class: 'share-btn share-native',
        onClick: function () {
          // ユーザー操作のイベントの中で同期的に呼ぶこと（そうしないと拒否される）
          try {
            var p = window.navigator.share({ title: title, text: text, url: url });
            track('native');
            if (p && p.catch) {
              p.catch(function (err) {
                // ユーザーが共有シートを閉じただけ（AbortError）は無視する
                if (err && (err.name === 'AbortError' || /abort/i.test(String(err.message || '')))) return;
                fallback.hidden = false;
                say('共有できませんでした');
              });
            }
          } catch (e) {
            fallback.hidden = false;
            say('共有できませんでした');
          }
        }
      }, [icon('share'), btnLabel('共有')]));
      row.appendChild(copyBtn);
      row.appendChild(fallback);
    } else {
      row.appendChild(xLink);
      row.appendChild(lineLink);
      row.appendChild(copyBtn);
    }

    wrap.appendChild(row);
    wrap.appendChild(toast);
    return wrap;
  };

  /** アプリ全体を共有するボタン（ホームと使い方で同じ文面にする） */
  C.appShareButtons = function (opts) {
    opts = opts || {};
    var site = K.site || {};
    return C.shareButtons({
      label: opts.label || 'このアプリを共有',
      title: site.name,
      text: (site.name || '古文単語帳') + '｜' + (site.description || ''),
      url: C.absUrl('#/'),
      contentType: 'app'
    });
  };

  /* ---------------------------------------------------------------
   * ホーム画面に追加（PWA のインストール導線）
   * ---------------------------------------------------------------
   * Android Chrome などは、条件がそろうと `beforeinstallprompt` を投げてくる。
   * 既定のバナーは止めて取っておき、こちらのボタンから出す
   * （ユーザー操作の中で prompt() を呼ばないと拒否されるため）。
   *
   * iOS Safari にはこのイベントが無い。その環境ではボタンは出ないままで、
   * 代わりに使い方ページの「アプリとして使う」に手順を書いてある。
   * すでにインストール済みで起動しているとき（display-mode: standalone）は出さない。
   * ------------------------------------------------------------- */
  var deferredPrompt = null;
  var installBlocks = [];   // いま画面にある「ホーム画面に追加」の枠

  /** 画面から外れた枠は捨てつつ、残っているものに fn を適用する */
  function eachInstallBlock(fn) {
    installBlocks = installBlocks.filter(function (b) { return document.body.contains(b); });
    installBlocks.forEach(fn);
  }

  /** ホーム画面から（＝アプリとして）起動しているか */
  C.isStandalone = function () {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    } catch (e) { /* 判定できなければ通常起動とみなす */ }
    return window.navigator && window.navigator.standalone === true;
  };

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();            // ブラウザ既定のバナーは出さず、自前のボタンに任せる
    deferredPrompt = e;
    eachInstallBlock(function (b) { b.hidden = C.isStandalone(); });
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    eachInstallBlock(function (b) { b.hidden = true; });
    if (K.analytics) K.analytics.event('app_installed', {});
  });

  /**
   * 「ホーム画面に追加」ボタン＋一言。
   * イベントが来ていない環境では枠ごと隠れる（何も出ない）。
   */
  C.installBlock = function (opts) {
    opts = opts || {};
    var wrap = el('div', { class: 'install-block' });
    var btn = el('button', {
      type: 'button',
      class: 'share-btn share-native install-btn',
      onClick: function () {
        if (!deferredPrompt) return;
        var p = deferredPrompt;
        deferredPrompt = null;     // prompt() は 1 回きり。使ったら捨てる
        try {
          p.prompt();
          if (p.userChoice && p.userChoice.then) {
            p.userChoice.then(function (choice) {
              // 承諾でも辞退でも、同じイベントは二度使えないのでボタンは畳む
              eachInstallBlock(function (b) { b.hidden = true; });
              if (K.analytics) {
                K.analytics.event('install_prompt', {
                  outcome: (choice && choice.outcome) === 'accepted' ? 'accepted' : 'dismissed'
                });
              }
            });
          } else {
            eachInstallBlock(function (b) { b.hidden = true; });
          }
        } catch (e) {
          eachInstallBlock(function (b) { b.hidden = true; });
        }
      }
    }, [icon('install'), el('span', { class: 'share-btn-label', text: 'ホーム画面に追加' })]);

    wrap.appendChild(btn);
    wrap.appendChild(el('span', {
      class: 'muted small',
      text: opts.note || 'アイコンから全画面で開けます（オフラインでも読めます）。'
    }));
    wrap.hidden = !deferredPrompt || C.isStandalone();
    installBlocks.push(wrap);
    return wrap;
  };

  /* --- 制作者情報 -------------------------------------------------- */

  var AUTHOR_SERVICES = [
    { key: 'x', label: 'X', icon: 'x' },
    { key: 'youtube', label: 'YouTube', icon: 'youtube' },
    { key: 'booth', label: 'BOOTH', icon: 'booth' }
  ];

  /** 空文字や PLACEHOLDER のままの URL はリンクにしない（未設定でも壊れないように） */
  function isUsableUrl(u) {
    return typeof u === 'string' && /^https?:\/\//i.test(u) && !/PLACEHOLDER/i.test(u);
  }

  /**
   * 制作者の外部リンク（配列）。
   * @param opts { services: ['x','youtube','booth'], labels: true でラベル併記 }
   */
  C.authorLinks = function (opts) {
    opts = opts || {};
    var a = (K.site && K.site.author) || {};
    var only = opts.services || ['x', 'youtube', 'booth'];
    var withLabel = opts.labels !== false;
    var out = [];
    AUTHOR_SERVICES.forEach(function (s) {
      if (only.indexOf(s.key) < 0) return;
      if (!isUsableUrl(a[s.key])) return;
      out.push(el('a', {
        class: 'author-link author-link-' + s.key,
        href: a[s.key],
        target: '_blank',
        rel: 'noopener noreferrer',
        title: (a.name || '') + ' の ' + s.label,
        'aria-label': (a.name || '') + ' の ' + s.label
      }, [icon(s.icon), withLabel ? el('span', { class: 'author-link-label', text: s.label }) : null]));
    });
    return out;
  };

  /** 「制作：雨峰あまね ＋ アイコンリンク」の 1 行（ホーム末尾・共通フッタ用） */
  C.authorLine = function (opts) {
    opts = opts || {};
    var a = (K.site && K.site.author) || {};
    if (!a.name) return null;
    var links = C.authorLinks({
      services: opts.services || ['x', 'youtube'],
      labels: opts.labels === true
    });
    return el('p', { class: 'author-line' }, [
      el('span', { class: 'author-line-name', text: '制作：' + a.name })
    ].concat(links.length ? [el('span', { class: 'author-links' }, links)] : []));
  };

  /** 使い方ページの「制作」節の中身（名前＋ラベル付きリンク＋一言） */
  C.authorBlock = function () {
    var a = (K.site && K.site.author) || {};
    var links = C.authorLinks({ services: ['x', 'youtube', 'booth'], labels: true });
    return el('div', { class: 'author-block' }, [
      el('p', { class: 'author-block-name' }, ['制作：', el('b', { text: a.name || '' })]),
      links.length ? el('div', { class: 'author-links author-links-lg' }, links) : null,
      el('p', { class: 'muted small', text: '感想・要望は X までお寄せください。' })
    ]);
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
