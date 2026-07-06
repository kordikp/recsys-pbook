#!/usr/bin/env node
// Content validation script for p-book CI pipeline
// Checks: frontmatter schema, unique IDs, book.json consistency, game references

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CONTENT_DIR = path.join(ROOT, 'content');
const GAMES_DIR = path.join(ROOT, 'games');
const BOOK_JSON = path.join(CONTENT_DIR, 'book.json');

let errors = 0;
let warnings = 0;
const ids = new Map(); // id → file path
const conceptRefs = new Map(); // block id → { concept, file }
const conceptLinkRefs = [];    // [..](#c/<slug>) cross-links found in bodies
const blockLinkRefs = [];      // [..](#<block-id>) links found in bodies

function error(file, msg) { console.error(`  ERROR: ${file}: ${msg}`); errors++; }
function warn(file, msg) { console.warn(`  WARN:  ${file}: ${msg}`); warnings++; }

// Parse YAML frontmatter (simple parser matching the app's parser)
function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const meta = {};
  match[1].split('\n').forEach(line => {
    const kv = line.match(/^(\w[\w-]*)\s*:\s*(.*)/);
    if (kv) {
      let val = kv[2].trim();
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (val === 'null' || val === '~') val = null;
      else if (/^\d+$/.test(val)) val = parseInt(val, 10);
      else val = val.replace(/^["']|["']$/g, '');
      meta[kv[1]] = val;
    }
  });
  return meta;
}

// 1. Validate all content .md files
console.log('Validating content files...\n');

const VALID_TYPES = ['spine', 'question', 'game'];
const contentFiles = [];

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(entry => {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) scanDir(full);
    else if (entry.endsWith('.md')) contentFiles.push(full);
  });
}
scanDir(CONTENT_DIR);

contentFiles.forEach(file => {
  const rel = path.relative(ROOT, file);
  const text = fs.readFileSync(file, 'utf8');
  const meta = parseFrontmatter(text);

  if (!meta) {
    error(rel, 'Missing or invalid YAML frontmatter (must start with ---)');
    return;
  }

  // Required fields
  if (!meta.id) error(rel, 'Missing required field: id');
  if (!meta.type) error(rel, 'Missing required field: type');
  if (!meta.title) error(rel, 'Missing required field: title');

  // Valid type
  if (meta.type && !VALID_TYPES.includes(meta.type)) {
    error(rel, `Invalid type: "${meta.type}" (must be one of: ${VALID_TYPES.join(', ')})`);
  }

  // Unique ID
  if (meta.id) {
    if (ids.has(meta.id)) {
      error(rel, `Duplicate id "${meta.id}" (also in ${ids.get(meta.id)})`);
    } else {
      ids.set(meta.id, rel);
    }
  }

  // Game reference
  if (meta.type === 'game' && meta.game) {
    const gameFile = path.join(GAMES_DIR, `${meta.game}.json`);
    if (!fs.existsSync(gameFile)) {
      error(rel, `Game file not found: games/${meta.game}.json`);
    }
  }

  // Core + status check
  if (meta.core === true && meta.status && meta.status !== 'accepted') {
    warn(rel, 'Core content should have status: accepted');
  }

  // Facet system (flat keys, see _design-collective-pbook.md §3) — enum + validity checks.
  // Subspace syntax is allowed: "a|b" (set) and "a..b" (range on ordered scales).
  const FACET_ENUMS = {
    state: ['core', 'edited', 'community', 'private', 'archived'],
    lens: ['generic', 'ecommerce', 'media', 'social-feeds', 'education', 'jobs'],
    visuality: ['text-first', 'balanced', 'visual-first'],
    depth: ['intro', 'standard', 'technical', 'research'],
    formalism: ['none', 'light', 'full'],
    lengthBand: ['tldr', 'standard', 'deep'],
    genre: ['explainer', 'story', 'worked-example', 'code-walkthrough', 'comic', 'animation'],
    lang: ['en', 'cs'],
    carriers: ['prose', 'table', 'diagram', 'image', 'animation', 'formula', 'code'],
  };
  const ORDERED = new Set(['visuality', 'depth', 'formalism', 'lengthBand']);
  for (const [key, allowed] of Object.entries(FACET_ENUMS)) {
    if (meta[key] === undefined) continue;
    const raw = String(meta[key]);
    if (raw.includes('..')) {
      if (key === 'state' || !ORDERED.has(key)) { error(rel, `Range syntax "a..b" not allowed on ${key}`); continue; }
      const [a, b] = raw.split('..').map(s => s.trim());
      if (!allowed.includes(a) || !allowed.includes(b)) error(rel, `Invalid ${key} range: "${raw}"`);
      else if (allowed.indexOf(a) > allowed.indexOf(b)) error(rel, `Reversed ${key} range: "${raw}"`);
      continue;
    }
    const parts = raw.split('|').map(s => s.trim());
    if (parts.length > 1 && key === 'state') { error(rel, 'state must be a single value'); continue; }
    for (const p of parts) {
      if (!allowed.includes(p)) error(rel, `Invalid ${key}: "${p}" (must be one of: ${allowed.join(', ')})`);
    }
  }
  // Validity rules between facets
  if (meta.formalism === 'full' && (meta.depth === 'intro' || meta.depth === 'standard')) {
    warn(rel, 'formalism: full with depth intro/standard violates facet validity rules');
  }
  // state must mirror core flag for git content
  if (meta.core === true && meta.state && meta.state !== 'core') {
    warn(rel, `core: true but state: ${meta.state} (expected state: core)`);
  }
  // Visuality honesty (AGENTS.md deletion test): visual-first REQUIRES a visual
  if (meta.visuality) {
    const bodyText = text.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/```[\s\S]*?```/g, '');
    const hasVisual = !!meta.diagram || /!\[/.test(bodyText) || /<svg/i.test(bodyText);
    const vis = String(meta.visuality);
    if (/visual-first/.test(vis) && !hasVisual) error(rel, 'visuality claims visual-first but the block has no diagram or image (deletion test)');
    if (vis === 'balanced' && !hasVisual && !/\n\|[^\n]*\|\s*\n\|[\s:|-]+\|/.test(bodyText)) warn(rel, 'visuality: balanced without any diagram, image, or table');
  }

  // multi-concept membership allowed: "concept: a|b" (block is a telling of each)
  if (meta.concept) conceptRefs.set(meta.id, { concepts: String(meta.concept).split('|').map(s => s.trim()), file: rel });

  // cross-link convention (AGENTS.md): collect [..](#c/<slug>) and [..](#<block-id>) targets
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, '');
  for (const m of body.matchAll(/\]\(#c\/([\w-]+)\)/g)) conceptLinkRefs.push({ slug: m[1], file: rel });
  for (const m of body.matchAll(/\]\(#(?!c\/)([\w-]+)\)/g)) blockLinkRefs.push({ id: m[1], file: rel });
});

// 2. Validate book.json
console.log('Validating book.json...\n');

if (!fs.existsSync(BOOK_JSON)) {
  error('content/book.json', 'File not found');
} else {
  const book = JSON.parse(fs.readFileSync(BOOK_JSON, 'utf8'));

  if (!book.chapters || !Array.isArray(book.chapters)) {
    error('book.json', 'Missing or invalid chapters array');
  } else {
    book.chapters.forEach((ch, ci) => {
      if (!ch.id) error(`book.json ch[${ci}]`, 'Missing chapter id');
      if (!ch.directory) error(`book.json ch[${ci}]`, 'Missing chapter directory');
      if (!ch.files || !Array.isArray(ch.files)) {
        error(`book.json ch[${ci}]`, 'Missing or invalid files array');
        return;
      }

      const chDir = path.join(CONTENT_DIR, ch.directory);
      if (!fs.existsSync(chDir)) {
        error(`book.json ch[${ci}]`, `Directory not found: content/${ch.directory}`);
        return;
      }

      ch.files.forEach(f => {
        const filePath = path.join(chDir, f);
        if (!fs.existsSync(filePath)) {
          error(`book.json ch[${ci}]`, `File not found: content/${ch.directory}/${f}`);
        }
      });
    });
  }
}

// 2b. Validate concepts.json (concept index + contracts, generated by scripts/migrate-facets.js)
console.log('Validating concepts.json...\n');

const CONCEPTS_JSON = path.join(CONTENT_DIR, 'concepts.json');
if (fs.existsSync(CONCEPTS_JSON)) {
  try {
    const conceptsData = JSON.parse(fs.readFileSync(CONCEPTS_JSON, 'utf8'));
    const conceptIds = new Set((conceptsData.concepts || []).map(c => c.id));
    // every block's concept ref(s) must exist in the index
    for (const [blockId, ref] of conceptRefs) {
      for (const c of ref.concepts) {
        if (!conceptIds.has(c)) {
          error(ref.file, `Block "${blockId}" references unknown concept "${c}" (re-run scripts/migrate-facets.js)`);
        }
      }
    }
    // cross-link targets must exist (AGENTS.md link convention)
    for (const l of conceptLinkRefs) {
      if (!conceptIds.has(l.slug)) error(l.file, `Concept link "#c/${l.slug}" points at an unknown concept`);
    }
    for (const l of blockLinkRefs) {
      if (!ids.has(l.id)) warn(l.file, `Block link "#${l.id}" points at an unknown block id (prefer concept links #c/<slug>)`);
    }
    // every concept's anchor must be a real block; contract gaps are warnings (editorial debt)
    for (const c of conceptsData.concepts || []) {
      if (c.anchor && !ids.has(c.anchor)) error('concepts.json', `Concept "${c.id}" anchor "${c.anchor}" is not a known block id`);
      if (!c.contract?.recallQ) warn('concepts.json', `Concept "${c.id}" has no recallQ (contract gap — shown in admin Coverage)`);
    }
  } catch (e) {
    error('concepts.json', `Invalid JSON: ${e.message}`);
  }
} else {
  warn('content/concepts.json', 'Missing — run scripts/migrate-facets.js to generate the concept index');
}

// 3. Validate game JSON files
console.log('Validating game files...\n');

if (fs.existsSync(GAMES_DIR)) {
  fs.readdirSync(GAMES_DIR).filter(f => f.endsWith('.json')).forEach(file => {
    const full = path.join(GAMES_DIR, file);
    try {
      const game = JSON.parse(fs.readFileSync(full, 'utf8'));
      if (!game.type) error(`games/${file}`, 'Missing required field: type');
      if (!game.title) error(`games/${file}`, 'Missing required field: title');
      if (game.type === 'sort' && (!game.items || !game.buckets)) {
        error(`games/${file}`, 'Sort game requires items[] and buckets[]');
      }
      if (game.type === 'order' && !game.steps) {
        error(`games/${file}`, 'Order game requires steps[]');
      }
      if (game.type === 'match' && (!game.items || !game.users)) {
        error(`games/${file}`, 'Match game requires items[] and users[]');
      }
      if (game.type === 'pop' && !game.categories) {
        error(`games/${file}`, 'Pop game requires categories[]');
      }
    } catch (e) {
      error(`games/${file}`, `Invalid JSON: ${e.message}`);
    }
  });
}

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Content files: ${contentFiles.length}`);
console.log(`Unique IDs: ${ids.size}`);
console.log(`Errors: ${errors}`);
console.log(`Warnings: ${warnings}`);
console.log('='.repeat(50));

if (errors > 0) {
  console.error('\nValidation FAILED');
  process.exit(1);
} else {
  console.log('\nValidation PASSED');
}
