const crypto = require('crypto');

// Legacy Netlify mirror of api/recombee.js. Same hardening (2026-09-27):
// only the calls the reader and the admin console make are signed.

const DB = process.env.RECOMBEE_DB || 'cvachond-land-free-pbook-kids';
const TOKEN = process.env.RECOMBEE_TOKEN || '';
const REGION = process.env.RECOMBEE_REGION || 'rapi-eu-west';
const ADMIN_KEY = process.env.PBOOK_ADMIN_KEY || '';
const ORIGINS = (process.env.PBOOK_ORIGINS || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);

var SEG = '[^/?#]+';
var ALLOW = [
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
var EDITOR_STATES = ['edited', 'core'];

function signUrl(path) {
  var ts = Math.floor(Date.now() / 1000);
  var sep = path.includes('?') ? '&' : '?';
  var pathWithTs = path + sep + 'hmac_timestamp=' + ts;
  var hmac = crypto.createHmac('sha1', TOKEN).update(pathWithTs).digest('hex');
  return pathWithTs + '&hmac_sign=' + hmac;
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || 'null',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Pbook-Admin',
    'Content-Type': 'application/json',
  };
}

function reply(status, origin, obj) {
  return { statusCode: status, headers: cors(origin), body: typeof obj === 'string' ? obj : JSON.stringify(obj) };
}

exports.handler = async function(event) {
  var headers = event.headers || {};
  var origin = headers.origin || headers.Origin || '';
  var host = headers.host || '';
  var sameSite = origin && host && origin.replace(/^https?:\/\//, '') === host;
  if (origin && !sameSite && ORIGINS.indexOf(origin) === -1 && !/^http:\/\/localhost(:\d+)?$/.test(origin)) {
    return reply(403, '', { error: 'origin not allowed' });
  }
  if (event.httpMethod === 'OPTIONS') return reply(200, origin, '');
  if (event.httpMethod !== 'POST') return reply(405, origin, { error: 'POST only' });
  if (!TOKEN) return reply(500, origin, { error: 'RECOMBEE_TOKEN not set' });

  var endpoint, body, reqMethod;
  try {
    var json = JSON.parse(event.body || '{}');
    endpoint = json.endpoint;
    body = json.body;
    reqMethod = json.method;
  } catch (e) {
    return reply(400, origin, { error: 'Invalid JSON' });
  }
  if (typeof endpoint !== 'string' || !endpoint) return reply(400, origin, { error: 'endpoint required' });

  var method = String(reqMethod || (body ? 'POST' : 'GET')).toUpperCase();
  var ok = endpoint.indexOf('..') === -1 && ALLOW.some(function (a) { return a[0] === method && a[1].test(endpoint); });
  if (!ok) return reply(403, origin, { error: 'operation not allowed' });
  if (method === 'GET' && /^\/items\/list\//.test(endpoint) && Number((body || {}).count || 1) > 1) {
    return reply(403, origin, { error: 'operation not allowed' });
  }
  if (/^\/items\//.test(endpoint) && body && EDITOR_STATES.indexOf(body.state) !== -1) {
    var key = headers['x-pbook-admin'] || headers['X-Pbook-Admin'] || '';
    if (!ADMIN_KEY || key !== ADMIN_KEY) return reply(403, origin, { error: 'editor key required' });
  }
  if (JSON.stringify(body || {}).length > 20000) return reply(413, origin, { error: 'body too large' });

  var basePath = '/' + DB + endpoint;
  if (method === 'GET' && body) {
    var params = Object.entries(body).map(function(e) { return e[0] + '=' + encodeURIComponent(e[1]); }).join('&');
    basePath += (basePath.includes('?') ? '&' : '?') + params;
  }
  var url = 'https://' + REGION + '.recombee.com' + signUrl(basePath);

  try {
    var fetchOpts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (method !== 'GET' && body) fetchOpts.body = JSON.stringify(body);
    var response = await fetch(url, fetchOpts);
    var data = await response.text();
    return reply(response.status, origin, data);
  } catch (e) {
    return reply(502, origin, { error: e.message });
  }
};
