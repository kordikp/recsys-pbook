#!/usr/bin/env node
// Builds the STATIC layer of a p-book: plain HTML pages that people without
// JavaScript, search engines and AI answer engines can read and cite.
//
//   kb/index.html            the book's table of contents, how to reach it (app, llms.txt, MCP, data)
//   kb/<concept>/index.html  one page per published concept: the short answer (recallQ/A),
//                            the anchor telling, every other telling (languages, regions),
//                            the diagram inline, sources, JSON-LD (LearningResource + FAQPage)
//   kb/index.json            the search index /api/mcp answers from
//   llms-full.txt            the whole published book as one markdown text
//   sitemap.xml              every page above
//
// Inputs: pbook.json (url, title, subtitle, author, license, description, language,
// places, datasets, theme), content/book.json, content/concepts.json, the blocks,
// js/diagrams.js (diagram id → file). Published = status accepted (or no status).
// Run after scripts/migrate-facets.js:  node scripts/build-kb.js
// Idempotent; kb/ is regenerated from scratch (never hand-edit it).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const manifest = JSON.parse(read('pbook.json'));
const SITE = String(manifest.url || '').replace(/\/+$/, '');
if (!SITE) { console.error('pbook.json needs "url" (the public base URL)'); process.exit(1); }
const book = JSON.parse(read('content/book.json'));
// a book in several languages names its chapters {cs, en, …}: the static layer speaks the book's own language
const inLang = v => (v && typeof v === 'object' ? v[manifest.language] ?? Object.values(v)[0] : v);
for (const ch of book.chapters) { ch.title = inLang(ch.title); ch.subtitle = inLang(ch.subtitle); }
const conceptsDoc = fs.existsSync(path.join(ROOT, 'content/concepts.json')) ? JSON.parse(read('content/concepts.json')) : { concepts: [] };
const TODAY = new Date().toISOString().slice(0, 10);
const ACCENT = manifest.theme?.accent || '#24973F';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attr = esc;

function diagramFiles() {
  const map = {};
  try {
    const src = read('js/diagrams.js');
    for (const m of src.matchAll(/'([\w-]+)'\s*:\s*'(images\/[^']+\.svg)'/g)) map[m[1]] = m[2];
  } catch (e) {}
  return map;
}
const DIAGRAMS = diagramFiles();

function svgFor(id) {
  if (!id || id === 'null') return null;
  const file = DIAGRAMS[id] || (fs.existsSync(path.join(ROOT, `images/${id}.svg`)) ? `images/${id}.svg` : null);
  if (!file || !fs.existsSync(path.join(ROOT, file))) return null;
  let svg = read(file).replace(/<\?xml[^>]*>\s*/, '').replace(/<!DOCTYPE[^>]*>\s*/i, '');
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
  const desc = (svg.match(/<desc[^>]*>([\s\S]*?)<\/desc>/) || [])[1] || '';
  const title = (svg.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '';
  return { file, svg, desc: desc.replace(/\s+/g, ' ').trim(), title: title.trim() };
}

function plain(md) {
  return String(md || '')
    .replace(/⟦svg⟧[\s\S]*?⟦\/svg⟧/g, ' ').replace(/⟦(?:obr|img|media)\s*:[^⟧]*⟧/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourcesOf(body) {
  const m = String(body || '').split(/\*\*Sources:?\*\*:?/i)[1];
  if (!m) return [];
  return m.split('\n').filter(l => /^\s*[-*]\s+/.test(l)).map(l => {
    const text = l.replace(/^\s*[-*]\s+/, '').trim();
    const url = (text.match(/https?:\/\/[^\s)>\]]+/) || [])[0] || null;
    return { text: plain(text), url };
  });
}

(async () => {
  const { renderMarkdown, parseFrontmatter } = await import(path.join(ROOT, 'js/markdown.js'));

  // ---- load published blocks in reading order
  const blocks = [];
  for (const ch of book.chapters || []) {
    for (const f of ch.files || []) {
      const rel = `content/${ch.directory || ch.id}/${f}`;
      if (!fs.existsSync(path.join(ROOT, rel))) continue;
      const { meta, body } = parseFrontmatter(read(rel));
      if (meta.status && meta.status !== 'accepted') continue;
      if (!meta.id) continue;
      blocks.push({ meta, body, rel, chapter: ch });
    }
  }
  const byId = Object.fromEntries(blocks.map(b => [b.meta.id, b]));
  const primary = b => String(b.meta.concept || '').split('|')[0].trim() || null;
  const conceptIndex = {};
  for (const c of conceptsDoc.concepts || []) conceptIndex[c.id] = c;

  // concept → its blocks (anchor first)
  const groups = new Map();
  for (const b of blocks) {
    const slug = primary(b);
    if (!slug) continue;
    if (!groups.has(slug)) groups.set(slug, []);
    groups.get(slug).push(b);
  }
  const anchorOf = slug => {
    const list = groups.get(slug) || [];
    const c = conceptIndex[slug];
    return (c && list.find(b => b.meta.id === c.anchor)) || list.find(b => b.meta.conceptTitle) || list.find(b => /-spine-/.test(b.rel)) || list.find(b => !['game', 'question'].includes(b.meta.type)) || list[0];
  };
  const kbUrl = slug => `/kb/${slug}`;   // no trailing slash: vercel.json trailingSlash false

  // links inside markdown: #c/slug → concept page, #block-id → its concept page
  const relink = html => html
    .replace(/(src|href)="(?!https?:|\/|#|data:|mailto:)([^"]+)"/g, '$1="/$2"')   // book-relative paths from /kb/<slug>
    .replace(/href="#c\/([\w-]+)"/g, (m, s) => groups.has(s) ? `href="${kbUrl(s)}"` : `href="${SITE}/#c/${s}"`)
    .replace(/href="#([\w-]+)"/g, (m, id) => byId[id] && primary(byId[id]) ? `href="${kbUrl(primary(byId[id]))}#${id}"` : m);

  const pageCss = `
:root{--a:${ACCENT};--t:#262626;--t2:#5b5b5b;--b:#e6e6e1;--bg:#fbfbf8}
*{box-sizing:border-box}a,li,td{overflow-wrap:anywhere}body{margin:0;font:17px/1.62 system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--t);background:var(--bg)}
header,main,footer{max-width:820px;margin:0 auto;padding:0 20px}
header{padding-top:18px;font-size:.9rem;color:var(--t2);display:flex;gap:1em;flex-wrap:wrap;justify-content:space-between}
header a{color:var(--t2)}a{color:var(--a)}
h1{font-size:2rem;line-height:1.2;margin:.6em 0 .2em}h2{font-size:1.35rem;margin:1.8em 0 .5em}h3{font-size:1.1rem}
.lead{font-size:1.1rem;color:var(--t2)}
.answer{border-left:4px solid var(--a);background:#fff;padding:14px 18px;border-radius:0 10px 10px 0;margin:1.2em 0}
.answer p{margin:.3em 0}.meta{font-size:.85rem;color:var(--t2)}
.telling{background:#fff;border:1px solid var(--b);border-radius:12px;padding:6px 22px 14px;margin:1.4em 0}
figure{margin:1.4em 0;background:#fff;border:1px solid var(--b);border-radius:12px;padding:10px}figure svg{width:100%;height:auto;display:block}
figcaption{font-size:.85rem;color:var(--t2);padding:6px 4px 0}
table{border-collapse:collapse;width:100%;font-size:.92rem;display:block;overflow-x:auto}th,td{border:1px solid var(--b);padding:6px 8px;text-align:left;vertical-align:top}
.btn{display:inline-block;background:var(--a);color:#fff;padding:.5em 1.1em;border-radius:8px;text-decoration:none;font-weight:600}
.chips span{display:inline-block;font-size:.78rem;border:1px solid var(--b);border-radius:99px;padding:.05em .6em;margin:0 .3em .3em 0;color:var(--t2);background:#fff}
ul.toc{padding-left:1.1em}ul.toc li{margin:.35em 0}
footer{margin-top:3em;padding:20px;border-top:1px solid var(--b);font-size:.85rem;color:var(--t2)}
pre{white-space:pre-wrap;background:#f3f3ef;padding:10px;border-radius:8px;font-size:.85rem}
@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}`;

  const publisher = manifest.publisher || { '@type': 'Organization', name: manifest.author || manifest.title };
  const bookLd = { '@type': 'Book', '@id': `${SITE}/#book`, name: manifest.title, alternativeHeadline: manifest.subtitle, url: `${SITE}/`, inLanguage: manifest.language || 'en', license: manifest.license_url || manifest.license, author: publisher, isAccessibleForFree: true };

  function shell({ title, description, canonical, ld, body, lang, alternates = '' }) {
    return `<!DOCTYPE html>
<html lang="${attr(lang || manifest.language || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${attr(canonical)}">
${alternates}<meta property="og:type" content="article">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${attr(canonical)}">
${manifest.og_image ? `<meta property="og:image" content="${attr(manifest.og_image)}">\n` : ''}<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>${pageCss}</style>
</head>
<body>
<header><span><a href="/kb">${esc(manifest.title)}</a> · knowledge base</span><span><a href="/">Interactive book</a> · <a href="/llms.txt">llms.txt</a> · <a href="/kb#for-agents">For AI agents</a></span></header>
<main>
${body}
</main>
<footer>${esc(manifest.title)}${manifest.author ? ` · ${esc(manifest.author)}` : ''} · ${manifest.license ? `License ${esc(manifest.license)}` : ''} · generated ${TODAY} from the book's markdown (<a href="/content/book.json">book.json</a>).${manifest.funding ? `<br>${esc(manifest.funding)}` : ''}</footer>
</body>
</html>
`;
  }

  function renderBlock(b) {
    let html = renderMarkdown(String(b.body || '').split(/\n\*\*Sources:?\*\*/i)[0]);
    html = relink(html.replace(/<button[\s\S]*?<\/button>/g, ''));
    return html;
  }

  function questionHtml(b) {
    const m = b.meta;
    const opts = ['A', 'B', 'C', 'D'].filter(k => m['feedback' + k]);
    return `<section class="telling" id="${attr(m.id)}"><h3>Check yourself: ${esc(m.title)}</h3>${relink(renderMarkdown(b.body || ''))}
${opts.length ? `<details><summary>Feedback on each option</summary><ul>${opts.map(k => `<li><b>${k})</b> ${esc(m['feedback' + k])}</li>`).join('')}</ul></details>` : ''}</section>`;
  }

  // ---- concept pages
  const out = path.join(ROOT, 'kb');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const index = { book: { title: manifest.title, subtitle: manifest.subtitle, url: `${SITE}/`, license: manifest.license }, generated: TODAY, chapters: [], blocks: [] };
  const sitemap = [`${SITE}/`, `${SITE}/kb`];
  const full = [`# ${manifest.title}${manifest.subtitle ? ` — ${manifest.subtitle}` : ''}\n\n> ${manifest.description || ''}\n> ${manifest.author || ''} · ${manifest.license || ''} · ${SITE}/\n> Generated ${TODAY} from the published markdown. Each section links its static page (cite that) and its place in the interactive book.\n`];
  const tocByChapter = [];

  for (const ch of book.chapters || []) {
    const slugs = [];
    for (const b of blocks.filter(x => x.chapter === ch)) { const s = primary(b); if (s && !slugs.includes(s) && anchorOf(s)?.chapter === ch) slugs.push(s); }
    index.chapters.push({ id: ch.id, title: ch.title, subtitle: ch.subtitle, number: ch.number });
    const items = [];
    full.push(`\n\n## Chapter ${ch.number || ''}: ${ch.title}\n${ch.subtitle ? `_${ch.subtitle}_\n` : ''}`);
    for (const slug of slugs) {
      const list = groups.get(slug);
      const a = anchorOf(slug);
      const c = conceptIndex[slug];
      const title = a.meta.conceptTitle || c?.title || a.meta.title;
      const recallQ = a.meta.recallQ || c?.contract?.recallQ || '';
      const recallA = a.meta.recallA || c?.contract?.recallA || '';
      const highlights = Array.isArray(a.meta.highlights) ? a.meta.highlights : [];
      const tellings = [a, ...list.filter(b => b !== a)];
      const prose = tellings.filter(b => !['game', 'question'].includes(b.meta.type));
      const checks = tellings.filter(b => b.meta.type === 'question');
      const games = tellings.filter(b => b.meta.type === 'game');
      const sources = []; const seen = new Set();
      for (const b of prose) for (const s of sourcesOf(b.body)) { const k = s.url || s.text; if (!seen.has(k)) { seen.add(k); sources.push(s); } }
      const place = manifest.places && a.meta.lens && manifest.places[String(a.meta.lens).split('|')[0]];
      const fig = svgFor(a.meta.diagram);
      const url = `${SITE}${kbUrl(slug)}`;
      const parents = String(a.meta.parents || '').split('|').map(s => s.trim()).filter(s => groups.has(s));
      const children = [...groups.keys()].filter(s => String(anchorOf(s)?.meta.parents || '').split('|').map(x => x.trim()).includes(slug));

      const body = `<nav class="meta"><a href="/kb">Contents</a> › Chapter ${esc(ch.number || '')}: ${esc(ch.title)}</nav>
<h1>${esc(title)}</h1>
<p class="lead">${esc(a.meta.teaser || '')}</p>
<div class="answer"><p><b>${esc(recallQ)}</b></p><p>${esc(recallA)}</p></div>
${highlights.length ? `<ul>${highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
<p><a class="btn" href="${SITE}/#c/${attr(slug)}">Open in the interactive book</a> <span class="meta">· missions, mini-games and memory cards there</span></p>
${fig ? `<figure>${fig.svg}${fig.desc ? `<figcaption>${esc(fig.desc)}</figcaption>` : ''}</figure>` : ''}
${prose.map((b, i) => `<section class="telling" id="${attr(b.meta.id)}" lang="${attr(b.meta.lang || manifest.language || 'en')}">
<h2>${esc(b.meta.title)}</h2>
<p class="chips">${[i === 0 ? 'main telling' : 'another telling', b.meta.lang && b.meta.lang !== (manifest.language || 'en') ? `language: ${b.meta.lang}` : '', b.meta.lens && b.meta.lens !== 'generic' ? `example world: ${b.meta.lens}` : '', b.meta.depth ? `depth: ${b.meta.depth}` : '', b.meta.readingTime ? `${b.meta.readingTime} min` : ''].filter(Boolean).map(t => `<span>${esc(t)}</span>`).join('')} <a class="meta" href="/${attr(b.rel)}">markdown</a></p>
${renderBlock(b)}
</section>`).join('\n')}
${checks.map(questionHtml).join('\n')}
${games.length ? `<h2>Play</h2><ul>${games.map(g => `<li><a href="${SITE}/#play/${attr(g.meta.id)}">${esc(g.meta.title)}</a> — ${esc(g.meta.teaser || '')}</li>`).join('')}</ul>` : ''}
${parents.length || children.length ? `<h2>Related</h2><ul>${parents.map(s => `<li>Builds on: <a href="${kbUrl(s)}">${esc(anchorOf(s).meta.conceptTitle || anchorOf(s).meta.title)}</a></li>`).join('')}${children.map(s => `<li>Leads to: <a href="${kbUrl(s)}">${esc(anchorOf(s).meta.conceptTitle || anchorOf(s).meta.title)}</a></li>`).join('')}</ul>` : ''}
${sources.length ? `<h2>Sources</h2><ul>${sources.map(s => `<li>${s.url ? `<a href="${attr(s.url)}">${esc(s.text)}</a>` : esc(s.text)}</li>`).join('')}</ul>` : ''}`;

      const ld = { '@context': 'https://schema.org', '@graph': [
        { '@type': 'LearningResource', '@id': url, url, name: title, headline: a.meta.title, description: a.meta.teaser || recallA,
          inLanguage: a.meta.lang || manifest.language || 'en', isPartOf: { '@id': `${SITE}/#book` }, learningResourceType: 'concept explainer',
          educationalLevel: a.meta.depth || undefined, teaches: recallQ || undefined, about: { '@type': 'DefinedTerm', name: title, termCode: slug },
          license: manifest.license_url || manifest.license, author: publisher, publisher, dateModified: TODAY, isAccessibleForFree: true,
          keywords: highlights.join('; ') || undefined,
          ...(place ? { spatialCoverage: { '@type': 'Place', name: place.name, geo: { '@type': 'GeoCoordinates', latitude: place.lat, longitude: place.lon } } } : {}),
          ...(fig ? { image: `${SITE}/${fig.file}` } : {}),
          ...(sources.some(s => s.url) ? { citation: sources.filter(s => s.url).map(s => ({ '@type': 'CreativeWork', name: s.text.slice(0, 200), url: s.url })) } : {}),
          hasPart: tellings.filter(b => b !== a).map(b => ({ '@type': 'CreativeWork', name: b.meta.title, inLanguage: b.meta.lang || 'en', url: `${url}#${b.meta.id}` })) },
        ...(recallQ && recallA ? [{ '@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: [{ '@type': 'Question', name: recallQ, acceptedAnswer: { '@type': 'Answer', text: recallA } }] }] : []),
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: manifest.title, item: `${SITE}/kb` },
          { '@type': 'ListItem', position: 2, name: ch.title },
          { '@type': 'ListItem', position: 3, name: title, item: url }] },
        bookLd ] };
      const alternates = `<link rel="alternate" type="text/markdown" href="${SITE}/${attr(a.rel)}">\n`;
      const dir = path.join(out, slug);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), shell({ title: `${title} — ${manifest.title}`, description: (a.meta.teaser || recallA || '').slice(0, 300), canonical: url, ld, body, lang: a.meta.lang, alternates }));
      sitemap.push(url);
      items.push({ slug, title, recallQ, teaser: a.meta.teaser, n: tellings.length });

      for (const b of tellings) {
        index.blocks.push({
          id: b.meta.id, concept: slug, conceptTitle: title, anchor: b === a, type: b.meta.type, chapter: ch.id,
          title: b.meta.title, teaser: b.meta.teaser, lang: b.meta.lang || manifest.language || 'en', lens: b.meta.lens, depth: b.meta.depth, genre: b.meta.genre,
          recallQ: b === a ? recallQ : (b.meta.recallQ || undefined), recallA: b === a ? recallA : (b.meta.recallA || undefined),
          highlights: b === a ? highlights : undefined, parents: b === a ? parents : undefined,
          sources: b === a ? sources : undefined, text: plain(b.body).slice(0, 12000), path: b.rel, kb: `${kbUrl(slug)}${b === a ? '' : '#' + b.meta.id}`,
        });
        if (!['game'].includes(b.meta.type)) {
          full.push(`\n### ${b.meta.title}${b === a ? '' : ` (another telling of “${title}”${b.meta.lang && b.meta.lang !== 'en' ? `, ${b.meta.lang}` : ''})`}\nPage: ${url}${b === a ? '' : '#' + b.meta.id} · In the app: ${SITE}/#c/${slug}\n${b === a && recallQ ? `Q: ${recallQ}\nA: ${recallA}\n` : ''}\n${String(b.body || '').replace(/⟦svg⟧[\s\S]*?⟦\/svg⟧/g, '').replace(/⟦(?:obr|img|media)\s*:[^⟧]*⟧/g, '').trim()}\n`);
        }
      }
    }
    tocByChapter.push({ ch, items });
  }

  // ---- kb home
  const datasets = Array.isArray(manifest.datasets) ? manifest.datasets : [];
  const homeBody = `<h1>${esc(manifest.title)}</h1>
<p class="lead">${esc(manifest.description || manifest.subtitle || '')}</p>
<p><a class="btn" href="/">Open the interactive book</a></p>
<h2>Contents</h2>
${tocByChapter.map(({ ch, items }) => `<h3>Chapter ${esc(ch.number || '')}: ${esc(ch.title)}</h3>${ch.subtitle ? `<p class="meta">${esc(ch.subtitle)}</p>` : ''}
<ul class="toc">${items.map(i => `<li><a href="${kbUrl(i.slug)}">${esc(i.title)}</a> — <span class="meta">${esc(i.recallQ)}</span></li>`).join('')}</ul>`).join('\n')}
<h2 id="for-agents">For AI agents and developers</h2>
<ul>
<li><b>MCP server</b> (read-only, Streamable HTTP, no key): <code>${esc(SITE)}/api/mcp</code> — tools <code>search</code>, <code>get_concept</code>, <code>get_block</code>, <code>list_chapters</code>, <code>list_datasets</code>, <code>query_dataset</code>.</li>
<li><a href="/llms.txt">llms.txt</a> (index) · <a href="/llms-full.txt">llms-full.txt</a> (the whole book as one text) · <a href="/kb/index.json">kb/index.json</a> (search index)</li>
<li>Raw content: <a href="/content/book.json">content/book.json</a>, <a href="/content/concepts.json">content/concepts.json</a> (concepts with their recall question and expected answer), markdown under <code>/content/</code>; manifest <a href="/pbook.json">pbook.json</a>; contribution brief <a href="/AGENTS.md">AGENTS.md</a>.</li>
${datasets.length ? `<li>Open data: ${datasets.map(d => `<a href="${attr(d.url)}">${esc(d.name)}</a> (${esc(d.description || '')})`).join(' · ')}</li>` : ''}
</ul>`;
  const homeLd = { '@context': 'https://schema.org', '@graph': [
    { ...bookLd, description: manifest.description, hasPart: tocByChapter.map(({ ch, items }) => ({ '@type': 'Chapter', name: ch.title, position: ch.number, hasPart: items.map(i => ({ '@type': 'LearningResource', name: i.title, url: `${SITE}${kbUrl(i.slug)}` })) })) },
    ...(datasets.length ? [{ '@type': 'DataCatalog', name: `${manifest.title} — open data`, dataset: datasets.map(d => ({ '@type': 'Dataset', name: d.name, description: d.description, license: d.license, creditText: d.attribution, distribution: { '@type': 'DataDownload', contentUrl: d.url.startsWith('/') ? SITE + d.url : d.url, encodingFormat: /geojson$/.test(d.url) ? 'application/geo+json' : 'application/json' } })) }] : []),
    { '@type': 'WebAPI', name: `${manifest.title} — MCP server`, url: `${SITE}/api/mcp`, documentation: `${SITE}/kb#for-agents`, description: 'Read-only Model Context Protocol server (Streamable HTTP, JSON responses) over the book.' } ] };
  fs.writeFileSync(path.join(out, 'index.html'), shell({ title: `${manifest.title} — knowledge base`, description: manifest.description || manifest.subtitle || '', canonical: `${SITE}/kb`, ld: homeLd, body: homeBody }));
  fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(index));
  fs.writeFileSync(path.join(ROOT, 'llms-full.txt'), full.join('\n'));

  // ---- sitemap
  for (const p of ['/llms.txt', '/llms-full.txt', '/pbook.json', '/content/book.json', '/content/concepts.json', ...datasets.map(d => d.url).filter(u => u && u.startsWith('/'))]) sitemap.push(SITE + p);
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map(u => `  <url><loc>${esc(u)}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  console.log(`kb: ${tocByChapter.reduce((n, c) => n + c.items.length, 0)} concept pages, ${index.blocks.length} indexed blocks, ${sitemap.length} sitemap urls, llms-full.txt ${(fs.statSync(path.join(ROOT, 'llms-full.txt')).size / 1024).toFixed(0)} kB`);
})().catch(e => { console.error(e); process.exit(1); });
