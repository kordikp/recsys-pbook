#!/usr/bin/env node
// Register generated comics as tellings: one markdown file per comic,
// inserted into book.json right after the concept's anchor. Idempotent.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const concepts = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/concepts.json'), 'utf8')).concepts;
const book = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/book.json'), 'utf8'));

// pull title + footer take-away out of the SVG for teaser/title reuse
function svgMeta(svgPath) {
  const svg = fs.readFileSync(svgPath, 'utf8');
  const texts = [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map(m => m[1].trim());
  const unescape = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');
  const title = unescape(texts[0] || '');
  const footer = unescape(texts[texts.length - 1] || '');
  return { title, footer };
}

let added = 0, skipped = 0;
for (const c of concepts) {
  const svgFile = path.join(ROOT, 'images', `comic-${c.id}.svg`);
  if (!fs.existsSync(svgFile)) continue;
  const chapterDir = c.chapter;
  const anchorFile = c.anchorPath ? path.basename(c.anchorPath) : null;
  const prefix = anchorFile ? anchorFile.split('-')[0] : '99';   // orphans go to the chapter end
  const mdName = `${prefix}x-sidebar-comic-${c.id}.md`;
  const mdPath = path.join(ROOT, 'content', chapterDir, mdName);
  const blockId = `comic-${c.id}`;
  const mdExists = fs.existsSync(mdPath);
  if (!mdExists) {
  const { title, footer } = svgMeta(svgFile);
  const q = (s) => '"' + String(s).replace(/"/g, "'") + '"';
  const md = `---
id: ${blockId}
type: spine
title: ${q(title || c.title + ' (comic)')}
readingTime: 1
standalone: true
core: false
teaser: ${q('A four-panel comic: ' + (footer || c.title))}
voice: explorer
parent: ${c.id}
recallQ: ${q(c.contract?.recallQ || '')}
recallA: ${q(c.contract?.recallA || '')}
status: accepted
concept: ${c.id}
state: edited
generator: gpt-5.6-sol
lens: generic
lang: en
visuality: visual-first
depth: intro..standard
formalism: none
lengthBand: tldr
genre: comic
---

![${(title || c.title).replace(/[\[\]]/g, '')} — a four-panel comic](images/comic-${c.id}.svg)

*${footer}*
`;
  fs.writeFileSync(mdPath, md);
  } else { skipped++; }

  const ch = book.chapters.find(x => x.id === chapterDir || x.directory === chapterDir);
  if (!ch) { console.log('! no chapter for', c.id); continue; }
  if (!ch.files.includes(mdName)) {
    const i = ch.files.indexOf(anchorFile);
    ch.files.splice(i === -1 ? ch.files.length : i + 1, 0, mdName);
    added++;
  }
}
fs.writeFileSync(path.join(ROOT, 'content/book.json'), JSON.stringify(book, null, 2) + '\n');
console.log(`registered ${added} comics, skipped ${skipped} existing`);
