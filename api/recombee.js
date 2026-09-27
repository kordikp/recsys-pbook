// Vercel serverless function — proxies Recombee API calls
// Same logic as netlify/functions/recombee.js
//
// Hardened 2026-09-27: the proxy signs only the calls the reader and the
// admin console actually make. Everything else (DELETE, database reset,
// listing users, property definitions, batch) is refused before signing.

const crypto = require('crypto');

const DB = process.env.RECOMBEE_DB || 'cvachond-land-free-pbook-kids';
const TOKEN = process.env.RECOMBEE_TOKEN || '';
const REGION = process.env.RECOMBEE_REGION || 'rapi-eu-west';
// Server-side key for editor actions (state → edited/core). Unset = those
// actions are refused for everyone.
const ADMIN_KEY = process.env.PBOOK_ADMIN_KEY || '';
const ORIGINS = (process.env.PBOOK_ORIGINS || 'https://recsys-pbook.vercel.app,https://recsys-pbook-pavel-kordiks-projects-71bc55f1.vercel.app')
  .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
// Deployment URLs of this Vercel team (previews, pinned builds) and local dev.
const ORIGIN_PATTERNS = [
  /^https:\/\/recsys-pbook-[a-z0-9-]+-pavel-kordiks-projects-71bc55f1\.vercel\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
];

function originAllowed(origin) {
  return ORIGINS.indexOf(origin) !== -1 || ORIGIN_PATTERNS.some(function (re) { return re.test(origin); });
}

const SEG = '[^/?#]+';
const ALLOW = [
  ['POST', new RegExp('^/detailviews/$')],
  ['POST', new RegExp('^/ratings/$')],
  ['POST', new RegExp('^/bookmarks/$')],
  ['POST', new RegExp('^/purchases/$')],
  ['POST', new RegExp('^/users/' + SEG + '$')],
  ['PUT', new RegExp('^/users/' + SEG + '/merge/' + SEG + '$')],
  ['POST', new RegExp('^/recomms/users/' + SEG + '/items/$')],
  ['POST', new RegExp('^/recomms/next/items/' + SEG + '$')],
  ['POST', new RegExp('^/recomms/items/' + SEG + '/items/$')],
  ['POST', new RegExp('^/search/users/' + SEG + '/items/$')],
  ['POST', new RegExp('^/items/' + SEG + '$')],
  ['GET', new RegExp('^/items/list/(\\?count=1)?$')],
];
const EDITOR_STATES = ['edited', 'core'];

function signUrl(path) {
  const ts = Math.floor(Date.now() / 1000);
  const sep = path.includes('?') ? '&' : '?';
  const pathWithTs = path + sep + 'hmac_timestamp=' + ts;
  const hmac = crypto.createHmac('sha1', TOKEN).update(pathWithTs).digest('hex');
  return pathWithTs + '&hmac_sign=' + hmac;
}

function allowed(method, endpoint) {
  return ALLOW.some(function (a) { return a[0] === method && a[1].test(endpoint); });
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (origin && !originAllowed(origin)) {
    return res.status(403).json({ error: 'origin not allowed' });
  }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Pbook-Admin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!TOKEN) return res.status(500).json({ error: 'RECOMBEE_TOKEN not configured' });

  const { endpoint, body, method: reqMethod } = req.body || {};
  if (typeof endpoint !== 'string' || !endpoint) return res.status(400).json({ error: 'endpoint required' });
  const method = String(reqMethod || (body ? 'POST' : 'GET')).toUpperCase();
  if (endpoint.indexOf('..') !== -1 || !allowed(method, endpoint)) {
    return res.status(403).json({ error: 'operation not allowed' });
  }
  if (method === 'GET' && /^\/items\/list\//.test(endpoint) && Number((body || {}).count || 1) > 1) {
    return res.status(403).json({ error: 'operation not allowed' });
  }
  // Promotion to edited/core is an editor action: require the server-side key.
  if (/^\/items\//.test(endpoint) && body && EDITOR_STATES.indexOf(body.state) !== -1) {
    if (!ADMIN_KEY || req.headers['x-pbook-admin'] !== ADMIN_KEY) {
      return res.status(403).json({ error: 'editor key required' });
    }
  }
  if (JSON.stringify(body || {}).length > 20000) return res.status(413).json({ error: 'body too large' });

  let basePath = '/' + DB + endpoint;

  if (method === 'GET' && body) {
    const params = Object.entries(body).map(function(e) { return e[0] + '=' + encodeURIComponent(e[1]); }).join('&');
    basePath += (basePath.includes('?') ? '&' : '?') + params;
  }

  const signedPath = signUrl(basePath);
  const url = 'https://' + REGION + '.recombee.com' + signedPath;

  try {
    const fetchOpts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (method !== 'GET' && body) fetchOpts.body = JSON.stringify(body);
    const response = await fetch(url, fetchOpts);
    const data = await response.text();
    // Recombee 409 = "already exists"/duplicate — idempotent success for our
    // write patterns (AddUser, repeated interactions). Returning 409 made the
    // browser log red errors on every load and the offline queue churn.
    if (response.status === 409) return res.status(200).setHeader('Content-Type', 'application/json').send(JSON.stringify({ ok: true, conflict: true }));
    res.status(response.status).setHeader('Content-Type', 'application/json').send(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
