// p-book mini-games — data-driven from games/*.json.
//
// The engine is mixed into the PBook class (js/app.js calls installGames(PBook)).
// A game is a vetted template plus data: authors (and later the generator) only
// write JSON. Types and fields are documented in CONTRIBUTING.md → "Adding a game";
// scripts/check-games.mjs checks the data (answer keys, reachable goals, a unique
// taste twin) with the pure helpers exported below.
//
// Rules of the engine (v2):
// - untimed unless the JSON sets "timer" (seconds);
// - every answer is explained: ✓/✗ in text (never colour alone), the right answer, the item's "why";
// - options stay neutral until answered; buttons only, keys 1–9 pick an option;
// - replay and a personal best; XP proportional to the score, once per game per day;
// - the end screen links the concept (#c/<slug>);
// - simulations use seeded, common random numbers so comparisons are fair, and every
//   number shown on an end screen is computed live, never typed in.

import { tr, trn, locale } from './i18n.js';

// ===== Pure helpers (no DOM; exported for scripts/check-games.mjs) =====

export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Standard normal CDF (Abramowitz & Stegun 7.1.26 erf approximation, |error| < 1.5e-7)
export function normCdf(z) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

// Two-sided two-proportion z-test (pooled), the textbook A/B test
export function twoPropTest(cA, nA, cB, nB) {
  if (!nA || !nB) return { z: 0, p: 1 };
  const pp = (cA + cB) / (nA + nB);
  const se = Math.sqrt(pp * (1 - pp) * (1 / nA + 1 / nB));
  if (!se) return { z: 0, p: 1 };
  const z = (cB / nB - cA / nA) / se;
  return { z, p: 2 * (1 - normCdf(Math.abs(z))) };
}

// Power of that test for true rates pA, pB with n users per arm (normal approximation)
export function twoPropPower(pA, pB, n, alpha = 0.05) {
  const zA = 1.959963984540054; // two-sided 5 %; other alphas are not used by the games
  const pp = (pA + pB) / 2;
  const se0 = Math.sqrt(2 * pp * (1 - pp) / n);
  const se1 = Math.sqrt((pA * (1 - pA) + pB * (1 - pB)) / n);
  if (!se1) return alpha;
  const d = Math.abs(pB - pA);
  return normCdf((d - zA * se0) / se1);
}

// Beta(a, b) for positive integers: the a-th smallest of a+b-1 uniforms (no gamma function needed)
export function betaSampleInt(a, b, rand) {
  const u = [];
  for (let i = 0; i < a + b - 1; i++) u.push(rand());
  u.sort((x, y) => x - y);
  return u[a - 1];
}

// Plausible range of a click rate after s clicks in n showings: Beta(1+s, 1+n−s) mean ± 1.645 sd
export function betaInterval(s, n, z = 1.645) {
  const a = s + 1, b = n - s + 1;
  const m = a / (a + b);
  const sd = Math.sqrt(a * b / ((a + b) ** 2 * (a + b + 1)));
  return { mean: m, lo: Math.max(0, m - z * sd), hi: Math.min(1, m + z * sd) };
}

function argmaxRandomTie(vals, rand) {
  let best = -Infinity, idx = [];
  vals.forEach((v, i) => { if (v > best + 1e-12) { best = v; idx = [i]; } else if (Math.abs(v - best) <= 1e-12) idx.push(i); });
  return idx.length > 1 ? idx[Math.floor(rand() * idx.length)] : idx[0];
}

// --- bandit ---
// outcomes[a][k] = does the k-th showing of arm a get a click? Shared by the player and
// every policy ("common random numbers"), so a comparison is about decisions, not luck.
export function banditOutcomes(arms, pulls, rand) {
  return arms.map(arm => Array.from({ length: pulls }, () => rand() < arm.p));
}

export const BANDIT_POLICIES = {
  thompson: tr('Thompson sampling'),
  greedy: tr('Greedy (try each once, then stick with the best so far)'),
  epsilon: tr('ε-greedy (like greedy, but explores 10 % of the time)'),
  uniform: tr('Uniform (pick at random every time)'),
};

export function banditRun(policy, outcomes, pulls, rand, eps = 0.1) {
  const K = outcomes.length;
  const n = Array(K).fill(0), s = Array(K).fill(0);
  let clicks = 0;
  for (let t = 0; t < pulls; t++) {
    let a;
    if (policy === 'uniform') a = Math.floor(rand() * K);
    else if (policy === 'thompson') a = argmaxRandomTie(n.map((ni, i) => betaSampleInt(1 + s[i], 1 + ni - s[i], rand)), rand);
    else {
      const untried = n.findIndex(x => x === 0);
      if (untried >= 0) a = untried;
      else if (policy === 'epsilon' && rand() < eps) a = Math.floor(rand() * K);
      else a = argmaxRandomTie(n.map((ni, i) => s[i] / ni), rand);
    }
    const hit = outcomes[a][n[a]];
    n[a]++;
    if (hit) { s[a]++; clicks++; }
  }
  return { clicks, n, s };
}

export function banditReplays(arms, pulls, policies, runs, seed) {
  const sum = Object.fromEntries(policies.map(p => [p, 0]));
  for (let r = 0; r < runs; r++) {
    const out = banditOutcomes(arms, pulls, makeRng(seed + 7919 * (r + 1)));
    policies.forEach((p, k) => { sum[p] += banditRun(p, out, pulls, makeRng(seed + 104729 * (r + 1) + k)).clicks; });
  }
  return Object.fromEntries(policies.map(p => [p, sum[p] / runs]));
}

// --- mixer (weighted ranking + business constraints) ---
export function mixerRank(game, weights, toggles) {
  const slots = game.slots || 5;
  const scored = game.items.map((it, i) => ({
    ...it, _i: i,
    _s: Object.entries(weights).reduce((acc, [k, w]) => acc + (Number(w) || 0) * (Number(it[k]) || 0), 0),
  }));
  const on = (game.toggles || []).filter(t => toggles[t.key]);
  let pool = scored;
  on.filter(t => t.kind === 'hide').forEach(t => {
    const v = t.value === undefined ? false : t.value;
    pool = pool.filter(it => (it[t.field] === undefined ? !v : it[t.field]) !== v);
  });
  pool = pool.slice().sort((a, b) => (b._s - a._s) || (a._i - b._i));
  const caps = on.filter(t => t.kind === 'maxPer');
  const feed = [];
  const counts = {};
  for (const it of pool) {
    if (feed.length >= slots) break;
    if (caps.some(c => (counts[c.field + '|' + it[c.field]] || 0) >= (c.n || 2))) continue;
    caps.forEach(c => { const k = c.field + '|' + it[c.field]; counts[k] = (counts[k] || 0) + 1; });
    feed.push(it);
  }
  on.filter(t => t.kind === 'reserve').forEach(t => {
    const need = t.n || 1;
    while (feed.filter(it => it[t.field]).length < need) {
      const cand = pool.find(it => it[t.field] && !feed.includes(it));
      if (!cand) break;
      let drop = -1;
      for (let k = feed.length - 1; k >= 0; k--) { if (!feed[k][t.field]) { drop = k; break; } }
      if (feed.length < slots) feed.push(cand);
      else if (drop >= 0) { feed.splice(drop, 1); feed.push(cand); }
      else break;
    }
  });
  on.filter(t => t.kind === 'pin').forEach(t => {
    const it = pool.find(x => x[t.field]);
    if (!it) return;
    const at = feed.indexOf(it);
    if (at >= 0) feed.splice(at, 1);
    feed.splice(Math.max(0, Math.min(feed.length, (t.slot || 1) - 1)), 0, it);
    if (feed.length > slots) feed.length = slots;
  });
  return feed;
}

// KPI values for a feed. "sum" KPIs also get <key>_rel = value / (best feed by that field alone).
export function mixerKpis(game, feed) {
  const out = {};
  const slots = game.slots || 5;
  for (const k of game.kpis || []) {
    const key = k.as || k.key;
    const vals = feed.map(it => it[k.key]);
    if (k.agg === 'sum') {
      out[key] = vals.reduce((a, v) => a + (Number(v) || 0), 0);
      const best = game.items.map(it => Number(it[k.key]) || 0).sort((a, b) => b - a).slice(0, slots).reduce((a, v) => a + v, 0);
      out[key + '_rel'] = best ? out[key] / best : 0;
    } else if (k.agg === 'mean') out[key] = vals.length ? vals.reduce((a, v) => a + (Number(v) || 0), 0) / vals.length : 0;
    else if (k.agg === 'distinct') out[key] = new Set(vals).size;
    else if (k.agg === 'count') out[key] = vals.filter(v => k.value === undefined ? !!v : v === k.value).length;
  }
  return out;
}

export function checkCond(value, cond) {
  const m = String(cond).match(/^\s*(>=|<=|==|>|<)\s*(-?[\d.]+)\s*$/);
  if (!m) return false;
  const x = parseFloat(m[2]);
  return { '>=': value >= x - 1e-9, '<=': value <= x + 1e-9, '==': Math.abs(value - x) < 1e-9, '>': value > x, '<': value < x }[m[1]];
}

export function mixerCheck(check, kpis) {
  return Object.entries(check || {}).every(([k, c]) => kpis[k] !== undefined && checkCond(kpis[k], c));
}

// Grid search over slider weights (step 10) and toggle combinations: which settings meet a goal?
export function mixerSolutions(game, goal) {
  const ws = game.weights, ts = game.toggles || [];
  const sols = [];
  let total = 0;
  const steps = Array.from({ length: 11 }, (_, i) => i * 10);
  const rec = (i, w) => {
    if (i === ws.length) {
      for (let mask = 0; mask < (1 << ts.length); mask++) {
        const t = Object.fromEntries(ts.map((x, k) => [x.key, !!(mask & (1 << k))]));
        total++;
        if (mixerCheck(goal.check, mixerKpis(game, mixerRank(game, w, t)))) sols.push({ w: { ...w }, t });
      }
      return;
    }
    for (const v of steps) rec(i + 1, { ...w, [ws[i].key]: v });
  };
  rec(0, {});
  return { sols, total };
}

// --- loop: creator mode (rich get richer) ---
export function loopCreatorRun(game, fixes, seed) {
  const items = game.items.map((it, i) => ({
    i, name: it.name, appeal: it.appeal, gem: !!it.gem,
    clicks: it.seedClicks || 0, imps: it.seedImpressions || 0, earned: 0, shownDays: 0,
    rand: makeRng(seed + 1000003 * (i + 1)),
  }));
  const slots = game.slots || 3, users = game.usersPerDay || 100, days = game.days || 30;
  const history = [];
  let total = 0;
  for (let d = 1; d <= days; d++) {
    const base = it => fixes.ctrRank ? (it.clicks + 1) / (it.imps + 2) : it.clicks;
    let order = items.slice().sort((a, b) => (base(b) - base(a)) || (a.i - b.i));
    if (fixes.freshBoost) {
      const fresh = order.filter(it => it.imps < (game.freshUnder || 50)).sort((a, b) => (a.imps - b.imps) || (a.i - b.i));
      order = [...fresh, ...order.filter(it => !fresh.includes(it))];
    }
    const shown = order.slice(0, slots);
    if (fixes.exploreSlot) {
      const rest = items.filter(it => !shown.slice(0, slots - 1).includes(it)).sort((a, b) => (a.imps - b.imps) || (a.i - b.i));
      shown[slots - 1] = rest[0];
    }
    let today = 0;
    for (const it of shown) {
      let c = 0;
      for (let u = 0; u < users; u++) if (it.rand() < it.appeal) c++;
      it.clicks += c; it.earned += c; it.imps += users; it.shownDays++;
      today += c;
    }
    total += today;
    history.push({ d, shown: shown.map(it => it.i), clicks: items.map(it => it.clicks), imps: items.map(it => it.imps), today });
  }
  const runImps = items.map(it => it.imps - ((game.items[it.i].seedImpressions) || 0));
  const allImps = runImps.reduce((a, v) => a + v, 0);
  const gem = items.find(it => it.gem);
  const byClicks = items.slice().sort((a, b) => b.clicks - a.clicks || a.i - b.i);
  return {
    total, history,
    items: items.map((it, k) => ({ name: it.name, appeal: it.appeal, gem: it.gem, clicks: it.clicks, earned: it.earned, imps: it.imps, runImps: runImps[k], shownDays: it.shownDays })),
    topShare: allImps ? Math.max(...runImps) / allImps : 0,
    gemTop: gem ? byClicks.slice(0, slots).includes(gem) : false,
    gemShown: gem ? gem.shownDays : 0,
  };
}

// --- loop: user mode (filter bubble) ---
// Feed of `size` topic slots sampled ∝ profile^gamma; `explore` extra slots come from topics not yet in the feed.
export function bubbleFeed(profile, size, rand, explore = 0, gamma = 2) {
  const w = profile.map(p => Math.pow(Math.max(p, 0), gamma));
  const sum = w.reduce((a, v) => a + v, 0) || 1;
  const out = [];
  for (let i = 0; i < size - explore; i++) {
    let x = rand() * sum, t = 0;
    while (t < w.length - 1 && x >= w[t]) { x -= w[t]; t++; }
    out.push(t);
  }
  for (let i = 0; i < explore; i++) {
    const missing = profile.map((_, t) => t).filter(t => !out.includes(t));
    const from = missing.length ? missing : profile.map((_, t) => t);
    out.push(from[Math.floor(rand() * from.length)]);
  }
  return shuffled(out, rand);
}

export function bubbleUpdate(profile, t, action = 'click', rate = 0.2) {
  if (action === 'hide') {
    const q = profile.map((p, i) => (i === t ? p * 0.3 : p));
    const s = q.reduce((a, v) => a + v, 0) || 1;
    return q.map(x => x / s);
  }
  return profile.map((p, i) => (1 - rate) * p + (i === t ? rate : 0));
}

// --- abstop (day-by-day A/B test) ---
function binomial(n, p, rand) { let c = 0; for (let i = 0; i < n; i++) if (rand() < p) c++; return c; }

export function abstopSimulate(round, cfg, rand) {
  const days = [];
  let nA = 0, cA = 0, nB = 0, cB = 0;
  for (let d = 1; d <= cfg.maxDays; d++) {
    const pBd = round.pB + (round.novelty ? round.novelty.boost * Math.pow(0.5, (d - 1) / round.novelty.halfLifeDays) : 0);
    const da = binomial(cfg.usersPerDay, round.pA, rand), db = binomial(cfg.usersPerDay, pBd, rand);
    nA += cfg.usersPerDay; nB += cfg.usersPerDay; cA += da; cB += db;
    const t = twoPropTest(cA, nA, cB, nB);
    days.push({ d, nA, cA, nB, cB, p: t.p, z: t.z, lift: cA ? (cB / nB) / (cA / nA) - 1 : 0, dailyDiff: (db - da) / cfg.usersPerDay });
  }
  return days;
}

export function abstopPeekingRate(cfg, sims, seed, p = 0.1) {
  let ever = 0, atPlan = 0;
  for (let s = 0; s < sims; s++) {
    const days = abstopSimulate({ pA: p, pB: p }, { ...cfg, maxDays: cfg.plannedDays }, makeRng(seed + 31337 * (s + 1)));
    if (days.some(x => x.p < (cfg.alpha || 0.05))) ever++;
    if (days[days.length - 1].p < (cfg.alpha || 0.05)) atPlan++;
  }
  return { ever: ever / sims, atPlan: atPlan / sims };
}

// --- match (taste twin) ---
export function matchStats(game) {
  const names = Object.keys(game.matrix);
  const youName = game.you || names[0];
  const you = game.matrix[youName];
  const others = names.filter(n => n !== youName).map(name => {
    const r = game.matrix[name];
    const co = you.map((v, j) => (v != null && r[j] != null ? Math.abs(v - r[j]) : null)).filter(v => v != null);
    return { name, r, mad: co.length ? co.reduce((a, v) => a + v, 0) / co.length : Infinity, co: co.length };
  }).sort((a, b) => a.mad - b.mad);
  const res = { youName, you, others, twin: others[0], margin: others.length > 1 ? others[1].mad - others[0].mad : Infinity };
  if (game.predict) {
    const j = game.predict.item, k = game.predict.k || 2;
    const raters = others.filter(o => o.r[j] != null);
    const nn = raters.slice(0, k);
    const pred = nn.reduce((a, o) => a + o.r[j], 0) / (nn.length || 1);
    const everyone = raters.reduce((a, o) => a + o.r[j], 0) / (raters.length || 1);
    res.predict = { j, k, nn, pred, everyone, farthest: raters[raters.length - 1], tieAtK: raters.length > k && Math.abs(raters[k].mad - raters[k - 1].mad) < 1e-9 };
  }
  return res;
}

// ===== DOM helpers =====
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (x, d = 0) => (x * 100).toFixed(d) + '%';
const num = (x, d = 2) => (Math.round(x * 10 ** d) / 10 ** d).toFixed(d);
const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const today = () => new Date().toISOString().slice(0, 10);
// loadAllContent() stores the chapter id as _chapter on the block record
const chOf = m => m._chapter || m.chapter || '';

function gameSize(g) {
  switch (g.type) {
    case 'sort': return trn('{0} card', '{0} cards', (g.items || []).length);
    case 'pairs': return trn('{0} round', '{0} rounds', (g.pairs || []).length);
    case 'order': return trn('{0} step', '{0} steps', (g.steps || []).length);
    case 'match': return g.predict ? tr('2 rounds') : tr('1 round');
    case 'pop': return trn('{0} item', '{0} items', (g.items || []).length);
    case 'bandit': return trn('{0} impression', '{0} impressions', g.pulls || 40);
    case 'mixer': return trn('{0} goal', '{0} goals', (g.goals || []).length);
    case 'abstop': return trn('{0} experiment', '{0} experiments', (g.rounds || []).length);
    case 'loop': return g.mode === 'user' ? `${tr(`{0} simulated days`, (g.phase1Days || 8) + (g.phase2Days || 5))}` : `${tr(`{0} simulated days, twice`, g.days || 30)}`;
    default: return '';
  }
}

// ===== The mixin =====
const GamesMixin = {
  _gameCache: null,

  async _loadGame(file) {
    this._gameCache = this._gameCache || new Map();
    if (this._gameCache.has(file)) return this._gameCache.get(file);
    const res = await fetch(`games/${file}.json`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const g = await res.json();
    this._gameCache.set(file, g);
    return g;
  },

  _gameStore() { try { return JSON.parse(localStorage.getItem('pbook-games') || '{}'); } catch (e) { return {}; } },
  _gameStoreSave(s) { try { localStorage.setItem('pbook-games', JSON.stringify(s)); } catch (e) { /* storage full or blocked */ } },
  _gameRec(blockId) { return this._gameStore()[blockId] || null; },

  _gameConcept(meta) {
    const slug = String(meta?.concept || '').split('|')[0].trim();
    if (!slug) return null;
    const c = this.concepts?.[slug];
    return { slug, title: c?.title || slug.replace(/-/g, ' ') };
  },

  renderGame(block, opts = {}) {
    const id = block.id;
    const file = block.game || block.gameType || id;
    const dom = (opts.prefix || '') + id;
    const rec = this._gameRec(id);
    const best = rec && rec.best != null ? `Best ${esc(rec.bestLabel || pct(rec.best))}` : '';
    setTimeout(() => this._gameFillMeta(dom, file, 0), 0);
    return `<div class="game-block g-block fade-up" id="b-${esc(dom)}" data-block="${esc(id)}" data-game-file="${esc(file)}">
      <div class="game-header g-header">
        <span class="game-icon" aria-hidden="true">🎮</span>
        <h4 id="gh-${esc(dom)}">${esc(block.title || tr('Mini-game'))}</h4>
        <span class="g-best"${best ? '' : ' hidden'}>${best}</span>
      </div>
      <div class="g-meta"><span class="g-kind">${tr(`Hands-on`)}</span><span class="g-meta-detail"></span></div>
      ${block.teaser ? `<p class="g-teaser">${esc(block.teaser)}</p>` : ''}
      <div class="game-area g-area" role="group" aria-labelledby="gh-${esc(dom)}"></div>
      <div class="g-launch">
        <button class="game-start-btn g-btn g-btn-primary" onclick="app.startGame('${esc(id)}','${esc(file)}',this)">${tr(`▶ Play`)}</button>
        ${opts.inPlayground ? '' : ('<button class="g-btn g-btn-quiet" onclick="app.openPlayground()">' + tr(`All games`) + '</button>')}
      </div>
    </div>`;
  },

  // Fill "10 cards · untimed · ~2 min" once the block is in the DOM (renderGame returns a string)
  async _gameFillMeta(dom, file, tries) {
    const el = document.getElementById(`b-${dom}`);
    if (!el) { if (tries < 30) setTimeout(() => this._gameFillMeta(dom, file, tries + 1), 150); return; }
    try {
      const g = await this._loadGame(file);
      const timed = typeof g.timer === 'number' && g.timer > 0;
      const parts = [gameSize(g), timed ? `${tr(`{0} s timer`, g.timer)}` : tr('untimed'), `${tr(`~{0} min`, g.minutes || 2)}`].filter(Boolean);
      const slot = el.querySelector('.g-meta-detail');
      if (slot) slot.textContent = ' · ' + parts.join(' · ');
    } catch (e) { /* offline: the Play button reports it */ }
  },

  async startGame(blockId, file, btn) {
    const root = (btn && btn.closest && btn.closest('.g-block')) || document.getElementById(`b-${blockId}`);
    if (!root) return;
    const area = root.querySelector('.g-area');
    let game;
    try { game = await this._loadGame(file); } catch (e) {
      area.innerHTML = ('<p class="g-msg">' + tr(`Could not load this game. Check your connection and try again.`) + '</p>');
      return;
    }
    const launch = root.querySelector('.g-launch');
    if (launch) launch.hidden = true;
    this._gameStopTimer(root);
    const meta = this.findBlock(blockId)?.meta || {};
    const rec = this._gameRec(blockId);
    const S = { blockId, file, game, meta, root, area, t0: Date.now(), answers: [], replay: !!(rec && rec.plays), timedOut: false };
    root._gameSession = S;
    this.rc?.logEvent?.('game_start', { blockId, game: file, gtype: game.type, replay: S.replay });
    if (!root._gKeys) { root.addEventListener('keydown', e => this._gameKey(e, root)); root._gKeys = true; }
    if (typeof game.timer === 'number' && game.timer > 0) this._gameStartTimer(S, game.timer);
    const type = game.type === 'match' && game.pairs ? 'pairs' : game.type;
    const run = { sort: '_gameSort', pairs: '_gamePairs', order: '_gameOrder', match: '_gameMatch', pop: '_gamePop', bandit: '_gameBandit', mixer: '_gameMixer', abstop: '_gameAbstop', loop: '_gameLoop' }[type];
    if (!run) { area.innerHTML = `<p class="g-msg">${tr(`This game type ("{0}") is not supported by this version of the book.`, esc(game.type))}</p>`; return; }
    this[run](S);
  },

  _gameKey(e, root) {
    // the document-level ←/→ handler switches chapters; keep arrow keys inside the game
    if (e.key && e.key.startsWith('Arrow')) e.stopPropagation();
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const b = root.querySelectorAll('.g-opt:not([disabled])')[+e.key - 1];
      if (b) { e.preventDefault(); b.click(); }
    }
  },

  _gameStartTimer(S, secs) {
    let left = secs;
    let el = S.root.querySelector('.g-timer');
    if (!el) {
      el = document.createElement('span');
      el.className = 'g-timer';
      el.setAttribute('aria-label', tr('time left'));
      S.root.querySelector('.g-header')?.appendChild(el);
    }
    const show = () => { el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; };
    show();
    S.timer = setInterval(() => {
      if (!S.root.isConnected) { clearInterval(S.timer); S.timer = null; return; }
      left--; show();
      if (left <= 10) el.classList.add('g-timer-low');
      if (left <= 0) { clearInterval(S.timer); S.timer = null; S.timedOut = true; if (S.onTimeout) S.onTimeout(); }
    }, 1000);
  },

  _gameStopTimer(root) {
    const S = root && root._gameSession;
    if (S && S.timer) { clearInterval(S.timer); S.timer = null; }
  },

  _gameProgress(label, i, n, right) {
    return `<div class="g-progress"><span>${tr(`{0} {1} of {2}`, label, Math.min(i + 1, n), n)}</span><span>${right || ''}</span></div>
      <div class="g-bar" aria-hidden="true"><i style="width:${Math.round(100 * i / Math.max(1, n))}%"></i></div>`;
  },

  _gameFocus(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  },

  _gameReveal(el) {
    if (!el || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 70 || r.top < 60) el.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  },

  // ✓/✗ + the right answer + why, then a Next button that takes focus
  _gameFeedback(S, { ok, head, why, onNext, nextText }) {
    const slot = S.area.querySelector('.g-fb');
    if (!slot) return;
    slot.innerHTML = `<div class="g-feedback ${ok === true ? 'is-ok' : ok === false ? 'is-no' : ''}" role="status">
      <div class="g-fb-head">${head}</div>
      ${why ? `<div class="g-fb-why">${esc(why)}</div>` : ''}
      ${onNext ? `<button class="g-btn g-btn-primary g-next">${nextText || tr('Next ›')}</button>` : ''}
    </div>`;
    const nb = slot.querySelector('.g-next');
    if (nb) { nb.onclick = onNext; this._gameFocus(nb); }
    this._gameReveal(slot);
  },

  _gameAnswer(S, idx, correct, extra) {
    S.answers.push({ idx, correct });
    this.rc?.logEvent?.('game_answer', { blockId: S.blockId, game: S.file, idx, correct: !!correct, ms: Date.now() - S.t0, ...(extra || {}) });
  },

  // res: { score, total, misses: [{q, a, why}], html, scoreLabel, note }
  _gameFinish(S, res) {
    this._gameStopTimer(S.root);
    S.onTimeout = null;
    const total = res.total || 0;
    const frac = total ? Math.max(0, Math.min(1, res.score / total)) : 0;
    const label = res.scoreLabel || `${res.score}/${total}`;
    const store = this._gameStore();
    const rec = store[S.blockId] || { plays: 0 };
    const isBest = rec.best == null || frac > rec.best + 1e-9;
    const hadBest = rec.best != null;
    rec.plays = (rec.plays || 0) + 1;
    rec.lastAt = Date.now();
    if (isBest) { rec.best = frac; rec.bestLabel = label; }
    // XP: once per game per day, proportional to the score (+2 for a perfect run)
    let xp = 0;
    if (this._f('gamification') && rec.xpDay !== today() && !(S.timedOut && !S.answers.length)) {
      xp = Math.round(5 * frac) + (frac >= 1 ? 2 : 0);
      if (xp > 0) {
        rec.xpDay = today();
        this.user.addXP(xp); this.user.save();
        this.showXPToast(`${tr(`+{0} XP 🎮`, xp)}`, 'xp');
      }
    }
    store[S.blockId] = rec;
    this._gameStoreSave(store);
    this.rc?.logEvent?.('game_end', { blockId: S.blockId, game: S.file, score: res.score, total, frac: Math.round(frac * 100) / 100, durationMs: Date.now() - S.t0, timedOut: !!S.timedOut, replay: S.replay });
    try { this._updateMissionBar?.(); } catch (e) { /* mission bar is optional */ }

    const bestEl = S.root.querySelector('.g-best');
    if (bestEl) { bestEl.hidden = false; bestEl.textContent = `Best ${rec.bestLabel}`; }
    const note = res.note || (frac >= 1 ? tr('Perfect run.') : isBest && hadBest ? tr('New personal best.') : !isBest ? `${tr(`Your best: {0}`, esc(rec.bestLabel))}` : '');
    const concept = this._gameConcept(S.meta);
    const misses = res.misses || [];
    const inPg = !!S.root.closest('.g-pg');
    S.area.innerHTML = `<div class="g-end">
      <div class="g-end-top" role="status">
        <div class="g-end-score">${esc(label)}</div>
        ${note ? `<div class="g-end-note">${note}</div>` : ''}
        ${xp ? `<div class="g-end-xp">${tr(`+{0} XP`, xp)}</div>` : ''}
      </div>
      ${res.html || ''}
      ${misses.length ? `<details class="g-misses"${misses.length <= 3 ? ' open' : ''}><summary>${tr(`Review {0}`, misses.length === 1 ? tr('your miss') : `${tr(`your {0} misses`, misses.length)}`)}</summary>
        <ul>${misses.map(m => `<li><b>${esc(m.q)}</b><br><span class="g-miss-a">→ ${esc(m.a)}</span>${m.why ? `<span class="g-miss-why"> ${esc(m.why)}</span>` : ''}</li>`).join('')}</ul></details>` : ''}
      ${S.game.debrief ? `<div class="g-debrief">${tr(`<b>Takeaway.</b> {0}`, esc(S.game.debrief))}</div>` : ''}
      <div class="g-end-actions">
        <button class="g-btn g-btn-primary g-again">${tr(`↻ Play again`)}</button>
        ${concept ? `<a class="g-btn" href="#c/${esc(concept.slug)}">${tr(`Read: {0} →`, esc(concept.title))}</a>` : ''}
        <button class="g-btn g-btn-quiet g-more">${inPg ? tr('← All games') : tr('More games')}</button>
      </div>
    </div>`;
    S.area.querySelector('.g-again').onclick = e => this.startGame(S.blockId, S.file, e.currentTarget);
    S.area.querySelector('.g-more').onclick = () => (inPg ? this._renderPlayground() : this.openPlayground());
    this._gameFocus(S.area.querySelector('.g-again'));
    this._gameReveal(S.area.querySelector('.g-end-top'));
  },

  // ---------- sort: one card at a time, pick its bucket ----------
  _gameSort(S) {
    const g = S.game;
    const items = shuffled(g.items.map((it, k) => ({ ...it, k })));
    let i = 0, score = 0;
    const misses = [];
    S.onTimeout = () => this._gameFinish(S, { score, total: items.length, misses, note: tr('Time is up.') });
    const show = () => {
      if (i >= items.length) return this._gameFinish(S, { score, total: items.length, misses });
      const it = items[i];
      S.area.innerHTML = `${this._gameProgress(tr('Card'), i, items.length, `${tr(`{0} correct`, score)}`)}
        ${g.instruction ? `<p class="g-instruction">${esc(g.instruction)}</p>` : ''}
        <div class="g-card">${esc(it.text)}</div>
        <div class="g-options${g.buckets.length > 2 ? ' g-options-many' : ''}">${g.buckets.map((b, bi) =>
          `<button class="g-opt" data-i="${bi}"><span class="g-key" aria-hidden="true">${bi + 1}</span><span class="g-opt-text">${esc(b)}</span></button>`).join('')}</div>
        <div class="g-fb"></div>`;
      const opts = [...S.area.querySelectorAll('.g-opt')];
      opts.forEach(btn => {
        btn.onclick = () => {
          opts.forEach(b => { b.disabled = true; });
          const pick = +btn.dataset.i, ok = pick === it.answer;
          if (ok) score++; else misses.push({ q: it.text, a: g.buckets[it.answer], why: it.why });
          btn.classList.add(ok ? 'is-right' : 'is-wrong');
          btn.insertAdjacentHTML('beforeend', `<span class="g-mark">${ok ? '✓' : '✗'}</span>`);
          if (!ok) { const r = opts[it.answer]; r.classList.add('is-answer'); r.insertAdjacentHTML('beforeend', '<span class="g-mark">✓</span>'); }
          this._gameAnswer(S, it.k, ok);
          this._gameFeedback(S, {
            ok, why: it.why,
            head: ok ? tr('✓ Correct.') : `${tr(`✗ Not quite. It's <b>{0}</b>.`, esc(g.buckets[it.answer]))}`,
            nextText: i === items.length - 1 ? tr('See your score ›') : tr('Next ›'),
            onNext: () => { i++; show(); },
          });
        };
      });
      this._gameFocus(opts[0]);
    };
    show();
  },

  // ---------- pairs: a description, pick the matching term from 4 ----------
  _gamePairs(S) {
    const g = S.game;
    const pairs = shuffled(g.pairs.map((p, k) => ({ ...p, k })));
    const allA = [...new Set(g.pairs.map(p => p.a))];
    let i = 0, score = 0;
    const misses = [];
    S.onTimeout = () => this._gameFinish(S, { score, total: pairs.length, misses, note: tr('Time is up.') });
    const show = () => {
      if (i >= pairs.length) return this._gameFinish(S, { score, total: pairs.length, misses });
      const cur = pairs[i];
      const pool = (cur.options && cur.options.length ? cur.options : allA).filter(a => a !== cur.a);
      const opts = shuffled([cur.a, ...shuffled([...new Set(pool)]).slice(0, (g.choices || 4) - 1)]);
      S.area.innerHTML = `${this._gameProgress(tr('Round'), i, pairs.length, `${tr(`{0} correct`, score)}`)}
        <p class="g-instruction">${esc(g.instruction || tr('Which term is it?'))}</p>
        <div class="g-card">${esc(cur.b)}</div>
        <div class="g-options g-options-many">${opts.map((o, oi) =>
          `<button class="g-opt" data-v="${esc(o)}"><span class="g-key" aria-hidden="true">${oi + 1}</span><span class="g-opt-text">${esc(o)}</span></button>`).join('')}</div>
        <div class="g-fb"></div>`;
      const btns = [...S.area.querySelectorAll('.g-opt')];
      btns.forEach(btn => {
        btn.onclick = () => {
          btns.forEach(b => { b.disabled = true; });
          const ok = btn.dataset.v === cur.a;
          if (ok) score++; else misses.push({ q: cur.b, a: cur.a, why: cur.why });
          btn.classList.add(ok ? 'is-right' : 'is-wrong');
          btn.insertAdjacentHTML('beforeend', `<span class="g-mark">${ok ? '✓' : '✗'}</span>`);
          if (!ok) btns.forEach(b => { if (b.dataset.v === cur.a) { b.classList.add('is-answer'); b.insertAdjacentHTML('beforeend', '<span class="g-mark">✓</span>'); } });
          this._gameAnswer(S, cur.k, ok);
          this._gameFeedback(S, {
            ok, why: cur.why,
            head: ok ? tr('✓ Correct.') : `${tr(`✗ Not quite. It's <b>{0}</b>.`, esc(cur.a))}`,
            nextText: i === pairs.length - 1 ? tr('See your score ›') : tr('Next ›'),
            onNext: () => { i++; show(); },
          });
        };
      });
      this._gameFocus(btns[0]);
    };
    show();
  },

  // ---------- order: tap the steps in sequence; a wrong tap is explained, two reveal the step ----------
  _gameOrder(S) {
    const g = S.game;
    const steps = g.steps.map((text, k) => ({ text, k, why: (g.why || [])[k] }));
    const pool = shuffled(steps);
    const placed = [];
    let pos = 0, tries = 0, firstTry = 0;
    const misses = [];
    const decisions = Math.max(1, steps.length - 1); // the last step is forced
    const render = (fb) => {
      const remaining = pool.filter(s => !placed.includes(s));
      S.area.innerHTML = `${this._gameProgress(tr('Step'), pos, steps.length, `${tr(`{0} first try`, firstTry)}`)}
        <p class="g-instruction">${esc(g.instruction || tr('Put the steps in order.'))}</p>
        <ol class="g-seq">${placed.map(s => `<li class="${s._shown ? 'is-shown' : 'is-done'}"><span class="g-mark">${s._shown ? '→' : '✓'}</span> <span>${esc(s.text)}</span>${s.why ? `<div class="g-seq-why">${esc(s.why)}</div>` : ''}</li>`).join('')}
          ${remaining.length ? `<li class="g-seq-next" aria-hidden="true">${tr(`Step {0}?`, pos + 1)}</li>` : ''}</ol>
        <div class="g-options g-options-col">${remaining.map(s =>
          `<button class="g-opt" data-k="${s.k}"><span class="g-opt-text">${esc(s.text)}</span></button>`).join('')}</div>
        <div class="g-fb"></div>`;
      if (fb) this._gameFeedback(S, fb);
      const btns = [...S.area.querySelectorAll('.g-opt')];
      btns.forEach(btn => {
        btn.onclick = () => {
          const step = steps[+btn.dataset.k];
          if (step.k === pos) {
            if (tries === 0) firstTry++;
            this._gameAnswer(S, step.k, tries === 0);
            placed.push(step); pos++; tries = 0;
            const left = pool.filter(s => !placed.includes(s));
            if (left.length === 1) { placed.push(left[0]); pos++; }
            if (pos >= steps.length) return this._gameFinish(S, { score: firstTry, total: decisions, misses, scoreLabel: `${tr(`{0}/{1} first try`, firstTry, decisions)}` });
            render({ ok: true, head: `${tr(`✓ Step {0} placed.`, pos)}`, why: '' });
            this._gameFocus(S.area.querySelector('.g-opt'));
          } else {
            tries++;
            btn.disabled = true;
            btn.classList.add('is-wrong');
            btn.insertAdjacentHTML('beforeend', ('<span class="g-mark">' + tr(`✗ later`) + '</span>'));
            if (tries >= 2) {
              const right = steps[pos];
              right._shown = true;
              misses.push({ q: tr('Step {0}', pos + 1), a: right.text, why: right.why });
              this._gameAnswer(S, right.k, false);
              placed.push(right); pos++; tries = 0;
              const left = pool.filter(s => !placed.includes(s));
              if (left.length === 1) { placed.push(left[0]); pos++; }
              if (pos >= steps.length) return this._gameFinish(S, { score: firstTry, total: decisions, misses, scoreLabel: `${tr(`{0}/{1} first try`, firstTry, decisions)}` });
              render({ ok: false, head: `${tr(`✗ Step {0} was <b>{1}</b>.`, pos, esc(right.text))}`, why: right.why });
              this._gameFocus(S.area.querySelector('.g-opt'));
            } else {
              this._gameFeedback(S, { ok: false, head: `${tr(`✗ Not step {0}: that one comes later. One more try.`, pos + 1)}`, why: '' });
              this._gameFocus(S.area.querySelector('.g-opt:not([disabled])'));
            }
          }
        };
      });
    };
    render();
    this._gameFocus(S.area.querySelector('.g-opt'));
  },

  // ---------- match: find the taste twin in a fixed rating matrix, then predict a blank ----------
  _gameMatch(S) {
    const g = S.game;
    let game = g;
    if (!g.matrix) { // legacy data without a matrix: random ratings, re-rolled until one clear twin exists
      for (let tries = 0; tries < 200; tries++) {
        const m = { You: g.items.map(() => 1 + Math.floor(Math.random() * 5)) };
        (g.users || ['Alex', 'Sam', 'Jordan', 'Taylor']).forEach(u => { m[u] = g.items.map(() => 1 + Math.floor(Math.random() * 5)); });
        game = { ...g, matrix: m, you: tr('You') };
        if (matchStats(game).margin >= 0.6) break;
      }
    }
    const st = matchStats(game);
    const items = game.items;
    const users = [st.youName, ...shuffled(st.others.map(o => o.name))];
    let score = 0;
    const misses = [];
    const total = st.predict ? 2 : 1;
    const table = (hlRow, qCol) => `<div class="g-table-wrap"><table class="g-matrix">
      <thead><tr><th scope="col"><span class="g-sr">${tr(`Person`)}</span></th>${items.map((m, j) => `<th scope="col"${j === qCol ? ' class="is-q"' : ''}>${esc(m)}</th>`).join('')}</tr></thead>
      <tbody>${users.map(name => {
        const r = game.matrix[name];
        const isYou = name === st.youName;
        const head = isYou ? `<th scope="row" class="g-you">${esc(name)}</th>`
          : `<th scope="row"><button class="g-opt g-pick${name === hlRow ? ' is-answer' : ''}" data-n="${esc(name)}">${esc(name)}</button></th>`;
        return `<tr class="${isYou ? 'g-you-row' : ''}">${head}${r.map((v, j) => `<td class="${j === qCol && isYou ? 'is-q' : ''}">${v == null ? (isYou && j === qCol ? '?' : '–') : `<span class="g-rate g-r${v}">${v}</span>`}</td>`).join('')}</tr>`;
      }).join('')}</tbody></table></div>`;
    const madList = () => `<ul class="g-bars">${st.others.map(o => `<li${o === st.twin ? ' class="is-best"' : ''}><span class="g-bars-l">${esc(o.name)}</span><span class="g-bars-t"><i style="width:${Math.min(100, (o.mad / 4) * 100)}%"></i></span><span class="g-bars-v">${num(o.mad)}</span></li>`).join('')}</ul>
      <p class="g-small">${tr(`Average gap in stars on the films you both rated. Smaller = more alike.`)}</p>`;
    const step1 = () => {
      S.area.innerHTML = `${this._gameProgress(tr('Round'), 0, total, '')}
        <p class="g-instruction">${esc(game.instruction || tr('Who rates most like you? Tap their name.'))}</p>
        ${table(null, st.predict ? st.predict.j : -1)}
        <p class="g-small">${tr(`Ratings from 1 (didn't like it) to 5 (loved it). – = not seen.`)}</p>
        <div class="g-fb"></div>`;
      const btns = [...S.area.querySelectorAll('.g-pick')];
      btns.forEach(btn => {
        btn.onclick = () => {
          btns.forEach(b => { b.disabled = true; });
          const ok = btn.dataset.n === st.twin.name;
          if (ok) score++; else misses.push({ q: tr('Who rates most like you?'), a: st.twin.name, why: `${tr(`{0}'s ratings differ from yours by {1} stars on average; {2}'s by {3}.`, st.twin.name, num(st.twin.mad), btn.dataset.n, num(st.others.find(o => o.name === btn.dataset.n).mad))}` });
          btn.classList.add(ok ? 'is-right' : 'is-wrong');
          btn.insertAdjacentHTML('beforeend', `<span class="g-mark">${ok ? '✓' : '✗'}</span>`);
          if (!ok) btns.forEach(b => { if (b.dataset.n === st.twin.name) { b.classList.add('is-answer'); b.insertAdjacentHTML('beforeend', '<span class="g-mark">✓</span>'); } });
          this._gameAnswer(S, 0, ok);
          this._gameFeedback(S, {
            ok, why: '',
            head: (ok ? `${tr(`✓ Yes, <b>{0}</b> is your taste twin.`, esc(st.twin.name))}` : `${tr(`✗ Your taste twin is <b>{0}</b>.`, esc(st.twin.name))}`) + madList(),
            nextText: st.predict ? tr('Now predict ›') : tr('See your score ›'),
            onNext: () => (st.predict ? step2() : this._gameFinish(S, { score, total, misses })),
          });
        };
      });
      this._gameFocus(btns[0]);
    };
    const step2 = () => {
      const P = st.predict;
      const title = items[P.j];
      const fmt = v => (Math.round(v * 2) / 2).toFixed(1);
      const nnNames = P.nn.map(o => o.name).join(tr(' and '));
      const raw = [
        { v: P.pred, why: '' },
        { v: P.everyone, why: tr('everyone\'s average: that is popularity, not personalization') },
        { v: P.nn[0].r[P.j], why: `${tr(`{0} alone: one neighbour is a noisy guide`, P.nn[0].name)}` },
        { v: P.farthest.r[P.j], why: `${tr(`{0}'s rating: the person least like you`, P.farthest.name)}` },
      ];
      const seen = new Set();
      const opts = shuffled(raw.filter(o => { const k = fmt(o.v); if (seen.has(k)) return false; seen.add(k); return true; }));
      S.area.innerHTML = `${this._gameProgress(tr('Round'), 1, total, `${tr(`{0} correct`, score)}`)}
        <p class="g-instruction">${tr(`You haven't seen <b>{0}</b>. Predict your rating from your {1} nearest neighbours.`, esc(title), P.k)}</p>
        ${table(null, P.j)}
        <div class="g-options">${opts.map((o, oi) => `<button class="g-opt" data-v="${fmt(o.v)}"><span class="g-key" aria-hidden="true">${oi + 1}</span><span class="g-opt-text">${tr(`{0} stars`, fmt(o.v))}</span></button>`).join('')}</div>
        <div class="g-fb"></div>`;
      const btns = [...S.area.querySelectorAll('.g-opt')];
      btns.forEach(btn => {
        btn.onclick = () => {
          btns.forEach(b => { b.disabled = true; });
          const ok = btn.dataset.v === fmt(P.pred);
          const how = `${tr(`Your {0} nearest neighbours, {1}, rated it {2}: ({3}) / {4} = {5}.`, P.k, nnNames, P.nn.map(o => o.r[P.j]).join(tr(' and ')), P.nn.map(o => o.r[P.j]).join(' + '), P.nn.length, fmt(P.pred))}`;
          const wrongWhy = raw.find(o => fmt(o.v) === btn.dataset.v && o.why)?.why;
          if (ok) score++; else misses.push({ q: `${tr(`Predict your rating for {0}`, title)}`, a: `${fmt(P.pred)} stars`, why: how });
          btn.classList.add(ok ? 'is-right' : 'is-wrong');
          btn.insertAdjacentHTML('beforeend', `<span class="g-mark">${ok ? '✓' : '✗'}</span>`);
          if (!ok) btns.forEach(b => { if (b.dataset.v === fmt(P.pred)) { b.classList.add('is-answer'); b.insertAdjacentHTML('beforeend', '<span class="g-mark">✓</span>'); } });
          this._gameAnswer(S, 1, ok);
          this._gameFeedback(S, {
            ok,
            head: ok ? `${tr(`✓ Correct: about {0} stars.`, fmt(P.pred))}` : `${tr(`✗ Not quite: about <b>{0} stars</b>{1}.`, fmt(P.pred), wrongWhy ? ` ${tr(`({0} is {1})`, esc(btn.dataset.v), esc(wrongWhy))}` : '')}`,
            why: how + (P.pred >= 4 ? tr(' That clears a 4-star bar, so it gets recommended.') : tr(' Below a 4-star bar, so it would not be recommended.')),
            nextText: tr('See your score ›'),
            onNext: () => this._gameFinish(S, { score, total, misses }),
          });
        };
      });
      this._gameFocus(btns[0]);
    };
    step1();
  },

  // ---------- pop (spot): mark every item that matches the instruction, then check ----------
  _gamePop(S) {
    const g = S.game;
    if (!Array.isArray(g.items)) { S.area.innerHTML = ('<p class="g-msg">' + tr(`This game has been retired.`) + '</p>'); return; }
    const items = shuffled(g.items.map((it, k) => ({ ...it, k })));
    const marked = new Set();
    const hitLabel = g.hitLabel || tr('Yes'), missLabel = g.missLabel || tr('No');
    S.area.innerHTML = `<p class="g-instruction">${esc(g.instruction || tr('Tap every item that applies, then check.'))}</p>
      <div class="g-spot">${items.map(it => `<button class="g-spot-item" aria-pressed="false" data-k="${it.k}"><span class="g-spot-box" aria-hidden="true"></span><span>${esc(it.text)}</span></button>`).join('')}</div>
      <div class="g-spot-actions"><span class="g-small g-spot-count" role="status">${tr(`0 marked`)}</span><button class="g-btn g-btn-primary g-check">${esc(g.doneLabel || tr('Check my answers'))}</button></div>
      <div class="g-fb"></div>`;
    const count = S.area.querySelector('.g-spot-count');
    S.area.querySelectorAll('.g-spot-item').forEach(btn => {
      btn.onclick = () => {
        const k = +btn.dataset.k;
        if (marked.has(k)) marked.delete(k); else marked.add(k);
        btn.setAttribute('aria-pressed', marked.has(k) ? 'true' : 'false');
        count.textContent = tr('{0} marked', marked.size);
      };
    });
    S.area.querySelector('.g-check').onclick = () => {
      let score = 0;
      const rows = items.map(it => {
        const ok = marked.has(it.k) === !!it.hit;
        if (ok) score++;
        this._gameAnswer(S, it.k, ok);
        return `<li class="${ok ? 'is-ok' : 'is-no'}"><span class="g-mark">${ok ? '✓' : '✗'}</span> <b>${esc(it.text)}</b> <span class="g-tag">${esc(it.hit ? hitLabel : missLabel)}</span>${ok ? '' : `<span class="g-small"> ${marked.has(it.k) ? tr('(you marked it)') : tr('(you left it)')}</span>`}${it.why ? `<div class="g-small">${esc(it.why)}</div>` : ''}</li>`;
      });
      this._gameFinish(S, { score, total: items.length, html: `<ul class="g-review">${rows.join('')}</ul>` });
    };
    this._gameFocus(S.area.querySelector('.g-spot-item'));
  },

  // ---------- bandit: spend impressions yourself, then race the textbook policies ----------
  _gameBandit(S) {
    const g = S.game;
    const pulls = g.pulls || 40;
    const seed = (Math.random() * 2147483647) | 0;
    const rand = makeRng(seed);
    let arms = g.arms.map((a, i) => ({ ...a, _i: i }));
    if (g.shuffleArms) { const ps = shuffled(arms.map(a => a.p), rand); arms = arms.map((a, i) => ({ ...a, p: ps[i] })); }
    const outcomes = banditOutcomes(arms, pulls, rand);
    const n = arms.map(() => 0), s = arms.map(() => 0);
    let t = 0, clicks = 0;
    const armWord = g.armWord || 'option';
    S.area.innerHTML = `<p class="g-instruction">${esc(g.instruction)}</p>
      <div class="g-progress"><span class="g-bandit-left"></span><span class="g-bandit-clicks"></span></div>
      <div class="g-arms"></div>
      <div class="g-live g-small" role="status" aria-live="polite"></div>
      <p class="g-small">${tr(`The band shows the click rates that are still plausible after what you've seen; it narrows as a {0} gets shown more. The dot is the rate so far.`, esc(armWord))}</p>
      ${g.toyNote ? `<p class="g-note">${esc(g.toyNote)}</p>` : ''}
      <div class="g-fb"></div>`;
    const armsEl = S.area.querySelector('.g-arms');
    const draw = () => {
      S.area.querySelector('.g-bandit-left').textContent = `${tr(`Impressions left: {0}`, pulls - t)}`;
      S.area.querySelector('.g-bandit-clicks').textContent = `${tr(`Clicks: {0}`, clicks)}`;
      armsEl.innerHTML = arms.map((a, i) => {
        const ci = betaInterval(s[i], n[i]);
        const rate = n[i] ? s[i] / n[i] : null;
        return `<button class="g-opt g-arm" data-a="${i}" aria-label="${tr(`{0}{1}. Shown {2} times, {3} clicks.`, esc(a.label), a.text ? ': ' + esc(a.text) : '', n[i], s[i])}">
          <span class="g-arm-head"><span class="g-key" aria-hidden="true">${i + 1}</span><b>${esc(a.label)}</b>${a.text ? `<span class="g-arm-text">${esc(a.text)}</span>` : ''}</span>
          <span class="g-arm-stats">${n[i] ? `${tr(`{0} of {1} clicked · {2}`, s[i], n[i], pct(rate))}` : tr('not shown yet')}</span>
          <span class="g-meter" aria-hidden="true"><i class="g-meter-ci" style="left:${(ci.lo * 100).toFixed(1)}%;width:${((ci.hi - ci.lo) * 100).toFixed(1)}%"></i>${rate != null ? `<i class="g-meter-dot" style="left:${(rate * 100).toFixed(1)}%"></i>` : ''}</span>
        </button>`;
      }).join('');
      armsEl.querySelectorAll('.g-arm').forEach(btn => { btn.onclick = () => pull(+btn.dataset.a); });
    };
    const pull = (a) => {
      if (t >= pulls) return;
      const hit = outcomes[a][n[a]];
      n[a]++; t++;
      if (hit) { s[a]++; clicks++; }
      this._gameAnswer(S, a, hit);
      const live = S.area.querySelector('.g-live');
      live.textContent = `${arms[a].label}: ${hit ? tr('click ✓') : tr('no click')}`;
      draw();
      this._gameFocus(armsEl.querySelector(`[data-a="${a}"]`));
      if (t >= pulls) finish();
    };
    const finish = () => {
      const best = arms.reduce((bi, a, i) => (a.p > arms[bi].p ? i : bi), 0);
      const oracle = outcomes[best].filter(Boolean).length;
      const policies = (g.compare || ['thompson', 'greedy', 'uniform']).filter(p => BANDIT_POLICIES[p]);
      const runs = policies.map((p, k) => ({ p, ...banditRun(p, outcomes, pulls, makeRng(seed + 17 * (k + 1))) }));
      const avg = banditReplays(arms, pulls, policies, g.replays || 200, seed + 99991);
      const rows = [{ l: tr('You'), v: clicks, you: true }, ...runs.map(r => ({ l: BANDIT_POLICIES[r.p], v: r.clicks })), { l: `${tr(`Always the best {0} (hindsight)`, armWord)}`, v: oracle, ref: true }];
      const max = Math.max(1, ...rows.map(r => r.v));
      const ts = runs.find(r => r.p === 'thompson');
      const rateLine = arms.map(a => `${esc(a.label)} ${pct(a.p)}`).join(' · ');
      const html = `<div class="g-panel">
        <h5>${tr(`Same luck, different decisions`)}</h5>
        <ul class="g-bars g-bars-wide">${rows.map(r => `<li class="${r.you ? 'is-you' : r.ref ? 'is-ref' : ''}"><span class="g-bars-l">${esc(r.l)}</span><span class="g-bars-t"><i style="width:${(100 * r.v / max).toFixed(1)}%"></i></span><span class="g-bars-v">${r.v}</span></li>`).join('')}</ul>
        <p class="g-small">${tr(`Every strategy faced the same luck: the n-th showing of a {0} got the same click or no-click for everyone.`, esc(armWord))}</p>
        <p>${tr(`True click rates: <b>{0}</b>.`, rateLine)}</p>
        <p>${tr(`You showed the best {0} ({1}) <b>{2}</b> of {3} times{4}.`, esc(armWord), esc(arms[best].label), n[best], pulls, ts ? `${tr(`; Thompson sampling showed it <b>{0}</b> times`, ts.n[best])}` : '')}</p>
        <p>${tr(`Over {0} replays with fresh luck, average clicks: {1}; always the best {2} would average <b>{3}</b>.`, g.replays || 200, policies.map(p => `${esc(BANDIT_POLICIES[p].split(' (')[0])} <b>${avg[p].toFixed(1)}</b>`).join(' · '), esc(armWord), (pulls * arms[best].p).toFixed(1))}</p>
      </div>`;
      this._gameFinish(S, { score: Math.min(clicks, oracle), total: Math.max(1, oracle), scoreLabel: `${clicks} clicks`, note: `${tr(`Best possible with this luck: {0}`, oracle)}`, html });
    };
    draw();
    this._gameFocus(armsEl.querySelector('.g-arm'));
  },

  // ---------- mixer: ranking weights + rules, live feed and KPIs, goal by goal ----------
  _gameMixer(S) {
    const g = S.game;
    const W = Object.fromEntries(g.weights.map(w => [w.key, w.default ?? 0]));
    const T = Object.fromEntries((g.toggles || []).map(t => [t.key, !!t.default]));
    const goals = g.goals || [];
    let level = 0, met = 0, statusKey = '';
    const checkable = goals.filter(x => x.check && Object.keys(x.check).length).length;
    const kpiDefs = g.kpis || [];
    const kpiLabel = key => {
      const base = key.replace(/_rel$/, '');
      const d = kpiDefs.find(k => (k.as || k.key) === base);
      return (d ? d.label : base) + (key.endsWith('_rel') ? tr(' vs. the best possible') : '');
    };
    const fmtK = (key, v) => {
      if (key.endsWith('_rel')) return pct(v);
      const d = kpiDefs.find(k => (k.as || k.key) === key);
      return d && (d.agg === 'distinct' || d.agg === 'count') ? String(v) : num(v);
    };
    const fmtCond = (key, c) => {
      const m = String(c).match(/^\s*(>=|<=|==|>|<)\s*(-?[\d.]+)/);
      if (!m) return c;
      const sym = { '>=': '≥', '<=': '≤', '==': '=', '>': '>', '<': '<' }[m[1]];
      return `${sym} ${key.endsWith('_rel') ? pct(parseFloat(m[2])) : m[2]}`;
    };
    S.area.innerHTML = `<p class="g-instruction">${esc(g.instruction)}</p>
      <div class="g-goal"></div>
      <div class="g-mix">
        <div class="g-mix-ctl">
          ${g.weights.map(w => `<label class="g-slider"><span class="g-slider-l">${esc(w.label)}</span>
            <input type="range" min="0" max="100" step="5" value="${W[w.key]}" data-k="${esc(w.key)}">
            <output>${W[w.key]}</output></label>`).join('')}
          ${(g.toggles || []).map(t => `<label class="g-toggle"><input type="checkbox" data-t="${esc(t.key)}"${T[t.key] ? ' checked' : ''}><span>${esc(t.label)}</span></label>`).join('')}
        </div>
        <div class="g-mix-out">
          <div class="g-kpis" aria-live="off"></div>
          <ol class="g-feed"></ol>
        </div>
      </div>
      <div class="g-fb"></div>
      ${g.toyNote ? `<p class="g-note">${esc(g.toyNote)}</p>` : ''}`;
    const feedEl = S.area.querySelector('.g-feed');
    const kpiEl = S.area.querySelector('.g-kpis');
    const goalEl = S.area.querySelector('.g-goal');
    const fbEl = S.area.querySelector('.g-fb');
    const chips = it => (g.chips || []).map(c => {
      const v = it[c.field];
      if (c.flag) return v ? `<span class="g-chip g-chip-${esc(c.tone || 'user')}">${esc(c.flag)}</span>` : '';
      return v != null && v !== '' ? `<span class="g-chip">${esc(v)}</span>` : '';
    }).join('');
    const draw = () => {
      const feed = mixerRank(g, W, T);
      const k = mixerKpis(g, feed);
      // KPIs
      kpiEl.innerHTML = kpiDefs.map(d => {
        const key = d.as || d.key;
        return `<div class="g-kpi"><span class="g-kpi-v">${fmtK(key, k[key])}${d.agg === 'sum' ? `<small> (${pct(k[key + '_rel'])})</small>` : ''}</span><span class="g-kpi-l">${esc(d.label)}</span></div>`;
      }).join('');
      // feed with a FLIP reorder
      const prev = new Map([...feedEl.children].map(li => [li.dataset.id, li.getBoundingClientRect().top]));
      feedEl.innerHTML = feed.map((it, r) => `<li data-id="${it._i}"><span class="g-rank">${r + 1}</span><span class="g-feed-main"><span class="g-feed-title">${esc(it.title)}</span><span class="g-feed-chips">${chips(it)}</span></span><span class="g-feed-nums">${(g.show || []).map(f => `<span title="${esc(f.label)}">${esc(f.short || f.label)} ${num(Number(it[f.key]) || 0)}</span>`).join('')}</span></li>`).join('');
      if (!reducedMotion()) {
        [...feedEl.children].forEach(li => {
          const p = prev.get(li.dataset.id);
          if (p == null) { li.classList.add('g-enter'); return; }
          const dy = p - li.getBoundingClientRect().top;
          if (!dy) return;
          li.style.transition = 'none'; li.style.transform = `translateY(${dy}px)`;
          requestAnimationFrame(() => { li.style.transition = 'transform .3s ease'; li.style.transform = ''; });
        });
      }
      // goal panel (re-rendered only when its status changes, so focus is not lost)
      const goal = goals[level];
      if (!goal) return;
      const conds = Object.entries(goal.check || {});
      const okAll = mixerCheck(goal.check, k);
      const key = level + '|' + conds.map(([c, v]) => checkCond(k[c], v)).join(',') + '|' + conds.map(([c]) => fmtK(c, k[c])).join(',');
      if (key === statusKey) return;
      statusKey = key;
      goalEl.innerHTML = `<div class="g-goal-head">${tr(`Goal {0} of {1}`, level + 1, goals.length)}</div>
        <div class="g-goal-text">${esc(goal.text)}</div>
        ${conds.length ? `<ul class="g-checks">${conds.map(([c, v]) => { const ok = checkCond(k[c], v); return `<li class="${ok ? 'is-ok' : ''}"><span class="g-mark">${ok ? '✓' : '○'}</span> ${esc(kpiLabel(c))} ${esc(fmtCond(c, v))} <span class="g-small">${tr(`(now {0})`, fmtK(c, k[c]))}</span></li>`; }).join('')}</ul>` : ''}
        <div class="g-goal-actions">${!conds.length
          ? ('<button class="g-btn g-btn-primary g-goal-next">' + tr(`I see it ›`) + '</button>')
          : okAll ? ('<button class="g-btn g-btn-primary g-goal-next">' + tr(`✓ Goal met — next ›`) + '</button>')
            : ('<button class="g-btn g-btn-quiet g-goal-skip">' + tr(`Skip this goal`) + '</button>')}</div>`;
      const nx = goalEl.querySelector('.g-goal-next');
      if (nx) nx.onclick = () => advance(conds.length ? true : null);
      const sk = goalEl.querySelector('.g-goal-skip');
      if (sk) sk.onclick = () => advance(false);
    };
    const advance = (ok) => {
      const goal = goals[level];
      if (ok === true) met++;
      this._gameAnswer(S, level, ok !== false);
      let hint = '';
      if (ok === false) {
        const { sols } = mixerSolutions(g, goal);
        if (sols.length) {
          const sol = sols[Math.floor(sols.length / 2)];
          hint = tr(' One setting that works: ') + g.weights.map(w => `${w.label} ${sol.w[w.key]}`).join(', ') + ((g.toggles || []).filter(t => sol.t[t.key]).map(t => '; ' + t.label).join('')) + '.';
        }
      }
      level++;
      statusKey = '';
      const last = level >= goals.length;
      this._gameFeedback(S, {
        ok: ok === null ? null : ok,
        head: ok === true ? tr('✓ Goal met.') : ok === false ? tr('✗ Skipped.') : tr('What you just saw:'),
        why: (goal.why || '') + hint,
        nextText: last ? tr('See your score ›') : tr('Next goal ›'),
        onNext: () => {
          fbEl.innerHTML = '';
          if (last) return this._gameFinish(S, { score: met, total: Math.max(1, checkable), scoreLabel: `${tr(`{0}/{1} goals`, met, checkable)}` });
          draw();
          this._gameFocus(S.area.querySelector('.g-mix-ctl input'));
        },
      });
      goalEl.innerHTML = '';
    };
    S.area.querySelectorAll('.g-slider input').forEach(inp => {
      inp.oninput = () => { W[inp.dataset.k] = +inp.value; inp.nextElementSibling.textContent = inp.value; draw(); };
    });
    S.area.querySelectorAll('.g-toggle input').forEach(inp => {
      inp.onchange = () => { T[inp.dataset.t] = inp.checked; draw(); };
    });
    draw();
    this._gameFocus(S.area.querySelector('.g-goal-next') || S.area.querySelector('.g-mix-ctl input'));
  },

  // ---------- abstop: run A/B tests day by day; ship, keep, or wait ----------
  _gameAbstop(S) {
    const g = S.game;
    const cfg = { usersPerDay: g.usersPerDay || 500, plannedDays: g.plannedDays || 14, maxDays: g.maxDays || (g.plannedDays || 14) + 7, alpha: g.alpha || 0.05 };
    const sc = Object.assign({ correctShip: 3, correctKeep: 2, falseShip: -3, missedWin: 0, waitedToPlan: 1 }, g.scoring || {});
    const seed = (Math.random() * 2147483647) | 0;
    // Simulate every round up front. A round marked "trap" (no real difference) is redrawn until
    // its p-value dips under alpha before the planned day: the point of the round is to meet the
    // trap. The panel at the end reports how often that happens without any redrawing.
    const sims = g.rounds.map((r, ri) => {
      let days, k = 0;
      do {
        days = abstopSimulate(r, cfg, makeRng(seed + 7777 * (ri + 1) + 104729 * k));
        k++;
      } while (r.trap && k < 400 && !(days.slice(0, cfg.plannedDays - 1).some(x => x.p < cfg.alpha) && days[cfg.plannedDays - 1].p >= cfg.alpha));
      return days;
    });
    let ri = 0, day = 1, points = 0, maxPoints = 0;
    const log = [];
    const fmtN = x => x.toLocaleString(locale('en-US'));
    const spark = (days, upto, kind) => {
      const W = cfg.maxDays * 10, H = 60;
      const xs = d => (d - 0.5) * 10;
      if (kind === 'p') {
        const y = p => { const l = Math.max(-3, Math.log10(Math.max(p, 1e-3))); return (-l / 3) * (H - 6) + 3; };
        const pts = days.slice(0, upto).map(x => `${xs(x.d).toFixed(1)},${y(x.p).toFixed(1)}`).join(' ');
        const dots = days.slice(0, upto).filter(x => x.p < cfg.alpha).map(x => `<circle cx="${xs(x.d)}" cy="${y(x.p).toFixed(1)}" r="3.5" class="g-sp-dip"/>`).join('');
        return `<svg class="g-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${tr(`p-value by day`)}">
          <line x1="0" x2="${W}" y1="${y(cfg.alpha).toFixed(1)}" y2="${y(cfg.alpha).toFixed(1)}" class="g-sp-ref"/>
          <line x1="${cfg.plannedDays * 10}" x2="${cfg.plannedDays * 10}" y1="0" y2="${H}" class="g-sp-plan"/>
          <polyline points="${pts}" class="g-sp-line"/>${dots}</svg>`;
      }
      const lim = 0.06;
      const y = v => H / 2 - (Math.max(-lim, Math.min(lim, v)) / lim) * (H / 2 - 4);
      const bars = days.slice(0, upto).map(x => `<rect x="${xs(x.d) - 3.5}" width="7" y="${Math.min(y(x.dailyDiff), H / 2).toFixed(1)}" height="${Math.abs(y(x.dailyDiff) - H / 2).toFixed(1)}" class="${x.dailyDiff >= 0 ? 'g-sp-up' : 'g-sp-down'}"/>`).join('');
      return `<svg class="g-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${tr(`daily difference B minus A`)}">
        <line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" class="g-sp-ref"/>
        <line x1="${cfg.plannedDays * 10}" x2="${cfg.plannedDays * 10}" y1="0" y2="${H}" class="g-sp-plan"/>${bars}</svg>`;
    };
    const render = () => {
      const r = g.rounds[ri], days = sims[ri], cur = days[day - 1];
      S.area.innerHTML = `${this._gameProgress(tr('Experiment'), ri, g.rounds.length, `${tr(`{0} points`, points)}`)}
        <p class="g-instruction">${esc(g.instruction)}</p>
        <div class="g-ab-head"><b>${esc(r.label)}</b><span>${tr(`Day <b>{0}</b> · plan: {1} days`, day, cfg.plannedDays)}</span></div>
        <div class="g-table-wrap"><table class="g-abt"><thead><tr><th scope="col">${tr(`Variant`)}</th><th scope="col">${tr(`Users`)}</th><th scope="col">${tr(`Converted`)}</th><th scope="col">${tr(`Rate`)}</th></tr></thead>
          <tbody><tr><th scope="row">${tr(`A (current)`)}</th><td>${fmtN(cur.nA)}</td><td>${fmtN(cur.cA)}</td><td>${pct(cur.cA / cur.nA, 2)}</td></tr>
          <tr><th scope="row">${tr(`B (new)`)}</th><td>${fmtN(cur.nB)}</td><td>${fmtN(cur.cB)}</td><td>${pct(cur.cB / cur.nB, 2)}</td></tr></tbody></table></div>
        <div class="g-ab-stats"><span>${tr(`B vs A: <b>{0}{1} %</b>`, cur.lift >= 0 ? '+' : '', (cur.lift * 100).toFixed(1))}</span><span>${tr(`p-value:`)} <b class="${cur.p < cfg.alpha ? 'g-dip' : ''}">${cur.p < 0.001 ? '< 0.001' : cur.p.toFixed(3)}</b>${cur.p < cfg.alpha ? tr(' (under 0.05)') : ''}</span></div>
        <div class="g-ab-charts">
          <figure><figcaption>${tr(`p-value by day (log scale; line = 0.05, dots = under it)`)}</figcaption>${spark(days, day, 'p')}</figure>
          <figure><figcaption>${tr(`Daily difference B − A (bars above the line = B better that day)`)}</figcaption>${spark(days, day, 'lift')}</figure>
        </div>
        <div class="g-ab-actions">
          ${day < cfg.maxDays ? ('<button class="g-btn g-btn-primary g-ab-next">' + tr(`Next day ›`) + '</button>') : ''}
          ${day < cfg.plannedDays ? `<button class="g-btn g-btn-quiet g-ab-plan">${tr(`Jump to day {0}`, cfg.plannedDays)}</button>` : ''}
          <button class="g-btn g-ab-ship">${tr(`Ship B`)}</button>
          <button class="g-btn g-ab-keep">${tr(`Keep A`)}</button>
        </div>
        <div class="g-fb"></div>`;
      const q = sel => S.area.querySelector(sel);
      if (q('.g-ab-next')) q('.g-ab-next').onclick = () => { day++; render(); this._gameFocus(q('.g-ab-next') || q('.g-ab-ship')); };
      if (q('.g-ab-plan')) q('.g-ab-plan').onclick = () => { day = cfg.plannedDays; render(); this._gameFocus(q('.g-ab-ship')); };
      q('.g-ab-ship').onclick = () => decide('ship');
      q('.g-ab-keep').onclick = () => decide('keep');
    };
    const decide = (choice) => {
      const r = g.rounds[ri], days = sims[ri], cur = days[day - 1];
      const better = r.pB > r.pA;
      let pts = 0, verdict;
      if (choice === 'ship') { pts = better ? sc.correctShip : sc.falseShip; verdict = better ? tr('Right call: B really is better.') : r.pB < r.pA ? tr('Ouch: B is actually worse.') : tr('False win: B is no better than A.'); }
      else { pts = better ? sc.missedWin : sc.correctKeep; verdict = better ? tr('Missed win: B really was better.') : tr('Right call: B is not better.'); }
      const waited = day >= cfg.plannedDays;
      if (waited) pts += sc.waitedToPlan;
      points += pts;
      maxPoints += (better ? sc.correctShip : sc.correctKeep) + sc.waitedToPlan;
      const atPlan = days[cfg.plannedDays - 1];
      const dipDays = days.slice(0, cfg.plannedDays).filter(x => x.p < cfg.alpha).map(x => x.d);
      let truth;
      if (r.novelty) truth = `${tr(`Truth: B's long-run rate equals A's ({0}). Its early lift was <b>novelty</b> that faded with a {1}-day half-life — look at the daily bars shrinking.`, pct(r.pA, 1), r.novelty.halfLifeDays)}`;
      else if (r.pB === r.pA) truth = `${tr(`Truth: no difference at all (an A/A test, both {0}).{1}`, pct(r.pA, 1), dipDays.length ? ` ${tr(`Yet the p-value was under 0.05 on day{0} {1}: stopping there ships noise.`, dipDays.length > 1 ? 's' : '', dipDays.join(', '))}` : '')}`;
      else truth = `${tr(`Truth: A {0}, B {1}. With {2} users per variant at day {3}, this test catches a difference this size about {4} of the time.`, pct(r.pA, 1), pct(r.pB, 1), fmtN(atPlan.nA), cfg.plannedDays, pct(twoPropPower(r.pA, r.pB, atPlan.nA)))}`;
      const planLine = `${tr(`At day {0} the planned test read p = {1}.`, cfg.plannedDays, atPlan.p < 0.001 ? '< 0.001' : atPlan.p.toFixed(3))}`;
      log.push({ label: r.label, choice, day, pts });
      this._gameAnswer(S, ri, pts > 0, { day, choice });
      S.area.querySelectorAll('.g-ab-actions button').forEach(b => { b.disabled = true; });
      const last = ri >= g.rounds.length - 1;
      this._gameFeedback(S, {
        ok: pts > 0,
        head: `${tr(`{0} You chose <b>{1}</b> on day {2}. {3} <b>{4}{5}</b> point{6}{7}.`, pts > 0 ? '✓' : '✗', choice === 'ship' ? tr('Ship B') : tr('Keep A'), day, verdict, pts >= 0 ? '+' : '', pts, Math.abs(pts) === 1 ? '' : 's', waited ? ` ${tr(`(incl. +{0} for waiting for the plan)`, sc.waitedToPlan)}` : '')}`,
        why: '',
        nextText: last ? tr('See your score ›') : tr('Next experiment ›'),
        onNext: () => { if (last) return finish(); ri++; day = 1; render(); this._gameFocus(S.area.querySelector('.g-ab-next')); },
      });
      const fb = S.area.querySelector('.g-feedback');
      if (fb) fb.insertAdjacentHTML('beforeend', `<div class="g-fb-why">${truth} ${planLine}</div>
        <figure class="g-ab-full"><figcaption>${tr(`The whole run (day {0}):`, cfg.maxDays)}</figcaption>${spark(days, cfg.maxDays, 'p')}${spark(days, cfg.maxDays, 'lift')}</figure>`);
      // the Next button must stay last in the box
      const nb = fb?.querySelector('.g-next');
      if (nb) { fb.appendChild(nb); this._gameFocus(nb); }
    };
    const finish = () => {
      const pk = abstopPeekingRate(cfg, g.peekSims || 200, seed + 4242, g.peekRate || 0.1);
      const html = `<div class="g-panel">
        <h5>${tr(`Your decisions`)}</h5>
        <div class="g-table-wrap"><table class="g-abt"><thead><tr><th scope="col">${tr(`Experiment`)}</th><th scope="col">${tr(`Decision`)}</th><th scope="col">${tr(`Day`)}</th><th scope="col">${tr(`Points`)}</th></tr></thead>
        <tbody>${log.map(x => `<tr><th scope="row">${esc(x.label)}</th><td>${x.choice === 'ship' ? tr('Ship B') : tr('Keep A')}</td><td>${x.day}</td><td>${x.pts >= 0 ? '+' : ''}${x.pts}</td></tr>`).join('')}</tbody></table></div>
        <h5>${tr(`Why peeking is a trap`)}</h5>
        <p>${tr(`We just ran {0} fresh A/A tests (no real difference, {1} for both, {2} users per variant per day) and checked the p-value every day for {3} days.`, g.peekSims || 200, pct(g.peekRate || 0.1), fmtN(cfg.usersPerDay), cfg.plannedDays)}</p>
        <ul class="g-bars g-bars-wide"><li class="is-ref"><span class="g-bars-l">${tr(`Under 0.05 on at least one day`)}</span><span class="g-bars-t"><i style="width:${(pk.ever * 100).toFixed(1)}%"></i></span><span class="g-bars-v">${pct(pk.ever)}</span></li>
          <li><span class="g-bars-l">${tr(`Under 0.05 on day {0}, as planned`, cfg.plannedDays)}</span><span class="g-bars-t"><i style="width:${(pk.atPlan * 100).toFixed(1)}%"></i></span><span class="g-bars-v">${pct(pk.atPlan)}</span></li></ul>
        <p class="g-small">${tr(`Stopping at the first dip turns a 5 % false-alarm rate into the first number. Fix the sample size in advance, or use a sequential test designed for peeking.`)}</p>
      </div>`;
      this._gameFinish(S, { score: Math.max(0, points), total: maxPoints, scoreLabel: `${tr(`{0} of {1} points`, points, maxPoints)}`, html });
    };
    render();
    this._gameFocus(S.area.querySelector('.g-ab-next'));
  },

  // ---------- loop: feedback-loop lab (creator side: rich get richer · user side: filter bubble) ----------
  _gameLoop(S) { return S.game.mode === 'user' ? this._gameLoopUser(S) : this._gameLoopCreator(S); },

  _gameLoopCreator(S) {
    const g = S.game;
    const seed = (Math.random() * 2147483647) | 0;
    const fixesDef = g.interventions || [];
    const days = g.days || 30;
    const run1 = loopCreatorRun(g, {}, seed);
    let run2 = null, chosen = {}, bestGoals = 0, attempts = 0;
    const gemName = (g.items.find(x => x.gem) || {}).name || '';
    const goals = g.goals || [];
    // a goal with "andPrev": true ("…while keeping clicks") only counts when the goal before it is met
    const evalGoals = (r) => goals.reduce((acc, goal, k) => {
      const ok = Object.entries(goal.check || {}).every(([key, v]) => {
        if (key === 'gemTop') return r.gemTop === v;
        if (key === 'clickRel') return checkCond(r.total / Math.max(1, run1.total), v);
        return false;
      });
      acc.push(ok && !(goal.andPrev && k > 0 && !acc[k - 1]));
      return acc;
    }, []);
    const rows = (r, day) => {
      const h = r.history[day - 1];
      const maxC = Math.max(1, ...r.history[r.history.length - 1].clicks);
      return `<ul class="g-creators">${g.items.map((it, i) => {
        const inFeed = h.shown.includes(i);
        return `<li class="${inFeed ? 'is-shown' : ''}${it.gem && day === days && r === run2 ? ' is-gem' : ''}"><span class="g-cr-name">${esc(it.name)}${inFeed ? (' <span class="g-chip g-chip-sys">' + tr(`in feed`) + '</span>') : ''}</span><span class="g-bars-t"><i style="width:${(100 * h.clicks[i] / maxC).toFixed(1)}%"></i></span><span class="g-bars-v">${h.clicks[i]}</span></li>`;
      }).join('')}</ul>`;
    };
    const stepper = (r, label, onDone) => {
      let d = 1;
      const draw = () => {
        const h = r.history[d - 1];
        const sumToday = r.history.slice(0, d).reduce((a, x) => a + x.today, 0);
        S.area.innerHTML = `<p class="g-instruction">${esc(g.instruction)}</p>
          <div class="g-progress"><span>${tr(`{0} · day <b>{1}</b> of {2}`, esc(label), d, days)}</span><span>${tr(`{0} clicks so far`, sumToday)}</span></div>
          <div class="g-bar" aria-hidden="true"><i style="width:${(100 * d / days).toFixed(1)}%"></i></div>
          <p class="g-small">${tr(`Bars = each creator's total clicks (the ranking signal). Today's feed: {0}.`, h.shown.map(i => esc(g.items[i].name)).join(', '))}</p>
          ${rows(r, d)}
          <div class="g-ab-actions">${d < days ? `<button class="g-btn g-btn-primary g-lp-next">${tr(`Next day ›`)}</button><button class="g-btn g-btn-quiet g-lp-end">${tr(`Run to day {0}`, days)}</button>` : ('<button class="g-btn g-btn-primary g-lp-done">' + tr(`See what happened ›`) + '</button>')}</div>
          <div class="g-fb"></div>`;
        const q = s => S.area.querySelector(s);
        if (q('.g-lp-next')) q('.g-lp-next').onclick = () => { d++; draw(); this._gameFocus(q('.g-lp-next') || q('.g-lp-done')); };
        if (q('.g-lp-end')) q('.g-lp-end').onclick = () => { d = days; draw(); this._gameFocus(q('.g-lp-done')); };
        if (q('.g-lp-done')) q('.g-lp-done').onclick = onDone;
      };
      draw();
      this._gameFocus(S.area.querySelector('.g-lp-next'));
    };
    const summary = (r) => {
      const gem = r.items.find(x => x.gem);
      return `${tr(`{0} was in the feed on <b>{1}</b> of {2} days · the most-shown creator got <b>{3}</b> of all impressions · total clicks <b>{4}</b>.`, esc(gemName), gem ? gem.shownDays : 0, days, pct(r.topShare), r.total)}`;
    };
    const setup = () => {
      S.area.innerHTML = `<p class="g-instruction">${tr(`Run 1 is done. {0}`, summary(run1))}</p>
        <div class="g-panel"><h5>${tr(`Try a fix, then replay the same 30 days`)}</h5>
          <p class="g-small">${tr(`Same audience, same luck: only the ranking changes.`)}</p>
          ${fixesDef.map(f => `<label class="g-toggle"><input type="checkbox" data-f="${esc(f.key)}"${chosen[f.key] ? ' checked' : ''}><span>${esc(f.label)}</span></label>`).join('')}
          <ul class="g-checks">${goals.map(x => `<li><span class="g-mark">○</span> ${esc(x.text)}</li>`).join('')}</ul>
          <button class="g-btn g-btn-primary g-lp-run">${tr(`Run 30 days with these fixes ›`)}</button></div>
        <div class="g-fb"></div>`;
      S.area.querySelectorAll('[data-f]').forEach(inp => { inp.onchange = () => { chosen[inp.dataset.f] = inp.checked; }; });
      S.area.querySelector('.g-lp-run').onclick = () => {
        attempts++;
        run2 = loopCreatorRun(g, chosen, seed);
        const used = fixesDef.filter(f => chosen[f.key]).map(f => f.short || f.label).join(' + ') || tr('no fix');
        stepper(run2, `${tr(`Run 2 ({0})`, used)}`, compare);
      };
      this._gameFocus(S.area.querySelector('[data-f]'));
    };
    const compare = () => {
      const res = evalGoals(run2);
      const nMet = res.filter(Boolean).length;
      bestGoals = Math.max(bestGoals, nMet);
      this._gameAnswer(S, attempts, nMet === goals.length, { fixes: Object.keys(chosen).filter(k => chosen[k]).join('+') });
      const gem1 = run1.items.find(x => x.gem), gem2 = run2.items.find(x => x.gem);
      S.area.innerHTML = `<div class="g-panel"><h5>${tr(`Run 1 vs. run 2`)}</h5>
        <div class="g-table-wrap"><table class="g-abt"><thead><tr><th scope="col"></th><th scope="col">${tr(`Run 1: by total clicks`)}</th><th scope="col">${tr(`Run 2: with your fixes`)}</th></tr></thead><tbody>
          <tr><th scope="row">${tr(`Total clicks`)}</th><td>${run1.total}</td><td>${run2.total} (${pct(run2.total / Math.max(1, run1.total))})</td></tr>
          <tr><th scope="row">${tr(`{0}: days in feed`, esc(gemName))}</th><td>${gem1.shownDays}</td><td>${gem2.shownDays}</td></tr>
          <tr><th scope="row">${tr(`Top creator's share of impressions`)}</th><td>${pct(run1.topShare)}</td><td>${pct(run2.topShare)}</td></tr>
        </tbody></table></div>
        <ul class="g-checks">${goals.map((x, k) => `<li class="${res[k] ? 'is-ok' : ''}"><span class="g-mark">${res[k] ? '✓' : '✗'}</span> ${esc(x.text)}</li>`).join('')}</ul>
        <h5>${tr(`The hidden truth`)}</h5>
        <p class="g-small">${tr(`How likely each creator's video is to be clicked when shown (toy numbers):`)}</p>
        <ul class="g-bars">${run2.items.map(it => `<li class="${it.gem ? 'is-best' : ''}"><span class="g-bars-l">${esc(it.name)}</span><span class="g-bars-t"><i style="width:${(it.appeal * 100 / 0.6).toFixed(1)}%"></i></span><span class="g-bars-v">${pct(it.appeal)}</span></li>`).join('')}</ul>
        </div>
        <div class="g-ab-actions"><button class="g-btn g-lp-again">${tr(`Try other fixes`)}</button><button class="g-btn g-btn-primary g-lp-fin">${tr(`Finish ›`)}</button></div>`;
      S.area.querySelector('.g-lp-again').onclick = setup;
      S.area.querySelector('.g-lp-fin').onclick = () => this._gameFinish(S, {
        score: bestGoals, total: Math.max(1, goals.length), scoreLabel: `${tr(`{0}/{1} goals`, bestGoals, goals.length)}`,
        html: `<div class="g-panel"><p>${tr(`{0} (run 1)`, summary(run1))}</p><p>${tr(`{0} (your last run 2)`, summary(run2))}</p></div>`,
      });
      this._gameFocus(S.area.querySelector('.g-lp-fin'));
    };
    stepper(run1, tr('Run 1: rank by total clicks'), setup);
  },

  _gameLoopUser(S) {
    const g = S.game;
    const topics = g.topics;
    const seed = (Math.random() * 2147483647) | 0;
    const rand = makeRng(seed);
    const size = g.feedSize || 6, p1 = g.phase1Days || 8, p2 = g.phase2Days || 5, goalTopics = g.goalTopics || 5;
    const exploreSlots = g.exploreSlots || 2;
    let profile = topics.map(() => 1 / topics.length);
    let phase = 1, day = 1, explore = false, reached = false;
    const hist = [];
    let feed = [];
    const used = topics.map(() => 0);
    const makeFeed = () => {
      const ts = bubbleFeed(profile, size, rand, explore ? exploreSlots : 0, g.gamma || 2);
      feed = ts.map(t => { const list = topics[t].items; const title = list[used[t] % list.length]; used[t]++; return { t, title }; });
      const distinct = new Set(ts).size;
      hist.push({ phase, day, distinct, profile: profile.slice() });
      if (phase === 2 && distinct >= goalTopics) reached = true;
    };
    const distinctNow = () => new Set(feed.map(f => f.t)).size;
    const profBar = (pr) => `<span class="g-stack" aria-hidden="true">${pr.map((p, t) => `<i style="width:${(p * 100).toFixed(1)}%" class="g-t${t % 8}"></i>`).join('')}</span>`;
    const draw = (msg) => {
      const n = distinctNow();
      const isP2 = phase === 2;
      S.area.innerHTML = `<p class="g-instruction">${esc(isP2 ? g.instruction2 : g.instruction)}</p>
        <div class="g-progress"><span>${tr(`{0} · day <b>{1}</b> of {2}`, isP2 ? tr('Burst it') : tr('Your feed'), day, isP2 ? p2 : p1)}</span><span>${tr(`Topics in today's feed: <b>{0}</b>{1}`, n, isP2 ? ` ${tr(`(goal {0})`, goalTopics)}` : '')}</span></div>
        <div class="g-bubble-feed">${feed.map((f, k) => `<div class="g-bf-card"><button class="g-opt g-bf-pick" data-k="${k}"><span class="g-key" aria-hidden="true">${k + 1}</span><span class="g-opt-text">${esc(f.title)}</span><span class="g-chip g-t${f.t % 8}">${esc(topics[f.t].name)}</span></button>${isP2 ? `<button class="g-bf-hide" data-k="${k}" aria-label="${tr(`Not interested in {0}`, esc(topics[f.t].name))}">${tr(`Not interested`)}</button>` : ''}</div>`).join('')}</div>
        ${isP2 ? `<div class="g-bf-tools"><div class="g-small">${tr(`Search for a topic:`)}</div><div class="g-bf-search">${topics.map((tp, t) => `<button class="g-chip-btn" data-s="${t}">${esc(tp.name)}</button>`).join('')}</div>
          <label class="g-toggle"><input type="checkbox" class="g-bf-explore"${explore ? ' checked' : ''}><span>${tr(`Platform setting: fill {0} of {1} slots with topics outside your profile`, exploreSlots, size)}</span></label></div>`
          : `<div class="g-ab-actions"><button class="g-btn g-btn-quiet g-bf-auto">${tr(`Let habit click for me ({0} days)`, p1 - day + 1)}</button></div>`}
        <div class="g-live g-small" role="status">${msg || ''}</div>
        <div class="g-fb"></div>`;
      const q = s => S.area.querySelector(s);
      S.area.querySelectorAll('.g-bf-pick').forEach(b => { b.onclick = () => act('click', feed[+b.dataset.k].t); });
      S.area.querySelectorAll('.g-bf-hide').forEach(b => { b.onclick = () => act('hide', feed[+b.dataset.k].t); });
      S.area.querySelectorAll('[data-s]').forEach(b => { b.onclick = () => act('search', +b.dataset.s); });
      if (q('.g-bf-explore')) q('.g-bf-explore').onchange = (e) => { explore = e.target.checked; hist.pop(); makeFeed(); draw(explore ? tr('Exploration on: today\'s feed was rebuilt.') : tr('Exploration off.')); if (reached) return endP2(); };
      if (q('.g-bf-auto')) q('.g-bf-auto').onclick = () => {
        // habit = open the item from your current favourite topic whenever the feed has one
        while (phase === 1 && day <= p1) { const fav = profile.indexOf(Math.max(...profile)); const pick = feed.find(f => f.t === fav) || feed[0]; act('click', pick.t, true); }
      };
    };
    const act = (kind, t, silent) => {
      profile = bubbleUpdate(profile, t, kind === 'hide' ? 'hide' : 'click', g.rate || 0.2);
      this._gameAnswer(S, day, true, { phase, kind, topic: topics[t].name });
      const msg = kind === 'hide' ? `${tr(`You hid {0}.`, topics[t].name)}` : kind === 'search' ? `${tr(`You searched for {0}.`, topics[t].name)}` : `${tr(`You opened a {0} item.`, topics[t].name)}`;
      day++;
      if (phase === 1 && day > p1) return revealP1();
      if (phase === 2 && day > p2) { makeFeed(); return endP2(); }
      makeFeed();
      if (phase === 2 && reached) return endP2();
      if (!silent) { draw(msg); this._gameFocus(S.area.querySelector('.g-bf-pick')); }
    };
    const revealP1 = () => {
      makeFeed();
      const p1h = hist.filter(h => h.phase === 1);
      const first = p1h[0], lastH = p1h[p1h.length - 1];
      S.area.innerHTML = `<div class="g-panel"><h5>${tr(`What happened to your feed`)}</h5>
        <p>${tr(`Day 1: <b>{0}</b> topics in your feed. Day {1}: <b>{2}</b>.`, first.distinct, p1h.length, lastH.distinct)}</p>
        <ul class="g-days">${p1h.map(h => `<li><span class="g-days-l">${tr(`Day {0}`, h.day)}</span>${profBar(h.profile)}<span class="g-bars-v">${h.distinct}</span></li>`).join('')}</ul>
        <p class="g-small">${tr(`Coloured bar = your profile (the system's estimate of your taste); number = topics in that day's feed.`)}</p>
        <p>${esc(g.reveal || '')}</p></div>
        <div class="g-ab-actions"><button class="g-btn g-btn-primary g-bf-p2">${tr(`Now burst the bubble ›`)}</button></div>`;
      S.area.querySelector('.g-bf-p2').onclick = () => { phase = 2; day = 1; makeFeed(); if (reached) return endP2(); draw(); this._gameFocus(S.area.querySelector('.g-bf-pick')); };
      this._gameFocus(S.area.querySelector('.g-bf-p2'));
    };
    const endP2 = () => {
      const p2h = hist.filter(h => h.phase === 2);
      const best = Math.max(...p2h.map(h => h.distinct));
      this._gameFinish(S, {
        score: reached ? 1 : 0, total: 1,
        scoreLabel: reached ? tr('Bubble burst') : tr('Still in the bubble'),
        note: reached ? `${tr(`Your feed reached {0} topics.`, best)}` : `${tr(`Best day: {0} topics (goal {1}).`, best, goalTopics)}`,
        html: `<div class="g-panel"><ul class="g-days">${hist.map(h => `<li class="${h.phase === 2 ? 'is-p2' : ''}"><span class="g-days-l">${h.phase === 2 ? tr('Fix') : tr('Day')} ${h.day}</span>${profBar(h.profile)}<span class="g-bars-v">${h.distinct}</span></li>`).join('')}</ul>
          <p class="g-small">${esc(g.reveal2 || '')}</p></div>`,
      });
    };
    makeFeed();
    draw();
    this._gameFocus(S.area.querySelector('.g-bf-pick'));
  },

  // ===== Playground: every game in one place =====
  openPlayground(focusId) {
    if (!this._f('games')) { this.showXPToast(tr('Mini-games are switched off in Settings'), 'info'); return; }
    let ov = document.getElementById('gPlayground');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'gPlayground';
      ov.className = 'g-pg';
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-modal', 'true');
      ov.setAttribute('aria-labelledby', 'gPgTitle');
      document.body.appendChild(ov);
      ov.addEventListener('keydown', e => { if (e.key === 'Escape') this.closePlayground(); });
      // concept links inside the overlay: close it first, the global #c/ handler then opens the concept
      ov.addEventListener('click', e => { if (e.target.closest('a[href^="#c/"]')) this.closePlayground(); }, true);
    }
    if (ov.hidden !== false || !ov.innerHTML) { this._pgPrevFocus = document.activeElement; this._navOverlayOpen?.('playground'); }
    ov.hidden = false;
    document.body.classList.add('g-pg-open');
    this.rc?.logEvent?.('playground_open', { focus: focusId || '' });
    if (focusId) this._pgOpenGame(focusId); else this._renderPlayground();
  },

  closePlayground() {
    const ov = document.getElementById('gPlayground');
    if (!ov) return;
    const wasOpen = !ov.hidden;
    ov.hidden = true;
    ov.innerHTML = '';
    document.body.classList.remove('g-pg-open');
    if (wasOpen) this._navOverlayClosed?.();
    try { this._pgPrevFocus?.focus?.({ preventScroll: true }); } catch (e) { /* element gone */ }
  },

  _pgGames() {
    const order = new Map((this.book?.chapters || []).map((c, i) => [c.id, i]));
    return this.allBlocks.filter(b => b.meta.type === 'game')
      .map(b => b.meta)
      .sort((a, b) => (order.get(chOf(a)) ?? 99) - (order.get(chOf(b)) ?? 99));
  },

  _renderPlayground() {
    const ov = document.getElementById('gPlayground');
    if (!ov) return;
    const games = this._pgGames();
    const store = this._gameStore();
    const played = games.filter(m => store[m.id]).length;
    const byCh = new Map();
    games.forEach(m => { const ch = chOf(m); if (!byCh.has(ch)) byCh.set(ch, []); byCh.get(ch).push(m); });
    const chTitle = id => { const c = (this.book?.chapters || []).find(x => x.id === id); return c ? `${tr(`Chapter {0} · {1}`, c.number, c.title)}` : id; };
    ov.innerHTML = `<div class="g-pg-inner">
      <div class="g-pg-head"><h2 id="gPgTitle">${tr(`🎮 Playground`)}</h2><button class="g-btn g-btn-quiet g-pg-close" aria-label="${tr(`Close the playground`)}">${tr(`✕ Close`)}</button></div>
      <p class="g-pg-intro">${tr(`{0} hands-on games, each 1–4 minutes. No timer, and every answer comes with the reason. You've played {1} of them.`, games.length, played)}</p>
      ${[...byCh.entries()].map(([ch, list]) => `<section class="g-pg-sec"><h3>${esc(chTitle(ch))}</h3><div class="g-pg-grid">${list.map(m => {
        const rec = store[m.id];
        const c = this._gameConcept(m);
        return `<button class="g-pg-card" data-id="${esc(m.id)}"><span class="g-pg-t">${esc(m.title)}</span><span class="g-pg-d">${esc(m.teaser || '')}</span><span class="g-pg-m">${c ? esc(c.title) + ' · ' : ''}${rec && rec.best != null ? `Best ${esc(rec.bestLabel || pct(rec.best))}` : ('<b>' + tr(`New`) + '</b>')}</span></button>`;
      }).join('')}</div></section>`).join('')}
    </div>`;
    ov.querySelector('.g-pg-close').onclick = () => this.closePlayground();
    ov.querySelectorAll('.g-pg-card').forEach(b => { b.onclick = () => this._pgOpenGame(b.dataset.id); });
    ov.scrollTop = 0;
    this._gameFocus(ov.querySelector('.g-pg-close'));
  },

  _pgOpenGame(id) {
    const ov = document.getElementById('gPlayground');
    const meta = this.findBlock(id)?.meta;
    if (!ov || !meta) return this._renderPlayground();
    ov.innerHTML = `<div class="g-pg-inner">
      <div class="g-pg-head"><button class="g-btn g-btn-quiet g-pg-back">${tr(`← All games`)}</button><button class="g-btn g-btn-quiet g-pg-close" aria-label="${tr(`Close the playground`)}">${tr(`✕ Close`)}</button></div>
      ${this.renderGame(meta, { prefix: 'pg-', inPlayground: true })}
    </div>`;
    ov.querySelector('.g-pg-back').onclick = () => this._renderPlayground();
    ov.querySelector('.g-pg-close').onclick = () => this.closePlayground();
    ov.scrollTop = 0;
    const start = ov.querySelector('.game-start-btn');
    if (start) start.click();
  },

  // "Hands-on" chip beside a telling's tellings indicator: the concept's game(s), one tap away.
  // Only on the concept's anchor, so a chapter with seven tellings doesn't repeat it seven times.
  _conceptGameChip(concept, blockId) {
    if (!this._f('games')) return '';
    const slug = String(concept || '').split('|')[0].trim();
    if (!slug) return '';
    const anchor = this.concepts?.[slug]?.anchor;
    if (anchor && blockId && anchor !== blockId) return '';
    const g = this.allBlocks.find(b => b.meta.type === 'game' && String(b.meta.concept || '').split('|')[0].trim() === slug);
    if (!g) return '';
    const m = g.meta;
    return `<button class="steer-chip g-handson-chip" onclick="app.openPlayground('${esc(m.id)}')" title="${esc(m.teaser || tr('Try this concept hands-on'))}">${tr(`▶ Hands-on: {0}`, esc(m.title))} <span class="g-small">${tr(`(~{0} min)`, esc(String(m.readingTime || 2)))}</span></button>`;
  },

  // Browse shelf: the games as cards (unplayed first). Returns '' when games are off.
  _gamesShelfHtml() {
    if (!this._f('games')) return '';
    const games = this._pgGames();
    if (games.length < 3) return '';
    const store = this._gameStore();
    const sorted = [...games.filter(m => !store[m.id]), ...games.filter(m => store[m.id])].slice(0, 12);
    const card = m => {
      const rec = store[m.id];
      const c = this._gameConcept(m);
      return `<div class="card g-shelf-card" role="button" tabindex="0" style="flex:0 0 220px;cursor:pointer" onclick="app.openPlayground('${esc(m.id)}')" onkeydown="if(event.key==='Enter')app.openPlayground('${esc(m.id)}')">
        <div class="card-chapter">🎮 ${esc(c ? c.title : tr('Mini-game'))}</div>
        <div class="card-title">${esc(m.title)}</div>
        <div class="card-teaser">${esc(m.teaser || '')}</div>
        <div class="card-meta"><span class="card-time">${rec && rec.best != null ? `Best ${esc(rec.bestLabel || pct(rec.best))}` : tr('New · untimed')}</span></div>
      </div>`;
    };
    const all = `<div class="card g-shelf-card g-shelf-all" role="button" tabindex="0" style="flex:0 0 180px;cursor:pointer" onclick="app.openPlayground()" onkeydown="if(event.key==='Enter')app.openPlayground()">
      <div class="card-chapter">${tr(`🎮 Playground`)}</div><div class="card-title">${tr(`All {0} games ›`, games.length)}</div><div class="card-teaser">${tr(`Grouped by chapter, with your best scores.`)}</div></div>`;
    return this.shelf(tr('🎮 Play with the ideas'), [all, ...sorted.map(card)]);
  },
};

export function installGames(Cls) {
  Object.assign(Cls.prototype, GamesMixin);
  if (typeof document !== 'undefined' && !document.querySelector('link[data-games-css]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'css/games.css?v=1';
    l.setAttribute('data-games-css', '');
    document.head.appendChild(l);
  }
}
