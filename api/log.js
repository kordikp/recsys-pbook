// Server-side interaction log — Supabase backend (Vercel version)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
      const data = await supabase('GET', 'interactions?order=created_at.desc&limit=2000');
      if (!Array.isArray(data)) return res.status(200).json([]);
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
      const data = req.body || {};
      if (!data.type) return res.status(400).json({ error: 'type required' });

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
