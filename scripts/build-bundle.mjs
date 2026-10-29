#!/usr/bin/env node
// Content bundle: the reader's whole book in ONE request instead of one per file.
//
//   node scripts/build-bundle.mjs [book-dir]       (Vercel runs it as the buildCommand)
//
// Writes content/bundle.<lang>.json for every language of the book (CONFIG.book.languages,
// else CONFIG.book.lang): { files: { "<chapter dir>/<file>": "<markdown>" }, json: { "<url>": … } }
// with every file of book.json and the start-up JSON files the book has (concepts, proposals,
// missions, aliases, concept map — keyed by the URL the engine asks for; a missing one is absent).
// What a reader of the language never sees (js/app.js _filterLanguage) is cut down to the frontmatter
// the language filter reads (id, translationOf, lang, status, concept) and marked bundleStub: other
// languages' translations, so a Czech reader does not download the English book, and outside the book's
// own language also an original translated into it, or with languageFilter 'strict' one that does not
// speak it. A cut block that stays in the book after all is fetched whole by the engine.
// The engine (_prefetch, loadAllContent) fetches book.json and content/bundle.<LANG>.json and
// falls back to single files for anything the bundle lacks — no bundle (local serve) means the old way.
//
// The bundles are build output: git-ignored, rebuilt on every deploy, never edited by hand.
// A stale bundle would serve stale text, so a local server must rebuild it after content edits.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const ROOT = path.resolve(process.argv[2] || '.');
const { CONFIG } = await import(pathToFileURL(path.join(ROOT, 'js/config.js')).href);
const contentDir = path.join(ROOT, CONFIG.book.contentDir || 'content');
const book = JSON.parse(fs.readFileSync(path.join(ROOT, CONFIG.book.bookIndex || 'content/book.json'), 'utf8'));
const langs = CONFIG.book.languages || [CONFIG.book.lang || 'en'];
const KEEP = new Set(['id', 'translationOf', 'lang', 'status', 'concept']);
const bookLang = CONFIG.book.lang || 'en';
const strict = CONFIG.book.languageFilter === 'strict';
const fmKey = (fm, k) => ((fm || '').match(new RegExp(`^${k}:\\s*['"]?([^'"\\n]*)`, 'm')) || [])[1]?.trim() || '';
// the languages a block speaks, as js/app.js _facetValues reads its lang (book language by default)
const LANGS = CONFIG.facets?.lang?.values || langs;
const speaks = fm => { const v = fmKey(fm, 'lang').split('|').map(x => x.trim()).filter(x => LANGS.includes(x)); return v.length ? v : [bookLang]; };
const d = CONFIG.book.contentDir || 'content';
// the URLs app.js _prefetch asks for (keep in step)
const json = {};
for (const url of [`${d}/concepts.json`, 'content/concept-proposals.json', `${d}/missions.json`, `${d}/id-aliases.json`, 'content/concept-map.json']) {
  try { json[url] = JSON.parse(fs.readFileSync(path.join(ROOT, url), 'utf8')); } catch (e) { /* the book does not have it */ }
}

const files = [];   // [path in bundle, text, lang of a translation or null]
for (const ch of book.chapters || []) for (const f of ch.files || []) {
  const rel = `${ch.directory}/${f}`;
  let text;
  try { text = fs.readFileSync(path.join(contentDir, rel), 'utf8'); } catch (e) { continue; }   // the engine fetches it (and flags the miss)
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const tr = fm && /^translationOf:/m.test(fm[1]) ? (fm[1].match(/^lang:\s*['"]?([\w-]+)/m) || [])[1] || null : null;
  files.push([rel, text, tr, fm && fm[1]]);
}

// {cs, en, …} texts of the start-up JSON resolved to the bundle's language, as js/i18n.js locDeep and loc
// do (an object whose keys are all languages of the book): the reader downloads one language of the missions
const LANGSET = new Set([...langs, 'en']);
const resolve = (v, lang) => Array.isArray(v) ? v.map(x => resolve(x, lang))
  : !v || typeof v !== 'object' ? v
  : Object.keys(v).length && Object.keys(v).every(k => LANGSET.has(k)) ? (v[lang] ?? v[langs[0]] ?? v.en ?? Object.values(v)[0])
  : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x, lang)]));

for (const lang of langs) {
  const out = {};
  // originals with an accepted translation into this language (the reader gets the translation)
  const translated = new Set(files.filter(([, , tr, fm]) => tr === lang && ['', 'accepted'].includes(fmKey(fm, 'status'))).map(([, , , fm]) => fmKey(fm, 'translationOf')));
  for (const [rel, text, tr, fm] of files) {
    const seen = !fm || (tr ? tr === lang
      : lang === bookLang || !(translated.has(fmKey(fm, 'id')) || (strict && !speaks(fm).includes(lang))));
    out[rel] = seen ? text
      : `---\n${fm.split(/\r?\n/).filter(l => KEEP.has((l.match(/^(\w+):/) || [])[1])).join('\n')}\nbundleStub: true\n---\n`;
  }
  const dest = path.join(contentDir, `bundle.${lang}.json`);
  fs.writeFileSync(dest, JSON.stringify({ files: out, json: resolve(json, lang) }));
  console.log(`→ ${path.relative(ROOT, dest)}  ${Object.keys(out).length} files + ${Object.keys(json).length} JSON, ${(fs.statSync(dest).size / 1024).toFixed(0)} kB`);
}

// index.html starts the modules app.js imports, and the ones they import (games.js → games-lab.js), before
// app.js asks for them (var M = […]): say when that list drifts
try {
  const m = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/var M = \[([^\]]*)\]/);
  if (m) {
    const imports = f => { try { return [...fs.readFileSync(path.join(ROOT, 'js', f.replace(/\?.*/, '')), 'utf8').matchAll(/^import .* from '\.\/([\w.?=-]+)';/gm)].map(x => x[1]); } catch (e) { return []; } };
    const app = imports('app.js');
    const listed = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]).sort().join(' ');
    const want = [...new Set(['config.js', 'i18n.js', ...app, ...app.flatMap(imports)])].sort().join(' ');
    if (listed !== want) console.warn(`!! index.html preloads ${listed}\n   but js/app.js and its modules import ${want}`);
  }
} catch (e) { /* no index.html */ }
