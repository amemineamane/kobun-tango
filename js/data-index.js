/* =====================================================================
 * js/data-index.js — データの索引づくり
 * ---------------------------------------------------------------------
 * data/*.js は「素直な配列」として書いてある（人間が編集しやすいように）。
 * 画面から引くには索引が要るので、起動時に一度だけここで組み立てる。
 *
 * つくる索引:
 *   wordById         Map<number, Word>
 *   workById         Map<string, Work>
 *   relationsByWord  Map<number, Array<{word, type, note, reversed}>>
 *                    ※ relations.js に片方向で書いた行も **双方向** に展開する
 *   worksByWord      Map<number, Array<Work>>
 *   wordsByWork      Map<string, Array<Word>>
 *                    （passages.vocab ∪ 品詞分解の w ∪ workWords の和集合）
 *   passageById      Map<string, Passage>
 *   passagesByWork   Map<string, Array<Passage>>
 *   passagesByWord   Map<number, Array<Passage>>
 *   passageEntries   Map<string, Array<VocabEntry>>  文章の語（表示用。原文の順ではなく記載順）
 *   passageDeck      Map<string, Array<Word|PassageWord>>  学習・クイズのデッキ
 *   tokensByPassage  Map<string, Array<Array<Token>>>  品詞分解（段落ごと）
 *   paragraphsByWord Map<number, Array<ParagraphHit>>  その語が出てくる段落
 *   examWorks        Array<Work>  入試（共通テスト・センター試験）の出典作品を
 *                    出題年の新しい順に並べたもの（work.exam を持つ作品）
 *   posList / kanaRows / levels / grades … フィルタの選択肢
 *   grammarById      Map<string, Entry>  data/grammar.js の全エントリ（カテゴリ横断）
 *   grammarCategories Array<{key,label,desc,count}>  文法画面のカテゴリ
 *   grammarAuxGroups Array<{attach, items}>  助動詞を接続でグループ化したもの
 *
 * 【文法（data/grammar.js）】
 *   助動詞・助詞・敬語・活用・識別は「解説」なので、索引は 3 つだけ。
 *     grammarById        … id 1 本で引く（#/grammar/aux/nu のルーティング用）
 *     grammarExamples()  … match 規則でコーパス（tokens）を走査して用例を集める
 *     grammarOfToken()   … 逆引き。トークンから文法エントリを引く（ポップアップ用）
 *   **用例をデータに書かない**のがこの設計の要点で、教材（passages ＋ tokens）が
 *   増えれば文法ページの用例も自動で増える。そのため grammar.js 側は
 *   「どういうトークンがその文法項目か」という規則（match）だけを持つ。
 *
 * 【品詞分解（data/tokens/*.js）】
 *   window.KOBUN.tokens は { passageId: [ [token, …], … ] } の素の連想配列で、
 *   1 文章 1 ファイルで足していける（data 側には索引を置かない）。ここで
 *     ・文章 → 段落ごとのトークン列（文章ページが原文を描くのに使う）
 *     ・単語 → その語が出てくる段落（単語詳細の「この語が出てくる文章」）
 *   の 2 つに開く。かつて data/examples.js が担っていた「例文」の索引は、
 *   **この段落索引に置き換わった**（1 文＝例文 ではなく 1 段落＝読む単位）。
 *   トークンの w は passages.vocab と並ぶ「語と文章を結ぶ根拠」なので、
 *   passagesByWord / wordsByWork にも合流させる。
 *   トークンのキーは短い（s/b/p/c/f/m/w/n）。意味は docs/tokens-guide.md 参照。
 *
 * 【PassageWord（文章固有語）】
 *   330 語に無い語も、学習カード・クイズに出せるように Word と同じ形の
 *   オブジェクトに包む。見分けるための印は `isPassageWord: true`。
 *   id は "p:<passageId>:<vocab の添字>" という **文字列**（学習履歴のキーになる）。
 *   level は 'P'（文章語）、posOrder / kanaOrder は 330 語の後ろに並ぶ大きい値。
 *
 * 【新しい関連づけを足したくなったら】
 *   data 側に配列を足して、ここに索引を 1 つ増やすだけでよい。
 *   画面側は index.xxx を読むだけなので、データ形式の変更が波及しない。
 * ===================================================================== */
(function () {
  'use strict';

  var K = window.KOBUN;

  /** 逆向きに表示するときの type の読み替え。
   *  ほとんどの関係は対称なのでそのまま。非対称なものだけここに書く。 */
  var INVERSE_TYPE = {
    '派生': '派生元',
    '段階': '段階'
  };

  /** 文章の「学年」フィルタの並び順。ここに無い値は末尾に回る。
   *  '入試' は学年ではなく「大学入学共通テスト・センター試験の出典」を指すラベルで、
   *  教科書ページでは専用のセクション（出題年の新しい順）に分けて出す。 */
  var GRADE_ORDER = ['中1', '中2', '中3', '高校', '入試'];

  /** 入試の学年ラベル（data/passages.js の grade と、教科書の 2 セクション分けで共有する） */
  var EXAM_GRADE = '入試';

  /** その作品の出題歴を新しい順に並べた配列（無ければ []） */
  function examList(work) {
    return ((work && work.exam) || []).slice().sort(function (a, b) {
      return (b.year || 0) - (a.year || 0);
    });
  }

  /** その作品の最新の出題年（無ければ 0） */
  function latestExamYear(work) {
    return ((work && work.exam) || []).reduce(function (max, e) {
      return e && e.year > max ? e.year : max;
    }, 0);
  }

  /* ===================================================================
   * 文法（data/grammar.js）と品詞分解（data/tokens/*.js）のつなぎ
   * -------------------------------------------------------------------
   * grammar.js の match 規則でトークンを判定する。規則の形は
   *   { s, sEnd, b, p, c, f, m }  … 書いたキーだけを見る
   *   s/b/p/c/f … 完全一致（配列ならどれかに一致）
   *   sEnd      … 表層形の末尾一致（活用語尾だけを問題にするとき）
   *   m         … 用法ラベルの前方一致（'完了' で '（完了）〜た' に当たる）
   * 規則は 1 つでも配列でもよい（同じ項目に書き方が複数あるとき）。
   * =================================================================== */

  /** 文法のカテゴリ（URL のキー・画面の見出し・並び順をここ 1 か所で決める） */
  var GRAMMAR_CATEGORIES = [
    { key: 'aux', label: '助動詞', desc: '接続・活用・意味と、文中での見分け方。' },
    { key: 'particle', label: '助詞', desc: '格助詞・接続助詞・係助詞・副助詞・終助詞と係り結び。' },
    { key: 'keigo', label: '敬語', desc: '尊敬・謙譲・丁寧の主要な語と、敬意の方向。' },
    { key: 'conj', label: '活用', desc: '動詞 9 種・形容詞・形容動詞の活用表と見分け方。' },
    { key: 'ident', label: '識別', desc: '「ぬ」「なり」「に」など、同じ字面を見分ける手順。' }
  ];

  /** 助動詞の一覧を接続でグループ化するときの見出しと並び順 */
  var ATTACH_GROUPS = [
    { key: '未然形', label: '未然形に接続' },
    { key: '連用形', label: '連用形に接続' },
    { key: '終止形', label: '終止形に接続（ラ変型には連体形）' },
    { key: '四段の已然形', label: 'サ変の未然形・四段の已然形に接続' },
    { key: '', label: '体言・連体形に接続' }
  ];

  function attachGroupKey(attach) {
    var a = String(attach || '');
    for (var i = 0; i < ATTACH_GROUPS.length; i++) {
      var k = ATTACH_GROUPS[i].key;
      if (k && a.indexOf(k) === 0) return k;
    }
    return '';
  }

  /** m（'（完了）〜てしまった'）の「（　）」の中身を取り出す。無ければ '' */
  function meaningLabel(m) {
    var mt = /^[（(]([^）)]*)[）)]/.exec(String(m || ''));
    return mt ? mt[1] : '';
  }

  /** 規則の 1 キーぶんの照合（値は文字列でも配列でもよい） */
  function eq(ruleValue, actual) {
    if (ruleValue == null) return true;
    var a = String(actual == null ? '' : actual);
    if (Array.isArray(ruleValue)) {
      for (var i = 0; i < ruleValue.length; i++) if (String(ruleValue[i]) === a) return true;
      return false;
    }
    return String(ruleValue) === a;
  }

  function endsWithAny(ruleValue, actual) {
    if (ruleValue == null) return true;
    var a = String(actual == null ? '' : actual);
    var list = Array.isArray(ruleValue) ? ruleValue : [ruleValue];
    for (var i = 0; i < list.length; i++) {
      var s = String(list[i]);
      if (s && a.length >= s.length && a.slice(a.length - s.length) === s) return true;
    }
    return false;
  }

  /** m の前方一致。'完了' も '（完了）' も受ける。'伝聞' は '（伝聞推定）' にも当たる */
  function matchMeaning(ruleValue, tokenM) {
    if (ruleValue == null) return true;
    var raw = String(tokenM == null ? '' : tokenM);
    var label = meaningLabel(raw);
    var list = Array.isArray(ruleValue) ? ruleValue : [ruleValue];
    for (var i = 0; i < list.length; i++) {
      var r = String(list[i]).replace(/^[（(]/, '').replace(/[）)]$/, '');
      if (!r) continue;
      if (label && label.indexOf(r) === 0) return true;
      if (raw.indexOf(r) === 0) return true;
    }
    return false;
  }

  /** 規則 1 つとトークン 1 つの照合 */
  function matchRule(rule, t) {
    if (!rule || !t) return false;
    if (!eq(rule.s, t.s)) return false;
    if (!endsWithAny(rule.sEnd, t.s)) return false;
    if (!eq(rule.b, t.b)) return false;
    if (!eq(rule.p, t.p)) return false;
    if (!eq(rule.c, t.c)) return false;
    if (!eq(rule.f, t.f)) return false;
    if (!matchMeaning(rule.m, t.m)) return false;
    return true;
  }

  /** match（1 つ or 配列）とトークンの照合 */
  function matchAny(match, t) {
    if (!match) return false;
    var list = Array.isArray(match) ? match : [match];
    for (var i = 0; i < list.length; i++) if (matchRule(list[i], t)) return true;
    return false;
  }

  /** 展開済みトークン（surface/base/pos/detail/meaning）を素のキーに戻す */
  function rawToken(t) {
    if (!t) return null;
    if (t.s != null || t.p != null) return t;   // もう素の形
    var detail = String(t.detail || '').split('・');
    return {
      s: t.surface, b: t.base, p: t.pos,
      c: detail[0] || '', f: detail[1] || '',
      m: t.meaning, w: t.wordId, n: t.note
    };
  }

  /** その段落のトークン列で、idx を含む 1 文の範囲 [from, to]（「。」で区切る） */
  function sentenceRange(list, idx) {
    var from = 0, to = list.length - 1;
    var i;
    for (i = idx - 1; i >= 0; i--) {
      if (/。/.test((list[i] && list[i].s) || '')) { from = i + 1; break; }
    }
    for (i = idx; i < list.length; i++) {
      if (/。/.test((list[i] && list[i].s) || '')) { to = i; break; }
    }
    if (from > idx) from = idx;
    return [from, to];
  }

  /** 文章固有語を Word と同じ形に包む。学習・クイズがそのまま扱えるようにする。 */
  function makePassageWord(passage, entry, index) {
    var kana = entry.base || entry.surface;
    var keys = [];
    if (K.util && K.util.normalizeKana) {
      var nk = K.util.normalizeKana(kana);
      if (nk) keys.push(nk);
      var ns = K.util.normalizeKana(entry.surface);
      if (ns && keys.indexOf(ns) < 0) keys.push(ns);
    }
    if (!keys.length) keys.push(kana);
    return {
      id: 'p:' + passage.id + ':' + index,
      isPassageWord: true,
      passageId: passage.id,
      passageTitle: passage.title,
      surface: entry.surface,
      level: 'P',
      levelLabel: '文章の語',
      levelOrder: 4,
      pos: entry.pos || '名詞',
      posOrder: 90,
      kana: kana,
      kanji: null,
      headwords: [kana],
      meanings: [entry.meaning],
      primaryMeaning: entry.meaning,
      meaningCount: 1,
      searchKeys: keys,
      romaji: '',
      sortKey: keys[0],
      kanaRow: '',
      kanaOrder: 100000 + index,
      note: entry.note || ''
    };
  }

  function build() {
    var words = K.words || [];
    var works = K.works || [];
    var relations = K.relations || [];
    var workWords = K.workWords || [];
    var passages = K.passages || [];

    var wordById = new Map();
    words.forEach(function (w) { wordById.set(w.id, w); });

    var workById = new Map();
    works.forEach(function (w) { workById.set(w.id, w); });

    /* --- 関連語（双方向に展開） ---------------------------------- */
    var relationsByWord = new Map();
    function pushRel(fromId, toId, type, note, reversed) {
      var target = wordById.get(toId);
      if (!target) return; // validate.mjs で弾かれるはずだが念のため
      if (!relationsByWord.has(fromId)) relationsByWord.set(fromId, []);
      relationsByWord.get(fromId).push({
        word: target, type: type, note: note || '', reversed: !!reversed
      });
    }
    relations.forEach(function (r) {
      pushRel(r.from, r.to, r.type, r.note, false);
      pushRel(r.to, r.from, INVERSE_TYPE[r.type] || r.type, r.note, true);
    });
    // 同じ type でまとめて見やすくする
    relationsByWord.forEach(function (list) {
      list.sort(function (a, b) {
        if (a.type !== b.type) return a.type.localeCompare(b.type, 'ja');
        return a.word.kanaOrder - b.word.kanaOrder;
      });
    });

    /* --- 語 ⇔ 作品 ------------------------------------------------ *
     * かつては data/examples.js の例文 tokens が「語と作品の結びつき」の
     * 主な根拠だったが、例文は退避した（DESIGN.md 5.2）。
     * いまは passages.vocab・品詞分解の w・workWords の 3 つを下で足し込む。
     * ---------------------------------------------------------------- */
    var workIdsByWord = new Map(); // wordId -> Set<workId>
    var wordIdsByWork = new Map(); // workId -> Set<wordId>

    /* --- 手動タグ（workWords）を和集合として足す ------------------ */
    var workWordNote = new Map(); // "workId/wordId" -> note
    workWords.forEach(function (ww) {
      if (!wordById.has(ww.wordId) || !workById.has(ww.workId)) return;
      if (!wordIdsByWork.has(ww.workId)) wordIdsByWork.set(ww.workId, new Set());
      wordIdsByWork.get(ww.workId).add(ww.wordId);
      if (!workIdsByWord.has(ww.wordId)) workIdsByWord.set(ww.wordId, new Set());
      workIdsByWord.get(ww.wordId).add(ww.workId);
      workWordNote.set(ww.workId + '/' + ww.wordId, ww.note || '');
    });

    /* --- 文章（passages） ------------------------------------------
     * ここで作るもの:
     *   passageById / passagesByWork / passagesByWord
     *   passageEntries … 表示用。vocab 1 件 = { entry, word, passageWord, key }
     *   passageDeck    … 学習・クイズ用。Word と PassageWord の混合配列
     * また、作品の収録語（wordIdsByWork）に passages.vocab の wordId を足す。
     * ------------------------------------------------------------- */
    var passageById = new Map();
    var passagesByWork = new Map();
    var passagesByWord = new Map();
    var passageEntries = new Map();
    var passageDeck = new Map();
    var gradeSeen = new Map();

    passages.forEach(function (p) {
      passageById.set(p.id, p);

      if (!passagesByWork.has(p.workId)) passagesByWork.set(p.workId, []);
      passagesByWork.get(p.workId).push(p);

      (p.grade || []).forEach(function (g) {
        if (!gradeSeen.has(g)) gradeSeen.set(g, gradeSeen.size);
      });

      var entries = [];
      var deck = [];
      var deckSeen = new Set();

      (p.vocab || []).forEach(function (v, i) {
        var word = v.wordId != null ? wordById.get(v.wordId) : null;
        var pw = null;
        if (word) {
          // 作品の収録語に足す（passages.vocab ∪ 品詞分解の w ∪ workWords）
          if (!wordIdsByWork.has(p.workId)) wordIdsByWork.set(p.workId, new Set());
          wordIdsByWork.get(p.workId).add(word.id);
          if (!workIdsByWord.has(word.id)) workIdsByWord.set(word.id, new Set());
          workIdsByWord.get(word.id).add(p.workId);
          // この語が出てくる文章
          if (!passagesByWord.has(word.id)) passagesByWord.set(word.id, []);
          if (passagesByWord.get(word.id).indexOf(p) < 0) passagesByWord.get(word.id).push(p);
        } else if (v.wordId == null) {
          pw = makePassageWord(p, v, i);
        }
        var key = word ? word.id : (pw ? pw.id : null);
        entries.push({
          index: i,
          entry: v,
          surface: v.surface,
          word: word,
          passageWord: pw,
          key: key,
          meaning: word
            ? (word.meanings[v.meaningIndex] || word.primaryMeaning)
            : v.meaning,
          note: v.note || ''
        });
        var card = word || pw;
        if (card && !deckSeen.has(card.id)) { deckSeen.add(card.id); deck.push(card); }
      });

      passageEntries.set(p.id, entries);
      passageDeck.set(p.id, deck);
    });

    /* --- 品詞分解（data/tokens/*.js） ------------------------------
     * passages を回し終えてから開く（passageById が要るため）。
     * tokens に無い文章は素通りし、画面側が従来の文字列描画に落ちる。
     * ------------------------------------------------------------- */
    var rawTokens = K.tokens || {};
    var tokensByPassage = new Map();
    var paragraphsByWord = new Map(); // wordId -> [{ passage, index, text, translation, tokens }]

    Object.keys(rawTokens).forEach(function (passageId) {
      var p = passageById.get(passageId);
      var paras = rawTokens[passageId];
      // 文章が無い／段落数が合わないデータは使わない（tools/validate-tokens.mjs が弾く）
      if (!p || !Array.isArray(paras) || paras.length !== p.paragraphs.length) return;
      tokensByPassage.set(passageId, paras);

      paras.forEach(function (list, i) {
        if (!Array.isArray(list)) return;
        var seen = new Set();
        list.forEach(function (t) {
          if (!t || t.w == null) return;
          var word = wordById.get(t.w);
          if (!word || seen.has(word.id)) return;
          seen.add(word.id);

          if (!paragraphsByWord.has(word.id)) paragraphsByWord.set(word.id, []);
          paragraphsByWord.get(word.id).push({
            passage: p,
            index: i,
            text: p.paragraphs[i].text || '',
            translation: p.paragraphs[i].translation || '',
            tokens: list
          });

          // 「この語が出てくる文章」「作品の収録語」の根拠に合流させる
          if (!passagesByWord.has(word.id)) passagesByWord.set(word.id, []);
          if (passagesByWord.get(word.id).indexOf(p) < 0) passagesByWord.get(word.id).push(p);
          if (!wordIdsByWork.has(p.workId)) wordIdsByWork.set(p.workId, new Set());
          wordIdsByWork.get(p.workId).add(word.id);
          if (!workIdsByWord.has(word.id)) workIdsByWord.set(word.id, new Set());
          workIdsByWord.get(word.id).add(p.workId);
        });
      });
    });

    // 学年は決まった並びにしたい。GRADE_ORDER に無いものは末尾へ
    var grades = Array.from(gradeSeen.keys()).sort(function (a, b) {
      var ia = GRADE_ORDER.indexOf(a), ib = GRADE_ORDER.indexOf(b);
      if (ia < 0) ia = 99 + gradeSeen.get(a);
      if (ib < 0) ib = 99 + gradeSeen.get(b);
      return ia - ib;
    });

    /* --- 入試の出典作品 --------------------------------------------
     * works.js の exam（出題歴の配列）を持つ作品を、出題年の新しい順に並べる。
     * 同じ年が複数あるときは作品名の五十音順で安定させる。
     * 教科書ページの「共通テスト・センター試験の出典作品」セクションと
     * ホームの入口カードがこの並びをそのまま使う。
     * ------------------------------------------------------------- */
    var examWorks = works.filter(function (w) { return (w.exam || []).length > 0; })
      .slice()
      .sort(function (a, b) {
        var ya = latestExamYear(a), yb = latestExamYear(b);
        if (ya !== yb) return yb - ya;
        return String(a.title).localeCompare(String(b.title), 'ja');
      });

    var wordsByWork = new Map();
    wordIdsByWork.forEach(function (set, workId) {
      var list = Array.from(set).map(function (id) { return wordById.get(id); })
        .filter(Boolean)
        .sort(function (a, b) { return a.kanaOrder - b.kanaOrder; });
      wordsByWork.set(workId, list);
    });

    var worksByWord = new Map();
    workIdsByWord.forEach(function (set, wordId) {
      var list = Array.from(set).map(function (id) { return workById.get(id); })
        .filter(Boolean);
      worksByWord.set(wordId, list);
    });

    /* --- フィルタの選択肢（データから自動生成） -------------------- */
    var posList = [];
    var posSeen = new Map();
    words.forEach(function (w) { if (!posSeen.has(w.pos)) posSeen.set(w.pos, w.posOrder); });
    posList = Array.from(posSeen.keys()).sort(function (a, b) { return posSeen.get(a) - posSeen.get(b); });

    var kanaRows = [];
    var rowSeen = new Map();
    words.forEach(function (w) {
      if (!rowSeen.has(w.kanaRow)) rowSeen.set(w.kanaRow, w.kanaOrder);
    });
    kanaRows = Array.from(rowSeen.keys()).sort(function (a, b) { return rowSeen.get(a) - rowSeen.get(b); });

    /* 重要度は S/A/B の記号だけでは意味が伝わらないので、
       ラベル（words.js の levelLabel と同じ語）と一言説明・語数をここで 1 か所にまとめる。
       バッジ・フィルタの選択肢・凡例・ホーム・使い方ページはすべてこれを読む。 */
    var levels = [
      { code: 'S', label: '最重要', desc: '共通テストで必ず問われる中核語' },
      { code: 'A', label: '頻出', desc: '合否を分ける頻出語' },
      { code: 'B', label: '応用', desc: '難関大で差がつく語' }
    ].filter(function (l) { return words.some(function (w) { return w.level === l.code; }); });
    levels.forEach(function (l) {
      l.count = words.filter(function (w) { return w.level === l.code; }).length;
    });
    var levelByCode = new Map();
    levels.forEach(function (l) { levelByCode.set(l.code, l); });

    /* --- 文法（data/grammar.js） ----------------------------------- *
     * エントリは「助動詞・助詞・敬語・活用・識別」の 5 カテゴリに散っているが、
     * URL（#/grammar/aux/nu）からは id 1 本で引きたいので 1 つの Map にまとめる。
     * category を各エントリに書き足しておくと、画面側が
     * 「どのカテゴリの詳細を描くか」を分岐できる。
     * ---------------------------------------------------------------- */
    var grammar = K.grammar || null;
    var grammarById = new Map();
    var grammarLists = { aux: [], particle: [], keigo: [], conj: [], ident: [] };

    function registerGrammar(list, category) {
      (list || []).forEach(function (e) {
        if (!e || !e.id) return;
        e.category = category;
        grammarById.set(e.id, e);
        grammarLists[category].push(e);
      });
    }

    if (grammar) {
      registerGrammar(grammar.auxiliaries, 'aux');
      registerGrammar(grammar.particles, 'particle');
      registerGrammar(grammar.keigo && grammar.keigo.words, 'keigo');
      registerGrammar(grammar.identification, 'ident');
      // 活用は「表の行」がエントリ（詳細ページは持たず、カテゴリページの表で見せる）
      ((grammar.conjugation && grammar.conjugation.groups) || []).forEach(function (g) {
        (g.rows || []).forEach(function (r) {
          if (!r || !r.id) return;
          r.category = 'conj';
          r.groupTitle = g.title;
          grammarById.set(r.id, r);
          grammarLists.conj.push(r);
        });
      });
    }

    var grammarCategories = GRAMMAR_CATEGORIES.map(function (c) {
      return {
        key: c.key, label: c.label, desc: c.desc,
        count: grammarLists[c.key].length
      };
    }).filter(function (c) { return c.count > 0; });

    /* 助動詞の一覧は接続でグループ化して並べる（教科書の助動詞表と同じ順序）。 */
    var grammarAuxGroups = ATTACH_GROUPS.map(function (g) {
      return {
        key: g.key, label: g.label,
        items: grammarLists.aux.filter(function (a) { return attachGroupKey(a.attach) === g.key; })
      };
    }).filter(function (g) { return g.items.length > 0; });

    /* 助詞の一覧は kind（格助詞・接続助詞・…）でグループ化して並べる。 */
    var PARTICLE_KINDS = ['格助詞', '接続助詞', '係助詞', '副助詞', '終助詞', '間投助詞'];
    var grammarParticleGroups = PARTICLE_KINDS.map(function (k) {
      return { key: k, label: k, items: grammarLists.particle.filter(function (p) { return p.kind === k; }) };
    }).filter(function (g) { return g.items.length > 0; });

    /* 敬語は kind（尊敬・謙譲・丁寧）でグループ化して表にする。 */
    var grammarKeigoGroups = (((grammar && grammar.keigo) || {}).groups || []).map(function (g) {
      return {
        key: g.kind, label: g.kind, desc: g.desc,
        items: grammarLists.keigo.filter(function (w) { return w.kind === g.kind; })
      };
    }).filter(function (g) { return g.items.length > 0; });

    return {
      words: words,
      works: works,
      passages: passages,
      wordById: wordById,
      workById: workById,
      passageById: passageById,
      passagesByWork: passagesByWork,
      passagesByWord: passagesByWord,
      passageEntries: passageEntries,
      passageDeck: passageDeck,
      tokensByPassage: tokensByPassage,
      paragraphsByWord: paragraphsByWord,
      grades: grades,
      examWorks: examWorks,
      EXAM_GRADE: EXAM_GRADE,
      relationsByWord: relationsByWord,
      wordsByWork: wordsByWork,
      worksByWord: worksByWord,
      workWordNote: workWordNote,
      posList: posList,
      kanaRows: kanaRows,
      levels: levels,

      /** 重要度の説明を引く（S/A/B。文章固有語の 'P' もここで面倒を見る） */
      getLevel: function (code) {
        if (code === 'P') {
          return { code: 'P', label: '文章の語', desc: '教科書の脚注に出る語（330 語には無い）', count: 0 };
        }
        return levelByCode.get(String(code)) || null;
      },

      /* 便利メソッド */
      getWord: function (id) { return wordById.get(Number(id)) || null; },
      getWork: function (id) { return workById.get(String(id)) || null; },
      relationsOf: function (id) { return relationsByWord.get(Number(id)) || []; },
      worksOf: function (id) { return worksByWord.get(Number(id)) || []; },

      /* --- 入試の出題歴 ------------------------------------------ *
       * work.exam は配列（1 回の出題 = 1 要素）、passage.exam は 1 つのオブジェクト。
       * どちらも未定義に耐えるので、呼び出し側で有無を気にしなくてよい。
       * ------------------------------------------------------------ */
      /** その作品の出題歴（新しい順）。無ければ [] */
      examsOfWork: function (id) {
        return examList(workById.get(String(id)));
      },
      /** その作品の最新の出題年。出題歴が無ければ 0 */
      examYearOfWork: function (id) {
        return latestExamYear(workById.get(String(id)));
      },
      /** その文章の出題（{ year, test }）。無ければ null */
      examOfPassage: function (id) {
        var p = passageById.get(String(id));
        return (p && p.exam) || null;
      },
      /** その文章が入試の出典か（grade に '入試' を持つ、または exam がある） */
      isExamPassage: function (p) {
        if (!p) return false;
        return !!p.exam || (p.grade || []).indexOf(EXAM_GRADE) >= 0;
      },

      /* --- 文章 ------------------------------------------------- */
      getPassage: function (id) { return passageById.get(String(id)) || null; },
      /** その文章の語（表示用。wordId ありは word、無しは passageWord を持つ） */
      entriesOfPassage: function (id) { return passageEntries.get(String(id)) || []; },
      /** その文章のデッキ（学習・クイズ用。Word と PassageWord の混合） */
      deckOfPassage: function (id) { return passageDeck.get(String(id)) || []; },
      /** その作品の文章 */
      passagesOfWork: function (id) { return passagesByWork.get(String(id)) || []; },
      /** その語が出てくる文章（vocab の wordId ∪ 品詞分解の w） */
      passagesOfWord: function (id) { return passagesByWord.get(Number(id)) || []; },
      /** その文章の品詞分解（段落ごとのトークン配列）。無ければ null */
      tokensOf: function (id) { return tokensByPassage.get(String(id)) || null; },
      /** その文章の 1 段落ぶんの品詞分解。無ければ null */
      tokensOfParagraph: function (id, index) {
        var paras = tokensByPassage.get(String(id));
        return (paras && paras[index]) || null;
      },
      /** その語が出てくる段落（品詞分解の w が根拠。旧「例文」の置き換え） */
      paragraphsOfWord: function (id) { return paragraphsByWord.get(Number(id)) || []; },
      /* --- 文法（data/grammar.js） -------------------------------- */
      grammar: grammar,
      grammarById: grammarById,
      grammarCategories: grammarCategories,
      grammarAuxGroups: grammarAuxGroups,
      grammarParticleGroups: grammarParticleGroups,
      grammarKeigoGroups: grammarKeigoGroups,
      grammarKakari: (grammar && grammar.kakari) || null,
      grammarConjugation: (grammar && grammar.conjugation) || null,
      grammarKeigoNotes: ((grammar && grammar.keigo) || {}).notes || [],
      grammarKeigoIntro: ((grammar && grammar.keigo) || {}).intro || '',

      /** カテゴリのメタ情報（key / label / desc / count）。無ければ null */
      grammarCategory: function (key) {
        var hit = grammarCategories.filter(function (c) { return c.key === key; });
        return hit.length ? hit[0] : null;
      },
      /** そのカテゴリのエントリ一覧 */
      grammarList: function (key) { return grammarLists[key] ? grammarLists[key].slice() : []; },
      /** id で文法エントリを引く（カテゴリ横断）。無ければ null */
      getGrammar: function (id) { return grammarById.get(String(id)) || null; },

      /**
       * その文法エントリの用例をコーパス（data/tokens/*.js）から集める。
       *
       * @param entry  grammar.js のエントリ、または match 規則そのもの
       * @param opts   { limit: 20, match: 規則を上書き }
       * @returns Array<{
       *   passageId, passage, paraIndex, tokenIndex,
       *   sentence,        該当トークンを含む 1 文（「。」で区切った文字列）
       *   sentenceTokens,  その 1 文のトークン配列（描画用）
       *   hitIndex,        sentenceTokens の中で該当トークンが何番目か
       *   token            該当トークン（素のキー s/b/p/c/f/m/w/n）
       * }>
       *
       * 上限は 20 件。**文章ごとに分散させる**（1 編に偏らないよう
       * 文章を回りながら 1 件ずつ拾う）。文章の並びは passages.js の順。
       */
      grammarExamples: function (entry, opts) {
        opts = opts || {};
        var match = opts.match || (entry && entry.match) || entry;
        if (!match) return [];
        var limit = opts.limit == null ? 20 : opts.limit;

        // 文章ごとにヒットを溜める（あとで round-robin で取り出す）
        var buckets = [];
        passages.forEach(function (p) {
          var paras = tokensByPassage.get(p.id);
          if (!paras) return;
          var found = [];
          paras.forEach(function (list, paraIndex) {
            if (!Array.isArray(list)) return;
            list.forEach(function (t, tokenIndex) {
              if (!t || t.p === '記号') return;
              if (!matchAny(match, t)) return;
              var range = sentenceRange(list, tokenIndex);
              var sentenceTokens = list.slice(range[0], range[1] + 1);
              found.push({
                passageId: p.id,
                passage: p,
                paraIndex: paraIndex,
                tokenIndex: tokenIndex,
                sentence: sentenceTokens.map(function (x) { return (x && x.s) || ''; }).join(''),
                sentenceTokens: sentenceTokens,
                hitIndex: tokenIndex - range[0],
                token: t
              });
            });
          });
          if (found.length) buckets.push(found);
        });

        var out = [];
        var round = 0;
        var added = true;
        while (added && out.length < limit) {
          added = false;
          for (var i = 0; i < buckets.length && out.length < limit; i++) {
            if (buckets[i].length > round) { out.push(buckets[i][round]); added = true; }
          }
          round++;
        }
        return out;
      },

      /**
       * トークンから文法エントリを逆に引く（品詞分解ポップアップの
       * 「文法：『ぬ』（完了）の解説へ」のリンク先を決めるのに使う）。
       *
       * @param token 素のトークン（s/b/p/…）でも C.normalizeToken の戻りでもよい
       * @returns { entry, category, ident } | null
       *          entry … 助動詞・助詞・敬語のエントリ（無ければ null）
       *          ident … その字面を扱う識別ページ（無ければ null）
       */
      grammarOfToken: function (token) {
        var t = rawToken(token);
        if (!t) return null;
        var entry = null, category = '';
        var order = ['aux', 'particle', 'keigo'];
        for (var i = 0; i < order.length && !entry; i++) {
          var list = grammarLists[order[i]];
          for (var j = 0; j < list.length; j++) {
            if (matchAny(list[j].match, t)) { entry = list[j]; category = order[i]; break; }
          }
        }
        var ident = null;
        for (var k = 0; k < grammarLists.ident.length; k++) {
          if (matchAny(grammarLists.ident[k].match, t)) { ident = grammarLists.ident[k]; break; }
        }
        if (!entry && !ident) return null;
        return { entry: entry, category: category, ident: ident };
      },

      /** 識別エントリの 1 ケースぶんの用例（cases[].match を使う） */
      grammarCaseExamples: function (identCase, limit) {
        if (!identCase || !identCase.match) return [];
        return this.grammarExamples(null, { match: identCase.match, limit: limit == null ? 6 : limit });
      },

      /**
       * コーパスに出ている「品詞 → 基本形 → 用法ラベル」の集計。
       * grammar.js の match が取りこぼしていないかを確かめるために使う
       * （tools/validate-grammar.mjs が同じものを読む）。
       * @returns Array<{ p, b, label, m, count }>（件数の多い順）
       */
      grammarTokenStats: function (posList2) {
        var want = posList2 || ['助動詞', '格助詞', '係助詞', '副助詞', '接続助詞', '終助詞', '間投助詞'];
        var acc = new Map();
        tokensByPassage.forEach(function (paras) {
          paras.forEach(function (list) {
            if (!Array.isArray(list)) return;
            list.forEach(function (t) {
              if (!t || want.indexOf(t.p) < 0) return;
              var key = t.p + '' + (t.b || t.s || '') + '' + (t.m || '');
              var e = acc.get(key);
              if (e) { e.count++; return; }
              acc.set(key, {
                p: t.p, b: t.b || t.s || '', m: t.m || '',
                label: meaningLabel(t.m), count: 1, token: t
              });
            });
          });
        });
        return Array.from(acc.values()).sort(function (a, b) { return b.count - a.count; });
      },

      /** 規則とトークンの照合を外から使いたいとき（ドリルの出題で使う） */
      grammarMatches: function (match, token) { return matchAny(match, rawToken(token)); },
      /** m（'（完了）〜た'）の「（　）」の中身 */
      grammarMeaningLabel: meaningLabel,

      /** 五十音順に並んだ全単語（前後ナビ用） */
      sortedByKana: words.slice().sort(function (a, b) { return a.kanaOrder - b.kanaOrder; })
    };
  }

  K.index = build();
})();
