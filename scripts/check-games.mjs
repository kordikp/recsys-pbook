#!/usr/bin/env node
// Checks the mini-game data in games/*.json with the engine's own pure helpers (js/games.js):
// answer keys in range, a single clear taste twin, reachable mixer and loop goals, a unique
// best bandit arm, and a "why" for every item. Run directly, or via validate-content.js.
//   node scripts/check-games.mjs          → human-readable report, exit 1 on errors
//   node scripts/check-games.mjs --json   → {"errors":[[file,msg]],"warnings":[[file,msg]]}
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const G = await import(pathToFileURL(path.join(ROOT, 'js/games.js')).href);
const DIR = path.join(ROOT, 'games');
const errors = [], warnings = [];
const err = (f, m) => errors.push([f, m]);
const warn = (f, m) => warnings.push([f, m]);
const TYPES = ['sort', 'pairs', 'order', 'match', 'pop', 'bandit', 'mixer', 'abstop', 'loop'];
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

const CHECK = { sort: checkSort, pairs: checkPairs, order: checkOrder, match: checkMatch, pop: checkPop, bandit: checkBandit, mixer: checkMixer, abstop: checkAbstop, loop: checkLoop };

for (const file of fs.readdirSync(DIR).filter(x => x.endsWith('.json')).sort()) {
  const f = `games/${file}`;
  let g;
  try { g = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8')); } catch (e) { err(f, `invalid JSON: ${e.message}`); continue; }
  if (!TYPES.includes(g.type)) { err(f, `unknown type "${g.type}"`); continue; }
  if (!g.title) err(f, 'missing title');
  if (!g.instruction) warn(f, 'missing instruction');
  if (!g.debrief) warn(f, 'missing debrief (the takeaway on the end screen)');
  if (g.timer != null && !(g.timer >= 30)) warn(f, 'timer under 30 s: reasoning games should be untimed');
  try { CHECK[g.type](f, g); } catch (e) { err(f, `check crashed: ${e.message}`); }
}

if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify({ errors, warnings }));
} else {
  errors.forEach(([f, m]) => console.log(`ERROR ${f}: ${m}`));
  warnings.forEach(([f, m]) => console.log(`WARN  ${f}: ${m}`));
  console.log(`${errors.length} errors, ${warnings.length} warnings`);
  if (errors.length) process.exit(1);
}
