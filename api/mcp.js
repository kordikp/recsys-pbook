// Vercel function — a read-only MCP server over the book's own public files, so AI
// agents can search, read and cite the book without scraping the single-page app.
//
// Transport: MCP Streamable HTTP, stateless, JSON responses (no SSE, no sessions).
//   POST /api/mcp   JSON-RPC 2.0 (single message or batch)
//   GET  /api/mcp   405 + a short description (there is no server-initiated stream)
//
// It reads only static files of the SAME deployment — from the function bundle when
// they are included, else over HTTP (never the reader log, never any store): /pbook.json, /content/book.json, /content/concepts.json,
// /kb/index.json (built by scripts/build-kb.js) and the datasets the book declares
// in pbook.json → "datasets": [{ name, url, description }]. Zero dependencies.

const SERVER_VERSION = '1.0.0';
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const TTL = 5 * 60 * 1000;
const cache = new Map();   // url → { at, data }

function origin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = /^(localhost|127\.|0\.0\.0\.0)/.test(host) ? 'http' : 'https';
  return `${proto}://${host}`;
}

// Files bundled with the function (vercel.json → functions → includeFiles) are read
// from disk: no self-request, so it also works behind deployment protection.
const fs = require('fs');
const nodePath = require('path');
function readLocal(path, as) {
  const rel = String(path).split('?')[0].replace(/^\/+/, '');
  if (!rel || rel.includes('..')) return undefined;
  for (const base of [process.cwd(), nodePath.join(__dirname, '..')]) {
    const f = nodePath.join(base, rel);
    try { if (fs.statSync(f).isFile()) { const t = fs.readFileSync(f, 'utf8'); return as === 'json' ? JSON.parse(t) : t; } } catch (e) {}
  }
  return undefined;
}

async function getFile(req, path, as = 'json') {
  const url = origin(req) + path;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const local = readLocal(path, as);
  if (local !== undefined) { cache.set(url, { at: Date.now(), data: local }); return local; }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    const data = as === 'json' ? await r.json() : await r.text();
    cache.set(url, { at: Date.now(), data });
    return data;
  } finally { clearTimeout(t); }
}

async function loadBook(req) {
  const [manifest, index] = await Promise.all([
    getFile(req, '/pbook.json').catch(() => ({})),
    getFile(req, '/kb/index.json').catch(() => null),
  ]);
  let kb = index;
  if (!kb) {   // a book without the static layer still answers from concepts.json
    const [book, concepts] = await Promise.all([
      getFile(req, '/content/book.json').catch(() => ({ chapters: [] })),
      getFile(req, '/content/concepts.json').catch(() => ({ concepts: [] })),
    ]);
    kb = {
      chapters: (book.chapters || []).map(c => ({ id: c.id, title: c.title, subtitle: c.subtitle })),
      blocks: (concepts.concepts || []).map(c => ({
        id: c.anchor, concept: c.id, title: c.title, recallQ: c.contract?.recallQ, recallA: c.contract?.recallA,
        text: [c.contract?.objective, ...(c.contract?.mustCover || []).map(m => m.point)].filter(Boolean).join(' '),
        chapter: c.chapter, path: c.anchorPath ? `content/${c.anchorPath}` : null,
      })),
    };
  }
  return { manifest, kb };
}

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const terms = q => norm(q).split(/[^a-z0-9]+/).filter(w => w.length > 1);

function snippet(text, ts, len = 320) {
  const t = String(text || '');
  const n = norm(t);
  let at = -1;
  for (const w of ts) { const i = n.indexOf(w); if (i >= 0 && (at < 0 || i < at)) at = i; }
  const start = Math.max(0, at - 80);
  return (start > 0 ? '…' : '') + t.slice(start, start + len).replace(/\s+/g, ' ').trim() + (t.length > start + len ? '…' : '');
}

function links(req, b) {
  const o = origin(req);
  return {
    page: b.kb ? o + b.kb : (b.concept ? `${o}/kb/${b.concept}` : null),
    app: b.concept ? `${o}/#c/${b.concept}` : `${o}/#${b.id}`,
    markdown: b.path ? `${o}/${b.path}` : null,
  };
}

// ---------------------------------------------------------------- tools
const TOOLS = [
  {
    name: 'search',
    title: 'Search the book',
    description: 'Full-text search over every published section of this book (titles, recall questions, highlights, body). Returns ranked sections with a snippet and links to the static page, the interactive book and the raw markdown. Use get_concept for the full text.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to look for, in the language of the book' },
        limit: { type: 'integer', minimum: 1, maximum: 20, default: 8 },
        chapter: { type: 'string', description: 'Optional chapter id from list_chapters' },
        lang: { type: 'string', description: 'Optional language code, e.g. en or cs' },
      },
      required: ['query'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_concept',
    title: 'Read a concept',
    description: 'The full anchor text of one concept (idea) with its contract: the recall question a reader must be able to answer, the expected answer, highlights, sources and links; plus the list of other tellings (other languages, regions, depths).',
    inputSchema: { type: 'object', properties: { slug: { type: 'string', description: 'Concept slug, e.g. from search or list_chapters' } }, required: ['slug'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_block',
    title: 'Read one section',
    description: 'Raw markdown (with YAML front matter) of one section by its block id.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'list_chapters',
    title: 'Table of contents',
    description: 'Chapters in reading order with the concepts each one teaches.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'list_datasets',
    title: 'Open datasets',
    description: 'Open datasets published with this book (name, description, URL, row count when known).',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'query_dataset',
    title: 'Query an open dataset',
    description: 'Rows of one dataset from list_datasets, optionally filtered by words that must all appear in the row. GeoJSON datasets return feature properties plus coordinates.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        query: { type: 'string', description: 'Optional words that must all appear in a row' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
      },
      required: ['name'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

async function callTool(req, name, args = {}) {
  const { manifest, kb } = await loadBook(req);
  const blocks = kb.blocks || [];
  if (name === 'search') {
    const ts = terms(args.query);
    if (!ts.length) throw new Error('query needs at least one word');
    const limit = Math.min(20, Math.max(1, parseInt(args.limit, 10) || 8));
    const scored = [];
    for (const b of blocks) {
      if (args.chapter && b.chapter !== args.chapter) continue;
      if (args.lang && (b.lang || 'en') !== args.lang) continue;
      const fields = [[b.title, 5], [b.conceptTitle, 4], [b.recallQ, 3], [b.teaser, 2], [(b.highlights || []).join(' '), 2], [b.recallA, 2], [b.text, 1]];
      let score = 0, hits = 0;
      for (const w of ts) {
        let wHit = false;
        for (const [f, wgt] of fields) {
          const n = norm(f);
          if (!n) continue;
          const c = n.split(w).length - 1;
          if (c) { score += wgt * Math.min(c, 5); wHit = true; }
        }
        if (wHit) hits++;
      }
      if (!score) continue;
      score *= hits / ts.length;                       // all words matter
      if (b.anchor) score *= 1.15;                     // the main telling first
      scored.push({ b, score });
    }
    scored.sort((x, y) => y.score - x.score);
    return {
      query: args.query,
      results: scored.slice(0, limit).map(({ b, score }) => ({
        id: b.id, concept: b.concept, title: b.title, chapter: b.chapter, lang: b.lang || 'en', lens: b.lens,
        score: Math.round(score * 10) / 10, snippet: snippet(b.text || b.teaser, ts), recallQ: b.recallQ, links: links(req, b),
      })),
    };
  }
  if (name === 'get_concept') {
    const slug = String(args.slug || '').trim();
    const tellings = blocks.filter(b => b.concept === slug);
    if (!tellings.length) throw new Error(`unknown concept "${slug}" — use search or list_chapters`);
    const anchor = tellings.find(b => b.anchor) || tellings[0];
    let markdown = null;
    if (anchor.path) markdown = await getFile(req, '/' + anchor.path, 'text').catch(() => null);
    return {
      concept: slug, title: anchor.conceptTitle || anchor.title, chapter: anchor.chapter,
      recallQ: anchor.recallQ, recallA: anchor.recallA, highlights: anchor.highlights || [],
      parents: anchor.parents || [], sources: anchor.sources || [], links: links(req, anchor),
      markdown: markdown ? markdown.replace(/^---\n[\s\S]*?\n---\n?/, '').trim() : anchor.text,
      tellings: tellings.map(b => ({ id: b.id, title: b.title, type: b.type, lang: b.lang || 'en', lens: b.lens, depth: b.depth, genre: b.genre, links: links(req, b) })),
      license: manifest.license || null,
    };
  }
  if (name === 'get_block') {
    const b = blocks.find(x => x.id === String(args.id || ''));
    if (!b) throw new Error(`unknown block "${args.id}"`);
    const md = b.path ? await getFile(req, '/' + b.path, 'text').catch(() => null) : null;
    return { id: b.id, concept: b.concept, links: links(req, b), markdown: md || b.text };
  }
  if (name === 'list_chapters') {
    return {
      book: { title: manifest.title, subtitle: manifest.subtitle, author: manifest.author, license: manifest.license, url: origin(req) + '/' },
      chapters: (kb.chapters || []).map(c => {
        const anchors = blocks.filter(b => b.chapter === c.id && b.anchor);
        return { id: c.id, title: c.title, subtitle: c.subtitle, concepts: anchors.map(b => ({ slug: b.concept, title: b.conceptTitle || b.title, recallQ: b.recallQ })) };
      }),
    };
  }
  const datasets = Array.isArray(manifest.datasets) ? manifest.datasets : [];
  if (name === 'list_datasets') {
    return { datasets: datasets.map(d => ({ name: d.name, description: d.description, url: d.url && d.url.startsWith('/') ? origin(req) + d.url : d.url, rows: d.rows, license: d.license, attribution: d.attribution })) };
  }
  if (name === 'query_dataset') {
    const d = datasets.find(x => x.name === args.name);
    if (!d) throw new Error(`unknown dataset "${args.name}" — see list_datasets`);
    if (!d.url || !d.url.startsWith('/')) throw new Error('only datasets of this deployment can be queried');
    const data = await getFile(req, d.url);
    let rows = Array.isArray(data) ? data : Array.isArray(data.features)
      ? data.features.map(f => ({ ...f.properties, coordinates: f.geometry?.coordinates }))
      : Array.isArray(data.rows) ? data.rows : [];
    const ts = terms(args.query || '');
    if (ts.length) rows = rows.filter(r => { const n = norm(JSON.stringify(r)); return ts.every(w => n.includes(w)); });
    const limit = Math.min(100, Math.max(1, parseInt(args.limit, 10) || 25));
    return { dataset: d.name, total: rows.length, rows: rows.slice(0, limit), attribution: d.attribution, license: d.license };
  }
  throw Object.assign(new Error(`unknown tool "${name}"`), { code: -32602 });
}

// ---------------------------------------------------------------- JSON-RPC
async function handle(req, msg) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return { jsonrpc: '2.0', id: msg?.id ?? null, error: { code: -32600, message: 'invalid request' } };
  }
  const { id, method, params = {} } = msg;
  if (id === undefined) return null;   // notification: nothing to answer
  const ok = result => ({ jsonrpc: '2.0', id, result });
  try {
    if (method === 'initialize') {
      const { manifest } = await loadBook(req);
      const v = PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0];
      return ok({
        protocolVersion: v,
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
        serverInfo: { name: 'pbook', title: manifest.title || 'p-book', version: SERVER_VERSION },
        instructions: `Read-only access to the interactive book "${manifest.title || 'p-book'}"${manifest.subtitle ? ` — ${manifest.subtitle}` : ''}. `
          + 'Start with list_chapters or search; read with get_concept. Every concept has a recall question and the answer an expert accepts; '
          + 'cite the static page link (links.page) and the sources listed in the text. '
          + (manifest.license ? `Content license: ${manifest.license}.` : ''),
      });
    }
    if (method === 'ping') return ok({});
    if (method === 'tools/list') return ok({ tools: TOOLS });
    if (method === 'tools/call') {
      try {
        const data = await callTool(req, params.name, params.arguments || {});
        return ok({ content: [{ type: 'text', text: JSON.stringify(data, null, 1) }], structuredContent: data, isError: false });
      } catch (e) {
        if (e.code === -32602) throw e;
        return ok({ content: [{ type: 'text', text: String(e.message || e) }], isError: true });
      }
    }
    if (method === 'resources/list') {
      const { manifest } = await loadBook(req);
      const o = origin(req);
      const res = [
        { uri: `${o}/llms.txt`, name: 'llms.txt', title: 'Book index for language models', mimeType: 'text/plain' },
        { uri: `${o}/llms-full.txt`, name: 'llms-full.txt', title: 'The whole book as one text', mimeType: 'text/plain' },
        { uri: `${o}/content/book.json`, name: 'book.json', title: 'Chapters and files', mimeType: 'application/json' },
        { uri: `${o}/content/concepts.json`, name: 'concepts.json', title: 'Concepts and their contracts', mimeType: 'application/json' },
      ];
      for (const d of manifest.datasets || []) if (d.url && d.url.startsWith('/')) res.push({ uri: o + d.url, name: d.name, title: d.description, mimeType: /json$/.test(d.url) ? 'application/json' : 'text/plain' });
      return ok({ resources: res });
    }
    if (method === 'resources/read') {
      const o = origin(req);
      const uri = String(params.uri || '');
      if (!uri.startsWith(o + '/')) return { jsonrpc: '2.0', id, error: { code: -32002, message: 'resource not found' } };
      const text = await getFile(req, uri.slice(o.length), 'text');
      return ok({ contents: [{ uri, mimeType: /\.json$/.test(uri) ? 'application/json' : 'text/plain', text: text.slice(0, 400000) }] });
    }
    if (method === 'prompts/list') return ok({ prompts: [] });
    return { jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } };
  } catch (e) {
    return { jsonrpc: '2.0', id, error: { code: e.code || -32603, message: String(e.message || e) } };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({
      server: 'p-book MCP (read-only, stateless, Streamable HTTP with JSON responses)',
      usage: 'POST JSON-RPC 2.0 to this URL. Tools: ' + TOOLS.map(t => t.name).join(', '),
      example: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search', arguments: { query: 'regional action plan' } } },
    });
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body) return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } });
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(m => handle(req, m)))).filter(Boolean);
    return out.length ? res.status(200).json(out) : res.status(202).end();
  }
  const out = await handle(req, body);
  if (!out) return res.status(202).end();
  return res.status(200).json(out);
};
