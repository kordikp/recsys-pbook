// Interface packs vs. the engine: which tr() keys a language pack misses, which it keeps
// although the engine no longer uses them, and whether every translation keeps its {0} args.
//
//   node scripts/check-i18n.mjs              # report every pack in js/i18n/
//   node scripts/check-i18n.mjs --keys       # print all keys (JSON) — the source list for a new pack
//   node scripts/check-i18n.mjs --missing cs # print the keys cs.js lacks (JSON), to translate
//
// Keys are the English source text of tr('…') / trn('…', '…', n) calls in the engine, plus
// the static text of index.html and the few labels the engine translates at display time.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ENGINE = ['js/app.js', 'js/ux.js', 'js/games.js', 'js/tutor.js', 'js/recombee.js', 'js/i18n.js', 'js/markdown.js'];

// Values stored as logic and translated where they are shown (tr(label), tr(m.difficulty) …)
const DISPLAY_VALUES = [
  'Struggling', 'New', 'Learning', 'Confident', 'Unread',                  // recall card states
  'Beginner', 'Intermediate', 'Advanced', 'Capstone', 'Micro-mission',      // mission difficulty
  'intro', 'standard', 'technical', 'research', 'foundational',             // depth on the certificate
  'comic', 'animation', 'tl;dr', 'formal', 'story',                         // telling labels
  'Recommender architect', 'Expert', 'Practitioner', 'Reader',              // level titles
];

const FW_LANGS = new Set(['cs', 'en', 'sk', 'hu', 'de', 'pl', 'fr', 'es', 'it', 'pt', 'uk']);

const cook = (body, q) => body.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|.)/g, (m, e) =>
  e[0] === 'u' && e.length > 1 ? String.fromCodePoint(parseInt(e.replace(/[u{}]/g, ''), 16))
    : ({ n: '\n', t: '\t', r: '\r' })[e] ?? e);

function engineKeys() {
  const keys = new Map();   // key → first place it is used
  const lit = String.raw`'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|` + '`((?:[^`\\\\$]|\\\\.|\\$(?!\\{))*)`';
  const call = new RegExp(String.raw`\btrn?\(\s*(?:${lit})(?:\s*,\s*(?:${lit}))?`, 'g');
  for (const f of ENGINE) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of src.matchAll(call)) {
      const isTrn = m[0].startsWith('trn');
      const vals = [m[1] ?? m[2] ?? m[3], m[4] ?? m[5] ?? m[6]];
      const line = src.slice(0, m.index).split('\n').length;
      (isTrn ? vals.slice(1) : vals.slice(0, 1)).forEach(v => { if (v != null && !keys.has(cook(v))) keys.set(cook(v), `${f}:${line}`); });
    }
    // achievement descriptions (stored in profiles in English, shown through tr())
    if (f === 'js/recombee.js') for (const m of src.matchAll(/desc: '([^']+)'/g)) if (!keys.has(m[1])) keys.set(m[1], f);
  }
  DISPLAY_VALUES.forEach(k => { if (!keys.has(k)) keys.set(k, 'display value'); });
  // the engine's facet vocabulary (CONFIG.facetWords, shown through tr() in ux.js _fw); language names come from Intl
  const fw = fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf8').match(/\n  facetWords: \{([\s\S]*?)\n  \},/);
  if (fw) for (const line of fw[1].split('\n')) {
    if (/^\s*lang:/.test(line)) continue;
    // a { cs: '…', en: '…' } value is per-language already (loc), not a pack key
    for (const m of line.matchAll(/(\w+):\s*'([^']+)'/g)) if (!FW_LANGS.has(m[1]) && !keys.has(m[2])) keys.set(m[2], 'js/config.js facetWords');
  }
  return keys;
}

// index.html text nodes and title/placeholder/aria-label values, as js/i18n.js translateStatic() sees them
function staticKeys() {
  const keys = new Map();
  let html;
  try { html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'); } catch (e) { return keys; }
  const ent = s => s.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', rarr: '→', larr: '←', middot: '·', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', iacute: 'í', aacute: 'á', ccaron: 'č', eacute: 'é', times: '×' })[e] ?? m;
  });
  const norm = s => ent(s).trim().replace(/\s+/g, ' ');
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '');
  for (const m of body.matchAll(/>([^<]+)</g)) { const k = norm(m[1]); if (/[A-Za-zÀ-ž]{2,}/.test(k) && !keys.has(k)) keys.set(k, 'index.html'); }
  for (const m of body.matchAll(/\sdata-i18n="([^"]+)"/g)) if (!keys.has(m[1])) keys.set(m[1], 'index.html');
  for (const m of body.matchAll(/\s(?:title|placeholder|aria-label)="([^"]+)"/g)) { const k = norm(m[1]); if (/[A-Za-zÀ-ž]{2,}/.test(k) && !keys.has(k)) keys.set(k, 'index.html'); }
  const t = html.match(/<title>([^<]*)<\/title>/);
  if (t && !keys.has(norm(t[1]))) keys.set(norm(t[1]), 'index.html');
  return keys;
}

const args = process.argv.slice(2);
const keys = new Map([...engineKeys(), ...staticKeys()]);
if (args.includes('--keys')) { console.log(JSON.stringify([...keys.keys()], null, 1)); process.exit(0); }

const placeholders = s => (String(s).match(/\{\d+\}/g) || []).sort().join('');
const dir = path.join(ROOT, 'js/i18n');
const packs = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^[a-z]{2,3}\.js$/.test(f)) : [];
const only = args.includes('--missing') ? args[args.indexOf('--missing') + 1] : null;
let problems = 0;
for (const f of packs) {
  const lang = f.replace('.js', '');
  if (only && lang !== only) continue;
  const pack = (await import(pathToFileURL(path.join(dir, f)).href)).default;
  const missing = [...keys.keys()].filter(k => !(k in pack));
  if (only) { console.log(JSON.stringify(missing, null, 1)); process.exit(0); }
  const stale = Object.keys(pack).filter(k => !keys.has(k));
  const badArgs = Object.entries(pack).filter(([k, v]) => {
    const vals = v && typeof v === 'object' ? Object.values(v) : [v];
    // a translation may drop an English plural-suffix arg ({1} = 's'), never add one
    return vals.some(x => placeholders(x).split('}').some(p => p && !placeholders(k).includes(p + '}')));
  });
  const engineMissing = missing.filter(k => keys.get(k) !== 'index.html');
  console.log(`${lang}: ${Object.keys(pack).length} keys · missing ${engineMissing.length} engine + ${missing.length - engineMissing.length} index.html · stale ${stale.length} · bad args ${badArgs.length}`);
  engineMissing.slice(0, 15).forEach(k => console.log(`   missing  ${keys.get(k)}  ${JSON.stringify(k).slice(0, 100)}`));
  badArgs.slice(0, 10).forEach(([k]) => console.log(`   bad args ${JSON.stringify(k).slice(0, 100)}`));
  problems += engineMissing.length + badArgs.length;
}
if (!packs.length) console.log(`no packs in js/i18n/ — ${keys.size} keys to translate (--keys)`);
process.exit(problems ? 1 : 0);
