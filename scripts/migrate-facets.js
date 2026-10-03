#!/usr/bin/env node
// Facet migration — p-book v2 personalization model (see _design-collective-pbook.md)
//
// Additive, idempotent migration:
//   1. Groups blocks into CONCEPTS (each '-spine-' file anchors a concept;
//      a satellite's explicit `concept:` decides its membership, and only a
//      satellite WITHOUT one attaches to the nearest preceding spine in
//      reading order — that value is then written into its frontmatter).
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
// Quoted values are unescaped like js/markdown.js cleanVal (\" → ", \' → '), so
// contracts in concepts.json never carry literal backslashes.
function unquote(v) {
  const quoted = (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"));
  const s = v.replace(/^["']|["']$/g, '');
  return quoted ? s.replace(/\\"/g, '"').replace(/\\'/g, "'") : s;
}
function parseYaml(yaml) {
  const result = {};
  let ck = null, ca = null;
  for (const line of yaml.split('\n')) {
    const am = line.match(/^\s+-\s+(.*)/);
    if (am && ck) {
      if (!ca) ca = [];
      let v = unquote(am[1].trim());
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
        let val = unquote(v);
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
  // AGENTS §2 counts formulas, not LaTeX tokens: each display or inline formula is one.
  void latexCmd;
  return display + inline;
}

// Body words without SVG/markup — the unit of the AGENTS §2 lengthBand budgets.
function countWords(body) {
  const prose = body.replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/<[^>]+>/g, ' ').replace(/\]\([^)]*\)/g, ']');
  return (prose.match(/[A-Za-z0-9À-ž]+(?:['’-][A-Za-z0-9À-ž]+)*/g) || []).length;
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

  // Seed only (existing tags are never overwritten). The retired voice key no
  // longer drives depth, and research is never guessed: it needs a reading
  // (notation, derivations or literature, AGENTS §2).
  let depth = formalism === 'full' || hasCode ? 'technical' : 'standard';

  const visuality = hasVisual ? 'balanced' : 'text-first';

  const words = countWords(body);
  const lengthBand = words <= 150 ? 'tldr' : words <= 450 ? 'standard' : 'deep';

  let genre = null;
  if (meta.type === 'spine') {
    const lines = body.split('\n').length || 1;
    const codeLines = (body.match(/```[\s\S]*?```/g) || []).reduce((s, b) => s + b.split('\n').length, 0);
    if (codeLines / lines >= 0.25) genre = 'code-walkthrough';   // code is the spine, not a snippet
    else if (/worksheet|experiment/.test(filename)) genre = 'worked-example';
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

// --- Pass 1b: a satellite's explicit `concept:` wins over reading order ---
// Reading order only BOOTSTRAPS membership (it fills a missing `concept:` key).
// Once the key exists it is the source of truth: re-assigning a telling means
// editing `concept:` (validate-content.js then flags a chapter/order mismatch),
// and moving a file in book.json never silently changes what it teaches.
// For "concept: a|b" the first value is the primary membership.
const conceptById = new Map(concepts.map(c => [c.id, c]));
for (const [, v] of fileFacets) {
  if (v.file.includes('-spine-')) continue;                 // anchors define concepts
  const declared = typeof v.meta.concept === 'string' ? v.meta.concept.split('|')[0].trim() : '';
  if (!declared || declared === v.facets.concept) continue;
  const target = conceptById.get(declared);
  if (!target) { console.warn(`WARN ${v.file}: concept "${declared}" has no anchor; kept under "${v.facets.concept}" (reading order)`); continue; }
  const from = conceptById.get(v.facets.concept);
  if (from) from.blocks = from.blocks.filter(b => b.id !== v.meta.id);
  target.blocks.push({ id: v.meta.id, file: v.file });
  v.facets.concept = declared;
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
    // prerequisite concepts: flat `parents: a|b` on the anchor (same pipe syntax as subspaces)
    parents: String(a.parents || '').split('|').map(s => s.trim()).filter(Boolean),
    blocks: c.blocks.map(b => b.id),
    contract: {
      // `objective:` on the anchor is the human-reviewed learning objective; the teaser is only a fallback
      objective: a.objective || a.teaser || c.title,
      objectiveSource: a.objective ? 'anchor' : a.teaser ? 'teaser-bootstrap' : 'title-bootstrap',
      mustCover,
      recallQ: a.recallQ || null,
      recallA: a.recallA || null,
      // concept-specific forbidden claims: flat `forbidden: claim | claim` on the anchor, on top of the defaults
      forbidden: [...FORBIDDEN_DEFAULT, ...String(a.forbidden || '').split(' | ').map(x => x.trim()).filter(Boolean)],
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

// Front/back matter ("concept: null" on a satellite, e.g. About this book) is a
// telling of NO concept: keep it out of every concept's block list, which reading
// order would otherwise extend with it.
const noConcept = new Set([...fileFacets.values()]
  .filter(v => v.meta.concept === null && !v.file.includes('-spine-')).map(v => v.meta.id));
for (const c of conceptsOut) c.blocks = c.blocks.filter(id => !noConcept.has(id));

if (!DRY) {
  fs.writeFileSync(
    path.join(CONTENT_DIR, 'concepts.json'),
    JSON.stringify({ version: 1, generatedBy: 'scripts/migrate-facets.js', concepts: conceptsOut }, null, 2)
  );
}

// concept-map.json is what the reader app reads for prerequisite nudges and
// feed ordering (node.prereq). An anchor that declares `parents:` is the
// source of truth for its node; undeclared nodes keep what admin exported.
const CMAP_PATH = path.join(CONTENT_DIR, 'concept-map.json');
let cmapChanged = 0;
if (fs.existsSync(CMAP_PATH)) {
  const cmap = JSON.parse(fs.readFileSync(CMAP_PATH, 'utf8'));
  const declared = new Map(concepts
    .filter(c => c._anchorMeta && c._anchorMeta.parents !== undefined)
    .map(c => [c.id, byId.get(c.id).parents]));
  for (const n of cmap.nodes || []) {
    if (!declared.has(n.slug)) continue;
    const want = declared.get(n.slug);
    const have = Array.isArray(n.prereq) ? n.prereq : [];
    if (want.join('|') === have.join('|')) continue;
    if (want.length) n.prereq = want; else delete n.prereq;
    cmapChanged++;
  }
  if (cmapChanged && !DRY) fs.writeFileSync(CMAP_PATH, JSON.stringify(cmap, null, 1));
}

// --- Report ---
const stats = {};   // declared depth tags as they stand in the files (not the seed heuristic)
const gaps = { noRecall: 0, noMustCover: 0 };
for (const [, v] of fileFacets) { const d = String(v.meta.depth || v.facets.depth); stats[d] = (stats[d] || 0) + 1; }
for (const c of conceptsOut) {
  if (!c.contract.recallQ) gaps.noRecall++;
  if (!c.contract.mustCover.length) gaps.noMustCover++;
}
console.log(`${DRY ? '[DRY RUN] ' : ''}Concepts: ${conceptsOut.length}`);
console.log(`Files with facets added: ${filesTouched}/${fileFacets.size}`);
console.log(`Depth distribution:`, stats);
console.log(`Contract gaps: ${gaps.noRecall} concepts without recallQ, ${gaps.noMustCover} without mustCover (listed in coverage matrix as editorial debt)`);
console.log(`Prerequisites: ${conceptsOut.filter(c => c.parents.length).length} concepts declare parents; concept-map.json nodes updated: ${cmapChanged}`);
