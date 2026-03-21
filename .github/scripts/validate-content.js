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
