/* =====================================================================
 * js/components.js — 画面をまたいで使う部品
 * ---------------------------------------------------------------------
 *   C.wordRow(word)        単語一覧の 1 行
 *   C.wordChip(word)       関連語カードなどの小さい単語チップ
 *   C.levelBadge(word)     S / A / B のバッジ（記号＋ラベル）
 *   C.levelLegend(opts)    重要度の意味を説明する凡例
 *   C.deckLabel(query)     クエリを 1 行の日本語にする
 *   C.examBadge(exam)      出題バッジ（2025 共通テスト）／C.examBadges(list)
 *   C.statusBadge(id)      学習状態のバッジ
 *   C.statusButtons(id)    「未学習／苦手／覚えた」の切り替えボタン
 *   C.tokenPopup(token)    品詞分解のポップアップを出す
 *                          （助動詞・助詞・敬語なら文法ページへのリンクも添える）
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

  /**
   * 出題バッジ（大学入学共通テスト・センター試験の出典）。
   *   data/works.js の work.exam の 1 要素 … { year, test, part, section }
   *   data/passages.js の passage.exam     … { year, test }
   * のどちらでも受ける（足りないキーは黙って落とす）。
   *
   * 色は重要度（S/A/B）とも学年バッジ（藍）とも混ざらないよう、
   * 専用のトークン（--exam / --exam-bg）を使う。「2025 共通テスト」のように
   * **年と試験名を必ず併記**する（年だけ・試験名だけでは意味が伝わらないため）。
   * 本試験以外（第1日程・第2日程・追試験）のときだけ 3 つめの語を足し、
   * 出題箇所（section）は title 属性に回してバッジを短く保つ。
   */
  C.examBadge = function (exam) {
    if (!exam || exam.year == null) return null;
    var part = exam.part && exam.part !== '本試験' ? exam.part : '';
    var tip = [exam.year + ' 年度', exam.test, exam.part, (exam.section && exam.section !== '—') ? exam.section : '']
      .filter(Boolean).join('　');
    return el('span', { class: 'badge exam', title: tip + ' に出題' }, [
      el('span', { class: 'exam-year', text: exam.year }),
      exam.test ? el('span', { class: 'exam-test', text: exam.test }) : null,
      part ? el('span', { class: 'exam-part', text: part }) : null
    ]);
  };

  /** 出題バッジの配列（work.exam をそのまま渡す）。null は落とす */
  C.examBadges = function (list) {
    return (list || []).map(C.examBadge).filter(Boolean);
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
   * そのトークンに対応する文法ページへのリンク（0〜2 本）。
   * 助動詞・助詞・敬語なら「文法：『ぬ』（完了）の解説へ →」、
   * 識別の対象になる字面なら「識別：『ぬ／ね』— 完了か打消か →」を足す。
   * data/grammar.js が無い環境では何も返さない（ポップアップは今までどおり）。
   */
  function grammarLinks(token) {
    if (!K.index || !K.index.grammarOfToken) return [];
    var hit = K.index.grammarOfToken(token);
    if (!hit) return [];
    var out = [];
    if (hit.entry) {
      var name = hit.entry.name || hit.entry.word || hit.entry.id;
      var label = K.index.grammarMeaningLabel(token.meaning || token.m);
      out.push(el('a', {
        class: 'popup-link popup-link-grammar',
        href: '#/grammar/' + hit.category + '/' + encodeURIComponent(hit.entry.id),
        onClick: closePopup
      }, ['文法：「' + name + '」' + (label ? '（' + label + '）' : '') + 'の解説へ →']));
    }
    if (hit.ident) {
      out.push(el('a', {
        class: 'popup-link popup-link-grammar',
        href: '#/grammar/ident/' + encodeURIComponent(hit.ident.id),
        onClick: closePopup
      }, ['識別：' + hit.ident.title + ' →']));
    }
    return out;
  }

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
    ].concat(grammarLinks(token)));

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
        // 品詞分解の n と vocab の note は同じ出どころから書かれることが多く、
        // そのまま繋ぐとポップアップに同じ一文が 2 回並ぶ。同一なら足さない。
        if (hit.note && hit.note !== tk.note) {
          tk.note = tk.note ? tk.note + '　' + hit.note : hit.note;
        }
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
   * トークン列から「その語を含む 1 文」だけを切り出す（前後の「。」で切る）。
   * 文法ページの用例（js/data-index.js の sentenceRange）と同じ切り方。
   * 該当語が見つからなければ null で、呼び出し側は段落まるごとに落ちる。
   */
  function sentenceTokensOf(list, wordId) {
    if (!Array.isArray(list)) return null;
    var idx = -1, k;
    for (k = 0; k < list.length; k++) {
      if (list[k] && list[k].w === wordId) { idx = k; break; }
    }
    if (idx < 0) return null;
    var from = 0, to = list.length - 1, i;
    for (i = idx - 1; i >= 0; i--) {
      if (/。/.test((list[i] && list[i].s) || '')) { from = i + 1; break; }
    }
    for (i = idx; i < list.length; i++) {
      if (/。/.test((list[i] && list[i].s) || '')) { to = i; break; }
    }
    if (from > idx) from = idx;
    return list.slice(from, to + 1);
  }

  /**
   * その語の「用例」を 1 つ返す（学習カードの裏・クイズの答え合わせで使う）。
   * 根拠は品詞分解（data/tokens/*.js）の w が付いた段落。まだ品詞分解の無い
   * 文章にしか出てこない語では null になり、呼び出し側は用例を出さない。
   * @param opts  { sentence: true } なら段落ではなく「該当語を含む 1 文」だけを
   *              返す（文法ページの用例と同じ切り方）。現代語訳は段落ぶんしか
   *              無く 1 文と対応しないので、そのときは空文字にする。
   * @returns {{label, line, translation, passage, sentence}|null}
   */
  C.usageFor = function (wordId, opts) {
    opts = opts || {};
    var hits = K.index.paragraphsOfWord(wordId);
    if (hits.length) {
      var h = hits[0];
      var wk = K.index.getWork(h.passage.workId);
      var toks = h.tokens;
      var oneSentence = false;
      if (opts.sentence) {
        var cut = sentenceTokensOf(h.tokens, Number(wordId));
        if (cut && cut.length) { toks = cut; oneSentence = true; }
      }
      return {
        label: (wk ? wk.title : '') + '「' + h.passage.title + '」',
        line: C.passageTokenLine(
          K.index.entriesOfPassage(h.passage.id), toks,
          { highlightWordId: wordId, passageId: h.passage.id }),
        translation: oneSentence ? '' : h.translation,
        passage: h.passage,
        sentence: oneSentence
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
   * **公式ロゴは一切使わず、似せもしない**（docs/copyright-review.md §7）:
   *   ・LINE ソーシャルプラグインの利用ガイドラインは「専用アイコンの代わりに
   *     当社が指定するテキスト文字を使用することができます」としつつ、
   *     「専用アイコンと類似する商標、ロゴ、アイコンその他の標章を表示しては
   *     なりません」とも定める。そこで LINE は**吹き出しをやめて紙飛行機**にし、
   *     ラベルは公式の指定テキスト「LINEで送る」をそのまま使う。
   *   ・X は交差する 2 本の線だけ（ロゴの再現ではない）。ラベルは X の
   *     用語表（Twitter→X、Tweet→post）に合わせて「X で投稿」。
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
    // LINE で送る：紙飛行機（＝「送る」の意。LINE の専用アイコンには似せない）
    line: '<path d="M21 3.6 2.8 11.2l6.5 2.3z"/><path d="M21 3.6 13.4 21l-4.1-7.5z"/>' +
          '<path d="M9.3 13.5 21 3.6"/>',
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
             '<path d="M4.5 16v2.5A2 2 0 0 0 6.5 20.5h11a2 2 0 0 0 2-2V16"/>',
    // シャッフル（「古典ショート」の並べ替え）：交差する 2 本の矢印。
    // 既存アイコンセットの複製ではなく、線を交差させただけの独自の作図
    shuffle: '<path d="M3.5 8h3.2c2 0 3.1 1 4.6 3.2"/>' +
             '<path d="M3.5 16h3.2c2 0 3.1 -1 4.6 -3.2"/>' +
             '<path d="M13.7 8.6C15 6.6 16.1 6 18 6"/>' +
             '<path d="M13.7 15.4c1.3 2 2.4 2.6 4.3 2.6"/>' +
             '<path d="M16 3.6 19 6l-3 2.4"/>' +
             '<path d="M16 20.4 19 18l-3 -2.4"/>'
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
    return 'https://x.com/intent/tweet?' + q;
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
      // ラベルは LINE の指定テキスト（デザインガイドの日本語の推奨表記）そのまま
    }, [icon('line'), btnLabel('LINEで送る')]);

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
  /** index.html のヘッダ（静的 HTML）から出し分けを判定するために公開する */
  C.isUsableUrl = isUsableUrl;

  /**
   * YouTube への外部リンクをクリックしたときの計測（KOBUN.analytics が無効なら no-op）。
   * @param placement 'home' | 'quiz' | 'study' | 'footer' | 'help' | 'header'
   */
  function trackYoutubeClick(placement) {
    if (K.analytics) K.analytics.event('outbound_click', { destination: 'youtube', placement: placement || 'home' });
  }

  /**
   * 制作者の外部リンク（配列）。
   * @param opts {
   *   services: ['x','youtube','booth'], labels: true でラベル併記,
   *   emphasize: ['youtube'] のように指定すると、その項目だけラベルを強制的に出し
   *              専用の色（.author-link-emphasize）で目立たせる,
   *   placement: YouTube リンクの計測用（省略時 'footer'）
   * }
   */
  C.authorLinks = function (opts) {
    opts = opts || {};
    var a = (K.site && K.site.author) || {};
    var only = opts.services || ['x', 'youtube', 'booth'];
    var withLabel = opts.labels !== false;
    var emphasize = opts.emphasize || [];
    var placement = opts.placement || 'footer';
    var out = [];
    AUTHOR_SERVICES.forEach(function (s) {
      if (only.indexOf(s.key) < 0) return;
      if (!isUsableUrl(a[s.key])) return;
      var isEmph = emphasize.indexOf(s.key) >= 0;
      var showLabel = withLabel || isEmph;
      out.push(el('a', {
        class: 'author-link author-link-' + s.key + (isEmph ? ' author-link-emphasize' : ''),
        href: a[s.key],
        target: '_blank',
        rel: 'noopener noreferrer',
        title: (a.name || '') + ' の ' + s.label,
        'aria-label': (a.name || '') + ' の ' + s.label,
        onClick: s.key === 'youtube' ? function () { trackYoutubeClick(placement); } : null
      }, [icon(s.icon), showLabel ? el('span', { class: 'author-link-label', text: s.label }) : null]));
    });
    return out;
  };

  /**
   * 「制作：雨峰あまね ＋ アイコンリンク」の 1 行（ホーム末尾・共通フッタ用）。
   * @param opts { services, labels, emphasize, placement, legal: true で「利用規約・プライバシーポリシー」を添える }
   */
  C.authorLine = function (opts) {
    opts = opts || {};
    var a = (K.site && K.site.author) || {};
    if (!a.name) return null;
    var links = C.authorLinks({
      services: opts.services || ['x', 'youtube'],
      labels: opts.labels === true,
      emphasize: opts.emphasize || [],
      placement: opts.placement || 'footer'
    });
    return el('p', { class: 'author-line' }, [
      el('span', { class: 'author-line-name', text: '制作：' + a.name })
    ].concat(links.length ? [el('span', { class: 'author-links' }, links)] : [])
      .concat(opts.legal ? [
        el('a', { class: 'author-line-legal', href: '#/terms', text: '利用規約・プライバシーポリシー' })
      ] : []));
  };

  /**
   * YouTube チャンネルへの赤いボタン（主ボタン）。
   * ホームの制作者カード・使い方ページの「制作」節で使う。
   * `author.youtube` が空／PLACEHOLDER なら null を返す（呼び出し側は出さない）。
   */
  C.youtubeButton = function (opts) {
    opts = opts || {};
    var a = (K.site && K.site.author) || {};
    if (!isUsableUrl(a.youtube)) return null;
    var placement = opts.placement || 'home';
    return el('a', {
      class: 'btn btn-yt' + (opts.large ? ' btn-lg' : ''),
      href: a.youtube,
      target: '_blank',
      rel: 'noopener noreferrer',
      onClick: function () { trackYoutubeClick(placement); }
    }, [icon('youtube'), el('span', { text: opts.label || 'YouTube を見る' })]);
  };

  /**
   * 制作者アイコン（<picture> で同名 .webp を先に試し、失敗したら avatar のまま）。
   * `author.avatar` が未設定なら null を返す（呼び出し側は代わりのアイコンを出す）。
   * @param size px（正方形。円形や角丸に切るのは呼び出し側の CSS）
   */
  function authorAvatar(size, extraClass) {
    var a = (K.site && K.site.author) || {};
    if (!a.avatar) return null;
    var webp = String(a.avatar).replace(/\.[a-z0-9]+$/i, '.webp');
    return el('picture', { class: 'author-avatar' + (extraClass ? ' ' + extraClass : '') }, [
      el('source', { srcset: webp, type: 'image/webp' }),
      el('img', {
        src: a.avatar,
        alt: a.name || '',
        width: size,
        height: size,
        loading: 'lazy',
        decoding: 'async'
      })
    ]);
  }

  /**
   * ホーム用の制作者カード。YouTube チャンネルへの導線を目立たせるための専用カード。
   * 左にアイコン（制作者アイコンがあればそれ、無ければ YouTube の線画アイコン）、
   * 中央に名前と一言、右に赤の主ボタン＋小さく X・BOOTH のリンク。
   * `author.youtube` が空／PLACEHOLDER のときはカードごと出さない。
   */
  C.youtubeCard = function (opts) {
    opts = opts || {};
    var a = (K.site && K.site.author) || {};
    var placement = opts.placement || 'home';
    var btn = C.youtubeButton({ placement: placement });
    if (!btn) return null;
    var otherLinks = C.authorLinks({ services: ['x', 'booth'], labels: false, placement: placement });
    var avatar = authorAvatar(112, 'author-yt-avatar');
    return el('div', { class: 'card author-yt-card' }, [
      avatar || el('div', { class: 'author-yt-icon', 'aria-hidden': 'true' }, [icon('youtube')]),
      el('div', { class: 'author-yt-body' }, [
        el('p', { class: 'author-yt-name' }, [
          '制作：', el('b', { text: a.name || '' }),
          a.role ? el('span', { class: 'badge author-yt-role', text: a.role }) : null
        ]),
        a.tagline ? el('p', { class: 'author-yt-lead muted small', text: a.tagline }) : null,
        otherLinks.length ? el('div', { class: 'author-links author-yt-others' }, otherLinks) : null
      ]),
      el('div', { class: 'author-yt-cta' }, [btn])
    ]);
  };

  /**
   * クイズ結果・学習の完走画面に添える、YouTube への小さなテキストリンク行。
   * 共有ボタンより控えめに（ボタンではなくリンク＋アイコン）見せる。
   */
  C.youtubeLinkLine = function (opts) {
    opts = opts || {};
    var a = (K.site && K.site.author) || {};
    if (!isUsableUrl(a.youtube)) return null;
    var placement = opts.placement || 'quiz';
    return el('p', { class: 'author-yt-line small' }, [
      '解説動画は YouTube で → ',
      el('a', {
        class: 'author-yt-line-link',
        href: a.youtube,
        target: '_blank',
        rel: 'noopener noreferrer',
        onClick: function () { trackYoutubeClick(placement); }
      }, [icon('youtube'), el('span', { text: 'チャンネルを見る' })])
    ]);
  };

  /** 制作者カードの立ち絵などのイラストレーター表記。`author.illustrator` が無ければ null */
  function illustratorLine() {
    var ill = (K.site && K.site.author && K.site.author.illustrator) || null;
    if (!ill || !ill.name) return null;
    var body = isUsableUrl(ill.x)
      ? ['キャラクターイラスト：', el('a', { href: ill.x, target: '_blank', rel: 'noopener noreferrer', text: ill.name })]
      : ['キャラクターイラスト：' + ill.name];
    return el('p', { class: 'muted small author-illustrator' }, body);
  }

  /**
   * 使い方ページの「制作」節の中身。
   * 制作者アイコンがあれば文字の左に丸く小さく添え（無ければ画像なしの従来レイアウト）、
   * YouTube を先頭のボタンにし、X・BOOTH はラベル付きリンクで添える。
   * イラストレーターのクレジット（`author.illustrator`）があれば 1 行添える。
   */
  C.authorBlock = function () {
    var a = (K.site && K.site.author) || {};
    var ytBtn = C.youtubeButton({ placement: 'help' });
    var links = C.authorLinks({ services: ['x', 'booth'], labels: true, placement: 'help' });
    var avatar = authorAvatar(72, 'author-block-avatar');
    var text = el('div', { class: 'author-block-text' }, [
      el('p', { class: 'author-block-name' }, ['制作：', el('b', { text: a.name || '' })]),
      ytBtn ? el('div', { class: 'author-block-yt' }, [ytBtn]) : null,
      links.length ? el('div', { class: 'author-links author-links-lg' }, links) : null,
      illustratorLine(),
      el('p', { class: 'muted small', text: '感想・要望は X までお寄せください。' })
    ]);
    return el('div', { class: 'author-block' }, [avatar, text].filter(Boolean));
  };

  /* ---------------------------------------------------------------
   * ホーム末尾の YouTube 動画カード（クリックして読み込む）
   * ---------------------------------------------------------------
   * 既定は `author.youtubeShorts`（tools/fetch-shorts.mjs が作る { id, title }
   * の配列）を使った「古典ショート」のグリッド表示。空のときは
   * `author.youtubePlaylist` の単体埋め込みにフォールバックし、
   * それも決まらなければ null（呼び出し側はカードごと出さない）。
   * どちらの形でも、プライバシー配慮で初期表示は自作の SVG 再生アイコンの
   * プレースホルダだけを出し、クリックしたときだけ youtube-nocookie.com の
   * iframe を挿入する（挿入するまで YouTube には一切通信しない。
   * サムネイルは自サイトの assets/yt/ に置いてあるので、ここも通信ゼロ）。
   * file:// で開いたときは iframe が動かないことがあるので、案内文言だけにする。
   * ------------------------------------------------------------- */

  /** 再生アイコン（プレースホルダ用。18px の icon() とは別に大きく描く） */
  function playIconSvg(size) {
    return el('span', {
      class: 'yt-embed-play-svg',
      'aria-hidden': 'true',
      html: '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" ' +
        'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="12" cy="12" r="10"/><path d="M10 8.2 16.4 12 10 15.8Z" fill="currentColor" stroke="none"/></svg>'
    });
  }

  /** 埋め込む再生リストの id を決める（明示指定が無ければアップロード動画の再生リストを使う） */
  function resolveYoutubePlaylistId() {
    var a = (K.site && K.site.author) || {};
    var pl = String(a.youtubePlaylist || '').trim();
    if (pl) return pl;
    var ch = String(a.youtubeChannelId || '').trim();
    if (/^UC/.test(ch)) return 'UU' + ch.slice(2);
    return '';
  }

  /** file:// で開いているか（iframe も外部 assets への navigate も動かない環境） */
  function isFileProtocol() {
    return (location.protocol || '').toLowerCase() === 'file:';
  }

  /** 1 本ぶんのショートのタイル。クリックすると自分だけ iframe に差し替わる */
  function shortsTile(s, placement) {
    var isFile = isFileProtocol();
    var btn = el('button', {
      type: 'button',
      class: 'yt-shorts-btn',
      'aria-label': 'クリックで再生（YouTube を読み込みます）：' + s.title,
      onClick: function () {
        if (isFile) {
          U.clear(btn);
          btn.appendChild(el('p', { class: 'yt-embed-file muted small', text: '公開サイトで再生できます。' }));
          return;
        }
        var iframe = el('iframe', {
          src: 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(s.id) + '?rel=0&autoplay=1',
          title: s.title,
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
          allowfullscreen: true,
          loading: 'lazy'
        });
        U.clear(btn);
        btn.appendChild(iframe);
        btn.classList.add('is-loaded');
        if (K.analytics) K.analytics.event('video_load', { placement: placement, video_id: s.id });
      }
    }, [
      el('img', {
        class: 'yt-shorts-thumb',
        src: 'assets/yt/' + s.id + '.webp',
        alt: '',
        loading: 'lazy',
        decoding: 'async'
      }),
      playIconSvg(36),
      el('span', { class: 'yt-shorts-title', text: s.title })
    ]);
    return el('div', { class: 'yt-shorts-tile' }, [btn]);
  }

  /** shorts から重複無しで n 本ランダムに選ぶ（Fisher–Yates） */
  function pickRandomShorts(list, n) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr.slice(0, n);
  }

  /**
   * 古典ショートのグリッドカード（author.youtubeShorts が 1 件以上あるとき）。
   * 初期表示は再生リストの先頭（＝最新）6 本を固定で出す。見出し右の
   * 「別の動画を見る」を押すと、そのときだけ全件からランダムに 6 本を引き直す
   * （押すたびに再抽選）。シャッフルしたあとは「最新に戻す」が出る。
   */
  function youtubeShortsCard(shorts, placement) {
    var a = (K.site && K.site.author) || {};
    var N = Math.min(6, shorts.length);
    var latest = shorts.slice(0, N);

    var grid = el('div', { class: 'yt-shorts-grid' });
    function renderTiles(list) {
      U.clear(grid);
      list.forEach(function (s) { grid.appendChild(shortsTile(s, placement)); });
    }
    renderTiles(latest);

    var resetBtn = el('button', {
      type: 'button',
      class: 'yt-shorts-reset',
      hidden: true,
      onClick: function () {
        renderTiles(latest);
        resetBtn.hidden = true;
      }
    }, ['最新に戻す']);

    var shuffleBtn = el('button', {
      type: 'button',
      class: 'btn btn-ghost yt-shorts-shuffle',
      'aria-label': '別の動画を見る（ランダムに入れ替える）',
      onClick: function () {
        renderTiles(pickRandomShorts(shorts, N));
        resetBtn.hidden = false;
        if (K.analytics) K.analytics.event('shorts_shuffle', {});
      }
    }, [icon('shuffle'), el('span', { text: '別の動画を見る' })]);

    // 見出し → 説明 → 操作 → グリッド の順に置く。
    // 広い幅では .yt-shorts-controls が position: absolute で見出しの右上に浮くので
    // DOM の位置は効かないが、狭い幅（480px 以下）では static に戻って
    // この場所にそのまま流れる。見出しより前に置くと、ボタンだけが
    // カードの外側に浮いたように見えるため、説明文の直後に置いている。
    var card = el('div', { class: 'card card-video-yt' }, [
      el('h2', { class: 'card-title', text: '古典ショート' }),
      el('p', { class: 'muted small', text: (a.name || '制作者') + 'が古文をテーマに投稿しているショート動画です。' }),
      el('div', { class: 'yt-shorts-controls' }, [shuffleBtn, resetBtn]),
      grid
    ]);

    var links = [];
    if (a.youtubeShortsPlaylist) {
      links.push(el('a', {
        href: 'https://www.youtube.com/playlist?list=' + encodeURIComponent(a.youtubeShortsPlaylist),
        target: '_blank',
        rel: 'noopener noreferrer',
        onClick: function () { trackYoutubeClick('home-shorts'); }
      }, ['ショートをもっと見る →']));
    }
    if (isUsableUrl(a.youtube)) {
      links.push(el('a', {
        href: a.youtube,
        target: '_blank',
        rel: 'noopener noreferrer',
        onClick: function () { trackYoutubeClick('home-video'); }
      }, ['チャンネルを見る →']));
    }
    if (links.length) card.appendChild(el('p', { class: 'yt-embed-more' }, links));

    return card;
  }

  /** 単体の再生リスト埋め込みカード（youtubeShorts が空のときのフォールバック） */
  function youtubePlaylistEmbedCard(playlistId, placement) {
    var a = (K.site && K.site.author) || {};
    var card = el('div', { class: 'card card-video-yt' }, [
      el('h2', { class: 'card-title', text: (a.name || '制作者') + 'の動画' }),
      el('p', { class: 'muted small', text: '古文の解説動画などを YouTube で公開しています。' })
    ]);

    var box = el('div', { class: 'yt-embed-box' });

    if (isFileProtocol()) {
      box.appendChild(el('p', { class: 'yt-embed-file muted small', text: '公開サイトで再生できます。' }));
    } else {
      box.appendChild(el('button', {
        type: 'button',
        class: 'yt-embed-placeholder',
        'aria-label': 'クリックで再生（YouTube を読み込みます）',
        onClick: function () {
          var iframe = el('iframe', {
            src: 'https://www.youtube-nocookie.com/embed/videoseries?list=' + encodeURIComponent(playlistId) + '&rel=0',
            title: (a.name || '') + ' の YouTube 動画',
            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
            allowfullscreen: true,
            loading: 'lazy'
          });
          U.clear(box);
          box.appendChild(iframe);
          if (K.analytics) K.analytics.event('video_load', { placement: placement });
        }
      }, [
        playIconSvg(52),
        el('span', { class: 'yt-embed-hint', text: 'クリックで再生（YouTube を読み込みます）' })
      ]));
    }

    card.appendChild(el('div', { class: 'yt-embed' }, [box]));

    if (isUsableUrl(a.youtube)) {
      card.appendChild(el('p', { class: 'yt-embed-more' }, [
        el('a', {
          href: a.youtube,
          target: '_blank',
          rel: 'noopener noreferrer',
          onClick: function () { trackYoutubeClick('home-video'); }
        }, ['チャンネルで他の動画を見る →'])
      ]));
    }

    return card;
  }

  /**
   * ホーム末尾の動画カード。`author.youtubeShorts` があればそのグリッド、
   * 無ければ `author.youtubePlaylist` の単体埋め込み、どちらも無ければ null。
   * @param opts { placement: 計測用（既定 'home'） }
   */
  C.youtubeVideoCard = function (opts) {
    opts = opts || {};
    var placement = opts.placement || 'home';
    var a = (K.site && K.site.author) || {};
    var shorts = (Array.isArray(a.youtubeShorts) ? a.youtubeShorts : [])
      .filter(function (s) { return s && s.id; });

    if (shorts.length) return youtubeShortsCard(shorts, placement);

    var playlistId = resolveYoutubePlaylistId();
    if (!playlistId) return null;
    return youtubePlaylistEmbedCard(playlistId, placement);
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
