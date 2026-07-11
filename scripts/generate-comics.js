#!/usr/bin/env node
// Offline comic generator — one minimalist 4-panel SVG comic per concept.
// Written by GPT (OPENAI_MODEL / --model) against each concept's contract;
// layout, palette and text zones are locked so quality lives in the writing.
//
// Usage:
//   node scripts/generate-comics.js --only collaborative-filtering,embeddings
//   node scripts/generate-comics.js --all --concurrency 5
//   node scripts/generate-comics.js --retry feedback.json   ({id: "issue note"})
//
// Env: OPENAI_API_KEY, OPENAI_BASE_URL (default api.openai.com/v1), COMIC_MODEL.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MODEL = process.env.COMIC_MODEL || 'gpt-5.6-sol';
const BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('Set OPENAI_API_KEY'); process.exit(1); }

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf('--' + name); return i === -1 ? null : (args[i + 1] || true); };
const ONLY = flag('only') ? String(flag('only')).split(',') : null;
const ALL = args.includes('--all');
const CONC = parseInt(flag('concurrency') || '4', 10);
const RETRY_FILE = flag('retry');
const FEEDBACK = RETRY_FILE ? JSON.parse(fs.readFileSync(RETRY_FILE, 'utf8')) : {};

const concepts = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/concepts.json'), 'utf8')).concepts;

// ---------- the locked design system ----------
const SYSTEM = `You are a comic author for "How Recommendations Work", a living book that teaches recommender systems. You write four-panel minimalist comics as SVG. Your comics are known for wit: an everyday human situation that IS the algorithm's mechanism at the same time (double meaning). Readers laugh first, then realize they now understand the concept.

OUTPUT: reply with ONE complete <svg> element and NOTHING else. It must be valid XML (escape & as &amp;, < as &lt;). No markdown fences.

LOCKED LAYOUT (do not deviate):
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 640" font-family="system-ui,sans-serif">
- background: <rect width="800" height="640" rx="14" fill="#FAFAF7" stroke="#E5E7EB"/>
- title: centered at x=400 y=38, font-size 21, font-weight 700, fill #1E1B4B — a witty title with a double meaning (max 52 chars)
- four panels, EXACT frames:
  P1 <rect x="14"  y="56"  width="380" height="264" rx="10" fill="#FFFFFF" stroke="#E5E7EB"/>
  P2 <rect x="406" y="56"  width="380" height="264" rx="10" fill="#FFFFFF" stroke="#E5E7EB"/>
  P3 <rect x="14"  y="336" width="380" height="264" rx="10" fill="#FFFFFF" stroke="#E5E7EB"/>
  P4 <rect x="406" y="336" width="380" height="264" rx="10" fill="#FFFFFF" stroke="#E5E7EB"/>
- inside each panel: visuals live in the TOP ~200px; the caption sits on the LAST line of the panel: font-size 12, fill #6B7280, text-anchor middle at the panel's horizontal center, y = panel_y + 250, max 66 chars (one line only)
- footer take-away: centered x=400 y=626, font-size 13, fill #6B7280, max 95 chars — one plain sentence that states the concept's core idea seriously (this line teaches; the panels amuse)

PALETTE (only these): ink #1E1B4B, gray #6B7280, purple #7C3AED (+fill #EDE9FE), green #10B981 (+#D1FAE5), amber #D97706 (+#FEF3C7), red #EF4444 (+#FEE2E2) sparingly, blue #0EA5E9 (+#E0F2FE), white #FFFFFF, line-gray #E5E7EB.

FIGURES — geometric minimalism: a person = circle head (r 9-11, fill by role color, no face or at most a 2-element face) + simple stroke body/arms (stroke-width 2.5, stroke-linecap round). Objects = basic shapes. MAXIMUM 9 visual elements per panel. Generous whitespace. No gradients, no filters, no <image>, no transforms on <text>.

SPEECH: rounded rect (rx 9, fill #FFFFFF or a light palette fill, stroke matching) + <text> font-size 12.5, max 34 chars per line, max 2 lines per bubble, max 2 bubbles per panel. Keep ALL text at least 12px inside panel borders. Never overlap text with figures or other text.

STORY RULES:
1. One everyday scenario carried through all 4 panels (same characters). The scenario must literally enact the mechanism — the joke and the algorithm are the same thing.
2. P1 setup, P2 development, P3 escalation or complication, P4 twist/punchline that lands the double meaning.
3. The punchline must NOT explain the concept — the footer line does that. Trust the reader.
4. The comic must let a reader answer the concept's recall question afterwards.
5. Wit over slapstick; dry, observational humor. No puns that only work in writing unless visual.`;

function conceptPrompt(c, feedback) {
  const must = (c.contract?.mustCover || []).map(m => '- ' + m.point).join('\n');
  const fb = feedback ? `\n\nA previous attempt failed visual QA: "${feedback}". Fix exactly that; keep what worked.` : '';
  return `CONCEPT: ${c.title} (${c.id})
LEARNING OBJECTIVE: ${c.contract?.objective || ''}
MUST-COVER POINTS (the scenario should touch these, lightly, without lecturing):
${must}
RECALL QUESTION the reader must be able to answer afterwards: ${c.contract?.recallQ || c.contract?.recall?.q || ''}

Write the comic now. Remember: one everyday situation that IS the mechanism; minimalist; every text inside its zone; output only the <svg>.${fb}`;
}

async function callModel(messages) {
  const res = await fetch(BASE + '/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, max_completion_tokens: 20000 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || ('HTTP ' + res.status));
  const out = data.choices?.[0]?.message?.content || '';
  return { out, usage: data.usage };
}

function extractSvg(text) {
  const m = text.match(/<svg[\s\S]*<\/svg>/);
  return m ? m[0] : null;
}

function validXml(svg) {
  try {
    execFileSync('python3', ['-c', 'import sys,xml.etree.ElementTree as ET; ET.fromstring(sys.stdin.read())'], { input: svg, stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch (e) { return false; }
}

// mechanical lint: text must sit inside its panel; catches the worst overflows early
function lint(svg) {
  const problems = [];
  if (!svg.includes('viewBox="0 0 800 640"')) problems.push('wrong viewBox');
  const texts = [...svg.matchAll(/<text[^>]*x="([\d.]+)"[^>]*y="([\d.]+)"[^>]*>([^<]*)</g)];
  for (const [, x, y, content] of texts) {
    if (content.length > 100) problems.push(`text too long (${content.length} chars): "${content.slice(0, 40)}…"`);
    if (parseFloat(y) > 640 || parseFloat(x) > 800) problems.push('text outside canvas');
  }
  return problems;
}

async function generateOne(c, attempt = 1) {
  const fb = FEEDBACK[c.id] || null;
  const { out, usage } = await callModel([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: conceptPrompt(c, fb) },
  ]);
  const svg = extractSvg(out);
  if (!svg) throw new Error('no <svg> in reply');
  if (!validXml(svg)) {
    if (attempt < 3) { console.log(`  ${c.id}: invalid XML, retry ${attempt + 1}`); return generateOne(c, attempt + 1); }
    throw new Error('invalid XML after 3 attempts');
  }
  const problems = lint(svg);
  if (problems.length && attempt < 3) {
    console.log(`  ${c.id}: lint (${problems[0]}), retry ${attempt + 1}`);
    FEEDBACK[c.id] = problems.join('; ');
    return generateOne(c, attempt + 1);
  }
  fs.writeFileSync(path.join(ROOT, 'images', `comic-${c.id}.svg`), svg);
  return { id: c.id, bytes: svg.length, tokens: usage?.completion_tokens, reasoning: usage?.completion_tokens_details?.reasoning_tokens };
}

(async () => {
  let targets = concepts;
  if (ONLY) targets = concepts.filter(c => ONLY.includes(c.id));
  else if (RETRY_FILE) targets = concepts.filter(c => FEEDBACK[c.id]);
  else if (!ALL) { console.error('Pass --all, --only a,b or --retry feedback.json'); process.exit(1); }

  console.log(`Model ${MODEL} · ${targets.length} comics · concurrency ${CONC}`);
  const queue = [...targets];
  const results = [];
  const failures = [];
  const workers = Array.from({ length: CONC }, async () => {
    while (queue.length) {
      const c = queue.shift();
      const t0 = Date.now();
      try {
        const r = await generateOne(c);
        results.push(r);
        console.log(`✓ ${c.id} (${((Date.now() - t0) / 1000).toFixed(0)}s, ${r.bytes}B, ${r.tokens}tok)`);
      } catch (e) {
        failures.push({ id: c.id, error: e.message });
        console.log(`✗ ${c.id}: ${e.message}`);
      }
    }
  });
  await Promise.all(workers);
  console.log(`\nDone: ${results.length} ok, ${failures.length} failed`);
  if (failures.length) console.log(JSON.stringify(failures, null, 1));
  const totTok = results.reduce((s, r) => s + (r.tokens || 0), 0);
  console.log(`Output tokens total: ${totTok}`);
})();
