// p-book lab games: the reader builds something and the engine tests it.
//
//   turtle   draw a target picture with a tiny Logo (forward, turn, repeat, procedures with parameters)
//   gates    wire AND/OR/NOT/XOR gates until the circuit gives the level's truth table
//   cipher   break a Caesar, substitution or Vigenère cipher with a frequency chart and a key editor
//   route    pick a path through a weighted graph; the engine compares it with the optimum (Dijkstra)
//   neuron   set two weights and a threshold so one neuron's line separates two kinds of points
//
// Mixed into the PBook class with js/games.js (installGames), under the same rules: untimed unless the
// JSON sets "timer", every attempt explained (✓/✗ in text, never colour alone), replay and a personal
// best, XP once per game per day. Every level is open-ended, so the pure helpers below are exported for
// scripts/check-games.mjs: a level must be solvable and its ⭐ limit reachable. Fields: CONTRIBUTING.md.

import { tr, locale, LANG } from './i18n.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fold = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (x, d = 2) => (+x).toLocaleString(locale('en-US'), { minimumFractionDigits: d, maximumFractionDigits: d });
const r2 = x => Math.round(x * 100) / 100;
const fail = (code, ...args) => { throw { code, args }; };

// ===== turtle: parser, interpreter, picture comparison =====
// Words in every edition's language are always understood, so a program typed in any of them runs.
const TU_ALIAS = new Map();
[['fd', 'dopředu vpřed forward fd előre e do'], ['bk', 'dozadu vzad back bk hátra h'], ['rt', 'vpravo right rt jobbra j vp'],
  ['lt', 'vlevo vľavo left lt balra b vl'], ['rep', 'opakuj repeat rep ismételd ismétel ism'], ['learn', 'nauč learn to tanuld viem eljárás'],
  ['pu', 'penup pu ph tf'], ['pd', 'pendown pd tl'], ['pen', 'pero pen tollat toll']]
  .forEach(([op, words]) => words.split(' ').forEach(w => TU_ALIAS.set(fold(w), op)));
const TU_UP = new Set(['nahoru', 'hore', 'up', 'fel'].map(fold));
const TU_DOWN = new Set(['dolů', 'dole', 'down', 'le'].map(fold));
// how the editor and the solutions spell the commands (a language without an entry gets English)
const TU_SAY = {
  cs: { fd: 'dopředu', bk: 'dozadu', rt: 'vpravo', lt: 'vlevo', rep: 'opakuj', learn: 'nauč', pu: 'pero nahoru', pd: 'pero dolů' },
  sk: { fd: 'dopredu', bk: 'dozadu', rt: 'vpravo', lt: 'vľavo', rep: 'opakuj', learn: 'nauč', pu: 'pero hore', pd: 'pero dole' },
  hu: { fd: 'előre', bk: 'hátra', rt: 'jobbra', lt: 'balra', rep: 'ismételd', learn: 'tanuld', pu: 'tollat fel', pd: 'tollat le' },
  en: { fd: 'forward', bk: 'back', rt: 'right', lt: 'left', rep: 'repeat', learn: 'learn', pu: 'pen up', pd: 'pen down' },
};
const TU_LIMIT = { steps: 20000, depth: 24, repeat: 1000, far: 100000 };

function tuTokens(src) {
  const re = /\s+|\[|\]|\(|\)|[+*/]|-?\d+(?:[.,]\d+)?|-|:[\p{L}\p{N}_]+|[\p{L}_][\p{L}\p{N}_]*|\S/gu;
  const out = [];
  for (const m of String(src ?? '').matchAll(re)) {
    const v = m[0];
    if (/^\s+$/.test(v)) continue;
    const t = '[]()'.includes(v) ? v : /^[+\-*/]$/.test(v) ? 'op' : /^-?\d/.test(v) ? 'num' : v[0] === ':' ? 'param' : /^[\p{L}_]/u.test(v) ? 'word' : 'other';
    out.push({ t, v: t === 'num' ? parseFloat(v.replace(',', '.')) : v, raw: v });
  }
  // "vpravo -90" is a negative number, but "dopředu :a -10" means minus ten
  for (let i = 1; i < out.length; i++) {
    const p = out[i - 1];
    if (out[i].t === 'num' && out[i].v < 0 && (p.t === 'num' || p.t === 'param' || p.t === ')')) {
      out.splice(i, 1, { t: 'op', v: '-', raw: '-' }, { t: 'num', v: -out[i].v, raw: out[i].raw.slice(1) });
    }
  }
  return out;
}

// → { ok, ast, count } or { ok: false, error: {code, args}, count }; count = commands as written
// (every forward, turn, pen, repeat, learn and procedure call is one)
export function turtleParse(src) {
  const toks = tuTokens(src);
  const arity = new Map();   // procedures may be used before their "learn" line: read the headers first
  toks.forEach((tk, i) => {
    if (tk.t === 'word' && TU_ALIAS.get(fold(tk.v)) === 'learn' && toks[i + 1]?.t === 'word') {
      let n = 0;
      for (let j = i + 2; toks[j]?.t === 'param'; j++) n++;
      arity.set(fold(toks[i + 1].v), n);
    }
  });
  let i = 0, count = 0;
  const factor = cmd => {
    const tk = toks[i];
    if (!tk) fail('arg', cmd);
    if (tk.t === 'num') { i++; return { n: tk.v }; }
    if (tk.t === 'param') { i++; return { p: fold(tk.v.slice(1)), shown: tk.v }; }
    if (tk.t === '(') { i++; const v = sum(cmd); if (toks[i]?.t !== ')') fail('paren'); i++; return v; }
    if (tk.t === 'op' && tk.v === '-') { i++; return { o: 'neg', a: factor(cmd) }; }
    fail('arg', cmd);
  };
  const product = cmd => {
    let v = factor(cmd);
    while (toks[i]?.t === 'op' && (toks[i].v === '*' || toks[i].v === '/')) { const o = toks[i++].v; v = { o, a: v, b: factor(cmd) }; }
    return v;
  };
  const sum = cmd => {
    let v = product(cmd);
    while (toks[i]?.t === 'op' && (toks[i].v === '+' || toks[i].v === '-')) { const o = toks[i++].v; v = { o, a: v, b: product(cmd) }; }
    return v;
  };
  const block = cmd => {
    if (toks[i]?.t !== '[') fail('open', cmd);
    i++;
    const body = list(true);
    if (toks[i]?.t !== ']') fail('close', cmd);
    i++;
    return body;
  };
  const stmt = () => {
    const tk = toks[i];
    if (tk.t !== 'word') fail(tk.t === 'num' ? 'number' : 'unexpected', tk.raw);
    const op = TU_ALIAS.get(fold(tk.v));
    i++; count++;
    switch (op) {
      case 'fd': case 'bk': case 'rt': case 'lt': return { op, arg: sum(tk.raw) };
      case 'pu': case 'pd': return { op };
      case 'pen': {
        const w = toks[i];
        if (w?.t === 'word' && TU_UP.has(fold(w.v))) { i++; return { op: 'pu' }; }
        if (w?.t === 'word' && TU_DOWN.has(fold(w.v))) { i++; return { op: 'pd' }; }
        return fail('pen', tk.raw);
      }
      case 'rep': { const n = sum(tk.raw); return { op: 'rep', n, body: block(tk.raw) }; }
      case 'learn': {
        const nm = toks[i];
        if (nm?.t !== 'word' || TU_ALIAS.has(fold(nm.v))) fail('name', tk.raw);
        i++;
        const params = [];
        while (toks[i]?.t === 'param') params.push(toks[i++].v);
        return { op: 'learn', name: fold(nm.v), shown: nm.v, params, body: block(tk.raw) };
      }
      default: {
        const name = fold(tk.v);
        if (!arity.has(name)) fail('unknown', tk.raw);
        const args = [];
        for (let k = 0; k < arity.get(name); k++) args.push(sum(tk.raw));
        return { op: 'call', name, shown: tk.v, args };
      }
    }
  };
  const list = inner => {
    const out = [];
    while (i < toks.length && toks[i].t !== ']') out.push(stmt());
    if (!inner && i < toks.length) fail('stray');
    return out;
  };
  try { return { ok: true, ast: list(false), count }; } catch (e) {
    if (e && e.code) return { ok: false, error: e, count };
    throw e;
  }
}

// → { ok, segs: [[x1, y1, x2, y2]], x, y, h, error? }; the turtle starts at 0,0 looking up (h = 0°),
// pen down; y grows downwards as on screen. Top-level procedures are known before the program runs.
export function turtleRun(ast) {
  const procs = new Map();
  const segs = [];
  let x = 0, y = 0, h = 0, pen = true, steps = 0;
  const val = (e, env) => {
    if (e.n != null) return e.n;
    if (e.p != null) return env.has(e.p) ? env.get(e.p) : fail('param', e.shown);
    if (e.o === 'neg') return -val(e.a, env);
    const a = val(e.a, env), b = val(e.b, env);
    if (e.o === '/' && b === 0) fail('zero');
    return e.o === '+' ? a + b : e.o === '-' ? a - b : e.o === '*' ? a * b : a / b;
  };
  const exec = (list, env, depth) => {
    for (const s of list) {
      if (++steps > TU_LIMIT.steps) fail('long');
      switch (s.op) {
        case 'fd': case 'bk': {
          const d = val(s.arg, env) * (s.op === 'bk' ? -1 : 1);
          const rad = h * Math.PI / 180;
          const nx = x + d * Math.sin(rad), ny = y - d * Math.cos(rad);
          if (pen && d) segs.push([x, y, nx, ny]);
          x = nx; y = ny;
          if (Math.abs(x) > TU_LIMIT.far || Math.abs(y) > TU_LIMIT.far) fail('far');
          break;
        }
        case 'rt': h += val(s.arg, env); break;
        case 'lt': h -= val(s.arg, env); break;
        case 'pu': pen = false; break;
        case 'pd': pen = true; break;
        case 'rep': {
          const n = Math.round(val(s.n, env));
          if (n < 0 || n > TU_LIMIT.repeat) fail('repeat', n);
          for (let k = 0; k < n; k++) exec(s.body, env, depth);
          break;
        }
        case 'learn': procs.set(s.name, s); break;
        case 'call': {
          const p = procs.get(s.name);
          if (!p) fail('unknown', s.shown);
          if (depth >= TU_LIMIT.depth) fail('deep', s.shown);
          exec(p.body, new Map(p.params.map((pn, k) => [fold(pn.slice(1)), val(s.args[k], env)])), depth + 1);
          break;
        }
      }
    }
  };
  try {
    ast.filter(s => s.op === 'learn').forEach(s => procs.set(s.name, s));
    exec(ast, new Map(), 0);
    return { ok: true, segs, x, y, h };
  } catch (e) {
    if (e && e.code) return { ok: false, error: e, segs, x, y, h };
    throw e;
  }
}

// Points along the drawn lines, one per small cell: lines drawn twice count once
function tuSample(segs, s) {
  const pts = new Map();
  for (const [x1, y1, x2, y2] of segs) {
    const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / s));
    for (let k = 0; k <= n; k++) {
      const px = x1 + (x2 - x1) * k / n, py = y1 + (y2 - y1) * k / n;
      pts.set(`${Math.round(px / s)},${Math.round(py / s)}`, [px, py]);
    }
  }
  return [...pts.values()];
}

const segLen = ([x1, y1, x2, y2]) => Math.hypot(x2 - x1, y2 - y1);
function tuExtent(segs) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x1, y1, x2, y2] of segs) { a = Math.min(a, x1, x2); b = Math.min(b, y1, y2); c = Math.max(c, x1, x2); d = Math.max(d, y1, y2); }
  return { x0: a, y0: b, x1: c, y1: d };
}

// Same picture? Congruent within 2 % of its size: moved, turned or mirrored still counts, scale does not.
export function turtleSame(A, B) {
  A = A.filter(s => segLen(s) > 1e-6); B = B.filter(s => segLen(s) > 1e-6);
  if (!A.length || !B.length) return !A.length && !B.length;
  const diag = Math.max(...[A, B].map(S => { const e = tuExtent(S); return Math.hypot(e.x1 - e.x0, e.y1 - e.y0); }));
  const tol = Math.max(1.5, diag * 0.02), s = tol / 3;
  const PA = tuSample(A, s), PB = tuSample(B, s);
  if (Math.abs(PA.length - PB.length) > 0.12 * Math.max(PA.length, PB.length) + 4) return false;   // different amount of line
  const centre = P => P.reduce((c, p) => [c[0] + p[0] / P.length, c[1] + p[1] / P.length], [0, 0]);
  const gA = centre(PA), gB = centre(PB);
  const QA = PA.map(p => [p[0] - gA[0], p[1] - gA[1]]);
  const index = P => {
    const g = new Map();
    for (const p of P) { const k = `${Math.floor(p[0] / tol)},${Math.floor(p[1] / tol)}`; (g.get(k) || g.set(k, []).get(k)).push(p); }
    return g;
  };
  const near = (g, p) => {
    const cx = Math.floor(p[0] / tol), cy = Math.floor(p[1] / tol);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const q of g.get(`${cx + dx},${cy + dy}`) || []) if ((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 <= tol * tol) return true;
    }
    return false;
  };
  const gridA = index(QA);
  const dirs = [...new Set(A.map(([x1, y1, x2, y2]) => Math.round(Math.atan2(y2 - y1, x2 - x1) * 360 / Math.PI) / 2))];
  const ref = B.reduce((m, sg) => (segLen(sg) > segLen(m) ? sg : m));
  const refAng = Math.atan2(ref[3] - ref[1], ref[2] - ref[0]) * 180 / Math.PI;
  for (const mirror of [false, true]) {
    const base = mirror ? 180 - refAng : refAng;   // x → −x turns a direction θ into 180° − θ
    const turns = new Set();
    dirs.forEach(a => { turns.add(((a - base) % 360 + 360) % 360); turns.add(((a - base + 180) % 360 + 360) % 360); });
    for (const th of turns) {
      const c = Math.cos(th * Math.PI / 180), sn = Math.sin(th * Math.PI / 180);
      const QB = PB.map(p => { const x = (p[0] - gB[0]) * (mirror ? -1 : 1), y = p[1] - gB[1]; return [x * c - y * sn, x * sn + y * c]; });
      if (QB.every(p => near(gridA, p))) { const gridB = index(QB); if (QA.every(p => near(gridB, p))) return true; }
    }
  }
  return false;
}

// A program in the words of an edition (lang), as the solutions show it
export function turtleFormat(ast, lang = LANG) {
  const W = TU_SAY[lang] || TU_SAY.en;
  const ex = e => (e.n != null ? String(r2(e.n)) : e.p != null ? e.shown : e.o === 'neg' ? `-${ex(e.a)}` : `${ex(e.a)} ${e.o} ${ex(e.b)}`);
  const st = s => (s.op === 'rep' ? `${W.rep} ${ex(s.n)} [ ${s.body.map(st).join(' ')} ]`
    : s.op === 'learn' ? `${W.learn} ${s.shown}${s.params.map(p => ` ${p}`).join('')} [ ${s.body.map(st).join(' ')} ]`
      : s.op === 'call' ? [s.shown, ...s.args.map(ex)].join(' ')
        : s.op === 'pu' || s.op === 'pd' ? W[s.op] : `${W[s.op]} ${ex(s.arg)}`);
  return ast.map(st).join(' ');
}

// ===== gates: boolean expressions, truth tables, circuits =====
export const GATE_OPS = {
  AND: (a, b) => a & b, OR: (a, b) => a | b, XOR: (a, b) => a ^ b, NOT: a => 1 - a,
  NAND: (a, b) => 1 - (a & b), NOR: (a, b) => 1 - (a | b),
};
const GATE_WORD = { and: 'and', '&&': 'and', '&': 'and', '∧': 'and', or: 'or', '||': 'or', '|': 'or', '∨': 'or',
  xor: 'xor', '^': 'xor', '⊕': 'xor', not: 'not', '!': 'not', '¬': 'not', '~': 'not' };

// "not (A xor B)", "(A and not S) or (B and S)" → (env) => 0 | 1; precedence not > and > xor > or
export function gatesExpr(src, inputs) {
  const toks = String(src).match(/&&|\|\||[()!¬~^&|∧∨⊕]|[A-Za-z_][A-Za-z0-9_]*|\S/g) || [];
  let i = 0;
  const kind = t => GATE_WORD[String(t).toLowerCase()];
  const atom = () => {
    const t = toks[i++];
    if (t === undefined) fail('end');
    if (t === '(') { const e = or(); if (toks[i++] !== ')') fail('paren'); return e; }
    if (kind(t) === 'not') { const a = atom(); return env => 1 - a(env); }
    if (t === '0' || t === '1') return () => +t;
    if (!inputs.includes(t)) fail('input', t);
    return env => env[t];
  };
  const chain = (next, op) => () => {
    let a = next();
    while (kind(toks[i]) === op) { i++; const l = a, r = next(); a = env => GATE_OPS[op.toUpperCase()](l(env), r(env)); }
    return a;
  };
  const and = chain(atom, 'and'), xor = chain(and, 'xor'), or = chain(xor, 'or');
  const e = or();
  if (i < toks.length) fail('extra', toks[i]);
  return e;
}

// All input combinations in counting order (the first input is the high bit) and the wanted outputs
export function gatesTable(level) {
  const ins = level.inputs || [];
  const rows = Array.from({ length: 2 ** ins.length }, (_, r) => Object.fromEntries(ins.map((n, k) => [n, (r >> (ins.length - 1 - k)) & 1])));
  const want = {};
  for (const [out, src] of Object.entries(level.outputs || {})) { const f = gatesExpr(src, ins); want[out] = rows.map(f); }
  return { rows, want };
}

// circuit: { gates: [{op, a, b}], outputs: {name: source} }; a source is an input name or "g<k>"
// (an earlier gate). → { have: {output: [bits]}, values: per row {source: bit} }
export function gatesRun(level, circuit) {
  const { rows } = gatesTable(level);
  const values = rows.map(env => {
    const v = { ...env };
    (circuit.gates || []).forEach((g, k) => {
      const f = GATE_OPS[g.op];
      v[`g${k}`] = f ? (f.length === 1 ? f(v[g.a] ?? 0) : f(v[g.a] ?? 0, v[g.b] ?? 0)) : 0;
    });
    return v;
  });
  const have = {};
  for (const out of Object.keys(level.outputs || {})) have[out] = values.map(v => v[circuit.outputs?.[out]] ?? 0);
  return { have, values };
}

// the compact form in the JSON ("solution": {"gates": [["XOR", "A", "B"], ["NOT", "g0"]], "outputs": {"E": "g1"}})
export const gatesCircuit = sol => ({ gates: (sol?.gates || []).map(([op, a, b]) => ({ op, a, b })), outputs: { ...(sol?.outputs || {}) } });

// → { ok, wrong: row indices that differ }
export function gatesCheck(level, circuit) {
  const { want } = gatesTable(level), { have } = gatesRun(level, circuit);
  const wrong = new Set();
  for (const out of Object.keys(want)) want[out].forEach((b, r) => { if (have[out][r] !== b) wrong.add(r); });
  return { ok: !wrong.size, wrong: [...wrong] };
}

// ===== cipher =====
export const cipherNorm = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
const shiftCh = (ch, k) => String.fromCharCode(65 + (((ch.charCodeAt(0) - 65 + k) % 26) + 26) % 26);
const keyLetters = key => cipherNorm(key).replace(/[^A-Z]/g, '');

// Only A–Z change (letters lose their diacritics first); spaces and punctuation stay, the key moves on letters
export function cipherEncrypt(kind, plain, key) {
  const P = cipherNorm(plain);
  if (kind === 'caesar') { const k = parseInt(key, 10) || 0; return P.replace(/[A-Z]/g, ch => shiftCh(ch, k)); }
  if (kind === 'subst') { const K = keyLetters(key); return P.replace(/[A-Z]/g, ch => K[ch.charCodeAt(0) - 65] || ch); }
  if (kind === 'vigenere') {
    const K = keyLetters(key);
    let j = 0;
    return K ? P.replace(/[A-Z]/g, ch => shiftCh(ch, K.charCodeAt(j++ % K.length) - 65)) : P;
  }
  return P;
}

export function cipherDecrypt(kind, text, key) {
  if (kind === 'caesar') return cipherEncrypt('caesar', text, -(parseInt(key, 10) || 0));
  if (kind === 'vigenere') {
    const K = keyLetters(key);
    let j = 0;
    return K ? text.replace(/[A-Z]/g, ch => shiftCh(ch, -(K.charCodeAt(j++ % K.length) - 65))) : text;
  }
  return text;
}

// → '' if the key works for the kind, else what is wrong with it
export function cipherKeyProblem(kind, key) {
  if (kind === 'caesar') { const k = parseInt(key, 10); return k >= 1 && k <= 25 ? '' : 'caesar key must be a shift 1–25'; }
  if (kind === 'subst') { const K = keyLetters(key); return K.length === 26 && new Set(K).size === 26 ? '' : 'subst key must be all 26 letters, each once'; }
  if (kind === 'vigenere') return keyLetters(key).length >= 2 ? '' : 'vigenere key needs at least 2 letters';
  return `unknown cipher kind "${kind}"`;
}

// The commonest letters of each edition's language (diacritics dropped), for the frequency hint
const CIPHER_COMMON = { cs: 'EOAINSTRVL', sk: 'AOEINSRVTL', hu: 'EATLNSKORI', en: 'ETAOINSHRD' };

// ===== route =====
function routeAdj(level) {
  const adj = new Map((level.nodes || []).map(n => [n.id, []]));
  for (const [a, b, w] of level.edges || []) { adj.get(a)?.push([b, +w]); adj.get(b)?.push([a, +w]); }
  return adj;
}
export const routeEdge = (level, a, b) => {
  const e = (level.edges || []).find(([x, y]) => (x === a && y === b) || (x === b && y === a));
  return e ? +e[2] : null;
};
// Dijkstra → { cost, path, count: how many different paths share the optimum }
export function routeBest(level) {
  const adj = routeAdj(level);
  const dist = new Map([[level.from, 0]]), ways = new Map([[level.from, 1]]), prev = new Map(), done = new Set();
  while (true) {
    let u = null;
    for (const [k, d] of dist) if (!done.has(k) && (u === null || d < dist.get(u))) u = k;
    if (u === null) break;
    done.add(u);
    for (const [v, w] of adj.get(u) || []) {
      const nd = dist.get(u) + w, old = dist.get(v);
      if (old === undefined || nd < old - 1e-9) { dist.set(v, nd); ways.set(v, ways.get(u)); prev.set(v, u); }
      else if (Math.abs(nd - old) <= 1e-9) ways.set(v, ways.get(v) + ways.get(u));
    }
  }
  if (!dist.has(level.to)) return null;
  const path = [level.to];
  while (path[0] !== level.from) path.unshift(prev.get(path[0]));
  return { cost: dist.get(level.to), path, count: ways.get(level.to) };
}
export function routeCost(level, path) {
  let c = 0;
  for (let k = 1; k < path.length; k++) { const w = routeEdge(level, path[k - 1], path[k]); if (w === null) return null; c += w; }
  return c;
}
// Authors place nodes on a 0–100 grid; the map stretches what they drew to fill the box
// (a nearly flat axis is centred instead of blown up).
export function routeFit(level) {
  const ns = level.nodes || [];
  const axis = k => {
    const v = ns.map(n => +n[k] || 0), lo = Math.min(...v), hi = Math.max(...v), span = Math.max(hi - lo, 40);
    return x => 50 + ((x - (lo + hi) / 2) * 100) / span;
  };
  const fx = axis('x'), fy = axis('y');
  return new Map(ns.map(n => [n.id, { x: +fx(+n.x || 0).toFixed(2), y: +fy(+n.y || 0).toFixed(2) }]));
}
// What would overlap on a phone: node dots and labels, and weights hidden under a node.
// The box mirrors games.css (.g-ro-in on a 390 px wide screen); label widths are estimated.
export function routeClashes(level, { w = 240, h = 245 } = {}) {
  const pos = routeFit(level), out = [];
  const boxes = (level.nodes || []).map(n => {
    const p = pos.get(n.id), x = (p.x * w) / 100, y = (p.y * h) / 100;
    const long = String(n.label || n.id).length * 6.6, lines = Math.ceil(long / 80);
    const lw = Math.min(long, 80) / 2 + 2;
    return { id: n.id, dot: [x - 12, y - 12, x + 12, y + 12], label: [x - lw, y + 12, x + lw, y + 15 + 13 * lines] };
  });
  const segHitsBox = (x1, y1, x2, y2, [l, t, r, b]) => {
    const inside = (x, y) => x > l && x < r && y > t && y < b;
    if (inside(x1, y1) || inside(x2, y2)) return true;
    const X = (ax, ay, bx, by, cx, cy, dx, dy) => {
      const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
      if (!d) return false;
      const u = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, v = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
      return u > 0 && u < 1 && v > 0 && v < 1;
    };
    return X(x1, y1, x2, y2, l, t, r, t) || X(x1, y1, x2, y2, r, t, r, b) || X(x1, y1, x2, y2, l, b, r, b) || X(x1, y1, x2, y2, l, t, l, b);
  };
  const hit = (a, b, m = 1) => a[0] < b[2] - m && b[0] < a[2] - m && a[1] < b[3] - m && b[1] < a[3] - m;
  const weightBoxes = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const A = boxes[i], B = boxes[j];
    if (hit(A.dot, B.dot) || hit(A.dot, B.label) || hit(A.label, B.dot) || hit(A.label, B.label)) out.push(`${A.id}~${B.id}`);
  }
  for (const [a, b, wt] of level.edges || []) {
    const A = pos.get(a), B = pos.get(b);
    if (!A || !B) continue;
    const x = ((A.x + B.x) / 2) * w / 100, y = ((A.y + B.y) / 2) * h / 100, half = (String(wt).length * 7 + 10) / 2;
    const box = [x - half, y - 8, x + half, y + 8];
    const under = boxes.find(n => hit(box, n.dot, 2) || hit(box, n.label, 2));
    if (under) out.push(`${a}-${b}:${wt}~${under.id}`);
    weightBoxes.forEach(([k, o]) => { if (hit(box, o, 0)) out.push(`${a}-${b}:${wt}~${k}`); });
    weightBoxes.push([`${a}-${b}`, box]);
    // a line through someone else's dot looks like a route through that node
    const ax = (A.x * w) / 100, ay = (A.y * h) / 100, dx = ((B.x - A.x) * w) / 100, dy = ((B.y - A.y) * h) / 100;
    for (const n of boxes) {
      if (n.id === a || n.id === b) continue;
      const cx = (n.dot[0] + n.dot[2]) / 2, cy = (n.dot[1] + n.dot[3]) / 2;
      const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(ax + t * dx - cx, ay + t * dy - cy) < 13) out.push(`${a}-${b}|${n.id}`);
      else if (segHitsBox(ax, ay, ax + dx, ay + dy, n.label)) out.push(`${a}-${b}|${n.id} label`);
    }
  }
  return out;
}

// ===== neuron =====
// Both axes are squeezed to 0–10, so one pair of sliders fits every level
export function neuronScale(level) {
  const P = level.points || [];
  const lo = k => Math.min(...P.map(p => p[k])), hi = k => Math.max(...P.map(p => p[k]));
  const ax = [0, 1].map(k => ({ min: lo(k), max: hi(k) }));
  const sc = (v, k) => (10 * (v - ax[k].min)) / ((ax[k].max - ax[k].min) || 1);
  return { pts: P.map(p => [sc(p[0], 0), sc(p[1], 1), p[2] ? 1 : 0]), ax };
}
export const neuronSays = (w1, w2, b, x, y) => (w1 * x + w2 * y > b + 1e-9 ? 1 : 0);
export const neuronAcc = (pts, w1, w2, b) => pts.filter(p => neuronSays(w1, w2, b, p[0], p[1]) === p[2]).length / Math.max(1, pts.length);
// The slider grid: weights −1…1 by 0.05, threshold −20…20 by 0.1
export const NEURON_W = Array.from({ length: 41 }, (_, k) => r2(-1 + k * 0.05));
const NEURON_B = Array.from({ length: 401 }, (_, k) => Math.round((-20 + k * 0.1) * 10) / 10);
// best accuracy the sliders can reach (exhaustive over the grid), with one setting that reaches it
export function neuronBest(level) {
  const { pts } = neuronScale(level);
  let best = { acc: -1 };
  for (const w1 of NEURON_W) for (const w2 of NEURON_W) {
    if (!w1 && !w2) continue;
    for (const b of NEURON_B) {
      const a = neuronAcc(pts, w1, w2, b);
      if (a > best.acc + 1e-9) best = { acc: a, w1, w2, b };
    }
  }
  return best;
}

// ===== shared bits of the lab games =====
const pathD = (segs, f) => segs.map(([x1, y1, x2, y2]) => `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`).join('');
const num1 = x => Math.round(x * 10) / 10;
function codeMsg(e) {
  const a = e.args || [];
  return {
    arg: tr('“{0}” needs a number after it.', a[0]), open: tr('“{0}” needs its commands in brackets [ … ].', a[0]),
    close: tr('A bracket ] is missing after “{0}”.', a[0]), stray: tr('There is a ] without its [.'), paren: tr('A bracket ) is missing.'),
    number: tr('A number on its own: “{0}”. Numbers go after a command.', a[0]), unexpected: tr('I don’t understand “{0}”.', a[0]),
    pen: tr('After “{0}” write up or down.', a[0]), name: tr('“{0}” needs a name for the new command.', a[0]),
    unknown: tr('Unknown command “{0}”. Is it spelled right, or is its “learn” missing?', a[0]),
    param: tr('“{0}” is not a parameter of this command.', a[0]), zero: tr('Division by zero.'),
    long: tr('The program runs too long (more than {0} steps).', TU_LIMIT.steps), far: tr('The turtle walked off the map.'),
    repeat: tr('Repeat {0} times? Use a number from 0 to {1}.', a[0], TU_LIMIT.repeat),
    deep: tr('“{0}” keeps calling itself and never stops.', a[0]),
  }[e.code] || tr('Something in the program is not right.');
}

const LabGames = {
  // ---------- turtle: draw the target picture with as few commands as the ⭐ limit allows ----------
  _gameTurtle(S) {
    const g = S.game;
    const levels = g.levels;
    const W = TU_SAY[LANG] || TU_SAY.en;
    const solved = [], star = [], misses = [];
    let li = 0;
    const finish = note => this._gameFinish(S, {
      score: solved.filter(Boolean).length + star.filter(Boolean).length, total: 2 * levels.length, misses, note,
      scoreLabel: tr('{0}/{1} drawn · ⭐ {2}', solved.filter(Boolean).length, levels.length, star.filter(Boolean).length),
    });
    S.onTimeout = () => finish(tr('Time is up.'));
    const showLevel = () => {
      if (li >= levels.length) return finish();
      const L = levels[li];
      const tp = turtleParse(L.target);
      const target = tp.ok ? turtleRun(tp.ast).segs : [];
      const solution = tp.ok ? turtleFormat(tp.ast) : L.target;
      let runs = 0, code = S._tuCode?.[li] || '', drawn = [], turtle = { x: 0, y: 0, h: 0 }, busy = false, hint = false;
      const view = () => {
        const all = [...target, ...drawn, [0, 0, 0, 0], [turtle.x, turtle.y, turtle.x, turtle.y]];
        const e = tuExtent(all);
        const size = Math.max(60, e.x1 - e.x0, e.y1 - e.y0), pad = size * 0.1;
        const cx = (e.x0 + e.x1) / 2, cy = (e.y0 + e.y1) / 2;
        return { vb: `${num1(cx - size / 2 - pad)} ${num1(cy - size / 2 - pad)} ${num1(size + 2 * pad)} ${num1(size + 2 * pad)}`, size };
      };
      const svg = () => {
        const v = view(), u = v.size / 60;
        const t = turtle, rad = t.h * Math.PI / 180, fx = Math.sin(rad), fy = -Math.cos(rad);
        const tri = [[t.x + fx * 3.2 * u, t.y + fy * 3.2 * u], [t.x - fx * 1.6 * u - fy * 1.9 * u, t.y - fy * 1.6 * u + fx * 1.9 * u], [t.x - fx * 1.6 * u + fy * 1.9 * u, t.y - fy * 1.6 * u - fx * 1.9 * u]];
        return `<svg class="g-tu-svg" viewBox="${v.vb}" role="img" aria-label="${esc(tr('Drawing area: the dashed picture is the goal'))}">
          <path class="g-tu-ghost" d="${pathD(target, num1)}"/>
          <path class="g-tu-line" d="${pathD(drawn, num1)}"/>
          <circle class="g-tu-start" cx="0" cy="0" r="${num1(1.2 * u)}"/>
          <polygon class="g-tu-turtle" points="${tri.map(p => p.map(num1).join(',')).join(' ')}"/>
        </svg>`;
      };
      const countText = () => {
        const p = turtleParse(code);
        if (!code.trim()) return tr('Commands: 0 · ⭐ for at most {0}', L.max);
        if (!p.ok) return `<span class="g-tu-err">${esc(codeMsg(p.error))}</span>`;
        return `${tr('Commands: {0} · ⭐ for at most {1}', p.count, L.max)}${p.count <= L.max ? ' ✓' : ''}`;
      };
      const PAL = [['fd', `${W.fd} 50`], ['rt', `${W.rt} 90`], ['lt', `${W.lt} 90`], ['rep', `${W.rep} 4 [ ]`], ['learn', `${W.learn} `], ['pu', W.pu], ['pd', W.pd]];
      const render = fb => {
        S.area.innerHTML = `${this._gameProgress(tr('Level'), li, levels.length, `⭐ ${star.filter(Boolean).length}`)}
          ${li === 0 && g.instruction ? `<p class="g-small">${esc(g.instruction)}</p>` : ''}
          <p class="g-instruction">${esc(L.goal)}</p>
          <div class="g-tu-stage">${svg()}</div>
          <label class="g-tu-label" for="tu-${esc(S.blockId)}">${tr('Your program')}</label>
          <textarea class="g-tu-code" id="tu-${esc(S.blockId)}" rows="3" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="${esc(`${W.rep} 4 [ ${W.fd} 50 ${W.rt} 90 ]`)}">${esc(code)}</textarea>
          <div class="g-tu-count g-small" role="status">${countText()}</div>
          <div class="g-tu-pal" aria-label="${esc(tr('Insert a command'))}">${PAL.map(([k, ins]) => `<button class="g-chip-btn g-tu-ins" data-ins="${esc(ins)}">${esc(ins.replace(/ \[ \]$/, ' […]'))}</button>`).join('')}</div>
          ${hint ? `<div class="g-panel g-small">💡 ${esc(L.hint)}</div>` : ''}
          <div class="g-spot-actions">
            ${L.hint && !hint ? `<button class="g-btn g-tu-hint">${tr('💡 Hint')}</button>` : ''}
            <button class="g-btn g-tu-clear">${tr('Clear')}</button>
            <button class="g-btn g-btn-primary g-run">${tr('▶ Run')}</button>
          </div>
          <div class="g-fb"></div>`;
        const ta = S.area.querySelector('.g-tu-code'), cnt = S.area.querySelector('.g-tu-count');
        ta.oninput = () => { code = ta.value; (S._tuCode = S._tuCode || {})[li] = code; cnt.innerHTML = countText(); };
        ta.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go(); } };
        S.area.querySelectorAll('.g-tu-ins').forEach(b => {
          b.onclick = () => {
            const ins = b.dataset.ins, s0 = ta.selectionStart ?? ta.value.length, s1 = ta.selectionEnd ?? s0;
            const before = ta.value.slice(0, s0), pre = before && !/\s$/.test(before) ? ' ' : '';
            ta.value = before + pre + ins + (ins.endsWith(' ') ? '' : ' ') + ta.value.slice(s1);
            const at = before.length + pre.length + (ins.endsWith('[ ]') ? ins.length - 1 : ins.length + (ins.endsWith(' ') ? 0 : 1));
            ta.focus(); ta.setSelectionRange(at, at); ta.oninput();
          };
        });
        S.area.querySelector('.g-tu-clear').onclick = () => { ta.value = ''; ta.oninput(); drawn = []; turtle = { x: 0, y: 0, h: 0 }; render(); this._gameFocus(S.area.querySelector('.g-tu-code')); };
        const hb = S.area.querySelector('.g-tu-hint');
        if (hb) hb.onclick = () => { hint = true; this.rc?.logEvent?.('game_hint', { blockId: S.blockId, game: S.file, level: li }); render(); this._gameFocus(S.area.querySelector('.g-tu-code')); };
        S.area.querySelector('.g-run').onclick = () => go();
        S.area.querySelector('.g-run').disabled = busy;
        if (fb) this._gameFeedback(S, fb);
      };
      const judge = res => {
        const p = turtleParse(code);
        const same = res.ok && turtleSame(target, res.segs);
        this._gameAnswer(S, li, same && runs === 1, { runs, commands: p.count, star: same && p.count <= L.max });
        const next = { nextText: li === levels.length - 1 ? tr('See your score ›') : tr('Next level ›'), onNext: () => { li++; showLevel(); } };
        if (!res.ok) return render({ ok: false, head: `✗ ${esc(codeMsg(res.error))}`, why: tr('Change the program and run it again.') });
        if (same) {
          solved[li] = true;
          const got = p.count <= L.max;
          if (got) star[li] = true;
          const extra = got ? '' : `<div class="g-spot-actions"><button class="g-btn g-tu-shorter">${tr('Try a shorter one')}</button></div>`;
          render({
            ok: true, why: L.why, extra,
            head: got ? tr('✓ The picture matches, and the program fits the limit: ⭐ ({0} commands).', p.count)
              : tr('✓ The picture matches. The program has {0} commands; the ⭐ is for at most {1}.', p.count, L.max),
            ...next,
          });
          const sh = S.area.querySelector('.g-tu-shorter');
          if (sh) sh.onclick = () => { render(); this._gameFocus(S.area.querySelector('.g-tu-code')); };
          return;
        }
        const giveUp = runs >= 3;
        render({
          ok: false, head: drawn.length ? tr('✗ Not the same picture yet.') : tr('✗ The turtle drew nothing.'),
          why: giveUp ? '' : tr('Compare your line with the dashed goal and run again.'),
          extra: giveUp ? `<div class="g-spot-actions"><button class="g-btn g-tu-show">${tr('Show a solution')}</button></div>` : '',
        });
        const show = S.area.querySelector('.g-tu-show');
        if (show) show.onclick = () => {
          misses.push({ q: L.goal, a: solution, why: L.why });
          this._gameFeedback(S, { ok: null, head: tr('One way to do it:'), extra: `<pre class="g-code g-tu-sol">${esc(solution)}</pre>`, why: L.why, ...next });
        };
      };
      const go = () => {
        if (busy) return;
        const p = turtleParse(code);
        runs++;
        if (!p.ok) return judge({ ok: false, error: p.error, segs: [] });
        const res = turtleRun(p.ast);
        const done = () => { busy = false; drawn = res.segs; turtle = { x: res.x, y: res.y, h: res.h }; judge(res); };
        if (reducedMotion() || res.segs.length < 2) return done();
        busy = true;
        const per = Math.max(1, Math.ceil(res.segs.length / 40));
        let n = 0;
        const tick = () => {
          if (!S.root.isConnected) return;
          n = Math.min(res.segs.length, n + per);
          drawn = res.segs.slice(0, n);
          const last = drawn[drawn.length - 1];
          turtle = n < res.segs.length ? { x: last[2], y: last[3], h: Math.atan2(last[2] - last[0], last[1] - last[3]) * 180 / Math.PI } : { x: res.x, y: res.y, h: res.h };
          const st = S.area.querySelector('.g-tu-stage');
          if (st) st.innerHTML = svg();
          if (n < res.segs.length) setTimeout(tick, 40); else setTimeout(done, 120);
        };
        S.area.querySelector('.g-run').disabled = true;
        tick();
      };
      render();
      this._gameFocus(S.area.querySelector('.g-tu-code'));
    };
    showLevel();
  },

  // ---------- gates: wire gates until the truth table matches; ⭐ for at most "max" gates ----------
  _gameGates(S) {
    const g = S.game;
    const levels = g.levels;
    const solved = [], star = [], misses = [];
    let li = 0;
    const finish = note => this._gameFinish(S, {
      score: solved.filter(Boolean).length + star.filter(Boolean).length, total: 2 * levels.length, misses, note,
      scoreLabel: tr('{0}/{1} working · ⭐ {2}', solved.filter(Boolean).length, levels.length, star.filter(Boolean).length),
    });
    S.onTimeout = () => finish(tr('Time is up.'));
    const OP_HELP = { AND: tr('1 only when both inputs are 1'), OR: tr('1 when at least one input is 1'), NOT: tr('turns 0 into 1 and 1 into 0'),
      XOR: tr('1 when the inputs differ'), NAND: tr('0 only when both inputs are 1'), NOR: tr('1 only when both inputs are 0') };
    const showLevel = () => {
      if (li >= levels.length) return finish();
      const L = levels[li];
      const ins = L.inputs, outs = Object.keys(L.outputs);
      const allow = (L.allow || ['AND', 'OR', 'NOT', 'XOR']).filter(op => GATE_OPS[op]);
      const cap = Math.max(8, (L.max || 0) + 6);
      const { rows, want } = gatesTable(L);
      const C = { gates: [], outputs: Object.fromEntries(outs.map(o => [o, ins[0]])) };
      let probe = 0, checks = 0, fbState = null;
      const gname = k => `${k + 1}·${C.gates[k].op}`;
      const srcName = s => (/^g\d+$/.test(s) && C.gates[+s.slice(1)] ? gname(+s.slice(1)) : s);
      const sources = upto => [...ins, ...C.gates.slice(0, upto).map((_, k) => `g${k}`)];
      const sel = (cls, k, val, upto, label) => `<select class="g-ga-sel ${cls}" data-k="${k}" aria-label="${esc(label)}">${sources(upto).map(s => `<option value="${esc(s)}"${s === val ? ' selected' : ''}>${esc(srcName(s))}</option>`).join('')}</select>`;
      const schematic = vals => {
        // columns: inputs, gates by depth, outputs; a wire carrying 1 is solid and labelled
        const depth = {};
        ins.forEach(n => { depth[n] = 0; });
        C.gates.forEach((gt, k) => { depth[`g${k}`] = 1 + Math.max(depth[gt.a] ?? 0, gt.op === 'NOT' ? 0 : (depth[gt.b] ?? 0)); });
        const lastCol = 1 + Math.max(0, ...C.gates.map((_, k) => depth[`g${k}`]));
        const cols = {};
        const place = id => { const c = id in depth ? depth[id] : lastCol; (cols[c] = cols[c] || []).push(id); return c; };
        ins.forEach(place); C.gates.forEach((_, k) => place(`g${k}`)); outs.forEach(o => place(`out:${o}`));
        const CW = 76, RH = 46, rowsMax = Math.max(...Object.values(cols).map(c => c.length));
        const pos = {};
        Object.entries(cols).forEach(([c, ids]) => ids.forEach((id, r) => { pos[id] = { x: 14 + c * CW, y: 22 + (r + (rowsMax - ids.length) / 2) * RH }; }));
        const W = 14 + lastCol * CW + 46, H = 22 + rowsMax * RH;
        const wire = (from, to, dy, v) => {
          const a = pos[from], b = pos[to];
          const x1 = a.x + (from.startsWith('g') ? 22 : 10), x2 = b.x - (to.startsWith('out:') ? 12 : 22), y2 = b.y + dy, mx = (x1 + x2) / 2;
          return `<path class="g-ga-w${v ? ' is-1' : ''}" d="M${x1} ${a.y}C${mx} ${a.y} ${mx} ${y2} ${x2} ${y2}"/>`;
        };
        let s = '';
        C.gates.forEach((gt, k) => {
          if (gt.op === 'NOT') s += wire(gt.a, `g${k}`, 0, vals[gt.a]);
          else { s += wire(gt.a, `g${k}`, -7, vals[gt.a]); s += wire(gt.b, `g${k}`, 7, vals[gt.b]); }
        });
        outs.forEach(o => { s += wire(C.outputs[o], `out:${o}`, 0, vals[C.outputs[o]]); });
        ins.forEach(n => { const p = pos[n]; s += `<g class="g-ga-in${vals[n] ? ' is-1' : ''}"><circle cx="${p.x}" cy="${p.y}" r="10"/><text x="${p.x}" y="${p.y + 4}">${esc(n)}</text><text class="g-ga-v" x="${p.x}" y="${p.y - 14}">${vals[n]}</text></g>`; });
        C.gates.forEach((gt, k) => { const p = pos[`g${k}`]; s += `<g class="g-ga-gate${vals[`g${k}`] ? ' is-1' : ''}"><rect x="${p.x - 22}" y="${p.y - 15}" width="44" height="30" rx="7"/><text x="${p.x}" y="${p.y + 4}">${esc(gt.op)}</text><text class="g-ga-k" x="${p.x}" y="${p.y - 19}">${k + 1}</text></g>`; });
        outs.forEach(o => { const p = pos[`out:${o}`], v = vals[C.outputs[o]]; s += `<g class="g-ga-out${v ? ' is-1' : ''}"><rect x="${p.x - 12}" y="${p.y - 11}" width="${Math.max(24, 9 * o.length + 10)}" height="22" rx="11"/><text x="${p.x - 12 + Math.max(24, 9 * o.length + 10) / 2}" y="${p.y + 4}">${esc(o)}=${v}</text></g>`; });
        return `<svg class="g-ga-svg" viewBox="0 0 ${W} ${H}" style="max-width:${W * 1.25}px" role="img" aria-label="${esc(tr('Circuit diagram for row {0} of the table', probe + 1))}">${s}</svg>`;
      };
      const table = () => {
        const { have, values } = gatesRun(L, C);
        const body = rows.map((env, r) => {
          const bad = outs.some(o => have[o][r] !== want[o][r]);
          return `<tr class="${r === probe ? 'is-probe' : ''}${bad ? ' is-bad' : ''}" data-r="${r}" tabindex="0">${ins.map(n => `<td>${env[n]}</td>`).join('')}${outs.map(o => `<td class="g-ga-want">${want[o][r]}</td><td>${have[o][r]} <span class="g-mark">${have[o][r] === want[o][r] ? '✓' : '✗'}</span></td>`).join('')}</tr>`;
        }).join('');
        return { values, ok: rows.every((_, r) => outs.every(o => have[o][r] === want[o][r])), html: `<div class="g-table-wrap"><table class="g-ga-tt"><thead><tr>${ins.map(n => `<th scope="col">${esc(n)}</th>`).join('')}${outs.map(o => `<th scope="col">${tr('{0} wanted', esc(o))}</th><th scope="col">${tr('{0} yours', esc(o))}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>` };
      };
      const render = () => {
        const t = table();
        S.area.innerHTML = `${this._gameProgress(tr('Level'), li, levels.length, `⭐ ${star.filter(Boolean).length}`)}
          ${li === 0 && g.instruction ? `<p class="g-small">${esc(g.instruction)}</p>` : ''}
          <p class="g-instruction">${esc(L.story)}</p>
          <div class="g-ga-stage">${schematic(t.values[probe])}</div>
          <p class="g-small g-ga-probe">${tr('The diagram shows row {0} of the table. Tap a row to send its values through.', probe + 1)}</p>
          <ol class="g-ga-list">${C.gates.map((gt, k) => `<li class="g-ga-row"><b class="g-ga-num">${k + 1}</b>
              <select class="g-ga-sel g-ga-op" data-k="${k}" aria-label="${esc(tr('Gate {0}: type', k + 1))}">${allow.map(op => `<option${op === gt.op ? ' selected' : ''}>${op}</option>`).join('')}</select>
              ${sel('g-ga-a', k, gt.a, k, tr('Gate {0}: first input', k + 1))}
              ${gt.op === 'NOT' ? '' : sel('g-ga-b', k, gt.b, k, tr('Gate {0}: second input', k + 1))}
              <button class="g-btn g-btn-quiet g-ga-del" data-k="${k}" aria-label="${esc(tr('Remove gate {0}', k + 1))}">✕</button></li>`).join('')}</ol>
          <div class="g-ga-add">${allow.map(op => `<button class="g-chip-btn g-ga-new" data-op="${op}" title="${esc(OP_HELP[op] || '')}"${C.gates.length >= cap ? ' disabled' : ''}>+ ${op}</button>`).join('')}</div>
          <p class="g-small g-ga-help">${allow.map(op => `<b>${op}</b>: ${esc(OP_HELP[op] || '')}`).join(' · ')}</p>
          <div class="g-ga-outs">${outs.map(o => `<label class="g-ga-outl"><b>${esc(o)}</b> ← ${sel('g-ga-o', o, C.outputs[o], C.gates.length, tr('Output {0} comes from', o))}</label>`).join('')}</div>
          ${t.html}
          <div class="g-spot-actions"><span class="g-small" role="status">${tr('Gates: {0} · ⭐ for at most {1}', C.gates.length, L.max)}</span>
            <button class="g-btn g-btn-primary g-check">${tr('Check the circuit')}</button></div>
          <div class="g-fb"></div>`;
        const A = S.area;
        A.querySelectorAll('.g-ga-new').forEach(b => { b.onclick = () => { const k = C.gates.length; C.gates.push({ op: b.dataset.op, a: ins[0], b: ins[1] || ins[0] }); fbState = null; render(); this._gameFocus(A.querySelector(`.g-ga-op[data-k="${k}"]`)); }; });
        A.querySelectorAll('.g-ga-op').forEach(s => { s.onchange = () => { C.gates[+s.dataset.k].op = s.value; render(); this._gameFocus(A.querySelector(`.g-ga-op[data-k="${s.dataset.k}"]`)); }; });
        A.querySelectorAll('.g-ga-a, .g-ga-b').forEach(s => { s.onchange = () => { C.gates[+s.dataset.k][s.classList.contains('g-ga-a') ? 'a' : 'b'] = s.value; const cls = s.classList.contains('g-ga-a') ? 'g-ga-a' : 'g-ga-b'; render(); this._gameFocus(A.querySelector(`.${cls}[data-k="${s.dataset.k}"]`)); }; });
        A.querySelectorAll('.g-ga-o').forEach(s => { s.onchange = () => { C.outputs[s.dataset.k] = s.value; render(); this._gameFocus(A.querySelector(`.g-ga-o[data-k="${s.dataset.k}"]`)); }; });
        A.querySelectorAll('.g-ga-del').forEach(b => {
          b.onclick = () => {
            const k = +b.dataset.k;
            const fix = s => (s === `g${k}` ? ins[0] : /^g\d+$/.test(s) && +s.slice(1) > k ? `g${+s.slice(1) - 1}` : s);
            C.gates.splice(k, 1);
            C.gates.forEach(gt => { gt.a = fix(gt.a); gt.b = fix(gt.b); });
            outs.forEach(o => { C.outputs[o] = fix(C.outputs[o]); });
            render(); this._gameFocus(A.querySelector('.g-ga-new'));
          };
        });
        A.querySelectorAll('.g-ga-tt tbody tr').forEach(tr_ => {
          const pick = () => { probe = +tr_.dataset.r; render(); this._gameFocus(A.querySelector(`.g-ga-tt tr[data-r="${probe}"]`)); };
          tr_.onclick = pick;
          tr_.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
        });
        A.querySelector('.g-check').onclick = () => check();
        if (fbState) this._gameFeedback(S, fbState);
      };
      const next = { nextText: li === levels.length - 1 ? tr('See your score ›') : tr('Next level ›'), onNext: () => { li++; showLevel(); } };
      const check = () => {
        checks++;
        const res = gatesCheck(L, C);
        const got = res.ok && C.gates.length <= L.max;
        this._gameAnswer(S, li, res.ok && checks === 1, { checks, gates: C.gates.length, star: got });
        if (res.ok) {
          solved[li] = true;
          if (got) star[li] = true;
          fbState = { ok: true, why: L.why, ...next,
            head: got ? tr('✓ The circuit works, with {0} gates: ⭐.', C.gates.length) : tr('✓ The circuit works. It has {0} gates; the ⭐ is for at most {1}.', C.gates.length, L.max) };
          render();
          return;
        }
        const sol = L.solution && checks >= 3;
        fbState = { ok: false, head: tr('✗ {0} rows of the table do not match yet.', res.wrong.length), why: tr('The rows marked ✗ show where. Tap one to see its signals in the diagram.'),
          extra: sol ? `<div class="g-spot-actions"><button class="g-btn g-ga-show">${tr('Show a solution')}</button></div>` : '' };
        render();
        const sb = S.area.querySelector('.g-ga-show');
        if (sb) sb.onclick = () => {
          const c = gatesCircuit(L.solution);
          C.gates = c.gates; Object.assign(C.outputs, c.outputs);
          misses.push({ q: L.story, a: c.gates.map((gt, k) => `${k + 1}: ${gt.op}(${[gt.a, gt.op === 'NOT' ? null : gt.b].filter(Boolean).map(srcName).join(', ')})`).join(' · '), why: L.why });
          fbState = { ok: null, head: tr('One way to do it is now in the editor.'), why: L.why, ...next };
          render();
        };
      };
      render();
      this._gameFocus(S.area.querySelector('.g-ga-new'));
    };
    showLevel();
  },

  // ---------- cipher: break the message; the key editor decrypts live ----------
  _gameCipher(S) {
    const g = S.game;
    const levels = g.levels;
    const solved = [], misses = [];
    let li = 0;
    const finish = note => this._gameFinish(S, { score: solved.filter(Boolean).length, total: levels.length, misses, note,
      scoreLabel: tr('{0}/{1} broken', solved.filter(Boolean).length, levels.length) });
    S.onTimeout = () => finish(tr('Time is up.'));
    const common = (CIPHER_COMMON[LANG] || CIPHER_COMMON.en).split('').join(' ');
    const showLevel = () => {
      if (li >= levels.length) return finish();
      const L = levels[li];
      const plain = cipherNorm(L.plain), C = cipherEncrypt(L.kind, L.plain, L.key);
      const letters = [...new Set(C.replace(/[^A-Z]/g, ''))];
      const freq = {};
      for (const ch of C) if (/[A-Z]/.test(ch)) freq[ch] = (freq[ch] || 0) + 1;
      const byFreq = letters.sort((a, b) => freq[b] - freq[a] || a.localeCompare(b));
      const st = { shift: 0, map: {}, revealed: new Set(), key: '', col: 0, hint: false, done: false, gaveUp: false };
      const keyText = () => (L.kind === 'caesar' ? tr('shift {0}', L.key) : L.kind === 'vigenere' ? cipherNorm(L.key) : cipherNorm(L.key));
      const guess = () => {
        if (L.kind === 'caesar') return cipherDecrypt('caesar', C, st.shift);
        if (L.kind === 'vigenere') return keyLetters(st.key) ? cipherDecrypt('vigenere', C, st.key) : C.replace(/[A-Z]/g, '·');
        return C.replace(/[A-Z]/g, ch => st.map[ch] || '·');
      };
      const cells = () => {
        const G = guess();
        const K = keyLetters(st.key).length;
        let j = 0;
        const words = C.split(/( +)/).map((w, wi, arr) => {
          if (/^ +$/.test(w)) return ' ';
          const start = arr.slice(0, wi).join('').length;
          return `<span class="g-ci-word">${[...w].map((ch, k) => {
            const p = G[start + k];
            if (!/[A-Z]/.test(ch)) return `<span class="g-ci-cell is-sym"><span class="g-ci-c">${esc(ch)}</span><span class="g-ci-p">${esc(ch)}</span></span>`;
            const col = L.kind === 'vigenere' && K ? j++ % K : -1;
            const ok = p === plain[start + k];
            const cls = [L.kind === 'subst' && st.revealed.has(ch) ? 'is-given' : '', col >= 0 && col === st.col ? 'is-col' : '', st.done ? 'is-ok' : p === '·' ? 'is-unknown' : ''].filter(Boolean).join(' ');
            return `<span class="g-ci-cell ${cls}"${L.kind === 'subst' ? ` data-c="${ch}"` : ''}><span class="g-ci-c">${ch}</span><span class="g-ci-p">${esc(p)}</span></span>${ok && st.done ? '' : ''}`;
          }).join('')}</span>`;
        }).join('');
        return `<div class="g-ci-text" aria-label="${esc(tr('Encrypted message, with your decryption under each letter'))}">${words}</div>`;
      };
      const bars = (counts, mark) => {
        const top = Math.max(1, ...Object.values(counts));
        return `<ul class="g-bars g-ci-bars">${Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([ch, n]) =>
          `<li${mark === ch ? ' class="is-you"' : ''}><span class="g-bars-l">${ch}</span><span class="g-bars-t"><i style="width:${Math.round(100 * n / top)}%"></i></span><span class="g-bars-v">${n}×</span></li>`).join('')}</ul>`;
      };
      const controls = () => {
        if (L.kind === 'caesar') {
          return `<div class="g-ci-shift"><button class="g-btn g-ci-m" aria-label="${esc(tr('Shift one less'))}">◀</button>
            <label class="g-ci-sv">${tr('Shift back by')} <output>${st.shift}</output></label>
            <button class="g-btn g-ci-p1" aria-label="${esc(tr('Shift one more'))}">▶</button></div>
            <input class="g-range g-ci-range" type="range" min="0" max="25" step="1" value="${st.shift}" aria-label="${esc(tr('Shift back by'))}">`;
        }
        if (L.kind === 'subst') {
          return `<p class="g-small">${tr('Letter counts in the message, most common first. Write under each one the letter you think it stands for.')}</p>
            <div class="g-ci-keys">${byFreq.map(ch => {
              const dup = st.map[ch] && byFreq.some(o => o !== ch && st.map[o] === st.map[ch]);
              return `<label class="g-ci-key${dup ? ' is-dup' : ''}${st.revealed.has(ch) ? ' is-given' : ''}"><span class="g-ci-kc">${ch}<small>${freq[ch]}×</small></span>
                <input class="g-ci-in" data-c="${ch}" maxlength="1" value="${esc(st.map[ch] || '')}" autocomplete="off" autocapitalize="characters" spellcheck="false"${st.revealed.has(ch) || st.done ? ' disabled' : ''} aria-label="${esc(tr('Letter that {0} stands for', ch))}"></label>`;
            }).join('')}</div>
            <p class="g-small">${tr('The most common letters in this language: {0}.', common)}</p>`;
        }
        const K = keyLetters(st.key);
        const colCounts = {};
        if (K.length) { let j = 0; for (const ch of C) if (/[A-Z]/.test(ch)) { if (j % K.length === st.col) colCounts[ch] = (colCounts[ch] || 0) + 1; j++; } }
        return `<label class="g-ci-kl">${tr('Key')} <input class="g-ci-key-in" value="${esc(st.key)}" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false"${st.done ? ' disabled' : ''}></label>
          ${K.length ? `<div class="g-ci-cols" role="tablist" aria-label="${esc(tr('Letters encrypted by one letter of the key'))}">${[...K].map((ch, k) => `<button class="g-chip-btn g-ci-col${k === st.col ? ' is-on' : ''}" data-k="${k}" role="tab" aria-selected="${k === st.col}">${tr('{0}. letter of the key', k + 1)}</button>`).join('')}</div>
            <p class="g-small">${tr('Every {0}. letter of the message (marked) is shifted by the same key letter. Their counts:', K.length)}</p>${bars(colCounts)}` : `<p class="g-small">${tr('Type a guess of the key. Its length decides which letters share one shift.')}</p>`}
          <p class="g-small">${tr('The most common letters in this language: {0}.', common)}</p>`;
      };
      const render = fb => {
        S.area.innerHTML = `${this._gameProgress(tr('Level'), li, levels.length, tr('{0} broken', solved.filter(Boolean).length))}
          ${li === 0 && g.instruction ? `<p class="g-small">${esc(g.instruction)}</p>` : ''}
          <p class="g-instruction">${esc(L.story || { caesar: tr('Each letter was moved the same number of places along the alphabet.'), subst: tr('Each letter was swapped for another one, always the same.'), vigenere: tr('A key word decides how far each letter moves: its first letter shifts the first letter of the message, and so on, round and round.') }[L.kind] || '')}</p>
          ${cells()}
          <div class="g-ci-ctl">${controls()}</div>
          ${st.hint && L.hint ? `<div class="g-panel g-small">💡 ${esc(L.hint)}</div>` : ''}
          ${st.done ? '' : `<div class="g-spot-actions">
            ${L.hint && !st.hint ? `<button class="g-btn g-ci-hint">${tr('💡 Hint')}</button>` : ''}
            ${L.kind === 'subst' ? `<button class="g-btn g-ci-rev">${tr('Reveal one letter')}</button>` : ''}
            <button class="g-btn g-btn-quiet g-ci-give">${tr('Show the solution (no point)')}</button></div>`}
          <div class="g-fb"></div>`;
        bind();
        if (fb) this._gameFeedback(S, fb);
      };
      const next = { nextText: li === levels.length - 1 ? tr('See your score ›') : tr('Next level ›'), onNext: () => { li++; showLevel(); } };
      const won = () => {
        st.done = true;
        if (!st.gaveUp) solved[li] = true;
        this._gameAnswer(S, li, !st.gaveUp, { kind: L.kind, revealed: st.revealed.size, hint: st.hint });
        render({ ok: !st.gaveUp, why: L.why, ...next,
          head: st.gaveUp ? tr('The key was: {0}.', esc(keyText())) : `${tr('✓ Broken! The key: {0}.', esc(keyText()))}${st.revealed.size ? ` ${tr('(letters revealed: {0})', st.revealed.size)}` : ''}` });
      };
      const test = () => { if (!st.done && guess() === plain) won(); };
      const bind = () => {
        const A = S.area;
        const hb = A.querySelector('.g-ci-hint');
        if (hb) hb.onclick = () => { st.hint = true; this.rc?.logEvent?.('game_hint', { blockId: S.blockId, game: S.file, level: li }); render(); };
        const gv = A.querySelector('.g-ci-give');
        if (gv) gv.onclick = () => {
          st.gaveUp = true;
          misses.push({ q: L.story || keyText(), a: plain, why: L.why });
          if (L.kind === 'caesar') st.shift = (parseInt(L.key, 10) || 0) % 26;
          if (L.kind === 'vigenere') st.key = cipherNorm(L.key);
          if (L.kind === 'subst') byFreq.forEach(ch => { st.map[ch] = plain[C.indexOf(ch)]; });
          won();
        };
        if (L.kind === 'caesar') {
          const set = v => { st.shift = ((v % 26) + 26) % 26; render(); test(); };
          A.querySelector('.g-ci-m')?.addEventListener('click', () => { set(st.shift - 1); this._gameFocus(S.area.querySelector('.g-ci-m') || S.area.querySelector('.g-next')); });
          A.querySelector('.g-ci-p1')?.addEventListener('click', () => { set(st.shift + 1); this._gameFocus(S.area.querySelector('.g-ci-p1') || S.area.querySelector('.g-next')); });
          const rg = A.querySelector('.g-ci-range');
          if (rg) rg.oninput = () => { set(+rg.value); this._gameFocus(S.area.querySelector('.g-ci-range:not([disabled])') || S.area.querySelector('.g-next')); };
          if (st.done) A.querySelectorAll('.g-ci-m, .g-ci-p1, .g-ci-range').forEach(b => { b.disabled = true; });
        }
        if (L.kind === 'subst') {
          A.querySelectorAll('.g-ci-in').forEach(inp => {
            inp.oninput = () => {
              const v = cipherNorm(inp.value).replace(/[^A-Z]/g, '').slice(-1);
              if (v) st.map[inp.dataset.c] = v; else delete st.map[inp.dataset.c];
              const at = byFreq.indexOf(inp.dataset.c);
              render(); test();
              if (!st.done) this._gameFocus(S.area.querySelectorAll('.g-ci-in')[v ? Math.min(at + 1, byFreq.length - 1) : at]);
            };
          });
          A.querySelectorAll('.g-ci-cell[data-c]').forEach(c => { c.onclick = () => { const inp = S.area.querySelector(`.g-ci-in[data-c="${c.dataset.c}"]`); if (inp && !inp.disabled) this._gameFocus(inp); }; });
          const rv = A.querySelector('.g-ci-rev');
          if (rv) rv.onclick = () => {
            const ch = byFreq.find(c => st.map[c] !== plain[C.indexOf(c)]);
            if (!ch) return;
            st.map[ch] = plain[C.indexOf(ch)];
            st.revealed.add(ch);
            this.rc?.logEvent?.('game_hint', { blockId: S.blockId, game: S.file, level: li, reveal: ch });
            render(); test();
          };
        }
        if (L.kind === 'vigenere') {
          const ki = A.querySelector('.g-ci-key-in');
          if (ki) ki.oninput = () => {
            const pos = ki.selectionStart;
            st.key = cipherNorm(ki.value).replace(/[^A-Z]/g, '');
            st.col = Math.min(st.col, Math.max(0, st.key.length - 1));
            render(); test();
            const k2 = S.area.querySelector('.g-ci-key-in:not([disabled])');
            if (k2) { this._gameFocus(k2); try { k2.setSelectionRange(pos, pos); } catch (e) { /* not a text field */ } }
          };
          A.querySelectorAll('.g-ci-col').forEach(b => { b.onclick = () => { st.col = +b.dataset.k; render(); this._gameFocus(S.area.querySelector(`.g-ci-col[data-k="${st.col}"]`)); }; });
        }
      };
      render();
      this._gameFocus(S.area.querySelector('.g-ci-range, .g-ci-in, .g-ci-key-in'));
    };
    showLevel();
  },

  // ---------- route: tap from node to node; the engine knows the optimum (Dijkstra) ----------
  _gameRoute(S) {
    const g = S.game;
    const levels = g.levels;
    let li = 0, score = 0;
    const misses = [];
    const finish = note => this._gameFinish(S, { score, total: levels.length, misses, note, scoreLabel: tr('{0}/{1} first try', score, levels.length) });
    S.onTimeout = () => finish(tr('Time is up.'));
    const showLevel = () => {
      if (li >= levels.length) return finish();
      const L = levels[li];
      const best = routeBest(L);
      const label = id => L.nodes.find(n => n.id === id)?.label || id;
      const unit = L.metric ? ` ${L.metric}` : '';
      const nf = x => `${(+x).toLocaleString(locale('en-US'), { maximumFractionDigits: 2 })}${unit}`;
      let path = [L.from], tries = 0, shown = null, done = false;
      const adj = id => (L.edges || []).filter(([a, b]) => a === id || b === id).map(([a, b, w]) => [a === id ? b : a, +w]);
      const onPath = (a, b) => path.some((p, k) => k && ((path[k - 1] === a && p === b) || (path[k - 1] === b && p === a)));
      const onBest = (a, b) => shown && shown.some((p, k) => k && ((shown[k - 1] === a && p === b) || (shown[k - 1] === b && p === a)));
      const pos = routeFit(L);
      const map = () => {
        const end = path[path.length - 1];
        const can = new Set(done ? [] : adj(end).map(([v]) => v));
        const lines = (L.edges || []).map(([a, b, w]) => {
          const A = pos.get(a), B = pos.get(b);
          if (!A || !B) return '';
          return `<line class="g-ro-e${onPath(a, b) ? ' is-path' : ''}${onBest(a, b) ? ' is-best' : ''}" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"/>`;
        }).join('');
        const weights = (L.edges || []).map(([a, b, w]) => {
          const A = pos.get(a), B = pos.get(b);
          return A && B ? `<span class="g-ro-w${onPath(a, b) ? ' is-path' : ''}" style="left:${(A.x + B.x) / 2}%;top:${(A.y + B.y) / 2}%">${esc(String(w))}</span>` : '';
        }).join('');
        const nodes = L.nodes.map(n => {
          const cls = [n.id === L.from ? 'is-from' : '', n.id === L.to ? 'is-to' : '', path.includes(n.id) ? 'is-on' : '', n.id === end && !done ? 'is-end' : '', can.has(n.id) ? 'is-can' : ''].filter(Boolean).join(' ');
          const w = can.has(n.id) ? adj(end).find(([v]) => v === n.id)[1] : null;
          const p = pos.get(n.id);
          return `<button class="g-ro-n ${cls}" data-id="${esc(n.id)}" style="left:${p.x}%;top:${p.y}%"${can.has(n.id) ? '' : ' disabled'} aria-label="${esc(n.label)}${w != null ? esc(`, +${nf(w)}`) : ''}${n.id === L.to ? esc(` (${tr('goal')})`) : ''}"><span class="g-ro-dot" aria-hidden="true">${n.id === L.to ? '🏁' : n.id === L.from ? '●' : ''}</span><span class="g-ro-l">${esc(n.label)}</span></button>`;
        }).join('');
        return `<div class="g-ro-map"><div class="g-ro-in"><svg class="g-ro-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${weights}${nodes}</div></div>`;
      };
      const render = fb => {
        const end = path[path.length - 1];
        const cost = routeCost(L, path);
        S.area.innerHTML = `${this._gameProgress(tr('Level'), li, levels.length, tr('{0} first try', score))}
          ${li === 0 && g.instruction ? `<p class="g-small">${esc(g.instruction)}</p>` : ''}
          <p class="g-instruction">${esc(L.story)}</p>
          ${map()}
          <p class="g-ro-path" role="status"><b>${tr('Your route')}:</b> ${path.map(label).map(esc).join(' → ')}${path.length > 1 ? ` · <b>${esc(nf(cost))}</b>` : ''}</p>
          ${done ? '' : `<div class="g-ro-next"><span class="g-small">${tr('From {0} you can go to:', esc(label(end)))}</span>
            <div class="g-options g-options-many">${adj(end).map(([v, w], k) => `<button class="g-opt g-ro-go" data-id="${esc(v)}"><span class="g-key" aria-hidden="true">${k + 1}</span><span class="g-opt-text">${esc(label(v))} <span class="g-small">+${esc(nf(w))}</span></span></button>`).join('')}</div></div>
          <div class="g-spot-actions"><button class="g-btn g-ro-undo"${path.length > 1 ? '' : ' disabled'}>${tr('⌫ One step back')}</button><button class="g-btn g-ro-reset"${path.length > 1 ? '' : ' disabled'}>${tr('↺ From the start')}</button></div>`}
          <div class="g-fb"></div>`;
        const A = S.area;
        const step = id => { path.push(id); if (id === L.to) arrive(); else { render(); this._gameFocus(S.area.querySelector('.g-ro-go')); } };
        A.querySelectorAll('.g-ro-go, .g-ro-n:not([disabled])').forEach(b => { b.onclick = () => step(b.dataset.id); });
        const u = A.querySelector('.g-ro-undo');
        if (u) u.onclick = () => { path.pop(); render(); this._gameFocus(S.area.querySelector('.g-ro-go')); };
        const r = A.querySelector('.g-ro-reset');
        if (r) r.onclick = () => { path = [L.from]; render(); this._gameFocus(S.area.querySelector('.g-ro-go')); };
        if (fb) this._gameFeedback(S, fb);
      };
      const next = { nextText: li === levels.length - 1 ? tr('See your score ›') : tr('Next level ›'), onNext: () => { li++; showLevel(); } };
      const arrive = () => {
        tries++;
        const cost = routeCost(L, path);
        const ok = Math.abs(cost - best.cost) <= 1e-9;
        this._gameAnswer(S, li, ok && tries === 1, { tries, cost, best: best.cost });
        if (ok) {
          if (tries === 1) score++;
          done = true;
          render({ ok: true, why: L.why, ...next, head: tries === 1 ? tr('✓ The fastest route, on the first try: {0}.', esc(nf(cost))) : tr('✓ The fastest route: {0}.', esc(nf(cost))) });
          return;
        }
        const reveal = tries >= 2;
        done = true;
        render({
          ok: false, head: tr('✗ You made it in {0}, but there is a faster way.', esc(nf(cost))),
          why: reveal ? '' : tr('Try another route.'),
          extra: `<div class="g-spot-actions"><button class="g-btn g-btn-primary g-ro-again">${tr('Try again')}</button>${reveal ? `<button class="g-btn g-ro-best">${tr('Show the fastest')}</button>` : ''}</div>`,
        });
        S.area.querySelector('.g-ro-again').onclick = () => { path = [L.from]; done = false; render(); this._gameFocus(S.area.querySelector('.g-ro-go')); };
        const sb = S.area.querySelector('.g-ro-best');
        if (sb) sb.onclick = () => {
          shown = best.path;
          path = best.path.slice();
          misses.push({ q: L.story, a: `${best.path.map(label).join(' → ')} (${nf(best.cost)})`, why: L.why });
          render({ ok: null, head: tr('The fastest route: {0}.', `${esc(best.path.map(label).join(' → '))} · <b>${esc(nf(best.cost))}</b>`), why: L.why, ...next });
        };
      };
      render();
      this._gameFocus(S.area.querySelector('.g-ro-go'));
    };
    showLevel();
  },

  // ---------- neuron: two weights and a threshold draw one line; reach the level's accuracy ----------
  _gameNeuron(S) {
    const g = S.game;
    const levels = g.levels;
    let li = 0, score = 0;
    const misses = [];
    const finish = note => this._gameFinish(S, { score, total: levels.length, misses, note, scoreLabel: tr('{0}/{1} by hand', score, levels.length) });
    S.onTimeout = () => finish(tr('Time is up.'));
    const showLevel = () => {
      if (li >= levels.length) return finish();
      const L = levels[li];
      const { pts, ax } = neuronScale(L);
      const st = { w1: 1, w2: 0, b: 5, learned: false, done: false, epoch: 0, busy: false };
      const goal = L.goal ?? 1;
      const acc = () => neuronAcc(pts, st.w1, st.w2, st.b);
      const lab = L.labels || [tr('group 1'), tr('group 2')];
      const axes = L.axes || ['x', 'y'];
      const plot = () => {
        // plot box 0–10 on both axes (y up), drawn into a 120 × 120 viewBox with room for the labels
        const X = v => 12 + v * 10.4, Y = v => 108 - v * 10.4;
        const { w1, w2, b } = st;
        // the half-plane where the neuron answers labels[1]: clip the box against w1·x + w2·y > b
        let poly = [[0, 0], [10, 0], [10, 10], [0, 10]];
        const f = p => w1 * p[0] + w2 * p[1] - b;
        const clip = [];
        poly.forEach((p, k) => {
          const q = poly[(k + 1) % poly.length], fp = f(p), fq = f(q);
          if (fp > 0) clip.push(p);
          if ((fp > 0) !== (fq > 0)) { const t = fp / (fp - fq); clip.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
        });
        poly = clip;
        let line = '';
        if (Math.abs(w2) > 1e-9 || Math.abs(w1) > 1e-9) {
          const ends = [];
          [[0, null], [10, null], [null, 0], [null, 10]].forEach(([x, y]) => {
            if (x !== null && Math.abs(w2) > 1e-9) { const yy = (b - w1 * x) / w2; if (yy >= -1e-9 && yy <= 10 + 1e-9) ends.push([x, yy]); }
            if (y !== null && Math.abs(w1) > 1e-9) { const xx = (b - w2 * y) / w1; if (xx >= -1e-9 && xx <= 10 + 1e-9) ends.push([xx, y]); }
          });
          if (ends.length >= 2) line = `<line class="g-ne-line" x1="${num1(X(ends[0][0]))}" y1="${num1(Y(ends[0][1]))}" x2="${num1(X(ends[ends.length - 1][0]))}" y2="${num1(Y(ends[ends.length - 1][1]))}"/>`;
        }
        const tick = (k, v) => r2(ax[k].min + (v / 10) * (ax[k].max - ax[k].min));
        const pt = p => {
          const ok = neuronSays(w1, w2, b, p[0], p[1]) === p[2];
          const cx = num1(X(p[0])), cy = num1(Y(p[1]));
          const shape = p[2] ? `<polygon class="g-ne-p1" points="${cx},${num1(Y(p[1]) - 3.6)} ${num1(X(p[0]) + 3.2)},${num1(Y(p[1]) + 2.2)} ${num1(X(p[0]) - 3.2)},${num1(Y(p[1]) + 2.2)}"/>` : `<circle class="g-ne-p0" cx="${cx}" cy="${cy}" r="2.6"/>`;
          return `${shape}${ok ? '' : `<circle class="g-ne-bad" cx="${cx}" cy="${cy}" r="5"/>`}`;
        };
        return `<svg class="g-ne-svg" viewBox="0 0 120 124" role="img" aria-label="${esc(tr('Points of two kinds and the neuron’s dividing line'))}">
          <rect class="g-ne-box" x="12" y="4" width="104" height="104"/>
          ${poly.length > 2 ? `<polygon class="g-ne-zone" points="${poly.map(p => `${num1(X(p[0]))},${num1(Y(p[1]))}`).join(' ')}"/>` : ''}
          ${line}${pts.map(pt).join('')}
          <text class="g-ne-ax" x="64" y="122">${esc(axes[0])}</text>
          <text class="g-ne-ax" x="5" y="56" transform="rotate(-90 5 56)">${esc(axes[1])}</text>
          <text class="g-ne-tk" x="12" y="114">${tick(0, 0)}</text><text class="g-ne-tk" x="116" y="114" text-anchor="end">${tick(0, 10)}</text>
          <text class="g-ne-tk" x="10" y="108" text-anchor="end">${tick(1, 0)}</text><text class="g-ne-tk" x="10" y="8" text-anchor="end">${tick(1, 10)}</text>
        </svg>`;
      };
      const slider = (k, label, min, max, step) => `<label class="g-slider"><span class="g-slider-l">${label}</span><input class="g-ne-${k}" type="range" min="${min}" max="${max}" step="${step}" value="${st[k]}"${st.done || st.busy ? ' disabled' : ''}><output>${fmt(st[k], k === 'b' ? 1 : 2)}</output></label>`;
      const render = fb => {
        const a = acc(), ok = a + 1e-9 >= goal;
        const right = pts.filter(p => neuronSays(st.w1, st.w2, st.b, p[0], p[1]) === p[2]).length;
        S.area.innerHTML = `${this._gameProgress(tr('Level'), li, levels.length, tr('{0} by hand', score))}
          ${li === 0 && g.instruction ? `<p class="g-small">${esc(g.instruction)}</p>` : ''}
          <p class="g-instruction">${esc(L.story)}</p>
          <div class="g-ne-wrap">
            <div class="g-ne-stage">${plot()}
              <div class="g-ne-key g-small"><span><i class="g-ne-k0" aria-hidden="true">●</i> ${esc(lab[0])}</span><span><i class="g-ne-k1" aria-hidden="true">▲</i> ${esc(lab[1])}</span><span><i class="g-ne-kb" aria-hidden="true">◯</i> ${tr('wrong answer')}</span></div></div>
            <div class="g-ne-ctl">
              ${slider('w1', tr('Weight of “{0}”', esc(axes[0])), -1, 1, 0.05)}
              ${slider('w2', tr('Weight of “{0}”', esc(axes[1])), -1, 1, 0.05)}
              ${slider('b', tr('Threshold'), -20, 20, 0.1)}
              <p class="g-ne-rule g-small">${tr('The neuron says “{0}” when {1}', esc(lab[1]), `<code>${fmt(st.w1)} · x + ${fmt(st.w2)} · y &gt; ${fmt(st.b, 1)}</code>`)}</p>
              <p class="g-small">${tr('Both axes are squeezed to 0–10 for the sum.')}</p>
              <div class="g-ne-acc${ok ? ' is-ok' : ''}" role="status">${tr('Right: {0} of {1} ({2})', right, pts.length, `${Math.round(100 * a)} %`)} · ${tr('goal {0}', `${Math.round(100 * goal)} %`)}${ok ? ' ✓' : ''}</div>
              ${st.epoch ? `<p class="g-small">${tr('Learning: round {0}', st.epoch)}</p>` : ''}
            </div>
          </div>
          ${st.done ? '' : `<div class="g-spot-actions">
            <button class="g-btn g-ne-learn"${st.busy ? ' disabled' : ''}>${tr('🧠 Let the neuron learn')}</button>
            <button class="g-btn g-btn-primary g-ne-done"${ok && !st.busy ? '' : ' disabled'}>${tr('✓ Done')}</button></div>`}
          <div class="g-fb"></div>`;
        const A = S.area;
        ['w1', 'w2', 'b'].forEach(k => {
          const inp = A.querySelector(`.g-ne-${k}`);
          if (inp) inp.oninput = () => { st[k] = +inp.value; render(); this._gameFocus(S.area.querySelector(`.g-ne-${k}`)); };
        });
        const ln = A.querySelector('.g-ne-learn');
        if (ln) ln.onclick = () => learn();
        const dn = A.querySelector('.g-ne-done');
        if (dn) dn.onclick = () => win();
        if (fb) this._gameFeedback(S, fb);
      };
      const next = { nextText: li === levels.length - 1 ? tr('See your score ›') : tr('Next level ›'), onNext: () => { li++; showLevel(); } };
      const win = () => {
        st.done = true;
        const byHand = !st.learned;
        if (byHand) score++;
        else misses.push({ q: L.story, a: `${fmt(st.w1)} · x + ${fmt(st.w2)} · y > ${fmt(st.b, 1)}`, why: L.why });
        this._gameAnswer(S, li, byHand, { acc: r2(acc()), learned: st.learned });
        render({ ok: true, why: L.why, ...next, head: byHand ? tr('✓ Goal reached by hand: {0} right.', `${Math.round(100 * acc())} %`) : tr('✓ Goal reached with the neuron’s own learning: {0} right.', `${Math.round(100 * acc())} %`) });
      };
      // perceptron rule, one pass over the points per round, keeping the best setting seen (pocket);
      // values snap to the sliders' steps, so what the reader sees is what is scored
      const learn = () => {
        st.learned = true; st.busy = true; st.epoch = 0;
        this.rc?.logEvent?.('game_hint', { blockId: S.blockId, game: S.file, level: li, learn: true });
        let w1 = st.w1, w2 = st.w2, b = st.b;
        let pocket = { a: acc(), w1, w2, b };
        const snap = () => {
          const m = Math.max(1, Math.abs(w1), Math.abs(w2));
          st.w1 = Math.round((w1 / m) * 20) / 20; st.w2 = Math.round((w2 / m) * 20) / 20; st.b = Math.max(-20, Math.min(20, Math.round((b / m) * 10) / 10));
        };
        const round = () => {
          if (!S.root.isConnected) return;
          st.epoch++;
          for (const p of pts) {
            const e = p[2] - neuronSays(w1, w2, b, p[0], p[1]);
            if (e) { w1 += 0.02 * e * p[0]; w2 += 0.02 * e * p[1]; b -= 0.2 * e; }
          }
          snap();
          const a = acc();
          if (a > pocket.a + 1e-9) pocket = { a, w1: st.w1, w2: st.w2, b: st.b };
          if (a >= 1 - 1e-9 || st.epoch >= 30) {
            Object.assign(st, { w1: pocket.w1, w2: pocket.w2, b: pocket.b, busy: false });
            render(acc() + 1e-9 >= goal ? null : { ok: null, head: tr('The neuron learned as far as it can: {0} right.', `${Math.round(100 * acc())} %`), why: tr('One straight line can do no better here. Look at where the wrong answers are.') });
            this._gameFocus(S.area.querySelector('.g-ne-done:not([disabled])') || S.area.querySelector('.g-ne-w1'));
            return;
          }
          render();
          setTimeout(round, reducedMotion() ? 0 : 260);
        };
        round();
      };
      render();
      this._gameFocus(S.area.querySelector('.g-ne-w1'));
    };
    showLevel();
  },
};

export const LAB_TYPES = { turtle: '_gameTurtle', gates: '_gameGates', cipher: '_gameCipher', route: '_gameRoute', neuron: '_gameNeuron' };
export function installLabGames(Cls) { Object.assign(Cls.prototype, LabGames); }
