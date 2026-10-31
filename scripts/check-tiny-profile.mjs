// AC8 (docs/tiny-integration): the profile for Tiny is built from a fixed schema, so a protected
// Tiny field or a pupil's own words cannot get into it, whatever the stored data hold.
//   node scripts/check-tiny-profile.mjs
import { buildPbookSummary, tinyPatchBody, PBOOK_SUMMARY_MAX } from '../js/tiny-profile.js';

let fail = 0;
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fail++; };
const TOP = ['v', 'book', 'lang', 'updatedAt', 'cores', 'missions', 'level', 'xp', 'worlds'];
const PROTECTED = ['isTeacher', 'isSuperAdmin', 'isOperations', 'schoolId', 'email', 'password', 'firebaseUid', 'id', 'createdAt'];
const ID = /^[a-z0-9][a-z0-9-]{0,59}$/;

// 1 an ordinary reader
const s = buildPbookSummary({ book: 'informatika', lang: 'cs', now: Date.UTC(2026, 9, 31),
  cores: { 'algoritmus': 'kept', 'internet': 'read', 'data': 'understood' },
  missions: ['m1', 'm2'], results: { m1: { passedAt: Date.UTC(2026, 9, 30), score: 82 } },
  level: 4, xp: 310, worlds: ['hry', 'roboti'], allowedWorlds: ['hry', 'roboti', 'weby', 'generic'] });
ok(JSON.stringify(Object.keys(s)) === JSON.stringify(TOP), `top-level keys: ${Object.keys(s).join(', ')}`);
ok(s.v === 1 && s.book === 'informatika' && s.lang === 'cs' && s.updatedAt === '2026-10-31T00:00:00.000Z', 'version, book, language, date');
ok(s.cores.algoritmus === 'kept' && s.cores.internet === 'read' && s.cores.data === 'understood', 'core states');
ok(s.missions.m1.score === 82 && s.missions.m1.passedAt === '2026-10-30T00:00:00.000Z' && s.missions.m2.passedAt === null && s.missions.m2.score === null, 'missions: passed with a date and score, an old pass without them');
ok(s.level === 4 && s.xp === 310 && s.worlds.join() === 'hry,roboti', 'level, XP, worlds');

// 2 hostile stored data: protected fields, free text, markup, prototype keys, huge values
const evil = { book: 'Informatika <b>', lang: 'czech', now: 'yesterday',
  cores: { ...JSON.parse('{"__proto__": "kept", "constructor": "kept"}'), isTeacher: 'kept', 'Jana Nováková': 'read', 'ok-id': 'mastered', ['x'.repeat(80)]: 'read', schoolId: 'read' },
  missions: ['m1', 'Moje odpověď je, že…', 'm1', { a: 1 }, 'email'],
  results: { m1: { passedAt: 'not a date', score: 9999, answer: 'free text that must not travel' }, email: { score: -5 } },
  level: 'high', xp: -40, worlds: ['hry', 'my secret world', 'weby'], allowedWorlds: ['hry'],
  isTeacher: true, schoolId: 'abc', email: 'jana@example.com' };
const e = buildPbookSummary(evil);
ok(JSON.stringify(Object.keys(e)) === JSON.stringify(TOP), 'hostile input: still only the fixed top-level keys');
ok(!PROTECTED.some(k => k in e) && Object.keys(tinyPatchBody(e)).join() === 'pbook', 'no protected field at the top; the PATCH body has the one key "pbook"');
const strings = [];
(function walk(v, k) { if (k !== undefined) strings.push(String(k)); if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) walk(vv, kk); else if (typeof v === 'string') strings.push(v); })(e);
ok(strings.every(x => !/\s|[<>@]/.test(x)), `no free text, markup or e-mail anywhere (${strings.length} strings)`);
ok(Object.keys(e.cores).every(k => ID.test(k)) && Object.values(e.cores).every(v => ['read', 'understood', 'kept'].includes(v)), `cores: ids and the three states only (${Object.keys(e.cores).join(', ')})`);
ok(!Object.prototype.hasOwnProperty.call(e.cores, '__proto__') && ({}).polluted === undefined, 'prototype keys ignored');
ok(e.book === 'pbook' && e.lang === 'en' && e.updatedAt === null && e.level === 0 && e.xp === 0, 'bad scalars fall back to safe values');
ok(e.missions.m1.score === 100 && e.missions.m1.passedAt === null && !('answer' in e.missions.m1), 'mission: score clamped, bad date dropped, extra fields gone');
ok(e.worlds.join() === 'hry', 'worlds only from the book\'s list');

// 3 size: a book with thousands of concepts still fits in 16 kB
const big = {}; for (let i = 0; i < 3000; i++) big['concept-' + i] = i % 3 ? 'read' : 'understood';
const ms = []; const rs = {}; for (let i = 0; i < 300; i++) { ms.push('mission-' + i); rs['mission-' + i] = { passedAt: Date.now(), score: 70 }; }
const b = buildPbookSummary({ book: 'x', lang: 'en', cores: big, missions: ms, results: rs });
ok(JSON.stringify(b).length <= PBOOK_SUMMARY_MAX, `huge book: ${JSON.stringify(b).length} B ≤ ${PBOOK_SUMMARY_MAX}`);
ok(JSON.stringify(s).length < 1000, `ordinary reader: ${JSON.stringify(s).length} B`);

console.log(fail ? `\n✗ failed: ${fail}` : '\n✓ all passed');
process.exit(fail ? 1 : 0);
