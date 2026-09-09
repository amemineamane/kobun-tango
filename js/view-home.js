/* =====================================================================
 * js/view-home.js — トップ画面（#/）
 * ---------------------------------------------------------------------
 * 「開いてまず何をすればいいか」を 1 画面で示すための入口。
 * 中身はすべて既存のデータ・store から組み立てるだけで、
 * この画面のためのデータは持たない（KOBUN.index と KOBUN.store だけを読む）。
 *
 *   1. ヒーロー           … アプリの説明と 3 つの大きな導線
 *   2. 学習の状態         … 330 語の進捗（覚えた／苦手／未学習）と「続きから」
 *   3. おすすめ           … 苦手が溜まっていれば復習、無ければ未学習のデッキ
 *   4. 入口カード         … 重要度・品詞・作品・文章へのショートカット
 *   5. フッターのリンク   … 使い方 / データについて
 *
 * リンク先は既存のクエリ形式に合わせる（#/words?level=S など）。
 * 新しいルールを増やさないので、フィルタが増えてもここは壊れない。
 * ===================================================================== */
(function () {
  'use strict';

  var K = window.KOBUN;
  var U = K.util;
  var C = K.components;
  var el = U.el;

  /** 覚えた／苦手／未学習の 3 色の帯 */
  function progressBar(sum) {
    function seg(cls, n) {
      if (!n) return null;
      return el('div', {
        class: 'progress-seg ' + cls,
        style: { width: (n / sum.total * 100) + '%' }
      });
    }
    return el('div', { class: 'progress progress-multi' }, [
      seg('is-known', sum.known),
      seg('is-weak', sum.weak)
    ]);
  }

  function statRow(sum) {
    function stat(cls, label, n) {
      return el('div', { class: 'stat ' + cls }, [
        el('span', { class: 'stat-num', text: String(n) }),
        el('span', { class: 'stat-label', text: label })
      ]);
    }
    return el('div', { class: 'stat-row' }, [
      stat('is-known', '覚えた', sum.known),
      stat('is-weak', '苦手', sum.weak),
      stat('is-new', '未学習', sum.newCount)
    ]);
  }

  /* ---------------------------------------------------------------
   * 2. 学習の状態
   * ------------------------------------------------------------- */
  function statusCard() {
    var sum = K.store.summary(K.index.words.length);
    var started = sum.known + sum.weak > 0;
    var card = el('div', { class: 'card home-status' }, [
      el('h2', { class: 'card-title' }, [
        started ? '学習の状態' : 'まずはここから',
        el('span', { class: 'muted small', text: '（全 ' + sum.total + ' 語）' })
      ])
    ]);

    if (!started) {
      // 履歴ゼロ。数字を並べても意味がないので、最初の一歩だけを出す。
      var s = K.index.getLevel('S');
      card.appendChild(el('p', { class: 'home-first' }, [
        'まだ学習の記録がありません。まずは ',
        el('b', { text: 'S 最重要の ' + (s ? s.count : '') + ' 語' }),
        ' から始めるのがおすすめです（' + (s ? s.desc : '') + '）。'
      ]));
      card.appendChild(el('div', { class: 'deck-links' }, [
        el('a', { class: 'btn btn-primary', href: '#/study?level=S', text: 'S ランクの ' + (s ? s.count : '') + ' 語で学習を始める' }),
        el('a', { class: 'btn', href: '#/words?level=S', text: 'まず一覧で眺める' })
      ]));
      card.appendChild(el('p', { class: 'muted small', text: '「覚えた／まだ」を押すと、この端末のブラウザに記録されます（サーバーには送りません）。' }));
      return card;
    }

    card.appendChild(progressBar(sum));
    card.appendChild(statRow(sum));

    /* --- 続きから ------------------------------------------------- */
    var recentDeck = K.store.getRecent('deck');
    var recentPassage = K.store.getRecent('passage');
    if (recentDeck || recentPassage) {
      var links = el('div', { class: 'deck-links' });
      if (recentDeck) {
        links.appendChild(el('a', {
          class: 'btn btn-primary',
          href: '#/study' + (recentDeck.query || ''),
          text: '続きから学習（' + recentDeck.label + '）'
        }));
      }
      if (recentPassage) {
        links.appendChild(el('a', {
          class: 'btn',
          href: '#/passage/' + recentPassage.id,
          text: '「' + recentPassage.title + '」の続きを読む'
        }));
      }
      card.appendChild(el('h3', { class: 'home-sub', text: '続きから' }));
      card.appendChild(links);
    } else {
      card.appendChild(el('div', { class: 'deck-links' }, [
        el('a', { class: 'btn btn-primary', href: '#/study', text: '学習を続ける' }),
        el('a', { class: 'btn', href: '#/words', text: '単語一覧を見る' })
      ]));
    }
    return card;
  }

  /* ---------------------------------------------------------------
   * 3. おすすめ
   * ------------------------------------------------------------- */
  function recommendCard() {
    var sum = K.store.summary(K.index.words.length);
    var card = el('div', { class: 'card home-reco' }, [
      el('h2', { class: 'card-title', text: '今日のおすすめ' })
    ]);

    if (sum.weak > 0) {
      card.appendChild(el('p', {}, [
        el('b', { text: '苦手が ' + sum.weak + ' 語' }),
        ' たまっています。まとめて復習すると定着が早くなります。'
      ]));
      card.appendChild(el('div', { class: 'deck-links' }, [
        el('a', { class: 'btn btn-primary', href: '#/study?status=weak', text: '苦手 ' + sum.weak + ' 語を復習' }),
        el('a', { class: 'btn', href: '#/quiz?status=weak', text: '苦手だけでクイズ' }),
        el('a', { class: 'btn btn-ghost', href: '#/words?status=weak', text: '一覧で見る' })
      ]));
      return card;
    }

    // 苦手ゼロ。未学習の語が残っている行（五十音行）からランダムに 1 つ薦める。
    var rows = K.index.kanaRows.filter(function (r) {
      return K.index.words.some(function (w) {
        return w.kanaRow === r && K.store.getStatus(w.id) === 'new';
      });
    });
    if (!rows.length) {
      card.appendChild(el('p', { text: '330 語すべてに学習の記録が付きました。クイズで力だめしをしてみてください。' }));
      card.appendChild(el('div', { class: 'deck-links' }, [
        el('a', { class: 'btn btn-primary', href: '#/quiz', text: '330 語からクイズ' }),
        el('a', { class: 'btn', href: '#/passages', text: '文章を読む' })
      ]));
      return card;
    }

    var row = rows[Math.floor(Math.random() * rows.length)];
    var n = K.index.words.filter(function (w) {
      return w.kanaRow === row && K.store.getStatus(w.id) === 'new';
    }).length;

    card.appendChild(el('p', {}, [
      '未学習が ', el('b', { text: sum.newCount + ' 語' }), ' 残っています。',
      'きょうは ', el('b', { text: row }), ' の未学習 ' + n + ' 語はいかがですか。'
    ]));
    card.appendChild(el('div', { class: 'deck-links' }, [
      el('a', {
        class: 'btn btn-primary',
        href: '#/study?row=' + encodeURIComponent(row) + '&status=new',
        text: row + 'の未学習 ' + n + ' 語で学習'
      }),
      el('a', { class: 'btn', href: '#/study?status=new', text: '未学習からランダムに' })
    ]));
    return card;
  }

  /* ---------------------------------------------------------------
   * 4. 入口カード
   * ------------------------------------------------------------- */
  function levelCard() {
    var card = el('div', { class: 'card' }, [
      el('h2', { class: 'card-title', text: '重要度から選ぶ' }),
      el('p', { class: 'muted small', text: 'S → A → B の順に、入試での問われやすさが下がります。まず S から固めるのが近道です。' })
    ]);
    var grid = el('div', { class: 'entry-grid' });
    K.index.levels.forEach(function (l) {
      var ids = K.index.words.filter(function (w) { return w.level === l.code; })
        .map(function (w) { return w.id; });
      var s = K.store.summaryOf(ids);
      grid.appendChild(el('a', { class: 'entry-card lv-' + l.code, href: '#/words?level=' + l.code }, [
        el('span', { class: 'entry-card-head' }, [
          el('span', { class: 'badge level level-' + l.code }, [
            el('span', { class: 'level-code', text: l.code }),
            el('span', { class: 'level-name', text: l.label })
          ]),
          el('span', { class: 'entry-card-count', text: l.count + ' 語' })
        ]),
        el('span', { class: 'entry-card-desc', text: l.desc }),
        el('span', { class: 'entry-card-progress muted', text: '覚えた ' + s.known + ' / ' + l.count })
      ]));
    });
    card.appendChild(grid);
    return card;
  }

  function posCard() {
    var card = el('div', { class: 'card' }, [
      el('h2', { class: 'card-title', text: '品詞から選ぶ' })
    ]);
    var list = el('div', { class: 'tile-list' });
    K.index.posList.forEach(function (p) {
      var n = K.index.words.filter(function (w) { return w.pos === p; }).length;
      list.appendChild(el('a', { class: 'tile', href: '#/words?pos=' + encodeURIComponent(p) }, [
        el('span', { class: 'tile-title', text: p }),
        el('span', { class: 'tile-sub muted', text: n + ' 語' })
      ]));
    });
    card.appendChild(list);
    card.appendChild(el('p', { class: 'muted small', text: '五十音行から引くこともできます（単語一覧の「五十音行」）。' }));
    return card;
  }

  function workCard() {
    var card = el('div', { class: 'card' }, [
      el('h2', { class: 'card-title' }, [
        '作品から選ぶ',
        el('span', { class: 'muted small', text: '（' + K.index.works.length + ' 件）' })
      ])
    ]);
    var list = el('div', { class: 'tile-list' });
    K.index.works.forEach(function (w) {
      var np = K.index.passagesOfWork(w.id).length;
      var nw = (K.index.wordsByWork.get(w.id) || []).length;
      list.appendChild(el('a', { class: 'tile tile-work', href: '#/work/' + w.id }, [
        el('span', { class: 'tile-title', text: w.title }),
        el('span', { class: 'tile-sub muted', text: '文章 ' + np + '・語 ' + nw })
      ]));
    });
    card.appendChild(list);
    card.appendChild(el('p', { class: 'home-more' }, [
      el('a', { href: '#/works', text: '作品一覧をすべて見る →' })
    ]));
    return card;
  }

  function passageCard() {
    var card = el('div', { class: 'card' }, [
      el('h2', { class: 'card-title' }, [
        '教科書の文章から選ぶ',
        el('span', { class: 'muted small', text: '（' + K.index.passages.length + ' 編）' })
      ]),
      el('p', { class: 'muted small', text: '原文と現代語訳を並べて読み、その文章に出てくる語だけで学習できます。' })
    ]);

    // 学年でしぼった入口（文章一覧の ?grade= にそのまま渡す）
    var grades = el('div', { class: 'tile-list' });
    K.index.grades.forEach(function (g) {
      var n = K.index.passages.filter(function (p) { return (p.grade || []).indexOf(g) >= 0; }).length;
      grades.appendChild(el('a', { class: 'tile', href: '#/passages?grade=' + encodeURIComponent(g) }, [
        el('span', { class: 'tile-title', text: g }),
        el('span', { class: 'tile-sub muted', text: n + ' 編' })
      ]));
    });
    card.appendChild(grades);

    // 直近の 4 編だけ名前で見せる（全部は文章一覧へ）
    var grid = el('div', { class: 'entry-grid' });
    K.index.passages.slice(0, 4).forEach(function (p) {
      var work = K.index.getWork(p.workId);
      var s = K.store.summaryOf(K.index.deckOfPassage(p.id).map(function (w) { return w.id; }));
      grid.appendChild(el('a', { class: 'entry-card', href: '#/passage/' + p.id }, [
        el('span', { class: 'entry-card-head' }, [
          el('span', { class: 'entry-card-title', text: p.title }),
          el('span', { class: 'entry-card-count', text: '語 ' + s.total })
        ]),
        el('span', { class: 'entry-card-desc', text: (work ? work.title : '') + (p.section ? '　' + p.section : '') }),
        el('span', { class: 'entry-card-progress muted', text: '覚えた ' + s.known + ' / ' + s.total })
      ]));
    });
    card.appendChild(grid);
    card.appendChild(el('p', { class: 'home-more' }, [
      el('a', { href: '#/passages', text: '文章一覧をすべて見る →' })
    ]));
    return card;
  }

  /* ---------------------------------------------------------------
   * 描画
   * ------------------------------------------------------------- */
  function render(params, query, container) {
    var section = el('section', { class: 'view view-home' });

    section.appendChild(el('div', { class: 'home-hero' }, [
      el('h1', { class: 'home-hero-title', text: '古文単語帳' }),
      el('p', { class: 'home-hero-lead' }, [
        '入試向けの古文単語 ',
        el('b', { text: K.index.words.length + ' 語' }),
        ' と、教科書の定番教材 ',
        el('b', { text: K.index.passages.length + ' 編' }),
        ' の文章で学ぶ単語帳です。'
      ]),
      el('div', { class: 'home-actions' }, [
        el('a', { class: 'btn btn-primary btn-lg', href: '#/study', text: '単語を学習する' }),
        el('a', { class: 'btn btn-lg', href: '#/passages', text: '教科書の文章を読む' }),
        el('a', { class: 'btn btn-lg', href: '#/quiz', text: 'クイズ' })
      ]),
      el('p', { class: 'home-hero-sub muted' }, [
        el('a', { href: '#/words', text: '単語一覧から探す' }),
        '　/　',
        el('a', { href: '#/help', text: '使い方を読む' })
      ])
    ]));

    section.appendChild(statusCard());
    section.appendChild(recommendCard());
    section.appendChild(levelCard());
    section.appendChild(posCard());
    section.appendChild(workCard());
    section.appendChild(passageCard());

    section.appendChild(el('div', { class: 'home-foot' }, [
      el('a', { href: '#/help', text: '使い方' }),
      el('a', { href: '#/help?to=data', text: 'データについて（一次校閲済・底本異同あり）' }),
      el('a', { href: '#/help?to=history', text: '学習履歴について' })
    ]));

    container.appendChild(section);
  }

  K.views = K.views || {};
  K.views.home = { render: render };
})();
