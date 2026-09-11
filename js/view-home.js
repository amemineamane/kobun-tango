/* =====================================================================
 * js/view-home.js — トップ画面（#/）
 * ---------------------------------------------------------------------
 * 「開いてまず何をすればいいか」を 1 画面で示すための入口。
 * 中身はすべて既存のデータ・store から組み立てるだけで、
 * この画面のためのデータは持たない（KOBUN.index と KOBUN.store だけを読む）。
 *
 *   1. ヒーロー           … アプリの説明と 3 つの大きな導線
 *   2. 学習の状態         … 330 語の進捗（覚えた／苦手／未学習）と「続きから」
 *   3. おすすめ           … 苦手が溜まっていれば復習を先頭に固定。そのうえで、
 *                          未学習が残る文章・作品・重要度/品詞（無ければ五十音行）から
 *                          日付シードの擬似乱数で毎日 2〜3 件を選んで添える
 *   4. 入口カード         … 重要度・品詞・教科書の文章へのショートカット
 *                          （作品への入口は「教科書」#/textbook に一本化した）
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
   * ---------------------------------------------------------------
   * 苦手が溜まっていれば「苦手 N 語を復習」を先頭に固定で出す。
   * そのうえで、未学習が残っている「文章」「作品」「重要度・品詞」
   * （どれも無ければ最後の手段として五十音行）から、日付をシードにした
   * 決定的な擬似乱数で毎日 2〜3 件を選んで下に添える
   * （苦手を出しているときは 2 件、苦手ゼロなら 2〜3 件）。
   * 同じ日にホームを何度開いても同じおすすめになるが、日が変われば変わる。
   * ------------------------------------------------------------- */

  /** 'YYYYMMDD' を数値にしたものをシードにする（今日は同じ、日が変われば変わる） */
  function todaySeed() {
    var d = new Date();
    var s = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    return s >>> 0;
  }

  /** mulberry32: 依存ライブラリなしの決定的な擬似乱数生成器 */
  function mulberry32(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickOne(list, rng) {
    if (!list || !list.length) return null;
    return list[Math.floor(rng() * list.length)];
  }

  /** Fisher–Yates。渡した配列は書き換えない */
  function shuffled(list, rng) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  /* --- 候補集め（未学習が 1 語でも残っているものだけ） -------------- */

  /** 文章：その文章のデッキ（330 語＋文章固有語）に未学習が残るもの */
  function passageCandidates() {
    return K.index.passages.map(function (p) {
      var deck = K.index.deckOfPassage(p.id);
      var s = K.store.summaryOf(deck.map(function (c) { return c.id; }));
      return { passage: p, total: s.total, unlearned: s.newCount };
    }).filter(function (c) { return c.total > 0 && c.unlearned > 0; });
  }

  /** 作品：その作品の収録語（passages.vocab ∪ 品詞分解の w ∪ workWords、330 語のみ）に未学習が残るもの */
  function workCandidates() {
    return K.index.works.map(function (w) {
      var list = K.index.wordsByWork.get(w.id) || [];
      var s = K.store.summaryOf(list.map(function (word) { return word.id; }));
      return { work: w, total: s.total, unlearned: s.newCount };
    }).filter(function (c) { return c.total > 0 && c.unlearned > 0; });
  }

  /** 重要度・品詞：未学習が残るものだけ（重要度は S/A/B、品詞は一覧の選択肢と同じ） */
  function levelPosCandidates() {
    var out = [];
    K.index.levels.forEach(function (l) {
      var ids = K.index.words.filter(function (w) { return w.level === l.code; }).map(function (w) { return w.id; });
      var s = K.store.summaryOf(ids);
      if (s.newCount > 0) out.push({ kind: 'level', level: l, total: s.total, unlearned: s.newCount });
    });
    K.index.posList.forEach(function (p) {
      var ids = K.index.words.filter(function (w) { return w.pos === p; }).map(function (w) { return w.id; });
      var s = K.store.summaryOf(ids);
      if (s.newCount > 0) out.push({ kind: 'pos', pos: p, total: s.total, unlearned: s.newCount });
    });
    return out;
  }

  /** 五十音行：最後の手段。他の候補が足りないときだけ埋め合わせに使う */
  function rowCandidates() {
    return K.index.kanaRows.map(function (r) {
      var ids = K.index.words.filter(function (w) { return w.kanaRow === r; }).map(function (w) { return w.id; });
      var s = K.store.summaryOf(ids);
      return { row: r, total: s.total, unlearned: s.newCount };
    }).filter(function (c) { return c.unlearned > 0; });
  }

  /* --- 候補 1 件を「説明文＋ボタン 2 個」に組み立てる ---------------- */

  function recoItem(lead, links) {
    return el('div', { class: 'reco-item' }, [
      el('p', {}, lead),
      el('div', { class: 'deck-links' }, links)
    ]);
  }

  function passageRecoItem(c) {
    var work = K.index.getWork(c.passage.workId);
    return recoItem(
      [
        el('b', { text: '「' + c.passage.title + '」' }),
        work ? el('span', { class: 'muted', text: '（' + work.title + '）' }) : '',
        'を読んでみませんか。この文章の単語 ' + c.total + ' 語のうち未学習は ',
        el('b', { text: c.unlearned + ' 語' }), ' です。'
      ],
      [
        el('a', { class: 'btn btn-primary', href: '#/study?passage=' + encodeURIComponent(c.passage.id), text: 'この文章の単語で学習' }),
        el('a', { class: 'btn', href: '#/passage/' + encodeURIComponent(c.passage.id), text: '文章を読む' })
      ]
    );
  }

  function workRecoItem(c) {
    return recoItem(
      [
        el('b', { text: '「' + c.work.title + '」' }),
        'の単語 ' + c.total + ' 語のうち未学習は ',
        el('b', { text: c.unlearned + ' 語' }), ' です。'
      ],
      [
        el('a', { class: 'btn btn-primary', href: '#/study?work=' + encodeURIComponent(c.work.id), text: 'この作品の単語で学習' }),
        el('a', { class: 'btn', href: '#/work/' + encodeURIComponent(c.work.id), text: '作品ページ' })
      ]
    );
  }

  function levelPosRecoItem(c) {
    if (c.kind === 'level') {
      var l = c.level;
      return recoItem(
        [
          el('b', { text: l.code + ' ' + l.label }),
          'の未学習 ', el('b', { text: c.unlearned + ' 語' }),
          ' はいかがですか（' + l.desc + '）。'
        ],
        [
          el('a', { class: 'btn btn-primary', href: '#/study?level=' + l.code + '&status=new', text: l.code + 'ランクの未学習 ' + c.unlearned + ' 語で学習' }),
          el('a', { class: 'btn', href: '#/words?level=' + l.code + '&status=new', text: '一覧で見る' })
        ]
      );
    }
    return recoItem(
      [
        el('b', { text: c.pos } ),
        'の未学習 ', el('b', { text: c.unlearned + ' 語' }),
        '（全 ' + c.total + ' 語）はいかがですか。'
      ],
      [
        el('a', { class: 'btn btn-primary', href: '#/study?pos=' + encodeURIComponent(c.pos) + '&status=new', text: c.pos + 'の未学習 ' + c.unlearned + ' 語で学習' }),
        el('a', { class: 'btn', href: '#/words?pos=' + encodeURIComponent(c.pos) + '&status=new', text: '一覧で見る' })
      ]
    );
  }

  function rowRecoItem(c) {
    return recoItem(
      [
        el('b', { text: c.row + '行' }),
        'の未学習 ', el('b', { text: c.unlearned + ' 語' }),
        ' はいかがですか。'
      ],
      [
        el('a', { class: 'btn btn-primary', href: '#/study?row=' + encodeURIComponent(c.row) + '&status=new', text: c.row + 'の未学習 ' + c.unlearned + ' 語で学習' }),
        el('a', { class: 'btn', href: '#/study?status=new', text: '未学習からランダムに' })
      ]
    );
  }

  /**
   * 候補の種類（文章／作品／重要度・品詞）から、日替わりの擬似乱数で
   * 種類ごとに 1 件ずつ選び、種類の順番もシャッフルして need 件返す。
   * 種類が足りないときだけ五十音行で埋める。候補が 1 つも無ければ空配列。
   */
  function pickRecoItems(need) {
    var rng = mulberry32(todaySeed());
    var buckets = [];

    var pc = passageCandidates();
    if (pc.length) buckets.push(passageRecoItem(pickOne(pc, rng)));
    var wc = workCandidates();
    if (wc.length) buckets.push(workRecoItem(pickOne(wc, rng)));
    var lc = levelPosCandidates();
    if (lc.length) buckets.push(levelPosRecoItem(pickOne(lc, rng)));

    buckets = shuffled(buckets, rng);
    var items = buckets.slice(0, need);

    if (items.length < need) {
      var rc = rowCandidates();
      if (rc.length) items.push(rowRecoItem(pickOne(rc, rng)));
    }
    return items;
  }

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
      pickRecoItems(2).forEach(function (item) { card.appendChild(item); });
      return card;
    }

    var items = pickRecoItems(3);
    if (!items.length) {
      card.appendChild(el('p', { text: '330 語すべてに学習の記録が付きました。クイズで力だめしをしてみてください。' }));
      card.appendChild(el('div', { class: 'deck-links' }, [
        el('a', { class: 'btn btn-primary', href: '#/quiz', text: '330 語からクイズ' }),
        el('a', { class: 'btn', href: '#/textbook', text: '文章を読む' })
      ]));
      return card;
    }

    card.appendChild(el('p', { class: 'muted small' }, [
      '未学習が ', el('b', { text: sum.newCount + ' 語' }), ' 残っています。きょうのおすすめはこちら。'
    ]));
    items.forEach(function (item) { card.appendChild(item); });
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

  /* 「作品から選ぶ」の入口カードは廃止した。作品の入口は「教科書」
     （#/textbook）の見出し行に統合してあり、二重にすると迷うため。 */

  function passageCard() {
    var card = el('div', { class: 'card' }, [
      el('h2', { class: 'card-title' }, [
        '教科書の文章から選ぶ',
        el('span', { class: 'muted small', text: '（' + K.index.passages.length + ' 編）' })
      ]),
      el('p', { class: 'muted small', text: '原文と現代語訳を並べて読み、その文章に出てくる語だけで学習できます。' })
    ]);

    // 学年でしぼった入口（教科書の ?grade= にそのまま渡す）
    var grades = el('div', { class: 'tile-list' });
    K.index.grades.forEach(function (g) {
      var n = K.index.passages.filter(function (p) { return (p.grade || []).indexOf(g) >= 0; }).length;
      grades.appendChild(el('a', { class: 'tile', href: '#/textbook?grade=' + encodeURIComponent(g) }, [
        el('span', { class: 'tile-title', text: g }),
        el('span', { class: 'tile-sub muted', text: n + ' 編' })
      ]));
    });
    card.appendChild(grades);

    // 直近の 4 編だけ名前で見せる（全部は教科書へ）
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
      el('a', { href: '#/textbook', text: '教科書の文章をすべて見る →' })
    ]));
    return card;
  }

  /* ---------------------------------------------------------------
   * 描画
   * ------------------------------------------------------------- */
  function render(params, query, container) {
    var section = el('section', { class: 'view view-home' });

    var hero = el('div', { class: 'home-hero' }, [
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
        el('a', { class: 'btn btn-lg', href: '#/textbook', text: '教科書の文章を読む' }),
        el('a', { class: 'btn btn-lg', href: '#/quiz', text: 'クイズ' })
      ]),
      el('p', { class: 'home-hero-sub muted' }, [
        el('a', { href: '#/words', text: '単語一覧から探す' }),
        '　/　',
        el('a', { href: '#/help', text: '使い方を読む' })
      ])
    ]);
    // 「ホーム画面に追加」（インストールできる環境でだけ出る。それ以外は非表示）
    hero.appendChild(C.installBlock());
    section.appendChild(hero);

    section.appendChild(statusCard());
    section.appendChild(recommendCard());
    section.appendChild(levelCard());
    section.appendChild(posCard());
    section.appendChild(passageCard());

    section.appendChild(el('div', { class: 'card home-share' }, [
      el('h2', { class: 'card-title', text: 'このアプリを共有' }),
      el('p', { class: 'muted small', text: '同じ範囲を勉強している人に、この URL をそのまま渡せます。' }),
      C.appShareButtons({ label: '共有' })
    ]));

    section.appendChild(el('div', { class: 'home-foot' }, [
      el('a', { href: '#/help', text: '使い方' }),
      el('a', { href: '#/help?to=data', text: 'データについて' }),
      el('a', { href: '#/help?to=history', text: '学習履歴について' }),
      el('a', { href: '#/terms', text: '利用規約・プライバシーポリシー' })
    ]));

    // 末尾に制作者（フッター相当の小さな行）
    var author = C.authorLine();
    if (author) {
      author.classList.add('home-author');
      section.appendChild(author);
    }

    container.appendChild(section);
  }

  K.views = K.views || {};
  K.views.home = { render: render };
})();
