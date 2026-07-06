#!/usr/bin/env node
// Facet migration — p-book v2 personalization model (see _design-collective-pbook.md)
//
// Additive, idempotent migration:
//   1. Groups blocks into CONCEPTS (each '-spine-' file anchors a concept,
//      satellites attach to the nearest preceding spine in reading order).
//   2. Adds FLAT facet keys to frontmatter (the app's YAML parser does not
//      support nested maps): concept, state, lens, visuality, depth,
//      formalism, lengthBand, genre.
//   3. Bootstraps content/concepts.json with contracts derived from the
//      anchor block's human-reviewed frontmatter (highlights → mustCover,
//      recallQ/recallA → recall contract).
//
// Existing keys are NEVER modified; `voice` stays for back-compat.
// Run: node scripts/migrate-facets.js [--dry]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const BOOK = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, 'book.json'), 'utf8'));
const DRY = process.argv.includes('--dry');

// --- Facet vocabularies (Tier 1 — keep in sync with js/config.js FACETS) ---
const FORBIDDEN_DEFAULT = [
  'invented statistics or benchmark numbers',
  'invented citations, URLs, or paper titles',
  'claiming a single method fully solves the problem',
];

// --- Simple YAML parser (mirrors js/markdown.js parseYaml: flat keys + "- item" lists) ---
function parseYaml(yaml) {
  const result = {};
  let ck = null, ca = null;
  for (const line of yaml.split('\n')) {
    const am = line.match(/^\s+-\s+(.*)/);
    if (am && ck) {
      if (!ca) ca = [];
      let v = am[1].trim().replace(/^["']|["']$/g, '');
      ca.push(v);
      result[ck] = ca;
      continue;
    }
    const kv = line.match(/^(\w[\w-]*)\s*:\s*(.*)/);
    if (kv) {
      ck = kv[1].trim();
      const v = kv[2].trim();
      if (v === '') { ca = []; result[ck] = ca; }
      else {
        ca = null;
        let val = v.replace(/^["']|["']$/g, '');
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        else if (val === 'null' || val === '~') val = null;
        else if (/^\d+$/.test(val)) val = parseInt(val, 10);
        result[ck] = val;
      }
    }
  }
  return result;
}

function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  return { fm: m[1], body: m[2] };
}

// --- Facet derivation rules ---
function countFormulas(body) {
  const display = (body.match(/\$\$[\s\S]*?\$\$/g) || []).length;
  const inline = (body.match(/\\\((.*?)\\\)/g) || []).length + (body.match(/\$[^$\n]+\$/g) || []).length;
  const latexCmd = (body.match(/\\(frac|sum|prod|argmin|argmax|mathbf|hat|lambda|theta|cdot|nabla)/g) || []).length;
  return display * 2 + inline + (latexCmd > 3 ? 2 : 0);
}

// carriers = mechanical composition descriptor (set): what building blocks are present.
// DERIVED — recomputed on every run, overwriting any existing value (unlike all other keys).
function deriveCarriers(meta, body) {
  const c = [];
  const noCode = body.replace(/```[\s\S]*?```/g, '');
  if (noCode.split(/\s+/).filter(Boolean).length > 40) c.push('prose');
  if (/\n\|[^\n]*\|\s*\n\|[\s:|-]+\|/.test(noCode)) c.push('table');
  if (/!\[/.test(noCode)) c.push('image');
  if (meta.diagram || /<svg/i.test(noCode)) c.push(meta.genre === 'animation' || /anim/.test(String(meta.diagram || '')) ? 'animation' : 'diagram');
  if (/\$\$|\\\(|\$[^$\n]+\$/.test(noCode)) c.push('formula');
  if (/```/.test(body)) c.push('code');
  return c.length ? c.join('|') : 'prose';
}

function deriveFacets(meta, body, filename) {
  const formulas = countFormulas(body);
  const hasCode = /```/.test(body);
  const hasVisual = !!meta.diagram || /!\[/.test(body) || /<svg/i.test(body);

  let formalism = formulas === 0 ? 'none' : formulas <= 2 ? 'light' : 'full';

  let depth;
  if (formulas >= 4 || /math|-deep\b|deep-/.test(filename) && meta.voice === 'thinker') depth = 'research';
  else if (meta.voice === 'thinker' || meta.voice === 'creator' || formulas >= 1 || hasCode) depth = 'technical';
  else depth = 'standard';
  // validity rule: formalism full ⇒ depth ≥ technical
  if (formalism === 'full' && depth === 'standard') depth = 'technical';

  const visuality = hasVisual ? 'balanced' : 'text-first';

  const rt = typeof meta.readingTime === 'number' ? meta.readingTime : 3;
  const lengthBand = rt <= 1 ? 'tldr' : rt <= 4 ? 'standard' : 'deep';

  let genre = null;
  if (meta.type === 'spine') {
    if (hasCode) genre = 'code-walkthrough';
    else if (meta.voice === 'creator' || /worksheet|experiment/.test(filename)) genre = 'worked-example';
    else genre = 'explainer';
  }

  const state = meta.core === true ? 'core' : 'edited';

  return { state, lens: 'generic', visuality, depth, formalism, lengthBand, genre };
}

// --- Pass 1: read all files, group into concepts ---
const concepts = [];        // { id, title, chapter, anchorId, blocks: [{id, file}] }
const fileFacets = new Map(); // absolute path → { facets, meta }
let orphanBuffer = [];      // satellites before the first spine of a chapter

for (const ch of BOOK.chapters) {
  let current = null;
  orphanBuffer = [];
  for (const f of ch.files) {
    const full = path.join(CONTENT_DIR, ch.directory, f);
    if (!fs.existsSync(full)) { console.warn(`SKIP missing ${f}`); continue; }
    const text = fs.readFileSync(full, 'utf8');
    const parts = splitFrontmatter(text);
    if (!parts) { console.warn(`SKIP no frontmatter ${f}`); continue; }
    const meta = parseYaml(parts.fm);
    const facets = deriveFacets(meta, parts.body, f);
    fileFacets.set(full, { facets, meta, parts, file: f, chapter: ch.id });

    const isAnchor = f.includes('-spine-');
    if (isAnchor) {
      // concept id: explicit `concept:` on the anchor wins (short noun-phrase slug,
      // decoupled from the block id); `conceptTitle:` names it concisely for humans
      const cid = (typeof meta.concept === 'string' && meta.concept && !meta.concept.includes('|'))
        ? meta.concept : meta.id;
      current = {
        id: cid, title: meta.conceptTitle || meta.title || cid, chapter: ch.id,
        anchorId: meta.id, anchorPath: `${ch.directory}/${f}`, blocks: [],
        _anchorMeta: meta,
      };
      concepts.push(current);
      // adopt any satellites that appeared before this spine
      for (const orphan of orphanBuffer) { orphan.concept = current.id; current.blocks.push(orphan.entry); }
      orphanBuffer = [];
      current.blocks.push({ id: meta.id, file: f });
      facets.concept = current.id;
    } else if (current) {
      current.blocks.push({ id: meta.id, file: f });
      facets.concept = current.id;
    } else {
      // satellite before first spine — buffer until the chapter's first anchor
      orphanBuffer.push({ entry: { id: meta.id, file: f }, facetsRef: facets, meta });
    }
  }
  // leftover orphans (chapter with no spine at all): make the first block the anchor
  if (orphanBuffer.length) {
    const first = orphanBuffer[0];
    const fm = first.meta || {};
    const cid = (typeof fm.concept === 'string' && fm.concept && !fm.concept.includes('|')) ? fm.concept : first.entry.id;
    const c = {
      id: cid, title: fm.conceptTitle || fm.title || cid, chapter: ch.id,
      anchorId: first.entry.id, blocks: [], _anchorMeta: fm,
    };
    concepts.push(c);
    for (const o of orphanBuffer) { o.facetsRef.concept = c.id; c.blocks.push(o.entry); }
    orphanBuffer = [];
  }
}
// resolve buffered orphans' concept assignment (set via facetsRef above; anchors set inline)
for (const [, v] of fileFacets) {
  if (!v.facets.concept) {
    // orphan adopted by a later spine in its chapter
    const c = concepts.find(c => c.blocks.some(b => b.id === v.meta.id));
    v.facets.concept = c ? c.id : v.meta.id;
  }
}

// --- Pass 2: write facet keys into frontmatter (only missing keys, append before closing ---) ---
const FACET_KEYS = ['concept', 'state', 'lens', 'visuality', 'depth', 'formalism', 'lengthBand', 'genre'];
let filesTouched = 0;
for (const [full, v] of fileFacets) {
  const { facets, meta, parts } = v;
  const newLines = [];
  for (const k of FACET_KEYS) {
    if (meta[k] !== undefined) continue;           // never overwrite existing keys
    if (facets[k] === null || facets[k] === undefined) continue;
    newLines.push(`${k}: ${facets[k]}`);
  }
  // carriers is DERIVED: recompute every run; update in place when stale
  const carriers = deriveCarriers(meta, parts.body);
  let fm = parts.fm;
  let touched = false;
  if (meta.carriers === undefined) { newLines.push(`carriers: ${carriers}`); }
  else if (meta.carriers !== carriers) { fm = fm.replace(/^carriers: .*$/m, `carriers: ${carriers}`); touched = true; }
  if (!newLines.length && !touched) continue;
  const updated = `---\n${fm}${newLines.length ? '\n' + newLines.join('\n') : ''}\n---\n${parts.body}`;
  filesTouched++;
  if (!DRY) fs.writeFileSync(full, updated);
}

// --- Pass 3: concepts.json with bootstrapped contracts ---
const conceptsOut = concepts.map(c => {
  const a = c._anchorMeta || {};
  const mustCover = Array.isArray(a.highlights)
    ? a.highlights.map(h => ({ point: String(h), modality: 'prose' }))
    : [];
  return {
    id: c.id,
    title: c.title,
    chapter: c.chapter,
    anchor: c.anchorId,
    anchorPath: c.anchorPath || null,  // content-relative path to the anchor block (generation exemplar)
    provenance: 'anchored',            // human-reviewed content (status: accepted)
    blocks: c.blocks.map(b => b.id),
    contract: {
      objective: a.teaser || c.title,
      objectiveSource: a.teaser ? 'teaser-bootstrap' : 'title-bootstrap',
      mustCover,
      recallQ: a.recallQ || null,
      recallA: a.recallA || null,
      forbidden: FORBIDDEN_DEFAULT,
    },
  };
});

// Multi-concept membership ("concept: a|b"): list the block under EVERY named concept
const byId = new Map(conceptsOut.map(c => [c.id, c]));
for (const [, v] of fileFacets) {
  const declared = String(v.meta.concept || v.facets.concept || '');
  if (!declared.includes('|')) continue;
  for (const cid of declared.split('|').map(s => s.trim())) {
    const rec = byId.get(cid);
    if (rec && !rec.blocks.includes(v.meta.id)) rec.blocks.push(v.meta.id);
  }
}

if (!DRY) {
  fs.writeFileSync(
    path.join(CONTENT_DIR, 'concepts.json'),
    JSON.stringify({ version: 1, generatedBy: 'scripts/migrate-facets.js', concepts: conceptsOut }, null, 2)
  );
}

// --- Report ---
const stats = { research: 0, technical: 0, standard: 0 };
const gaps = { noRecall: 0, noMustCover: 0 };
for (const [, v] of fileFacets) stats[v.facets.depth] = (stats[v.facets.depth] || 0) + 1;
for (const c of conceptsOut) {
  if (!c.contract.recallQ) gaps.noRecall++;
  if (!c.contract.mustCover.length) gaps.noMustCover++;
}
console.log(`${DRY ? '[DRY RUN] ' : ''}Concepts: ${conceptsOut.length}`);
console.log(`Files with facets added: ${filesTouched}/${fileFacets.size}`);
console.log(`Depth distribution:`, stats);
console.log(`Contract gaps: ${gaps.noRecall} concepts without recallQ, ${gaps.noMustCover} without mustCover (listed in coverage matrix as editorial debt)`);
