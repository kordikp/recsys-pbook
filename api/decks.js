// Třídní úložiště slajdů (SlAIdy decků) — sdílené mezi p-bookem a SlAIdy.
// SlAIdy je jen frontend: deck si natáhne z URL (?deck=<url>) a ukládá ho tam
// zpátky PUTem. Tohle je jedna implementace toho protokolu (Supabase přes
// Vercel); na univerzitě jde totéž postavit nad GitLabem — protokol je jen
// „GET vrátí bundle, PUT ho uloží".
//
// Event-sourced v tabulce `interactions` (vzor drafts):
//   deck_saved   {book, id, group, title, author, rev, n, deck}
//   deck_deleted {book, id}
// Poslední revize vyhrává; historie revizí zůstává (nic se neztrácí).
//
// GET  ?group=<kód>            → {ok, items:[{id,title,author,rev,at,n}]}
// GET  ?id=<id>                → SYROVÝ deck JSON (přímo použitelné jako ?deck= URL pro SlAIdy)
// GET  ?id=<id>&meta=1         → {ok, id, group, title, rev, at}
// PUT  ?id=<id>  (tělo = deck) → {ok, id, rev}   (uloží novou revizi; SlAIdy save-back)
// POST {action:'save', group, id?, title?, author?, deck} → {ok, id, rev, url}
// POST {action:'delete', id}   → {ok}
// Bez PII; id náhodné, skupina = třídní kód ^[a-z0-9-]{4,16}$. Limit ~1,8 MB.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function sb(method, path, body) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    method,
    headers: {
      'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=minimal' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === 'GET') return res.json();
  return { ok: res.ok, status: res.status };
}

const bookOf = req => String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
const rid = () => 'd' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
const GROUP_RX = /^[a-z0-9-]{4,16}$/;
const ID_RX = /^[\w]{6,24}$/;

async function latestSaved(id) {
  const rows = await sb('GET',
    `interactions?event=eq.deck_saved&data->>id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=1&select=created_at,data`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
async function isDeleted(id, since) {
  const rows = await sb('GET',
    `interactions?event=eq.deck_deleted&data->>id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=1&select=created_at`);
  const del = Array.isArray(rows) && rows[0] ? rows[0].created_at : null;
  return del && (!since || del > since);
}

function readBody(req) {
  // Vercel parsuje JSON body u POST; u PUT s raw deckem radši načteme stream.
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') { try { return Promise.resolve(JSON.parse(req.body)); } catch (e) { return Promise.resolve(null); } }
  return new Promise(resolve => {
    let buf = '';
    req.on('data', c => { buf += c; if (buf.length > 2200000) { resolve(null); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(buf)); } catch (e) { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

const deckStats = deck => ({
  n: Array.isArray(deck?.slides) ? deck.slides.length : 0,
  title: String(deck?.title || '').slice(0, 140),
});

async function saveRev({ book, id, group, title, author, deck, rev }) {
  const s = deckStats(deck);
  const clean = {
    book, id, group,
    title: (String(title || '') || s.title || 'Prezentace').slice(0, 140),
    author: String(author || '').slice(0, 40),
    rev, n: s.n, deck,
  };
  if (JSON.stringify(clean).length > 1900000) return { ok: false, status: 413, error: 'deck too large (max ~1.8 MB)' };
  const r = await sb('POST', 'interactions', { user_id: 'deck:' + id, type: 'deck', event: 'deck_saved', data: clean, server_ts: Date.now() });
  return r.ok ? { ok: true } : { ok: false, status: 500, error: 'insert failed' };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ ok: false, error: 'Supabase not configured' });
  const book = bookOf(req);

  try {
    if (req.method === 'GET') {
      const group = String(req.query?.group || '').toLowerCase().slice(0, 16);
      if (group) {
        if (!GROUP_RX.test(group)) return res.status(400).json({ ok: false, error: 'bad group' });
        const rows = await sb('GET',
          `interactions?event=in.(deck_saved,deck_deleted)&data->>group=eq.${encodeURIComponent(group)}`
          + `&order=created_at.asc&limit=1000`
          + `&select=event,created_at,id:data->>id,title:data->>title,author:data->>author,rev:data->>rev,n:data->>n,b:data->>book`);
        const items = {};
        for (const r of Array.isArray(rows) ? rows : []) {
          if (r.b && r.b !== book) continue;
          if (r.event === 'deck_saved') items[r.id] = { id: r.id, title: r.title, author: r.author || '', rev: +r.rev || 1, n: +r.n || 0, at: r.created_at };
          if (r.event === 'deck_deleted') delete items[r.id];
        }
        // smazání eventy bez group (delete zná jen id) — dočisti druhým dotazem
        const dels = await sb('GET', `interactions?event=eq.deck_deleted&order=created_at.asc&limit=1000&select=created_at,id:data->>id`);
        for (const d of Array.isArray(dels) ? dels : []) if (items[d.id] && d.created_at > items[d.id].at) delete items[d.id];
        return res.status(200).json({ ok: true, group, items: Object.values(items) });
      }
      const id = String(req.query?.id || '').slice(0, 24);
      if (!ID_RX.test(id)) return res.status(400).json({ ok: false, error: 'group or id required' });
      const row = await latestSaved(id);
      if (!row || await isDeleted(id, row.created_at)) return res.status(404).json({ ok: false, error: 'not found' });
      if (req.query?.meta) {
        const d = row.data;
        return res.status(200).json({ ok: true, id, group: d.group, title: d.title, author: d.author || '', rev: d.rev, n: d.n, at: row.created_at });
      }
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(row.data.deck);   // syrový bundle — SlAIdy ho čte přímo
    }

    if (req.method === 'PUT') {
      const id = String(req.query?.id || '').slice(0, 24);
      if (!ID_RX.test(id)) return res.status(400).json({ ok: false, error: 'id required' });
      const prev = await latestSaved(id);
      if (!prev || await isDeleted(id, prev.created_at)) return res.status(404).json({ ok: false, error: 'not found — create with POST save first' });
      const deck = await readBody(req);
      if (!deck || !Array.isArray(deck.slides)) return res.status(400).json({ ok: false, error: 'body must be a deck bundle' });
      const p = prev.data;
      const out = await saveRev({ book: p.book || book, id, group: p.group, title: deck.title || p.title, author: p.author, deck, rev: (+p.rev || 1) + 1 });
      if (!out.ok) return res.status(out.status).json({ ok: false, error: out.error });
      return res.status(200).json({ ok: true, id, rev: (+p.rev || 1) + 1 });
    }

    if (req.method === 'POST') {
      const b = await readBody(req);
      if (!b) return res.status(400).json({ ok: false, error: 'bad json' });
      if (b.action === 'save') {
        const group = String(b.group || '').toLowerCase().slice(0, 16);
        if (!GROUP_RX.test(group)) return res.status(400).json({ ok: false, error: 'bad group (kód třídy: 4–16 znaků a-z 0-9 -)' });
        if (!b.deck || !Array.isArray(b.deck.slides)) return res.status(400).json({ ok: false, error: 'deck bundle required' });
        let id = String(b.id || '').slice(0, 24);
        let rev = 1;
        if (id) {
          if (!ID_RX.test(id)) return res.status(400).json({ ok: false, error: 'bad id' });
          const prev = await latestSaved(id);
          if (prev && !(await isDeleted(id, prev.created_at))) rev = (+prev.data.rev || 1) + 1;
        } else id = rid();
        const out = await saveRev({ book, id, group, title: b.title || b.deck.title, author: b.author, deck: b.deck, rev });
        if (!out.ok) return res.status(out.status).json({ ok: false, error: out.error });
        return res.status(200).json({ ok: true, id, rev, url: `/api/decks?id=${id}` });
      }
      if (b.action === 'delete') {
        const id = String(b.id || '').slice(0, 24);
        if (!ID_RX.test(id)) return res.status(400).json({ ok: false, error: 'id required' });
        const r = await sb('POST', 'interactions', { user_id: 'deck:' + id, type: 'deck', event: 'deck_deleted', data: { book, id }, server_ts: Date.now() });
        return res.status(r.ok ? 200 : 500).json(r.ok ? { ok: true } : { ok: false, error: 'insert failed' });
      }
      return res.status(400).json({ ok: false, error: 'unknown action' });
    }

    return res.status(405).json({ ok: false, error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
