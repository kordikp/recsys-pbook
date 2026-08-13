// Server-authoritative AI wallet — the XP economy's source of truth.
//
// The client-side wallet (localStorage) was trivially editable. Balances now
// live as an event ledger in the existing Supabase `interactions` table
// (wallet_earn / wallet_spend / wallet_init / wallet_trial folded per user),
// scoped per book host. Spending happens inside /api/generate BEFORE the model
// is called; this endpoint serves balance reads and rate-capped earn claims.
//
// Trust model (pilot): earn claims mirror client XP events and are capped
// (per-claim and per-day) rather than individually verified — the caps are the
// real defence. Spends are server-only. Logged-in users authenticate with
// email + rotating session_token from user_profiles.
//
// POST { action:'balance', email, token, clientXp? }   → { ok, balance }
//        (first call may seed a one-time migration credit from client XP)
// POST { action:'earn', email, token, amount, reason } → { ok, balance }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const EARN_MAX_CLAIM = 40;    // largest single mission reward
const EARN_DAILY_CAP = 200;   // per user per day
const INIT_MAX = 100;         // one-time migration credit from pre-login XP

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

async function verifySession(email, token) {
  if (!email || !token) return null;
  const rows = await sb('GET', `user_profiles?email=eq.${encodeURIComponent(String(email).toLowerCase().trim())}&select=email,session_token`);
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0].session_token === token ? rows[0].email : null;
}

async function ledger(email, book) {
  const rows = await sb('GET',
    `interactions?event=in.(wallet_earn,wallet_spend,wallet_init)&user_id=eq.${encodeURIComponent(email)}&order=created_at.asc&limit=2000&select=event,created_at,data`);
  let bal = 0, inited = false, todayEarn = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const r of Array.isArray(rows) ? rows : []) {
    const d = r.data || {};
    if (d.book && d.book !== book) continue;
    if (r.event === 'wallet_earn') {
      bal += d.amount || 0;
      if (String(r.created_at).slice(0, 10) === today) todayEarn += d.amount || 0;
    }
    if (r.event === 'wallet_spend') bal -= d.amount || 0;
    if (r.event === 'wallet_init') inited = true;
  }
  return { balance: Math.max(0, bal), inited, todayEarn };
}

async function write(email, event, data) {
  return sb('POST', 'interactions', { user_id: email, type: 'wallet', event, data, server_ts: Date.now() });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ ok: false, error: 'Supabase not configured' });

  const { action, email, token, clientXp, amount, reason } = req.body || {};
  const book = bookOf(req);
  try {
    const user = await verifySession(email, token);
    if (!user) return res.status(401).json({ ok: false, error: 'login_required' });
    let led = await ledger(user, book);

    if (action === 'balance') {
      // One-time migration: pre-login XP earned on this device becomes starting credit.
      if (!led.inited) {
        const seed = Math.max(0, Math.min(INIT_MAX, parseInt(clientXp, 10) || 0));
        await write(user, 'wallet_init', { book });
        if (seed > 0) await write(user, 'wallet_earn', { book, amount: seed, reason: 'migrace' });
        led = { balance: led.balance + seed, inited: true, todayEarn: led.todayEarn };
      }
      return res.status(200).json({ ok: true, balance: led.balance });
    }

    if (action === 'earn') {
      const n = Math.max(0, Math.min(EARN_MAX_CLAIM, parseInt(amount, 10) || 0));
      if (!n) return res.status(400).json({ ok: false, error: 'amount required', balance: led.balance });
      if (led.todayEarn >= EARN_DAILY_CAP) return res.status(200).json({ ok: true, balance: led.balance, capped: true });
      const grant = Math.min(n, EARN_DAILY_CAP - led.todayEarn);
      await write(user, 'wallet_earn', { book, amount: grant, reason: String(reason || 'activity').slice(0, 60) });
      return res.status(200).json({ ok: true, balance: led.balance + grant, capped: grant < n });
    }

    return res.status(400).json({ ok: false, error: 'unknown action' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};

// Reused by /api/generate for enforcement (same module instance on Vercel is
// not guaranteed — generate.js imports these helpers directly).
module.exports._internals = { sb, bookOf, verifySession, ledger, write };
