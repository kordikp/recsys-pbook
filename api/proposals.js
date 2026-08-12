// Concept proposals — server persistence + interest stats.
//
// The old flow kept editor-created proposals only in the admin page's JS memory
// and offered a JSON download to commit to git; a reload lost them. Proposals
// are now event-sourced into the existing Supabase `interactions` table (no new
// schema): each save appends `proposal_saved`, each delete `proposal_deleted`,
// and GET folds the events into current state. The git file
// content/concept-proposals.json remains the "shipped" layer; the reader app
// merges both (server state wins, deletions hide git entries too).
//
// GET  /api/proposals            → { ok, proposals:[…], deleted:[slug…] }
// GET  /api/proposals?stats=1    → adds per-slug interest: seen/want/skip
//                                  (distinct readers) + voter facet profiles
// POST { action:'save',   proposal:{slug,…} }
// POST { action:'delete', slug }

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

// Both books share one Supabase — scope rows by requesting host.
const bookOf = req => String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ ok: false, error: 'Supabase not configured' });
  const book = bookOf(req);

  if (req.method === 'GET') {
    try {
      const rows = await supabase('GET',
        'interactions?event=in.(proposal_saved,proposal_deleted)&order=created_at.asc&limit=2000&select=event,created_at,data');
      const state = {}; const deleted = new Set();
      for (const r of Array.isArray(rows) ? rows : []) {
        const d = r.data || {};
        if (d.book && d.book !== book) continue;
        if (r.event === 'proposal_saved' && d.proposal && d.proposal.slug) {
          state[d.proposal.slug] = { ...d.proposal, savedAt: r.created_at, origin: 'live' };
          deleted.delete(d.proposal.slug);
        } else if (r.event === 'proposal_deleted' && d.slug) {
          delete state[d.slug];
          deleted.add(d.slug);
        }
      }
      const out = { ok: true, proposals: Object.values(state), deleted: [...deleted] };

      if (req.query && req.query.stats) {
        const ev = await supabase('GET',
          'interactions?event=in.(ghost_view,ghost_want,ghost_skip)&order=created_at.desc&limit=2000&select=event,user_id,data');
        const stats = {};
        for (const r of Array.isArray(ev) ? ev : []) {
          const d = r.data || {}; const dd = d.data || d;
          const slug = dd.slug; if (!slug) continue;
          const s = (stats[slug] = stats[slug] || { seen: new Set(), want: new Set(), skip: new Set(), voters: {} });
          const uid = r.user_id || d.userId || '?';
          if (r.event === 'ghost_view') s.seen.add(uid);
          if (r.event === 'ghost_want') s.want.add(uid);
          if (r.event === 'ghost_skip') s.skip.add(uid);
          if ((r.event === 'ghost_want' || r.event === 'ghost_skip') && dd.aud && typeof dd.aud === 'object') {
            const bucket = r.event === 'ghost_want' ? 'want' : 'skip';
            for (const [k, v] of Object.entries(dd.aud)) {
              if (typeof v !== 'string' || v.length > 30) continue;
              const key = `${bucket}:${k}=${v}`;
              s.voters[key] = (s.voters[key] || 0) + 1;
            }
          }
        }
        out.stats = {};
        for (const [slug, s] of Object.entries(stats)) {
          out.stats[slug] = { seen: s.seen.size, want: s.want.size, skip: s.skip.size, voters: s.voters };
        }
      }
      return res.status(200).json(out);
    } catch (e) { return res.status(500).json({ ok: false, error: String(e.message || e) }); }
  }

  if (req.method === 'POST') {
    try {
      const b = req.body || {};
      if (b.action === 'save') {
        const p = b.proposal || {};
        if (!p.slug || !/^[\w-]{2,60}$/.test(p.slug) || !p.title) {
          return res.status(400).json({ ok: false, error: 'proposal.slug (kebab-case) and title required' });
        }
        const clean = {
          slug: p.slug, title: String(p.title).slice(0, 120), chapter: String(p.chapter || '').slice(0, 60),
          objective: String(p.objective || '').slice(0, 500), recallQ: String(p.recallQ || '').slice(0, 300),
          recallA: String(p.recallA || '').slice(0, 500),
          mustCover: (Array.isArray(p.mustCover) ? p.mustCover : []).map(x => String(x).slice(0, 200)).slice(0, 8),
          rationale: String(p.rationale || '').slice(0, 500), source: String(p.source || 'admin').slice(0, 40),
        };
        const r = await supabase('POST', 'interactions', {
          user_id: 'admin', type: 'proposal', event: 'proposal_saved',
          data: { book, proposal: clean }, server_ts: Date.now(),
        });
        return res.status(r.ok ? 200 : 500).json(r.ok ? { ok: true, proposal: clean } : { ok: false, error: 'insert failed ' + r.status });
      }
      if (b.action === 'delete') {
        if (!b.slug) return res.status(400).json({ ok: false, error: 'slug required' });
        const r = await supabase('POST', 'interactions', {
          user_id: 'admin', type: 'proposal', event: 'proposal_deleted',
          data: { book, slug: String(b.slug).slice(0, 60) }, server_ts: Date.now(),
        });
        return res.status(r.ok ? 200 : 500).json(r.ok ? { ok: true } : { ok: false, error: 'insert failed ' + r.status });
      }
      return res.status(400).json({ ok: false, error: 'unknown action' });
    } catch (e) { return res.status(500).json({ ok: false, error: String(e.message || e) }); }
  }

  return res.status(405).json({ ok: false, error: 'method not allowed' });
};
