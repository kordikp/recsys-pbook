#!/usr/bin/env node
/**
 * Import all p-book content items into Recombee database.
 * Usage: RECOMBEE_DB=xxx RECOMBEE_TOKEN=yyy node scripts/import-to-recombee.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB = process.env.RECOMBEE_DB || 'cvachond-land-free-pbook';
const TOKEN = process.env.RECOMBEE_TOKEN || '';
const REGION = process.env.RECOMBEE_REGION || 'rapi-eu-west';
const CONTENT_DIR = path.join(__dirname, '..', 'content');

if (!TOKEN) { console.error('ERROR: Set RECOMBEE_TOKEN'); process.exit(1); }

function signUrl(p) {
  const ts = Math.floor(Date.now() / 1000);
  const sep = p.includes('?') ? '&' : '?';
  const withTs = p + sep + 'hmac_timestamp=' + ts;
  return withTs + '&hmac_sign=' + crypto.createHmac('sha1', TOKEN).update(withTs).digest('hex');
}

async function api(method, endpoint, body) {
  const url = `https://${REGION}.recombee.com${signUrl('/' + DB + endpoint)}`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok && res.status !== 409) throw new Error(`${res.status}: ${text.substring(0, 200)}`);
  try { return JSON.parse(text); } catch { return text; }
}

async function batch(requests) {
  const url = `https://${REGION}.recombee.com${signUrl('/' + DB + '/batch/')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Batch ${res.status}: ${text.substring(0, 300)}`);
  return JSON.parse(text);
}

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const meta = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*)\s*:\s*(.*)/);
    if (!kv) continue;
    let val = kv[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (val === 'null') val = null;
    else if (/^\d+$/.test(val)) val = parseInt(val);
    meta[kv[1].trim()] = val;
  }
  const body = match[2].trim();
  meta._wordCount = body.split(/\s+/).length;
  // Extract searchable text: headings + bold terms + recall Q&A + body summary
  const headings = (body.match(/^#{1,3}\s+(.+)$/gm) || []).map(h => h.replace(/^#+\s+/, '')).join('. ');
  const boldTerms = [...new Set((body.match(/\*\*([^*]+)\*\*/g) || []).map(b => b.replace(/\*\*/g, '')))].join(', ');
  const recallQA = [meta.recallQ, meta.recallA].filter(Boolean).join('. ');
  const plainBody = body.replace(/[#*_\[\]|>`~]/g, '').replace(/\(http[^)]+\)/g, '').replace(/!\[lottie:[^\]]+\]\([^)]*\)/g, '').replace(/\n+/g, ' ');
  meta._searchText = `${meta.title || ''}. ${headings}. ${boldTerms}. ${recallQA}. ${plainBody}`.substring(0, 3000);
  return meta;
}

async function main() {
  console.log(`Importing to: ${DB} (${REGION})\n`);

  // Step 1: Add item properties (individual PUT requests, not batch)
  console.log('--- Adding item properties ---');
  const properties = {
    type: 'string', title: 'string', teaser: 'string', voice: 'string',
    readingTime: 'int', core: 'boolean', standalone: 'boolean',
    chapter: 'string', chapterNum: 'int', wordCount: 'int', publishedAt: 'timestamp',
    searchText: 'string',
  };

  for (const [name, type] of Object.entries(properties)) {
    try {
      // PUT /{db}/items/properties/{name}?type={type}
      await api('PUT', `/items/properties/${name}?type=${type}`);
      console.log(`  + ${name} (${type})`);
    } catch (e) {
      if (e.message.includes('409')) console.log(`  = ${name} (exists)`);
      else console.log(`  ! ${name}: ${e.message}`);
    }
  }

  // Step 2: Read all content files
  console.log('\n--- Reading content files ---');
  const items = [];
  const bookJson = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, 'book.json'), 'utf8'));

  for (const chapter of bookJson.chapters) {
    for (const file of chapter.files) {
      const filePath = path.join(CONTENT_DIR, chapter.directory, file);
      if (!fs.existsSync(filePath)) { console.log(`  ! Missing: ${file}`); continue; }
      const meta = parseFrontmatter(fs.readFileSync(filePath, 'utf8'));
      if (!meta || !meta.id) { console.log(`  ! No frontmatter: ${file}`); continue; }

      items.push({
        itemId: meta.id,
        values: {
          type: meta.type || 'spine',
          title: meta.title || file,
          teaser: (meta.teaser || '').substring(0, 500),
          voice: meta.voice || 'universal',
          readingTime: meta.readingTime || 3,
          core: meta.core === true,
          standalone: meta.standalone !== false,
          chapter: chapter.id,
          chapterNum: chapter.number,
          wordCount: meta._wordCount || 0,
          publishedAt: meta.publishedAt ? new Date(meta.publishedAt).toISOString() : null,
          searchText: (meta._searchText || '').substring(0, 3000),
          '!cascadeCreate': true,
        }
      });
    }
  }
  console.log(`  Found ${items.length} items\n`);

  // Step 3: Import items via batch (set values with cascadeCreate)
  console.log('--- Importing items ---');
  const BATCH_SIZE = 50;
  let imported = 0, errors = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);

    // Batch: POST /items/{itemId} with cascadeCreate creates item + sets values
    const requests = chunk.map(item => ({
      method: 'POST',
      path: `/items/${item.itemId}`,
      params: item.values,
    }));

    try {
      const results = await batch(requests);
      const ok = results.filter(r => r.code === 200 || r.code === 201).length;
      const fail = results.filter(r => r.code >= 400);
      imported += ok;
      errors += fail.length;
      if (fail.length) {
        fail.slice(0, 3).forEach(f => console.log(`  ! ${f.code}: ${JSON.stringify(f.json).substring(0, 100)}`));
      }
      process.stdout.write(`  ${imported}/${items.length} items imported\r`);
    } catch (e) {
      console.log(`  Batch error at ${i}: ${e.message}`);
      errors += chunk.length;
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n\n--- Done ---`);
  console.log(`Imported: ${imported}, Errors: ${errors}, Total: ${items.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
