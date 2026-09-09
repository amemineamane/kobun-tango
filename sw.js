/* =====================================================================
 * sw.js — Service Worker（ホーム画面に追加＋オフライン）
 * ---------------------------------------------------------------------
 * 目的は 2 つだけ。
 *   1. Android Chrome の「アプリをインストール」の条件を満たす
 *      （manifest ＋ fetch を扱う Service Worker が要る）
 *   2. 一度開いたページを、電波が無いときにも開けるようにする
 *
 * 【方針：network-first（ネット優先・失敗したらキャッシュ）】
 *   単語や文章のデータを直したとき、古いキャッシュが残って
 *   「直したはずの本文が出ない」のがいちばん困る。
 *   そこで **毎回ネットを先に見に行き**、取れたらその内容を返しつつ
 *   キャッシュを更新する。オフラインのときだけキャッシュを返す。
 *   （cache-first にすると速いが、更新が届くのが 1 回遅れる）
 *
 * 【バージョン】
 *   CACHE_VERSION は index.html の ?v=... と同じ文字列にしてある。
 *   `node tools/bump-version.mjs` が index.html と一緒にここも書き換える。
 *   バージョンが変わると CACHE_NAME が変わり、古いキャッシュは
 *   activate のときにまとめて消える。
 *
 * 【更新の反映】
 *   install で skipWaiting はしない。新しい SW は待機状態のまま止め、
 *   画面側（js/app.js）が「新しいバージョンがあります」のバーを出す。
 *   ユーザーが押したら SKIP_WAITING を受け取って交代し、画面が再読み込みされる。
 *   勝手に入れ替えると、読んでいる途中のページが差し替わって驚くため。
 *
 * 【file:// では動かない】
 *   Service Worker は http/https でしか登録できない。
 *   js/app.js が protocol を見て、file:// のときは登録しない。
 * ===================================================================== */
'use strict';

/* tools/bump-version.mjs が書き換える行（形を変えないこと） */
const CACHE_VERSION = '20260910b';
const CACHE_NAME = 'kobun-' + CACHE_VERSION;

/* インストール時に取っておくファイル。
   ?v=... は付けない（照合は ignoreSearch で行うため）。
   ファイルを足したらここにも足す。 */
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './data/site.js',
  './data/words.js',
  './data/works.js',
  './data/relations.js',
  './data/examples.js',
  './data/workWords.js',
  './data/passages.js',
  './js/util.js',
  './js/store.js',
  './js/data-index.js',
  './js/components.js',
  './js/router.js',
  './js/view-home.js',
  './js/view-words.js',
  './js/view-word.js',
  './js/view-works.js',
  './js/view-passages.js',
  './js/view-study.js',
  './js/view-quiz.js',
  './js/view-help.js',
  './js/app.js',
  './assets/favicon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil((async function () {
    const cache = await caches.open(CACHE_NAME);
    // 1 つでも失敗すると全部失敗する cache.addAll ではなく、1 件ずつ入れる
    // （ファイルを消したときに Service Worker ごと死ぬのを避ける）
    await Promise.allSettled(PRECACHE.map(function (url) {
      return cache.add(new Request(url, { cache: 'reload' }));
    }));
  })());
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    const keys = await caches.keys();
    await Promise.all(keys.map(function (key) {
      // このアプリの古い版だけ消す（同じオリジンの他のキャッシュには触らない）
      if (key.indexOf('kobun-') === 0 && key !== CACHE_NAME) return caches.delete(key);
      return Promise.resolve();
    }));
    await self.clients.claim();
  })());
});

/* 画面側から「新しい版に入れ替えてよい」と言われたときだけ交代する */
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  // 同じオリジンだけ扱う（X・LINE への共有リンクなどは素通し）
  if (url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req);
    // 正常に取れたものだけ控えておく（206 やエラーはキャッシュしない）
    if (res && res.ok && res.type === 'basic') {
      cache.put(req, res.clone()).catch(function () { /* 容量不足などは無視 */ });
    }
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    // ハッシュルーティングなので、どの画面も実体は index.html
    if (req.mode === 'navigate') {
      const index = await cache.match('./index.html', { ignoreSearch: true });
      if (index) return index;
    }
    throw err;
  }
}
