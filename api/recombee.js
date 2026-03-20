// Vercel serverless function — proxies Recombee API calls

import crypto from 'crypto';

const DB = process.env.RECOMBEE_DB || 'cvachond-land-free-pbook';
const TOKEN = process.env.RECOMBEE_TOKEN || '';
const REGION = process.env.RECOMBEE_REGION || 'rapi-eu-west';

function signUrl(path) {
  const ts = Math.floor(Date.now() / 1000);
  const sep = path.includes('?') ? '&' : '?';
  const pathWithTs = `${path}${sep}hmac_timestamp=${ts}`;
  const hmac = crypto.createHmac('sha1', TOKEN).update(pathWithTs).digest('hex');
  return `${pathWithTs}&hmac_sign=${hmac}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!TOKEN) return res.status(500).json({ error: 'RECOMBEE_TOKEN not configured' });

  const { endpoint, body } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

  const basePath = `/${DB}${endpoint}`;
  const signedPath = signUrl(basePath);
  const url = `https://${REGION}.recombee.com${signedPath}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.text();
    res.status(response.status).setHeader('Content-Type', 'application/json').send(data);
  } catch (e) {
    res.status(502).json({ error: 'Recombee API error', message: e.message });
  }
}
