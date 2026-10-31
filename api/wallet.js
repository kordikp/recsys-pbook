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
// POST { action:'balance', email, token, clientXp? }   → { ok, balance, earned, spent, given }
//        (first call may seed a one-time migration credit from client XP)
// POST { action:'earn', email, token, amount, reason } → { ok, balance }
//
// Gifts to a friend: the giver pays when the gift is made (a wallet_spend row
// carrying data.gift = code), the friend redeems the code from a link. The
// first wallet_earn row with that code wins: the friend's redeem, or the
// giver's cancel (refund). Who redeemed is never sent back to the giver.
// POST { action:'gift', email, token, amount }   → { ok, code, amount, balance }
// POST { action:'redeem', email, token, code }   → { ok, amount, balance } | { ok:false, error }
// POST { action:'cancel', email, token, code }   → { ok, balance }
// POST { action:'gifts', email, token }          → { ok, gifts:[{ code, amount, at, status }] }

const crypto = require('crypto');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Všechny knoby jdou přeladit env proměnnými bez zásahu do kódu — pro demo
// štědré, později se dá utáhnout (WALLET_*).
const EARN_MAX_CLAIM = parseInt(process.env.WALLET_MAX_CLAIM, 10) || 40;   // largest single mission reward
const EARN_DAILY_CAP = parseInt(process.env.WALLET_DAILY_CAP, 10) || 300;  // per user per day
const INIT_MAX = parseInt(process.env.WALLET_INIT_MAX, 10) || 300;         // migration cap from pre-login XP
const WELCOME = parseInt(process.env.WALLET_WELCOME, 10) || 100;           // welcome grant on first login
const GIFT_MAX = parseInt(process.env.WALLET_GIFT_MAX, 10) || 50;            // largest single gift
const GIFT_DAILY = parseInt(process.env.WALLET_GIFT_DAILY, 10) || 100;       // given per user per day
const GIFT_IN_DAILY = parseInt(process.env.WALLET_GIFT_IN_DAILY, 10) || 100; // received per user per day
// Gift codes: 8 characters without look-alikes (0/O, 1/I/L), shown as XXXX-XXXX
const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

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
  const a = Buffer.from(String(rows[0].session_token || '')), b = Buffer.from(String(token));
  return a.length && a.length === b.length && crypto.timingSafeEqual(a, b) ? rows[0].email : null;
}

// Gift rows (data.gift: given, redeemed, refunded) move ⚡ between people — they
// are not earnings, so they never eat the daily earning cap.
async function ledger(email, book) {
  const rows = await sb('GET',
    `interactions?event=in.(wallet_earn,wallet_spend,wallet_init)&user_id=eq.${encodeURIComponent(email)}&order=created_at.asc&limit=2000&select=event,created_at,data`);
  let bal = 0, inited = false, todayEarn = 0, earned = 0, spent = 0, given = 0, todayGiven = 0, todayGot = 0;
  const today = new Date().toISOString().slice(0, 10);
  const sent = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const d = r.data || {};
    if (d.book && d.book !== book) continue;
    const n = d.amount || 0, isToday = String(r.created_at).slice(0, 10) === today;
    if (r.event === 'wallet_earn') {
      bal += n;
      if (!d.gift) { earned += n; if (isToday) todayEarn += n; }
      else if (d.reason === 'dar' && isToday) todayGot += n;
      else if (d.reason === 'dar-zpet') given -= n;
    }
    if (r.event === 'wallet_spend') {
      bal -= n;
      if (d.gift) { given += n; if (isToday) todayGiven += n; sent.push({ code: d.gift, amount: n, at: r.created_at }); }
      else if (d.storno) { if (d.of === 'dar-zpet') given += n; }
      else spent += n;
    }
    if (r.event === 'wallet_init') inited = true;
  }
  return { balance: Math.max(0, bal), inited, todayEarn, earned, spent, given: Math.max(0, given), todayGiven, todayGot, sent };
}

const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
function newCode() {
  const b = crypto.randomBytes(8);
  return [...b].map(x => CODE_ABC[x % CODE_ABC.length]).join('');
}
// Rows that settle a gift (redeem or refund), oldest first: the first one wins
async function settles(code) {
  const rows = await sb('GET', `interactions?event=eq.wallet_earn&data->>gift=eq.${code}&order=created_at.asc&limit=10&select=user_id,created_at,data`);
  return Array.isArray(rows) ? rows : [];
}
// Two settles racing each other (two friends, a double tap, redeem vs cancel):
// the row written first wins; every other writer takes its ⚡ back out.
async function settleOrUndo(user, code, book, amount, reason) {
  const nonce = crypto.randomBytes(6).toString('hex');
  await write(user, 'wallet_earn', { book, amount, reason, gift: code, n: nonce });
  const first = (await settles(code))[0];
  if (first && first.data?.n === nonce) return true;
  await write(user, 'wallet_spend', { book, amount, reason: 'dar-storno', storno: code, of: reason });
  return false;
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

  const { action, email, token, clientXp, amount, reason, code } = req.body || {};
  const book = bookOf(req);
  try {
    const user = await verifySession(email, token);
    if (!user) return res.status(401).json({ ok: false, error: 'login_required' });
    let led = await ledger(user, book);
    const sums = l => ({ earned: l.earned, spent: l.spent, given: l.given });

    if (action === 'balance') {
      // One-time migration: pre-login XP earned on this device becomes starting credit.
      if (!led.inited) {
        const seed = Math.max(0, Math.min(INIT_MAX, parseInt(clientXp, 10) || 0));
        await write(user, 'wallet_init', { book });
        if (WELCOME > 0) await write(user, 'wallet_earn', { book, amount: WELCOME, reason: 'vitej' });
        if (seed > 0) await write(user, 'wallet_earn', { book, amount: seed, reason: 'migrace' });
        led = { ...led, balance: led.balance + WELCOME + seed, earned: led.earned + WELCOME + seed, inited: true };
      }
      return res.status(200).json({ ok: true, balance: led.balance, ...sums(led) });
    }

    if (action === 'earn') {
      const n = Math.max(0, Math.min(EARN_MAX_CLAIM, parseInt(amount, 10) || 0));
      if (!n) return res.status(400).json({ ok: false, error: 'amount required', balance: led.balance });
      if (led.todayEarn >= EARN_DAILY_CAP) return res.status(200).json({ ok: true, balance: led.balance, capped: true, ...sums(led) });
      const grant = Math.min(n, EARN_DAILY_CAP - led.todayEarn);
      await write(user, 'wallet_earn', { book, amount: grant, reason: String(reason || 'activity').slice(0, 60) });
      return res.status(200).json({ ok: true, balance: led.balance + grant, capped: grant < n, earned: led.earned + grant, spent: led.spent, given: led.given });
    }

    if (action === 'gift') {
      const n = parseInt(amount, 10) || 0;
      if (n < 1 || n > GIFT_MAX) return res.status(400).json({ ok: false, error: 'gift_amount', max: GIFT_MAX, balance: led.balance });
      if (n > led.balance) return res.status(200).json({ ok: false, error: 'insufficient_xp', balance: led.balance });
      if (led.todayGiven + n > GIFT_DAILY) return res.status(200).json({ ok: false, error: 'gift_daily', left: Math.max(0, GIFT_DAILY - led.todayGiven), balance: led.balance });
      const c = newCode();
      await write(user, 'wallet_spend', { book, amount: n, reason: 'dar', gift: c });
      return res.status(200).json({ ok: true, code: c, amount: n, balance: led.balance - n, earned: led.earned, spent: led.spent, given: led.given + n });
    }

    if (action === 'redeem' || action === 'cancel') {
      const c = normCode(code);
      if (c.length !== 8) return res.status(200).json({ ok: false, error: 'gift_unknown', balance: led.balance });
      const made = await sb('GET', `interactions?event=eq.wallet_spend&data->>gift=eq.${c}&limit=1&select=user_id,data`);
      const g = Array.isArray(made) ? made[0] : null;
      if (!g || (g.data?.book && g.data.book !== book)) return res.status(200).json({ ok: false, error: 'gift_unknown', balance: led.balance });
      const n = g.data.amount || 0;
      const mine = g.user_id === user;
      if (action === 'redeem' && mine) return res.status(200).json({ ok: false, error: 'gift_own', balance: led.balance });
      if (action === 'cancel' && !mine) return res.status(200).json({ ok: false, error: 'gift_unknown', balance: led.balance });
      if ((await settles(c)).length) return res.status(200).json({ ok: false, error: 'gift_used', balance: led.balance });
      if (action === 'redeem' && led.todayGot + n > GIFT_IN_DAILY) return res.status(200).json({ ok: false, error: 'gift_in_daily', balance: led.balance });
      const won = await settleOrUndo(user, c, book, n, action === 'redeem' ? 'dar' : 'dar-zpet');
      if (!won) return res.status(200).json({ ok: false, error: 'gift_used', balance: led.balance });
      return res.status(200).json({ ok: true, amount: n, balance: led.balance + n, earned: led.earned, spent: led.spent,
        given: action === 'cancel' ? Math.max(0, led.given - n) : led.given });
    }

    if (action === 'gifts') {
      const last = led.sent.slice(-10).reverse();
      const out = [];
      for (const s of last) {
        const first = (await settles(s.code))[0];
        out.push({ code: s.code, amount: s.amount, at: s.at,
          status: !first ? 'open' : first.data?.reason === 'dar-zpet' ? 'cancelled' : 'redeemed' });
      }
      return res.status(200).json({ ok: true, gifts: out, balance: led.balance, max: GIFT_MAX, dailyLeft: Math.max(0, GIFT_DAILY - led.todayGiven) });
    }

    return res.status(400).json({ ok: false, error: 'unknown action' });
  } catch (e) {
    console.error('wallet', e);
    return res.status(500).json({ ok: false, error: 'server error' });
  }
};

// Reused by /api/generate for enforcement (same module instance on Vercel is
// not guaranteed — generate.js imports these helpers directly).
module.exports._internals = { sb, bookOf, verifySession, ledger, write };
