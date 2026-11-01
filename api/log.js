// Server-side interaction log — Supabase backend (Vercel version)

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
// Editor key (same one api/recombee.js checks). Unset = nobody reads contacts.
const ADMIN_KEY = process.env.PBOOK_ADMIN_KEY || '';

// Rows that carry a person's contact or their own words to the authors: stored
// like any other row, never part of the public list below. A teacher's survey
// (/ucitel) can name the school, so it stays out of the list too.
const PRIVATE_TYPES = ['contact', 'author_message', 'teacher_survey'];
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;

function isAdmin(req) {
  const k = req.headers['x-pbook-admin'];
  if (!ADMIN_KEY || typeof k !== 'string') return false;
  const a = Buffer.from(k), b = Buffer.from(ADMIN_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Books share one table. A client row names its book by slug (CONFIG.book.slug), a wallet or
// proposal row by the host that served it, and rows from before 2026-10-29 name none.
// ?book=<slug> keeps this book's rows and those unnamed ones.
const BOOK_ID = /^[a-z0-9][a-z0-9.:-]{0,79}$/;
const hostOf = req => String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
function bookScope(req) {
  const b = String((req.query || {}).book || '').toLowerCase();
  if (!BOOK_ID.test(b)) return '';
  const h = hostOf(req), names = [b, ...(BOOK_ID.test(h) && h !== b ? [h] : [])];
  return '&or=' + encodeURIComponent('(' + names.map(n => `data->>book.eq."${n}"`).join(',') + ',data->>book.is.null)');
}

// The list is public (the reader app and admin both load it). An email must not
// be readable there — it becomes a stable pseudonym, so counts of distinct
// readers stay right.
function pseudonym(v) {
  return 'u:' + crypto.createHash('sha256').update(String(v).toLowerCase()).digest('hex').slice(0, 12);
}
// Account ids are built from the e-mail ("acct-jane-doe-gmail-com"), so they identify a person too.
const ACCT = /^acct-/;
const personal = v => typeof v === 'string' && (EMAIL.test(v) || ACCT.test(v));
function redact(r) {
  if (personal(r.user_id)) r.user_id = pseudonym(r.user_id);
  const d = r.data;
  if (d && typeof d === 'object') {
    if (personal(d.userId)) d.userId = pseudonym(d.userId);
    if (d.email) d.email = '(hidden)';
  }
  return r;
}

// Aggregates over the WHOLE log for one book (the list below is only the latest 1,000 rows).
// They read a few small columns page by page and are kept 10 minutes per function instance
// and book, so opening the admin repeatedly costs one scan.
const READER = /^(reader-|acct-)/;   // real readers; decks, drafts, admin and test ids are not people
const TEN_MIN = 10 * 60 * 1000;
async function countRows(path) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + path, { method: 'HEAD',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, Prefer: 'count=exact', Range: '0-0' } });
  const m = /\/(\d+)/.exec(r.headers.get('content-range') || '');
  return m ? Number(m[1]) : null;
}
// Every row of a filtered query (path ends with &order=id.asc), 8 pages at a time, at most maxPages pages
async function scanRows(path, maxPages) {
  const total = await countRows(path) || 0;
  const PAGE = 1000, pages = Math.min(Math.ceil(total / PAGE), maxPages);
  const out = [];
  for (let i = 0; i < pages; i += 8) {
    const batch = [];
    for (let k = i; k < Math.min(i + 8, pages); k++) {
      batch.push(fetch(SUPABASE_URL + '/rest/v1/' + path, {
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, Range: `${k * PAGE}-${k * PAGE + PAGE - 1}` },
      }).then(r => r.ok ? r.json() : []).catch(() => []));
    }
    for (const rows of await Promise.all(batch)) if (Array.isArray(rows)) out.push(...rows);
  }
  return { rows: out, total, pages };
}
const _cache = new Map();   // 'stats|scope' → { at, value }
async function cached(key, fn) {
  const c = _cache.get(key);
  if (c && Date.now() - c.at < TEN_MIN) return c.value;
  const value = await fn();
  _cache.set(key, { at: Date.now(), value });
  return value;
}
const lastCached = key => (_cache.get(key) || {}).value || null;

async function readerStats(scope) {
  const { rows, total, pages } = await scanRows(`interactions?select=user_id,created_at${scope}&order=id.asc`, 400);
  const firstSeen = new Map(), lastSeen = new Map();
  for (const r of rows) {
    const u = r.user_id; if (!u || !READER.test(u)) continue;
    const t = Date.parse(r.created_at) || 0;
    if (!firstSeen.has(u) || t < firstSeen.get(u)) firstSeen.set(u, t);
    if (!lastSeen.has(u) || t > lastSeen.get(u)) lastSeen.set(u, t);
  }
  const now = Date.now(), day = 864e5;
  const active = d => [...lastSeen.values()].filter(t => now - t <= d * day).length;
  const weeks = [];
  for (let w = 11; w >= 0; w--) {
    const from = now - (w + 1) * 7 * day, to = now - w * 7 * day;
    weeks.push({ weekStart: new Date(from).toISOString().slice(0, 10),
      newReaders: [...firstSeen.values()].filter(t => t > from && t <= to).length,
      activeReaders: [...lastSeen.keys()].filter(u => lastSeen.get(u) > from && firstSeen.get(u) <= to).length });
  }
  return {
    readers: { allTime: firstSeen.size, last30d: active(30), last7d: active(7), last24h: active(1) },
    accounts: await countRows('user_profiles?select=email'),
    events: total, scannedPages: pages, weeks,
    firstEvent: firstSeen.size ? new Date(Math.min(...firstSeen.values())).toISOString() : null,
    note: 'A reader is a browser (reader-…) or an account (acct-…); one person on two devices counts twice.',
    computedAt: new Date().toISOString(),
  };
}

// School classes (pilot): what each class code's devices did. The teacher's own device (the
// one that sent the survey) is not counted. The full report with cores per pupil is
// scripts/pilot-report.mjs in the book.
async function classStats(scope) {
  const { rows } = await scanRows('interactions?select=user_id,type,event,created_at,code:data->>classCode,verdict:data->>verdict,'
    + `fair:data->>fair,cached:data->>cached,quality:data->>quality&data->>classCode=not.is.null${scope}&order=id.asc`, 200);
  const surveys = await supabase('GET', `interactions?type=eq.teacher_survey&order=created_at.desc&limit=300&select=created_at,user_id,data${scope}`);
  const teachers = new Set((Array.isArray(surveys) ? surveys : []).map(r => r.user_id));
  const C = new Map();
  for (const r of rows) {
    const code = String(r.code || '').toLowerCase();
    // ->> turns a JSON false into 'false': only a real code counts
    if (!/^[a-z0-9-]{4,16}$/.test(code) || code === 'false' || code === 'true' || r.type === 'teacher_survey' || teachers.has(r.user_id)) continue;
    const c = C.get(code) || C.set(code, { code, dev: new Map(), sessions: 0, bossRounds: 0, bossPass: new Set(), up: 0, down: 0,
      aiCalls: 0, missions: 0, teams: 0, recallOk: 0, first: r.created_at, last: r.created_at }).get(code);
    const days = c.dev.get(r.user_id) || c.dev.set(r.user_id, new Set()).get(r.user_id);
    days.add(String(r.created_at).slice(0, 10));
    if (r.created_at < c.first) c.first = r.created_at;
    if (r.created_at > c.last) c.last = r.created_at;
    const ev = r.type === 'event' ? r.event : r.type;
    if (ev === 'session_start') c.sessions++;
    else if (ev === 'boss_graded') { c.bossRounds++; c.aiCalls++; if (r.verdict === 'pass') c.bossPass.add(r.user_id); }
    else if (ev === 'boss_fair') { if (r.fair === 'true') c.up++; else c.down++; }
    else if (ev === 'team_graded' || ev === 'team_ai' || ev === 'remix_served' || (ev === 'generate_served' && r.cached !== 'true')) c.aiCalls++;
    else if (ev === 'mission_complete') c.missions++;
    else if (ev === 'team_done') c.teams++;
    else if (ev === 'recall_score' && Number(r.quality) >= 1) c.recallOk++;
  }
  const classes = [...C.values()].map(c => {
    const d = [...c.dev.values()].map(s => s.size).sort((a, b) => a - b);
    const { dev, bossPass, ...rest } = c;
    return { ...rest, devices: dev.size, returning: d.filter(n => n >= 2).length, daysMedian: d.length ? d[d.length >> 1] : 0,
      bossPassDevices: bossPass.size };
  }).sort((a, b) => b.devices - a.devices);
  return { classes, surveys: Array.isArray(surveys) ? surveys : [], rows: rows.length, computedAt: new Date().toISOString() };
}

// The ⚡ economy of this deployment (wallet rows name the host that served them), last 90 days
async function walletStats(host) {
  const since = new Date(Date.now() - 90 * 864e5).toISOString();
  const { rows } = await scanRows('interactions?select=user_id,event,created_at,amount:data->>amount,reason:data->>reason,tier:data->>tier,'
    + `gift:data->>gift,storno:data->>storno,net:data->>net&type=eq.wallet&data->>book=eq.${encodeURIComponent(host)}`
    + `&created_at=gte.${encodeURIComponent(since)}&order=id.asc`, 100);
  const out = { days: 90, accounts: new Set(), earned: 0, byReason: {}, spent: 0, calls: { basic: 0, advanced: 0 },
    gifts: { made: 0, madeSum: 0, redeemed: 0, redeemedSum: 0, returned: 0, returnedSum: 0 },
    trials: 0, trialDevices: new Set(), netsToday: {}, perDay: {} };
  const dayAgo = Date.now() - 864e5;
  for (const r of rows) {
    const n = Number(r.amount) || 0, day = String(r.created_at).slice(0, 10);
    const pd = out.perDay[day] || (out.perDay[day] = { day, earned: 0, spent: 0, calls: 0, trials: 0 });
    if (r.event === 'wallet_trial') {
      out.trials++; pd.trials++; out.trialDevices.add(r.user_id);
      if (r.net && Date.parse(r.created_at) > dayAgo) out.netsToday[r.net] = (out.netsToday[r.net] || 0) + 1;
      continue;
    }
    out.accounts.add(r.user_id);
    if (r.event === 'wallet_earn') {
      if (r.gift) {
        if (r.reason === 'dar-zpet') { out.gifts.returned++; out.gifts.returnedSum += n; }
        else { out.gifts.redeemed++; out.gifts.redeemedSum += n; }
      } else { out.earned += n; pd.earned += n; out.byReason[r.reason || '?'] = (out.byReason[r.reason || '?'] || 0) + n; }
    } else if (r.event === 'wallet_spend') {
      if (r.gift) { out.gifts.made++; out.gifts.madeSum += n; }
      else if (!r.storno) { out.spent += n; pd.spent += n; pd.calls++; if (out.calls[r.tier] != null) out.calls[r.tier]++; }
    }
  }
  const PER_NET = parseInt(process.env.WALLET_TRIALS_NET, 10) || 120;
  const nets = Object.values(out.netsToday);
  return { ...out, accounts: out.accounts.size, trialDevices: out.trialDevices.size,
    netsToday: { networks: nets.length, atCap: nets.filter(n => n >= PER_NET).length, cap: PER_NET },
    perDay: Object.values(out.perDay).sort((a, b) => a.day < b.day ? -1 : 1).slice(-30), computedAt: new Date().toISOString() };
}

function clip(v, n) { return String(v == null ? '' : v).trim().slice(0, n); }

// Rows other endpoints WRITE and then TRUST: the ⚡ balance is summed from wallet rows
// (api/wallet.js, api/generate.js), class galleries list deck/draft rows (api/decks.js,
// api/drafts.js), the book's proposals come from proposal rows (api/proposals.js).
// A client posting one here could mint ⚡ or plant content in a class, so they are refused.
const SERVER_TYPES = ['wallet', 'deck', 'draft', 'proposal', 'auth'];
const SERVER_EVENT = /^(wallet|deck|draft|proposal|auth)_/;
// Events this endpoint builds itself from a contact form, a question or a survey (below).
const OWN_EVENTS = { contact_message: 'contact', author_question: 'author_message', teacher_survey: 'teacher_survey' };
const MAX_BODY = 256 * 1024;   // the largest real row is an archived block: ≤20 kB text + ≤40 kB picture

// Without the editor key the list keeps what counts need (who, what, which item, ids and
// numbers) and hides what readers wrote: free text has spaces, ids and slugs do not.
function slimText(v, depth) {
  if (typeof v === 'string') return /\s/.test(v) ? '(text)' : v.slice(0, 100);
  if (!v || typeof v !== 'object') return v;
  if (depth > 3) return null;
  if (Array.isArray(v)) return v.slice(0, 20).map(x => slimText(x, depth + 1));
  const o = {};
  for (const k of Object.keys(v)) o[k] = slimText(v[k], depth + 1);
  return o;
}

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
      const scope = bookScope(req);
      // Is this the editor key? The admin asks once before it shows anything.
      if (q.check) return res.status(200).json({ admin: isAdmin(req), configured: !!ADMIN_KEY });
      // Single full row on demand (admin content preview): ?full=1&blockId=X
      if (q.full && q.blockId) {
        const rows = await supabase('GET',
          `interactions?order=created_at.desc&limit=1&event=eq.block_saved&data->>blockId=eq.${encodeURIComponent(q.blockId)}`);
        return res.status(200).json(Array.isArray(rows) ? (isAdmin(req) ? rows : rows.map(redact)) : []);
      }
      // Reader counts over the WHOLE log. A fresh count scans the table, so only an editor
      // starts one; others get the last result for this book.
      if (q.stats) {
        if (isAdmin(req)) return res.status(200).json(await cached('stats|' + scope, () => readerStats(scope)));
        const last = lastCached('stats|' + scope);
        return last ? res.status(200).json(last) : res.status(403).json({ error: 'editor key required' });
      }
      // Views and likes per item for a class leaderboard: counts only, four small columns
      if (q.usage) {
        const rows = await supabase('GET', `interactions?type=in.(detailview,rating)&order=created_at.desc&limit=5000&select=type,item_id,user_id,rating${scope}`);
        const out = {};
        for (const r of Array.isArray(rows) ? rows : []) {
          if (!r.item_id) continue;
          const u = out[r.item_id] || (out[r.item_id] = { v: new Set(), l: new Set() });
          if (r.type === 'detailview') u.v.add(r.user_id);
          else if (Number(r.rating) >= 0.7) u.l.add(r.user_id);
        }
        for (const k of Object.keys(out)) out[k] = { views: out[k].v.size, likes: out[k].l.size };
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.status(200).json(out);
      }
      // Editors only from here: messages, classes, the ⚡ economy, profiles for Tiny
      if ((q.contacts || q.classes || q.wallet || q.profiles) && !isAdmin(req)) return res.status(403).json({ error: 'editor key required' });
      if (q.contacts) {
        const rows = await supabase('GET',
          `interactions?event=in.(contact_message,author_question)&order=created_at.desc&limit=500&select=created_at,user_id,type,event,data${scope}`);
        return res.status(200).json(Array.isArray(rows) ? rows : []);
      }
      if (q.classes) return res.status(200).json(await cached('classes|' + scope, () => classStats(scope)));
      if (q.wallet) return res.status(200).json(await cached('wallet|' + hostOf(req), () => walletStats(hostOf(req))));
      // The newest profile summary of every reader (docs: the book's DEPLOY.md, "Readers' data")
      if (q.profiles) {
        const { rows } = await scanRows(`interactions?select=user_id,created_at,summary:data->summary&event=eq.profile_summary${scope}&order=id.desc`, 50);
        const seen = new Set(), out = [];
        for (const r of rows) {
          if (seen.has(r.user_id) || !r.summary || typeof r.summary !== 'object') continue;
          seen.add(r.user_id);
          out.push({ userId: r.user_id, at: r.created_at, pbook: r.summary });
        }
        return res.status(200).json(out);
      }
      const admin = isAdmin(req);
      // Decks and drafts are STORED in this table (api/decks.js, api/drafts.js) with
      // their whole content — up to 340 kB a row. Nothing reads them from here, and
      // with them the list was 38 MB and took 15–25 s (admin looked frozen).
      // Wallet rows stay out of the public list: an open gift's code is in them, and whoever
      // reads it can redeem the gift. Failed logins (api/auth.js) are nobody's business here, and a
      // reader's profile summary (profile_summary, for Tiny) is for editors only.
      let data = await supabase('GET', `interactions?order=created_at.desc&limit=2000&type=not.in.(deck,draft,auth${admin ? '' : ',wallet,profile'})${scope}`);
      if (!Array.isArray(data)) return res.status(200).json([]);
      data = data.filter(r => r && !PRIVATE_TYPES.includes(r.type) && (admin || !['wallet', 'profile'].includes(r.type)));
      if (!admin) data.forEach(r => { redact(r); if (r && r.data) r.data = slimText(r.data, 0); });
      // SLIM by default: content archives carry ≤60 kB payloads each — truncate
      // for list views (admin loads this on every tab; it must stay light)
      for (const r of data) {
        const d = r && r.data;
        if (!d || typeof d !== 'object') continue;
        if (typeof d.body === 'string' && d.body.length > 240) { d.bodyLen = d.body.length; d.body = d.body.slice(0, 240) + '…'; }
        if (typeof d.svg === 'string' && d.svg.length) { d.hasSvg = true; d.svg = ''; }
        if (d.deck) d.deck = null;
      }
      return res.status(200).json(data);
    } catch(e) { return res.status(200).json([]); }
  }

  if (req.method === 'POST') {
    try {
      let data = req.body || {};
      if (typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ error: 'JSON object required' });
      if (!data.type || typeof data.type !== 'string' || data.type.length > 40) return res.status(400).json({ error: 'type required' });
      if (data.event != null && (typeof data.event !== 'string' || data.event.length > 60)) return res.status(400).json({ error: 'bad event' });
      if (JSON.stringify(data).length > MAX_BODY) return res.status(413).json({ error: 'row too large' });
      if (SERVER_TYPES.includes(data.type) || SERVER_EVENT.test(data.event || '')
        || (OWN_EVENTS[data.event] && OWN_EVENTS[data.event] !== data.type)) {
        return res.status(403).json({ error: 'this row is written by the server only' });
      }

      // "Collaborate with us" form: a contact and a short note, validated here
      // so the row is always small and well-formed.
      if (data.type === 'contact') {
        const d = data.data || {};
        if (d.website) return res.status(200).json({ ok: true });   // honeypot: a bot filled the hidden field
        const contact = clip(d.contact, 160), message = clip(d.message, 1500);
        if (!contact || !message) return res.status(400).json({ error: 'contact and message required' });
        data = {
          type: 'contact', event: 'contact_message', userId: clip(data.userId, 120) || 'unknown', book: clip(data.book, 60) || undefined,
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
          book: clip(data.book, 60) || undefined, question, blockId: clip(d.blockId, 120) || null };
      }

      // A teacher's survey after a lesson (/ucitel, school pilot): fixed fields, clipped, so
      // the report can pair it with the class's log rows by the class code.
      if (data.type === 'teacher_survey') {
        const d = data.data || {};
        const code = clip(d.classCode, 16).toLowerCase();
        const scale = v => { const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : null; };
        const pick = (v, ok) => ok.includes(v) ? v : null;
        data = {
          type: 'teacher_survey', event: 'teacher_survey', userId: clip(data.userId, 120) || 'unknown',
          book: clip(data.book, 60) || undefined, lang: clip(d.lang, 20),
          classCode: /^[a-z0-9-]{4,16}$/.test(code) ? code : null,
          how: (Array.isArray(d.how) ? d.how : []).filter(h => ['class', 'groups', 'home', 'other'].includes(h)).slice(0, 4),
          howOther: clip(d.howOther, 200), lessons: Math.max(0, Math.min(40, Math.round(Number(d.lessons)) || 0)),
          ease: scale(d.ease), fair: scale(d.fair), unfairExample: clip(d.unfairExample, 1000),
          liked: clip(d.liked, 1500), again: pick(d.again, ['yes', 'rather-yes', 'rather-no', 'no']),
          quote: pick(d.quote, ['no', 'anon', 'school']) || 'no', school: clip(d.school, 120),
        };
      }

      // The host that served the book: rows of every book land in one shared table, and an
      // older cached client does not say which book it is.
      if (data && typeof data === 'object' && !data.site) data.site = clip(req.headers['x-forwarded-host'] || req.headers.host, 80) || undefined;

      const row = {
        user_id: clip(data.userId, 120) || 'unknown',
        type: data.type,
        item_id: data.itemId ? clip(data.itemId, 200) : null,
        mode: data.mode ? clip(data.mode, 40) : null,
        event: data.event || null,
        duration: Number(data.duration) || null,
        rating: Number(data.rating) || null,
        data: data,
        server_ts: Date.now(),
      };

      const result = await supabase('POST', 'interactions', row);
      if (result.ok) return res.status(200).json({ ok: true });
      return res.status(500).json({ error: 'Supabase insert failed: HTTP ' + result.status + ' (check SUPABASE_KEY role + RLS policy on interactions)' });
    } catch(e) { return res.status(500).json({ error: 'Supabase unreachable (paused project?)' }); }
  }

  return res.status(405).json({ error: 'method not allowed' });
};
