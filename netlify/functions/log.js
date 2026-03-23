// Server-side interaction log
// POST: append interaction to log
// GET: return all logged interactions (for admin analytics)

const fs = require('fs');
const path = require('path');

const LOG_FILE = '/tmp/pbook-interactions.jsonl';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const headers = { ...CORS, 'Content-Type': 'application/json' };

  // GET: return all logs
  if (event.httpMethod === 'GET') {
    try {
      if (!fs.existsSync(LOG_FILE)) return { statusCode: 200, headers, body: '[]' };
      const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
      const entries = lines.map(l => { try { return JSON.parse(l); } catch(e) { return null; } }).filter(Boolean);
      return { statusCode: 200, headers, body: JSON.stringify(entries) };
    } catch(e) {
      return { statusCode: 200, headers, body: '[]' };
    }
  }

  // POST: append interaction
  if (event.httpMethod === 'POST') {
    try {
      const data = JSON.parse(event.body || '{}');
      if (!data.type) return { statusCode: 400, headers, body: '{"error":"type required"}' };

      const entry = {
        ...data,
        serverTs: Date.now(),
        ip: (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown',
      };

      fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
      return { statusCode: 200, headers, body: '{"ok":true}' };
    } catch(e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 405, headers, body: '{"error":"method not allowed"}' };
};
