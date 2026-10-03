// Service Worker for p-book — offline support
// Bump CACHE_NAME on every release that changes the app shell: the activate
// step then drops the previous cache. The precache list is NOT kept by hand
// any more — install derives it from /content/book.json (every content file),
// the games, diagrams and images those files reference, and app.js's imports.
// (A hand-kept list once missed 97 of 307 content files, all comics included.)
const CACHE_NAME = 'pbook-v80';

// App shell: the few files content cannot point at
const SHELL = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/css/style.css',
  '/js/app.js',
  '/js/diagrams.js',
  '/content/book.json',
  '/content/concepts.json',
  '/content/concept-map.json',
  '/content/concept-proposals.json',
  '/content/id-aliases.json',
];

// Fetch + store one URL; returns the live Response (body still readable) or null
async function precacheOne(cache, url) {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (r.ok) { await cache.put(url, r.clone()); return r; }
  } catch (e) { /* offline or missing — the runtime cache fills it later */ }
  console.warn('SW: skip', url);
  return null;
}

async function inBatches(list, fn, size = 12) {
  for (let i = 0; i < list.length; i += size) await Promise.all(list.slice(i, i + size).map(fn));
}

// Everything a reader needs offline, discovered from the content itself
async function precacheBook(cache) {
  const seen = new Set();
  const add = (url, out) => { if (url && !seen.has(url)) { seen.add(url); out.push(url); } };
  const text = async r => { try { return r ? await r.text() : ''; } catch (e) { return ''; } };

  // 1) shell, then the ES modules app.js imports (with their ?v= cache-busters)
  const shell = [];
  SHELL.forEach(u => add(u, shell));
  const res = {};
  await inBatches(shell, async u => { res[u] = await precacheOne(cache, u); });
  const mods = [];
  const appSrc = await text(res['/js/app.js']);
  for (const m of appSrc.matchAll(/from\s+['"]\.\/([\w.-]+\.js(?:\?[\w=.&-]*)?)['"]/g)) add('/js/' + m[1], mods);
  await inBatches(mods, u => precacheOne(cache, u));

  // 2) diagram names → files (js/diagrams.js DIAGRAM_FILES)
  const diagramFiles = {};
  const dsrc = await text(res['/js/diagrams.js']);
  for (const m of dsrc.matchAll(/['"]?([\w-]+)['"]?\s*:\s*['"](images\/[^'"]+)['"]/g)) diagramFiles[m[1]] = '/' + m[2];

  // 3) every content file listed in book.json, then what those files reference
  let book = null;
  try { book = JSON.parse(await text(res['/content/book.json'])); } catch (e) {}
  const files = [];
  (book?.chapters || []).forEach(ch => (ch.files || []).forEach(f => add(`/content/${ch.directory}/${f}`, files)));
  const assets = [];
  await inBatches(files, async u => {
    const md = await text(await precacheOne(cache, u));
    const game = md.match(/^game:\s*([\w.-]+)\s*$/m);
    if (game) add(`/games/${game[1]}.json`, assets);
    const diagram = md.match(/^diagram:\s*([^\s#]+)\s*$/m);
    if (diagram && diagram[1] !== 'null') {
      const d = diagram[1];
      add(diagramFiles[d] || (/\.(svg|png|jpe?g|webp|gif)$/i.test(d) ? '/' + d.replace(/^\//, '') : null), assets);
    }
    for (const m of md.matchAll(/!\[lottie:([\w-]+)\]/g)) add(`/images/domains/animations/${m[1]}/${m[1]}.json`, assets);
    for (const m of md.matchAll(/\]\((\/?images\/[^)\s]+)\)/g)) add('/' + m[1].replace(/^\//, ''), assets);
  });
  await inBatches(assets, u => precacheOne(cache, u));
}

// Install: build the precache from the book itself (individual failures are skipped)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(precacheBook)
      .catch(e => console.warn('SW: precache incomplete', e))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// Fetch: API = network only; everything else = cache first, update in background
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/.netlify/') || url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request).catch(() =>
      new Response('{"error":"offline"}', { status: 503, headers: { 'Content-Type': 'application/json' } })
    ));
    return;
  }
  // Only same-scheme GETs are cacheable — browser extensions (chrome-extension://)
  // and other schemes throw on cache.put and just pollute the console.
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }
  // Book content changes with every deploy — network-first with forced
  // revalidation (bypasses stale HTTP caches); the cache is only the
  // offline fallback. Cache-first here once served an hour-old book.json
  // and "the comics are nowhere" (2026-07-08).
  const _u = new URL(event.request.url);
  if (_u.origin === location.origin && _u.pathname.startsWith('/content/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' }).then(r => {
        if (r.ok) { const c = r.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, c)); }
        return r;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => {
      const net = fetch(event.request).then(r => {
        if (r.ok && r.type === 'basic') { const c = r.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, c)); }
        return r;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
