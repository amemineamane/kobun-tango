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
          ' 覚えた・苦手の記録、クイズの履歴、「続きから」がすべて消えます。元には戻せません。'
        ]));
        wrap.appendChild(el('div', { class: 'deck-links' }, [
          el('button', {
            type: 'button', class: 'btn btn-danger', text: 'はい、すべて消す',
            onClick: function () { K.store.resetAll(); stage = 'done'; draw(); }
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
      ['history', '学習履歴について'],
      ['data', 'データについて'],
      ['env', '動作環境']
    ].forEach(function (t) {
      toc.appendChild(el('a', { href: '#/help?to=' + t[0], text: t[1] }));
    });
    section.appendChild(toc);

    /* --- 1. できること --------------------------------------------- */
    section.appendChild(sec('about', 'このアプリでできること', [
      el('p', { text: '上のメニュー（スマホでは画面下のタブ）で 5 つの画面を行き来します。' }),
      dl([
        ['単語', ['入試向けの ' + idx.words.length + ' 語を検索・絞り込みで引きます。行をタップすると詳細が開きます。']],
        ['単語詳細', ['語義、関連語（類義・対義・派生・同音注意など）、その語を含む例文の品詞分解、登場作品、その語が出てくる教科書教材へのリンク。']],
        ['作品', [idx.works.length + ' 作品の書誌と紹介。その作品の文章・例文・収録語がまとまっています。']],
        ['文章', ['教科書の定番教材 ' + idx.passages.length + ' 編を、原文と現代語訳で読めます。文章ごとに「その文章に出てくる語だけ」で学習・クイズができます。']],
        ['学習', ['フラッシュカード。表が見出し語、めくると語義と例文。「覚えた／まだ」を記録します。']],
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
        el('li', {}, ['慣れてきたら ', el('a', { href: '#/passages', text: '教科書の文章' }), ' を 1 編選び、その文章の語だけで学習する。文脈と一緒に覚えるほうが定着します。']),
        el('li', {}, ['A → B と広げる。品詞別（敬語だけ、副詞だけ）でまとめて覚えるのも有効です。'])
      ])
    ]));

    /* --- 5. カードとクイズ ------------------------------------------ */
    section.appendChild(sec('cards', 'フラッシュカードとクイズの操作', [
      el('h3', { class: 'help-h3', text: 'フラッシュカード（学習）' }),
      el('p', {}, ['カードをタップするか ', kbd('Space'), '（または ', kbd('Enter'), '）でめくります。答えが出たら ', kbd('→'), ' で「覚えた」、', kbd('←'), ' で「まだ」。押した時点で記録されます。']),
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
      el('p', {}, ['原文の中で下線の付いた語はタップできます。']),
      el('ul', { class: 'help-list' }, [
        el('li', {}, [el('span', { class: 'legend-sample is-word', text: '実線' }), ' … 重要 330 語。タップで語義が出て、そのまま単語詳細へ飛べます。']),
        el('li', {}, [el('span', { class: 'legend-sample is-extra', text: '点線' }), ' … その文章だけの語（教科書の脚注に出るような語）。タップでその場に語義が出ます。']),
        el('li', {}, [el('span', { class: 'needs-check', text: '橙色＋破線' }), ' … 解釈が分かれる・確認しきれていない箇所です。「要確認」「底本異同」の注記が付きます。'])
      ]),
      el('p', { text: 'ページの下には「この文章の単語」の一覧と、その文章の語だけで学習・クイズに進むボタンがあります。品詞分解つきの例文がある教材では、同じページで品詞分解の表も見られます。' })
    ]));

    /* --- 7. 学習履歴 ------------------------------------------------ */
    section.appendChild(sec('history', '学習履歴について', [
      el('p', {}, [
        '「覚えた／苦手」やクイズの結果は、',
        el('b', { text: 'いま使っているブラウザの中だけ' }),
        ' に保存されます（localStorage）。'
      ]),
      el('ul', { class: 'help-list' }, [
        el('li', { text: '端末やブラウザを変えると引き継がれません（同期はしません）。' }),
        el('li', { text: 'ブラウザの「サイトデータの削除」や、プライベートウィンドウを閉じたときに消えます。' }),
        el('li', { text: 'サーバーには一切送信しません。アカウント登録もありません。' }),
        el('li', { text: 'localStorage が使えない設定のときは、画面上部に注意が出て、そのタブを閉じるまでの一時保存に切り替わります。' })
      ]),
      el('p', { class: 'muted small', text: '保存キーは単語の id です。同じ仮名の別語（ながむ〔眺む〕/〔詠む〕）が混ざらないようにするためで、単語データを更新しても履歴は残ります。' }),
      el('h3', { class: 'help-h3', text: '履歴をリセットする' }),
      resetBlock()
    ]));

    /* --- 8. データ -------------------------------------------------- */
    section.appendChild(sec('data', 'データについて', [
      el('p', { class: 'help-stats' }, [
        el('span', { class: 'badge count', text: '単語 ' + idx.words.length + ' 語' }),
        el('span', { class: 'badge count', text: '作品 ' + idx.works.length + ' 件' }),
        el('span', { class: 'badge count', text: '文章 ' + idx.passages.length + ' 編' }),
        el('span', { class: 'badge count', text: '段落 ' + paraCount }),
        el('span', { class: 'badge count', text: '文章の語 ' + vocabCount + ' 件' }),
        el('span', { class: 'badge count', text: '例文 ' + idx.examples.length + ' 文' })
      ]),
      dl([
        ['原文', ['一次校閲済みです。教科書で最も一般的な本文（伊勢物語＝定家本系、枕草子＝三巻本、方丈記＝大福光寺本、平家物語＝覚一本系、源氏物語＝大島本、徒然草＝流布本）に揃えました。', el('b', { text: '底本によって異同がある箇所' }), ' は、教科書本文を採ったうえで注記として残しています。長い教材は有名な部分を抜き、省いた箇所は本文中に（中略）と書いてあります。']],
        ['現代語訳', ['このアプリのために書き下ろしたものです。教科書や市販の訳文は転載していません。']],
        ['単語 ' + idx.words.length + ' 語', ['語義・重要度・品詞は素材データそのままです。使う前に手元の辞書で確認することをおすすめします。']],
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

    section.appendChild(el('div', { class: 'home-foot' }, [
      el('a', { href: '#/', text: 'ホームへ戻る' }),
      el('a', { href: '#/words', text: '単語一覧へ' }),
      el('a', { href: '#/passages', text: '文章一覧へ' })
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
