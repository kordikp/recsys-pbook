#!/usr/bin/env node
// Checks the mini-game data in games/*.json with the engine's own pure helpers (js/games.js):
// answer keys in range, a single clear taste twin, reachable mixer and loop goals, a unique
// best bandit arm, a solvable robot map, solvable lab levels (js/games-lab.js) with a reachable ⭐,
// translated lab games that keep the puzzle, and a "why" for every item. Run directly, or via validate-content.js.
//   node scripts/check-games.mjs          → human-readable report, exit 1 on errors
//   node scripts/check-games.mjs --json   → {"errors":[[file,msg]],"warnings":[[file,msg]]}
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const G = await import(pathToFileURL(path.join(ROOT, 'js/games.js')).href);
const LAB = await import(pathToFileURL(path.join(ROOT, 'js/games-lab.js')).href);
const DIR = path.join(ROOT, 'games');
const errors = [], warnings = [];
const err = (f, m) => errors.push([f, m]);
const warn = (f, m) => warnings.push([f, m]);
const TYPES = ['sort', 'pairs', 'order', 'match', 'pop', 'bandit', 'mixer', 'abstop', 'loop', 'trace', 'cloze', 'hotspot', 'estimate', 'grid',
  'turtle', 'gates', 'cipher', 'route', 'neuron'];
const uniq = a => new Set(a).size === a.length;

function whyCoverage(f, list, label) {
  const missing = list.filter(x => !x.why).length;
  if (missing) warn(f, `${missing} of ${list.length} ${label} have no "why" (the engine shows it after every answer)`);
}

function checkSort(f, g) {
  if (!Array.isArray(g.buckets) || g.buckets.length < 2 || !uniq(g.buckets)) return err(f, 'sort needs ≥ 2 unique buckets');
  if (!Array.isArray(g.items) || g.items.length < 4) return err(f, 'sort needs ≥ 4 items');
  g.items.forEach((it, i) => {
    if (!it.text) err(f, `item ${i} has no text`);
    if (!Number.isInteger(it.answer) || it.answer < 0 || it.answer >= g.buckets.length) err(f, `item ${i} ("${it.text}") has answer ${it.answer}, outside 0..${g.buckets.length - 1}`);
  });
  if (!uniq(g.items.map(it => it.text))) err(f, 'duplicate item texts');
  g.buckets.forEach((b, bi) => { if (!g.items.some(it => it.answer === bi)) warn(f, `bucket "${b}" is never the answer`); });
  whyCoverage(f, g.items, 'items');
}

function checkPairs(f, g) {
  const pairs = g.pairs || [];
  const choices = g.choices || 4;
  if (pairs.length < 3) return err(f, 'pairs needs ≥ 3 pairs');
  if (!uniq(pairs.map(p => p.b))) err(f, 'duplicate descriptions (b)');
  const as = [...new Set(pairs.map(p => p.a))];
  pairs.forEach((p, i) => {
    const pool = new Set([...(p.options && p.options.length ? p.options : as)].filter(a => a !== p.a));
    if (pool.size < choices - 1) err(f, `pair ${i} ("${p.a}") has only ${pool.size} distractors for ${choices} choices`);
  });
  whyCoverage(f, pairs, 'pairs');
}

function checkOrder(f, g) {
  if (!Array.isArray(g.steps) || g.steps.length < 3) return err(f, 'order needs ≥ 3 steps');
  if (!uniq(g.steps)) err(f, 'duplicate steps');
  if (g.why && g.why.length !== g.steps.length) err(f, `why[] has ${g.why.length} entries for ${g.steps.length} steps`);
  if (!g.why) warn(f, 'no why[]: steps are placed without an explanation');
}

function checkMatch(f, g) {
  if (g.pairs) return checkPairs(f, g);
  if (!g.matrix) { warn(f, 'match without a fixed matrix: ratings are random (legacy)'); return; }
  const names = Object.keys(g.matrix);
  if (names.some(n => g.matrix[n].length !== g.items.length)) return err(f, 'every matrix row needs one rating per item');
  const st = G.matchStats(g);
  if (!(st.margin >= 0.5)) err(f, `taste twin is not clear: ${st.twin.name} beats the runner-up by ${st.margin.toFixed(2)} stars (need ≥ 0.5)`);
  if (st.predict) {
    if (st.predict.tieAtK) err(f, `predict: neighbour ${st.predict.k} and ${st.predict.k + 1} are tied, so "the ${st.predict.k} nearest" is ambiguous`);
    if (st.you[st.predict.j] != null) err(f, 'predict: the item to predict must be blank (null) in your row');
    if (st.predict.nn.length < st.predict.k) err(f, `predict: fewer than ${st.predict.k} neighbours rated the item`);
  }
}

function checkPop(f, g) {
  if (!Array.isArray(g.items) || typeof g.items[0] !== 'object') return err(f, 'pop needs items[] of {text, hit, why}');
  if (!g.items.some(it => it.hit) || !g.items.some(it => !it.hit)) err(f, 'pop needs at least one hit and one non-hit');
  whyCoverage(f, g.items, 'items');
}

function checkBandit(f, g) {
  const arms = g.arms || [];
  if (arms.length < 2) return err(f, 'bandit needs ≥ 2 arms');
  if (arms.some(a => !(a.p > 0 && a.p < 1))) err(f, 'every arm needs 0 < p < 1');
  const ps = arms.map(a => a.p).sort((a, b) => b - a);
  if (ps[0] === ps[1]) err(f, 'the best arm must be unique');
  const pulls = g.pulls || 40;
  if (pulls < arms.length * 5) warn(f, `${pulls} pulls is little for ${arms.length} arms`);
  (g.compare || []).forEach(p => { if (!G.BANDIT_POLICIES[p]) err(f, `unknown policy "${p}"`); });
  // the lesson only works if Thompson sampling beats uniform on average
  const avg = G.banditReplays(arms, pulls, ['thompson', 'uniform'], 300, 12345);
  if (!(avg.thompson > avg.uniform)) err(f, `Thompson (${avg.thompson.toFixed(1)}) does not beat uniform (${avg.uniform.toFixed(1)}) with these rates`);
}

function checkMixer(f, g) {
  if (!g.weights?.length || !g.items?.length || !g.kpis?.length) return err(f, 'mixer needs weights[], items[] and kpis[]');
  const keys = new Set(g.kpis.flatMap(k => [k.as || k.key, (k.as || k.key) + '_rel']));
  (g.goals || []).forEach((goal, i) => {
    const check = goal.check || {};
    Object.keys(check).forEach(k => { if (!keys.has(k)) err(f, `goal ${i + 1}: unknown KPI "${k}"`); });
    Object.values(check).forEach(c => { if (!/^\s*(>=|<=|==|>|<)\s*-?[\d.]+\s*$/.test(c)) err(f, `goal ${i + 1}: cannot parse "${c}"`); });
    if (Object.keys(check).length) {
      const { sols, total } = G.mixerSolutions(g, goal);
      if (!sols.length) err(f, `goal ${i + 1} ("${goal.text}") is unreachable with any slider/toggle setting`);
      else if (sols.length / total > 0.6) warn(f, `goal ${i + 1} is met by ${Math.round(100 * sols.length / total)}% of settings: too easy?`);
    }
    if (!goal.why) warn(f, `goal ${i + 1} has no "why"`);
  });
}

function checkAbstop(f, g) {
  if (!g.rounds?.length) return err(f, 'abstop needs rounds[]');
  g.rounds.forEach((r, i) => {
    if (!(r.pA > 0 && r.pA < 1 && r.pB > 0 && r.pB < 1)) err(f, `round ${i + 1}: rates must be in (0, 1)`);
    if (r.trap && r.pA !== r.pB) err(f, `round ${i + 1}: a trap round must be an A/A test (pA = pB)`);
    if (r.novelty && r.pA !== r.pB) warn(f, `round ${i + 1}: novelty on top of a real difference makes the verdict text ambiguous`);
  });
}

function checkLoop(f, g) {
  if (g.mode === 'user') {
    if (!(g.topics?.length >= (g.goalTopics || 5))) err(f, 'loop/user needs at least goalTopics topics');
    (g.topics || []).forEach((t, i) => { if (!t.items?.length) err(f, `topic ${i} has no items`); });
    return;
  }
  const items = g.items || [];
  if (items.filter(x => x.gem).length !== 1) return err(f, 'loop/creator needs exactly one "gem" item');
  const fixes = (g.interventions || []).map(x => x.key);
  const seeds = [11, 22, 33, 44, 55, 66, 77, 88];
  const goalOk = (r, r1) => (g.goals || []).every(goal => Object.entries(goal.check || {}).every(([k, v]) =>
    k === 'gemTop' ? r.gemTop === v : k === 'clickRel' ? G.checkCond(r.total / Math.max(1, r1.total), v) : false));
  const baseline = seeds.filter(s => G.loopCreatorRun(g, {}, s).gemTop).length;
  if (baseline > 1) err(f, `without any fix the gem reaches the top in ${baseline}/${seeds.length} seeds: no loop to break`);
  let best = 0, bestCombo = '';
  for (let mask = 1; mask < (1 << fixes.length); mask++) {
    const on = Object.fromEntries(fixes.map((k, i) => [k, !!(mask & (1 << i))]));
    const ok = seeds.filter(s => goalOk(G.loopCreatorRun(g, on, s), G.loopCreatorRun(g, {}, s))).length;
    if (ok > best) { best = ok; bestCombo = fixes.filter(k => on[k]).join('+'); }
  }
  if (best < seeds.length * 0.75) err(f, `best fix combination (${bestCombo || 'none'}) meets all goals in only ${best}/${seeds.length} seeds`);
}

function checkChoice(f, where, q) {
  if (!Array.isArray(q.options) || q.options.length < 2 || !uniq(q.options)) return err(f, `${where}: needs ≥ 2 unique options`);
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) err(f, `${where}: answer ${q.answer} outside 0..${q.options.length - 1}`);
}

function checkTrace(f, g) {
  const rounds = g.rounds || [{ code: g.code, steps: g.steps }];
  if (!rounds.length) return err(f, 'trace needs code[] + steps[] or rounds[]');
  const answers = [];
  rounds.forEach((r, ri) => {
    if (!Array.isArray(r.code) || !r.code.length) return err(f, `round ${ri}: no code[]`);
    if (!Array.isArray(r.steps) || !r.steps.length) return err(f, `round ${ri}: no steps[]`);
    r.steps.forEach((st, si) => {
      const where = `round ${ri} step ${si}`;
      if (!st.q) err(f, `${where}: no q`);
      checkChoice(f, where, st);
      answers.push(st.answer);
      [].concat(st.line ?? []).forEach(n => { if (!Number.isInteger(n) || n < 0 || n >= r.code.length) err(f, `${where}: line ${n} is not a line of the code`); });
    });
    whyCoverage(f, r.steps, `steps of round ${ri}`);
  });
  if (answers.length >= 4 && new Set(answers).size === 1) warn(f, `every answer is option ${answers[0]}: vary the position`);
}

function checkCloze(f, g) {
  if (!Array.isArray(g.items) || !g.items.length) return err(f, 'cloze needs items[]');
  g.items.forEach((it, i) => {
    const marks = [...String(it.text || '').matchAll(/\{(\d+)\}/g)].map(m => +m[1]);
    if (!marks.length) err(f, `item ${i}: text has no {0} gap`);
    if (!Array.isArray(it.gaps) || marks.length !== it.gaps.length || marks.some((n, k) => n !== k)) err(f, `item ${i}: gaps {0}…{n} must appear once each, in order, one per gaps[] entry`);
    // options are shuffled per gap at play time, so the authored answer position does not matter
    (it.gaps || []).forEach((gp, k) => checkChoice(f, `item ${i} gap ${k}`, gp));
  });
  whyCoverage(f, g.items, 'items');
}

function checkHotspot(f, g) {
  if (!Array.isArray(g.items) || !g.items.length) return err(f, 'hotspot needs items[]');
  if (!g.items.some(it => (it.segments || []).some(x => x.hit))) err(f, 'hotspot needs at least one hit segment');
  g.items.forEach((it, i) => {
    const segs = it.segments || [];
    if (segs.length < 3) err(f, `item ${i}: needs ≥ 3 segments`);
    if (!segs.some(x => !x.hit)) err(f, `item ${i}: needs at least one segment that is not a hit`);
    if (!segs.some(x => x.hit) && !it.why) warn(f, `item ${i}: a round with nothing to mark needs a "why" (it says why the message is fine)`);
    segs.forEach((x, k) => { if (!x.text || !x.text.trim()) err(f, `item ${i} segment ${k}: empty text`); });
    const noWhy = segs.filter(x => x.hit && !x.why).length;
    if (noWhy) warn(f, `item ${i}: ${noWhy} hit segment(s) without "why"`);
  });
}

function checkEstimate(f, g) {
  if (!Array.isArray(g.items) || !g.items.length) return err(f, 'estimate needs items[]');
  g.items.forEach((it, i) => {
    if (!it.q) err(f, `item ${i}: no q`);
    const sc = it.scale || (it.min == null ? g.scale : null);
    if (sc) {
      if (!Array.isArray(sc) || sc.length < 3 || !uniq(sc)) return err(f, `item ${i}: scale needs ≥ 3 unique labels`);
      if (!Number.isInteger(it.answer) || it.answer < 0 || it.answer >= sc.length) err(f, `item ${i}: answer ${it.answer} is not a step of the scale`);
      return;
    }
    const step = it.step || 1;
    if (!(typeof it.min === 'number' && typeof it.max === 'number' && it.min < it.max)) return err(f, `item ${i}: needs min < max (or a scale)`);
    if (!(it.answer >= it.min && it.answer <= it.max)) err(f, `item ${i}: answer ${it.answer} outside ${it.min}..${it.max}`);
    if (Math.abs(((it.answer - it.min) / step) - Math.round((it.answer - it.min) / step)) > 1e-9) err(f, `item ${i}: answer ${it.answer} is not reachable with step ${step}`);
    const tol = it.tolerance != null ? it.tolerance : step;
    if ((tol * 2) / (it.max - it.min) > 0.4) warn(f, `item ${i}: tolerance ±${tol} covers ${Math.round(100 * tol * 2 / (it.max - it.min))}% of the range: too easy?`);
  });
  whyCoverage(f, g.items, 'items');
}

function checkGrid(f, g) {
  if (!Array.isArray(g.levels) || !g.levels.length) return err(f, 'grid needs levels[]');
  g.levels.forEach((L, i) => {
    const P = G.gridParse(L);
    if (!P.start || !P.goal) return err(f, `level ${i}: the map needs one S and one G`);
    const bad = L.map.join('').replace(/[SG#.]/g, '');
    if (bad) err(f, `level ${i}: unknown map characters "${bad}"`);
    const sol = G.gridSolve(L);
    if (!sol) return err(f, `level ${i}: the goal cannot be reached`);
    const max = L.max || 12;
    if (sol.length > max) err(f, `level ${i}: the shortest program has ${sol.length} commands, more than max ${max}`);
    else if (sol.length === max) warn(f, `level ${i}: only the shortest program fits (max ${max}): no room for a detour`);
    if (L.solution && !G.gridRun(L, L.solution.split(/\s+/).map(t => (/^\d$/.test(t) ? +t : t))).ok) err(f, `level ${i}: the given solution does not reach the goal`);
  });
  whyCoverage(f, g.levels, 'levels');
}

// ----- lab games (js/games-lab.js): open-ended levels, so check that each is solvable and its ⭐ reachable -----
function levels(f, g) {
  if (!Array.isArray(g.levels) || !g.levels.length) { err(f, `${g.type} needs levels[]`); return []; }
  whyCoverage(f, g.levels, 'levels');
  return g.levels;
}

function checkTurtle(f, g) {
  levels(f, g).forEach((L, i) => {
    const p = LAB.turtleParse(L.target);
    if (!p.ok) return err(f, `level ${i}: target does not parse (${p.error.code} ${(p.error.args || []).join(' ')})`);
    const run = LAB.turtleRun(p.ast);
    if (!run.ok) return err(f, `level ${i}: target stops with ${run.error?.code}`);
    if (!run.segs.length) err(f, `level ${i}: target draws nothing`);
    if (L.max != null && p.count > L.max) err(f, `level ${i}: the target needs ${p.count} commands, more than the ⭐ limit ${L.max}`);
  });
}

function checkGates(f, g) {
  levels(f, g).forEach((L, i) => {
    const ins = L.inputs || [];
    if (!ins.length || !uniq(ins)) return err(f, `level ${i}: needs unique inputs[]`);
    if (!L.outputs || !Object.keys(L.outputs).length) return err(f, `level ${i}: needs outputs {name: expression}`);
    try { LAB.gatesTable(L); } catch (e) { return err(f, `level ${i}: expression does not parse (${e.code} ${(e.args || []).join(' ')})`); }
    (L.allow || []).forEach(op => { if (!LAB.GATE_OPS[op]) err(f, `level ${i}: unknown gate "${op}" in allow`); });
    if (!L.solution) return err(f, `level ${i}: no solution (the engine shows it after three checks)`);
    const sol = LAB.gatesCircuit(L.solution);
    sol.gates.forEach((x, k) => {
      if (!LAB.GATE_OPS[x.op]) err(f, `level ${i}: solution gate ${k} has unknown op "${x.op}"`);
      if (L.allow && !L.allow.includes(x.op)) err(f, `level ${i}: solution uses ${x.op}, which allow[] does not offer`);
      const srcs = LAB.GATE_OPS[x.op]?.length === 1 ? [x.a] : [x.a, x.b];
      srcs.forEach(s => { if (!ins.includes(s) && !(/^g\d+$/.test(s) && +s.slice(1) < k)) err(f, `level ${i}: solution gate ${k} reads "${s}", not an input or an earlier gate`); });
    });
    if (!LAB.gatesCheck(L, sol).ok) err(f, `level ${i}: the solution does not give the truth table`);
    if (L.max != null && sol.gates.length > L.max) err(f, `level ${i}: the solution has ${sol.gates.length} gates, more than the ⭐ limit ${L.max}`);
  });
}

function checkCipher(f, g) {
  levels(f, g).forEach((L, i) => {
    const p = LAB.cipherKeyProblem(L.kind, L.key);
    if (p) err(f, `level ${i}: ${p}`);
    const n = LAB.cipherNorm(L.plain).replace(/[^A-Z]/g, '').length;
    if (n < 12) err(f, `level ${i}: the plain text has only ${n} letters`);
    else if (L.kind !== 'caesar' && n < 60) warn(f, `level ${i}: ${n} letters is little for counting letter frequencies`);
  });
}

function checkRoute(f, g) {
  levels(f, g).forEach((L, i) => {
    const ids = (L.nodes || []).map(n => n.id);
    if (ids.length < 3 || !uniq(ids)) return err(f, `level ${i}: needs ≥ 3 nodes with unique ids`);
    (L.nodes || []).forEach(n => { if (!(n.x >= 0 && n.x <= 100 && n.y >= 0 && n.y <= 100)) err(f, `level ${i}: node ${n.id} is off the 0–100 grid`); });
    (L.edges || []).forEach(([a, b, w]) => {
      if (!ids.includes(a) || !ids.includes(b)) err(f, `level ${i}: edge ${a}-${b} has an unknown end`);
      if (!(+w > 0)) err(f, `level ${i}: edge ${a}-${b} needs a positive weight`);
    });
    if (!ids.includes(L.from) || !ids.includes(L.to)) return err(f, `level ${i}: from/to must be node ids`);
    const best = LAB.routeBest(L);
    if (!best) return err(f, `level ${i}: ${L.to} cannot be reached from ${L.from}`);
    if (best.count > 1) warn(f, `level ${i}: ${best.count} routes tie for the fastest (${best.cost}); the "why" should not name just one`);
    const clash = LAB.routeClashes(L);
    if (clash.length) warn(f, `level ${i}: crowded on a phone (move nodes apart): ${clash.join(', ')}`);
  });
}

function checkNeuron(f, g) {
  levels(f, g).forEach((L, i) => {
    const P = L.points || [];
    if (P.length < 6) return err(f, `level ${i}: needs ≥ 6 points [x, y, 0|1]`);
    if (!P.some(p => p[2]) || !P.some(p => !p[2])) return err(f, `level ${i}: needs points of both kinds`);
    if ((L.axes || []).length !== 2 || (L.labels || []).length !== 2) err(f, `level ${i}: needs axes [x, y] and labels [kind 0, kind 1]`);
    if (!(L.goal > 0 && L.goal <= 1)) return err(f, `level ${i}: goal must be an accuracy in (0, 1]`);
    const best = LAB.neuronBest(L);
    if (best.acc + 1e-9 < L.goal) err(f, `level ${i}: the sliders reach at most ${(100 * best.acc).toFixed(1)} %, the goal is ${100 * L.goal} %`);
  });
}

// A translated game (name.<lang>.json) may change words, never the puzzle
function checkEdition(f, g, base) {
  if (g.type !== base.type) return err(f, `type ${g.type} differs from the original ${base.type}`);
  if (!g.levels || !base.levels) return;
  if (g.levels.length !== base.levels.length) return err(f, `${g.levels.length} levels, the original has ${base.levels.length}`);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  g.levels.forEach((L, i) => {
    const B = base.levels[i];
    const bad = k => err(f, `level ${i}: ${k} differs from the original`);
    if (g.type === 'turtle') {
      const a = LAB.turtleParse(L.target), b = LAB.turtleParse(B.target);
      if (a.ok && b.ok && !LAB.turtleSame(LAB.turtleRun(a.ast).segs, LAB.turtleRun(b.ast).segs)) bad('the target picture');
      if (L.max !== B.max) bad('max');
    }
    if (g.type === 'gates') ['inputs', 'outputs', 'allow', 'max', 'solution'].forEach(k => { if (!same(L[k], B[k])) bad(k); });
    if (g.type === 'cipher') ['kind', 'key'].forEach(k => { if (!same(L[k], B[k])) bad(k); });
    if (g.type === 'route') {
      ['edges', 'from', 'to'].forEach(k => { if (!same(L[k], B[k])) bad(k); });
      if (!same((L.nodes || []).map(n => [n.id, n.x, n.y]), (B.nodes || []).map(n => [n.id, n.x, n.y]))) bad('nodes');
    }
    if (g.type === 'neuron') ['points', 'goal'].forEach(k => { if (!same(L[k], B[k])) bad(k); });
  });
}

const CHECK = { sort: checkSort, pairs: checkPairs, order: checkOrder, match: checkMatch, pop: checkPop, bandit: checkBandit, mixer: checkMixer, abstop: checkAbstop, loop: checkLoop,
  trace: checkTrace, cloze: checkCloze, hotspot: checkHotspot, estimate: checkEstimate, grid: checkGrid,
  turtle: checkTurtle, gates: checkGates, cipher: checkCipher, route: checkRoute, neuron: checkNeuron };
const LAB_EDITION = new Set(['turtle', 'gates', 'cipher', 'route', 'neuron']);

for (const file of (fs.existsSync(DIR) ? fs.readdirSync(DIR) : []).filter(x => x.endsWith('.json')).sort()) {   // a book may have no games
  const f = `games/${file}`;
  let g;
  try { g = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8')); } catch (e) { err(f, `invalid JSON: ${e.message}`); continue; }
  if (!TYPES.includes(g.type)) { err(f, `unknown type "${g.type}"`); continue; }
  if (!g.title) err(f, 'missing title');
  if (!g.instruction) warn(f, 'missing instruction');
  if (!g.debrief) warn(f, 'missing debrief (the takeaway on the end screen)');
  if (g.timer != null && !(g.timer >= 30)) warn(f, 'timer under 30 s: reasoning games should be untimed');
  try { CHECK[g.type](f, g); } catch (e) { err(f, `check crashed: ${e.message}`); }
  const base = file.match(/^(.+)\.[a-z]{2}\.json$/);
  if (base && LAB_EDITION.has(g.type) && fs.existsSync(path.join(DIR, `${base[1]}.json`))) {
    try { checkEdition(f, g, JSON.parse(fs.readFileSync(path.join(DIR, `${base[1]}.json`), 'utf8'))); } catch (e) { err(f, `edition check crashed: ${e.message}`); }
  }
}

if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify({ errors, warnings }));
} else {
  errors.forEach(([f, m]) => console.log(`ERROR ${f}: ${m}`));
  warnings.forEach(([f, m]) => console.log(`WARN  ${f}: ${m}`));
  console.log(`${errors.length} errors, ${warnings.length} warnings`);
  if (errors.length) process.exit(1);
}
