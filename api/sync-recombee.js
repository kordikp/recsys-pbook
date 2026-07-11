// Vercel serverless function — syncs content items to Recombee
// POST /api/sync-recombee with { secret: "..." }
// Reads content files from GitHub raw, imports to Recombee

const crypto = require('crypto');

const DB = process.env.RECOMBEE_DB || 'cvachond-land-free-pbook';
const TOKEN = process.env.RECOMBEE_TOKEN || '';
const REGION = process.env.RECOMBEE_REGION || 'rapi-eu-west';
const SYNC_SECRET = process.env.SYNC_SECRET || '';
const GITHUB_REPO = 'kordikp/recsys-pbook';
const GITHUB_BRANCH = 'main';

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
      val = val.slice(1, -1);
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Auth check
  const { secret } = req.body || {};
  if (SYNC_SECRET && secret !== SYNC_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  if (!TOKEN) return res.status(500).json({ error: 'RECOMBEE_TOKEN not configured' });

  try {
    // Fetch book.json from GitHub
    const bookUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/content/book.json`;
    const bookRes = await fetch(bookUrl);
    if (!bookRes.ok) return res.status(502).json({ error: 'Failed to fetch book.json from GitHub' });
    const bookJson = await bookRes.json();

    // Ensure item properties exist
    const properties = {
      type: 'string', title: 'string', teaser: 'string', voice: 'string',
      readingTime: 'int', core: 'boolean', standalone: 'boolean',
      chapter: 'string', chapterNum: 'int', wordCount: 'int', publishedAt: 'timestamp', searchText: 'string',
      // Facet system + community layer (see _design-collective-pbook.md §2, §6)
      concept: 'string', state: 'string', lens: 'string', visuality: 'string',
      depth: 'string', formalism: 'string', lengthBand: 'string', genre: 'string', carriers: 'string',
      body: 'string', sharedAs: 'string', sharedAt: 'timestamp', recallQ: 'string', recallA: 'string',
      remixOf: 'string', remixLog: 'string', diagramSvg: 'string', lang: 'string',
      adoptedAt: 'timestamp', action: 'string',
    };
    for (const [name, type] of Object.entries(properties)) {
      await recombeeApi('PUT', `/items/properties/${name}?type=${type}`);
    }

    // USER properties — the client writes these via setUserProperties; Recombee
    // returns 404 "user property X does not exist" until they are defined
    // (this was the mystery 404 of 2026-07-07)
    const userProperties = {
      voice: 'string', level: 'int', xp: 'int',
      prefLens: 'string', prefLang: 'string', prefLengthBand: 'string',
      prefVisuality: 'string', prefDepth: 'string', prefCarriers: 'string',
      prefFormalism: 'string', prefGenre: 'string',
      goal: 'string', readerMode: 'string',
    };
    for (const [name, type] of Object.entries(userProperties)) {
      await recombeeApi('PUT', `/users/properties/${name}?type=${type}`);
    }

    // Fetch and parse all content files
    const items = [];
    for (const chapter of bookJson.chapters) {
      for (const file of chapter.files) {
        try {
          const fileUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/content/${chapter.directory}/${file}`;
          const fileRes = await fetch(fileUrl);
          if (!fileRes.ok) continue;
          const text = await fileRes.text();
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
              lang: meta.lang || 'en',
              '!cascadeCreate': true,
            }
          });
        } catch (e) { /* skip file on error */ }
      }
    }

    // Batch import
    let imported = 0, errors = 0;
    const BATCH_SIZE = 50;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      const requests = chunk.map(item => ({
        method: 'POST',
        path: `/items/${item.itemId}`,
        params: item.values,
      }));
      try {
        const results = await recombeeBatch(requests);
        imported += results.filter(r => r.code === 200 || r.code === 201).length;
        errors += results.filter(r => r.code >= 400).length;
      } catch (e) {
        errors += chunk.length;
      }
    }

    return res.status(200).json({
      ok: true,
      imported,
      errors,
      total: items.length,
      message: `Synced ${imported}/${items.length} items to Recombee`
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
