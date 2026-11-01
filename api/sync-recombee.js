// Vercel serverless function — syncs content items to Recombee
// POST /api/sync-recombee with { secret: "..." }
// Reads the book from the deployment itself (book.json + the content bundle built at deploy
// time), so it works for every book and for private repos; imports to Recombee.
// PBOOK_CONTENT_BASE overrides where the content is read from (e.g. the production URL).

const crypto = require('crypto');

const DB = process.env.RECOMBEE_DB || 'cvachond-land-free-pbook';
const TOKEN = process.env.RECOMBEE_TOKEN || '';
const REGION = process.env.RECOMBEE_REGION || 'rapi-eu-west';
const SYNC_SECRET = process.env.SYNC_SECRET || '';

function contentBase(req) {
  if (process.env.PBOOK_CONTENT_BASE) return process.env.PBOOK_CONTENT_BASE.replace(/\/+$/, '');
  const host = String(req.headers.host || '');
  return (/^(localhost|127\.)/.test(host) ? 'http://' : 'https://') + host;
}

function signUrl(p) {
  const ts = Math.floor(Date.now() / 1000);
  const sep = p.includes('?') ? '&' : '?';
  const withTs = p + sep + 'hmac_timestamp=' + ts;
  return withTs + '&hmac_sign=' + crypto.createHmac('sha1', TOKEN).update(withTs).digest('hex');
}

async function recombeeApi(method, endpoint, body) {
  const url = `https://${REGION}.recombee.com${signUrl('/' + DB + endpoint)}`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return { status: res.status, ok: res.ok || res.status === 409 };
}

function sameSecret(a, b) {
  if (!a || typeof b !== 'string') return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Item properties: the facet vector is the recommender's item features (_design-collective-pbook.md §2, §6)
const ITEM_PROPERTIES = {
  type: 'string', title: 'string', teaser: 'string', voice: 'string',
  readingTime: 'int', core: 'boolean', standalone: 'boolean',
  chapter: 'string', chapterNum: 'int', wordCount: 'int', publishedAt: 'timestamp', searchText: 'string',
  concept: 'string', state: 'string', lens: 'string', visuality: 'string',
  depth: 'string', formalism: 'string', lengthBand: 'string', genre: 'string', carriers: 'string',
  body: 'string', sharedAs: 'string', sharedAt: 'timestamp', recallQ: 'string', recallA: 'string',
  remixOf: 'string', remixLog: 'string', diagramSvg: 'string', lang: 'string',
  adoptedAt: 'timestamp', action: 'string', translationOf: 'string', classGroup: 'string',
};
// User properties: everything js/app.js and js/recombee.js write with setUserProperties. Recombee
// answers 404 "user property X does not exist" until it is defined (the mystery 404 of 2026-07-07).
const USER_PROPERTIES = {
  voice: 'string', level: 'int', xp: 'int',
  prefLens: 'string', prefLang: 'string', prefLengthBand: 'string',
  prefVisuality: 'string', prefDepth: 'string', prefCarriers: 'string',
  prefFormalism: 'string', prefGenre: 'string',
  goal: 'string', readerMode: 'string',
  readCount: 'int', readPct: 'double', coreRead: 'int', coreTotal: 'int', sessions: 'int',
  completedMissions: 'int', activePath: 'string', lang: 'string', abArm: 'string', classCode: 'string',
};
// Segmentations behind the segment scenarios (SCENARIOS.md): a concept, a chapter (theme) and an
// example world are each a segment of the items that carry that value.
const SEGMENTATIONS = {
  concept: { propertyName: 'concept', title: 'Concept', description: 'All tellings of one concept (every language)' },
  chapter: { propertyName: 'chapter', title: 'Chapter (theme)', description: 'Sections of one chapter' },
  lens: { propertyName: 'lens', title: 'Example world', description: 'Tellings with examples from one world (generic = for everyone)' },
};

async function recombeeBatch(requests) {
  const url = `https://${REGION}.recombee.com${signUrl('/' + DB + '/batch/')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests })
  });
  if (!res.ok) throw new Error(`Batch failed: ${res.status}`);
  return await res.json();
}

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const meta = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*)\s*:\s*(.*)/);
    if (!kv) continue;
    let val = kv[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");   // = js/markdown.js cleanVal
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (val === 'null') val = null;
    else if (/^\d+$/.test(val)) val = parseInt(val);
    meta[kv[1].trim()] = val;
  }
  const body = (text.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/) || [,''])[1].trim();
  meta._wordCount = body.split(/\s+/).length;
  const headings = (body.match(/^#{1,3}\s+(.+)$/gm) || []).map(h => h.replace(/^#+\s+/, '')).join('. ');
  const boldTerms = (body.match(/\*\*([^*]+)\*\*/g) || []).map(b => b.replace(/\*\*/g, '')).join(', ');
  const plain = body.replace(/[#*_\[\]|>`~]/g, '').replace(/\(http[^)]+\)/g, '').substring(0, 600);
  meta._searchText = `${headings}. ${boldTerms}. ${plain}`;
  return meta;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Pbook-Admin');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Editors only, when the deployment has a secret or an editor key: SYNC_SECRET in the body,
  // or the editor key (PBOOK_ADMIN_KEY) in the X-Pbook-Admin header.
  const { secret } = req.body || {};
  const ADMIN_KEY = process.env.PBOOK_ADMIN_KEY || '';
  const okSecret = sameSecret(SYNC_SECRET, secret), okKey = sameSecret(ADMIN_KEY, req.headers['x-pbook-admin']);
  if ((SYNC_SECRET || ADMIN_KEY) && !okSecret && !okKey) {
    return res.status(401).json({ error: 'Invalid secret (or editor key)' });
  }

  if (!TOKEN) return res.status(500).json({ error: 'RECOMBEE_TOKEN not configured' });

  try {
    const base = contentBase(req);
    const bookRes = await fetch(`${base}/content/book.json`);
    if (!bookRes.ok) return res.status(502).json({ error: `Failed to fetch ${base}/content/book.json (${bookRes.status})` });
    const bookJson = await bookRes.json();
    // Every file from the bundles: bundle.<lang>.json carries its language in full and the other
    // languages as stubs (id, lang, concept… no type or title), so merge them, full beating stub.
    // The languages come from the files themselves (a stub keeps its lang).
    const bundled = {};
    const stub = text => /\nbundleStub: true\n/.test(text);
    const tried = new Set(), queue = ['en', 'cs'];
    while (queue.length) {
      const l = queue.shift();
      if (tried.has(l) || !/^[a-z]{2,3}$/.test(l)) continue;
      tried.add(l);
      const r = await fetch(`${base}/content/bundle.${l}.json`).catch(() => null);
      if (!r || !r.ok) continue;
      for (const [k, text] of Object.entries((await r.json()).files || {})) {
        if (typeof text !== 'string') continue;
        if (bundled[k] === undefined || !stub(text)) bundled[k] = text;
        const m = /\nlang:\s*([\w|]+)/.exec(text.slice(0, 600));
        if (m) for (const x of m[1].split('|')) if (!tried.has(x)) queue.push(x);
      }
    }

    // Properties (items AND users) in one batch each; 409 = already defined
    const defs = async (kind, props) => {
      const out = await recombeeBatch(Object.entries(props).map(([name, type]) => ({ method: 'PUT', path: `/${kind}/properties/${name}`, params: { type } })));
      return out.filter(r => r.code >= 400 && r.code !== 409).length;
    };
    const propErrors = await defs('items', ITEM_PROPERTIES) + await defs('users', USER_PROPERTIES);
    // Segmentations: PUT creates, 409 = exists (then POST updates the title and description)
    const segmentations = {};
    for (const [id, def] of Object.entries(SEGMENTATIONS)) {
      let r = await recombeeApi('PUT', `/segmentations/property-based/${id}`, { sourceType: 'items', ...def });
      if (r.status === 409) r = await recombeeApi('POST', `/segmentations/property-based/${id}`, { title: def.title, description: def.description });
      segmentations[id] = r.status;
    }

    // Fetch and parse all content files
    const bookLang = String(bookJson.lang || process.env.PBOOK_LANG || 'en');
    const items = [];
    for (const chapter of bookJson.chapters) {
      for (const file of chapter.files) {
        try {
          let text = bundled[`${chapter.directory}/${file}`];
          if (text === undefined || stub(text)) {
            const fileRes = await fetch(`${base}/content/${chapter.directory}/${file}`);
            if (!fileRes.ok) continue;
            text = await fileRes.text();
          }
          const meta = parseFrontmatter(text);
          if (!meta || !meta.id) continue;
          if (meta.status && meta.status !== 'accepted') continue; // skip non-accepted

          items.push({
            itemId: meta.id,
            values: {
              type: meta.type || 'spine',
              title: meta.title || file,
              teaser: (meta.teaser || '').substring(0, 500),
              voice: meta.voice || 'universal',
              readingTime: meta.readingTime || 3,
              core: meta.core === true,
              standalone: meta.standalone !== false,
              chapter: chapter.id,
              chapterNum: chapter.number,
              wordCount: meta._wordCount || 0,
              searchText: (meta._searchText || '').substring(0, 2000),
              publishedAt: meta.publishedAt ? new Date(meta.publishedAt).toISOString() : null,
              // Facet-vector as item features — the recommender learns per-facet affinities
              concept: meta.concept || null,
              state: meta.state || 'edited',
              lens: meta.lens || 'generic',
              visuality: meta.visuality || 'text-first',
              depth: meta.depth || 'standard',
              formalism: meta.formalism || 'none',
              lengthBand: meta.lengthBand || 'standard', carriers: meta.carriers || 'prose',
              genre: meta.genre || null,
              lang: meta.lang || bookLang,
              translationOf: meta.translationOf || null,
              '!cascadeCreate': true,
            }
          });
        } catch (e) { /* skip file on error */ }
      }
    }

    // Batch import: 200 items per request, 3 requests at a time (a 1554-item book in ~3 s)
    let imported = 0, errors = 0;
    const BATCH_SIZE = 200, PARALLEL = 3;
    const chunks = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) chunks.push(items.slice(i, i + BATCH_SIZE));
    for (let i = 0; i < chunks.length; i += PARALLEL) {
      await Promise.all(chunks.slice(i, i + PARALLEL).map(async chunk => {
        try {
          const results = await recombeeBatch(chunk.map(item => ({ method: 'POST', path: `/items/${item.itemId}`, params: item.values })));
          imported += results.filter(r => r.code === 200 || r.code === 201).length;
          errors += results.filter(r => r.code >= 400).length;
        } catch (e) {
          errors += chunk.length;
        }
      }));
    }

    return res.status(200).json({
      ok: true,
      imported,
      errors,
      total: items.length,
      propErrors,
      segmentations,
      message: `Synced ${imported}/${items.length} items to Recombee`
    });
  } catch (e) {
    console.error('sync-recombee', e);
    return res.status(500).json({ error: 'sync failed' });
  }
};
