// Server-side interaction log (Vercel version)
const fs = require('fs');
const LOG_FILE = '/tmp/pbook-interactions.jsonl';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      if (!fs.existsSync(LOG_FILE)) return res.status(200).json([]);
      const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
      const entries = lines.map(l => { try { return JSON.parse(l); } catch(e) { return null; } }).filter(Boolean);
      return res.status(200).json(entries);
    } catch(e) { return res.status(200).json([]); }
  }

  if (req.method === 'POST') {
    try {
      const data = req.body || {};
      if (!data.type) return res.status(400).json({ error: 'type required' });
      const entry = { ...data, serverTs: Date.now(), ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown' };
      fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
      return res.status(200).json({ ok: true });
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(405).json({ error: 'method not allowed' });
};
