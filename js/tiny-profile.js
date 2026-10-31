// The reader's profile in a fixed shape, ready for Tiny (docs/tiny-integration/REQUIREMENTS.md
// AC6–AC8): metadata.pbook v1 =
//   {v:1, book, lang, updatedAt, cores:{<conceptId>: "read"|"understood"|"kept"},
//    missions:{<id>: {passedAt, score}}, level, xp, worlds:[…]}
// Only ids, fixed words, numbers and dates: no free text, no names, never over 16 kB. Every key
// is written here by construction, and the body sent to Tiny has the one top-level key `pbook`,
// so a protected Tiny field (isTeacher, schoolId, email…) cannot get into it. No DOM, no imports:
// scripts/check-tiny-profile.mjs tests it in Node.

export const PBOOK_SUMMARY_VERSION = 1;
export const PBOOK_SUMMARY_MAX = 16 * 1024;
const ID = /^[a-z0-9][a-z0-9-]{0,59}$/;
const LANG = /^[a-z]{2}$/;
const STATES = ['read', 'understood', 'kept'];
const iso = t => {
  const d = typeof t === 'number' || typeof t === 'string' ? new Date(t) : null;
  return d && !isNaN(d) && d.getFullYear() > 2000 ? d.toISOString() : null;
};
const int = (n, max) => { const x = Math.round(Number(n)); return Number.isFinite(x) ? Math.max(0, Math.min(max, x)) : 0; };
const ids = obj => Object.keys(obj && typeof obj === 'object' ? obj : {}).filter(k => ID.test(k)).sort();

// input: {book, lang, now, cores:{cid: state}, missions:[id…], results:{id:{passedAt, score}},
//         level, xp, worlds:[…], allowedWorlds:[…]}
export function buildPbookSummary(input = {}) {
  const cores = {};
  for (const cid of ids(input.cores)) if (STATES.includes(input.cores[cid])) cores[cid] = input.cores[cid];
  const missions = {};
  const done = Array.isArray(input.missions) ? input.missions : [];
  for (const id of [...new Set(done.map(String))].filter(x => ID.test(x)).sort()) {
    const r = (input.results && typeof input.results === 'object' && input.results[id]) || {};
    const score = r.score === null || r.score === undefined || r.score === '' ? null : int(r.score, 100);
    missions[id] = { passedAt: iso(r.passedAt), score };
  }
  const allowed = new Set((input.allowedWorlds || []).map(String));
  const worlds = [...new Set((input.worlds || []).map(String))].filter(w => ID.test(w) && allowed.has(w)).slice(0, 6);
  const out = {
    v: PBOOK_SUMMARY_VERSION,
    book: ID.test(String(input.book || '')) ? String(input.book) : 'pbook',
    lang: LANG.test(String(input.lang || '')) ? String(input.lang) : 'en',
    updatedAt: iso(input.now ?? Date.now()),
    cores, missions,
    level: int(input.level, 1000),
    xp: int(input.xp, 1e9),
    worlds,
  };
  // Far below the limit for any real book (24 cores, 25 missions ≈ 2 kB). Should a book grow
  // huge, the weakest signals go first: concepts only read, then mission dates, concepts
  // understood, missions, and kept concepts last.
  let size = JSON.stringify(out).length;
  const entry = (k, v) => JSON.stringify(k).length + JSON.stringify(v).length + 2;
  const drop = (obj, keep) => {
    for (const k of Object.keys(obj)) {
      if (size <= PBOOK_SUMMARY_MAX) return;
      if (keep(obj[k])) continue;
      size -= entry(k, obj[k]); delete obj[k];
    }
  };
  drop(out.cores, v => v !== 'read');
  for (const id of Object.keys(out.missions)) {
    if (size <= PBOOK_SUMMARY_MAX) break;
    if (out.missions[id].passedAt) { size -= JSON.stringify(out.missions[id].passedAt).length - 4; out.missions[id].passedAt = null; }
  }
  drop(out.cores, v => v === 'kept');
  drop(out.missions, () => false);
  drop(out.cores, () => false);
  return out;
}

// What pbook sends with PATCH /users/me: Tiny merges top-level keys shallowly, so the whole
// summary travels under one key and replaces the previous one whole.
export function tinyPatchBody(summary) { return { pbook: summary }; }
