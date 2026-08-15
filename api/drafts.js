// Zpětná vazba na rozdělané drafty — „druhý pár očí" (feedback na snapshot,
// NE spolueditace: autor zůstává jediný, kdo píše; pomocník jen komentuje).
//
// Event-sourced v existující Supabase tabulce `interactions` (vzor proposals):
//   draft_shared  {book, id, slug, title, text, nick}   — snapshot ke zpětné vazbě
//   draft_comment {book, id, kind, text, nick}          — kind: works|question|idea
//   draft_unshared {book, id}                           — autor sdílení stáhl
//
// POST {action:'share', draft:{slug,title,text}, nick}  → {ok, id}
// GET  ?id=<id>                                         → {ok, draft, comments:[…]}
// POST {action:'comment', id, kind, text, nick}         → {ok}
// POST {action:'unshare', id}                           → {ok}
// Bez PII: nick je volitelná přezdívka, id je náhodné — odkaz zná jen ten,
// komu ho autor pošle. Délkové limity proti zneužití.

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
const rid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ ok: false, error: 'Supabase not configured' });
  const book = bookOf(req);

  if (req.method === 'GET') {
    const id = String(req.query?.id || '').slice(0, 24);
    if (!/^[\w]{6,24}$/.test(id)) return res.status(400).json({ ok: false, error: 'id required' });
    try {
      const rows = await sb('GET',
        `interactions?event=in.(draft_shared,draft_comment,draft_unshared)&order=created_at.asc&limit=500&select=event,created_at,data`);
      let draft = null; const comments = []; let gone = false;
      for (const r of Array.isArray(rows) ? rows : []) {
        const d = r.data || {};
        if (d.id !== id || (d.book && d.book !== book)) continue;
        if (r.event === 'draft_shared') { draft = { ...d, sharedAt: r.created_at }; gone = false; }
        if (r.event === 'draft_comment') comments.push({ kind: d.kind, text: d.text, nick: d.nick || '', at: r.created_at });
        if (r.event === 'draft_unshared') gone = true;
      }
      if (!draft || gone) return res.status(404).json({ ok: false, error: 'not found' });
      return res.status(200).json({ ok: true, draft: { slug: draft.slug, title: draft.title, text: draft.text, nick: draft.nick || '' }, comments });
    } catch (e) { return res.status(500).json({ ok: false, error: String(e.message || e) }); }
  }

  if (req.method === 'POST') {
    try {
      const b = req.body || {};
      if (b.action === 'share') {
        const dr = b.draft || {};
        if (!dr.text || String(dr.text).trim().length < 40) return res.status(400).json({ ok: false, error: 'draft too short' });
        const id = rid();
        const clean = {
          book, id,
          slug: String(dr.slug || '').slice(0, 60),
          title: String(dr.title || '').slice(0, 120),
          text: String(dr.text).slice(0, 60000),
          nick: String(b.nick || '').slice(0, 30),
        };
        const r = await sb('POST', 'interactions', { user_id: 'draft:' + id, type: 'draft', event: 'draft_shared', data: clean, server_ts: Date.now() });
        return res.status(r.ok ? 200 : 500).json(r.ok ? { ok: true, id } : { ok: false, error: 'insert failed' });
      }
      if (b.action === 'comment') {
        const id = String(b.id || '').slice(0, 24);
        const kind = ['works', 'question', 'idea'].includes(b.kind) ? b.kind : 'idea';
        const text = String(b.text || '').trim().slice(0, 600);
        if (!/^[\w]{6,24}$/.test(id) || text.length < 2) return res.status(400).json({ ok: false, error: 'id and text required' });
        const r = await sb('POST', 'interactions', {
          user_id: 'draft:' + id, type: 'draft', event: 'draft_comment',
          data: { book, id, kind, text, nick: String(b.nick || '').slice(0, 30) }, server_ts: Date.now(),
        });
        return res.status(r.ok ? 200 : 500).json(r.ok ? { ok: true } : { ok: false, error: 'insert failed' });
      }
      if (b.action === 'unshare') {
        const id = String(b.id || '').slice(0, 24);
        if (!/^[\w]{6,24}$/.test(id)) return res.status(400).json({ ok: false, error: 'id required' });
        const r = await sb('POST', 'interactions', { user_id: 'draft:' + id, type: 'draft', event: 'draft_unshared', data: { book, id }, server_ts: Date.now() });
        return res.status(r.ok ? 200 : 500).json(r.ok ? { ok: true } : { ok: false, error: 'insert failed' });
      }
      return res.status(400).json({ ok: false, error: 'unknown action' });
    } catch (e) { return res.status(500).json({ ok: false, error: String(e.message || e) }); }
  }

  return res.status(405).json({ ok: false, error: 'method not allowed' });
};
