// Server-side interaction log — Supabase backend (Vercel version)

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
// Editor key (same one api/recombee.js checks). Unset = nobody reads contacts.
const ADMIN_KEY = process.env.PBOOK_ADMIN_KEY || '';

// Rows that carry a person's contact or their own words to the authors: stored
// like any other row, never part of the public list below.
const PRIVATE_TYPES = ['contact', 'author_message'];
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;

function isAdmin(req) {
  return !!ADMIN_KEY && req.headers['x-pbook-admin'] === ADMIN_KEY;
}

// The list is public (the reader app and admin both load it). An email must not
// be readable there — it becomes a stable pseudonym, so counts of distinct
// readers stay right.
function pseudonym(v) {
  return 'u:' + crypto.createHash('sha256').update(String(v).toLowerCase()).digest('hex').slice(0, 12);
}
function redact(r) {
  if (typeof r.user_id === 'string' && EMAIL.test(r.user_id)) r.user_id = pseudonym(r.user_id);
  const d = r.data;
  if (d && typeof d === 'object') {
    if (typeof d.userId === 'string' && EMAIL.test(d.userId)) d.userId = pseudonym(d.userId);
    if (d.email) d.email = '(hidden)';
  }
  return r;
}

function clip(v, n) { return String(v == null ? '' : v).trim().slice(0, n); }

async function supabase(method, path, body) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=minimal' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === 'GET') return res.json();
  return { ok: res.ok, status: res.status };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Pbook-Admin');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const q = req.query || {};
      // Single full row on demand (admin content preview): ?full=1&blockId=X
      if (q.full && q.blockId) {
        const rows = await supabase('GET',
          `interactions?order=created_at.desc&limit=1&event=eq.block_saved&data->>blockId=eq.${encodeURIComponent(q.blockId)}`);
        return res.status(200).json(Array.isArray(rows) ? rows : []);
      }
      // Contacts + messages to the authors: editors only (admin → 🤝 Contacts)
      if (q.contacts) {
        if (!isAdmin(req)) return res.status(403).json({ error: 'editor key required' });
        const rows = await supabase('GET',
          'interactions?event=in.(contact_message,author_question)&order=created_at.desc&limit=500&select=created_at,user_id,type,event,data');
        return res.status(200).json(Array.isArray(rows) ? rows : []);
      }
      const admin = isAdmin(req);
      let data = await supabase('GET', 'interactions?order=created_at.desc&limit=2000');
      if (!Array.isArray(data)) return res.status(200).json([]);
      data = data.filter(r => !(r && PRIVATE_TYPES.includes(r.type)));
      if (!admin) data.forEach(redact);
      // SLIM by default: content archives carry ≤60 kB payloads each — truncate
      // for list views (admin loads this on every tab; it must stay light)
      for (const r of data) {
        const d = r && r.data;
        if (!d || typeof d !== 'object') continue;
        if (typeof d.body === 'string' && d.body.length > 240) { d.bodyLen = d.body.length; d.body = d.body.slice(0, 240) + '…'; }
        if (typeof d.svg === 'string' && d.svg.length) { d.hasSvg = true; d.svg = ''; }
      }
      return res.status(200).json(data);
    } catch(e) { return res.status(200).json([]); }
  }

  if (req.method === 'POST') {
    try {
      let data = req.body || {};
      if (!data.type) return res.status(400).json({ error: 'type required' });

      // "Collaborate with us" form: a contact and a short note, validated here
      // so the row is always small and well-formed.
      if (data.type === 'contact') {
        const d = data.data || {};
        if (d.website) return res.status(200).json({ ok: true });   // honeypot: a bot filled the hidden field
        const contact = clip(d.contact, 160), message = clip(d.message, 1500);
        if (!contact || !message) return res.status(400).json({ error: 'contact and message required' });
        data = {
          type: 'contact', event: 'contact_message', userId: clip(data.userId, 120) || 'unknown',
          name: clip(d.name, 80), contact, topic: clip(d.topic, 40), message,
          page: clip(d.page, 200), lang: clip(d.lang, 20), ua: clip(req.headers['user-agent'], 200),
        };
      }
      // A question the reader sent to the authors from the tutor
      if (data.type === 'author_message') {
        const d = data.data || {};
        const question = clip(d.question, 1500);
        if (!question) return res.status(400).json({ error: 'question required' });
        data = { type: 'author_message', event: 'author_question', userId: clip(data.userId, 120) || 'unknown',
          question, blockId: clip(d.blockId, 120) || null };
      }

      const row = {
        user_id: data.userId || 'unknown',
        type: data.type,
        item_id: data.itemId || null,
        mode: data.mode || null,
        event: data.event || null,
        duration: data.duration || null,
        rating: data.rating || null,
        data: data,
        server_ts: Date.now(),
      };

      const result = await supabase('POST', 'interactions', row);
      if (result.ok) return res.status(200).json({ ok: true });
      return res.status(500).json({ error: 'Supabase insert failed: HTTP ' + result.status + ' (check SUPABASE_KEY role + RLS policy on interactions)' });
    } catch(e) { return res.status(500).json({ error: 'Supabase unreachable: ' + e.message + ' (paused project?)' }); }
  }

  return res.status(405).json({ error: 'method not allowed' });
};
