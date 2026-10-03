// p-book v2 — the reader-facing UX layer.
//
// What lives here: navigation the system back button understands, the
// first-visit door and the returning-reader resume, explainable in-app
// recommendations ("Why this?"), the labelled section menu, the reading-progress
// strip, the mini-board sheet, progress moments (chapter complete, session
// wrap-up), the topbar progress ring, theme and accessibility helpers.
//
// installUx(PBook) mixes these methods into PBook.prototype, so `this` is the
// app exactly as inside js/app.js. They live in their own module because app.js
// is one 10k-line class that several people edit at the same time.

import { CONFIG } from './config.js';

const words = () => CONFIG.facetWords || {};
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEPTH_SHORT = { intro: 'gentle', standard: 'standard', technical: 'technical', research: 'research' };

// Goal picked at the door → the first guided path we suggest (missions in app.js).
const GOAL_PATHS = {
  understand: { mission: 'youtube', label: 'Understand' },
  build: { mission: 'builder', label: 'Build one', depth: 'technical' },
  decide: { mission: 'production', label: 'Make decisions' },
  protect: { mission: 'control', label: 'Protect myself' },
};

// Mission branch keys are the retired voice taxonomy; readers see what each path holds.
export const BRANCH_WORDS = {
  explorer: { icon: '👀', label: 'See it in action' },
  creator: { icon: '🛠️', label: 'Try it yourself' },
  thinker: { icon: '🔬', label: 'Go deeper' },
};

// Achievement ids are stored in reader profiles; names are display only.
export const ACHIEVEMENT_NAMES = {
  first_read: { icon: '👣', name: 'First section' },
  reader_5: { icon: '📚', name: 'Five sections' },
  reader_15: { icon: '📖', name: 'Fifteen sections' },
  reader_30: { icon: '🗂️', name: 'Thirty sections' },
  first_like: { icon: '❤️', name: 'First favourite' },
  like_10: { icon: '🌟', name: 'Ten favourites' },
  first_note: { icon: '📝', name: 'Note taker' },
  voice_all: { icon: '🎭', name: 'Every kind of section' },
  curious_cat: { icon: '🧭', name: 'Wide reader' },
  quiz_master: { icon: '🧩', name: 'Active reader' },
  level_5: { icon: '🏆', name: 'Level 5' },
  save_5: { icon: '🔖', name: 'Collector' },
  xp_200: { icon: '💎', name: '200 XP' },
  deep_diver: { icon: '🤿', name: 'Deep diver' },
  recall_5: { icon: '🧠', name: 'Five reviews' },
  certified: { icon: '🎓', name: 'Certified' },
};

export const uxMethods = {
  // ---------------------------------------------------------------- words
  _fw(dim, v) {
    const w = words()[dim] || {};
    return w[v] || String(v ?? '').replace(/[-_]/g, ' ');
  },
  _depthPhrase(set) {
    if (!set || !set.length) return '';
    if (set.length === 1) return this._fw('depth', set[0]);
    return `${DEPTH_SHORT[set[0]] || set[0]} to ${DEPTH_SHORT[set[set.length - 1]] || set[set.length - 1]} depth`;
  },
  // One telling in plain words, e.g. "job-board examples · standard to technical depth".
  // Without `dims`: only what differs from the defaults (the interesting part).
  _tellingWords(meta, dims) {
    const parts = [];
    for (const dim of dims || ['lens', 'depth', 'genre', 'visuality', 'lengthBand', 'lang']) {
      const set = this._facetValues(meta, dim);
      if (!set.length) continue;
      if (!dims) {
        if (set.length === 1 && set[0] === this._facetDefault(dim)) continue;
        if (dim === 'lens' && set.includes('generic')) continue;
      }
      if (dim === 'depth') parts.push(this._depthPhrase(set));
      else if (CONFIG.facets[dim]?.ordered && set.length > 1) parts.push(`${this._fw(dim, set[0])} to ${this._fw(dim, set[set.length - 1])}`);
      else parts.push(set.map(v => this._fw(dim, v)).join(' or '));
    }
    return parts.filter(Boolean).join(' · ');
  },
  // Short facet line for cards and search results (replaces the retired voice badge)
  _cardFacetLine(meta) {
    const bits = [];
    const g = this._facetValues(meta, 'genre');
    if (g.length && g[0] !== 'explainer') bits.push(this._fw('genre', g[0]));
    const d = this._facetValues(meta, 'depth');
    if (d.length && !(d.length === 1 && d[0] === 'standard')) bits.push(this._depthPhrase(d));
    const l = this._facetValues(meta, 'lens');
    if (l.length && !l.includes('generic')) bits.push(l.map(v => this._fw('lensShort', v)).join(' & '));
    if (this._facetValues(meta, 'lang').includes('cs')) bits.push('Czech');
    return bits.join(' · ');
  },

  // ---------------------------------------------------------------- version
  // One version string: the ?v= that index.html already uses to bust caches.
  _appVersion() {
    const s = document.querySelector('script[src*="js/app.js"]');
    const m = s && s.getAttribute('src').match(/[?&]v=([\w.-]+)/);
    return m ? m[1] : 'dev';
  },

  // ---------------------------------------------------------------- navigation
  // Every user-initiated view switch and every opened section becomes a browser
  // history entry, so the phone's back gesture walks back through the book
  // instead of leaving it. Entries carry an index `i` (0 = where the visit began).
  _navInit() {
    if (this._navReady) return;
    this._navReady = true;
    try { history.replaceState({ pb: 1, i: 0, view: 'home' }, '', location.pathname + location.search); } catch (e) {}
    window.addEventListener('popstate', e => this._onPopState(e.state));
    // Modals (certificate, contact) are closed by their own buttons with a plain
    // .remove(): drop their history entry when that happens
    try {
      new MutationObserver(muts => {
        if (muts.some(m => [...m.removedNodes].some(n => n.classList?.contains('cert-overlay')))
          && !document.querySelector('.cert-overlay')) this._navOverlayClosed();
      }).observe(document.body, { childList: true });
    } catch (e) {}
  },
  // Full-screen overlays (Playground, certificate, contact) get a history entry
  // of their own, so the phone's back gesture closes the overlay instead of
  // switching the view underneath it (or leaving the book).
  _navOverlayOpen(name) {
    this._navInit();
    if (this._navRestoring) return;
    const cur = history.state || {};
    if (!cur.pb || cur.overlay) return;
    try { history.pushState({ ...cur, i: (cur.i || 0) + 1, overlay: name }, '', location.href); } catch (e) {}
  },
  _navOverlayClosed() {
    if (this._navRestoring || !history.state?.overlay) return;
    this._navSkipPop = true;
    history.back();
  },
  _closeOverlays() {
    const pg = document.getElementById('gPlayground');
    const open = (pg && !pg.hidden) || !!document.querySelector('.cert-overlay');
    if (pg && !pg.hidden) this.closePlayground?.();
    document.querySelectorAll('.cert-overlay').forEach(o => o.remove());
    return open;
  },
  _navPush(state, url) {
    this._navInit();
    if (this._navRestoring) return;          // replaying history — never push
    const cur = history.state || {};
    const same = cur.pb && cur.view === state.view && (cur.blockId || null) === (state.blockId || null) && (cur.mission || null) === (state.mission || null);
    try {
      if (same) { history.replaceState({ ...cur, ...state, pb: 1 }, '', url); return; }
      if (cur.pb) history.replaceState({ ...cur, y: window.scrollY }, '', location.href);   // where to come back to
      history.pushState({ pb: 1, i: (cur.i || 0) + 1, ...state }, '', url);
    } catch (e) {}
  },
  _navPushView(view) {
    this._navPush({ view }, view === 'home' ? location.pathname + location.search : `#view-${view}`);
  },
  _navPushBlock(blockId) {
    this._navPush({ view: 'read', blockId }, '#' + blockId);
  },
  _onPopState(st) {
    if (this._navSkipPop) { this._navSkipPop = false; return; }   // an overlay closed itself
    if (!st || !st.pb) return;               // not one of ours
    this._navRestoring = true;
    try {
      if (this._closeOverlays()) return;     // back closes the overlay, the view stays
      this._closeSheet();
      document.getElementById('previewPanel')?.remove();
      document.getElementById('searchOverlay')?.classList.remove('open');
      document.getElementById('settingsDrawer')?.classList.remove('open');
      document.getElementById('tourOverlay')?.remove();
      document.getElementById('onboarding')?.classList.add('hidden');
      if (st.blockId && this.findBlock(st.blockId)) {
        this.openBlock(st.blockId, 'back');
      } else if (st.mission) {
        this.showMission(st.mission);
      } else {
        this.switchView(st.view || 'home', true);
        if (st.y) setTimeout(() => window.scrollTo({ top: st.y, behavior: 'instant' }), 120);
      }
    } finally { this._navRestoring = false; }
  },
  // The in-section "←": real back when the visit has history, else Browse
  _canGoBack() { return (history.state?.pb && history.state.i > 0) || false; },

  // ---------------------------------------------------------------- door & resume
  // Called once at the end of init(). Deep links already chose a view; first-time
  // readers get the (short) door; returning readers land where they left off.
  _resumeOrWelcome() {
    this._navInit();
    this._sessionInit();
    this._a11yInit();
    this._initReadProgress();
    this._checkProgressMoments();   // seeds the snapshot on a first visit; never fires retroactively
    const overlay = document.getElementById('onboarding');
    if (this._pendingStart) { const v = this._pendingStart; this._pendingStart = null; this.startAndGo(v); return; }
    if (!overlay || overlay.classList.contains('hidden')) { this.updateXPBadge(); return; }   // deep link
    // anyone who already opened a section (even via a shared link, skipping the door) resumes it
    const returning = this.user.readBlocks.size > 0 || localStorage.getItem('pbook-onboarded') === '1' || !!(this.user.currentBlock && this.findBlock(this.user.currentBlock));
    if (!returning) { this._onboardingInit(); return; }
    overlay.classList.add('hidden');
    this.updateXPBadge();
    if (!this._f('missions')) document.querySelector('[data-view="glossary"]')?.style.setProperty('display', 'none');
    this._resumeReading(true);
    this._welcomeBack();
  },
  _resumeBlockId() {
    const cur = this.user.currentBlock;
    if (cur && this.findBlock(cur)) return cur;
    return this.getContinueBlock()?.id || null;
  },
  _resumeReading(silent) {
    document.getElementById('onboarding')?.classList.add('hidden');
    const id = this._resumeBlockId();
    if (id) this.openBlock(id, 'resume'); else this.switchView('home', !!silent);
  },
  _welcomeBack() {
    const due = this._f('spaceRepetition') ? this.user.getDueRecalls().length : 0;
    let last = null;
    try { last = JSON.parse(localStorage.getItem('pbook-last-session') || 'null'); } catch (e) {}
    const bits = [];
    if (last && last.sections && Date.now() - (last.ts || 0) < 30 * 864e5) bits.push(`last time: ${plural(last.sections, 'section')}`);
    if (due) bits.push(`${plural(due, 'recall card')} due`);
    setTimeout(() => this.showXPToast('Welcome back' + (bits.length ? ' · ' + bits.join(' · ') : ''), 'info'), 900);
  },
  _onboardingInit() {
    if (/[?&]ab=1\b/.test(location.search)) {   // the old random-start experiment, opt-in only
      const cta = document.querySelector('.step[data-step="0"] .btn-primary.btn-large');
      if (cta) { cta.textContent = "Start (we'll pick a reading mode — you can switch)"; cta.setAttribute('onclick', 'app.startRandom()'); }
    }
    const sel = document.querySelector('#introLens .intro-voice.selected');
    if (sel) this.onboardPick('lens', sel.dataset.lens, sel);
  },
  // The door's one primary button: save the (optional) picks, open Chapter 1.
  // A first-time reader is reading after two taps (open the site, tap Start).
  doorStart() {
    this._saveFeatureToggles();
    this._saveDoorPicks();
    document.getElementById('onboarding')?.classList.add('hidden');
    this.updateVoiceBadge?.();
    this.updateXPBadge();
    if (!this._f('missions')) document.querySelector('[data-view="glossary"]')?.style.setProperty('display', 'none');
    if (this.user.readBlocks.size) { this._resumeReading(); return; }
    const id = this._firstBlockId();
    if (id) this.openBlock(id, 'door'); else this.switchView('home');
    let tries = 0;
    const tick = () => {
      if (document.querySelector('#view-read.active .block-article')) { this._goalBanner(); return; }
      if (++tries < 30) setTimeout(tick, 150);
    };
    tick();
  },
  // How many sections really have examples from a world (honest door copy)
  _lensCoverage(lens) {
    return (this.allBlocks || []).filter(b => b.meta.type === 'spine' && this._facetValues(b.meta, 'lens').includes(lens)).length;
  },
  _firstBlockId() {
    const first = this._conceptOrder()[0];
    const a = first && this.concepts?.[first]?.anchor;
    if (a && this.findBlock(a)) return a;
    return this.chapters?.[0]?.blocks.find(b => b.type === 'spine')?.id || null;
  },
  // The goal picked at the door shapes the first experience: a soft depth hint
  // and a one-line pointer to the matching guided path (logged for the experiment).
  _applyGoal() {
    const g = GOAL_PATHS[this.user.goal];
    if (!g) return;
    if (g.depth) this.user.updateFacetAffinity({ depth: g.depth }, 3);
    this.rc.logEvent('goal_path', { goal: this.user.goal, mission: g.mission });
  },
  _goalBanner() {
    const g = GOAL_PATHS[this.user.goal];
    if (!g || !this._f('missions') || this.user.goal === 'understand') return;
    const m = this.getMissions().find(x => x.id === g.mission);
    if (!m) return;
    const pane = document.getElementById('readPane');
    if (!pane || pane.querySelector('.goal-banner')) return;
    const div = document.createElement('div');
    div.className = 'goal-banner fade-up';
    div.innerHTML = `<span>🎯 For your goal <b>“${esc(g.label)}”</b>: the guided path <b>${esc(m.title)}</b> takes you through the right sections in order.</span>
      <span class="goal-banner-actions"><button class="steer-chip" onclick="app.showMission('${m.id}')">Open the path</button>
      <button class="goal-banner-close" aria-label="Dismiss" onclick="this.closest('.goal-banner').remove()">&times;</button></span>`;
    pane.prepend(div);
  },
  _startTourWhenReady() {
    if (localStorage.getItem('pbook-tour-done')) return;
    let tries = 0;
    const tick = () => {
      const ready = document.querySelector('#view-read.active .block-article, #view-home.active .shelf');
      if (ready || ++tries > 25) { setTimeout(() => { if (!document.getElementById('tourOverlay')) this.startTour(); }, 1400); return; }
      setTimeout(tick, 200);
    };
    tick();
  },

  // ---------------------------------------------------------------- session
  _sessionInit() {
    if (this._sessionStart) return;
    this._sessionStart = new Set(this.user.readBlocks);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'hidden') return;
      const s = this._sessionStats();
      if (s.sections >= 1) { try { localStorage.setItem('pbook-last-session', JSON.stringify({ ...s, ts: Date.now() })); } catch (e) {} }
    });
  },
  _sessionStats() {
    const fresh = [...this.user.readBlocks].filter(id => !this._sessionStart?.has(id));
    const concepts = new Set();
    fresh.forEach(id => { const b = this._findAnyBlock(id); const c = b && this._conceptIds(b.meta)[0]; if (c) concepts.add(c); });
    return { sections: fresh.length, concepts: concepts.size };
  },
  _todayLine() {
    const s = this._sessionStats();
    if (!s.sections) return '';
    const due = this._f('spaceRepetition') ? Object.values(this.user.recall || {}).filter(c => c.nextReview > Date.now()).sort((a, b) => a.nextReview - b.nextReview)[0] : null;
    const next = due ? ` · next recall ${new Date(due.nextReview).toLocaleDateString(undefined, { weekday: 'long' })}` : '';
    return `Today: ${plural(s.sections, 'section')} · ${plural(s.concepts, 'concept')}${next}`;
  },

  // ---------------------------------------------------------------- concepts & picks
  _conceptOrder() {
    const key = (this.allBlocks || []).length + ':' + Object.keys(this.concepts || {}).length;
    if (this._cOrderKey === key && this._cOrder) return this._cOrder;
    const out = [], seen = new Set();
    (this.book?.chapters || []).forEach((ch, i) => {
      (this.chapters[i]?.blocks || []).forEach(b => {
        const cid = this._conceptIds(b)[0];
        if (cid && this.concepts?.[cid] && !seen.has(cid)) { seen.add(cid); out.push(cid); }
      });
    });
    this._cOrder = out; this._cOrderKey = key;
    return out;
  },
  _cRead(cid) {
    return this._conceptPool(cid).some(b => this.user.readBlocks.has(b.meta?.id || b.id));
  },
  _conceptChapterNum(cid) {
    const chId = this.concepts?.[cid]?.chapter;
    const ch = (this.book?.chapters || []).find(c => c.id === chId);
    return ch ? ch.number : '?';
  },
  // The telling of a concept that best fits the reader (never another language
  // when one in the reader's language exists; the anchor wins ties).
  _bestTelling(cid, target) {
    const pool = (this.conceptBlocks?.[cid] || []).filter(b => b.meta.type === 'spine');
    if (!pool.length) return null;
    const lang = target.lang || 'en';
    const same = pool.filter(b => this._covers(b.meta, 'lang', lang));
    const anchor = this.concepts?.[cid]?.anchor;
    let best = null, bs = -1;
    for (const b of (same.length ? same : pool)) {
      const s = this._facetMatch(b.meta, target) + (b.meta.id === anchor ? 0.001 : 0);
      if (s > bs) { bs = s; best = b; }
    }
    return best ? { block: best, fit: Math.min(1, bs) } : null;
  },
  _missionConcepts() {
    const out = new Map();
    if (!this._f('missions')) return out;
    const done = new Set(this.user.completedMissions || []);
    for (const m of this.getMissions()) {
      if (done.has(m.id) || this._isMissionLocked(m)) continue;
      if (!m.core.some(id => this.user.readBlocks.has(id))) continue;   // started missions only
      m.core.forEach((id, i) => {
        const b = this.findBlock(id);
        const cid = b && this._conceptIds(b.meta)[0];
        if (cid && !out.has(cid)) out.set(cid, { title: m.title, step: i + 1 });
      });
    }
    return out;
  },
  // Only claim fit on what the reader stated or the model learned — never on defaults.
  _fitReason(meta, target) {
    const prefs = this.user.steerPrefs || {};
    const bits = [];
    if (target.lens && target.lens !== 'generic' && this._facetValues(meta, 'lens').includes(target.lens)) bits.push(`examples from your ${this._fw('lensShort', target.lens).toLowerCase()} world`);
    for (const dim of ['depth', 'lengthBand', 'visuality', 'genre']) {
      if (prefs[dim] && this._covers(meta, dim, prefs[dim])) bits.push(this._fw(dim, prefs[dim]));
    }
    if (prefs.lang && prefs.lang !== 'en' && this._covers(meta, 'lang', prefs.lang)) bits.push(this._fw('lang', prefs.lang));
    return bits.length ? `Told your way: ${bits.join(', ')}` : '';
  },
  // THE local recommender behind "Next for you", the read-next "Recommended"
  // link and the feed fallback. Candidates are unread concepts whose prerequisites
  // are read; each is served as its best-fitting telling. Every pick carries the
  // reasons and the arithmetic, so the app is a worked example of its own ch07:
  //   score = 0.5 · facet fit + 0.3 · readiness + 0.2 · active-mission membership
  _nextPicks({ exclude, limit = 6 } = {}) {
    if (!this.concepts) return [];
    const ex = exclude || new Set();
    const target = this.user.getTargetFacets();
    const order = this._conceptOrder();
    const lastReadId = [...this.user.readBlocks].reverse().find(id => this._findAnyBlock(id));
    const lastCid = lastReadId ? this._conceptIds(this._findAnyBlock(lastReadId).meta)[0] : null;
    const lastIdx = lastCid ? order.indexOf(lastCid) : -1;
    const missions = this._missionConcepts();
    const out = [];
    order.forEach((cid, idx) => {
      if (this._cRead(cid) || this._unmetPrereqs(cid).length) return;
      const best = this._bestTelling(cid, target);
      if (!best || ex.has(best.block.meta.id)) return;
      const dist = lastIdx >= 0 ? idx - lastIdx : idx + 1;
      const ready = dist >= 1 && dist <= 3 ? 1 : dist > 3 ? 0.6 : 0.4;
      const m = missions.get(cid);
      const score = 0.5 * best.fit + 0.3 * ready + 0.2 * (m ? 1 : 0);
      const reasons = [];
      if (m) reasons.push(`Step ${m.step} of your mission “${m.title}”`);
      if (lastIdx >= 0 && dist === 1) reasons.push(`The next idea after “${this.concepts[lastCid]?.title || lastCid}”, which you just read`);
      else if (lastIdx >= 0 && dist > 1 && dist <= 3) reasons.push(`Comes up shortly after what you've read (Chapter ${this._conceptChapterNum(cid)})`);
      else if (lastIdx >= 0 && dist < 0) reasons.push(`You skipped it earlier (Chapter ${this._conceptChapterNum(cid)})`);
      else if (lastIdx < 0 && idx === 0) reasons.push('Where the book starts');
      else if (lastIdx < 0 && idx < 3) reasons.push('Part of the opening chapter');
      const node = this._cmapNode?.(cid);
      const pre = (node?.prereq || []).find(p => this._cRead(p));
      if (pre) reasons.push(`Builds on “${this.concepts[pre]?.title || pre}”, which you've read`);
      const fit = this._fitReason(best.block.meta, target);
      if (fit) reasons.push(fit);
      if (!reasons.length) reasons.push(`Not read yet · Chapter ${this._conceptChapterNum(cid)}`);
      out.push({ meta: best.block.meta, cid, score, reasons,
        math: `score ${score.toFixed(2)} = 0.5 × ${best.fit.toFixed(2)} fit + 0.3 × ${ready.toFixed(1)} ready + 0.2 × ${m ? 1 : 0} mission` });
    });
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  },
  // "Why this?" disclosure shown on cards and read-next links
  _whyHtml(why) {
    if (!why || !why.reasons || !why.reasons.length) return '';
    const items = why.reasons.map(r => `<li>${esc(r)}</li>`).join('');
    return `<details class="why" onclick="event.stopPropagation()"><summary>Why this?</summary>
      <div class="why-body"><ul>${items}</ul>${why.math ? `<div class="why-math">${esc(why.math)}</div>` : ''}
      <button class="why-link" onclick="event.stopPropagation();app.openConcept('explanations')">How recommenders explain themselves →</button></div></details>`;
  },
  openConcept(slug) {
    const a = this.concepts?.[slug]?.anchor;
    if (a && this.findBlock(a)) { this.openBlock(a, 'concept'); return; }
    // draft anchor, accepted satellites: open one of those
    const t = this.concepts?.[slug] && this._tellingPool(slug).find(b => this.findBlock(b.meta?.id));
    if (t) this.openBlock(t.meta.id, 'concept');
  },

  // ---------------------------------------------------------------- Browse helpers
  _homeHero(take) {
    const u = this.user;
    if (!u.readBlocks.size) {
      const target = u.getTargetFacets();
      const metas = this._conceptOrder().slice(0, 3).map(cid => this._bestTelling(cid, target)?.block?.meta).filter(Boolean);
      const firsts = take(metas, 3);
      if (!firsts.length) return '';
      const mins = firsts.reduce((s, m) => s + (m.readingTime || 3), 0);
      return this.shelf('Start here', firsts.map((m, i) => this.cardHtml(m, i === 0,
        { reasons: [i === 0 ? 'Where the book starts' : `Step ${i + 1} of the opening path through Chapter 1`] })),
        `Three short sections, about ${mins} minutes — then the book suggests what fits you.`);
    }
    const id = this.user.currentBlock && !this.user.readBlocks.has(this.user.currentBlock) ? this.user.currentBlock : this.getContinueBlock()?.id;
    const b = id && this.findBlock(id);
    if (!b) return '';
    const [m] = take([b.meta], 1);
    if (!m) return '';
    return this.shelf('Continue reading', [this.cardHtml(m, true, { reasons: ['Where you left off'] })], this._todayLine());
  },
  _pendingShelf(key, title) {
    const sk = '<div class="card card-skeleton" aria-hidden="true"><div></div><div></div><div></div></div>';
    return `<section class="shelf shelf-pending" id="home-async-${key}" aria-busy="true">
      <div class="shelf-head"><h3 class="shelf-title">${title}</h3></div>
      <div class="shelf-wrap"><div class="shelf-scroll">${sk + sk + sk}</div></div></section>`;
  },
  _settleShelf(key, token, title, cards, sub) {
    if (token !== this._homeToken) return;              // a newer Browse render owns the page
    const el = document.getElementById('home-async-' + key);
    if (!el) return;
    if (!cards.length) { el.remove(); return; }
    el.outerHTML = this.shelf(title, cards, sub);
    this._updateShelfArrows();
  },
  // The three network shelves fill in when (and only if) their requests come back.
  _fillHomeAsync(token, shown, lastReadBlock) {
    const take = (list, max) => {
      const out = [];
      for (const m of list) { if (!m?.id || shown.has(m.id)) continue; shown.add(m.id); out.push(m); if (out.length >= max) break; }
      return out;
    };
    const blocksOf = res => (res?.recomms || []).map(r => this.findBlock(r.id)?.meta).filter(Boolean);
    const personal = this.rc.getRecsForUser('homepage-personal', 8, this.rc.reql({ type: 'spine' }), this.rc.reqlBoost(this.user))
      .then(res => this._settleShelf('rcPersonal', token, 'Picked for you',
        take(blocksOf(res), 8).map(m => this.cardHtml(m, false, { reasons: ['Picked by Recombee’s “homepage-personal” scenario from what you read, liked and steered'] })),
        'Collaborative filtering at work: readers with a history like yours read these.'))
      .catch(() => this._settleShelf('rcPersonal', token, '', []));
    if (lastReadBlock) {
      const t = lastReadBlock.meta.title || '';
      this.rc.getRecsForItem(lastReadBlock.meta.id, 8, this.rc.reql({ type: 'spine' }), 'context-related')
        .then(res => {
          const list = blocksOf(res).filter(m => m.id !== lastReadBlock.meta.id && !this.user.readBlocks.has(m.id));
          const cards = take(list, 8);
          this._settleShelf('rcRelated', token, 'Because you read: ' + esc(t),
            cards.length >= 3 ? cards.map(m => this.cardHtml(m, false, { reasons: [`Readers of “${t}” also read this (item-to-item recommendation)`] })) : []);
        })
        .catch(() => this._settleShelf('rcRelated', token, '', []));
    }
    if (this._f('community') && this.user.readerMode === 'open') {
      this.rc.listCommunityBlocks(null, 8).then(shared => {
        const cards = (shared || []).map(b => {
          const m = b.meta;
          const line = this._tellingWords(m);
          return `<div class="card card-community" onclick="app.openCommunityBlock('${esc(m.id)}')">
            <div class="card-chapter card-kicker-warn">⚡ Written with a reader · not yet editor-verified</div>
            <div class="card-title">${esc(m.title || m.id)}</div>
            <div class="card-teaser">${line ? esc(line) + ' · ' : ''}shared by ${esc(m.sharedAs || 'a reader')}</div>
          </div>`;
        });
        this._settleShelf('community', token, 'From fellow readers 🌱', cards);
      }).catch(() => this._settleShelf('community', token, '', []));
    }
    return personal;
  },
  // Frontier shelves: the next unread ideas, each shown as ALL its tellings
  // (tl;dr, story, comic, other worlds) — the book's variety, sorted by fit.
  _frontierShelves(take) {
    const target = this.user.getTargetFacets();
    const lang = target.lang || 'en';
    let html = '', n = 0;
    for (const p of this._nextPicks({ limit: 10 })) {
      if (n >= 2) break;
      const c = this.concepts[p.cid];
      const pool = (this.conceptBlocks?.[p.cid] || []).filter(b => b.meta.type === 'spine' && this._covers(b.meta, 'lang', lang))
        .map(b => ({ m: b.meta, s: this._facetMatch(b.meta, target) })).sort((a, b) => b.s - a.s).map(x => x.m);
      if (pool.length < 3) continue;
      const metas = take(pool, 8);
      if (metas.length < 2) continue;
      html += this.shelf(`One idea, ${pool.length} ways: ${esc(c.title)}`, metas.map(m => this.cardHtml(m, false,
        { reasons: [`One of ${pool.length} tellings of “${c.title}”`, this._tellingWords(m) || 'the main telling'] })),
        'Same idea, told differently — pick the one that suits you.');
      n++;
    }
    return html;
  },

  // ---------------------------------------------------------------- section menu & sheets
  _openSheet(innerHtml, label) {
    this._closeSheet();
    const wrap = document.createElement('div');
    wrap.className = 'ux-sheet-wrap';
    wrap.id = 'uxSheet';
    wrap.innerHTML = `<div class="ux-sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">${innerHtml}</div>`;
    wrap.addEventListener('click', e => { if (e.target === wrap) this._closeSheet(); });
    document.body.appendChild(wrap);
    this._sheetKey = e => { if (e.key === 'Escape') this._closeSheet(); };
    document.addEventListener('keydown', this._sheetKey);
    setTimeout(() => wrap.querySelector('button')?.focus(), 30);
  },
  _closeSheet() {
    document.getElementById('uxSheet')?.remove();
    if (this._sheetKey) document.removeEventListener('keydown', this._sheetKey);
    this._sheetKey = null;
  },
  _reveal(id) {
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion() ? 'instant' : 'smooth', block: 'nearest' }), 60);
  },
  openBlockMenu(blockId) {
    const b = this._findAnyBlock(blockId);
    if (!b) return;
    const item = (icon, label, sub, js) => `<button class="sheet-item" onclick="app._closeSheet();${js}">
      <span class="sheet-icon" aria-hidden="true">${icon}</span><span class="sheet-text"><b>${label}</b><small>${sub}</small></span></button>`;
    const h = `<div class="sheet-title">${esc(b.meta.title || '')}</div>
      ${item('💬', 'Ask the book', 'Your question, answered from the book’s own concept summaries', `app.askAboutBlock('${blockId}')`)}
      ${item('📝', 'Add a note', 'Private, kept on this device', `app.toggleNote('${blockId}');app._reveal('note-${blockId}')`)}
      ${item('🔗', 'Copy link', 'Share this section', `app.shareBlock('${blockId}')`)}
      ${item('✏️', 'Improve this section', 'Edit a passage yourself, or let AI suggest a rewrite', `app.improveBlock('${blockId}')`)}
      ${item('✍️', 'Write your own telling', 'Open the author studio for this idea', `app.startAuthoringFromBlock('${blockId}')`)}
      ${item('⚑', 'Report an issue', 'Typo, unclear passage or wrong fact — goes to the authors', `app.flagBlock('${blockId}');app._reveal('flag-${blockId}')`)}
      <button class="sheet-cancel" onclick="app._closeSheet()">Close</button>`;
    this._openSheet(h, 'Section actions');
  },
  // Mini-board on phones: a pill that opens the board in a sheet
  openMiniSheet() {
    const board = document.querySelector('#miniBoard .mb-board')?.innerHTML || '';
    const { read, total } = this._conceptProgress();
    this._openSheet(`<div class="sheet-title">Your journey · ${read} of ${total} concepts read</div>
      <div class="mb-sheet-board">${board}</div>
      <p class="sheet-note">Filled fields are concepts you have read; the ringed one is where the book suggests you continue.</p>
      <button class="btn-primary sheet-primary" onclick="app._closeSheet();app._mapReturnToRead=true;app.switchView('map');app.setMapMode('cesta')">Open the journey map</button>
      <button class="sheet-cancel" onclick="app._closeSheet()">Close</button>`, 'Your journey');
  },

  // ---------------------------------------------------------------- reading progress strip
  _initReadProgress() {
    if (document.getElementById('readProgress')) return;
    const bar = document.createElement('div');
    bar.id = 'readProgress';
    bar.className = 'read-progress';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<span></span>';
    document.body.appendChild(bar);
    let raf = 0;
    const update = () => {
      raf = 0;
      if (this.currentView !== 'read') { bar.classList.remove('on'); return; }
      const line = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 52) + window.innerHeight * 0.3;
      let frac = null;
      for (const a of document.querySelectorAll('#readPane .block-article')) {
        if (a.offsetParent === null) continue;
        const r = a.getBoundingClientRect();
        if (r.top <= line && r.bottom >= line) { frac = Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height - window.innerHeight * 0.4))); break; }
      }
      bar.classList.toggle('on', frac !== null);
      if (frac !== null) bar.firstChild.style.transform = `scaleX(${frac.toFixed(3)})`;
    };
    let idle = 0;
    window.addEventListener('scroll', () => {
      if (!raf) raf = requestAnimationFrame(update);
      // phones: the journey pill steps aside while the reader scrolls
      const mb = document.getElementById('miniBoard');
      if (mb && window.innerWidth < 1100) {
        mb.classList.add('mb-hide');
        clearTimeout(idle);
        idle = setTimeout(() => mb.classList.remove('mb-hide'), 900);
      }
    }, { passive: true });
  },

  // ---------------------------------------------------------------- progress
  _conceptProgress() {
    const ids = Object.keys(this.concepts || {});
    if (!ids.length) { const p = this.user.getProgress(this.allBlocks || []); return { read: p.read, total: p.total, unit: 'sections' }; }
    const key = this.user.readBlocks.size + ':' + ids.length;
    if (this._cpKey !== key) { this._cpKey = key; this._cpRead = ids.filter(c => this._cRead(c)).length; }
    return { read: this._cpRead, total: ids.length, unit: 'concepts' };
  },
  _ringSvg(frac, size = 18) {
    const r = size / 2 - 2, c = 2 * Math.PI * r;
    return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="2.5"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
        stroke-dasharray="${(c * frac).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  },
  // Chapter complete / concept newly read. Compared against a saved snapshot so a
  // moment fires exactly once — and never retroactively for an existing reader.
  _checkProgressMoments() {
    if (!this.concepts || !this.book) return;
    const doneNow = Object.keys(this.concepts).filter(c => this._cRead(c));
    let st = null;
    try { st = JSON.parse(localStorage.getItem('pbook-moments') || 'null'); } catch (e) {}
    const chapterDone = ch => {
      const cs = Object.values(this.concepts).filter(c => c.chapter === ch.id).map(c => c.id);
      return cs.length > 0 && cs.every(c => doneNow.includes(c));
    };
    const chaptersNow = this.book.chapters.filter(chapterDone).map(c => c.id);
    if (!st) { st = { concepts: doneNow, chapters: chaptersNow }; try { localStorage.setItem('pbook-moments', JSON.stringify(st)); } catch (e) {} return; }
    const knownC = new Set(st.concepts || []);
    this._justRead = new Set(doneNow.filter(c => !knownC.has(c)));
    const fresh = chaptersNow.find(id => !(st.chapters || []).includes(id));
    st.concepts = doneNow;
    st.chapters = [...new Set([...(st.chapters || []), ...chaptersNow])];
    try { localStorage.setItem('pbook-moments', JSON.stringify(st)); } catch (e) {}
    if (fresh) this._showChapterMoment(this.book.chapters.findIndex(c => c.id === fresh));
  },
  _showChapterMoment(ci) {
    const ch = this.book.chapters[ci];
    if (!ch) return;
    const next = this.book.chapters[ci + 1];
    const cs = Object.values(this.concepts).filter(c => c.chapter === ch.id);
    const checks = cs.filter(c => c.contract?.recallQ && c.contract?.recallA).slice(-3);
    const clean = s => String(s || '').replace(/\\"/g, '"');
    const html = `<div class="moment-card fade-up" role="status">
      <div class="moment-kicker">Chapter ${ch.number} complete ✓</div>
      <h3 class="moment-title">${esc(ch.title)}</h3>
      <div class="moment-concepts">${cs.map(c => `<span class="moment-chip">✓ ${esc(c.title)}</span>`).join('')}</div>
      ${checks.length ? `<div class="moment-checks"><div class="moment-label">Three quick checks — answer in your head, then peek</div>
        ${checks.map(c => `<details class="moment-check"><summary>${esc(clean(c.contract.recallQ))}</summary><p>${esc(clean(c.contract.recallA))}</p></details>`).join('')}</div>` : ''}
      <div class="moment-actions">
        ${next ? `<button class="btn-primary" onclick="this.closest('.moment-card').remove();app.goChapter(${ci + 1})">Next: Chapter ${next.number} · ${esc(next.title)} →</button>
          <span class="moment-next-sub">${esc(next.subtitle || '')}</span>` : '<b>That was the last chapter. 🎉</b>'}
        <button class="steer-chip" onclick="this.closest('.moment-card').remove()">Keep reading here</button>
      </div></div>`;
    const lastId = [...this.user.readBlocks].pop();
    const anchor = (lastId && (document.getElementById('rn-' + lastId) || document.getElementById('b-' + lastId))) || null;
    if (anchor && this.currentView === 'read') anchor.insertAdjacentHTML('afterend', html);
    this.showXPToast(`Chapter ${ch.number} complete ✓`, 'info');
    this.rc.logEvent('chapter_complete', { chapter: ch.id });
  },
  // Profile: ideas the reader can demonstrably explain (recall answered well, not due)
  _conceptBadgesHtml() {
    if (!this.concepts) return '';
    const can = Object.values(this.concepts).filter(c => this._conceptRemembered(c.id));
    return `<div class="profile-section"><h3>🧠 Ideas you can explain</h3>${can.length
      ? `<div class="gami-badges">${can.map(c => `<button class="gami-badge earned" onclick="app.openConcept('${c.id}')">✓ ${esc(c.title)}</button>`).join('')}</div>`
      : '<p class="profile-hint">Answer a concept’s recall card well twice and it lands here — proof you can explain it, not just that you scrolled past it.</p>'}</div>`;
  },

  // Profile: the secondary sections (wallet, XP rules, editor track, invites) fold
  // into one-line <details> so reading progress and preferences come first.
  _foldProfile(root) {
    const FOLD = /AI wallet|How to earn XP|Editor track|Invite friends/;
    root.querySelectorAll(':scope > .profile-section, .profile-section').forEach(sec => {
      const h = sec.querySelector(':scope > h3');
      if (!h || !FOLD.test(h.textContent) || sec.closest('details')) return;
      const d = document.createElement('details');
      d.className = sec.className + ' profile-fold';
      const sum = document.createElement('summary');
      sum.innerHTML = h.innerHTML;
      h.remove();
      d.appendChild(sum);
      while (sec.firstChild) d.appendChild(sec.firstChild);
      sec.replaceWith(d);
    });
  },

  // ---------------------------------------------------------------- journey labels
  // Wrap a short label onto at most two SVG lines (the board used to cut words mid-way)
  _svgLabel(text, x, y, attrs = '', max = 14) {
    const w = String(text || '').split(/\s+/);
    const lines = [''];
    for (const word of w) {
      const cur = lines[lines.length - 1];
      if (!cur) lines[lines.length - 1] = word;
      else if ((cur + ' ' + word).length <= max) lines[lines.length - 1] = cur + ' ' + word;
      else if (lines.length < 2) lines.push(word);
      else { lines[1] = (lines[1] + ' ' + word).slice(0, max - 1) + '…'; break; }
    }
    return `<text x="${x}" y="${y}" text-anchor="middle" ${attrs}>${lines.map((l, i) => `<tspan x="${x}" dy="${i ? '1.15em' : 0}">${esc(l)}</tspan>`).join('')}</text>`;
  },

  // ---------------------------------------------------------------- theme
  _themeChoice() { return localStorage.getItem('pbook-theme') || 'auto'; },
  _applyThemeChoice() {
    const t = this._themeChoice();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const eff = t === 'auto' ? (mq.matches ? 'dark' : '') : (t === 'light' ? '' : t);
    if (eff) document.documentElement.setAttribute('data-theme', eff);
    else document.documentElement.removeAttribute('data-theme');
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute('content', eff === 'dark' ? '#171412' : '#FAFAF7');
    if (!this._themeMq) { this._themeMq = mq; mq.addEventListener?.('change', () => { if (this._themeChoice() === 'auto') this._applyThemeChoice(); }); }
    document.querySelectorAll('[data-theme-opt]').forEach(b => b.classList.toggle('active', b.dataset.themeOpt === t));
  },

  // ---------------------------------------------------------------- accessibility
  // Icon-only buttons (emoji, ✕, ‹ ›) get their title as an accessible name.
  _a11yInit() {
    if (this._a11yObs) return;
    const label = root => {
      root.querySelectorAll?.('button:not([aria-label])').forEach(b => {
        const t = (b.textContent || '').trim();
        if (/[A-Za-zÀ-ž0-9]{2,}/.test(t)) return;
        const name = b.getAttribute('title') || (t === '×' || t === '✕' ? 'Close' : t === '‹' ? 'Scroll left' : t === '›' ? 'Scroll right' : '');
        if (name) b.setAttribute('aria-label', name);
      });
    };
    label(document);
    let pending = false;
    this._a11yObs = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; label(document); });
    });
    this._a11yObs.observe(document.body, { childList: true, subtree: true });
  },
};

export function installUx(cls) {
  Object.assign(cls.prototype, uxMethods);
}
