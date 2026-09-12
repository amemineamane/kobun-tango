/* =====================================================================
 * js/view-help.js — 使い方（#/help）
 * ---------------------------------------------------------------------
 * 画面の操作・検索のコツ・学習履歴の扱い・データの出どころを 1 枚にまとめる。
 * 文章はすべてこのファイルの中にある（説明用のデータファイルは作らない）が、
 * 語数・作品数などの数字は KOBUN.index から動的に出す。
 * データを足しても説明の数字がずれない。
 *
 * #/help?to=history のように ?to= を付けると、その節までスクロールする
 * （ハッシュルーティングなので #anchor が使えないため、自前で scrollIntoView する）。
 * 節の id は 'help-<to>'。ホームのフッターからのリンクがこれを使う。
 *
 * 学習履歴のリセットは confirm() を使わず、この画面の中の 2 段階ボタンで行う
 * （ブラウザのダイアログは file:// / スマホで見え方が安定しないため）。
 * ===================================================================== */
(function () {
  'use strict';

  var K = window.KOBUN;
  var U = K.util;
  var C = K.components;
  var el = U.el;

  /** 節の見出しつきカード。id は ?to= の飛び先になる */
  function sec(id, title, children) {
    return el('div', { class: 'card help-section', id: 'help-' + id }, [
      el('h2', { class: 'card-title', text: title })
    ].concat(children.filter(Boolean)));
  }

  function kbd(t) { return el('kbd', { class: 'key', text: t }); }

  /** 「〜には」を並べる小さな定義リスト */
  function dl(pairs) {
    var d = el('dl', { class: 'help-dl' });
    pairs.forEach(function (p) {
      d.appendChild(el('dt', { text: p[0] }));
      d.appendChild(el('dd', {}, [].concat(p[1])));
    });
    return d;
  }

  /* ---------------------------------------------------------------
   * アクセス解析の表記
   * -------------------------------------------------------------
   * data/site.js の analytics に設定があるときだけ 1 段落出す。
   * 設定が空（計測していない）ときに「送ることがあります」と書くのは
   * 嘘になるので、KOBUN.site.analytics を見て出し分ける。
   * ------------------------------------------------------------- */
  function analyticsServices() {
    var a = (K.site && K.site.analytics) || {};
    var names = [];
    if (String(a.ga4 || '').trim()) names.push('Google アナリティクス');
    if (String(a.cloudflare || '').trim()) names.push('Cloudflare Web Analytics');
    return names;
  }

  function analyticsNote() {
    var names = analyticsServices();
    if (!names.length) return null;
    /* 長い説明は #/terms?to=privacy に置き、ここは 2〜3 行に留める
       （何を送って何を送らないかの詳細は 1 か所に集める）。 */
    return el('p', { class: 'muted small' }, [
      'アクセス解析のため、閲覧した画面や、クイズ・文法ドリルの完走などの利用状況を匿名で ',
      names.join('／'),
      ' に送っています。',
      el('b', { text: '検索語と学習履歴の中身（どの語を覚えたか）は送りません。' }),
      ' 詳しくは ',
      el('a', { href: '#/terms?to=privacy', text: 'プライバシーポリシー' }),
      ' をご覧ください。'
    ]);
  }

  /* ---------------------------------------------------------------
   * 学習履歴のリセット（2 段階ボタン）
   * ------------------------------------------------------------- */
  function resetBlock() {
    var wrap = el('div', { class: 'danger-zone' });
    var stage = 'idle'; // idle → confirm → done

    function draw() {
      U.clear(wrap);
      if (stage === 'idle') {
        var sum = K.store.summary(K.index.words.length);
        wrap.appendChild(el('p', { class: 'muted small', text: 'いま記録があるのは 覚えた ' + sum.known + ' 語・苦手 ' + sum.weak + ' 語です。' }));
        wrap.appendChild(el('button', {
          type: 'button', class: 'btn btn-ghost',
          text: '学習履歴をリセットする',
          onClick: function () { stage = 'confirm'; draw(); }
        }));
      } else if (stage === 'confirm') {
        wrap.appendChild(el('p', { class: 'danger-text' }, [
          el('b', { text: '本当に消しますか？' }),
          ' 覚えた・苦手の記録、クイズと文法ドリルの履歴、「続きから」がすべて消えます。元には戻せません。'
        ]));
        wrap.appendChild(el('div', { class: 'deck-links' }, [
          el('button', {
            type: 'button', class: 'btn btn-danger', text: 'はい、すべて消す',
            onClick: function () {
              K.store.resetAll();
              if (K.analytics) K.analytics.event('history_reset', {});
              stage = 'done'; draw();
            }
          }),
          el('button', {
            type: 'button', class: 'btn', text: 'やめる',
            onClick: function () { stage = 'idle'; draw(); }
          })
        ]));
      } else {
        wrap.appendChild(el('p', { class: 'help-done' }, [
          el('b', { text: '学習履歴を消しました。' }), ' すべての語が「未学習」に戻っています。'
        ]));
        wrap.appendChild(el('div', { class: 'deck-links' }, [
          el('a', { class: 'btn', href: '#/', text: 'ホームへ' }),
          el('button', {
            type: 'button', class: 'btn btn-ghost', text: '表示を戻す',
            onClick: function () { stage = 'idle'; draw(); }
          })
        ]));
      }
    }
    draw();
    return wrap;
  }

  /* ---------------------------------------------------------------
   * 描画
   * ------------------------------------------------------------- */
  function render(params, query, container) {
    var idx = K.index;
    var paraCount = idx.passages.reduce(function (n, p) { return n + p.paragraphs.length; }, 0);
    var vocabCount = idx.passages.reduce(function (n, p) { return n + (p.vocab || []).length; }, 0);
    var extraCount = idx.passages.reduce(function (n, p) {
      return n + idx.entriesOfPassage(p.id).filter(function (e) { return e.passageWord; }).length;
    }, 0);
    // 入試（共通テスト・センター試験）の出典から採った文章の数
    var examPassageCount = idx.passages.filter(idx.isExamPassage).length;

    var section = el('section', { class: 'view view-help' });

    section.appendChild(el('div', { class: 'crumbs' }, [
      el('a', { href: '#/', text: '← ホーム' })
    ]));
    section.appendChild(el('h1', { class: 'view-title', text: '使い方' }));
    section.appendChild(el('p', { class: 'view-lead', text: 'この 1 枚で、画面の役割・検索のコツ・学習履歴の扱いがわかります。上から順に読む必要はありません。' }));

    /* --- 目次 ------------------------------------------------------ */
    var toc = el('nav', { class: 'help-toc', 'aria-label': '使い方の目次' });
    [
      ['about', 'このアプリでできること'],
      ['level', '重要度 S・A・B の意味'],
      ['search', '検索のコツ'],
      ['plan', '学習の進め方'],
      ['cards', 'フラッシュカードとクイズの操作'],
      ['passage', '文章ページの見方'],
      ['grammar', '文法の調べ方とドリル'],
      ['history', '学習履歴について'],
      ['data', 'データについて'],
      ['env', '動作環境'],
      ['app', 'アプリとして使う'],
      ['share', 'このアプリを共有'],
      ['author', '制作']
    ].forEach(function (t) {
      toc.appendChild(el('a', { href: '#/help?to=' + t[0], text: t[1] }));
    });
    section.appendChild(toc);

    /* --- 1. できること --------------------------------------------- */
    section.appendChild(sec('about', 'このアプリでできること', [
      el('p', { text: '上のメニュー（スマホでは画面下のタブ）で 5 つの画面を行き来します。' }),
      dl([
        ['単語', ['入試向けの ' + idx.words.length + ' 語を検索・絞り込みで引きます。行をタップすると詳細が開きます。']],
        ['単語詳細', ['語義、関連語（類義・対義・派生・同音注意など）、登場作品、そして「この語が出てくる文章」（教科書教材の原文を段落ごとに、その語を強調して掲載。語をタップすれば品詞分解が出ます）。']],
        ['教科書', ['文章 ' + idx.passages.length + ' 編を、' + idx.works.length + ' 作品ごとにまとめた入口。文章名をタップすると原文と現代語訳で読め、その文章に出てくる語だけで学習・クイズができます。作品名をタップすると、その作品の書誌・文章・収録語をまとめた作品ページに進みます。一覧は「教科書の定番教材」と「共通テスト・センター試験の出典作品」の 2 つに分かれています。']],
        ['入試の出典', [
          '共通テストの古文は、教科書に載っていない作品から出題されます。そこで 2016 年度以降の出典 ' + idx.examWorks.length + ' 作品を、出題年の新しい順に並べました（教科書ページの後半、または ',
          el('a', { href: '#/textbook?grade=' + encodeURIComponent(idx.EXAM_GRADE), text: '入試の出典作品' }),
          '）。本文のある ' + examPassageCount + ' 編は、初見の文章を単語と文法だけで読む練習に使えます。原文と書き下ろしの現代語訳・品詞分解だけを収めており、試験の設問・注・リード文は載せていません。本文が未収録の作品も、作者・時代・ジャンルと出題された場面を作品ページで確認できます。'
        ]],
        ['文法', [
          '助動詞・助詞・敬語・活用・識別を引く画面。各項目に接続・活用表・意味ごとの見分け方と、',
          el('b', { text: '教材の原文から取った用例' }),
          'が並びます。文法ドリル（4 択）もここから始められます。'
        ]],
        ['学習', ['フラッシュカード。表が見出し語、めくると語義と用例（その語が出てくる教材の段落）。「覚えた／まだ」を記録します。']],
        ['クイズ', ['4 択。誤答は同じ品詞の別語から選ばれるので、意味の近い選択肢が並びます。']]
      ]),
      el('p', { class: 'muted small', text: '絞り込んだ条件は URL に入ります（#/words?level=S&pos=敬語）。ブックマークもできますし、そのまま学習・クイズに引き継げます。' })
    ]));

    /* --- 2. 重要度 -------------------------------------------------- */
    section.appendChild(sec('level', '重要度 S・A・B の意味', [
      el('p', { text: '単語には入試での問われやすさで 3 段階の重要度が付いています。一覧の行頭の色帯と、バッジの色がこれに対応します。' }),
      C.levelLegend({ links: true }),
      el('p', { class: 'muted small', text: '教科書の脚注に出るような、330 語に無い語には「P 文章の語」が付きます。この語は単語詳細を持たず、出てきた文章のページで意味を確認します。' }),
      el('p', { text: 'まず S を固め、次に A、余裕があれば B、という順番が効率的です。' })
    ]));

    /* --- 3. 検索 ---------------------------------------------------- */
    section.appendChild(sec('search', '検索のコツ', [
      el('p', { text: '単語一覧の検索欄は、次のどれでも引けます。' }),
      dl([
        ['かな', ['「つれづれ」でも「つれつれ」でも当たります（濁点は無視して照合します）。歴史的仮名遣いも現代読みも通るので、', el('b', { text: 'をかし' }), ' は ', el('b', { text: 'おかし' }), ' でも見つかります。']],
        ['ローマ字', ['仮名の字面をそのまま写した形です。たまふ は ', el('b', { text: 'tamafu' }), '（tamou ではありません）。wokashi / hu のような打ち方も吸収します。']],
        ['漢字', ['「浅」「口惜」のように、漢字表記の一部でも当たります。']],
        ['意味', ['「早朝」「気の毒」のように語義の言葉でも引けます。意味からの逆引きに使えます。']]
      ]),
      el('p', { class: 'muted small', text: '前方一致が優先で表示されます。1 語も出ないときは、絞り込み（重要度・品詞・文章）が効いたままになっていないか確認してください。' })
    ]));

    /* --- 4. 進め方 -------------------------------------------------- */
    section.appendChild(sec('plan', '学習の進め方', [
      el('p', { text: '決まった正解はありませんが、迷ったら次の順序をおすすめします。' }),
      el('ol', { class: 'help-steps' }, [
        el('li', {}, ['まず ', el('a', { href: '#/study?level=S', text: 'S 最重要の ' + (idx.getLevel('S') || {}).count + ' 語' }), ' をフラッシュカードで一周する。分からなくても止まらず「まだ」で流す。']),
        el('li', {}, ['一周したら「まだの語だけで復習」。2〜3 周で手ごたえが変わります。']),
        el('li', {}, ['同じ条件のまま ', el('a', { href: '#/quiz?level=S', text: 'クイズ' }), ' で力だめし。間違えた語は自動で「苦手」になります。']),
        el('li', {}, [el('a', { href: '#/study?status=weak', text: '苦手だけの復習' }), ' を、日をあけて何度か。']),
        el('li', {}, ['慣れてきたら ', el('a', { href: '#/textbook', text: '教科書の文章' }), ' を 1 編選び、その文章の語だけで学習する。文脈と一緒に覚えるほうが定着します。']),
        el('li', {}, ['A → B と広げる。品詞別（敬語だけ、副詞だけ）でまとめて覚えるのも有効です。'])
      ])
    ]));

    /* --- 5. カードとクイズ ------------------------------------------ */
    section.appendChild(sec('cards', 'フラッシュカードとクイズの操作', [
      el('h3', { class: 'help-h3', text: 'フラッシュカード（学習）' }),
      el('p', {}, ['カードをタップするか ', kbd('Space'), '（または ', kbd('Enter'), '）でめくります。', el('b', { text: 'めくって語義を確認してから' }), '、', kbd('→'), ' で「覚えた」、', kbd('←'), ' で「まだ」。押した時点で記録されます。']),
      el('p', {}, [
        '裏面では ', el('b', { text: 'スワイプでも選べます' }),
        '（右へ払うと「覚えた」、左へ払うと「まだ」。指でもマウスのドラッグでも同じです）。途中で手を止めて戻せば、記録は付きません。'
      ]),
      el('p', { class: 'muted small', text: 'めくる前は「覚えた／まだ」を選べません（ボタンは薄く、← → とスワイプも効きません）。答えを見ずに記録が付くと、進捗が実態とずれてしまうためです。' }),
      el('p', { class: 'muted small', text: 'デッキは既定でシャッフルされます（フィルタの下のチェックで止められます）。一周すると「もう一周」「まだの語だけで復習」「クイズに進む」が出ます。' }),
      el('h3', { class: 'help-h3', text: 'クイズ（4 択）' }),
      el('p', {}, [kbd('1'), ' 〜 ', kbd('4'), ' の数字キーで回答できます。出題形式は「語 → 意味」と「意味 → 語」の 2 つ、問題数は 5 / 10 / 20 / 30 から選べます。']),
      el('p', { text: '誤答の選択肢は同じ品詞の別語から選ばれます（形容詞の問題なら選択肢も形容詞の語義）。文章を指定したときは、同じ文章の他の語から選ばれます。' }),
      el('p', { text: '正解した語は「覚えた」、間違えた語は「苦手」として自動的に記録されます。終了後に「間違えた語だけ出題」で復習できます。' }),
      el('p', { class: 'muted small', text: '正誤は色だけでなく ○ と × でも示しています。' })
    ]));

    /* --- 6. 文章ページ ---------------------------------------------- */
    section.appendChild(sec('passage', '文章ページの見方', [
      el('p', { text: '原文と現代語訳が段落ごとに対応しています。ボタンで「訳を隠す」「横に並べる」を切り替えられます（この設定はブラウザに記憶されます）。' }),
      el('p', {}, [
        el('b', { text: '原文の語をタップすると品詞分解が出ます。' }),
        '　品詞・活用の種類・活用形・その文脈での意味、重要語ならその詳細ページへのリンクが出ます。下線の付いていない語も同じようにタップできます。'
      ]),
      el('ul', { class: 'help-list' }, [
        el('li', {}, [el('span', { class: 'legend-sample is-word', text: '実線' }), ' … 重要 330 語。タップで語義が出て、そのまま単語詳細へ飛べます。']),
        el('li', {}, [el('span', { class: 'legend-sample is-extra', text: '点線' }), ' … その文章だけの語（教科書の脚注に出るような語）。タップでその場に語義が出ます。']),
        el('li', {}, [el('span', { class: 'needs-check', text: '橙色＋破線' }), ' … 解釈が分かれる・確認しきれていない箇所です。「要確認」「底本異同」の注記が付きます。'])
      ]),
      el('p', { text: '段落ごとの「品詞分解を表で見る」を開くと、その段落の全語を一覧表（語／辞書形／品詞・活用／意味／重要語）で読めます。まだ品詞分解を付けていない教材では、下線の付いた語だけがタップできます。' }),
      el('p', { text: 'ページの下には「この文章の単語」の一覧と、その文章の語だけで学習・クイズに進むボタンがあります。' })
    ]));

    /* --- 6-b. 文法 --------------------------------------------------- */
    if (idx.grammar) {
      var gcats = idx.grammarCategories;
      section.appendChild(sec('grammar', '文法の調べ方とドリル', [
        el('p', {}, [
          '「文法」タブ（',
          el('a', { href: '#/grammar', text: '#/grammar' }),
          '）で、古典文法を ' + gcats.length + ' 分野・' +
          gcats.reduce(function (n, c) { return n + c.count; }, 0) + ' 項目にまとめてあります。'
        ]),
        dl([
          ['助動詞', ['接続（未然形・連用形・終止形…）でグループ化して並べています。各ページに接続・活用の型・活用表・意味ごとの見分け方があります。']],
          ['助詞', ['格助詞・接続助詞・係助詞・副助詞・終助詞に分けてあります。係り結びの表は助詞のページの下にあります。']],
          ['敬語', ['尊敬・謙譲・丁寧の表。330 語にある語は単語詳細へリンクしています。二重敬語・絶対敬語・敬意の方向の説明も同じページです。']],
          ['活用', ['動詞 9 種・形容詞 2 種・形容動詞 2 種の活用表と、「ず」を付けて見分ける手順。']],
          ['識別', ['「ぬ／ね」「なり」「に」「る／れ」など、同じ字面を見分ける手順。ケースごとに用例が付きます。']]
        ]),
        el('p', {}, [
          el('b', { text: '用例は教材の品詞分解から自動で集めています。' }),
          '　手で書いた例文ではなく、収録している教科書教材 ' + idx.passages.length +
          ' 編の原文から、その文法項目に当たる語を含む文を拾っています。' +
          '用例をタップすると、その文章のページへ移って前後の文と現代語訳を読めます。'
        ]),
        el('p', {}, [
          '文章ページで原文の語をタップしたとき、その語が助動詞・助詞・敬語なら、',
          'ポップアップに「文法：…の解説へ」のリンクが出ます。原文を読みながら文法を確かめられます。'
        ]),
        el('h3', { class: 'help-h3', text: '文法ドリル（4 択）' }),
        el('p', {}, [
          el('a', { href: '#/grammar/drill', text: '文法ドリル' }),
          ' は、品詞分解データから 4 択問題を自動で作ります。1 セット 10 問、',
          kbd('1'), ' 〜 ', kbd('4'), ' の数字キーでも答えられます。'
        ]),
        el('ul', { class: 'help-list' }, [
          el('li', { text: '意味当て … 原文の「なり」「に」などが、どの意味で使われているかを答えます。' }),
          el('li', { text: '活用形当て … その形が未然形〜命令形のどれかを答えます。' }),
          el('li', { text: '識別 … 「ぬ」が完了か打消か、のように同じ字面を見分けます。' }),
          el('li', { text: '敬語の種類 … 尊敬・謙譲・丁寧のどれかを答えます。' })
        ]),
        el('p', { class: 'muted small', text: '誤答の選択肢は、同じ語の他の意味・他の活用形から選ばれます。出題の種類や分野（助動詞だけ・識別だけ）を絞ることもでき、各項目のページの「この語だけでドリル」からは 1 語だけで出題できます。' }),
        el('p', { class: 'muted small', text: '結果と正答率はこのブラウザに保存され（単語の学習履歴とは別枠）、文法のトップに「最近の正答率」として出ます。履歴のリセットで一緒に消えます。' }),
        el('p', { class: 'muted small', text: '文法の解説は高校古典文法（学校文法）の標準的な整理に拠っています。注釈書によって扱いが分かれるところ（連体形＋「に」など）は、各ページに注記があります。' })
      ]));
    }

    /* --- 7. 学習履歴 ------------------------------------------------ */
    section.appendChild(sec('history', '学習履歴について', [
      el('p', {}, [
        '「覚えた／苦手」やクイズ・文法ドリルの結果は、',
        el('b', { text: 'いま使っているブラウザの中だけ' }),
        ' に保存されます（localStorage）。'
      ]),
      el('ul', { class: 'help-list' }, [
        el('li', { text: '端末やブラウザを変えると引き継がれません（同期はしません）。' }),
        el('li', { text: 'ブラウザの「サイトデータの削除」や、プライベートウィンドウを閉じたときに消えます。' }),
        el('li', {
          text: analyticsServices().length
            ? '学習履歴の中身（どの語を覚えたか）はサーバーに送信しません。アカウント登録もありません。'
            : 'サーバーには一切送信しません。アカウント登録もありません。'
        }),
        el('li', { text: 'localStorage が使えない設定のときは、画面上部に注意が出て、そのタブを閉じるまでの一時保存に切り替わります。' })
      ]),
      el('p', { class: 'muted small', text: '保存キーは単語の id です。同じ仮名の別語（ながむ〔眺む〕/〔詠む〕）が混ざらないようにするためで、単語データを更新しても履歴は残ります。' }),
      analyticsNote(),
      el('h3', { class: 'help-h3', text: '履歴をリセットする' }),
      resetBlock(),
      el('p', { class: 'muted small' }, [
        '学習履歴や利用状況の扱いは ',
        el('a', { href: '#/terms?to=privacy', text: 'プライバシーポリシー' }),
        ' にまとめています。'
      ])
    ]));

    /* --- 8. データ -------------------------------------------------- */
    section.appendChild(sec('data', 'データについて', [
      el('p', { class: 'help-stats' }, [
        el('span', { class: 'badge count', text: '単語 ' + idx.words.length + ' 語' }),
        el('span', { class: 'badge count', text: '作品 ' + idx.works.length + ' 件' }),
        el('span', { class: 'badge count', text: '文章 ' + idx.passages.length + ' 編' }),
        el('span', { class: 'badge count', text: '段落 ' + paraCount }),
        el('span', { class: 'badge count', text: '文章の語 ' + vocabCount + ' 件' }),
        el('span', { class: 'badge count', text: '品詞分解 ' + idx.tokensByPassage.size + ' 編' })
      ]),
      dl([
        ['品詞分解', ['原文を語に割り、品詞・活用の種類・活用形・その文脈での意味を付けたものです。文章ページで原文の語をタップすると出ます。いま ' + idx.tokensByPassage.size + ' / ' + idx.passages.length + ' 編に付いています。']],
        ['原文', ['教科書で最も一般的な本文（伊勢物語＝定家本系、枕草子＝三巻本、方丈記＝大福光寺本、平家物語＝覚一本系、源氏物語＝大島本、徒然草＝流布本）に揃えました。', el('b', { text: '底本によって異同がある箇所' }), ' は、教科書本文を採ったうえで注記として残しています。長い教材は有名な部分を抜き、省いた箇所は本文中に（中略）と書いてあります。']],
        ['現代語訳', ['このアプリのために書き下ろしたものです。教科書や市販の訳文は転載していません。']],
        ['入試の出典', ['共通テスト・センター試験の出典 ' + idx.examWorks.length + ' 作品は、複数の一覧で一致した年度・作品だけを載せています。本文は著作権保護期間の満了した原文を、web 上で確認できる翻刻（Wikisource・やたナビTEXT）から起こしました。翻刻を確認できなかった作品は、作品情報だけを載せています。']],
        ['単語 ' + idx.words.length + ' 語', ['入試向けの古文単語 330 語。語義は入試で問われる順に並んでいます。']],
        ['文章の語', [vocabCount + ' 件のうち ' + extraCount + ' 件は 330 語に無い語で、その文章の中だけで覚える語として扱います。']],
        ['要確認の表示', ['解釈が分かれる品詞分解・語義には注記を付け、画面上では橙色と破線で目立たせています。']]
      ])
    ]));

    /* --- 9. 動作環境 ------------------------------------------------ */
    section.appendChild(sec('env', '動作環境', [
      el('p', { text: 'スマートフォン・PC の最近のブラウザ（Chrome / Edge / Firefox / Safari）で動きます。画面幅に合わせてレイアウトが変わり、OS のダークモードにも自動で合わせます。' }),
      el('p', { text: '外部のライブラリやフォントを読み込んでいないので、一度開いたページはオフラインでもそのまま動きます。ファイルを直接（file:// で）開いても機能に制限はありません。' }),
      el('p', { class: 'muted small', text: '文字が小さいと感じるときは、ブラウザの拡大（Ctrl と ＋ / スマホはピンチ）で大きくできます。動きを減らす設定（prefers-reduced-motion）にしている場合、カードのアニメーションは止まります。' })
    ]));

    /* --- 10. アプリとして使う ---------------------------------------- */
    section.appendChild(sec('app', 'アプリとして使う', [
      el('p', { text: 'ホーム画面に追加すると、ブラウザのアドレスバーが無い全画面でひらけます。アプリストアからのインストールではないので、容量もほとんど使いません。' }),
      C.installBlock({ note: 'この端末では、このボタンから追加できます。' }),
      dl([
        ['Android（Chrome）', ['上のボタン、または画面右上の ⋮ メニューから「アプリをインストール」／「ホーム画面に追加」を選びます。']],
        ['iPhone・iPad（Safari）', ['画面下の共有ボタン（□に↑）を押し、メニューを下にたどって「ホーム画面に追加」を選びます。']],
        ['PC（Chrome / Edge）', ['アドレスバーの右端に出るインストールのアイコンから追加できます。']]
      ]),
      el('ul', { class: 'help-list' }, [
        el('li', { text: '一度ひらいたページは、電波が無いところでも読めます（原文・訳・単語のデータは端末に取ってあります）。' }),
        el('li', { text: 'データを更新したときは、次にひらいたときに自動で新しいものを取りに行きます。読んでいる最中に入れ替わらないよう、更新があるときは画面の下に「新しいバージョンがあります」と出ます。' }),
        el('li', { text: '学習履歴は追加する前と同じで、その端末のブラウザの中に残ります（アプリとして開いても同じ記録が続きます）。' })
      ]),
      el('p', { class: 'muted small', text: 'ファイルを直接（file:// で）開いているときは、この追加はできません。アプリとして使いたいときは公開ページから開いてください。' })
    ]));

    /* --- 11. 共有 --------------------------------------------------- */
    section.appendChild(sec('share', 'このアプリを共有', [
      el('p', { text: '学校や塾の友だちに渡すときは、この URL をそのまま送ってください。登録もインストールも要りません。' }),
      C.appShareButtons({ label: '共有' }),
      el('p', { class: 'muted small', text: '単語ページ・文章ページ・作品ページ、クイズの結果画面にも共有ボタンがあります。絞り込んだ条件は URL に入るので、「S だけのクイズ」のように条件ごと渡せます。' })
    ]));

    /* --- 12. 制作 --------------------------------------------------- */
    section.appendChild(sec('author', '制作', [
      C.authorBlock(),
      el('p', { class: 'muted small' }, [
        'このアプリの利用条件と、個人情報・アクセス解析の扱いは ',
        el('a', { href: '#/terms', text: '利用規約・プライバシーポリシー' }),
        ' をご覧ください。'
      ])
    ]));

    section.appendChild(el('div', { class: 'home-foot' }, [
      el('a', { href: '#/', text: 'ホームへ戻る' }),
      el('a', { href: '#/words', text: '単語一覧へ' }),
      el('a', { href: '#/textbook', text: '教科書へ' }),
      el('a', { href: '#/terms', text: '利用規約・プライバシーポリシー' })
    ]));

    container.appendChild(section);

    // ?to=history などで来たら、その節まで送る（ハッシュは経路に使っているので自前で）
    if (query && query.to) {
      var target = section.querySelector('#help-' + query.to.replace(/[^a-z]/g, ''));
      if (target) {
        setTimeout(function () {
          target.scrollIntoView({ block: 'start' });
          target.classList.add('is-target');
        }, 0);
      }
    }
  }

  K.views = K.views || {};
  K.views.help = { render: render };
})();
