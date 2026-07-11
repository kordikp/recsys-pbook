#!/usr/bin/env node
// SVG improver — sends existing illustrations to GPT for restyle/repair while
// preserving ALL informational content. Driven by a feedback map {file: issues}.
//
//   node scripts/improve-images.js --plan plan.json [--concurrency 4]
//   plan.json: { "diagram-x.svg": {"mode":"restyle"|"rebuild", "issues":"..."} }

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MODEL = process.env.COMIC_MODEL || 'gpt-5.6-sol';
const BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('Set OPENAI_API_KEY'); process.exit(1); }

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf('--' + n); return i === -1 ? null : args[i + 1]; };
const PLAN = JSON.parse(fs.readFileSync(flag('plan'), 'utf8'));
const CONC = parseInt(flag('concurrency') || '4', 10);

const SYSTEM = `You improve SVG illustrations for the living book "How Recommendations Work". You receive an existing SVG plus a QA note, and return an improved SVG.

THE DESIGN SYSTEM (target look):
- background: light warm card #FAFAF7 with #E5E7EB border (rx 14) — never dark
- title: #1E1B4B, bold; captions/secondary: #6B7280
- accents ONLY from: purple #7C3AED (+fill #EDE9FE), green #10B981 (+#D1FAE5), amber #D97706 (+#FEF3C7), blue #0EA5E9 (+#E0F2FE), red #EF4444 (+#FEE2E2, sparingly), white cards #FFFFFF
- REPLACE all teal (#0d9488/#14b8a6/#0f766e family) with green #10B981 or blue #0EA5E9
- REPLACE black/dark-navy filled panels with a light treatment: #FFFFFF or #EDE9FE fill, 2px #7C3AED border, ink #1E1B4B text (exception: an element whose MEANING is "black box" may stay dark)
- minimum font-size 11; every text inside its container with >=6px padding; no text overlapping lines, shapes or other text
- if the SVG contains CSS animations keep them, but every element must be VISIBLE at rest (no opacity:0 resting states); at most one subtle loop

RULES:
1. PRESERVE all informational content: every label, number, relationship and the overall layout topology. You may reposition/resize elements and shorten decorative text to fix collisions, but never drop a concept.
2. mode=restyle: keep the layout; recolor + fix the listed defects.
3. mode=rebuild: the original is broken (invisible/empty areas); redesign the visual from its extracted content in the design system, static-friendly.
4. Output ONE complete valid-XML <svg> element and NOTHING else (escape & as &amp;). Keep the original viewBox unless the fix requires more room (then grow height only).`;

function callModel(messages) {
  return fetch(BASE + '/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, max_completion_tokens: 32000 }),
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || ('HTTP ' + res.status));
    return { out: data.choices?.[0]?.message?.content || '', usage: data.usage };
  });
}

const extractSvg = (t) => { const m = t.match(/<svg[\s\S]*<\/svg>/); return m ? m[0] : null; };
function validXml(svg) {
  try {
    execFileSync('python3', ['-c', 'import sys,xml.etree.ElementTree as ET; ET.fromstring(sys.stdin.read())'], { input: svg, stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch (e) { return false; }
}

async function improveOne(file, spec, attempt = 1) {
  const p = path.join(ROOT, 'images', file);
  const original = fs.readFileSync(p, 'utf8');
  const user = `FILE: ${file}
MODE: ${spec.mode}
QA NOTE (fix exactly this, plus any same-class problems you spot): ${spec.issues}

ORIGINAL SVG:
${original}

Return the improved SVG now.`;
  const { out, usage } = await callModel([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ]);
  const svg = extractSvg(out);
  if (!svg || !validXml(svg)) {
    if (attempt < 3) return improveOne(file, spec, attempt + 1);
    throw new Error('invalid output after 3 attempts');
  }
  // safety: refuse suspicious shrinkage (content probably dropped)
  if (svg.length < original.length * 0.35 && spec.mode === 'restyle') {
    if (attempt < 3) return improveOne(file, spec, attempt + 1);
    throw new Error(`output suspiciously small (${svg.length}B vs ${original.length}B)`);
  }
  fs.writeFileSync(p, svg);
  return { file, bytes: svg.length, was: original.length, tokens: usage?.completion_tokens };
}

(async () => {
  const jobs = Object.entries(PLAN);
  console.log(`Model ${MODEL} · ${jobs.length} images · concurrency ${CONC}`);
  const queue = [...jobs];
  const failures = [];
  let done = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (queue.length) {
      const [file, spec] = queue.shift();
      const t0 = Date.now();
      try {
        const r = await improveOne(file, spec);
        console.log(`✓ ${file} (${((Date.now() - t0) / 1000).toFixed(0)}s, ${r.was}→${r.bytes}B, ${r.tokens}tok) [${++done}/${jobs.length}]`);
      } catch (e) {
        failures.push({ file, error: e.message });
        console.log(`✗ ${file}: ${e.message}`);
      }
    }
  }));
  console.log(`\nDone: ${jobs.length - failures.length} ok, ${failures.length} failed`);
  if (failures.length) console.log(JSON.stringify(failures, null, 1));
})();
