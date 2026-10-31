// User auth & profile sync — Supabase backend (Vercel version)
// Table: user_profiles (email text UNIQUE, password_hash text, display_name text, profile_data jsonb, created_at, updated_at)
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function supabase(method, path, body) {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
  };
  if (method === 'POST') headers['Prefer'] = 'return=representation';
  if (method === 'PATCH') headers['Prefer'] = 'return=representation';
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

// Legacy scheme (unsalted SHA-256 of email:password) — only to verify old accounts once.
function legacyHash(email, password) {
  return crypto.createHash('sha256').update(email.toLowerCase() + ':' + password).digest('hex');
}
// Current scheme: scrypt with a random salt, stored as "scrypt$<salt hex>$<hash hex>".
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return 'scrypt$' + salt + '$' + crypto.scryptSync(password, salt, 64).toString('hex');
}
// → 'ok' | 'legacy' (correct, but stored with the old scheme: re-hash it) | false
function checkPassword(email, password, stored) {
  if (typeof stored !== 'string') return false;
  if (stored.startsWith('scrypt$')) {
    const [, salt, hex] = stored.split('$');
    const want = Buffer.from(hex || '', 'hex'), got = crypto.scryptSync(password, salt || '', 64);
    return want.length === got.length && crypto.timingSafeEqual(want, got) ? 'ok' : false;
  }
  const legacy = Buffer.from(legacyHash(email, password)), have = Buffer.from(stored);
  return legacy.length === have.length && crypto.timingSafeEqual(legacy, have) ? 'legacy' : false;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}
function sameToken(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

// Guessing a password: after 10 wrong tries in 15 minutes an account takes no more for a while.
// Each wrong try is a row in the log under a hash of the e-mail (never the address itself).
const FAIL_WINDOW = 15 * 60 * 1000, FAIL_MAX = 10;
const failId = email => 'auth:' + crypto.createHash('sha256').update('pbook-login:' + email).digest('hex').slice(0, 16);
async function tooManyFails(email) {
  const since = new Date(Date.now() - FAIL_WINDOW).toISOString();
  const r = await supabase('GET', `interactions?event=eq.auth_login_failed&user_id=eq.${failId(email)}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=${FAIL_MAX}`);
  return r.ok && Array.isArray(r.data) && r.data.length >= FAIL_MAX;
}
const noteFail = email => supabase('POST', 'interactions', { user_id: failId(email), type: 'auth', event: 'auth_login_failed', data: {}, server_ts: Date.now() }).catch(() => {});
const MAX_PROFILE = 1024 * 1024;   // a reader's whole progress is far smaller; this only stops abuse

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { action, email, password, displayName, profileData, token } = req.body || {};

  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'SUPABASE_URL and SUPABASE_KEY must be configured' });
  if (!action) return res.status(400).json({ error: 'action required' });

  try {
    // ---- REGISTER ----
    if (action === 'register') {
      if (!email || !password || typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'email and password required' });
      if (password.length < 4) return res.status(400).json({ error: 'password must be at least 4 characters' });
      if (email.length > 200 || password.length > 200) return res.status(400).json({ error: 'too long' });
      if (JSON.stringify(profileData || {}).length > MAX_PROFILE) return res.status(413).json({ error: 'profile too large' });

      const emailLower = email.toLowerCase().trim();
      // Check if email exists
      const existing = await supabase('GET', `user_profiles?email=eq.${encodeURIComponent(emailLower)}&select=email`);
      if (existing.ok && Array.isArray(existing.data) && existing.data.length > 0) {
        return res.status(409).json({ error: 'An account with this email already exists. Try logging in!' });
      }

      const sessionToken = generateToken();
      const row = {
        email: emailLower,
        password_hash: hashPassword(password),
        display_name: (displayName || '').trim().substring(0, 60) || null,
        session_token: sessionToken,
        profile_data: profileData || {},
        updated_at: new Date().toISOString(),
      };
      const result = await supabase('POST', 'user_profiles', row);
      if (!result.ok) return res.status(500).json({ error: 'Registration failed. The profiles table may not exist yet.' });

      return res.status(200).json({
        ok: true,
        token: sessionToken,
        displayName: row.display_name,
        profileData: row.profile_data,
      });
    }

    // ---- LOGIN ----
    if (action === 'login') {
      if (!email || !password || typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'email and password required' });

      const emailLower = email.toLowerCase().trim();
      if (await tooManyFails(emailLower)) return res.status(429).json({ error: 'Too many wrong passwords. Try again in 15 minutes.', code: 'too_many_tries' });
      const result = await supabase('GET', `user_profiles?email=eq.${encodeURIComponent(emailLower)}&select=*`);
      if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) {
        return res.status(401).json({ error: 'No account found with this email.' });
      }

      const user = result.data[0];
      const verdict = checkPassword(emailLower, password, user.password_hash);
      if (!verdict) {
        await noteFail(emailLower);
        return res.status(401).json({ error: 'Wrong password.' });
      }

      // Refresh session token (and move an old unsalted hash to scrypt while we know the password)
      const sessionToken = generateToken();
      const patch = { session_token: sessionToken, updated_at: new Date().toISOString() };
      if (verdict === 'legacy') patch.password_hash = hashPassword(password);
      await supabase('PATCH', `user_profiles?email=eq.${encodeURIComponent(emailLower)}`, patch);

      return res.status(200).json({
        ok: true,
        token: sessionToken,
        displayName: user.display_name,
        profileData: user.profile_data || {},
      });
    }

    // Account actions below need the session token from login/register — the
    // email alone let anyone reset a password or read a profile.
    if (action === 'update' || action === 'save' || action === 'load') {
      if (!email || !token) return res.status(401).json({ error: 'not authenticated' });
      const rows = await supabase('GET', `user_profiles?email=eq.${encodeURIComponent(email.toLowerCase().trim())}&select=session_token`);
      if (!rows.ok || !Array.isArray(rows.data) || !rows.data.length || !sameToken(rows.data[0].session_token, token)) {
        return res.status(401).json({ error: 'Your session has expired — please log in again.', code: 'session_expired' });
      }
    }

    // ---- UPDATE ACCOUNT (name, password) ----
    if (action === 'update') {
      if (!email) return res.status(401).json({ error: 'not authenticated' });
      const emailLower = email.toLowerCase().trim();
      const update = { updated_at: new Date().toISOString() };
      if (displayName) update.display_name = String(displayName).substring(0, 60);
      if (password) {
        if (typeof password !== 'string' || password.length > 200) return res.status(400).json({ error: 'bad password' });
        if (password.length < 4) return res.status(400).json({ error: 'password must be at least 4 characters' });
        update.password_hash = hashPassword(password);
      }
      const result = await supabase('PATCH', `user_profiles?email=eq.${encodeURIComponent(emailLower)}`, update);
      if (!result.ok) return res.status(500).json({ error: 'Update failed' });
      return res.status(200).json({ ok: true });
    }

    // ---- SAVE PROFILE ----
    if (action === 'save') {
      if (!email) return res.status(401).json({ error: 'not authenticated' });
      const emailLower = email.toLowerCase().trim();

      if (JSON.stringify(profileData || {}).length > MAX_PROFILE) return res.status(413).json({ error: 'profile too large' });
      const update = { profile_data: profileData || {}, updated_at: new Date().toISOString() };
      if (displayName) update.display_name = displayName.substring(0, 60);
      const result = await supabase('PATCH', `user_profiles?email=eq.${encodeURIComponent(emailLower)}`, update);
      if (!result.ok) return res.status(500).json({ error: 'Save failed' });

      return res.status(200).json({ ok: true });
    }

    // ---- LOAD PROFILE ----
    if (action === 'load') {
      if (!email) return res.status(401).json({ error: 'not authenticated' });
      const emailLower = email.toLowerCase().trim();

      const result = await supabase('GET', `user_profiles?email=eq.${encodeURIComponent(emailLower)}&select=display_name,profile_data,updated_at`);
      if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) {
        return res.status(401).json({ error: 'Account not found.' });
      }

      return res.status(200).json({
        ok: true,
        displayName: result.data[0].display_name,
        profileData: result.data[0].profile_data || {},
        updatedAt: result.data[0].updated_at,
      });
    }

    return res.status(400).json({ error: 'Unknown action: ' + action });
  } catch (e) {
    console.error('auth', e);
    return res.status(500).json({ error: 'server error' });
  }
};
