// p-book interface language: tr(key, ...args).
// Keys are the English source text; {0}, {1}… are the positional args. A pack (js/i18n/<lang>.js)
// maps key → translation; a value may be a plural object {one, few, many, other} chosen by the
// first numeric arg. A book can override any key in CONFIG.strings[lang].
// Language: ?lang= (remembered), then the reader's last choice, then the book's own language.
import { CONFIG } from './config.js';

export const LANG_NAMES = { en: 'English', cs: 'Čeština', sk: 'Slovenčina', hu: 'Magyar', de: 'Deutsch', pl: 'Polski' };
export const LANGS = CONFIG.book.languages || [CONFIG.book.lang || 'en'];

function pickLang() {
  let asked = null;
  try { asked = new URLSearchParams(location.search).get('lang'); } catch (e) {}
  if (asked === 'qps') return asked;   // pseudo-locale for finding untranslated text: ?lang=qps
  if (asked && LANGS.includes(asked)) {
    try { localStorage.setItem('pbook-lang', asked); } catch (e) {}
    return asked;
  }
  let stored = null;
  try { stored = localStorage.getItem('pbook-lang'); } catch (e) {}
  return stored && LANGS.includes(stored) ? stored : LANGS[0];
}

export const LANG = pickLang();

let pack = {};
if (LANG !== 'en' && LANG !== 'qps') {
  try { pack = (await import(`./i18n/${LANG}.js`)).default || {}; }
  catch (e) { console.warn('[pbook] no interface pack for', LANG); }
}
const own = (CONFIG.strings && CONFIG.strings[LANG]) || {};
const plurals = new Intl.PluralRules(LANG === 'qps' ? 'en' : LANG);

export function tr(key, ...args) {
  let v = own[key] ?? pack[key] ?? key;
  if (v && typeof v === 'object') {
    const n = args.find(a => typeof a === 'number');
    v = v[plurals.select(n ?? 0)] ?? v.other ?? key;
  }
  if (args.length) v = v.replace(/\{(\d+)\}/g, (m, i) => (i < args.length ? String(args[i]) : m));
  return LANG === 'qps' ? `⟪${v}⟫` : v;
}

// Counted phrases: trn('{0} section', '{0} sections', n). Packs translate the plural (second) key,
// usually as a plural object, so languages with more forms (cs: 1 / 2–4 / 5+) get them all.
export function trn(one, many, n, ...args) {
  if (LANG === 'en' || !((own[many] ?? pack[many]) != null)) return tr(n === 1 ? one : many, n, ...args);
  return tr(many, n, ...args);
}

// A language's name in the interface language ("Czech", "čeština", "cseh"…).
let _names = null;
export function langLabel(code) {
  try { _names = _names || new Intl.DisplayNames([LANG === 'qps' ? 'en' : LANG], { type: 'language' }); return _names.of(code) || code; }
  catch (e) { return LANG_NAMES[code] || code; }
}

// Locale for dates and numbers: English keeps the locale each call site chose.
export const locale = en => (LANG === 'en' || LANG === 'qps' ? en : LANG);

// Localized book data: a field may be a plain string or {en, cs, sk, hu}.
export function loc(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
  if (!LANGS.some(l => l in v) && !('en' in v)) return v;
  return v[LANG] ?? v[LANGS[0]] ?? v.en ?? Object.values(v)[0];
}

// Every {cs, en, …} object inside loaded book data, resolved with loc().
const KNOWN = new Set([...Object.keys(LANG_NAMES), ...LANGS]);
export function locDeep(v) {
  if (Array.isArray(v)) return v.map(locDeep);
  if (!v || typeof v !== 'object') return v;
  const keys = Object.keys(v);
  if (keys.length && keys.every(k => KNOWN.has(k))) return loc(v);
  return Object.fromEntries(keys.map(k => [k, locDeep(v[k])]));
}

// Static text in index.html, translated once at start-up: every text node and every title /
// placeholder / aria-label is looked up as a key (the English text, whitespace collapsed).
// An element marked data-i18n is translated as a whole (key = its inner HTML), for sentences
// with inline markup; data-i18n="key" names the key, for a word whose English is ambiguous
// ("Learning" the domain, not the recall state); data-i18n-skip leaves a subtree alone.
export function translateStatic(root = document.body) {
  document.documentElement.lang = LANG === 'qps' ? 'en' : LANG;
  if (LANG === 'en' && !Object.keys(own).length) return;   // a Czech-first book keys its own text in Czech
  const norm = s => s.trim().replace(/\s+/g, ' ');
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n || norm(el.innerHTML), t = tr(key);
    if (t !== key) el.innerHTML = t;
  });
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement?.closest('script,style,[data-i18n],[data-i18n-skip]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  for (let n; (n = walker.nextNode());) nodes.push(n);
  for (const n of nodes) {
    const raw = n.nodeValue, key = norm(raw);
    if (!/[A-Za-zÀ-ž]{2,}/.test(key)) continue;
    const t = tr(key);
    if (t !== key) n.nodeValue = raw.match(/^\s*/)[0] + t + raw.match(/\s*$/)[0];
  }
  root.querySelectorAll('[title],[placeholder],[aria-label]').forEach(el => {
    if (el.closest('[data-i18n-skip]')) return;
    for (const a of ['title', 'placeholder', 'aria-label']) {
      const v = el.getAttribute(a);
      if (v && /[A-Za-zÀ-ž]{2,}/.test(v)) { const t = tr(norm(v)); if (t !== norm(v)) el.setAttribute(a, t); }
    }
  });
  const t = tr(norm(document.title));
  if (t !== norm(document.title)) document.title = t;
}

// Switching reloads the page so module-level wording and the served tellings follow the new language.
export function setLang(lang) {
  try { localStorage.setItem('pbook-lang', lang); } catch (e) {}
  const u = new URL(location.href);
  u.searchParams.set('lang', lang);
  location.href = u.toString();
}
