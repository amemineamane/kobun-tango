/* =====================================================================
 * js/data-index.js — データの索引づくり
 * ---------------------------------------------------------------------
 * data/*.js は「素直な配列」として書いてある（人間が編集しやすいように）。
 * 画面から引くには索引が要るので、起動時に一度だけここで組み立てる。
 *
 * つくる索引:
 *   wordById         Map<number, Word>
 *   workById         Map<string, Work>
 *   exampleById      Map<string, Example>
 *   relationsByWord  Map<number, Array<{word, type, note, reversed}>>
 *                    ※ relations.js に片方向で書いた行も **双方向** に展開する
 *   examplesByWord   Map<number, Array<Example>>
 *   worksByWord      Map<number, Array<Work>>
 *   wordsByWork      Map<string, Array<Word>>
 *                    （例文 tokens ∪ workWords ∪ passages.vocab の wordId の和集合）
 *   examplesByWork   Map<string, Array<Example>>
 *   passageById      Map<string, Passage>
 *   passagesByWork   Map<string, Array<Passage>>
 *   passagesByWord   Map<number, Array<Passage>>
 *   passageEntries   Map<string, Array<VocabEntry>>  文章の語（表示用。原文の順ではなく記載順）
 *   passageDeck      Map<string, Array<Word|PassageWord>>  学習・クイズのデッキ
 *   posList / kanaRows / levels / grades … フィルタの選択肢
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

  /** 文章の「学年」フィルタの並び順。ここに無い値は末尾に回る。 */
  var GRADE_ORDER = ['中1', '中2', '中3', '高校'];

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
    var examples = K.examples || [];
    var workWords = K.workWords || [];
    var passages = K.passages || [];

    var wordById = new Map();
    words.forEach(function (w) { wordById.set(w.id, w); });

    var workById = new Map();
    works.forEach(function (w) { workById.set(w.id, w); });

    var exampleById = new Map();
    examples.forEach(function (e) { exampleById.set(e.id, e); });

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

    /* --- 例文 ⇔ 単語 / 作品 --------------------------------------- */
    var examplesByWord = new Map();
    var examplesByWork = new Map();
    var workIdsByWord = new Map(); // wordId -> Set<workId>
    var wordIdsByWork = new Map(); // workId -> Set<wordId>

    examples.forEach(function (ex) {
      if (!examplesByWork.has(ex.workId)) examplesByWork.set(ex.workId, []);
      examplesByWork.get(ex.workId).push(ex);

      var seenInThisExample = new Set();
      (ex.tokens || []).forEach(function (t) {
        if (t.wordId == null || !wordById.has(t.wordId)) return;
        if (!seenInThisExample.has(t.wordId)) {
          seenInThisExample.add(t.wordId);
          if (!examplesByWord.has(t.wordId)) examplesByWord.set(t.wordId, []);
          examplesByWord.get(t.wordId).push(ex);
        }
        if (!workIdsByWord.has(t.wordId)) workIdsByWord.set(t.wordId, new Set());
        workIdsByWord.get(t.wordId).add(ex.workId);
        if (!wordIdsByWork.has(ex.workId)) wordIdsByWork.set(ex.workId, new Set());
        wordIdsByWork.get(ex.workId).add(t.wordId);
      });
    });

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
          // 作品の収録語に足す（例文 tokens ∪ workWords ∪ passages.vocab）
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

    // 学年は決まった並びにしたい。GRADE_ORDER に無いものは末尾へ
    var grades = Array.from(gradeSeen.keys()).sort(function (a, b) {
      var ia = GRADE_ORDER.indexOf(a), ib = GRADE_ORDER.indexOf(b);
      if (ia < 0) ia = 99 + gradeSeen.get(a);
      if (ib < 0) ib = 99 + gradeSeen.get(b);
      return ia - ib;
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

    return {
      words: words,
      works: works,
      examples: examples,
      passages: passages,
      wordById: wordById,
      workById: workById,
      exampleById: exampleById,
      passageById: passageById,
      passagesByWork: passagesByWork,
      passagesByWord: passagesByWord,
      passageEntries: passageEntries,
      passageDeck: passageDeck,
      grades: grades,
      relationsByWord: relationsByWord,
      examplesByWord: examplesByWord,
      examplesByWork: examplesByWork,
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
      examplesOf: function (id) { return examplesByWord.get(Number(id)) || []; },
      worksOf: function (id) { return worksByWord.get(Number(id)) || []; },

      /* --- 文章 ------------------------------------------------- */
      getPassage: function (id) { return passageById.get(String(id)) || null; },
      /** その文章の語（表示用。wordId ありは word、無しは passageWord を持つ） */
      entriesOfPassage: function (id) { return passageEntries.get(String(id)) || []; },
      /** その文章のデッキ（学習・クイズ用。Word と PassageWord の混合） */
      deckOfPassage: function (id) { return passageDeck.get(String(id)) || []; },
      /** その作品の文章 */
      passagesOfWork: function (id) { return passagesByWork.get(String(id)) || []; },
      /** その語が出てくる文章（vocab に wordId で載っているもの） */
      passagesOfWord: function (id) { return passagesByWord.get(Number(id)) || []; },
      /** 五十音順に並んだ全単語（前後ナビ用） */
      sortedByKana: words.slice().sort(function (a, b) { return a.kanaOrder - b.kanaOrder; })
    };
  }

  K.index = build();
})();
