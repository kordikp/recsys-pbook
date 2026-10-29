// Service Worker for p-book — offline support
// Bump CACHE_NAME on every release that changes the app shell: the activate
// step then drops the previous cache.
// Install keeps only the app shell (and the ES modules app.js imports). The book itself
// arrives from the page: once a visit has loaded, the engine posts the files it read
// (content/bundle.<lang>.json or every content file, games, the interface pack — app.js
// _offlineCopy) and they are stored here. Install used to download every content file
// a second time while the first visit was still loading them.
const CACHE_NAME = 'pbook-v84';

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

// The app shell: index.html and what it loads by itself (stylesheet, scripts, images — with their
// ?v= cache-busters, which a hand-kept list missed: offline the page asked for app.js?v=7.2.0 and
// the cache held /js/app.js), then the ES modules app.js imports.
async function precacheShell(cache) {
  const page = await precacheOne(cache, '/');
  let html = '';
  try { html = page ? await page.text() : ''; } catch (e) {}
  const own = new Set(['/index.html', '/favicon.svg']);
  for (const m of html.matchAll(/(?:href|src)="\/?(?!https?:|\/|data:|#)([^"]+\.(?:css|js|svg|png|webp)(?:\?[^"]*)?)"/g)) own.add('/' + m[1]);
  const res = {};
  await inBatches([...own], async u => { res[u] = await precacheOne(cache, u); });
  const app = Object.keys(res).find(u => u.startsWith('/js/app.js'));
  let appSrc = '';
  try { appSrc = app && res[app] ? await res[app].text() : ''; } catch (e) {}
  const mods = new Set();
  for (const m of appSrc.matchAll(/from\s+['"]\.\/([\w.-]+\.js(?:\?[\w=.&-]*)?)['"]/g)) mods.add('/js/' + m[1]);
  await inBatches([...mods], u => precacheOne(cache, u));
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(precacheShell)
      .catch(e => console.warn('SW: precache incomplete', e))
  );
  self.skipWaiting();
});

// The page's offline list: same-origin files this cache does not hold yet (a controlled
// visit has already stored what it fetched; the first visit's files come from the HTTP cache)
self.addEventListener('message', event => {
  if (event.data?.type !== 'precache' || !Array.isArray(event.data.urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const urls = event.data.urls.map(u => { try { return new URL(u, self.location.origin); } catch (e) { return null; } })
      .filter(u => u && u.origin === self.location.origin).map(u => u.pathname + u.search);
    await inBatches(urls, async u => { if (!(await cache.match(u))) await precacheOne(cache, u); }, 6);
  })());
});

// Activate: clean old caches. Replacing an older version also reloads the open pages:
// they still run the old app shell (served cache-first by the old worker) against the
// new content, which broke the 2026-10-27 release (old engine, new {cs, en, …} titles).
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const old = (await caches.keys()).filter(k => k !== CACHE_NAME);
    await Promise.all(old.map(k => caches.delete(k)));
    await self.clients.claim();
    if (!old.length) return;   // first install: nothing stale is running
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url).catch(() => {});
  })());
});

// The worker this one replaced may still be storing a response it fetched just before the
// switch, which re-creates its cache after activate dropped it: sweep once more a little later.
let _swept = false;
const sweepOld = () => caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))));

// Fetch: API = network only; everything else = cache first, update in background
self.addEventListener('fetch', event => {
  if (!_swept) { _swept = true; event.waitUntil(new Promise(r => setTimeout(r, 10000)).then(sweepOld)); }
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
  // Book content AND the app shell change with every deploy — network-first with
  // forced revalidation (bypasses stale HTTP caches); the cache is only the offline
  // fallback. Cache-first here once served an hour-old book.json and "the comics are
  // nowhere" (2026-07-08); a cached shell with fresh content showed new diagrams as
  // "Diagram: <id>" because the old js/diagrams.js did not know them (2026-10-19).
  const _u = new URL(event.request.url);
  const _shell = event.request.mode === 'navigate' || /^\/(content|js|css|games)\//.test(_u.pathname)
    || /\.(html|json|js|css)$/.test(_u.pathname) || _u.pathname === '/';
  if (_u.origin === location.origin && _shell) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' }).then(r => {
        if (r.ok) { const c = r.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, c)); }
        return r;
      }).catch(async () => (await caches.match(event.request))
        // offline on /?lang=sk or #… links: any page of the book is the same index.html
        || (event.request.mode === 'navigate' ? caches.match('/') : undefined))
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
