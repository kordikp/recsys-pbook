// p-book v3: Adaptive UX with Netflix home, map, search, feedback, Recombee-powered

import { CONFIG } from './config.js';
import { renderMarkdown, parseFrontmatter } from './markdown.js';
import { RecombeeClient, UserModel } from './recombee.js?v=11';
import { getDiagram, DIAGRAM_FILES } from './diagrams.js?v=3';

const APP_VERSION = '5.12.3';
import { MockTutorEngine, ConversationManager } from './tutor.js';

class PBook {
  constructor() {
    this.book = null;
    this.chapters = {};
    this.allBlocks = [];
    this.rc = new RecombeeClient();
    this.user = new UserModel();
    this.currentView = 'home';
    this.feedbackTimeout = null;
    this.topicIndex = {};  // topic → [blockIds]
    this.blockTopics = {}; // blockId → [topics]
    this.tutor = new MockTutorEngine();
    this.convManager = new ConversationManager();
    this._activeConvId = null;
  }

  // Feature toggle helper
  _f(name) { return CONFIG.features[name] !== false;
  }

  // ===== INIT =====
  async init() {
    // Demo seeding for screenshots/booth mode: ?seed=demo populates a plausible
    // reading history once (12 read blocks, recall cards due, XP) — never in normal use.
    if (location.search.includes('seed=demo') && !localStorage.getItem('pbook-demo-seeded')) {
      localStorage.setItem('pbook-demo-seeded', '1');
      const ids = ['ch1-noticed','ch1-everywhere','ch1-not-magic','ch1-wrong-sidebar','ch1-patterns-d-think','ch1-history','ch1-three-jobs','ch1-wyr','ch1-personalization-spectrum','ch1-ws-match','ch2-footprints','ch2-track-d-exp'];
      const now = Date.now();
      const recall = {};
      ids.slice(0, 8).forEach((id, i) => { recall[id] = { reps: (i % 3) + 1, ease: 1.6 + (i % 4) * 0.35, interval: 1, nextReview: now - (i < 5 ? 3600000 * (i + 1) : -86400000), lastReview: now - 86400000 }; });
      localStorage.setItem('pbook-user', JSON.stringify({
        readBlocks: ids, seenBlocks: ids, savedBlocks: ['ch2-clues'], ratings: [], notes: [],
        signals: {}, totalInteractions: 40, currentChapter: 1, xp: 175, level: 4,
        achievements: [{ id: 'first_read' }, { id: 'reader_5' }], recall,
        completedMissions: ['m1'], missionTitles: { m1: 'The Curious Beginning' },
        facetAffinity: { lens: { ecommerce: 4 }, depth: { standard: 3 } }, steerPrefs: {}, goal: 'understand', readerMode: 'open',
      }));
      this.user.load();   // UserModel was constructed before init — re-read the seeded state
    }

    // Living book defaults ON; readers who explicitly chose safe keep their choice
    if (this.user.readerMode === 'safe' && !localStorage.getItem('pbook-mode-chosen')) {
      this.user.readerMode = 'open';
      this.user.save();
    }

    // Invite links: ?invite=R-xxxx (friend referral, +25 XP welcome) or ?invite=E-xxxx
    // (editor invite for senior collaborators: sets the 🛠 editor role, opens the console).
    const inviteMatch = location.search.match(/[?&]invite=([\w-]+)/);
    if (inviteMatch && !localStorage.getItem('pbook-invite-used')) {
      const code = inviteMatch[1];
      localStorage.setItem('pbook-invite-used', code);
      if (/^E-/i.test(code)) {
        localStorage.setItem('pbook-role', 'editor');
        this.rc.logEvent('editor_invite_accepted', { code });
        setTimeout(() => this.showXPToast('🛠 Welcome to the editorial team — your console is in Profile', 'achievement'), 1500);
      } else {
        this.rc.logEvent('invite_accepted', { code });
        if (this._f('gamification')) { this.user.addXP(25); this.user.save(); }
        setTimeout(() => this.showXPToast('🎁 +25 XP — a friend invited you. Welcome!', 'achievement'), 1500);
      }
    }
    try {
      this.book = await (await fetch(CONFIG.book.bookIndex)).json();
    } catch (e) {
      document.body.innerHTML = '<div style="padding:3em;text-align:center;font-family:sans-serif;color:#888">Could not load book. Run <code>./serve.sh</code> first.</div>';
      return;
    }
    // Preload all content for search and map
    await this.loadAllContent();
    this.autoTagBlocks();
    await this.loadConcepts();   // concept index + contracts (graceful if missing)
    await this._loadProposals(); // concept proposals under interest testing (ghost items)
    console.info('[pbook] app', APP_VERSION);
    this._loadPrivateBlocks();   // reader's own generated variants (private until shared)
    this._loadOverrides();       // accepted remixes: originalId → your version (persistent)
    this._checkAdoptions();      // shared telling merged into the book? → +100 XP, editor track
    this.rc.setAllBlocks(this.allBlocks);
    this.rc._loadInteractions(); // Restore persisted interactions

    // Load feature toggles
    this._loadFeatureToggles();

    // Sync user profile to Recombee
    if (this.rc.enabled) {
      const prog = this.user.getProgress(this.allBlocks);
      const coreBlocks = this.allBlocks.filter(b => b.meta.core);
      const coreRead = coreBlocks.filter(b => this.user.readBlocks.has(b.meta.id)).length;
      this.rc.setUserProperties({
        voice: this.user.preferredVoice || 'universal',
        level: this.user.level,
        xp: this.user.xp,
        readCount: prog.read,
        readPct: prog.pct,
        coreRead,
        coreTotal: coreBlocks.length,
        sessions: this.user.sessionCount,
        completedMissions: (this.user.completedMissions || []).length,
        activePath: this.user.activePath || '',
        // Facet profile (P0) — lets Recombee scenarios boost by facet affinity
        prefLens: this.user.getTargetFacets().lens,
        prefDepth: this.user.getTargetFacets().depth,
        prefVisuality: this.user.getTargetFacets().visuality,
        goal: this.user.goal || '',
        readerMode: this.user.readerMode || 'safe',
      });
    }

    // Detect stale data: if readBlocks has IDs that don't exist in allBlocks, reset
    if (this.user.readBlocks.size > 0) {
      const validIds = new Set(this.allBlocks.map(b => b.meta.id));
      const stale = [...this.user.readBlocks].filter(id => !validIds.has(id));
      if (stale.length > this.user.readBlocks.size * 0.3) {
        // More than 30% of read IDs are invalid — data is from old version
        this.user.reset();
      }
    }

    // Check for deep link: #blockId or #mission-missionId
    const hash = window.location.hash?.substring(1);
    if (hash) {
      if (hash.startsWith('mission-')) {
        // Mission deep link
        const missionId = hash.replace('mission-', '');
        document.getElementById('onboarding').classList.add('hidden');
        this.updateXPBadge();
        this.switchView('glossary');
        this.showMission(missionId);
      } else if (hash === 'quiz') {
        document.getElementById('onboarding').classList.add('hidden');
        this.updateXPBadge();
        this.switchView('quiz');
      } else if (hash.startsWith('view-')) {
        // generic view deep link (screenshots, demos): #view-missions, #view-home, ...
        document.getElementById('onboarding').classList.add('hidden');
        this.updateXPBadge();
        this.switchView(hash.slice(5));
      } else if (hash === 'coverage') {
        // deep link to the living-book coverage map (also used for paper screenshots)
        document.getElementById('onboarding').classList.add('hidden');
        this.updateXPBadge();
        this._mapMode = 'coverage';
        this.switchView('map');
        setTimeout(() => document.querySelectorAll('.covmap-chapter-sec').forEach((d, i) => { if (i < 2) d.open = true; }), 1500);
      } else if (hash.startsWith('quiz-')) {
        // Single quiz card deep link — show in quiz view
        const blockId = hash.replace('quiz-', '');
        document.getElementById('onboarding').classList.add('hidden');
        this.updateXPBadge();
        this._sharedQuizBlock = blockId;
        this.switchView('quiz');
      } else if (this.findBlock(hash)) {
        // Block deep link — seed facet affinity from the landing block: an anonymous
        // arrival on a variant is a hint about which audience/telling fits them
        const landing = this.findBlock(hash);
        if (landing) this.user.updateFacetAffinity(this._blockFacets(landing.meta), 1);
        document.getElementById('onboarding').classList.add('hidden');
        this.updateXPBadge();
        this.openBlock(hash, 'share');
        this._sharedBlockId = hash;
      }
    }

    this.applyTheme();

    // Auto-restore session: fill displayName from cert-name if missing, sync Recombee identity
    const authRestore = this._getAuth();
    if (authRestore) {
      if (!authRestore.displayName) {
        const certName = localStorage.getItem('pbook-cert-name');
        if (certName) { authRestore.displayName = certName; this._setAuth(authRestore); }
      }
      // Ensure Recombee identity matches account
      const accountUid = 'acct-' + authRestore.email.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
      if (this.rc.userId !== accountUid) {
        this.rc.userId = accountUid;
        localStorage.setItem('pbook-uid', accountUid);
      }
    }

    // Customize welcome screen for returning users
    this._customizeWelcome();

    // Auto-sync for logged-in users: save every 2 minutes
    setInterval(() => {
      if (this._getAuth()) this.syncProfile().catch(() => {});
    }, 120000);
    // Also sync on page unload
    window.addEventListener('beforeunload', () => {
      const auth = this._getAuth();
      if (auth) {
        const blob = new Blob([JSON.stringify({
          action: 'save', email: auth.email, token: auth.token,
          profileData: this._collectProfileData(),
        })], { type: 'application/json' });
        navigator.sendBeacon?.(this._authEndpoint(), blob);
      }
    });
  }

  async loadAllContent() {
    for (let i = 0; i < this.book.chapters.length; i++) {
      const ch = this.book.chapters[i];
      const dir = `${CONFIG.book.contentDir}/${ch.directory}`;
      const blocks = await Promise.all(ch.files.map(async f => {
        try {
          const text = await (await fetch(`${dir}/${f}`)).text();
          const { meta, body } = parseFrontmatter(text);
          const seq = f.match(/^(\d+)([a-z]?)/);
          const sequence = seq ? parseInt(seq[1]) * 10 + (seq[2] ? seq[2].charCodeAt(0) - 96 : 0) : 999;
          return { ...meta, body, sequence, _chapter: ch.id, _chapterNum: ch.number, _chapterTitle: ch.title, meta: { ...meta, chapter: ch.id } };
        } catch (e) { return null; }
      }));
      const isAdmin = localStorage.getItem('pbook-admin') === '1';
      const valid = blocks.filter(b => b && (!b.status || b.status === 'accepted' || isAdmin)).sort((a, b) => a.sequence - b.sequence);
      this.chapters[i] = { ...ch, blocks: valid };
      valid.forEach(b => { b._chapterIdx = i; this.allBlocks.push({ meta: b, body: b.body, _chapter: ch.id }); });
    }
  }

  autoTagBlocks() {
    const TOPICS = {
      'Collaborative Filtering': ['collaborative filter', 'user-based cf', 'item-based cf'],
      'Matrix Factorization': ['matrix factor', 'svd', 'als ', 'latent factor', 'bpr'],
      'Deep Learning': ['deep learn', 'neural', 'transformer', 'attention mechanism', 'gru4rec', 'sasrec'],
      'Cold Start': ['cold start', 'cold-start', 'new user', 'new item', 'onboarding'],
      'Conversion & Revenue': ['conversion', 'revenue', 'roi ', 'monetiz', 'purchase', 'business impact'],
      'Engagement & Retention': ['engagement', 'ctr', 'click-through', 'session length', 'retention', 'churn'],
      'Diversity & Fairness': ['diversity', 'fairness', 'coverage', 'filter bubble', 'echo chamber', 'long tail'],
      'Search & Retrieval': ['search', 'query', 'retrieval', 'ann search', 'faiss', 'nearest neighbor'],
      'A/B Testing & Evaluation': ['a/b test', 'experiment', 'ndcg', 'evaluation', 'metric'],
      'Content-Based Filtering': ['content-based', 'text embed', 'image embed', 'beeformer'],
      'Bandits & Exploration': ['bandit', 'exploration', 'exploit', 'thompson sampling', 'ucb'],
      'Recombee Platform': ['recombee', 'reql', 'beeformer', 'scenario config', 'recombee:personal'],
      'Objectives & Strategy': ['objective', 'stakeholder', 'north star', 'multi-objective', 'alignment'],
      'Data & Signals': ['interaction data', 'item catalog', 'user catalog', 'feedback loop', 'implicit'],
      'Privacy & Ethics': ['privacy', 'gdpr', 'ethical', 'transparency', 'consent'],
    };
    this.allBlocks.forEach(b => {
      const text = ((b.meta.title || '') + ' ' + (b.body || '')).toLowerCase();
      const tags = [];
      for (const [topic, keywords] of Object.entries(TOPICS)) {
        if (keywords.some(kw => text.includes(kw))) tags.push(topic);
      }
      this.blockTopics[b.meta.id] = tags;
      tags.forEach(t => {
        if (!this.topicIndex[t]) this.topicIndex[t] = [];
        this.topicIndex[t].push(b.meta.id);
      });
    });
  }

  // ===== CONCEPTS & FACETS (see _design-collective-pbook.md) =====
  async loadConcepts() {
    this.concepts = {};        // conceptId → concept record (with contract)
    this.conceptBlocks = {};   // conceptId → [block refs from allBlocks]
    try {
      const data = await (await fetch(`${CONFIG.book.contentDir}/concepts.json`)).json();
      (data.concepts || []).forEach(c => { this.concepts[c.id] = c; });
    } catch (e) { /* concepts.json missing — steering degrades gracefully */ }
    this.allBlocks.forEach(b => {
      for (const cid of this._conceptIds(b.meta)) {
        if (!this.conceptBlocks[cid]) this.conceptBlocks[cid] = [];
        this.conceptBlocks[cid].push(b);      // multi-concept blocks appear in every pool
      }
    });
  }

  // Floating decision sheet — fixed to the viewport bottom so it CANNOT be missed,
  // whatever view the remix happened in. Removed on any decision.
  _showRemixDecision(originalId, remixId, oldText, newText, isDiagram) {
    document.getElementById('rxfloat')?.remove();
    const diff = (oldText && newText)
      ? `<div class="rx-diff"><div class="rx-old">− ${this.escHtml(oldText.slice(0, 140))}${oldText.length > 140 ? '…' : ''}</div>
         <div class="rx-new">+ ${this.escHtml(newText.slice(0, 140))}${newText.length > 140 ? '…' : ''}</div></div>` : '';
    const el = document.createElement('div');
    el.id = 'rxfloat';
    el.className = 'remix-float';
    el.innerHTML = `
      <div style="font-weight:700">✨ ${isDiagram ? 'New diagram ready' : 'Rewrite ready'} — it's a preview until you decide.</div>
      ${diff}
      <div style="display:flex;gap:.45em;flex-wrap:wrap;margin-top:.35em">
        <button class="steer-chip" style="border-color:#10B981;color:#065F46;font-weight:700" onclick="app._decideRemix('${originalId}','${remixId}','accept')">✓ Accept</button>
        <button class="steer-chip" style="border-color:var(--accent);color:var(--accent);font-weight:700" onclick="app._decideRemix('${originalId}','${remixId}','share')">✓ Accept &amp; share</button>
        <button class="steer-chip" style="opacity:.85" onclick="app._decideRemix('${originalId}','${remixId}','discard')">✗ Discard</button>
      </div>`;
    document.body.appendChild(el);
  }
  _decideRemix(originalId, remixId, what) {
    document.getElementById('rxfloat')?.remove();
    if (what === 'discard') return this.discardRemix(originalId, remixId);
    this.acceptRemix(originalId, remixId, what === 'share');
  }

  // ===== ACCEPTED REMIXES: persistent per-reader overrides =====
  // When the reader ACCEPTS a remix, their version replaces the original in THEIR
  // book (same block id → progress/recall untouched). Highlights stay visible;
  // revert is one click. Store: { originalId: remixBlockId }.
  _loadOverrides() {
    try { this._overrides = JSON.parse(localStorage.getItem('pbook-block-overrides') || '{}'); }
    catch (e) { this._overrides = {}; }
    // drop overrides whose private block vanished
    for (const [orig, rid] of Object.entries(this._overrides)) {
      if (!this.privateBlocks?.[rid]) delete this._overrides[orig];
    }
  }
  _saveOverrides() {
    try { localStorage.setItem('pbook-block-overrides', JSON.stringify(this._overrides || {})); } catch (e) {}
  }

  async acceptRemix(originalId, remixId, share) {
    const isGitOriginal = !!this.findBlock(originalId);
    if (isGitOriginal) {
      if (!this._overrides) this._overrides = {};
      this._overrides[originalId] = remixId;
      this._saveOverrides();
      const off = this._overridesOff();
      if (off.delete(originalId)) { try { localStorage.setItem('pbook-overrides-off', JSON.stringify([...off])); } catch (e) {} }
      await this._rerenderBlockInPlace(originalId, remixId);   // consent attaches AFTER the swap settles
    }
    // remix of a generated/community telling: the variant stays on screen as-is
    this.rc.logEvent('remix_accepted', { blockId: originalId, remixId, share: !!share });
    if (this._f('gamification')) { this.user.addXP(5); this.user.save(); this.updateXPBadge(); }
    if (share) {
      this._showShareConsent(remixId);
      this.showXPToast('+5 XP ✨ Accepted — pick a name (or stay anonymous) to share it', 'achievement');
    } else {
      this.showXPToast('+5 XP ✨ Your version is now part of your book (revert anytime)', 'achievement');
    }
  }

  discardRemix(originalId, remixId) {
    if (this.privateBlocks?.[remixId]) {
      delete this.privateBlocks[remixId];
      try { localStorage.setItem('pbook-private-blocks', JSON.stringify(this.privateBlocks)); } catch (e) {}
    }
    if (this._overrides?.[originalId] === remixId) { delete this._overrides[originalId]; this._saveOverrides(); }
    this.rc.logEvent('remix_discarded', { blockId: originalId, remixId });
    this._rerenderBlockInPlace(originalId, remixId);
  }

  // "Show original" is a reversible TOGGLE — your edited version stays saved.
  _overridesOff() {
    try { return new Set(JSON.parse(localStorage.getItem('pbook-overrides-off') || '[]')); } catch (e) { return new Set(); }
  }
  toggleOverride(originalId) {
    const off = this._overridesOff();
    if (off.has(originalId)) off.delete(originalId); else off.add(originalId);
    try { localStorage.setItem('pbook-overrides-off', JSON.stringify([...off])); } catch (e) {}
    this.rc.logEvent('remix_toggled', { blockId: originalId, showing: off.has(originalId) ? 'original' : 'override' });
    this._rerenderBlockInPlace(originalId, this._overrides?.[originalId]);
  }
  // Permanent discard — the only irreversible action, and it says so.
  discardOverride(originalId) {
    if (!window.confirm('Permanently discard your edited version of this section? This cannot be undone.')) return;
    const rid = this._overrides?.[originalId];
    if (rid && this.privateBlocks?.[rid]) {
      delete this.privateBlocks[rid];
      try { localStorage.setItem('pbook-private-blocks', JSON.stringify(this.privateBlocks)); } catch (e) {}
    }
    if (rid) { delete this._overrides[originalId]; this._saveOverrides(); }
    const off = this._overridesOff(); off.delete(originalId);
    try { localStorage.setItem('pbook-overrides-off', JSON.stringify([...off])); } catch (e) {}
    this.rc.logEvent('remix_discarded', { blockId: originalId, remixId: rid, fromOverride: true });
    this._rerenderBlockInPlace(originalId, rid);
  }

  // Replace whichever article is on screen for this logical block with a fresh
  // render of the (possibly overridden) original — observer re-registered.
  async _rerenderBlockInPlace(originalId, variantId) {
    const el = document.getElementById(`b-${originalId}`)
      || (variantId && document.getElementById(`b-${variantId}`))
      || (this._slotDom?.[originalId] && document.getElementById(`b-${this._slotDom[originalId]}`));
    if (!el) return;
    const fb = this.findBlock(originalId);
    if (!fb) return;
    const gitBlock = { ...fb.meta, body: fb.body };   // renderSpine expects a FLAT block
    el.outerHTML = await this.renderSpine(gitBlock);
    if (this._slotDom) this._slotDom[originalId] = originalId;
    const fresh = document.getElementById(`b-${originalId}`);
    if (fresh && this._observer) { fresh.dataset.observed = '1'; this._observer.observe(fresh); }
    this.renderMath?.();
  }

  // A block may be a telling of SEVERAL concepts ("concept: a|b") — e.g. a cold-start
  // story that also teaches exploration. First listed = primary (panel title, chapter).
  _conceptIds(meta) {
    return String(meta?.concept || '').split('|').map(s => s.trim()).filter(Boolean);
  }

  // Extract the facet-vector of a block (works for git content and generated blocks)
  _blockFacets(meta) {
    if (!meta) return null;
    const f = {};
    for (const k of Object.keys(CONFIG.facets)) { if (meta[k]) f[k] = meta[k]; }
    return Object.keys(f).length ? f : null;
  }

  _facetDefault(dim) {
    return { lens: 'generic', lang: 'en', visuality: 'text-first', depth: 'standard', formalism: 'none', lengthBand: 'standard', genre: 'explainer' }[dim] || null;
  }

  // SUBSPACE COVERAGE (spec: dimensions are not orthogonal; a telling covers a
  // region, not a point). Parse a block's declared coverage on one dimension:
  //   "standard"              → [standard]
  //   "standard..technical"   → [standard, technical]      (range on ordered scales)
  //   "ecommerce|media"       → [ecommerce, media]         (set on categorical ones)
  _facetValues(meta, dim) {
    const vals = CONFIG.facets[dim]?.values || [];
    const raw = meta?.[dim];
    if (!raw) { const d = this._facetDefault(dim); return d ? [d] : []; }
    const s = String(raw);
    if (s.includes('..')) {
      const [a, b] = s.split('..').map(x => x.trim());
      const i = vals.indexOf(a), j = vals.indexOf(b);
      if (i >= 0 && j >= i) return vals.slice(i, j + 1);
    }
    const set = s.split('|').map(x => x.trim()).filter(x => vals.includes(x));
    return set.length ? set : (this._facetDefault(dim) ? [this._facetDefault(dim)] : []);
  }

  // Does this block's declared subspace cover the target value on a dimension?
  _covers(meta, dim, value) { return this._facetValues(meta, dim).includes(value); }

  // Facet match score 0..1 between a block's SUBSPACE and a target point.
  // lens and language dominate (most audience-defining), depth/visuality next.
  _facetMatch(meta, target) {
    const W = { lens: 3, lang: 3, depth: 2, visuality: 2, formalism: 1, lengthBand: 0.5, genre: 1, carriers: 1.5 };
    let score = 0, max = 0;
    for (const [facet, w] of Object.entries(W)) {
      if (!target[facet]) continue;
      max += w;
      const set = this._facetValues(meta, facet);
      if (!set.length) { score += w * 0.4; continue; }        // unknown → mild partial credit
      const wanted = String(target[facet]).split('|').filter(Boolean);
      if (wanted.length > 1) {                                  // multi-value target (carriers): fraction present
        score += w * (wanted.filter(v => set.includes(v)).length / wanted.length);
        continue;
      }
      if (set.includes(target[facet])) { score += w; continue; }  // covered → full credit
      if (facet === 'lens' && set.includes('generic')) { score += w * 0.6; continue; } // generic serves any world, imperfectly
      // ordered scales: distance from target to the nearest edge of the covered range
      const order = CONFIG.facets[facet]?.values || [];
      const ti = order.indexOf(target[facet]);
      const d = Math.min(...set.map(v => Math.abs(order.indexOf(v) - ti)));
      if (d === 1) score += w * 0.5;
    }
    return max ? score / max : 0;
  }

  // ===== STEERING (knobs + retrieve-before-generate, spec §5) =====

  // Private generated blocks — visible only to this reader until shared
  _loadPrivateBlocks() {
    try { this.privateBlocks = JSON.parse(localStorage.getItem('pbook-private-blocks') || '{}'); }
    catch (e) { this.privateBlocks = {}; }
    // Honest-visuality sweep: blocks stored before the server-side clamp may carry the
    // REQUESTED visuality ("visual-first" with zero visuals). Re-derive from what the
    // block actually contains; deletion test, same rules as api/generate.js.
    let fixed = 0;
    for (const b of Object.values(this.privateBlocks)) {
      const honest = this._honestVisuality(b.meta, b.body);
      if (honest !== b.meta.visuality) { b.meta.visuality = honest; fixed++; }
    }
    if (fixed) { try { localStorage.setItem('pbook-private-blocks', JSON.stringify(this.privateBlocks)); } catch (e) {} }
  }

  // What can this block's visuality HONESTLY claim? (client mirror of the server clamp)
  _honestVisuality(meta, body) {
    const words = (body || '').split(/\s+/).filter(Boolean).length;
    const hasSvg = !!meta.diagramSvg || /<svg/i.test(body || '');
    const hasImg = /!\[/.test(body || '') || !!meta.diagram;
    const hasTable = /\n\|[^\n]*\|\s*\n\|[\s:|-]+\|/.test(body || '');
    if (hasSvg || hasImg) return words < 130 ? 'visual-first' : 'balanced';
    if (hasTable) return meta.visuality === 'text-first' ? 'text-first' : 'balanced';
    return 'text-first';
  }
  // Durable archive: localStorage is device-local and easy to lose; every created
  // or changed block also lands in Supabase (via /api/log) so editors can see what
  // readers are actually making — and nothing dies with a cleared browser.
  _archiveBlock(block, action) {
    try {
      const m = block.meta || {};
      fetch('/api/log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'content', event: 'block_saved', ts: Date.now(), userId: this.rc.userId,
          action,                                        // generated | remixed | manual-edit | accepted | shared
          blockId: m.id, concept: m.concept || '', remixOf: m.remixOf || '',
          title: (m.title || '').slice(0, 200), state: m.state || 'private',
          facets: { lens: m.lens, lang: m.lang, genre: m.genre, depth: m.depth, visuality: m.visuality, lengthBand: m.lengthBand, carriers: m.carriers },
          remixLog: (m.remixLog || []).slice(-5),
          body: (block.body || '').slice(0, 20000),
          svg: (m.diagramSvg || '').slice(0, 40000),
        }),
      }).catch(() => {});
    } catch (e) {}
  }

  _savePrivateBlock(block, action) {
    if (!this.privateBlocks) this.privateBlocks = {};
    this.privateBlocks[block.meta.id] = block;
    try { localStorage.setItem('pbook-private-blocks', JSON.stringify(this.privateBlocks)); } catch (e) {}
    this._archiveBlock(block, action || (block.meta.remixLog?.length ? 'remixed' : 'generated'));
  }

  // The variant pool for a concept: git blocks + own private + community (open mode, cached)
  _conceptPool(conceptId) {
    const pool = [...(this.conceptBlocks[conceptId] || [])];
    for (const pb of Object.values(this.privateBlocks || {})) {
      if (this._conceptIds(pb.meta).includes(conceptId)) pool.push(pb);
    }
    if (this._communityCache?.[conceptId]) {
      pool.push(...this._communityCache[conceptId]);
    }
    return pool;
  }

  // Lazily fetch community variants for a concept (open mode only; graceful empty)
  async _fetchCommunity(conceptId) {
    if (!this._f('community')) return [];
    if (!this._communityCache) this._communityCache = {};
    if (this._communityCache[conceptId]) return this._communityCache[conceptId];
    // Adopted runtime tellings (edited/core) serve to EVERYONE — an editor
    // verified them; raw community stays behind open mode.
    const states = this.user.readerMode === 'open' ? ['community', 'edited', 'core'] : ['edited', 'core'];
    const items = await this.rc.listCommunityBlocks(conceptId, 10, states);
    this._communityCache[conceptId] = items;
    return items;
  }

  // Slim indicator at the top of a block: how many other tellings exist, click to see them
  _renderTellingsIndicator(block) {
    if (!this._f('steering') || !block.concept || block.type !== 'spine') return '';
    const others = this._conceptPool(block.concept).filter(b => (b.meta?.id || b.id) !== block.id).length;
    return `<div class="tellings-indicator">
      <button class="steer-chip" onclick="app.toggleTellings('${block.id}')" title="Other ways this concept is told">&#127899;&#65039; ${others ? `${others} other telling${others > 1 ? 's' : ''}` : 'tellings'} &#9662;</button>
      <div class="tellings-panel" id="tellings-${block.id}" style="display:none"></div>
    </div>`;
  }

  // End-of-block steering: ask AFTER the reader finished the telling.
  // Dismissible (✕) and auto-fades ~25 s after becoming visible if untouched;
  // any interaction inside cancels the fade. The tellings indicator stays.
  _renderFeedbackBar(block) {
    if (!this._f('steering') || !block.concept || block.type !== 'spine') return '';
    const lensVals = CONFIG.facets.lens.values;
    const lensIcons = CONFIG.facets.lens.icons || {};
    const canSimpler = (block.depth || 'standard') !== 'intro';
    const canDeeper = (block.depth || 'standard') !== 'research';
    return `<div class="steer-bar feedback-bar" id="steer-${block.id}" onpointerdown="app._pinFeedbackBar('${block.id}')">
      <button class="fb-close" onclick="app._dismissFeedbackBar('${block.id}')" title="Dismiss">&times;</button>
      <span class="steer-label">How was this telling?</span>
      <button class="steer-chip" onclick="app.steerBlock('${block.id}','praise')" title="This telling worked for me">&#128077; Great</button>
      ${canSimpler ? `<button class="steer-chip" onclick="app.steerBlock('${block.id}','simpler')" title="Same idea, gentler telling">&#128315; Simpler</button>` : ''}
      ${canDeeper ? `<button class="steer-chip" onclick="app.steerBlock('${block.id}','deeper')" title="Same idea, more depth">&#128316; Deeper</button>` : ''}
      ${block.visuality !== 'visual-first' ? `<button class="steer-chip" onclick="app.steerBlock('${block.id}','visual')" title="Same idea, more visual">&#128444;&#65039; More visual</button>` : ''}
      <select class="steer-chip steer-lens" onchange="if(this.value){app.steerBlock('${block.id}','lens',this.value);this.value=''}" title="Examples from your world">
        <option value="">&#127758; my world&hellip;</option>
        ${lensVals.filter(l => l !== (block.lens || 'generic')).map(l => `<option value="${l}">${lensIcons[l] || ''} ${l}</option>`).join('')}
      </select>
    </div>`;
  }

  // Feedback-bar lifecycle: arm a 25 s fade when it first becomes visible (called
  // from the dwell observer), pin on any interaction, dismiss on ✕.
  _armFeedbackBar(blockId) {
    const bar = document.getElementById(`steer-${blockId}`);
    if (!bar || !bar.classList.contains('feedback-bar') || bar.dataset.armed) return;
    bar.dataset.armed = '1';
    if (!this._fbTimers) this._fbTimers = {};
    this._fbTimers[blockId] = setTimeout(() => {
      if (!bar.dataset.pinned) bar.classList.add('fb-away');
    }, 25000);
  }
  _pinFeedbackBar(blockId) {
    const bar = document.getElementById(`steer-${blockId}`);
    if (bar) { bar.dataset.pinned = '1'; bar.classList.remove('fb-away'); }
    if (this._fbTimers?.[blockId]) clearTimeout(this._fbTimers[blockId]);
  }
  _dismissFeedbackBar(blockId) {
    document.getElementById(`steer-${blockId}`)?.classList.add('fb-away');
    if (this._fbTimers?.[blockId]) clearTimeout(this._fbTimers[blockId]);
  }

  // Render a block's covered subspace as chips: sets "a · b", ranges "a–b"
  _facetChips(meta, full) {
    const lensIcons = CONFIG.facets.lens.icons || {};
    const show = (dim, always) => {
      const set = this._facetValues(meta, dim);
      const def = this._facetDefault(dim);
      if (!always && set.length === 1 && set[0] === def) return null;
      const ordered = CONFIG.facets[dim]?.ordered;
      const label = ordered && set.length > 1 ? `${set[0]}–${set[set.length - 1]}` : set.join(' · ');
      const icon = dim === 'lens' ? (set.length === 1 ? lensIcons[set[0]] || '' : '🌐') : dim === 'lang' ? '🌍' : '';
      return `<span class="telling-chip">${icon ? icon + ' ' : ''}${label}</span>`;
    };
    return [show('lens', true), show('lang', full), show('depth', true), show('visuality', full), show('genre', full), show('lengthBand', full)]
      .filter(Boolean).join('');
  }

  _stateBadge(meta) {
    const s = meta.state || 'edited';
    if (meta.remixOf) {
      return s === 'community'
        ? '<span class="telling-badge" style="color:#D97706;border-color:#D97706">✨ reader remix</span>'
        : '<span class="telling-badge" style="color:#D97706;border-color:#D97706">✨ your remix</span>';
    }
    if (s === 'core') return '<span class="telling-badge" style="color:#7C3AED;border-color:#7C3AED">CORE</span>';
    if (s === 'community') return '<span class="telling-badge" style="color:#D97706;border-color:#D97706">⚡ reader-shared</span>';
    if (s === 'private') return '<span class="telling-badge" style="color:#D97706;border-color:#D97706">⚡ yours</span>';
    return '<span class="telling-badge" style="color:#10B981;border-color:#10B981">edited</span>';
  }

  // The tellings panel: SEE what exists before generating anything.
  // missMsg/presetTarget come from a steer that found no matching telling.
  async toggleTellings(blockId, missMsg, presetTarget) {
    const panel = document.getElementById(`tellings-${blockId}`);
    if (!panel) return;
    if (panel.style.display !== 'none' && !missMsg) { panel.style.display = 'none'; return; }

    const entry = this._findAnyBlock(blockId);
    const conceptId = this._conceptIds(entry?.meta)[0];
    if (!conceptId) return;
    panel.style.display = 'block';
    panel.innerHTML = '<div style="padding:.5em;color:var(--text-3);font-size:.75rem">Loading tellings…</div>';
    await this._fetchCommunity(conceptId);

    const concept = this.concepts?.[conceptId];
    const pool = this._conceptPool(conceptId);
    // COMPOSED REQUEST: the profile only seeds the target once; after that every
    // dimension the reader picks in this panel sticks until the panel is reset.
    if (!this._steerTargets) this._steerTargets = {};
    // keyed by CONCEPT: the composed request survives swaps, "Original" and
    // opening the panel from any other telling of the same concept
    const target = presetTarget
      ? { ...this.user.getTargetFacets(), ...presetTarget }
      : (this._steerTargets[conceptId] || { ...this.user.getTargetFacets() });
    this._steerTargets[conceptId] = target;

    let h = `<div class="tellings-title">Tellings of &ldquo;${this.escHtml(concept?.title || conceptId)}&rdquo;</div>`;
    if (missMsg && missMsg.trim()) h += `<div class="tellings-miss">${missMsg}</div>`;

    // COMPOSE FORM — the whole telling space on one screen, pre-filled from the
    // reader's profile. Clicking only changes the request (no hidden accordions,
    // no silent swaps); serving/generating happens on the buttons below.
    const DIMS = [
      { dim: 'lens', label: '🌐 World' }, { dim: 'lang', label: '🌍 Language' },
      { dim: 'genre', label: '✒️ Genre' }, { dim: 'depth', label: '📏 Depth' },
      { dim: 'visuality', label: '🖼 Form' }, { dim: 'lengthBand', label: '⏱ Length' },
      { dim: 'carriers', label: '🧩 Blocks' },
    ];
    const curMeta = entry.meta;
    const profile = this.user.getTargetFacets();
    const changed = DIMS.filter(({ dim }) => (target[dim] || '') !== (profile[dim] || '')).length;

    // Compact coverage strip: one chip per telling (state color + genre icon),
    // full title & configuration on hover, click to read. Replaces the long rows.
    const GENRE_ICONS = { explainer: '📄', story: '📖', 'worked-example': '🧮', 'code-walkthrough': '💻', comic: '🎭', animation: '🎞' };
    const STATE_COLORS = { core: '#7C3AED', edited: '#10B981', community: '#D97706', private: '#9CA3AF' };
    h += `<div class="tstrip">${pool.map(b => {
      const m = b.meta;
      const isCurrent = m.id === blockId;
      const state = m.core ? 'core' : (m.state || 'edited');
      const color = STATE_COLORS[state] || STATE_COLORS.edited;
      const g = this._facetValues(m, 'genre')[0] || 'explainer';
      const cfg = [this._facetValues(m, 'lens').join('|'), this._facetValues(m, 'lang').join('|'),
                   g, this._facetValues(m, 'depth').join('–'), this._facetValues(m, 'visuality').join('–'),
                   this._facetValues(m, 'lengthBand').join('–')].join(' · ');
      const tip = `${(m.title || m.id).replace(/"/g, "'")}\n${state.toUpperCase()} · ${cfg}${isCurrent ? '\n(reading now)' : ''}`;
      return `<button class="tstrip-chip ${isCurrent ? 'tstrip-current' : ''}" style="--sc:${color}"
        title="${this.escHtml(tip)}" ${isCurrent ? '' : `onclick="app.pickTelling('${blockId}','${m.id}')"`}>${GENRE_ICONS[g] || '📄'}</button>`;
    }).join('')}<span class="tstrip-hint">${pool.length} tellings — hover for details, click to read</span></div>`;

    h += `<div class="tellings-compose">
      <div style="font-size:.72rem;font-weight:700;margin:.6em 0 .15em">🎛 Want it told differently? <span style="font-weight:400;color:var(--text-3)">◉ = this telling · <span class="legend-active">filled</span> = your target · numbers = existing tellings${changed ? ` · <a href="#" onclick="event.preventDefault();app.resetPanelTarget('${blockId}')" style="color:var(--accent)">↺ reset (${changed} changed)</a>` : ''}</span></div>
      ${DIMS.map(({ dim, label }) => `<div class="dna-row" style="align-items:flex-start"><span class="dna-label" style="padding-top:.2em">${label}</span>
        <div class="tellings-dimvals" style="margin:0">${this._renderDimValues(blockId, dim, pool, curMeta)}</div></div>`).join('')}
    </div>`;

    // Serve-or-generate, honestly: if an existing telling covers the composed
    // target, offer it to read; only a real gap offers generation (+ optional note).
    const best = pool.filter(b => b.meta.id !== blockId)
      .map(b => ({ b, s: this._facetMatch(b.meta, target) }))
      .sort((x, y) => y.s - x.s)[0];
    const covered = best && best.s >= CONFIG.steering.serveThreshold;
    const canGen = this._f('generation') && await this._probeGeneration();
    const wish = this._steerWish?.[conceptId] || '';
    h += `<div class="tellings-gen" id="gen-offer-${blockId}">`;
    if (covered) {
      h += `<span>✓ Your target is covered: <b>${this.escHtml(best.b.meta.title || best.b.meta.id)}</b> (${Math.round(best.s * 100)}% match)</span>
        <button class="steer-chip" style="border-color:var(--accent);color:var(--accent)" onclick="app.pickTelling('${blockId}','${best.b.meta.id}')">Read it</button>`;
    } else if (canGen && this.user.readerMode === 'open') {
      h += `<span>No telling covers this yet${best ? ` (closest: ${Math.round(best.s * 100)}%)` : ''}.</span>
        <input type="text" id="gen-wish-${blockId}" class="gen-wish" maxlength="300" value="${this.escHtml(wish)}"
          oninput="(app._steerWish=app._steerWish||{})['${conceptId}']=this.value"
          placeholder="Optional note: anything specific? (e.g. 'use a running-shop example')">
        <button class="steer-chip steer-gen" onclick="app.generateVariant('${blockId}','${conceptId}')">&#10024; Generate exactly this (~30 s)</button>
        ${(target.genre === 'comic' || target.genre === 'animation') ? `<span style="font-size:.65rem;color:var(--text-3);flex-basis:100%">${target.genre === 'comic' ? 'A four-panel comic' : 'An animated SVG'} will be drawn for this segment (~40 s).</span>` : (target.visuality === 'visual-first' || /diagram|image/.test(target.carriers || '')) ? `<span style="font-size:.65rem;color:var(--text-3);flex-basis:100%">For genre comic/animation the generator draws a real visual; plain text requests deliver prose, tables, formulas and code.</span>` : ''}`;
    } else if (canGen) {
      h += `<span>No telling covers this yet — turn on <b>Open mode</b> in your <a href="#" onclick="app.switchView('profile');return false">Profile</a> to generate it.</span>`;
    } else {
      h += `<span>No telling covers this yet — your interest was recorded and helps editors decide what to write next. &#128203;</span>`;
    }
    h += '</div>';
    h += `<div style="font-size:.68rem;color:var(--text-3);margin-top:.35em">These are tellings of one concept. Missing a whole <i>concept</i>? <a href="#" onclick="event.preventDefault();app.proposeConcept()" style="color:var(--accent)">🌱 propose it</a> (+10 XP).</div>`;
    panel.innerHTML = h;
  }

  // Dimension picker interactions
  pickDim(blockId) {   // legacy alias — the compose form shows all dimensions at once
    this.toggleTellings(blockId, ' ');
  }

  _renderDimValues(blockId, dim, pool, curMeta) {
    const conf = CONFIG.facets[dim];
    if (!conf) return '';
    const icons = conf.icons || {};
    const current = this._facetValues(curMeta, dim);
    const cid = this._conceptIds(curMeta)[0];
    const selRaw = this._steerTargets?.[cid]?.[dim];
    const selSet = String(selRaw || '').split('|').filter(Boolean);
    return conf.values.map(v => {
      const count = pool.filter(b => this._covers(b.meta, dim, v)).length;
      const isCur = current.includes(v);
      const isSel = selSet.includes(v);
      return `<button class="steer-chip dimval ${isCur ? 'dim-current' : ''} ${isSel ? 'dim-active' : ''} ${count ? '' : 'dim-empty'}"
        onclick="app.steerDim('${blockId}','${dim}','${v}')" title="${isCur ? 'the telling you are reading covers this · ' : ''}${isSel ? 'in your target (click to remove) · ' : ''}${count ? count + ' telling(s) cover this' : 'no telling yet — be the first'}">
        ${isCur ? '◉ ' : ''}${icons[v] ? icons[v] + ' ' : ''}${v}${count ? ` <span class="dimcount">${count}</span>` : ' ＋'}</button>`;
    }).join('');
  }

  resetPanelTarget(blockId) {
    const entry = this._findAnyBlock(blockId);
    const cid = this._conceptIds(entry?.meta)[0];
    if (this._steerTargets && cid) delete this._steerTargets[cid];
    this.toggleTellings(blockId, ' ');
  }

  // Persistent per-concept telling choice: survives reloads (the "everything
  // disappears" report). conceptId → chosen telling id; cleared on unswap.
  _tellingChoices() {
    try { return JSON.parse(localStorage.getItem('pbook-telling-choice') || '{}'); } catch (e) { return {}; }
  }
  _setTellingChoice(conceptId, variantId) {
    if (!conceptId) return;
    const c = this._tellingChoices();
    if (variantId) c[conceptId] = variantId; else delete c[conceptId];
    try { localStorage.setItem('pbook-telling-choice', JSON.stringify(c)); } catch (e) {}
  }
  // After a chapter renders, re-apply the reader's saved telling choices.
  async _applyTellingChoices() {
    const choices = this._tellingChoices();
    for (const [cid, vid] of Object.entries(choices)) {
      const anchor = this.concepts?.[cid]?.anchor;
      if (!anchor || !document.getElementById(`b-${anchor}`)) continue;
      let entry = this._findAnyBlock(vid);
      if (!entry) { try { await this._fetchCommunity(cid); entry = this._findAnyBlock(vid); } catch (e) {} }
      if (entry) await this._swapBlock(anchor, entry, this._blockFacets(entry.meta) || {});
      else this._setTellingChoice(cid, null);        // variant gone — forget the choice
    }
  }

  pickTelling(blockId, variantId) {
    const variant = this._findAnyBlock(variantId);
    if (!variant) return;
    this.user.updateFacetAffinity(this._blockFacets(variant.meta), 2); // choosing a telling is a strong signal
    this.rc.logEvent('steer', { blockId, action: 'pick', servedId: variantId, result: 'served' });
    this._swapBlock(blockId, variant, this._blockFacets(variant.meta) || {});
    this._setTellingChoice(this._conceptIds(variant.meta)[0], variantId);
  }

  // Steering with an honest miss path: the steered facet must actually move —
  // we never silently swap in a telling that ignores what the reader asked for.
  async steerBlock(blockId, action, value) {
    const entry = this._findAnyBlock(blockId);
    if (!entry) return;
    const meta = entry.meta;
    const conceptId = this._conceptIds(meta)[0];
    if (!conceptId) return;

    // 👍 praise: positive affinity for THIS telling's facets, no swap
    if (action === 'praise') {
      this.user.updateFacetAffinity(this._blockFacets(meta), 2);
      this.rc.logEvent('steer', { blockId, concept: conceptId, action: 'praise' });
      this.showXPToast('Noted — more tellings like this one 👍', 'achievement');
      return;
    }

    const order = f => CONFIG.facets[f].values;
    const target = { ...(this._blockFacets(meta) || {}) };
    let facet, dir = 0; // dir: +1 up the ordered scale, -1 down, 0 exact match required
    if (action === 'simpler') {
      facet = 'depth'; dir = -1;
      const d = order('depth'); target.depth = d[Math.max(0, d.indexOf(meta.depth || 'standard') - 1)];
      target.formalism = 'none';
    } else if (action === 'deeper') {
      facet = 'depth'; dir = +1;
      const d = order('depth'); target.depth = d[Math.min(d.length - 1, d.indexOf(meta.depth || 'standard') + 1)];
    } else if (action === 'visual') {
      facet = 'visuality'; dir = +1; target.visuality = 'visual-first';
    } else if (action === 'lens') {
      facet = 'lens'; target.lens = value;
    } else return;

    // Every steer is a labelled preference statement (strongest affinity signal)
    if (action === 'lens') this.user.setSteerPref('lens', value);
    this.user.updateFacetAffinity({ [facet]: target[facet] }, 3);

    // Retrieve before generate — but candidates must MOVE on the steered facet
    // (subspace semantics: a candidate's covered range must reach past the current value)
    const vals = order(facet);
    const curSet = this._facetValues(meta, facet);
    const curBest = dir > 0 ? Math.max(...curSet.map(v => vals.indexOf(v))) : Math.min(...curSet.map(v => vals.indexOf(v)));
    const candidateFilter = b => {
      if (facet === 'lens') return this._covers(b.meta, 'lens', target.lens);   // lens: must cover that world
      const set = this._facetValues(b.meta, facet);
      return dir > 0 ? set.some(v => vals.indexOf(v) > curBest) : set.some(v => vals.indexOf(v) < curBest);
    };
    const icons = CONFIG.facets.lens.icons || {};
    const askLabel = facet === 'lens' ? `${icons[value] || ''} ${value}` : action === 'visual' ? 'more visual' : `${action} (${target.depth})`;
    await this._serveOrMiss(blockId, conceptId, target, candidateFilter, { action, value, askLabel });
  }

  // Dimension picker: jump straight to a value on ANY dimension (subspace-aware)
  async steerDim(blockId, facet, value) {
    // Compose-only: the form click changes the REQUEST. Reading/generating is an
    // explicit button below — no silent swaps while the reader is still composing.
    const entry = this._findAnyBlock(blockId);
    if (!entry || !this._conceptIds(entry.meta).length) return;
    const cid = this._conceptIds(entry.meta)[0];
    if (!this._steerTargets) this._steerTargets = {};
    const target = { ...(this._steerTargets[cid] || this.user.getTargetFacets()) };
    if (facet === 'carriers') {
      const set = String(target.carriers || '').split('|').filter(Boolean);
      const i = set.indexOf(value);
      if (i >= 0) set.splice(i, 1); else set.push(value);
      if (set.length) target.carriers = set.join('|'); else delete target.carriers;
    } else if (target[facet] === value) {
      const profile = this.user.getTargetFacets();
      if (profile[facet] && profile[facet] !== value) target[facet] = profile[facet];
      else delete target[facet];
    } else {
      target[facet] = value;
      if (facet === 'lens' || facet === 'lang') this.user.setSteerPref(facet, value);
      this.user.updateFacetAffinity({ [facet]: value }, 3);
    }
    this._steerTargets[cid] = target;
    this.rc.logEvent('steer', { blockId, action: 'compose', facet, value });
    this.toggleTellings(blockId, ' ');
  }

  // Shared serve/honest-miss tail of every steer
  async _serveOrMiss(blockId, conceptId, target, candidateFilter, info) {
    await this._fetchCommunity(conceptId);
    const pool = this._conceptPool(conceptId).filter(b => (b.meta?.id || b.id) !== blockId);
    const candidates = pool.filter(candidateFilter);
    let best = null, bestScore = 0;
    for (const b of candidates) {
      const s = this._facetMatch(b.meta, target);
      if (s > bestScore) { best = b; bestScore = s; }
    }
    const logBase = { blockId, concept: conceptId, action: info.action, facet: info.facet || null, value: info.value || null, target, matchScore: Math.round(bestScore * 100) / 100 };
    if (best) {
      this.rc.logEvent('steer', { ...logBase, result: 'served', servedId: best.meta.id });
      this._swapBlock(blockId, best, target);
    } else {
      // Honest miss: nothing in the catalog does what was asked → show what exists + generate CTA
      this.rc.logEvent('steer_miss', logBase);
      this.toggleTellings(blockId, `No <b>${info.askLabel}</b> telling of this concept yet — here's what exists:`, target);
      document.getElementById(`tellings-${blockId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  _findAnyBlock(blockId) {
    const git = this.findBlock(blockId);
    if (git) return git;
    if (this.privateBlocks?.[blockId]) return this.privateBlocks[blockId];
    for (const list of Object.values(this._communityCache || {})) {
      const hit = list.find(b => b.meta.id === blockId);
      if (hit) return hit;
    }
    return null;
  }

  // Swap the rendered article for a variant of the same concept, with undo
  async _swapBlock(originalId, variantEntry, target, offerGenerate = false) {
    if (!this._slotDom) this._slotDom = {};
    const el = document.getElementById(`b-${originalId}`)
      || (this._slotDom[originalId] && document.getElementById(`b-${this._slotDom[originalId]}`));
    if (!el) return;
    const vMeta = variantEntry.meta;
    const vBlock = { ...vMeta, body: variantEntry.body, _chapterNum: vMeta._chapterNum || this._findAnyBlock(originalId)?.meta?._chapterNum, _chapterTitle: vMeta._chapterTitle || '' };
    const html = await this.renderSpine(vBlock);
    if (!this._swapHistory) this._swapHistory = {};
    const rootLogical = this._swapHistory[originalId] || originalId;   // chains: variant over variant
    this._swapHistory[vMeta.id] = rootLogical;
    this._slotDom[rootLogical] = vMeta.id;
    this._slotDom[originalId] = vMeta.id;

    const isGenerated = vMeta.state === 'private' || vMeta.state === 'community';
    const noticeBits = [];
    if (vMeta.lens && vMeta.lens !== 'generic') noticeBits.push(`${(CONFIG.facets.lens.icons || {})[vMeta.lens] || ''} ${vMeta.lens} examples`);
    if (vMeta.depth) noticeBits.push(`${vMeta.depth} depth`);
    const provenance = vMeta.state === 'community'
      ? `<span class="gen-badge">shared by a reader &middot; not yet editor-verified</span>`
      : vMeta.state === 'private'
        ? `<span class="gen-badge">&#9889; generated for your settings &middot; not yet editor-verified</span>`
        : '';
    const notice = `<div class="variant-notice">
      <span>&#127899;&#65039; Different telling: ${noticeBits.join(' &middot; ') || 'variant'} ${provenance}</span>
      <span>
        <button class="steer-chip" onclick="app.toggleTellings('${vMeta.id}')">&#127899;&#65039; All tellings</button>
        <button class="steer-chip" onclick="app.unswapBlock('${vMeta.id}')">&#8617; Original</button>
      </span>
    </div>`;

    el.outerHTML = notice + html;
    // Register the variant for dwell tracking (falls back to default reading time)
    const newEl = document.getElementById(`b-${vMeta.id}`);
    if (newEl && this._observer) { newEl.dataset.observed = '1'; this._observer.observe(newEl); }
    if (isGenerated) this.rc.setContext('steer', { variant: vMeta.id });
    // store the target so a follow-up generate uses exactly what the reader asked for
    if (!this._steerTargets) this._steerTargets = {};
    const swapCid = this._conceptIds(vMeta)[0];
    if (swapCid) this._steerTargets[swapCid] = target;
  }

  async unswapBlock(variantId) {
    const originalId = this._swapHistory?.[variantId];
    if (!originalId) return;
    if (this._slotDom) this._slotDom[originalId] = originalId;
    const ventry = this._findAnyBlock(variantId);
    if (ventry) this._setTellingChoice(this._conceptIds(ventry.meta)[0], null);
    const orig = this._findAnyBlock(originalId);
    const el = document.getElementById(`b-${variantId}`);
    if (!orig || !el) return;
    const html = await this.renderSpine({ ...orig.meta, body: orig.body });
    // remove the notice bar directly above the swapped article
    const prev = el.previousElementSibling;
    if (prev?.classList?.contains('variant-notice')) prev.remove();
    el.outerHTML = html;
    const newEl = document.getElementById(`b-${originalId}`);
    if (newEl && this._observer) { newEl.dataset.observed = '1'; this._observer.observe(newEl); }
    this.rc.logEvent('steer_undo', { variantId, originalId });
  }

  // ===== ON-DEMAND GENERATION (client side, spec §5+§10) =====

  // Probe /api/generate once — the button only appears when the endpoint is configured
  async _probeGeneration() {
    if (this._genAvailable !== undefined) return this._genAvailable;
    if (!this._f('generation')) { this._genAvailable = false; return false; }
    try {
      const res = await fetch(CONFIG.steering.generateEndpoint, { method: 'GET' });
      const data = res.ok ? await res.json() : {};
      this._genAvailable = !!data.available;
    } catch (e) { this._genAvailable = false; }
    return this._genAvailable;
  }

  offerGenerate(blockId) {
    // legacy hook — the tellings panel is now the single offer surface
    this.toggleTellings(blockId);
  }

  // Generate a segment-scoped variant: cache-keyed server side, lands PRIVATE to this reader
  async generateVariant(blockId, conceptId) {
    const target = this._steerTargets?.[conceptId] || this.user.getTargetFacets();
    const offer = document.getElementById(`gen-offer-${blockId}`);
    if (offer) offer.innerHTML = '<span class="gen-spinner">&#9889; Writing your telling&hellip; (~30 s — same concept, checked against its contract)</span>';
    this.rc.logEvent('generate_request', { concept: conceptId, target });
    try {
      const existingVariants = this._conceptPool(conceptId).map(b => {
        const m = b.meta || {};
        return `"${m.title}" (${m.lens || 'generic'}, ${m.depth || 'standard'}, ${m.visuality || 'text-first'})`;
      });
      // Reader's optional wish — refines the telling within the contract (never overrides it)
      const instructions = document.getElementById(`gen-wish-${blockId}`)?.value?.trim().slice(0, 300) || undefined;
      const res = await fetch(CONFIG.steering.generateEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept: conceptId, facets: target, existingVariants, instructions }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'generation failed');
      const block = {
        meta: { ...data.block.facets, id: data.block.id, title: data.block.title, type: 'spine',
                diagramSvg: data.block.svg || undefined,
                concept: conceptId, state: 'private', generated: true,
                readingTime: Math.max(1, Math.round((data.block.body.split(/\s+/).length) / 200)),
                recallQ: data.block.recallQ || null, recallA: data.block.recallA || null },
        body: data.block.body,
      };
      this._savePrivateBlock(block);
      if (offer) offer.remove();
      this._swapBlock(blockId, block, target);
      this.rc.logEvent('generate_served', { concept: conceptId, variantId: block.meta.id, cached: !!data.cached });
      this._setTellingChoice(conceptId, block.meta.id);
      if (this._f('gamification')) { this.user.addXP(2); this.user.save(); this.updateXPBadge(); }
    } catch (e) {
      if (offer) offer.innerHTML = `<span>Generation didn't work out (${this.escHtml(e.message)}). Your request was recorded for the editors.</span>`;
      this.rc.logEvent('generate_failed', { concept: conceptId, error: String(e.message).slice(0, 200) });
    }
  }

  // ===== ONBOARDING =====
  showStep(n) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.querySelector(`.step[data-step="${n}"]`).classList.add('active');
  }


  _saveFeatureToggles() {
    const get = id => document.getElementById(id)?.checked !== false;
    const features = {
      gamification: get('optGamification'),
      personalization: get('optPersonalization'),
      spaceRepetition: get('optRecall'),
      missions: get('optMissions'),
      games: get('optGames'),
      highlights: get('optHighlights'),
    };
    localStorage.setItem('pbook-features', JSON.stringify(features));
    Object.assign(CONFIG.features, features);
    if (!features.personalization) this.rc.enabled = false;
  }

  _loadFeatureToggles() {
    try {
      const saved = JSON.parse(localStorage.getItem('pbook-features') || '{}');
      if (Object.keys(saved).length) Object.assign(CONFIG.features, saved);
      if (!CONFIG.features.personalization) this.rc.enabled = false;
    } catch (e) {}
  }

  startAndGo(view) {
    this._saveFeatureToggles();
    document.getElementById('onboarding').classList.add('hidden');
    this.updateVoiceBadge();
    this.updateXPBadge();
    if (!this._f('missions')) document.querySelector('[data-view="glossary"]')?.style.setProperty('display', 'none');
    this.switchView(view || 'home');
    // First-time tour
    if (!localStorage.getItem('pbook-tour-done')) {
      setTimeout(() => this.startTour(), 1000);
    }
  }

  // One-tap onboarding pick with immediate, visible effect (selection + preview line)
  onboardPick(kind, value, el) {
    const row = el.closest('.intro-voices');
    row?.querySelectorAll('.intro-voice').forEach(v => v.classList.remove('selected'));
    el.classList.add('selected');
    const lens = document.querySelector('#introLens .intro-voice.selected')?.dataset.lens || 'generic';
    const goal = document.querySelector('#introGoal .intro-voice.selected')?.dataset.goal || 'understand';
    const WORLD = { generic: 'a mix of platforms', ecommerce: 'shops, carts and "customers also bought"', media: 'playlists, autoplay and watch history', 'social-feeds': 'feeds, follows and creators', education: 'courses, exercises and learners' };
    const GOAL = { understand: 'clear explanations first', build: 'hands-on and technical depth when you want it', decide: 'trade-offs and evaluation focus', protect: 'your data, your controls, your rights' };
    const hint = document.getElementById('onboardHint');
    if (hint) hint.innerHTML = `→ Examples will come from <b>${WORLD[lens]}</b> · ${GOAL[goal]}. You can steer any section later.`;
  }

  startWithVoiceAndGo(view) {
    // (voice picker removed — the facet taxonomy replaced learning styles; legacy name kept)
    // Onboarding calibration (P0): lens + goal — light, skippable, seeds the facet profile
    const lensSel = document.querySelector('#introLens .intro-voice.selected');
    if (lensSel && lensSel.dataset.lens !== 'generic') {
      this.user.setSteerPref('lens', lensSel.dataset.lens);
      this.user.updateFacetAffinity({ lens: lensSel.dataset.lens }, 3);
    }
    const goalSel = document.querySelector('#introGoal .intro-voice.selected');
    if (goalSel) { this.user.goal = goalSel.dataset.goal; }
    const goalText = document.getElementById('introGoalText')?.value?.trim();
    if (goalText) this.composePersonalMission(goalText);
    // Living book opt-in right at the door (open mode = community + generation + remix)
    const openMode = document.getElementById('optOpenMode')?.checked;
    if (openMode) { this.user.readerMode = 'open'; this.rc.setUserProperties({ readerMode: 'open' }); }
    this.user.save();
    this.rc.logEvent('onboarding', { lens: lensSel?.dataset.lens, goal: goalSel?.dataset.goal, openMode: !!openMode });
    this.startAndGo(view);
  }

  startRandom() {
    // Random reading mode for A/B testing
    const modes = ['glossary', 'home', 'read', 'map'];
    const mode = modes[Math.floor(Math.random() * modes.length)];
    this.rc.logEvent('random_start', { mode });
    this.startWithVoiceAndGo(mode);
  }

  showWelcome() {
    const overlay = document.getElementById('onboarding');
    overlay.classList.remove('hidden');
    this.showStep(0);
    this._customizeWelcome();
  }

  _customizeWelcome() {
    const u = this.user;
    const prog = u.getProgress(this.allBlocks);
    const isReturning = prog.read > 0;
    const auth = this._getAuth();
    const dueRecalls = this._f('spaceRepetition') ? u.getDueRecalls() : [];

    // Find the main CTA button
    const ctaBtn = document.querySelector('.step[data-step="0"] .btn-primary.btn-large');
    if (!ctaBtn) return;

    if (!isReturning) return; // cold start — keep default "Start reading"

    // Returning user — change CTA
    const continueBlock = this.getContinueBlock();
    ctaBtn.textContent = 'Continue reading \u{1F4D6}';
    ctaBtn.onclick = () => this.startWithVoiceAndGo('home');

    // Add extra buttons below CTA
    let extras = document.getElementById('welcomeExtras');
    if (!extras) {
      extras = document.createElement('div');
      extras.id = 'welcomeExtras';
      extras.style.cssText = 'display:flex;flex-wrap:wrap;gap:.4em;justify-content:center;margin-top:.6em';
      ctaBtn.after(extras);
    }

    let html = '';

    // Memory cards button
    if (dueRecalls.length > 0) {
      html += `<button class="btn-secondary" style="font-size:.78rem;padding:.4em .8em;border-radius:8px;border:1.5px solid var(--warn);color:var(--warn);background:var(--warn-bg)" onclick="app.startAndGo('quiz');setTimeout(()=>app.startPractice(true),300)">\u{1F9E0} ${dueRecalls.length} cards due</button>`;
    } else if (Object.keys(u.recall).length > 0) {
      html += `<button class="btn-secondary" style="font-size:.78rem;padding:.4em .8em;border-radius:8px;border:1.5px solid var(--accent);color:var(--accent)" onclick="app.startAndGo('quiz')">\u{1F9E0} Test knowledge</button>`;
    }

    // Profile link
    if (auth) {
      html += `<button class="btn-secondary" style="font-size:.78rem;padding:.4em .8em;border-radius:8px;border:1.5px solid var(--border);color:var(--text-2)" onclick="app.startAndGo('profile')">${this.getLevelIcon()} ${this.escHtml(auth.displayName || 'Profile')}</button>`;
    } else {
      html += `<button class="btn-secondary" style="font-size:.78rem;padding:.4em .8em;border-radius:8px;border:1.5px solid var(--border);color:var(--text-2)" onclick="app.startAndGo('profile')">Your profile (${prog.pct}%)</button>`;
    }

    // Progress summary
    html += `<div style="width:100%;font-size:.7rem;color:var(--text-3);text-align:center;margin-top:.2em">${prog.read}/${prog.total} sections &middot; ${u.xp} XP &middot; Lv.${u.level}</div>`;

    extras.innerHTML = html;
  }

  startApp() {
    document.getElementById('onboarding').classList.add('hidden');
    this.updateVoiceBadge();
    this.updateXPBadge();
    if (!this._f('missions')) document.querySelector('[data-view="glossary"]')?.style.setProperty('display', 'none');
    this.switchView('home');
    // First-time tour
    if (!localStorage.getItem('pbook-tour-done')) {
      setTimeout(() => this.startTour(), 1500);
    }
  }

  // ===== ONBOARDING TOUR =====
  startTour() {
    this._tourSteps = [
      { target: '.tab[data-view="home"]', text: "\u{1F3E0} This is your Home! It's like Netflix but for learning. Scroll through and pick whatever looks cool.", pos: 'top' },
      { target: '.tab[data-view="read"]', text: "\u{1F4F1} The Feed! Just keep scrolling — the app figures out what to show you next. Like TikTok, but you actually learn stuff.", pos: 'top' },
      { target: '.tab[data-view="glossary"]', text: "\u{1F3AF} Missions! Each one is a quest with a story and a final boss quiz at the end. Beat the boss = earn a title!", pos: 'top' },
      { target: '.tab[data-view="map"]', text: "\u{1F5FA} The Map! See everything in the book, plus your saved stuff and notes. Tap any chapter to jump there.", pos: 'top' },
      { target: '.tab[data-view="quiz"]', text: "\u{1F9E0} Quiz! Test what you remember. Cards get smarter over time — hard stuff comes back more often, easy stuff less. Like Anki for recommendations!", pos: 'top' },
      { target: '#xpBadge', text: "\u{1F31F} This is your level! You get XP for reading, playing mini-games, and finishing missions. Level up to unlock cool themes!", pos: 'bottom' },
      { target: null, text: "You're all set! Just tap anything that looks interesting. There's no wrong way to read this book. If you ever get lost, tap \"p-book\" up top to come back here. GO! \u{1F680}", pos: 'center' },
    ];
    this._tourIdx = 0;
    this._showTourStep();
  }

  _showTourStep() {
    // Remove previous
    document.getElementById('tourOverlay')?.remove();

    if (this._tourIdx >= this._tourSteps.length) {
      localStorage.setItem('pbook-tour-done', '1');
      return;
    }

    const step = this._tourSteps[this._tourIdx];
    const total = this._tourSteps.length;
    const isLast = this._tourIdx === total - 1;

    const overlay = document.createElement('div');
    overlay.id = 'tourOverlay';
    overlay.className = 'tour-overlay';

    if (step.target) {
      const el = document.querySelector(step.target);
      if (el) {
        const rect = el.getBoundingClientRect();
        // Highlight circle
        overlay.innerHTML = `<div class="tour-highlight" style="top:${rect.top - 4}px;left:${rect.left - 4}px;width:${rect.width + 8}px;height:${rect.height + 8}px"></div>`;
        // Tooltip
        const tipTop = step.pos === 'top' ? rect.top - 80 : rect.bottom + 12;
        const tipLeft = Math.max(10, Math.min(rect.left, window.innerWidth - 260));
        overlay.innerHTML += `<div class="tour-tip" style="top:${tipTop}px;left:${tipLeft}px">
          <div class="tour-text">${step.text}</div>
          <div class="tour-nav">
            <span class="tour-count">${this._tourIdx + 1}/${total}</span>
            ${isLast ? `<button class="tour-btn tour-btn-primary" onclick="app._endTour()">Got it!</button>` : `<button class="tour-btn tour-btn-primary" onclick="app._nextTour()">Next</button>`}
            <button class="tour-btn" onclick="app._endTour()">Skip</button>
          </div>
        </div>`;
      } else {
        this._tourIdx++;
        this._showTourStep();
        return;
      }
    } else {
      // Center message (no target)
      overlay.innerHTML = `<div class="tour-tip tour-center">
        <div class="tour-text">${step.text}</div>
        <div class="tour-nav">
          <button class="tour-btn tour-btn-primary" onclick="app._endTour()">Start reading!</button>
        </div>
      </div>`;
    }

    document.body.appendChild(overlay);
  }

  _nextTour() { this._tourIdx++; this._showTourStep(); }
  _endTour() { document.getElementById('tourOverlay')?.remove(); localStorage.setItem('pbook-tour-done', '1'); }

  // ===== TEXT SIMILARITY (TF-IDF-like) =====
  _buildSimilarityIndex() {
    if (this._simIndex) return;
    const STOP = new Set('the a an is are was were be been being have has had do does did will would shall should may might can could of in to for on with at by from as into through during before after above below between out off over under again further then once here there when where why how all both each few more most other some such no nor not only own same so than too very i me my we our you your he him his she her it its they them their what which who whom this that these those am'.split(' '));

    // Extract key terms per block
    this._blockTerms = {};
    const docFreq = {}; // how many blocks contain each term
    const N = this.allBlocks.length;

    this.allBlocks.forEach(b => {
      if (b.meta.type !== 'spine') return;
      const text = ((b.meta.title || '') + ' ' + (b.body || '')).toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
      const words = text.split(/\s+/).filter(w => w.length > 3 && !STOP.has(w));
      // Term frequency
      const tf = {};
      words.forEach(w => { tf[w] = (tf[w] || 0) + 1; });
      this._blockTerms[b.meta.id] = tf;
      // Document frequency
      Object.keys(tf).forEach(w => { docFreq[w] = (docFreq[w] || 0) + 1; });
    });

    // Compute TF-IDF vectors
    this._blockVectors = {};
    Object.entries(this._blockTerms).forEach(([id, tf]) => {
      const vec = {};
      Object.entries(tf).forEach(([term, count]) => {
        const idf = Math.log(N / (docFreq[term] || 1));
        if (idf > 0.5) vec[term] = count * idf; // skip very common terms
      });
      this._blockVectors[id] = vec;
    });

    this._simIndex = true;
  }

  _cosineSim(vecA, vecB) {
    let dot = 0, normA = 0, normB = 0;
    for (const k in vecA) { normA += vecA[k] * vecA[k]; if (vecB[k]) dot += vecA[k] * vecB[k]; }
    for (const k in vecB) { normB += vecB[k] * vecB[k]; }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
  }

  _findSimilarBlocks(blockId, count) {
    this._buildSimilarityIndex();
    const vec = this._blockVectors[blockId];
    if (!vec) return [];

    // Also add topic overlap bonus
    const blockTopics = this.blockTopics[blockId] || [];

    const scored = [];
    this.allBlocks.forEach(b => {
      if (b.meta.id === blockId || b.meta.type !== 'spine') return;
      const bVec = this._blockVectors[b.meta.id];
      if (!bVec) return;
      let sim = this._cosineSim(vec, bVec);
      // Bonus for topic overlap
      const bTopics = this.blockTopics[b.meta.id] || [];
      const topicOverlap = blockTopics.filter(t => bTopics.includes(t)).length;
      sim += topicOverlap * 0.15;
      scored.push({ id: b.meta.id, title: b.meta.title, chNum: b.meta._chapterNum, sim });
    });

    scored.sort((a, b) => b.sim - a.sim);
    return scored.slice(0, count).filter(s => s.sim > 0.05);
  }

  // ===== VIEW SWITCHING =====
  switchView(view, auto) {
    this.currentView = view;
    const modeMap = { home: 'netflix', read: 'read', map: 'map', glossary: 'mission', quiz: 'quiz', chat: 'tutor', profile: 'profile' };
    this.rc.setContext(modeMap[view] || view);
    // Only log mode_switch for explicit user navigation, not automatic transitions
    if (!auto) this.rc.logEvent('mode_switch', { mode: modeMap[view] || view, from: this._prevView });
    this._prevView = view;

    // Hide all views, show the selected one
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const viewEl = document.getElementById(`view-${view}`);
    if (viewEl) viewEl.classList.add('active');

    // Update tab highlights
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
    // Clear hash to prevent deep-link re-triggering on tab click
    if (!auto && window.location.hash) history.replaceState(null, '', window.location.pathname);

    // Linear nav only in read view

    if (view === 'home') this.renderHome();
    else if (view === 'read') this.renderRead();
    else if (view === 'map') this.renderMap();
    else if (view === 'glossary') { if (this._f('missions')) this.renderMissions(); else this.switchView('home'); }
    else if (view === 'quiz') this.renderQuiz();
    else if (view === 'chat') this.initChatView();
    else if (view === 'profile') this.renderProfile();
    window.scrollTo(0, 0);
  }

  // ===== HOME VIEW (Netflix shelves) =====
  async renderHome() {
    const el = document.getElementById('homeContent');
    let html = '';

    // 1. Continue reading (hero)
    const continueBlock = this.getContinueBlock();
    if (continueBlock) {
      html += this.shelf('Continue reading', [this.cardHtml(continueBlock, true)]);
    }

    // Recently added — new content (publishedAt within 30 days), local only
    {
      const newBlocks = this.allBlocks
        .filter(b => this._isNew(b.meta) && b.meta.type === 'spine')
        .sort((a, b) => new Date(b.meta.publishedAt) - new Date(a.meta.publishedAt))
        .slice(0, 12);
      if (newBlocks.length) {
        html += this.shelf('Recently added', newBlocks.map(b => this.cardHtml(b.meta)));
      }
    }

    // Recall cards — show due + almost due (within 30 min)
    if (this._f('spaceRepetition')) {
      const now = Date.now();
      const soonThreshold = 30 * 60 * 1000; // 30 minutes
      const dueAndSoon = Object.entries(this.user.recall)
        .filter(([_, c]) => c.nextReview <= now + soonThreshold)
        .sort((a, b) => a[1].nextReview - b[1].nextReview)
        .map(([blockId, card]) => ({ blockId, ...card }));
      if (dueAndSoon.length > 0) {
        const recallCards = dueAndSoon.slice(0, 8).map(r => this._recallCardHtml(r)).filter(Boolean);
        if (recallCards.length) html += this.shelf(`\u{1F9E0} Do you remember? (${recallCards.length})`, recallCards);
      }
    }

    // Active missions (guarded)
    if (!this._f('missions')) { /* skip missions shelf */ } else {
    const missions = this.getMissions();
    const activeMissions = missions.filter(m => {
      if (this._isMissionLocked(m)) return false;
      const p = this._getMissionProgress(m);
      return p.read > 0 && !((this.user.completedMissions || []).includes(m.id));
    });
    const nextMission = missions.find(m => !this._isMissionLocked(m) && this._getMissionProgress(m).read === 0);
    const missionCards = [...activeMissions, ...(nextMission ? [nextMission] : [])].slice(0, 4).map(m => {
      const coreRead = m.core.filter(id => this.user.readBlocks.has(id)).length;
      const isNext = coreRead === 0;
      return `<div class="card" style="border-top: 3px solid var(--accent); flex: 0 0 240px; cursor:pointer" onclick="app.showMission('${m.id}')">
        <div class="card-chapter" style="color:var(--accent);font-weight:700">${isNext ? 'Next mission' : 'In progress'}</div>
        <div style="font-size:1.3rem;margin:.1em 0">${m.icon}</div>
        <div class="card-title">${m.title}</div>
        <div class="mission-progress-dots" style="margin:.3em 0">${m.core.map((id, i) => `<span class="mission-dot ${this.user.readBlocks.has(id) ? 'done' : i === coreRead ? 'current' : ''}"></span>`).join('')}</div>
        <div class="card-meta"><span class="card-time">${coreRead}/${m.core.length} steps</span></div>
      </div>`;
    });
    if (missionCards.length) html += this.shelf('Your missions', missionCards);
    } // end missions guard

    // Core essentials — unread core blocks
    const unreadCore = this.allBlocks.filter(b => b.meta.core && b.meta.type === 'spine' && !this.user.readBlocks.has(b.meta.id)).slice(0, 10);
    if (unreadCore.length) {
      html += this.shelf('Essential reading', unreadCore.map(b => this.cardHtml(b.meta)));
    }

    // 2. Recommended for you (Recombee scenario: homepage-personal)
    const forYou = await this.rc.getRecsForUser('homepage-personal', 8, this.rc.reql({ type: 'spine' }), this.rc.reqlBoost(this.user));
    if (forYou?.recomms?.length) {
      const forYouCards = forYou.recomms.map(r => this.cardFromRec(r)).filter(Boolean);
      if (forYouCards.length) html += this.shelf('Picked for you', forYouCards);
    }

    // Community layer (open mode only, spec §6): tellings other readers generated & shared,
    // clearly labelled, blended into discovery — the living part of the book
    if (this._f('community') && this.user.readerMode === 'open') {
      try {
        const shared = await this.rc.listCommunityBlocks(null, 8);
        if (shared.length) {
          const cards = shared.map(b => {
            const m = b.meta;
            const facetLine = [m.lens, m.depth].filter(v => v && v !== 'generic').join(' · ');
            return `<div class="card" style="border-top:3px solid var(--warn,#D97706);flex:0 0 240px;cursor:pointer" onclick="app.openCommunityBlock('${this.escHtml(m.id)}')">
              <div class="card-chapter" style="color:var(--warn,#D97706);font-weight:700">⚡ reader-generated</div>
              <div class="card-title">${this.escHtml(m.title || m.id)}</div>
              <div class="card-teaser" style="font-size:.7rem">${facetLine ? this.escHtml(facetLine) + ' · ' : ''}shared by ${this.escHtml(m.sharedAs || 'a reader')}</div>
            </div>`;
          });
          html += this.shelf('From fellow readers 🌱', cards);
        }
      } catch (e) { /* community shelf is best-effort */ }
    }

    // Interest testing: proposed concepts as clearly labeled ghost items — demand
    // is measured before anyone writes (the pre-mint stage of the elastic catalog)
    const ghosts = this._unvotedProposals();
    if (ghosts.length) {
      html += this.shelf('Should we write this? 🌱 Vote on proposed concepts',
        ghosts.slice(0, 4).map(p => this._ghostCardHtml(p, 'home')));
    }

    // 3. Told your way — facet-matched picks: unread tellings whose subspace best
    // covers the reader's target facets (local subspace scoring, no scenario needed)
    const target = this.user.getTargetFacets();
    const isDefaultTarget = Object.values(this.user.steerPrefs || {}).every(v => !v) && this.user.getAffinitySummary().total < 3;
    if (!isDefaultTarget) {
      const scored = this.allBlocks
        .filter(b => b.meta.type === 'spine' && !this.user.readBlocks.has(b.meta.id))
        .map(b => ({ b, s: this._facetMatch(b.meta, target) }))
        .filter(x => x.s >= 0.7)
        .sort((x, y) => y.s - x.s)
        .slice(0, 10);
      if (scored.length >= 3) html += this.shelf('🎛 Told your way', scored.map(x => this.cardHtml(x.b.meta)));
    }

    // 4. Quick reads
    const quickReads = this.allBlocks.filter(b => b.meta.type === 'spine' && b.meta.standalone && !this.user.readBlocks.has(b.meta.id)).slice(0, 10);
    if (quickReads.length) {
      html += this.shelf('Quick reads', quickReads.map(b => this.cardHtml(b.meta)));
    }

    // 5. Liked items (if any)
    const liked = [...this.user.ratings].filter(([_, r]) => r >= 0.7).map(([id]) => this.findBlock(id)).filter(Boolean);
    if (liked.length) {
      html += this.shelf('&#10084; Your liked', liked.reverse().map(b => this.cardHtml(b.meta)));
    }

    // 6. Saved items (if any)
    const saved = [...this.user.savedBlocks].map(id => this.findBlock(id)).filter(Boolean);
    if (saved.length) {
      html += this.shelf('&#128278; Saved for later', saved.reverse().map(b => this.cardHtml(b.meta)));
    }

    // 7. Topic carousels (pick top 3 topics user hasn't explored much)
    const topicEntries = Object.entries(this.topicIndex).filter(([_, ids]) => ids.length >= 3).sort((a, b) => b[1].length - a[1].length);
    const shownTopics = new Set();
    topicEntries.slice(0, 6).forEach(([topic, ids]) => {
      if (shownTopics.size >= 3) return;
      const topicBlocks = ids.map(id => this.findBlock(id)).filter(Boolean).slice(0, 10);
      if (topicBlocks.length >= 3) {
        html += this.shelf(topic, topicBlocks.map(b => this.cardHtml(b.meta)));
        shownTopics.add(topic);
      }
    });

    // 8. By chapter (unread first)
    this.book.chapters.forEach((ch, i) => {
      const allSpines = (this.chapters[i]?.blocks || []).filter(b => b.type === 'spine');
      const unread = allSpines.filter(b => !this.user.readBlocks.has(b.id));
      const read = allSpines.filter(b => this.user.readBlocks.has(b.id));
      const chBlocks = [...unread, ...read].slice(0, 8);
      if (chBlocks.length) {
        html += this.shelf(`Ch${ch.number}: ${ch.title}`, chBlocks.map(b => this.cardHtml(b)));
      }
    });

    el.innerHTML = html || '<div class="search-empty">Loading content...</div>';
    // Update arrows multiple times to catch layout settling
    this._updateShelfArrows();
    setTimeout(() => this._updateShelfArrows(), 200);
    setTimeout(() => this._updateShelfArrows(), 600);
  }

  shelf(title, cardHtmls) {
    const id = 'shelf-' + (this._shelfCounter = (this._shelfCounter || 0) + 1);
    return `<section class="shelf fade-up">
      <div class="shelf-head"><h3 class="shelf-title">${title}</h3></div>
      <div class="shelf-wrap">
        <button class="shelf-btn shelf-btn-left arrow-hidden" onclick="app.scrollShelf('${id}',-1)">&#8249;</button>
        <div class="shelf-scroll" id="${id}">${cardHtmls.join('')}</div>
        <button class="shelf-btn shelf-btn-right arrow-hidden" onclick="app.scrollShelf('${id}',1)">&#8250;</button>
      </div>
    </section>`;
  }

  scrollShelf(id, dir) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollBy({ left: dir * 300, behavior: 'smooth' });
    // Update arrows after scroll animation
    setTimeout(() => {
      const wrap = el.closest('.shelf-wrap');
      if (wrap) this._updateArrowVisibility(wrap, el);
    }, 350);
  }

  // Show/hide shelf arrows based on scroll position
  _updateShelfArrows() {
    document.querySelectorAll('.shelf-wrap').forEach(wrap => {
      const scroll = wrap.querySelector('.shelf-scroll');
      if (!scroll) return;
      const overflows = scroll.scrollWidth > scroll.clientWidth + 10;
      wrap.classList.toggle('no-scroll', !overflows);
      if (!overflows) {
        // No overflow: hide both arrows completely
        wrap.querySelectorAll('.shelf-btn').forEach(b => b.classList.add('arrow-hidden'));
      } else {
        this._updateArrowVisibility(wrap, scroll);
      }
    });
    // Listen for scroll to update arrows dynamically
    document.querySelectorAll('.shelf-scroll').forEach(scroll => {
      if (scroll.dataset.arrowBound) return;
      scroll.dataset.arrowBound = '1';
      scroll.addEventListener('scroll', () => {
        const wrap = scroll.closest('.shelf-wrap');
        if (wrap) this._updateArrowVisibility(wrap, scroll);
      }, { passive: true });
    });
  }

  _updateArrowVisibility(wrap, scroll) {
    const left = wrap.querySelector('.shelf-btn-left');
    const right = wrap.querySelector('.shelf-btn-right');
    if (!left || !right) return;
    // scrollLeft can be offset by padding/snap — use generous threshold
    const sl = Math.round(scroll.scrollLeft);
    const pad = parseFloat(getComputedStyle(scroll).paddingLeft) || 16;
    const canScrollLeft = sl > pad + 2;
    const canScrollRight = sl + scroll.clientWidth < scroll.scrollWidth - pad - 2;
    left.classList.toggle('arrow-hidden', !canScrollLeft);
    right.classList.toggle('arrow-hidden', !canScrollRight);
  }

  _isNew(block) {
    if (!block.publishedAt) return false;
    const pub = new Date(block.publishedAt);
    const age = Date.now() - pub.getTime();
    return age < 30 * 24 * 60 * 60 * 1000; // 30 days
  }

  // Netflix tiles deserve artwork: first in-body image (comics, kids, photos),
  // else the section's diagram file. Returns a URL or null.
  _blockArt(block, body) {
    const m = (body || '').match(/!\[[^\]]*\]\((images\/[^)\s]+\.(?:svg|png|jpe?g|webp))\)/);
    if (m) return m[1];
    if (block.diagram && DIAGRAM_FILES[block.diagram]) return DIAGRAM_FILES[block.diagram];
    return null;
  }

  cardHtml(block, hero = false) {
    const chLabel = block._chapterTitle || this.getChapterLabel(block);
    const isRead = this.user.readBlocks.has(block.id);
    const isNew = this._isNew(block);
    const badge = block.type === 'depth' ? `<span class="card-badge ${block.voice}">${CONFIG.voices[block.voice]?.label || block.voice}</span>` : '';
    const newBadge = isNew ? '<span class="card-badge-new">NEW</span>' : '';
    const teaser = block.teaser ? `<div class="card-teaser">${block.teaser}</div>` : '';

    // Visual preview strip: detect content type from body
    const fullBlock = this.findBlock(block.id);
    const body = fullBlock?.body || block.body || '';
    const hasMath = /\$\$/.test(body);
    const hasTable = /^\|/m.test(body);
    const hasDiagram = !!block.diagram;
    const hasCode = /```/.test(body);

    const art = this._blockArt(block, body);

    let preview = '';
    if (hasDiagram || hasMath || hasTable || hasCode) {
      const tags = [];
      if (hasDiagram) tags.push('<span class="card-tag tag-diagram">&#128202; Diagram</span>');
      if (hasMath) tags.push('<span class="card-tag tag-math">&#8721; Math</span>');
      if (hasTable) tags.push('<span class="card-tag tag-table">&#9638; Table</span>');
      if (hasCode) tags.push('<span class="card-tag tag-code">&lt;/&gt; Code</span>');
      preview = `<div class="card-tags">${tags.join('')}</div>`;
    }

    // Voice-colored top border for depth cards
    const borderStyle = block.type === 'depth' && block.voice ? `border-top: 3px solid var(--${block.voice})` : '';

    // Topic tags
    const topics = (this.blockTopics[block.id] || []).slice(0, 2);
    const topicHtml = topics.length ? `<div class="card-topics">${topics.map(t => `<span class="card-topic" onclick="event.stopPropagation();app.showTopic('${t}')">${t}</span>`).join('')}</div>` : '';

    return `<div class="card ${hero ? 'card-hero' : ''} ${isRead ? 'card-read' : ''} ${art ? 'card-has-art' : ''}" style="${borderStyle}" onclick="app.openBlock('${block.id}')">
      ${art ? `<img class="card-art" src="${art}" alt="" loading="lazy" onerror="this.remove()">` : ''}
      ${preview}
      <div class="card-chapter">${chLabel}</div>
      <div class="card-title">${block.title}</div>
      ${teaser}
      ${topicHtml}
      <div class="card-meta">${newBadge}${badge}<span class="card-time">${block.readingTime || 3} min</span></div>
    </div>`;
  }

  cardFromRec(rec) {
    const block = this.findBlock(rec.id);
    if (block) return this.cardHtml(block.meta);
    return ''; // skip items that don't exist in the current book
  }

  getContinueBlock() {
    // Find next unread spine block after last read position
    for (let ci = this.user.currentChapter; ci < this.book.chapters.length; ci++) {
      const ch = this.chapters[ci];
      if (!ch) continue;
      const spines = ch.blocks.filter(b => b.type === 'spine');
      const next = spines.find(b => !this.user.readBlocks.has(b.id));
      if (next) return next;
    }
    return null;
  }

  // ===== READ VIEW (infinite scroll) =====
  async renderRead(chapterIdx) {
    const idx = chapterIdx !== undefined ? chapterIdx : this.user.currentChapter;
    const ch = this.chapters[idx];
    if (!ch) return;
    this.user.currentChapter = idx;
    this.user.save();

    const pane = document.getElementById('readPane');

    // Reset observer for fresh render
    if (this._observer) { this._observer.disconnect(); this._observer = null; }
    if (this._dwellTimers) { Object.values(this._dwellTimers).forEach(t => clearInterval(t)); this._dwellTimers = {}; }
    this._observedChapters = {};

    // Render current chapter
    const html = await this._renderChapterContent(ch, idx);
    pane.innerHTML = html;
    this._renderedChapter = idx;
    this._loadedChapters = new Set([idx]);

    // Set up infinite scroll — load more content when near bottom
    this._setupInfiniteScroll(pane, idx);

    // Scroll: if pending scroll (from openBlock), go to that block; otherwise top
    if (this._pendingScroll) {
      this._scrollToBlock(this._pendingScroll.parentId, this._pendingScroll.meta);
      this._pendingScroll = null;
    } else {
      window.scrollTo(0, 0);
    }

    // Render math, observe blocks, init animations
    this.renderMath();
    this._initLottieAnimations();
    this._observeBlocks(ch);
    this._applyTellingChoices();   // re-apply saved per-concept telling choices
    this._updateMissionBar();
    this._showMissionIntro();
  }

  async _renderChapterContent(ch, idx) {
    let html = `<div class="ch-head fade-up" id="ch-head-${idx}"><div class="ch-label">Chapter ${ch.number}</div><h2>${ch.title}</h2><div class="ch-sub">${ch.subtitle}</div></div>`;

    let spineCount = 0;
    for (const block of ch.blocks) {
      if (block.type === 'spine') {
        html += await this.renderSpine(block);
        spineCount++;
        // Interest-testing interstitial: one proposed-concept card per chapter
        if (spineCount === 4) {
          const gp = this._unvotedProposals();
          if (gp.length) {
            const pick = gp[idx % gp.length];
            html += `<div class="fade-up" style="margin:1.2em 0;display:flex;justify-content:center">${this._ghostCardHtml(pick, 'feed' + idx)}</div>`;
          }
        }
        // Insert inline quiz every 2-3 spine blocks
        if (spineCount % 3 === 0) {
          const quizHtml = this._generateQuiz(block);
          if (quizHtml) html += `<div class="inline-quiz fade-up">${quizHtml}</div>`;
        }
      } else if (block.type === 'question') {
        html += this.renderQuestion(block);
      } else if (block.type === 'game' && this._f('games')) {
        html += this.renderGame(block);
      }
    }
    return html;
  }

  _setupInfiniteScroll(pane, startIdx) {
    if (this._scrollHandler) window.removeEventListener('scroll', this._scrollHandler);
    this._isLoadingMore = false;
    this._feedShownBlocks = new Set(this.chapters[startIdx]?.blocks.map(b => b.id) || []);

    this._scrollHandler = async () => {
      if (this._isLoadingMore || this.currentView !== 'read') return;
      const scrollBottom = window.innerHeight + window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      if (scrollBottom < docHeight - 600) return;

      this._isLoadingMore = true;
      const nextBlocks = await this._getNextFeedBlocks(3);
      if (nextBlocks.length) {
        for (const block of nextBlocks) {
          if (this._feedShownBlocks.has(block.meta.id)) continue;
          this._feedShownBlocks.add(block.meta.id);
          const ch = this.chapters[block.meta._chapterIdx];
          // Chapter divider if different chapter
          const lastCh = this._lastFeedChapter;
          if (ch && ch.id !== lastCh) {
            pane.insertAdjacentHTML('beforeend', `<div class="feed-ch-divider fade-up"><span>Ch${ch.number}: ${ch.title}</span></div>`);
            this._lastFeedChapter = ch.id;
          }
          const html = block.meta.type === 'game' ? this.renderGame(block.meta) : await this.renderSpine(block.meta);
          pane.insertAdjacentHTML('beforeend', html);
          // Observe for dwell tracking
          if (ch) {
            if (!this._observedChapters[block.meta.id]) this._observedChapters[block.meta.id] = ch;
            const el = document.getElementById(`b-${block.meta.id}`);
            if (el && !el.dataset.observed) { el.dataset.observed = '1'; this._observer?.observe(el); }
          }
        }
        this.renderMath();
        this._initLottieAnimations();
      }
      this._isLoadingMore = false;
    };

    this._lastFeedChapter = this.chapters[startIdx]?.id;
    window.addEventListener('scroll', this._scrollHandler, { passive: true });
  }

  async _getNextFeedBlocks(count) {
    const shown = this._feedShownBlocks || new Set();
    let blocks = [];

    // Try Recombee for personalized recommendations
    if (this.rc.enabled && this._f('personalization')) {
      const result = await this.rc.getRecsForUser('next-read', count * 3, this.rc.reql({ type: 'spine' }), this.rc.reqlBoost(this.user));
      if (result?.recomms?.length) {
        for (const r of result.recomms) {
          if (shown.has(r.id)) continue;
          const block = this.findBlock(r.id);
          if (block) { blocks.push(block); if (blocks.length >= count) break; }
        }
      }
    }

    // Fallback: sequential not-yet-shown blocks, voice-preferred, unread first
    if (blocks.length < count) {
      const voice = this.user.preferredVoice;
      const candidates = this.allBlocks.filter(b =>
        (b.meta.type === 'spine' || (b.meta.type === 'game' && this._f('games'))) &&
        !shown.has(b.meta.id) && !blocks.find(x => x.meta.id === b.meta.id)
      );
      // Sort: unread first, then by voice preference
      candidates.sort((a, b) => {
        const aRead = this.user.readBlocks.has(a.meta.id) ? 1 : 0;
        const bRead = this.user.readBlocks.has(b.meta.id) ? 1 : 0;
        if (aRead !== bRead) return aRead - bRead;
        if (voice && voice !== 'universal') {
          const av = a.meta.voice === voice ? 0 : a.meta.voice === 'universal' ? 1 : 2;
          const bv = b.meta.voice === voice ? 0 : b.meta.voice === 'universal' ? 1 : 2;
          return av - bv;
        }
        return 0;
      });
      for (const b of candidates) {
        blocks.push(b);
        if (blocks.length >= count) break;
      }
    }

    return blocks;
  }

  // (moved inline to renderRead)

  _observeBlocks(ch) {
    // Dwell-time tracking: seen after 3s visible, read after estimated reading time
    // Create observer once; on subsequent calls just observe new elements
    if (!this._observer) {
      this._dwellTimers = {};
      this._observedChapters = {};
    }
    // Store chapter blocks for lookup
    ch.blocks.forEach(b => { this._observedChapters[b.id] = ch; });

    if (!this._observer) {
    this._observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const id = e.target.id?.replace('b-', '');
        if (!id) return;

        if (e.isIntersecting) {
          // Start dwell timer — find block from any loaded chapter
          const ownerCh = this._observedChapters[id];
          const block = ownerCh ? ownerCh.blocks.find(b => b.id === id) : null;
          const readTimeMs = Math.min(((block?.readingTime || 2) * 60 * 1000) * 0.15, 12000); // 15% of reading time, max 12s — kids read fast!
          const startTime = Date.now();

          this._dwellTimers[id] = setInterval(() => {
            const elapsed = Date.now() - startTime;

            // After 3s: mark as "seen" + update sidebar context
            if (elapsed >= 3000) this._armFeedbackBar(id);   // start the feedback bar's fade window
            if (elapsed >= 3000 && !this.user.seenBlocks.has(id)) {
              this.user.trackSeen(id);
              this.rc.sendView(id, Math.round(elapsed / 1000));
              e.target.querySelector('.block-status')?.classList.add('seen');
              this._lastVisibleBlock = id;
              // context panel removed
            }

            // After reading time: mark as "read"
            if (elapsed >= readTimeMs && !this.user.readBlocks.has(id)) {
              this.user.trackRead(id, block?.voice, this._blockFacets(block));
              this.rc.sendView(id, Math.round(elapsed / 1000));
              e.target.querySelector('.block-status')?.classList.remove('seen');
              e.target.querySelector('.block-status')?.classList.add('read');
              // context panel removed
              this._updateInlineReadNext(id, ownerCh);
              this._insertInlineRecall(id);
              this.showXPToast('+10 XP', 'xp');
              this.checkGamificationEvents();
              this._updateMissionBar();
              clearInterval(this._dwellTimers[id]);
            }

            // Track dwell every 5s
            if (elapsed % 5000 < 1100) {
              this.user.trackDwell(id, 5000);
            }
          }, 1000);

        } else {
          // Block left viewport: stop timer
          if (this._dwellTimers[id]) {
            clearInterval(this._dwellTimers[id]);
            delete this._dwellTimers[id];
          }
        }
      });
    }, { threshold: 0.05 }); // low threshold so tall blocks with diagrams still trigger
    } // end if (!this._observer)

    // Observe all block articles (new ones will just be added)
    document.querySelectorAll('.block-article').forEach(el => {
      if (!el.dataset.observed) {
        el.dataset.observed = '1';
        this._observer.observe(el);
      }
    });
  }

  // Highlights come exclusively from frontmatter `highlights` array — no auto-generation
  _getHighlights(block) {
    if (block.highlights && Array.isArray(block.highlights) && block.highlights.length) return block.highlights;
    return null;
  }

  async renderSpine(block) {
    // Accepted remix? render YOUR version under the ORIGINAL block id.
    let overrideBar = '';
    const ovId = this._overrides?.[block.id];
    if (ovId && this.privateBlocks?.[ovId]) {
      const ov = this.privateBlocks[ovId];
      if (this._overridesOff().has(block.id)) {
        // original shown, edit kept safe — switching back is one click
        overrideBar = `<div class="override-bar">📄 Original — your edited version is saved
          · <a href="#" onclick="event.preventDefault();app.toggleOverride('${block.id}')">✨ show your version</a>
          · <a href="#" style="color:#B91C1C" onclick="event.preventDefault();app.discardOverride('${block.id}')">🗑 discard your edits (permanent)</a></div>`;
      } else {
        block = { ...block, body: ov.body, diagramSvg: ov.meta.diagramSvg || block.diagramSvg };
        overrideBar = `<div class="override-bar">✨ Your accepted version — changes are <mark class="remix-mark">highlighted</mark>
          · <a href="#" onclick="event.preventDefault();app.toggleOverride('${block.id}')">↩ show original</a>
          ${ov.meta.state !== 'community' ? `· <a href="#" onclick="event.preventDefault();app._showShareConsent('${ovId}')">📣 share with readers &amp; editors</a>` : '· ⚡ shared'}</div>`;
      }
    }
    let bodyHtml = renderMarkdown(block.body);
    // Remixed passages carry ⟦rx⟧…⟦/rx⟧ markers — render as visible "changed by you" marks
    if (bodyHtml.includes('⟦rx⟧')) {
      bodyHtml = bodyHtml.replace(/⟦rx⟧/g, '<mark class="remix-mark" title="Remixed passage — changed from the original">')
                         .replace(/⟦\/rx⟧/g, '</mark>');
    }
    let diagramHtml = '';
    if (block.diagramSvg) {
      // reader-remixed diagram (private/community copy) — sanitized inline SVG override
      diagramHtml = `<div class="diagram-wrap diagram-remixed" id="dg-${block.id}">${this._sanitizeSvgClient(block.diagramSvg) || ''}${this._diagramRemixBtn(block)}</div>`;
    } else if (block.diagram) {
      const svg = await getDiagram(block.diagram);
      diagramHtml = `<div class="diagram-wrap" id="dg-${block.id}">${svg}${this._diagramRemixBtn(block)}</div>`;
    }
    const isRead = this.user.readBlocks.has(block.id);
    const userNotes = this.getNotes(block.id);
    const highlights = CONFIG.features.highlights !== false ? this._getHighlights(block) : null;

    // Side notes — AI takeaways + user highlights/notes
    let sideHtml = '';
    const sideItems = [];
    if (highlights) highlights.forEach(h => sideItems.push({ text: h, type: 'ai' }));
    userNotes.forEach((n, i) => sideItems.push({ quote: n.quote, text: n.text, type: 'user', idx: i }));
    if (sideItems.length) {
      sideHtml = `<div class="block-side" id="side-${block.id}">`;
      sideItems.forEach(n => sideHtml += this._renderSideNote(block.id, n));
      sideHtml += '</div>';
    }

    const chNum = block._chapterNum || '?';
    const chTitle = block._chapterTitle || '';
    // Position within chapter
    const ch = this.chapters[block._chapterIdx];
    const chSpines = ch ? ch.blocks.filter(b => b.type === 'spine') : [];
    const posInCh = chSpines.findIndex(b => b.id === block.id) + 1;
    const totalInCh = chSpines.length;

    return `<article class="block-article fade-up" id="b-${block.id}">
      ${overrideBar}
      <div class="block-nav">
        <button class="bnav-back" onclick="app.goBack()" title="Go back">&larr;</button>
        <span class="bnav-ch" onclick="app.goToMapChapter(${block._chapterIdx})">Ch${chNum}</span>
        <span class="bnav-sep">&middot;</span>
        <span class="bnav-progress">${posInCh}/${totalInCh}</span>
        ${block.core ? '<span class="bnav-core">CORE</span>' : ''}
        <div class="block-status ${isRead ? 'read' : this.user.seenBlocks.has(block.id) ? 'seen' : ''}"></div>
      </div>
      <div class="block-header">
        <h3>${block.title}</h3>
        <div class="block-meta">
          <span>${block.readingTime || 3} min read</span>
        </div>
      </div>
      ${this._renderTellingsIndicator(block)}
      <div class="block-with-side">
        <div class="block-main">
          ${diagramHtml}
          <div class="spine-body">${bodyHtml}</div>
        </div>
        ${sideHtml}
      </div>
      ${block.keyTakeaway ? `<div class="key-takeaway"><div class="key-takeaway-label">Key Takeaway</div><div class="key-takeaway-text">${block.keyTakeaway}</div></div>` : ''}
      ${this._renderFeedbackBar(block)}
      <div class="block-footer">
        <div class="block-reactions" data-block="${block.id}">
          <button class="like-btn ${this.user.ratings.get(block.id)>=0.7?'liked':''}" onclick="app.toggleLike('${block.id}')">
            ${this.user.ratings.get(block.id)>=0.7?'&#10084;&#65039;':'&#9825;'}
            <span>${this.user.ratings.get(block.id)>=0.7?'Liked':'Like'}</span>
          </button>
        </div>
        <div class="block-actions">
          <button class="improve-btn" onclick="app.improveBlock('${block.id}')" title="Edit this section yourself, or let AI rewrite it">&#9999;&#65039; Improve</button>
          <button class="act-btn tutor-btn" onclick="app.askAboutBlock('${block.id}')" title="Ask the tutor">&#10067;</button>
          <button class="act-btn" onclick="app.toggleNote('${block.id}')" title="Add note">&#128221;</button>
          ${this.user.recall[block.id] ? `<button class="act-btn" onclick="app.showBlockRecall('${block.id}')" title="Test your memory">&#129504;</button>` : ''}
          <button class="act-btn ${this.user.savedBlocks.has(block.id)?'active':''}" onclick="app.saveBlock('${block.id}')" title="Save for later">&#128278;</button>
          <button class="act-btn share-btn" onclick="app.shareBlock('${block.id}')" title="Share">&#128279;</button>
          <button class="act-btn flag-btn" onclick="app.flagBlock('${block.id}')" title="Suggest edit to author">&#9873;</button>
        </div>
      </div>
      <div class="note-editor" id="note-${block.id}" style="display:none">
        <div class="note-quote-preview" id="note-quote-${block.id}" style="display:none"></div>
        <textarea placeholder="Your note on this section..." id="note-text-${block.id}"></textarea>
        <input type="hidden" id="note-edit-idx-${block.id}" value="-1">
        <div class="note-actions">
          <button class="note-save" onclick="app.saveNote('${block.id}')">Save note</button>
          <button class="note-cancel" onclick="app.toggleNote('${block.id}')">Cancel</button>
        </div>
      </div>
      <div class="flag-form" id="flag-${block.id}" style="display:none">
        <div class="flag-header">Suggest edit to author</div>
        <select id="flag-type-${block.id}">
          <option value="typo">Typo / formatting issue</option>
          <option value="unclear">Content is unclear</option>
          <option value="incorrect">Factual issue</option>
          <option value="suggestion">Content suggestion</option>
          <option value="missing">Something is missing</option>
        </select>
        <textarea id="flag-text-${block.id}" placeholder="Your feedback (private, only visible to authors)..."></textarea>
        <div class="note-actions">
          <button class="note-save" onclick="app.submitFlag('${block.id}')">Send to authors</button>
          <button class="note-cancel" onclick="app.flagBlock('${block.id}')">Cancel</button>
        </div>
      </div>
    </article>`;
  }

  // Notes system — multiple notes per block, each with optional quote
  getNotes(blockId) {
    try {
      const store = JSON.parse(localStorage.getItem('pbook-notes') || '{}');
      const val = store[blockId];
      if (!val) return [];
      // Backwards compat: old format was a single string
      if (typeof val === 'string') return [{ text: val, quote: '', ts: 0 }];
      return Array.isArray(val) ? val : [];
    } catch(e) { return []; }
  }
  _saveNotes(blockId, notesArr) {
    try {
      const store = JSON.parse(localStorage.getItem('pbook-notes') || '{}');
      if (notesArr.length) store[blockId] = notesArr;
      else delete store[blockId];
      localStorage.setItem('pbook-notes', JSON.stringify(store));
    } catch(e) {}
  }
  toggleNote(blockId) {
    const ed = document.getElementById(`note-${blockId}`);
    if (!ed) return;
    const visible = ed.style.display !== 'none';
    ed.style.display = visible ? 'none' : 'block';
    if (!visible) {
      // Reset editor for new note
      const textarea = ed.querySelector('textarea');
      const quotePreview = document.getElementById(`note-quote-${blockId}`);
      const idxInput = document.getElementById(`note-edit-idx-${blockId}`);
      if (idxInput) idxInput.value = '-1';
      if (textarea) { textarea.value = ''; textarea.focus(); }
      if (quotePreview) { quotePreview.style.display = 'none'; quotePreview.textContent = ''; }
    }
  }
  editUserNote(blockId, idx) {
    const notes = this.getNotes(blockId);
    const note = notes[idx];
    if (!note) return;
    const ed = document.getElementById(`note-${blockId}`);
    if (!ed) return;
    ed.style.display = 'block';
    const textarea = document.getElementById(`note-text-${blockId}`);
    const quotePreview = document.getElementById(`note-quote-${blockId}`);
    const idxInput = document.getElementById(`note-edit-idx-${blockId}`);
    if (textarea) { textarea.value = note.text || ''; textarea.focus(); }
    if (quotePreview && note.quote) { quotePreview.style.display = 'block'; quotePreview.textContent = `"${note.quote}"`; }
    else if (quotePreview) quotePreview.style.display = 'none';
    if (idxInput) idxInput.value = idx;
  }
  deleteUserNote(blockId, idx) {
    const notes = this.getNotes(blockId);
    notes.splice(idx, 1);
    this._saveNotes(blockId, notes);
    this._refreshSideNotes(blockId);
  }
  saveNote(blockId) {
    const text = document.getElementById(`note-text-${blockId}`)?.value?.trim() || '';
    const idxInput = document.getElementById(`note-edit-idx-${blockId}`);
    const editIdx = idxInput ? parseInt(idxInput.value) : -1;
    const quotePreview = document.getElementById(`note-quote-${blockId}`);
    const quote = quotePreview?.textContent?.replace(/^"|"$/g, '') || '';

    const notes = this.getNotes(blockId);
    if (editIdx >= 0 && editIdx < notes.length) {
      // Editing existing note
      if (text) { notes[editIdx].text = text; }
      else { notes.splice(editIdx, 1); } // empty = delete
    } else if (text || quote) {
      // New note
      notes.push({ quote: quote.substring(0, 200), text, ts: Date.now() });
      this.user.trackNote(blockId);
      if (this._f('gamification')) { this.user.addXP(3); this.user.save(); this.showXPToast('+3 XP note added'); this.updateXPBadge(); }
    }
    this._saveNotes(blockId, notes);
    this.toggleNote(blockId);
    this._refreshSideNotes(blockId);
  }
  _renderSideNote(blockId, n) {
    const icon = n.type === 'user' ? '\u{1F4DD}' : '\u{1F4CC}';
    const searchText = n.type === 'user' ? (n.quote || '') : (typeof n.text === 'string' ? n.text : String(n.text || ''));
    const clickAttr = searchText ? ` onclick="app.scrollToHighlight('${blockId}','${searchText.substring(0, 60).replace(/'/g, "\\'").replace(/\n/g, ' ')}')"` : '';
    if (n.type === 'user') {
      const quoteHtml = n.quote ? `<span class="snote-quote">"${this.escHtml(n.quote)}"</span>` : '';
      const noteHtml = n.text ? `<span class="snote-text">${this.escHtml(n.text)}</span>` : '';
      return `<div class="snote snote-user"${clickAttr}><span class="snote-icon">${icon}</span><div class="snote-body">${quoteHtml}${noteHtml}</div><button class="snote-edit" onclick="event.stopPropagation();app.editUserNote('${blockId}',${n.idx})">edit</button><button class="snote-del" onclick="event.stopPropagation();app.deleteUserNote('${blockId}',${n.idx})">&times;</button></div>`;
    }
    return `<div class="snote snote-ai"${clickAttr}><span class="snote-icon">${icon}</span><span class="snote-text">${this.escHtml(n.text)}</span></div>`;
  }

  _refreshSideNotes(blockId) {
    const block = this.findBlock(blockId);
    if (!block) return;
    const userNotes = this.getNotes(blockId);
    const highlights = CONFIG.features.highlights !== false ? this._getHighlights(block.meta || block) : null;
    const sideItems = [];
    if (highlights) highlights.forEach(h => sideItems.push({ text: h, type: 'ai' }));
    userNotes.forEach((n, i) => sideItems.push({ quote: n.quote, text: n.text, type: 'user', idx: i }));

    let sideEl = document.getElementById(`side-${blockId}`);
    const article = document.getElementById(`b-${blockId}`);
    if (!article) return;

    if (!sideItems.length) {
      if (sideEl) sideEl.remove();
      return;
    }

    let html = '';
    sideItems.forEach(n => html += this._renderSideNote(blockId, n));

    if (sideEl) {
      sideEl.innerHTML = html;
    } else {
      const wrapper = article.querySelector('.block-with-side');
      if (wrapper) {
        sideEl = document.createElement('div');
        sideEl.className = 'block-side';
        sideEl.id = `side-${blockId}`;
        sideEl.innerHTML = html;
        wrapper.appendChild(sideEl);
      }
    }
  }

  // Flag/report system
  flagBlock(blockId) {
    const form = document.getElementById(`flag-${blockId}`);
    if (!form) return;
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }
  submitFlag(blockId) {
    const type = document.getElementById(`flag-type-${blockId}`)?.value;
    const text = document.getElementById(`flag-text-${blockId}`)?.value?.trim();
    if (!text) return;
    try {
      const flags = JSON.parse(localStorage.getItem('pbook-flags') || '[]');
      flags.push({ blockId, type, text, timestamp: new Date().toISOString() });
      localStorage.setItem('pbook-flags', JSON.stringify(flags));
    } catch(e) {}
    // reported issues feed the editor track (editorship is earned)
    if (this._f('gamification')) { this.user.addXP(5); this.user.save(); this.updateXPBadge(); }
    this.rc.logEvent('flag', { blockId, type, text: (text || '').slice(0, 300) });
    this.flagBlock(blockId); // close form
    // Show confirmation
    const form = document.getElementById(`flag-${blockId}`);
    if (form) {
      form.style.display = 'block';
      form.innerHTML = '<div style="padding:.8em;color:var(--product);font-size:.85rem">Thanks! +5 XP — reported issues count toward your 🛠 Editor track.</div>';
      setTimeout(() => { form.style.display = 'none'; }, 2500);
    }
  }

  escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // Initialize Lottie animations in rendered content
  _initLottieAnimations() {
    const init = () => {
      document.querySelectorAll('.lottie-anim:not([data-loaded])').forEach(el => {
        el.dataset.loaded = '1';
        lottie.loadAnimation({
          container: el,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: el.dataset.animationPath,
        });
      });
    };
    if (typeof lottie !== 'undefined') { init(); return; }
    // Lottie not loaded yet (defer) — wait for it
    const check = setInterval(() => {
      if (typeof lottie !== 'undefined') { clearInterval(check); init(); }
    }, 200);
    setTimeout(() => clearInterval(check), 10000); // give up after 10s
  }

  // ===== TEXT HIGHLIGHT & NOTE =====
  highlightSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    // Determine blockId from selection anchor before modifying DOM
    const article = sel.anchorNode?.parentElement?.closest('.block-article');
    const blockId = article?.id?.replace('b-', '');
    const text = sel.toString();
    try {
      const range = sel.getRangeAt(0);
      // Only wrap if selection is within a single parent (safe)
      // Cross-element highlighting breaks DOM structure
      if (range.startContainer.parentElement === range.endContainer.parentElement ||
          range.startContainer === range.endContainer) {
        const mark = document.createElement('mark');
        mark.className = 'user-highlight';
        range.surroundContents(mark);
      }
      // If cross-element: save the highlight data but skip visual markup
    } catch (e) { /* surroundContents failed — skip visual markup */ }
    if (blockId) {
      this._saveHighlight(blockId, text);
      this.rc.sendRating(blockId, 0.8);
      if (this._f('gamification')) { this.user.addXP(1); this.user.save(); this.showXPToast('+1 XP highlighted'); this.updateXPBadge(); }
    }
    sel.removeAllRanges();
    document.getElementById('highlightPopup').style.display = 'none';
  }

  highlightAndNote() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const quote = sel.toString().trim();
    // Determine blockId from the selection BEFORE highlightSelection clears it
    const anchor = sel.anchorNode?.parentElement?.closest('.block-article');
    const blockId = anchor?.id?.replace('b-', '');
    this.highlightSelection();
    if (blockId) {
      const ed = document.getElementById(`note-${blockId}`);
      if (ed) {
        ed.style.display = 'block';
        const textarea = document.getElementById(`note-text-${blockId}`);
        const quotePreview = document.getElementById(`note-quote-${blockId}`);
        const idxInput = document.getElementById(`note-edit-idx-${blockId}`);
        if (idxInput) idxInput.value = '-1';
        if (quotePreview && quote) { quotePreview.style.display = 'block'; quotePreview.textContent = `"${quote.substring(0, 200)}"`; }
        if (textarea) { textarea.value = ''; textarea.focus(); }
      }
    }
  }

  _saveHighlight(blockId, text) {
    try {
      const hl = JSON.parse(localStorage.getItem('pbook-highlights') || '{}');
      if (!hl[blockId]) hl[blockId] = [];
      hl[blockId].push({ text: text.substring(0, 200), ts: Date.now() });
      localStorage.setItem('pbook-highlights', JSON.stringify(hl));
    } catch (e) {}
  }

  scrollToHighlight(blockId, searchText) {
    if (!searchText) return;
    const article = document.getElementById(`b-${blockId}`);
    if (!article) return;
    const body = article.querySelector('.spine-body');
    if (!body) return;

    // 1. Try to find an existing <mark> that contains this text
    const marks = body.querySelectorAll('mark.user-highlight');
    for (const mark of marks) {
      if (mark.textContent.includes(searchText.substring(0, 30))) {
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        mark.classList.add('highlight-flash');
        setTimeout(() => mark.classList.remove('highlight-flash'), 1500);
        return;
      }
    }

    // 2. Fallback: find text in body via TreeWalker and wrap it temporarily
    const needle = searchText.substring(0, 60).toLowerCase();
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const idx = node.textContent.toLowerCase().indexOf(needle);
      if (idx === -1) continue;
      // Wrap the matched portion in a temporary highlight
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, Math.min(idx + searchText.length, node.textContent.length));
      const mark = document.createElement('mark');
      mark.className = 'user-highlight highlight-flash';
      try {
        range.surroundContents(mark);
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Remove the temporary mark after the flash
        setTimeout(() => {
          const parent = mark.parentNode;
          parent.replaceChild(document.createTextNode(mark.textContent), mark);
          parent.normalize();
        }, 2000);
      } catch(e) { /* range spans elements */ }
      return;
    }
  }

  // ===== MINI-GAMES (data-driven from games/*.json) =====
  renderGame(block) {
    const gameFile = block.game || block.gameType || block.id;
    return `<div class="game-block fade-up" id="b-${block.id}">
      <div class="game-header">
        <span class="game-icon">\u{1F3AE}</span>
        <h4>${block.title}</h4>
        <span class="game-timer" id="gt-${block.id}">1:00</span>
      </div>
      <div class="game-area" id="ga-${block.id}"></div>
      <button class="game-start-btn" onclick="app.startGame('${block.id}','${gameFile}')">Play!</button>
    </div>`;
  }

  async startGame(blockId, gameFile) {
    const area = document.getElementById(`ga-${blockId}`);
    const timerEl = document.getElementById(`gt-${blockId}`);
    const startBtn = area?.parentElement?.querySelector('.game-start-btn');
    if (!area) return;
    if (startBtn) startBtn.style.display = 'none';

    // Load game data from JSON
    let game;
    try {
      const res = await fetch(`games/${gameFile}.json`);
      game = await res.json();
    } catch (e) {
      area.innerHTML = '<div class="game-over">Could not load game.</div>';
      return;
    }

    // 60s timer
    let seconds = 60;
    if (this._activeGameTimer) clearInterval(this._activeGameTimer);
    this._activeGameTimer = setInterval(() => {
      seconds--;
      if (timerEl) timerEl.textContent = `0:${seconds.toString().padStart(2, '0')}`;
      if (seconds <= 10 && timerEl) timerEl.style.color = '#EF4444';
      if (seconds <= 0) {
        clearInterval(this._activeGameTimer);
        this._gameEnd(area, 'Time\'s up! Nice try.');
      }
    }, 1000);

    // Launch by type
    if (game.type === 'sort') this._gameSort(area, game);
    else if (game.type === 'match') this._gameMatch(area, game);
    else if (game.type === 'pop') this._gamePop(area, game);
    else if (game.type === 'order') this._gameOrder(area, game);
    else this._gameSort(area, game);
  }

  _gameEnd(area, msg) {
    if (this._activeGameTimer) clearInterval(this._activeGameTimer);
    area.innerHTML = `<div class="game-over">${msg} <b>+5 XP</b></div>`;
    this.user.addXP(5); this.user.save();
    this.showXPToast('+5 XP \u{1F3AE}', 'xp');
    this._updateMissionBar();
    setTimeout(() => {
      const block = area.closest('.game-block');
      if (block) { block.style.opacity = '.5'; block.style.pointerEvents = 'none'; }
    }, 2500);
  }

  // Sort game: classify items into two buckets
  _gameSort(area, game) {
    const items = [...game.items].sort(() => Math.random() - 0.5);
    let score = 0, idx = 0;
    const show = () => {
      if (idx >= items.length) { this._gameEnd(area, `Done! ${score}/${items.length} correct.`); return; }
      const item = items[idx++];
      area.innerHTML = `<div class="game-signal-card">${item.text}</div>
        <div class="game-buckets">${game.buckets.map((b, bi) =>
          `<button class="game-bucket ${bi === 0 ? 'strong' : 'weak'}" data-ans="${bi}">${b}</button>`
        ).join('')}</div>
        <div class="game-score">${score}/${idx - 1} correct</div>`;
      area.querySelectorAll('.game-bucket').forEach(btn => {
        btn.onclick = () => {
          area.querySelectorAll('.game-bucket').forEach(b => b.disabled = true);
          if (parseInt(btn.dataset.ans) === item.answer) { btn.classList.add('game-correct'); score++; }
          else btn.classList.add('game-wrong');
          setTimeout(show, 500);
        };
      });
    };
    show();
  }

  // Match game: find taste twin in a rating grid
  _gameMatch(area, game) {
    const items = game.items;
    const you = items.map(() => Math.ceil(Math.random() * 5));
    const users = game.users.map(name => ({
      name,
      ratings: items.map(() => Math.ceil(Math.random() * 5))
    }));
    const twin = Math.floor(Math.random() * users.length);
    users[twin].ratings = items.map((_, j) => Math.max(1, Math.min(5, you[j] + (Math.random() < 0.65 ? 0 : (Math.random() < 0.5 ? -1 : 1)))));

    let table = `<table class="game-table"><tr><th></th>${items.map(m => `<th>${m}</th>`).join('')}</tr>`;
    table += `<tr class="game-you"><td><b>You</b></td>${you.map(r => `<td>${'\u2B50'.repeat(r)}</td>`).join('')}</tr>`;
    users.forEach(u => { table += `<tr><td class="game-pick">${u.name}</td>${u.ratings.map(r => `<td>${'\u2B50'.repeat(r)}</td>`).join('')}</tr>`; });
    table += '</table>';
    area.innerHTML = `<div class="game-prompt">${game.instruction}</div>${table}`;
    area.querySelectorAll('.game-pick').forEach((td, i) => {
      td.onclick = () => {
        if (i === twin) { this._gameEnd(area, `Correct! ${users[twin].name} is your taste twin! That's collaborative filtering.`); }
        else { td.style.color = '#EF4444'; td.style.textDecoration = 'line-through'; }
      };
    });
  }

  // Pop game: click items to collect/escape
  _gamePop(area, game) {
    const cats = [...game.categories];
    const target = cats[Math.floor(Math.random() * cats.length)];
    const popped = new Set();
    const render = () => {
      area.innerHTML = `<div class="game-prompt">${game.instruction} Your bubble: <b>${target}</b> (${popped.size}/${cats.length - 1})</div>
        <div class="game-bubble-grid">${cats.sort(() => Math.random() - 0.5).map(c => {
          const done = popped.has(c);
          return `<button class="game-bubble-item ${c === target ? 'in-bubble' : ''} ${done ? 'popped' : ''}" ${done ? 'disabled' : ''}>${c}</button>`;
        }).join('')}</div>`;
      area.querySelectorAll('.game-bubble-item:not([disabled])').forEach(btn => {
        btn.onclick = () => {
          if (btn.textContent.trim() === target) { btn.classList.add('game-wrong'); }
          else { popped.add(btn.textContent.trim()); if (popped.size >= cats.length - 1) this._gameEnd(area, 'Bubble popped! Diversity wins!'); else render(); }
        };
      });
    };
    render();
  }

  // Order game: put steps in correct sequence
  _gameOrder(area, game) {
    const steps = game.steps;
    const shuffled = steps.map((text, i) => ({ text, order: i })).sort(() => Math.random() - 0.5);
    const selected = [];
    const render = () => {
      const remaining = shuffled.filter(s => !selected.includes(s));
      area.innerHTML = `<div class="game-prompt">${game.instruction}</div>
        <div class="game-pipeline-selected">${selected.map((s, i) => `<div class="game-pipe-step done">${i + 1}. ${s.text}</div>`).join('')}</div>
        <div class="game-pipeline-options">${remaining.map(s =>
          `<button class="game-pipe-btn">${s.text}</button>`
        ).join('')}</div>`;
      area.querySelectorAll('.game-pipe-btn').forEach(btn => {
        btn.onclick = () => {
          const step = remaining.find(s => s.text === btn.textContent);
          if (step && step.order === selected.length) {
            selected.push(step);
            if (selected.length >= steps.length) this._gameEnd(area, 'Perfect order! You nailed the pipeline!');
            else render();
          } else { btn.classList.add('game-wrong'); setTimeout(() => btn.classList.remove('game-wrong'), 400); }
        };
      });
    };
    render();
  }

  renderQuestion(block) {
    // Structured options in frontmatter
    if (block.options && Array.isArray(block.options)) {
      const opts = block.options.map(o => `<button class="q-opt" onclick="app.answerQ(this,'${o.voice || 'universal'}','${block.id}')"><span class="q-letter">${o.letter}</span><span>${o.text}</span></button>`).join('');
      return `<div class="q-block fade-up"><h4>${block.title}</h4><div class="q-desc">${block.description || ''}</div><div class="q-opts">${opts}</div></div>`;
    }
    // Body-based question: parse A/B/C/D options from markdown body
    if (block.body) {
      const bodyHtml = renderMarkdown(block.body);
      // Extract lettered options and create clickable buttons
      const optRegex = /\*\*([A-D])[):.]*\*{0,2}\s*"([^"]+)"/g;
      const voiceMap = { A: 'explorer', B: 'creator', C: 'thinker', D: 'universal' };
      const opts = [];
      let m;
      while ((m = optRegex.exec(block.body)) !== null) {
        opts.push({ letter: m[1], text: m[2].trim().substring(0, 80), voice: voiceMap[m[1]] || 'universal' });
      }
      if (opts.length >= 2) {
        const optsHtml = opts.map(o => `<button class="q-opt" onclick="app.answerQ(this,'${o.voice}','${block.id}')"><span class="q-letter">${o.letter}</span><span>${o.text}</span></button>`).join('');
        return `<div class="q-block fade-up" id="b-${block.id}"><div class="block-header"><h4>${block.title}</h4></div><div class="spine-body">${bodyHtml}</div><div class="q-opts">${optsHtml}</div></div>`;
      }
      // No parseable options — just render as article
      return `<article class="block-article fade-up" id="b-${block.id}"><div class="block-header"><h3>${block.title}</h3></div><div class="spine-body">${bodyHtml}</div></article>`;
    }
    return '';
  }

  // Inline "read next" below each article — shown after block is read
  renderReadNext(blockId, ch) {
    if (!ch || !Array.isArray(ch.blocks)) return '';   // generated/remixed blocks have no chapter entry
    const spines = ch.blocks.filter(b => b.type === 'spine');
    const currentIdx = spines.findIndex(b => b.id === blockId);
    const nextInChapter = spines[currentIdx + 1];

    // Find a personalized recommendation (different from sequential next)
    let recBlock = null;
    const unreadOther = this.allBlocks.filter(b =>
      b._chapter !== ch.id && b.meta.type === 'spine' && !this.user.readBlocks.has(b.meta.id) && b.meta.id !== nextInChapter?.id
    );
    // Prefer voice-matching blocks
    const voice = this.user.preferredVoice;
    if (voice && voice !== 'universal') {
      recBlock = unreadOther.find(b => b.meta.voice === voice) || unreadOther[0];
    } else {
      recBlock = unreadOther.sort(() => Math.random() - 0.5)[0];
    }

    let items = '';
    if (nextInChapter) {
      items += `<div class="rn-item" onclick="app.previewBlock('${nextInChapter.id}')"><span class="rn-label">Next</span><span class="rn-title">${nextInChapter.title}</span><span class="rn-time">${nextInChapter.readingTime || 3}m</span></div>`;
    }
    if (recBlock) {
      items += `<div class="rn-item rn-rec" onclick="app.previewBlock('${recBlock.meta.id}')"><span class="rn-label">\u2728 Recommended</span><span class="rn-title">${recBlock.meta.title}</span><span class="rn-time">Ch${recBlock.meta._chapterNum}</span></div>`;
    }
    if (!items) return '';

    // "More like this" — text similarity, dedup with next/recommended
    const excludeIds = new Set([blockId]);
    if (nextInChapter) excludeIds.add(nextInChapter.id);
    if (recBlock) excludeIds.add(recBlock.meta.id);
    const similar = this._findSimilarBlocks(blockId, 5).filter(s => !excludeIds.has(s.id)).slice(0, 3);
    if (similar.length) {
      items += '<div class="rn-similar"><div class="rn-similar-label">More like this</div>';
      similar.forEach(s => {
        const isRead = this.user.readBlocks.has(s.id);
        items += `<div class="rn-similar-item ${isRead ? 'rn-read' : ''}" onclick="app.previewBlock('${s.id}')">
          <span class="rn-similar-title">${s.title}</span>
          <span class="rn-similar-ch">Ch${s.chNum}</span>
        </div>`;
      });
      items += '</div>';
    }

    // For shared-link visitors: CTA to explore the full book
    if (this._sharedBlockId === blockId) {
      items += `<div class="rn-cta">
        <div class="rn-cta-text">Enjoyed this? There are ${this.allBlocks.filter(b => b.meta.type === 'spine').length} more sections to explore!</div>
        <button class="rn-cta-btn" onclick="app.showWelcome()">Explore the full book &rarr;</button>
      </div>`;
    }

    return `<div class="read-next" id="rn-${blockId}">${items}</div>`;
  }

  // Preview panel — shows teaser before navigating away
  shareBlock(blockId) {
    const block = this.findBlock(blockId);
    if (!block) return;
    const url = window.location.origin + window.location.pathname + '#' + blockId;

    navigator.clipboard.writeText(url).then(() => {
      this.showXPToast('Link copied!', 'info');
    }).catch(() => {
      prompt('Copy this link:', url);
    });
    this.rc.logEvent('share', { blockId, mode: 'share' });
  }

  shareMission(missionId) {
    const m = this.getMissions().find(x => x.id === missionId);
    if (!m) return;
    const url = window.location.origin + window.location.pathname + '#mission-' + missionId;

    navigator.clipboard.writeText(url).then(() => {
      this.showXPToast('Link copied!', 'info');
    }).catch(() => { prompt('Copy this link:', url); });
    this.rc.logEvent('share', { missionId, mode: 'share_mission' });
  }

  previewBlock(blockId) {
    const block = this.findBlock(blockId);
    if (!block) { this.openBlock(blockId); return; }
    const m = block.meta;
    const teaser = m.teaser || m.keyTakeaway || '';

    // Remove existing preview
    document.getElementById('previewPanel')?.remove();

    const panel = document.createElement('div');
    panel.id = 'previewPanel';
    panel.className = 'preview-panel';
    panel.innerHTML = `
      <div class="preview-content">
        <div class="preview-header">
          <span class="preview-ch">Ch${m._chapterNum}</span>
          <span class="preview-title">${m.title}</span>
          <button class="preview-close" onclick="document.getElementById('previewPanel').remove()">&times;</button>
        </div>
        <div class="preview-teaser">${this.escHtml(teaser)}${teaser.length >= 200 ? '...' : ''}</div>
        <div class="preview-actions">
          <button class="preview-go" onclick="document.getElementById('previewPanel').remove();app.openBlock('${blockId}')">Read this &rarr;</button>
          <button class="preview-dismiss" onclick="document.getElementById('previewPanel').remove()">Stay here</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
  }

  _updateInlineReadNext(blockId, ch) {
    const el = document.getElementById(`rn-${blockId}`);
    if (el) { el.classList.add('rn-visible'); return; }
    // Insert after the block article
    const article = document.getElementById(`b-${blockId}`);
    if (!article) return;
    const html = this.renderReadNext(blockId, ch);
    if (html) article.insertAdjacentHTML('afterend', html);
    // Show with animation
    setTimeout(() => document.getElementById(`rn-${blockId}`)?.classList.add('rn-visible'), 50);
  }



  showBlockRecall(blockId) {
    // Toggle recall card inline below this block
    const existing = document.getElementById(`block-recall-${blockId}`);
    if (existing) { existing.remove(); return; }
    const block = this._findAnyBlock(blockId);
    if (!block) return;
    const quiz = this._getRecallQuestion(block);
    if (!quiz) return;
    const article = document.getElementById(`b-${blockId}`);
    if (!article) return;
    const html = `<div class="inline-recall fade-up" id="block-recall-${blockId}">
      <div class="ir-header"><span class="ir-icon">\u{1F9E0}</span> Test your memory</div>
      <div class="ir-question">${quiz.q}</div>
      <div class="ir-answer" id="br-a-${blockId}" style="display:none">
        <div class="ir-answer-text">${quiz.a}</div>
        ${this.user.recall[blockId] ? `<div class="recall-buttons">
          <button class="recall-btn recall-forgot" onclick="app.scoreRecall('${blockId}',0,this)">Forgot</button>
          <button class="recall-btn recall-hard" onclick="app.scoreRecall('${blockId}',1,this)">Hard</button>
          <button class="recall-btn recall-good" onclick="app.scoreRecall('${blockId}',2,this)">Good</button>
          <button class="recall-btn recall-easy" onclick="app.scoreRecall('${blockId}',3,this)">Easy!</button>
        </div>` : `<button class="recall-reveal" onclick="document.getElementById('block-recall-${blockId}').remove()">Got it!</button>`}
      </div>
      <button class="recall-reveal" onclick="document.getElementById('br-a-${blockId}').style.display='block';this.style.display='none'">Show answer</button>
    </div>`;
    article.insertAdjacentHTML('afterend', html);
    document.getElementById(`block-recall-${blockId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  _insertInlineRecall(justReadId) {
    if (!this._f('spaceRepetition')) return;
    // Find a due or almost-due recall for a DIFFERENT block
    const now = Date.now();
    const soonThreshold = 30 * 60 * 1000;
    const due = Object.entries(this.user.recall)
      .filter(([id, c]) => id !== justReadId && c.nextReview <= now + soonThreshold)
      .sort((a, b) => a[1].nextReview - b[1].nextReview)
      .map(([blockId, card]) => ({ blockId, ...card }));
    if (!due.length) return;
    const r = due[0];
    const block = this._findAnyBlock(r.blockId);
    if (!block) return;
    const quiz = this._getRecallQuestion(block);
    if (!quiz) return;
    // Don't insert if one already exists for this block
    if (document.getElementById(`inline-recall-${r.blockId}`)) return;
    const article = document.getElementById(`b-${justReadId}`);
    if (!article) return;
    // Find the read-next div to insert after it, or after the article
    const readNext = document.getElementById(`rn-${justReadId}`);
    const insertAfter = readNext || article;
    const html = `<div class="inline-recall fade-up" id="inline-recall-${r.blockId}">
      <div class="ir-header"><span class="ir-icon">\u{1F9E0}</span> Do you remember?</div>
      <div class="ir-question">${quiz.q}</div>
      <div class="ir-answer" id="ir-a-${r.blockId}" style="display:none">
        <div class="ir-answer-text">${quiz.a}</div>
        <div class="ir-from">From: ${block.meta.title}</div>
        <div class="recall-buttons">
          <button class="recall-btn recall-forgot" onclick="app.scoreRecall('${r.blockId}',0,this)">Forgot</button>
          <button class="recall-btn recall-hard" onclick="app.scoreRecall('${r.blockId}',1,this)">Hard</button>
          <button class="recall-btn recall-good" onclick="app.scoreRecall('${r.blockId}',2,this)">Good</button>
          <button class="recall-btn recall-easy" onclick="app.scoreRecall('${r.blockId}',3,this)">Easy!</button>
        </div>
      </div>
      <button class="recall-reveal" onclick="document.getElementById('ir-a-${r.blockId}').style.display='block';this.style.display='none'">Hmm... Show answer!</button>
    </div>`;
    insertAfter.insertAdjacentHTML('afterend', html);
  }

  _recallCardHtml(r) {
    const block = this._findAnyBlock(r.blockId);
    if (!block) return '';
    const quiz = this._getRecallQuestion(block);
    if (!quiz) return '';
    return `<div class="card recall-card" style="border-top: 3px solid var(--warn); flex: 0 0 280px">
      <div class="card-chapter" style="color:var(--warn);font-weight:700">Do you remember?</div>
      <div class="card-title">${quiz.q}</div>
      <div class="recall-answer" id="recall-a-${r.blockId}" style="display:none">
        <div class="recall-answer-text">${quiz.a}</div>
        <div class="recall-hint" style="font-size:.7rem;color:var(--text-3);margin:.3em 0">From: ${block.meta.title}</div>
        <div class="recall-buttons">
          <button class="recall-btn recall-forgot" onclick="app.scoreRecall('${r.blockId}',0,this)">Forgot</button>
          <button class="recall-btn recall-hard" onclick="app.scoreRecall('${r.blockId}',1,this)">Hard</button>
          <button class="recall-btn recall-good" onclick="app.scoreRecall('${r.blockId}',2,this)">Good</button>
          <button class="recall-btn recall-easy" onclick="app.scoreRecall('${r.blockId}',3,this)">Easy!</button>
        </div>
      </div>
      <button class="recall-reveal" id="recall-r-${r.blockId}" onclick="document.getElementById('recall-a-${r.blockId}').style.display='block';this.style.display='none'">Show answer</button>
    </div>`;
  }

  _generateQuiz(block) {
    const body = (block.body || '').toLowerCase();
    const quizzes = [];

    // --- Kid-friendly quizzes matched to content keywords ---

    // Ch1: What are recommendations
    if (body.includes('youtube') && body.includes('recommend')) quizzes.push({ q: 'How does YouTube pick videos for your homepage?', a: 'It looks at what you watched before and finds patterns — if you liked cat videos, it guesses you might like more!' });
    if (body.includes('pattern')) quizzes.push({ q: 'What are recommender systems really good at finding?', a: 'Patterns! They notice things like "people who liked X also liked Y" — like a super-powered detective.' });
    if (body.includes('discover') && body.includes('find')) quizzes.push({ q: 'Can you name the 3 jobs of a recommender system?', a: '1) Help you DISCOVER new things, 2) Help you FIND stuff faster, 3) Keep you INTERESTED so you come back!' });
    if (body.includes('peppa pig') || body.includes('wrong') || body.includes('hilarious')) quizzes.push({ q: 'Why do recommendations sometimes go totally wrong?', a: 'Because the system only sees clicks, not reasons. If your sibling watches cartoons on your account, it thinks YOU like cartoons!' });

    // Ch2: How they learn
    if (body.includes('footprint') || body.includes('digital')) quizzes.push({ q: 'What are "digital footprints"?', a: 'Every click, watch, skip, and search you make — like footprints in sand that tell the system about your taste!' });
    if (body.includes('skip') && body.includes('watch')) quizzes.push({ q: 'Which tells the system MORE about you: watching a video to the end, or skipping after 3 seconds?', a: 'Both! Watching to the end says "loved it!" Skipping says "not for me." The system learns from everything you do.' });
    if (body.includes('cold start') || body.includes('new account')) quizzes.push({ q: 'What happens when you create a brand new account?', a: 'The "cold start" problem! The system has zero clues about you, so recommendations are pretty random at first. But it learns FAST!' });
    if (body.includes('privacy') || body.includes('your data')) quizzes.push({ q: 'True or false: You have NO control over what recommendations show you.', a: 'FALSE! You can clear history, say "not interested," use separate profiles, and even go incognito. Your data = your choice!' });

    // Ch3: Different methods
    if (body.includes('collaborative') || body.includes('similar taste')) quizzes.push({ q: 'You and your friend both love the same 5 movies. Your friend finds a new one and loves it. Will you probably like it too?', a: 'Probably yes! That is exactly how collaborative filtering works — finding people with matching taste and sharing their discoveries.' });
    if (body.includes('content-based') || body.includes('look at the thing')) quizzes.push({ q: 'What is the difference between asking your friends vs. looking at the thing itself?', a: 'Asking friends (collaborative filtering) = find people with similar taste. Looking at the thing (content-based) = find items with similar features. Both work, but differently!' });
    if (body.includes('popular') || body.includes('trending')) quizzes.push({ q: 'Why is "just show what is popular" not always the best strategy?', a: 'Because it does not know YOU at all! Popular stuff is popular for a reason, but you might have unique tastes that trending lists miss completely.' });
    if (body.includes('pipeline') || body.includes('find') && body.includes('rank')) quizzes.push({ q: 'What are the 3 steps in a recommendation pipeline?', a: '1) FIND — gather hundreds of candidates, 2) RANK — score each one for you personally, 3) CHECK — add variety and remove stuff you already saw!' });
    if (body.includes('netflix') && body.includes('prize')) quizzes.push({ q: 'Netflix offered $1 million for better recommendations. What happened?', a: 'Over 40,000 teams competed! The winners made it 10% better by combining 100+ methods. But it was too complicated to actually use. Sometimes simpler is better!' });

    // Ch4: Making them better
    if (body.includes('filter bubble') || body.includes('bubble')) quizzes.push({ q: 'What is a "filter bubble" and why should you care?', a: 'When recommendations only show you things you already like, you get stuck in a bubble. You never discover new interests! It is like only eating pizza forever.' });
    if (body.includes('echo chamber')) quizzes.push({ q: 'How is an echo chamber different from a filter bubble?', a: 'A filter bubble limits what you discover. An echo chamber is worse — it makes you think EVERYONE agrees with you because you only hear your own opinions reflected back!' });
    if (body.includes('fair') || body.includes('new creator')) quizzes.push({ q: 'Why might a recommendation system be unfair to new creators?', a: 'Because popular creators get recommended more → get more views → become even more popular. New creators barely get seen. Good systems give new content a chance!' });
    if (body.includes('a/b test') || body.includes('experiment')) quizzes.push({ q: 'What is an A/B test?', a: 'A science experiment with real users! Half see version A, half see version B. Compare the results to find out which is actually better. Companies do this all the time!' });

    // Ch5: Build your own
    if (body.includes('survey') || body.includes('rate') && body.includes('movie')) quizzes.push({ q: 'What is the first step to building your own recommendation system?', a: 'Collect data! Survey your friends — ask them to rate movies 1-5 stars. That grid of ratings is exactly what Netflix and Spotify use!' });
    if (body.includes('similar') && body.includes('rating')) quizzes.push({ q: 'How do you find people with similar taste using a rating grid?', a: 'Look for people who gave the SAME movies similar scores. If you both rated Frozen 5 stars and Moana 4 stars, you probably have matching taste!' });
    if (body.includes('predict') || body.includes('empty cell')) quizzes.push({ q: 'How do you predict if someone will like a movie they have not seen?', a: 'Find 2-3 people with similar taste who DID see it. Average their ratings. If they gave it 4+ stars, recommend it!' });
    if (body.includes('improve') || body.includes('more data')) quizzes.push({ q: 'Name 2 ways to make your recommendation system better.', a: 'Get MORE data (survey more people), and do not just look at ratings — also consider what TYPE of movie it is (animation, action, comedy)!' });

    // Fallback: generate from title
    if (quizzes.length === 0) {
    // Ch6: Ethics
    if (body.includes('rabbit hole') || body.includes('who decides')) quizzes.push({ q: 'Who decides what appears on your YouTube homepage — you, YouTube, or the algorithm?', a: 'The algorithm decides! It was built by YouTube engineers who told it to maximize watch time. You influence it with clicks, but the final call is the algorithm\'s.' });
    if (body.includes('autoplay') || body.includes('infinite scroll') || body.includes('addictive')) quizzes.push({ q: 'Why is there no natural stopping point on TikTok or YouTube?', a: 'By design! Infinite scroll and autoplay mean there\'s always another video ready. It\'s like a bag of chips that never runs out. Knowing this is the first step to taking control.' });
    if (body.includes('dopamine') || body.includes('one more')) quizzes.push({ q: 'What brain chemical makes you want to watch "just one more video"?', a: 'Dopamine! It\'s released when you see something surprising or rewarding. The uncertainty of "will the next video be good?" creates a dopamine loop. Recognizing it is a superpower!' });
    if (body.includes('privacy') || body.includes('data') && body.includes('know')) quizzes.push({ q: 'Can you check what data YouTube has collected about you?', a: 'Yes! Go to myactivity.google.com — you can see every video you\'ve ever watched. You can also delete it or set it to auto-delete.' });
    if (body.includes('future') || body.includes('your generation')) quizzes.push({ q: 'Why does YOUR generation understand algorithms better than most adults?', a: 'Because you grew up WITH them! You notice when recommendations are weird, you know how to game the algorithm, and you feel the pull of infinite scroll. That experience is real knowledge.' });
    if (body.includes('eu') || body.includes('law') || body.includes('digital services')) quizzes.push({ q: 'What new right did the EU give people regarding algorithms?', a: 'The right to opt OUT of algorithmic recommendations! The Digital Services Act also stops platforms from using kids\' personal data for recommendations.' });

    // Fallback
    if (quizzes.length === 0)
      quizzes.push({ q: 'Can you explain "' + (block.title || 'this topic') + '" to a friend in one sentence?', a: 'Try it! If you can explain it simply, you really understand it. If not, read the section again — it will make more sense the second time!' });
    }

    const quiz = quizzes[Math.floor(Math.random() * quizzes.length)];
    return `<h4>&#129504; Quick Quiz!</h4>
      <div class="ctx-quiz">
        <div class="ctx-quiz-q">${quiz.q}</div>
        <button class="ctx-quiz-reveal" onclick="this.nextElementSibling.style.display='block';this.style.display='none'">Hmm, let me think... &#129300; Show answer!</button>
        <div class="ctx-quiz-a" style="display:none">${quiz.a}</div>
      </div>`;
  }

  // --- Spaced repetition recall ---
  _getRecallQuestion(block) {
    if (!block) return null;   // recall may reference a variant that no longer resolves
    const id = block.meta?.id || block.id;
    const title = block.meta?.title || '';
    const body = (block.body || '').toLowerCase();
    const meta = block.meta || {};

    // 1. Prefer frontmatter Q&A (editable by content creators)
    if (meta.recallQ && meta.recallA) return { q: meta.recallQ, a: meta.recallA };

    // 2. Fallback: hardcoded questions (kept for backwards compat)
    const QUESTIONS = {
      // ── Ch1: What Are Recommendations? ──
      'ch1-noticed': { q: 'How do apps like YouTube seem to "know" what you want?', a: 'They track your clicks, watches, and skips to build a picture of your taste — then use algorithms to find similar content.' },
      'ch1-everywhere': { q: 'Name 4 apps that use recommendation algorithms.', a: 'YouTube, TikTok, Spotify, Netflix, Amazon, Instagram, App Store — almost every app you use daily.' },
      'ch1-not-magic': { q: 'Recommendations feel like magic — what are they really based on?', a: 'Patterns! Watch → find patterns → predict. Like a detective finding clues in your clicks.' },
      'ch1-wrong-sidebar': { q: 'Why do recommendations sometimes go hilariously wrong?', a: 'The system only sees clicks, not reasons. If your sibling watches cartoons on your account, it thinks YOU like cartoons!' },
      'ch1-patterns-d-think': { q: 'Why is finding patterns a "superpower" for algorithms?', a: 'Machines can spot patterns across millions of people simultaneously — connections no human could ever find manually.' },
      'ch1-three-jobs': { q: 'What are the 3 jobs of a recommender system?', a: 'DISCOVER new things, FIND things faster in huge catalogs, and ENGAGE — keep you interested.' },
      'ch1-wyr': { q: 'What is the main trade-off in recommendations?', a: 'Better recommendations need more data, but more data means companies know more about you. Privacy vs. personalization.' },
      'ch1-ws-match': { q: 'Name 3 different recommendation models.', a: 'Friend-based, follow-based, interest-based, algorithm-based, and group-based. Most apps use hybrids.' },
      // ── Ch2: How They Learn About You ──
      'ch2-footprints': { q: 'What are digital footprints?', a: 'Every click, watch, skip, and search — invisible tracks that teach the system about your taste.' },
      'ch2-track-d-exp': { q: 'Which signal is stronger: clicking a video or watching it to the end?', a: 'Watching to the end is MUCH stronger. The system tracks watch time, not just clicks.' },
      'ch2-guess-signal': { q: 'What is the strongest signal you can send to an algorithm?', a: 'Sharing something! It takes real effort, which tells the system you really care about that content.' },
      'ch2-clues': { q: 'Name the 3 types of clues recommenders use.', a: 'Item clues (what it IS), person clues (who YOU are), action clues (what you DO).' },
      'ch2-incognito-sidebar': { q: 'What is the "cold start" problem?', a: 'When you create a new account, the system has zero info — it shows popular stuff until it learns who you are.' },
      'ch2-myth': { q: 'True or false: your phone listens to your conversations for ads.', a: 'False! Algorithms predict so well from your clicks that it FEELS like they heard you — but they didn\'t.' },
      'ch2-privacy': { q: 'Name 3 tools you have to control your data.', a: '"Not Interested" button, clear history, separate profiles, incognito mode, and app settings.' },
      'ch2-privacy-d-create': { q: 'How fast does an algorithm start personalizing for you?', a: 'Just 5-10 videos! Watch a few cooking videos and your feed fills with cooking in minutes.' },
      'ch2-ws-detective': { q: 'Can you train the algorithm on purpose?', a: 'Yes! Search for topics you want, like content deliberately, use "Not Interested" on what you don\'t want.' },
      // ── Ch3: Different Ways to Recommend ──
      'ch3-friends': { q: 'How does collaborative filtering work?', a: 'Find people with similar taste → recommend what THEY liked that you haven\'t tried yet.' },
      'ch3-cf-d-exp': { q: 'What are "taste twins" in collaborative filtering?', a: 'People who liked the same things as you. If they also liked something new, you probably will too!' },
      'ch3-cf-d-create': { q: 'Can you build collaborative filtering without a computer?', a: 'Yes! Survey friends, create a rating grid on paper, find who matches you best, check what they liked.' },
      'ch3-netflix-sidebar': { q: 'What lesson did the Netflix Prize teach about algorithms?', a: 'Better accuracy doesn\'t always win — speed and simplicity matter more than perfection in real systems.' },
      'ch3-content': { q: 'How does content-based filtering differ from collaborative?', a: 'Content-based looks at item FEATURES (genre, tags). Collaborative looks at USER BEHAVIOR (who liked what).' },
      'ch3-compare-d-think': { q: 'When is content-based better than collaborative filtering?', a: 'For new items with no ratings yet, and for niche interests. Collaborative is better for surprising discoveries.' },
      'ch3-spot-method': { q: '"Because you watched X" uses which method?', a: 'Content-based filtering! It finds items similar to X. "Fans also listen to" is collaborative filtering.' },
      'ch3-bandits': { q: 'What is the explore-exploit dilemma?', a: 'Should the system show safe picks you\'ll like (exploit) or try new things you might discover (explore)? Both matter.' },
      'ch3-deep-similarity': { q: 'What are "embeddings" in recommendation systems?', a: 'Items turned into lists of numbers (vectors). Close vectors = similar items. Neural networks learn these patterns.' },
      'ch3-popular': { q: 'What is the biggest weakness of popularity-based recommendations?', a: 'No personalization — everyone sees the same thing. It can\'t account for YOUR unique taste.' },
      'ch3-popular-sidebar': { q: 'What is the "rich-get-richer" problem?', a: 'Popular content gets more visibility → more views → stays popular. New creators get buried forever.' },
      'ch3-pipeline': { q: 'What are the 3 stages of a recommendation pipeline?', a: 'FIND candidates (fast + rough), RANK them (precise scoring), CHECK for diversity.' },
      'ch3-pipeline-d-exp': { q: 'How does YouTube find 20 videos from 800 million in 0.2 seconds?', a: 'Staged pipeline! Quick rough filters narrow 800M to 500 candidates, then careful ranking picks the best 20.' },
      'ch3-speed': { q: 'How long would it take a human to do what YouTube does in 1 second?', a: '25 YEARS! That\'s why we need algorithms — the scale is impossibly large for humans.' },
      'ch3-search-recs': { q: 'Are search results the same for everyone?', a: 'No! Search is increasingly personalized — what you see depends on your history, location, and past behavior.' },
      // ── Ch4: Making Recommendations Better ──
      'ch4-bubbles': { q: 'What is a filter bubble?', a: 'When the algorithm only shows you things you already like — you never discover anything new. The bubble is invisible.' },
      'ch4-echo-d-think': { q: 'How is an echo chamber worse than a filter bubble?', a: 'Echo chambers make you think EVERYONE agrees with you — different people see different realities about the same topic.' },
      'ch4-experiment': { q: 'How can you break out of a filter bubble?', a: 'Deliberately explore new content! Watch 3 videos on a new topic and your feed will start to change.' },
      'ch4-fairness': { q: 'How can algorithms be unfair to new creators?', a: 'Popular → more recommended → more popular (repeat). New creators never get seen. Good systems give everyone a fair start.' },
      'ch4-youtube-sidebar': { q: 'What percentage of YouTube watch time comes from recommendations?', a: '70%! That means algorithms — not you searching — drive most of what people watch.' },
      'ch4-unfair-game': { q: 'How can platforms make recommendations fairer?', a: 'Random sampling, guaranteed visibility for new content, small-audience testing before scaling.' },
      'ch4-objectives': { q: 'What is the algorithm actually trying to do?', a: 'It depends! Subscription services optimize for YOUR happiness. Free/ad services optimize for ADVERTISER revenue.' },
      'ch4-explainability': { q: 'Why can\'t platforms fully explain their recommendations?', a: 'Neural networks use hundreds of signals — even engineers can\'t trace exactly why one item was chosen over another.' },
      'ch4-testing': { q: 'What is an A/B test?', a: 'Show version A to half the users, version B to the other half, compare real behavior. Data decides, not guessing.' },
      'ch4-ab-d-exp': { q: 'Do personalized recommendations actually work better than "just show popular"?', a: 'Yes! Tests show 37% more songs played, 4x more artist discovery, and higher engagement with personalization.' },
      // ── Ch5: Build Your Own! ──
      'ch5-start': { q: 'What are the 4 steps to build a recommendation system?', a: 'Collect data → find similar users → make predictions → test and improve.' },
      'ch5-collect': { q: 'What is a rating matrix?', a: 'Users as rows, items as columns, ratings in cells. Most cells are empty — that\'s what you predict.' },
      'ch5-spread-d-create': { q: 'Why can a spreadsheet help you build recommendations?', a: 'Color-coded ratings reveal taste patterns visually — you can see who matches before doing any math.' },
      'ch5-similar': { q: 'How do you find "taste neighbors"?', a: 'Compare ratings on shared items — lower average difference = more similar taste.' },
      'ch5-math-d-think': { q: 'What does cosine similarity measure?', a: 'The angle between two preference vectors — so someone who rates everything low but in the same PATTERN as you is still similar.' },
      'ch5-real-numbers': { q: 'How many possible user-item combinations does Netflix have?', a: '3.4 TRILLION! And most cells are empty. Finding patterns in this sparse data is the core challenge.' },
      'ch5-recommend': { q: 'How do you predict a rating for an unseen item?', a: 'Find 2-3 most similar users who rated it → average their ratings. Above 4 stars = recommend it.' },
      'ch5-code-d-create': { q: 'How many lines of Python does it take to build basic collaborative filtering?', a: 'About 20! Data loading, similarity calculation, and prediction — the same logic Netflix uses, just smaller scale.' },
      'ch5-debug': { q: 'Even Netflix\'s algorithm is wrong how often?', a: '20-30% of the time! Perfection isn\'t the goal — being right MOST of the time is what matters.' },
      'ch5-improve': { q: 'What is the single biggest improvement for a recommendation system?', a: 'More data! More users and more ratings create more connections, which means better matches and predictions.' },
      'ch5-career-sidebar': { q: 'What skills does a recommendation engineer need?', a: 'Math (statistics, linear algebra), programming (Python), creativity, and curiosity about user behavior.' },
      'ch5-get-recommended': { q: 'What matters more to YouTube: clicks or watch time?', a: 'Watch time! A video 100 people watch fully beats 1,000 clicks that leave immediately.' },
      'ch5-seo-algorithms': { q: 'Why doesn\'t "ranking #1 on Google" exist anymore?', a: 'Results are personalized — your content can be #1 for your audience and invisible to everyone else.' },
      // ── Ch6: Ethics and You ──
      'ch6-who-decides': { q: 'Who decides what you see when you open TikTok?', a: 'The algorithm — not you, not your parents, not TikTok employees. It optimizes for "what keeps you watching longest."' },
      'ch6-rabbit-sidebar': { q: 'What is the "rabbit hole" effect?', a: 'Each recommended step feels small, but the accumulated path leads somewhere unexpected. The algorithm optimizes for the NEXT video, not the whole journey.' },
      'ch6-addictive': { q: 'Name 2 design tricks that keep you scrolling.', a: 'Infinite scroll (no end point) and autoplay (next video starts automatically). These are deliberate design choices.' },
      'ch6-control-d-create': { q: 'What is the "thumbnail test"?', a: 'Pause before clicking and ask: "Do I actually WANT this?" It breaks autopilot and puts you back in control.' },
      'ch6-dopamine-sidebar': { q: 'Why does watching "just one more video" feel so hard to resist?', a: 'Dopamine! Your brain releases it for anticipation + uncertainty — the same mechanism as slot machines.' },
      'ch6-adtech-vs-recs': { q: 'What is the difference between recommendations and ads?', a: 'Recommendations help you within ONE app. Adtech tracks you across the ENTIRE internet to sell your attention.' },
      'ch6-privacy-real': { q: 'What is a "digital twin"?', a: 'A mathematical model of your behavior patterns — apps build one from your data without needing your name.' },
      'ch6-data-d-exp': { q: 'Where can you see what Google knows about you?', a: 'myactivity.google.com — shows every search, video, and click. You can also auto-delete old data there.' },
      'ch6-age-sidebar': { q: 'Can algorithms guess your age? How?', a: 'Within 3-5 years! From when you watch, how fast you scroll, music taste, and meme preferences — no personal info needed.' },
      'ch6-ai-future': { q: 'Why does YOUR generation understand algorithms better than most adults?', a: 'You grew up WITH them — you notice weird recs, know how to game the algorithm, and feel the pull of infinite scroll.' },
      'ch6-hard-d-think': { q: 'Name a hard question about algorithms that nobody has answered yet.', a: 'Should kids get different algorithms? Who defines "harmful"? Should algorithms show disagreement? No right answers exist yet.' },
      'ch6-law-sidebar': { q: 'What right did the EU give people regarding algorithms?', a: 'The right to opt OUT of algorithmic recommendations, and a ban on using kids\' personal data for targeting.' },
      'ch6-conversational': { q: 'How will LLMs change recommendations?', a: 'You\'ll ASK for what you want instead of scrolling. LLMs understand language, recommenders have the data — together they\'re powerful.' },
    };

    // Direct match by block ID
    if (QUESTIONS[id]) return QUESTIONS[id];

    // Generate from content — extract first meaningful sentence as answer
    const sentences = (block.body || '').replace(/[#*_\[\]]/g, '').split(/[.!?]\s/).filter(s => s.length > 30 && s.length < 200);
    if (sentences.length >= 2) {
      const keyIdx = Math.floor(id.charCodeAt(id.length - 1) % sentences.length);
      const answer = sentences[keyIdx].trim();
      return { q: `What did you learn about "${title}"?`, a: answer + '.' };
    }

    return { q: `What is the key idea of "${title}"?`, a: `Think about what this section explained. Try re-reading "${title}" to refresh your memory!` };
  }

  startPractice(dueOnly) {
    if (!this._f('spaceRepetition')) return;
    const due = this.user.getDueRecalls();
    let blocks;
    if (dueOnly && due.length > 0) {
      blocks = due.map(r => ({ blockId: r.blockId, isDue: true }));
    } else {
      // Smart ordering: due → learning → struggling → new → ALL confident
      const dueSet = new Set(due.map(d => d.blockId));
      const hard = [], med = [], easy = [];
      Object.entries(this.user.recall).forEach(([blockId, card]) => {
        const item = { blockId, isDue: dueSet.has(blockId), ease: card.ease, reps: card.reps };
        if (card.ease < 1.8) hard.push(item);
        else if (card.ease < 2.5) med.push(item);
        else easy.push(item);
      });
      const shuffle = arr => arr.sort(() => Math.random() - 0.5);
      // Read blocks not yet in recall system
      const recallSet = new Set(Object.keys(this.user.recall));
      const newFromRead = [...this.user.readBlocks]
        .filter(id => !recallSet.has(id))
        .map(id => ({ blockId: id, isDue: false, ease: 2.5, reps: 0 }));
      // ALL blocks with recallQ that user hasn't read yet (test knowledge even if not read)
      const allWithQ = this.allBlocks
        .filter(b => b.meta.recallQ && !this.user.readBlocks.has(b.meta.id) && !recallSet.has(b.meta.id))
        .map(b => ({ blockId: b.meta.id, isDue: false, ease: 2.5, reps: 0 }));
      // Order: learning first (sweet spot), then struggling, new, confident, then unread with questions
      blocks = [...shuffle(med), ...shuffle(hard), ...shuffle(newFromRead), ...shuffle(easy), ...shuffle(allWithQ)];
    }
    if (blocks.length === 0) return;

    this._recallQueue = blocks;
    this._recallIdx = 0;
    this._recallScore = { total: blocks.length, correct: 0 };
    this._quizSessionActive = true;
    if (this.currentView !== 'quiz') this.switchView('quiz', true);
    this._renderQuizCard();
  }

  renderQuiz() {
    const el = document.getElementById('quizContent');
    if (!el) return;
    const u = this.user;
    const due = this._f('spaceRepetition') ? u.getDueRecalls() : [];
    const totalRecall = Object.keys(u.recall).length;
    const totalRead = u.readBlocks.size;

    // If in an active practice session started from this page, continue it
    if (this._quizSessionActive && this._recallQueue && this._recallIdx < this._recallQueue.length) {
      this._renderQuizCard();
      return;
    }
    // Otherwise reset and show landing page
    this._quizSessionActive = false;
    this._recallQueue = null;

    let h = '';

    // ── Shared single card? ──
    if (this._sharedQuizBlock) {
      const sharedId = this._sharedQuizBlock;
      this._sharedQuizBlock = null;
      const block = this.findBlock(sharedId);
      if (block) {
        const quiz = this._getRecallQuestion(block);
        if (quiz) {
          h += `<div style="padding:1em;max-width:500px;margin:0 auto">
            <p style="font-size:.75rem;color:var(--text-3);margin-bottom:.8em">Someone shared this question with you:</p>
            <div class="recall-card-big">
              <div class="recall-card-q">${quiz.q}</div>
              <div id="shared-a" style="display:none">
                <div class="recall-card-answer">${quiz.a}</div>
                <div style="margin-top:.5em;font-size:.72rem;color:var(--text-3)">From: Ch${block.meta._chapterNum} — ${block.meta.title}</div>
                <div style="display:flex;gap:.4em;margin-top:.6em">
                  <button class="btn-primary" style="flex:1;font-size:.78rem" onclick="app.openBlock('${sharedId}')">Read this section</button>
                  <button class="btn-ghost" style="flex:1;font-size:.78rem;border:1px solid var(--accent);border-radius:8px;color:var(--accent)" onclick="app.renderQuiz()">More questions</button>
                </div>
              </div>
              <button class="recall-reveal-big" onclick="document.getElementById('shared-a').style.display='block';this.style.display='none'">Think about it... then reveal!</button>
            </div>
          </div>`;
          el.innerHTML = h;
          return;
        }
      }
    }

    // ── Header ──
    h += `<div style="padding:.8em 1em .2em">
      <h2 style="font-family:var(--font-ui);font-size:1.15rem;font-weight:800">\u{1F9E0} Test Your Knowledge</h2>
      <p style="font-size:.75rem;color:var(--text-3);margin-top:.1em">Spaced repetition — review what you learned</p>
    </div>`;

    if (totalRead === 0) {
      h += `<div style="text-align:center;padding:3em 1em;color:var(--text-3)">
        <p style="font-size:2rem;margin-bottom:.3em">\u{1F4DA}</p>
        <p style="font-size:.9rem;font-weight:600">Read some sections first!</p>
        <p style="font-size:.78rem;margin:.3em 0 1em">Memory cards are created automatically as you read.</p>
        <button class="btn-primary" onclick="app.switchView('home')">Start reading</button>
      </div>`;
      el.innerHTML = h;
      return;
    }

    // Self-heal: prune recall cards whose git block no longer exists (renamed/removed).
    // Reader-generated ids (gen--/remix--) are kept — they resolve via the private store
    // or the community cache and are simply skipped from display when uncached.
    let pruned = false;
    Object.keys(u.recall).forEach(id => {
      if (!/^(gen--|remix--)/.test(id) && !this._findAnyBlock(id)) { delete u.recall[id]; pruned = true; }
    });
    if (pruned) u.save();

    // ── Stats row ──
    const hardCards = Object.entries(u.recall).filter(([_, c]) => c.ease < 1.8);
    const medCards = Object.entries(u.recall).filter(([_, c]) => c.ease >= 1.8 && c.ease < 2.5);
    const easyCards = Object.entries(u.recall).filter(([_, c]) => c.ease >= 2.5);
    const totalReps = Object.values(u.recall).reduce((s, c) => s + c.reps, 0);

    // ── Active mode: due cards shelf (answerable inline) ──
    if (due.length > 0) {
      const dueCards = due.slice(0, 10).map(r => {
        const block = this._findAnyBlock(r.blockId);
        if (!block) return '';
        const quiz = this._getRecallQuestion(block);
        if (!quiz) return '';
        const card = u.recall[r.blockId];
        const overdue = Math.round((Date.now() - card.nextReview) / 3600000);
        const reason = overdue > 24 ? `${Math.round(overdue/24)}d overdue` : overdue > 0 ? `${overdue}h overdue` : 'Due now';
        return `<div class="card recall-card" style="border-top:3px solid var(--warn);flex:0 0 280px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3em">
            <span style="color:var(--warn);font-weight:700;font-size:.7rem">Due</span>
            <span style="color:var(--text-3);font-size:.6rem">${reason}</span>
          </div>
          <div class="card-title" style="font-size:.85rem;line-height:1.4">${quiz.q}</div>
          <div id="qd-a-${r.blockId}" style="display:none">
            <div style="font-size:.78rem;color:var(--text-2);margin:.4em 0;padding-top:.4em;border-top:1px solid var(--border)">${quiz.a}</div>
            <div style="font-size:.6rem;color:var(--text-3);margin-bottom:.3em">From: ${block.meta.title}</div>
            <div class="recall-buttons">
              <button class="recall-btn recall-forgot" onclick="app.scoreRecall('${r.blockId}',0,this)">Forgot</button>
              <button class="recall-btn recall-hard" onclick="app.scoreRecall('${r.blockId}',1,this)">Hard</button>
              <button class="recall-btn recall-good" onclick="app.scoreRecall('${r.blockId}',2,this)">Good</button>
              <button class="recall-btn recall-easy" onclick="app.scoreRecall('${r.blockId}',3,this)">Easy!</button>
            </div>
          </div>
          <button class="recall-reveal" onclick="document.getElementById('qd-a-${r.blockId}').style.display='block';this.style.display='none'" style="margin-top:.3em">Show answer</button>
        </div>`;
      }).filter(Boolean);
      if (dueCards.length) h += this.shelf(`\u{1F525} Due now (${due.length})`, dueCards);
    }

    // ── Unread blocks (haven't read yet = "Don't know") ──
    const allSpines = this.allBlocks.filter(b => b.meta.type === 'spine');
    const unreadBlocks = allSpines.filter(b => !u.readBlocks.has(b.meta.id));
    const recallSet = new Set(Object.keys(u.recall));
    const newCards = [...u.readBlocks].filter(id => !recallSet.has(id)); // read but no recall yet

    // ── Confidence map: each card is a small colored cell, hover shows title ──
    // Build ordered list: struggling → new → learning → confident → unread
    // resolve via _findAnyBlock (covers private/community variants); skip what can't resolve
    const qFor = id => this._getRecallQuestion(this._findAnyBlock(id))?.q;
    const allCards = [
      ...hardCards.map(([id]) => ({ id, color: '#dc2626', label: 'Struggling', q: qFor(id) })),
      ...newCards.map(id => ({ id, color: 'var(--accent)', label: 'New', q: qFor(id) })),
      ...medCards.map(([id]) => ({ id, color: 'var(--warn)', label: 'Learning', q: qFor(id) })),
      ...easyCards.map(([id]) => ({ id, color: 'var(--product)', label: 'Confident', q: qFor(id) })),
      ...unreadBlocks.map(b => ({ id: b.meta.id, color: 'var(--border)', label: 'Unread', q: b.meta.title })),
    ].filter(c => c.q);
    if (allCards.length > 0) {
      const cellW = Math.max(4, Math.min(12, Math.floor((window.innerWidth - 32) / allCards.length)));
      h += `<div style="padding:.5em 1em .6em">
        <div style="display:flex;flex-wrap:wrap;gap:2px" id="quizMap">
          ${allCards.map(c => `<div style="width:${cellW}px;height:${cellW}px;border-radius:2px;background:${c.color};cursor:pointer;transition:transform .1s" title="${this.escHtml(c.label + ': ' + c.q)}" onclick="app.${c.label === 'Unread' ? "openBlock('" + c.id + "')" : "showBlockRecall('" + c.id + "')"}"></div>`).join('')}
        </div>
        <div style="display:flex;gap:.8em;font-size:.58rem;color:var(--text-3);margin-top:.4em">
          ${hardCards.length ? `<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#dc2626;vertical-align:middle"></span> ${hardCards.length} struggling</span>` : ''}
          ${newCards.length ? `<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--accent);vertical-align:middle"></span> ${newCards.length} new</span>` : ''}
          ${medCards.length ? `<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--warn);vertical-align:middle"></span> ${medCards.length} learning</span>` : ''}
          ${easyCards.length ? `<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--product);vertical-align:middle"></span> ${easyCards.length} confident</span>` : ''}
          ${unreadBlocks.length ? `<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--border);vertical-align:middle"></span> ${unreadBlocks.length} unread</span>` : ''}
        </div>
      </div>`;
    }

    // ── Card swimlanes — answering moves cards between lanes ──

    // Due now (top priority)
    if (due.length > 0) {
      const dueCards = due.slice(0, 12).map(r => {
        const block = this._findAnyBlock(r.blockId);
        if (!block) return '';
        const quiz = this._getRecallQuestion(block);
        if (!quiz) return '';
        const card = u.recall[r.blockId];
        const overdue = Math.round((Date.now() - card.nextReview) / 3600000);
        const reason = overdue > 24 ? `${Math.round(overdue/24)}d overdue` : overdue > 0 ? `${overdue}h overdue` : 'Due';
        return this._quizPreviewCard(r.blockId, card, 'var(--warn)', reason);
      }).filter(Boolean);
      if (dueCards.length) h += this.shelf(`\u{1F525} Review now (${due.length})`, dueCards);
    }

    // Struggling (ease < 1.8) — shown first, these need the most work
    if (hardCards.length > 0) {
      const hCards = hardCards.sort((a,b) => a[1].ease - b[1].ease).slice(0, 12).map(([id, c]) => this._quizPreviewCard(id, c, '#dc2626', 'Struggling')).filter(Boolean);
      if (hCards.length) h += this.shelf(`\u{1F534} Struggling (${hardCards.length})`, hCards);
    }

    // New (read but never reviewed) — important to start reviewing
    if (newCards.length > 0) {
      const nCards = newCards.slice(0, 10).map(id => {
        const block = this.findBlock(id);
        if (!block) return '';
        const quiz = this._getRecallQuestion(block);
        if (!quiz) return '';
        return this._quizPreviewCard(id, { ease: 2.5, reps: 0, nextReview: Date.now() }, 'var(--accent)', 'New');
      }).filter(Boolean);
      if (nCards.length) h += this.shelf(`\u{1F7E3} New — never tested (${newCards.length})`, nCards);
    }

    // Learning (ease 1.8-2.5) — the sweet spot for practice
    if (medCards.length > 0) {
      const mCards = medCards.sort((a,b) => a[1].ease - b[1].ease).slice(0, 12).map(([id, c]) => this._quizPreviewCard(id, c, 'var(--warn)', 'Learning')).filter(Boolean);
      if (mCards.length) h += this.shelf(`\u{1F7E1} Learning (${medCards.length})`, mCards);
    }

    // Confident (ease >= 2.5) — still shown, tested occasionally
    if (easyCards.length > 0) {
      const eCards = easyCards.sort((a,b) => b[1].ease - a[1].ease).slice(0, 10).map(([id, c]) => this._quizPreviewCard(id, c, 'var(--product)', 'Confident')).filter(Boolean);
      if (eCards.length) h += this.shelf(`\u{1F7E2} Confident (${easyCards.length})`, eCards);
    }

    // Unread — motivate reading
    if (unreadBlocks.length > 0) {
      const uCards = unreadBlocks.slice(0, 8).map(b => {
        return `<div class="card" style="border-top:3px solid var(--border);flex:0 0 240px;opacity:.7;cursor:pointer" onclick="app.openBlock('${b.meta.id}')">
          <div style="font-size:.6rem;font-weight:700;color:var(--text-3);margin-bottom:.2em">\u{1F512} Not read yet</div>
          <div class="card-title" style="font-size:.82rem;line-height:1.3">${b.meta.title}</div>
          <div style="font-size:.62rem;color:var(--text-3);margin-top:.2em">Ch${b.meta._chapterNum} · Read to unlock card</div>
        </div>`;
      });
      h += this.shelf(`\u{26AA} Haven't read yet (${unreadBlocks.length})`, uCards);
    }

    // ── How it works ──
    h += `<div style="padding:.6em 1em">
      <details style="font-size:.75rem;color:var(--text-2)">
        <summary style="cursor:pointer;font-weight:600;color:var(--text-3);font-size:.7rem">How does smart review work?</summary>
        <div style="margin-top:.5em;line-height:1.5">
          <p>Cards move between lanes based on your answers:</p>
          <ul style="padding-left:1.2em;margin:.4em 0">
            <li><strong>Forgot</strong> → card moves to Struggling, reviewed again soon</li>
            <li><strong>Hard</strong> → stays in current lane, shorter interval</li>
            <li><strong>Good</strong> → moves toward Confident, normal interval</li>
            <li><strong>Easy</strong> → moves to Confident, longer interval</li>
          </ul>
          <p>Even Confident cards come back — knowledge fades without review. The algorithm tests middle-difficulty cards most often (that's where you learn the most).</p>
        </div>
      </details>
    </div>`;

    // ── Upcoming schedule ──
    const upcoming = Object.entries(u.recall)
      .filter(([_, c]) => c.nextReview > Date.now())
      .sort((a, b) => a[1].nextReview - b[1].nextReview)
      .slice(0, 5);
    if (upcoming.length > 0) {
      h += `<div style="padding:.5em 1em">
        <div style="font-size:.7rem;font-weight:600;color:var(--text-3);margin-bottom:.3em">Upcoming reviews</div>
        ${upcoming.map(([id, c]) => {
          const b = this.findBlock(id);
          const title = b?.meta?.title || id;
          return `<div style="display:flex;align-items:center;gap:.4em;font-size:.68rem;padding:.2em 0;color:var(--text-2)">
            <span style="color:var(--warn);font-weight:600;min-width:3.5em">${this._timeUntil(c.nextReview)}</span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this.escHtml(title)}</span>
          </div>`;
        }).join('')}
      </div>`;
    }

    // ── Bottom actions (side by side on wide screens) ──
    const unread = this.allBlocks.filter(b => b.meta.core && b.meta.type === 'spine' && !u.readBlocks.has(b.meta.id));
    const totalWithQ = this.allBlocks.filter(b => b.meta.recallQ).length;
    h += `<div style="padding:.8em 1em">`;
    h += `<div style="display:flex;gap:.5em;flex-wrap:wrap">`;
    if (unread.length > 0) {
      h += `<button class="btn-primary" style="flex:1;min-width:150px;font-size:.82rem;padding:.5em" onclick="app.switchView('home')">Continue reading \u{1F4D6} (${unread.length})</button>`;
    }
    if (totalWithQ > 0) {
      h += `<button class="btn-ghost" style="flex:1;min-width:150px;border:1.5px solid var(--accent);border-radius:8px;padding:.5em;font-size:.78rem;color:var(--accent)" onclick="app.startPractice()">Test all ${totalWithQ} cards</button>`;
    }
    h += `</div>`;
    if (hardCards.length > 0) {
      h += `<div style="text-align:center;margin-top:.4em"><button style="border:1.5px solid #dc2626;border-radius:8px;padding:.35em .8em;font-size:.72rem;color:#dc2626;cursor:pointer;background:none;font-family:var(--font-ui)" onclick="app._startHardMode()">Hard mode (${hardCards.length})</button></div>`;
    }
    h += `</div>`;

    el.innerHTML = h;
  }

  _timeUntil(ts) {
    const diff = ts - Date.now();
    if (diff <= 0) return 'Due now';
    const min = Math.round(diff / 60000);
    if (min < 60) return `in ${min}m`;
    const hrs = Math.round(min / 60);
    if (hrs < 24) return `in ${hrs}h`;
    const days = Math.round(hrs / 24);
    return `in ${days}d`;
  }

  _quizPreviewCard(blockId, card, color, label) {
    const block = this.findBlock(blockId);
    if (!block) return '';
    const quiz = this._getRecallQuestion(block);
    if (!quiz) return '';
    const isDue = card.nextReview && card.nextReview <= Date.now();
    const timeLabel = card.nextReview ? (isDue ? 'Due now' : this._timeUntil(card.nextReview)) : '';
    const uid = blockId.replace(/[^a-z0-9]/g, '');
    return `<div class="card" style="border-top:3px solid ${color};flex:0 0 260px;cursor:pointer" onclick="var a=document.getElementById('qp-${uid}');if(a)a.style.display=a.style.display==='none'?'block':'none'">
      <div style="display:flex;justify-content:space-between;margin-bottom:.2em">
        <span style="font-size:.6rem;font-weight:700;color:${color}">${label}</span>
        <span style="font-size:.55rem;color:${isDue ? 'var(--warn)' : 'var(--text-3)'};font-weight:${isDue ? '600' : '400'}">${card.reps ? card.reps + 'x · ' : ''}${timeLabel}</span>
      </div>
      <div class="card-title" style="font-size:.82rem;line-height:1.3">${quiz.q}</div>
      <div style="font-size:.62rem;color:var(--text-3);margin-top:.2em">Ch${block.meta._chapterNum}: ${block.meta.title}</div>
      <div id="qp-${uid}" style="display:none;margin-top:.4em;padding-top:.4em;border-top:1px solid var(--border)">
        <div style="font-size:.78rem;color:var(--text-2);line-height:1.4;margin-bottom:.4em">${quiz.a}</div>
        <div class="recall-buttons" onclick="event.stopPropagation()">
          <button class="recall-btn recall-forgot" onclick="app.scoreRecall('${blockId}',0,this)">Forgot</button>
          <button class="recall-btn recall-hard" onclick="app.scoreRecall('${blockId}',1,this)">Hard</button>
          <button class="recall-btn recall-good" onclick="app.scoreRecall('${blockId}',2,this)">Good</button>
          <button class="recall-btn recall-easy" onclick="app.scoreRecall('${blockId}',3,this)">Easy!</button>
        </div>
        <a href="#" onclick="event.stopPropagation();event.preventDefault();app.openBlock('${blockId}')" style="display:block;font-size:.62rem;color:var(--accent);margin-top:.3em;text-align:center">Re-read this section &rarr;</a>
      </div>
    </div>`;
  }

  _startHardMode() {
    const hard = Object.entries(this.user.recall)
      .filter(([_, c]) => c.ease < 1.8)
      .sort((a, b) => a[1].ease - b[1].ease)
      .map(([blockId, card]) => ({ blockId, isDue: true, ease: card.ease, reps: card.reps }));
    if (!hard.length) return;
    this._recallQueue = hard;
    this._recallIdx = 0;
    this._recallScore = { total: hard.length, correct: 0 };
    this._quizSessionActive = true;
    this._renderQuizCard();
  }

  _renderQuizCard() {
    const q = this._recallQueue;
    const idx = this._recallIdx;
    const el = document.getElementById('quizContent');
    if (!el) return;

    // Done — show summary + rewards
    if (idx >= q.length) {
      this._quizSessionActive = false;
      const s = this._recallScore;
      const pct = Math.round(s.correct / Math.max(s.total, 1) * 100);
      const perfect = pct === 100 && s.total >= 3;
      let bonusXP = 0;
      if (this._f('gamification')) {
        bonusXP = perfect ? 15 : pct >= 70 ? 8 : 3;
        this.user.addXP(bonusXP); this.user.save(); this.updateXPBadge();
      }
      const unread = this.allBlocks.filter(b => b.meta.core && b.meta.type === 'spine' && !this.user.readBlocks.has(b.meta.id));
      el.innerHTML = `<div class="recall-session">
        <div class="recall-summary-icon">${perfect ? '\u{1F31F}' : pct >= 70 ? '\u{1F389}' : '\u{1F4AA}'}</div>
        <h2>${perfect ? 'Perfect score!' : pct >= 70 ? 'Great job!' : 'Keep going!'}</h2>
        <p style="font-size:1.1rem;font-weight:700;margin:.3em 0">${s.correct} / ${s.total} correct (${pct}%)</p>
        <div class="recall-summary-bar"><div style="width:${pct}%;background:${pct >= 70 ? 'var(--product)' : 'var(--warn)'};height:100%;border-radius:4px"></div></div>
        ${bonusXP ? `<p style="color:var(--accent);font-weight:600;margin-top:.5em">+${bonusXP} XP quiz bonus</p>` : ''}
        <div style="display:flex;flex-direction:column;gap:.5em;margin-top:1em;align-items:center">
          ${unread.length > 0 ? `<button class="btn-primary" style="width:100%;max-width:280px" onclick="app.switchView('home')">\u{1F4D6} Read new sections (${unread.length} left)</button>` : ''}
          <button class="btn-ghost" style="border:1px solid var(--accent);border-radius:8px;padding:.5em 1em;font-size:.82rem;color:var(--accent);width:100%;max-width:280px" onclick="app.startPractice()">Test more cards</button>
          <button style="font-size:.72rem;color:var(--text-3);margin-top:.3em;cursor:pointer" onclick="app._quizSessionActive=false;app._recallQueue=null;app.renderQuiz()">Back to quiz overview</button>
        </div>
      </div>`;
      return;
    }

    const item = q[idx];
    const block = this._findAnyBlock(item.blockId);
    if (!block) { this._recallIdx++; this._renderQuizCard(); return; }
    const quiz = this._getRecallQuestion(block);
    const card = this.user.recall[item.blockId];
    const reps = card ? card.reps : 0;
    const ease = card ? card.ease.toFixed(1) : '—';
    const diffLabel = !card ? 'New' : card.ease >= 2.5 ? 'Easy' : card.ease >= 1.8 ? 'Medium' : 'Hard';
    const diffColor = !card ? 'var(--text-3)' : card.ease >= 2.5 ? 'var(--product)' : card.ease >= 1.8 ? 'var(--warn)' : '#dc2626';

    el.innerHTML = `<div class="recall-session">
      <div class="recall-progress-row">
        <span class="recall-progress-label">${idx + 1} / ${q.length}</span>
        <div class="recall-progress-bar"><div style="width:${Math.round((idx/q.length)*100)}%;background:var(--accent);height:100%;border-radius:4px;transition:width .3s"></div></div>
        ${item.isDue ? '<span class="recall-due-badge">Due</span>' : ''}
        <span style="font-size:.6rem;color:${diffColor};font-weight:600">${diffLabel}</span>
      </div>
      <div class="recall-card-big">
        <div class="recall-card-q">${quiz.q}</div>
        <div class="recall-card-a" id="recallAnswer" style="display:none">
          <div class="recall-card-answer">${quiz.a}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin:.4em 0">
            <a href="#" onclick="event.preventDefault();app.openBlock('${item.blockId}')" style="color:var(--accent);font-size:.72rem">Ch${block.meta._chapterNum}: ${block.meta.title} &rarr;</a>
            <span style="font-size:.6rem;color:var(--text-3)">${reps}x reviewed &middot; ease ${ease}</span>
          </div>
          <div class="recall-buttons">
            <button class="recall-btn recall-forgot" onclick="app._answerRecall('${item.blockId}',0)">Forgot</button>
            <button class="recall-btn recall-hard" onclick="app._answerRecall('${item.blockId}',1)">Hard</button>
            <button class="recall-btn recall-good" onclick="app._answerRecall('${item.blockId}',2)">Good</button>
            <button class="recall-btn recall-easy" onclick="app._answerRecall('${item.blockId}',3)">Easy!</button>
          </div>
        </div>
        <button class="recall-reveal-big" id="recallRevealBtn" onclick="document.getElementById('recallAnswer').style.display='block';this.style.display='none'">Show answer</button>
      </div>
      <div style="display:flex;justify-content:center;margin-top:.8em">
        <button style="font-size:.72rem;color:var(--text-3);border:1px solid var(--border);border-radius:6px;padding:.3em .8em;cursor:pointer" onclick="app._endPractice()">Stop (${this._recallScore.correct}/${idx} correct)</button>
      </div>
    </div>`;
    window.scrollTo(0, 0);
  }

  _endPractice() {
    this._recallQueue.length = this._recallIdx;
    this._renderQuizCard(); // triggers summary (clears session via done state)
  }

  shareQuestion(blockId) {
    const block = this.findBlock(blockId);
    if (!block) return;
    const quiz = this._getRecallQuestion(block);
    if (!quiz) return;
    const url = window.location.origin + window.location.pathname + '#quiz-' + blockId;

    navigator.clipboard.writeText(url).then(() => {
      this.showXPToast('Link copied!', 'info');
    }).catch(() => { prompt('Copy this link:', url); });
  }

  _answerRecall(blockId, quality) {
    this.user.processRecall(blockId, quality);
    if (quality >= 2) this._recallScore.correct++;
    const labels = ['Forgot', 'Hard', 'Good!', 'Easy!'];
    this.showXPToast(labels[quality], quality >= 2 ? 'xp' : 'info');
    if (quality === 0) {
      // Forgot — show "re-read" link before moving on
      const answerEl = document.getElementById('recallAnswer');
      if (answerEl) {
        answerEl.insertAdjacentHTML('beforeend', `<div style="text-align:center;margin-top:.5em"><a href="#" onclick="event.preventDefault();app.openBlock('${blockId}')" style="color:var(--accent);font-size:.82rem;font-weight:600">Re-read this section &rarr;</a></div>`);
      }
      this._recallIdx++;
      setTimeout(() => this._renderQuizCard(), 2000);
    } else {
      this._recallIdx++;
      setTimeout(() => this._renderQuizCard(), 400);
    }
  }

  scoreRecall(blockId, quality, btnEl) {
    // Prevent double-scoring
    if (this._scoredRecall?.has(blockId)) return;
    if (!this._scoredRecall) this._scoredRecall = new Set();
    this._scoredRecall.add(blockId);
    setTimeout(() => this._scoredRecall.delete(blockId), 2000);

    const xpEarned = this.user.processRecall(blockId, quality);
    const labels = ['Forgot — reviewing soon!', 'Hard — keep at it!', 'Good — nice!', 'Easy — nailed it!'];
    this.showXPToast(`+${xpEarned} XP ${labels[quality]}`, quality >= 2 ? 'xp' : 'info');
    this.checkGamificationEvents();
    this.updateXPBadge();
    // Remove the card from view (Browse shelf, inline, quiz preview)
    const card = btnEl?.closest('.card') || btnEl?.closest('.inline-recall');
    if (card) {
      card.style.transition = 'opacity .3s, transform .3s';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.9)';
      setTimeout(() => card.remove(), 300);
    }
  }

  renderMath(el) {
    const target = el || document.getElementById('readPane');
    if (!target) return;
    const doRender = () => {
      if (typeof katex === 'undefined') {
        setTimeout(() => this.renderMath(target), 200);
        return;
      }
      // Render display math
      target.querySelectorAll('.math-display').forEach(span => {
        if (span.dataset.rendered) return;
        const tex = span.textContent.replace(/^\$\$|\$\$$/g, '').trim();
        try { katex.render(tex, span, { displayMode: true, throwOnError: false, strict: false }); }
        catch(e) {}
        span.dataset.rendered = '1';
      });
      // Render inline math
      target.querySelectorAll('.math-inline').forEach(span => {
        if (span.dataset.rendered) return;
        const tex = span.textContent.replace(/^\$|\$$/g, '').trim();
        try { katex.render(tex, span, { displayMode: false, throwOnError: false, strict: false }); }
        catch(e) {}
        span.dataset.rendered = '1';
      });
    };
    setTimeout(doRender, 50);
  }

  // ===== MAP VIEW =====
  async renderMap() {
    const el = document.getElementById('mapContent');
    const prog = this.user.getProgress(this.allBlocks);
    const visibleVoices = this.user.getVisibleVoices();
    const mapMode = this._mapMode || 'list';

    const summary = this.user.getSignalSummary();

    let html = `<div class="map-header fade-up">
      <h2 class="map-title">Book Map</h2>
      <div class="map-progress-summary">
        <div class="map-progress-bar"><div class="map-progress-fill" style="width:${prog.pct}%"></div></div>
        <span class="map-progress-text">${prog.read} read &middot; ${prog.seen} seen &middot; ${prog.total} total</span>
      </div>
      ${summary.views > 0 ? `<div class="map-signals-bar">
        ${summary.reads > 0 ? `<span>&#128214; ${summary.reads} read</span>` : ''}
        ${summary.views > summary.reads ? `<span>&#128065; ${summary.views - summary.reads} seen</span>` : ''}
        ${summary.ratings > 0 ? `<span>&#128293; ${summary.ratings} rated</span>` : ''}
        ${summary.saves > 0 ? `<span>&#128278; ${summary.saves} saved</span>` : ''}
        ${summary.expands > 0 ? `<span>&#128295; ${summary.expands} explored</span>` : ''}
        ${summary.dwellTotal > 60000 ? `<span>&#9201; ${Math.round(summary.dwellTotal/60000)}m reading</span>` : ''}
      </div>` : ''}
      <div class="map-mode-toggle">
        <button class="map-mode-btn ${mapMode === 'visual' ? 'active' : ''}" onclick="app.setMapMode('visual')">Visual</button>
        <button class="map-mode-btn ${mapMode === 'list' ? 'active' : ''}" onclick="app.setMapMode('list')">Detail List</button>
        ${this._f('steering') ? `<button class="map-mode-btn ${mapMode === 'coverage' ? 'active' : ''}" onclick="app.setMapMode('coverage')">🌱 Living book</button>` : ''}
        <button class="map-mode-btn ${mapMode === 'saved' ? 'active' : ''}" onclick="app.setMapMode('saved')">Saved${this.user.savedBlocks.size ? ' (' + this.user.savedBlocks.size + ')' : ''}</button>
        <button class="map-mode-btn ${mapMode === 'notes' ? 'active' : ''}" onclick="app.setMapMode('notes')">Notes${this._getNoteCount() ? ' (' + this._getNoteCount() + ')' : ''}</button>
      </div>
      <button class="map-reset-btn" onclick="app.resetAll()">Reset progress</button>
    </div>`;

    if (mapMode === 'coverage') {
      html += '<div id="coverageMapWrap" class="fade-up"><div style="padding:1.5em;color:var(--text-3);font-size:.8rem">Mapping the living book…</div></div>';
      el.innerHTML = html;
      this._renderCoverageMap().then(inner => {
        const wrap = document.getElementById('coverageMapWrap');
        if (wrap) wrap.innerHTML = inner;
      });
      return;
    }

    if (mapMode === 'notes') {
      html += this._renderNotesList();
      el.innerHTML = html;
      return;
    }

    if (mapMode === 'saved') {
      html += this._renderSavedList();
      el.innerHTML = html;
      return;
    }

    if (mapMode === 'visual') {
      html += await this.renderVisualMap(visibleVoices);
      el.innerHTML = html;
      this._vmapInitZoom();
      return;
    }

    // List mode legend
    html += `<div class="map-legend">
      <span class="ml-item"><svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#059669"/></svg> Read</span>
      <span class="ml-item"><svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#E7E5E4"/></svg> Unread</span>
      <span class="ml-item"><span style="font-size:.65rem;font-weight:700;color:var(--accent);background:var(--accent-bg);padding:.1em .3em;border-radius:3px">CORE</span> Must read</span>
      <span class="ml-item"><span style="font-size:.65rem">\u{1F3AE}</span> Mini-game</span>
    </div>`;

    // Chapter reading order — which chapters should come before which
    const chapterPrereqs = {
      0: [],           // Ch1 Introduction — start here
      1: [0],          // Ch2 Data — after Intro
      2: [0, 1],       // Ch3 Objectives — after Intro + Data
      3: [2],          // Ch4 Scenarios — after Objectives
      4: [2],          // Ch5 Algorithms — after Objectives
      5: [4],          // Ch6 Evaluation — after Algorithms
      6: [5],          // Ch7 Explainability — after Evaluation
      7: [4],          // Ch8 Deployment — after Algorithms
      8: [7],          // Ch9 Monitoring — after Deployment
      9: [4],          // Ch10 Customization — after Algorithms
      10: [0],         // Ch11 Ethics — after Intro
      11: [2],         // Ch12 Domains — after Objectives
      12: [4],         // Ch13 Research — after Algorithms
      13: [4],         // Ch14 Build Your Own — after Algorithms
    };

    // Find suggested next block
    const suggestedNext = this.getSuggestedNext(chapterPrereqs);

    this.book.chapters.forEach((ch, ci) => {
      const blocks = this.chapters[ci]?.blocks || [];
      const allItems = blocks.filter(b => b.type === 'spine' || b.type === 'game');
      const readCount = allItems.filter(b => this.user.readBlocks.has(b.id)).length;
      const coreCount = allItems.filter(b => b.core).length;
      const coreRead = allItems.filter(b => b.core && this.user.readBlocks.has(b.id)).length;
      const totalCount = allItems.length;
      const chPct = Math.round((readCount / Math.max(totalCount, 1)) * 100);

      html += `<div class="map-chapter fade-up">`;

      // Chapter image (if available)
      const chImages = {
        'ch12-domains': '/images/domains/e-commerce.png',
        'ch05-algorithms': '/images/kids-pipeline.svg',
        'ch01-introduction': '/images/hero-recsys.svg',
      };
      const chImg = chImages[ch.id] ? `<img src="${chImages[ch.id]}" class="map-ch-img" alt="">` : '';

      html += `<div class="map-ch-head" onclick="app.goChapter(${ci})">
        <div class="map-ch-ring" data-pct="${chPct}">
          <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="none" stroke="var(--border)" stroke-width="2.5"/>
          <circle cx="18" cy="18" r="16" fill="none" stroke="${chPct === 100 ? 'var(--product)' : 'var(--accent)'}" stroke-width="2.5" stroke-dasharray="${chPct} ${100 - chPct}" stroke-dashoffset="25" stroke-linecap="round"/></svg>
          <span class="map-ch-num">${ch.number}</span>
        </div>
        <div class="map-ch-info">
          <div class="map-ch-title">${ch.title}</div>
          <div class="map-ch-sub">${ch.subtitle}</div>
          <div class="map-ch-stats">${readCount}/${totalCount} read &middot; ${coreRead}/${coreCount} core</div>
        </div>
        ${chImg}
        <div class="map-ch-arrow">&rsaquo;</div>
      </div>`;

      // All blocks: spine + game + question
      html += '<div class="map-blocks">';
      allItems.forEach(item => {
        const isRead = this.user.readBlocks.has(item.id);
        const isCore = item.core;
        const isGame = item.type === 'game';
        const icon = isGame ? '\u{1F3AE}' : isCore ? '\u{25CF}' : '\u{25CB}';
        const badge = isCore ? '<span class="map-core-badge">CORE</span>' : '';
        const gameTag = isGame ? '<span class="map-game-tag">\u{1F3AE}</span>' : '';

        html += `<div class="map-block ${isRead ? 'read' : ''}" onclick="app.openBlock('${item.id}')">
          <div class="map-dot ${isRead ? 'done' : ''}"></div>
          <span class="map-block-title">${item.title}</span>
          ${badge}${gameTag}
          <span class="map-block-time">${item.readingTime || 3}m</span>
        </div>`;
      });
      // Questions
      blocks.filter(b => b.type === 'question').forEach(q => {
        html += `<div class="map-block" onclick="app.openBlock('${q.id}')">
          <div class="map-dot" style="background:var(--accent)"></div>
          <span class="map-block-title">${q.title}</span>
          <span class="map-game-tag">\u{2753}</span>
        </div>`;
      });
      html += '</div></div>';
    });

    el.innerHTML = html;
  }

  getSuggestedNext(prereqs) {
    for (let ci = 0; ci < this.book.chapters.length; ci++) {
      const blocks = this.chapters[ci]?.blocks || [];
      const spines = blocks.filter(b => b.type === 'spine');
      const next = spines.find(b => !this.user.readBlocks.has(b.id));
      if (next) return next.id;
    }
    return null;
  }

  setMapMode(mode) { this._mapMode = mode; this.renderMap(); }

  // ===== LIVING BOOK COVERAGE MAP (reader-facing) =====
  // Rows are ARTICLES — every telling in the book plus your private and reader-shared
  // ones — grouped by chapter. Pick a dimension; each row marks the values its
  // subspace covers (one article can serve several). Click a row to read it.
  async _renderCoverageMap() {
    if (!this._covDim) this._covDim = 'lens';
    const dim = this._covDim;
    let community = this._covCommunity;
    if (!community) {
      try { community = await this.rc.listCommunityBlocks(null, 200); } catch (e) { community = []; }
      this._covCommunity = community;
    }

    const conf = CONFIG.facets[dim];
    const values = conf.values;
    const icons = conf.icons || {};
    const myVal = this.user.getTargetFacets()[dim] || this._facetDefault(dim);
    const DIM_LABELS = { lens: '🌐 World', depth: '📏 Depth', visuality: '🖼 Form', carriers: '🧩 Blocks', genre: '✒️ Genre', lang: '🌍 Language', lengthBand: '⏱ Length' };

    // non-git articles land in the chapter of their (primary) concept's anchor
    const chapterOfConcept = cid => this.concepts?.[cid]?.chapter;
    const extraRows = {}; // chapterId → [{meta, kind}]
    community.forEach(b => {
      const ch = chapterOfConcept(this._conceptIds(b.meta)[0]);
      if (ch) (extraRows[ch] = extraRows[ch] || []).push({ meta: b.meta, kind: 'shared' });
    });
    Object.values(this.privateBlocks || {}).forEach(b => {
      if (b.meta.state === 'community') return; // already listed via community sweep when shared
      const ch = chapterOfConcept(this._conceptIds(b.meta)[0]);
      if (ch) (extraRows[ch] = extraRows[ch] || []).push({ meta: b.meta, kind: 'yours' });
    });

    const stateColor = m => m.state === 'core' ? '#7C3AED' : (m.state === 'community' || m.state === 'private') ? '#D97706' : '#10B981';
    let totalArticles = 0;
    const coveringCount = {}; values.forEach(v => coveringCount[v] = 0);

    const rowHtml = (meta, extraBadge) => {
      totalArticles++;
      const set = this._facetValues(meta, dim);
      set.forEach(v => { if (coveringCount[v] !== undefined) coveringCount[v]++; });
      const color = stateColor(meta);
      const cells = values.map(v => {
        const my = v === myVal ? ' covmap-mylens' : '';
        return set.includes(v)
          ? `<td class="covmap-cell${my}" onclick="app.openTelling('${meta.id}')" title="covers ${v} — read"><span style="color:${color};font-size:.85rem">●</span></td>`
          : `<td class="covmap-cell${my}" style="cursor:default"><span style="color:var(--border)">·</span></td>`;
      }).join('');
      return `<tr><td class="covmap-concept" onclick="app.openTelling('${meta.id}')" title="Read">
        ${extraBadge || ''}${this.escHtml(meta.title || meta.id)}</td>${cells}</tr>`;
    };

    let sections = '';
    for (let i = 0; i < this.book.chapters.length; i++) {
      const ch = this.book.chapters[i];
      const blocks = (this.chapters[i]?.blocks || []);
      const extras = extraRows[ch.id] || [];
      if (!blocks.length && !extras.length) continue;
      let rows = '';
      blocks.forEach(b => { rows += rowHtml(b); });
      extras.forEach(({ meta, kind }) => {
        rows += rowHtml(meta, `<span class="telling-badge" style="color:#D97706;border-color:#D97706">${kind === 'yours' ? '✨ yours' : '⚡ shared'}</span> `);
      });
      // chapter heat: share of this chapter's articles covering each value
      const chMetas = blocks.concat(extras.map(e => e.meta));
      const heat = values.map(v => {
        const n = chMetas.filter(m => this._facetValues(m, dim).includes(v)).length;
        const pct = chMetas.length ? n / chMetas.length : 0;
        const bg = pct === 0 ? 'var(--border)' : pct < 0.34 ? '#FDE68A' : pct < 0.85 ? '#A7F3D0' : '#6EE7B7';
        return `<span class="cov-heat" style="background:${bg}" title="${v}: ${n}/${chMetas.length} articles">${icons[v] || v[0]}</span>`;
      }).join('');
      sections += `<details class="covmap-chapter-sec"><summary>Ch${ch.number} · ${this.escHtml(ch.title)}
          <span class="covmap-mini">${chMetas.length} articles</span>
          <span class="cov-heatrow">${heat}</span></summary>
        <div style="overflow-x:auto"><table class="covmap">
          <tr><th></th>${values.map(v => `<th class="${v === myVal ? 'covmap-mylens' : ''}">${icons[v] || ''}<div>${v}</div></th>`).join('')}</tr>
          ${rows}
        </table></div></details>`;
    }

    return `<div class="covmap-intro">
        <div class="tellings-dims" style="margin-bottom:.4em">${Object.entries(DIM_LABELS).map(([d, l]) =>
          `<button class="steer-chip ${d === dim ? 'dim-active' : ''}" onclick="app.setCovDim('${d}')">${l}</button>`).join('')}
        </div>
        <p style="font-size:.78rem;margin-bottom:.3em">Every article of the living book — <b>${totalArticles}</b> rows; per value:${values.map(v => ` ${icons[v] || v} <b>${coveringCount[v]}</b>`).join(' ·')}. ● marks the values an article's subspace covers — one article can serve several${myVal && myVal !== this._facetDefault(dim) ? `; your setting <b>${icons[myVal] || ''} ${myVal}</b> is highlighted` : ''}. Click a row to read; to request or generate a missing telling, use the 🎛 panel inside any section. Missing a whole <i>concept</i>? <a href="#" onclick="event.preventDefault();app.proposeConcept()" style="color:var(--accent)">🌱 propose it</a>.</p>
        <p style="font-size:.68rem;color:var(--text-3)">● color = state: <span style="color:#7C3AED">■</span> core · <span style="color:#10B981">■</span> edited · <span style="color:#D97706">■</span> reader content (✨ yours / ⚡ shared)</p>
      </div>
      <div id="covInspector"></div>
      ${sections}`;
  }

  setCovDim(dim) { this._covDim = dim; this.renderMap(); }

  // Cell inspector: the assignment, made visible — every telling in (concept × value)
  // with its FULL covered subspace, or a gap CTA.
  covInspect(conceptId, value) {
    const dim = this._covDim || 'lens';
    const c = this.concepts?.[conceptId];
    const box = document.getElementById('covInspector');
    if (!c || !box) return;
    this.rc.logEvent('coverage_click', { concept: conceptId, dim, value });

    const inCell = [];
    (this.conceptBlocks[conceptId] || []).forEach(b => { if (this._covers(b.meta, dim, value)) inCell.push({ b, kind: 'git' }); });
    (this._covCommunity || []).forEach(b => { if (this._conceptIds(b.meta).includes(conceptId) && this._covers(b.meta, dim, value)) inCell.push({ b, kind: 'community' }); });
    Object.values(this.privateBlocks || {}).forEach(b => { if (this._conceptIds(b.meta).includes(conceptId) && this._covers(b.meta, dim, value)) inCell.push({ b, kind: 'private' }); });

    const icons = CONFIG.facets[dim].icons || {};
    let h = `<div class="cov-inspector">
      <div class="tellings-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>${this.escHtml(c.title)} × ${icons[value] || ''} ${value}</span>
        <button class="steer-chip" onclick="document.getElementById('covInspector').innerHTML=''">✕ close</button>
      </div>`;
    if (!inCell.length) {
      h += `<div class="tellings-miss">Nothing assigned here yet — this cell is an invitation.</div>
        <button class="steer-chip steer-gen" onclick="app.coverageGap('${conceptId}','${value}')">Open the concept &amp; request / generate this telling →</button>`;
    } else {
      h += inCell.map(({ b }) => `<div class="telling-row">
          ${this._stateBadge(b.meta)}
          <span class="telling-title">${this.escHtml(b.meta.title || b.meta.id)}</span>
          ${this._facetChips(b.meta)}
          <button class="steer-chip" onclick="app.openTelling('${b.meta.id}')">Read</button>
        </div>`).join('');
      h += `<div style="font-size:.66rem;color:var(--text-3);margin-top:.4em">Chips show each telling's full covered subspace — one telling can serve several cells of this map.</div>`;
    }
    h += '</div>';
    box.innerHTML = h;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Open any telling by id: git blocks directly, community/private via anchor + swap
  openTelling(id) {
    if (this.findBlock(id)) { this.openBlock(id, 'coverage'); return; }
    const entry = this._findAnyBlock(id);
    const anchor = this.concepts?.[entry?.meta?.concept]?.anchor;
    if (!entry || !anchor || !this.findBlock(anchor)) return;
    this.openBlock(anchor, 'coverage');
    setTimeout(() => this._swapBlock(anchor, entry, this._blockFacets(entry.meta) || {}), 600);
  }

  // A gap was clicked: open the concept's anchor and steer toward that value on the
  // current dimension — serves a matching telling if one exists, else the generate CTA
  coverageGap(conceptId, value) {
    const dim = this._covDim || 'lens';
    const c = this.concepts?.[conceptId];
    if (!c || !this.findBlock(c.anchor)) return;
    this.openBlock(c.anchor, 'coverage');
    setTimeout(() => {
      const anchorMeta = this.findBlock(c.anchor)?.meta;
      if (this._covers(anchorMeta, dim, value)) this.toggleTellings(c.anchor);
      else this.steerDim(c.anchor, dim, value);
    }, 600);
  }

  _renderSavedList() {
    const savedIds = [...this.user.savedBlocks];
    const saved = savedIds.map(id => this.findBlock(id)).filter(Boolean);

    if (!saved.length) {
      return `<div style="text-align:center;padding:2em;color:var(--text-3);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius)">
        <p style="font-size:1.5rem;margin-bottom:.3em">&#128278;</p>
        <p style="font-size:.85rem;font-weight:600">No saved items yet</p>
        <p style="font-size:.78rem;color:var(--text-3);margin-top:.2em">Tap the bookmark icon on any section to save it for later.</p>
      </div>`;
    }

    let html = `<div style="font-size:.82rem;color:var(--text-2);margin-bottom:.8em">${saved.length} saved item${saved.length !== 1 ? 's' : ''} — tap to read, swipe to remove</div>`;
    html += '<div class="map-blocks">';
    saved.reverse().forEach(b => {
      const isRead = this.user.readBlocks.has(b.meta.id);
      const isCore = b.meta.core;
      html += `<div class="map-block ${isRead ? 'read' : ''}" style="position:relative" onclick="app.openBlock('${b.meta.id}')">
        <div class="map-dot ${isRead ? 'done' : ''}"></div>
        <span class="map-block-title">${b.meta.title}</span>
        ${isCore ? '<span class="map-core-badge">CORE</span>' : ''}
        <span style="font-size:.65rem;color:var(--text-3)">Ch${b.meta._chapterNum}</span>
        <button class="saved-remove-btn" onclick="event.stopPropagation();app.unsaveBlock('${b.meta.id}')" title="Remove from saved">&times;</button>
      </div>`;
    });
    html += '</div>';
    return html;
  }

  unsaveBlock(blockId) {
    this.user.savedBlocks.delete(blockId);
    this.user.save();
    this.renderMap();
  }

  _getNoteCount() {
    try {
      const store = JSON.parse(localStorage.getItem('pbook-notes') || '{}');
      let count = 0;
      for (const val of Object.values(store)) {
        count += Array.isArray(val) ? val.length : (val ? 1 : 0);
      }
      return count;
    } catch(e) { return 0; }
  }

  _renderNotesList() {
    let store = {};
    try { store = JSON.parse(localStorage.getItem('pbook-notes') || '{}'); } catch(e) {}

    // Flatten all notes across blocks into a list
    const allNotes = [];
    for (const [blockId, val] of Object.entries(store)) {
      const arr = typeof val === 'string' ? [{ text: val, quote: '', ts: 0 }] : (Array.isArray(val) ? val : []);
      arr.forEach((n, idx) => allNotes.push({ blockId, ...n, idx }));
    }
    // Sort newest first
    allNotes.sort((a, b) => (b.ts || 0) - (a.ts || 0));

    if (!allNotes.length) {
      return `<div style="text-align:center;padding:2em;color:var(--text-3);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius)">
        <p style="font-size:1.5rem;margin-bottom:.3em">&#128221;</p>
        <p style="font-size:.85rem;font-weight:600">No notes yet</p>
        <p style="font-size:.78rem;color:var(--text-3);margin-top:.2em">Select text and tap "Highlight + Note", or tap the note icon on any section.</p>
      </div>`;
    }

    let html = `<div style="font-size:.82rem;color:var(--text-2);margin-bottom:.8em">${allNotes.length} note${allNotes.length !== 1 ? 's' : ''}</div>`;
    html += '<div class="map-blocks">';
    allNotes.forEach(n => {
      const block = this.findBlock(n.blockId);
      const title = block?.meta?.title || n.blockId;
      const ch = block?.meta?._chapterNum || '?';
      const quoteHtml = n.quote ? `<div style="font-size:.72rem;color:var(--accent);font-style:italic;padding-left:1.6em;line-height:1.3;margin-bottom:.15em">"${this.escHtml(n.quote.substring(0, 120))}${n.quote.length > 120 ? '...' : ''}"</div>` : '';
      const textHtml = n.text ? `<div style="font-size:.78rem;color:var(--text-2);padding-left:1.6em;line-height:1.35">${this.escHtml(n.text.substring(0, 150))}${n.text.length > 150 ? '...' : ''}</div>` : '';
      html += `<div class="map-block" style="flex-direction:column;align-items:stretch;gap:.2em;cursor:pointer" onclick="app.openBlock('${n.blockId}')">
        <div style="display:flex;align-items:center;gap:.4em">
          <div class="map-dot ${this.user.readBlocks.has(n.blockId) ? 'done' : ''}"></div>
          <span class="map-block-title">${title}</span>
          <span style="font-size:.65rem;color:var(--text-3)">Ch${ch}</span>
          <button class="saved-remove-btn" onclick="event.stopPropagation();app.deleteUserNote('${n.blockId}',${n.idx});app.renderMap()" title="Delete note">&times;</button>
        </div>
        ${quoteHtml}${textHtml}
      </div>`;
    });
    html += '</div>';
    return html;
  }




  // ===== VISUAL RPG MAP =====
  async renderVisualMap(visibleVoices) {
    if (!this._visualMapData) {
      try {
        const res = await fetch('/content/visual-map-data.json');
        this._visualMapData = await res.json();
      } catch (e) {
        return '<div style="padding:2em;text-align:center;color:var(--text-3)">Visual map loading...</div>';
      }
    }
    const mapData = this._visualMapData;
    const W = mapData.width || 1400, H = mapData.height || 900;
    const readSet = this.user.readBlocks;
    const savedSet = this.user.savedBlocks;
    const readCount = mapData.items.filter(i => readSet.has(i.id)).length;
    const coreCount = mapData.items.filter(i => i.core).length;
    const coreRead = mapData.items.filter(i => i.core && readSet.has(i.id)).length;

    // Filter bar
    let html = `<div class="vmap-container">
    <div class="vmap-toolbar" style="display:flex;gap:.4em;padding:.4em;flex-wrap:wrap;align-items:center;font-size:.72rem">
      <button class="vmap-filter-btn active" data-filter="all" onclick="app._vmapFilter('all',this)">All (${mapData.items.length})</button>
      <button class="vmap-filter-btn" data-filter="core" onclick="app._vmapFilter('core',this)">Core (${coreCount})</button>
      <button class="vmap-filter-btn" data-filter="unread" onclick="app._vmapFilter('unread',this)">Unread (${mapData.items.length - readCount})</button>
      <button class="vmap-filter-btn" data-filter="read" onclick="app._vmapFilter('read',this)">Read (${readCount})</button>
      <span style="margin-left:auto;color:var(--text-3)">Scroll to zoom · Drag to pan</span>
    </div>
    <div class="vmap-canvas" id="vmapCanvas" style="overflow:hidden;position:relative;border:1px solid var(--border);border-radius:8px;touch-action:none;cursor:grab">
      <svg id="vmapSvg" viewBox="0 0 ${W} ${H}" style="width:100%;display:block">
      <rect width="${W}" height="${H}" fill="var(--bg)"/>`;

    // Edges (similarity lines)
    if (mapData.edges) {
      mapData.edges.forEach(e => {
        html += `<line class="vmap-edge" x1="${e.fx}" y1="${e.fy}" x2="${e.tx}" y2="${e.ty}" stroke="var(--border)" stroke-width="0.5" opacity="0.3"/>`;
      });
    }

    // Chapter labels
    mapData.chapters.forEach(ch => {
      html += `<text x="${ch.cx}" y="${ch.cy - 28}" text-anchor="middle" font-size="13" font-weight="800" fill="${ch.color}" opacity="0.25" letter-spacing="0.5" class="vmap-ch-label">${ch.title.toUpperCase()}</text>`;
      html += `<text x="${ch.cx}" y="${ch.cy - 15}" text-anchor="middle" font-size="9" fill="${ch.color}" opacity="0.2">${ch.count} sections</text>`;
    });

    // Items
    mapData.items.forEach(item => {
      const isRead = readSet.has(item.id);
      const isSaved = savedSet.has(item.id);
      const isCore = item.core;
      const color = mapData.colors[item.chapter] || '#666';
      const r = isCore ? 7 : 4;
      const opacity = isRead ? '1.0' : isCore ? '0.65' : '0.3';
      let stroke = '';
      if (isSaved) stroke = `stroke="#f59e0b" stroke-width="2"`;
      else if (isRead) stroke = `stroke="#10B981" stroke-width="1.5"`;
      else if (isCore) stroke = `stroke="rgba(255,255,255,0.6)" stroke-width="1"`;
      const t = this.escHtml(item.title.length > 35 ? item.title.substring(0, 33) + '…' : item.title);
      const cls = `vmap-node${isCore ? ' vn-core' : ''}${isRead ? ' vn-read' : ''}${isSaved ? ' vn-saved' : ''}`;

      html += `<g class="${cls}" data-id="${item.id}" data-ch="${item.chapter}" style="cursor:pointer" onclick="window.open('#${item.id}','_blank')">
        <circle cx="${item.x}" cy="${item.y}" r="${r}" fill="${color}" opacity="${opacity}" ${stroke}/>
        <text class="vmap-label" x="${item.x}" y="${item.y - r - 3}" text-anchor="middle" font-size="7.5" fill="var(--text-1)" opacity="${isCore ? '0.75' : '0'}" font-weight="${isCore ? '600' : '400'}">${t}</text>
      </g>`;
    });

    html += `</svg></div>`;

    // Legend
    html += `<div style="display:flex;flex-wrap:wrap;gap:.3em .5em;padding:.4em .2em;font-size:.65rem;align-items:center">`;
    mapData.chapters.forEach(ch => {
      html += `<span class="vmap-ch-pill" data-ch="${ch.id}" onclick="app._vmapHighlightCh('${ch.id}')" style="display:inline-flex;align-items:center;gap:.2em;cursor:pointer;padding:.1em .4em;border-radius:10px;white-space:nowrap;border:1.5px solid transparent"><span style="width:7px;height:7px;border-radius:50%;background:${ch.color};display:inline-block;flex-shrink:0"></span>${ch.title}</span>`;
    });
    html += `</div>`;
    html += `<div style="font-size:.65rem;color:var(--text-3);padding:0 .3em .3em;display:flex;gap:.8em;flex-wrap:wrap">
      <span>Progress: ${readCount}/${mapData.items.length} read · ${coreRead}/${coreCount} core</span>
      <span>◉ core · <span style="color:#10B981">◉</span> read · <span style="color:#f59e0b">◉</span> saved</span>
    </div></div>`;
    return html;
  }

  // Visual map interactions — zoom, pan, pinch (desktop + mobile)
  _vmapInitZoom() {
    const container = document.getElementById('vmapCanvas');
    const svg = document.getElementById('vmapSvg');
    if (!container || !svg) return;

    const vbAttr = svg.getAttribute('viewBox').split(' ');
    const origW = parseFloat(vbAttr[2]), origH = parseFloat(vbAttr[3]);
    let vx = 0, vy = 0, vw = origW, vh = origH;
    let dragging = false, startX, startY, startVx, startVy;
    let pinchDist0 = 0, pinchVw0 = 0, pinchVh0 = 0;

    const clamp = () => {
      vw = Math.max(200, Math.min(origW * 2, vw));
      vh = vw * (origH / origW);
      vx = Math.max(-origW * 0.5, Math.min(origW - vw * 0.3, vx));
      vy = Math.max(-origH * 0.5, Math.min(origH - vh * 0.3, vy));
    };
    const apply = () => { clamp(); svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`); };

    // Zoom buttons
    const zoomBar = document.createElement('div');
    zoomBar.style.cssText = 'position:absolute;top:8px;right:8px;display:flex;flex-direction:column;gap:4px;z-index:2';
    zoomBar.innerHTML = `
      <button onclick="app._vmapZoom(-1)" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--border);background:var(--bg);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center">+</button>
      <button onclick="app._vmapZoom(1)" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--border);background:var(--bg);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center">−</button>
      <button onclick="app._vmapZoom(0)" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--border);background:var(--bg);font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center">⟲</button>`;
    container.appendChild(zoomBar);

    this._vmapZoom = (dir) => {
      if (dir === 0) { vx = 0; vy = 0; vw = origW; vh = origH; }
      else { const f = dir > 0 ? 1.3 : 0.77; const cx = vx + vw/2; const cy = vy + vh/2; vw *= f; vh *= f; vx = cx - vw/2; vy = cy - vh/2; }
      apply();
    };

    // Desktop: wheel zoom (only when pointer is inside the map)
    container.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;
      const f = e.deltaY > 0 ? 1.15 : 0.87;
      const cx = vx + vw * mx;
      const cy = vy + vh * my;
      vw *= f; vh *= f;
      vx = cx - vw * mx;
      vy = cy - vh * my;
      apply();
    }, { passive: false });

    // Pointer drag (desktop + mobile single finger)
    container.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch' && container._touchCount > 1) return;
      dragging = true; startX = e.clientX; startY = e.clientY; startVx = vx; startVy = vy;
      container.setPointerCapture(e.pointerId);
      container.style.cursor = 'grabbing';
    });
    container.addEventListener('pointermove', e => {
      if (!dragging) return;
      const rect = container.getBoundingClientRect();
      const dx = (e.clientX - startX) / rect.width * vw;
      const dy = (e.clientY - startY) / rect.height * vh;
      vx = startVx - dx; vy = startVy - dy;
      apply();
    });
    const endDrag = () => { dragging = false; container.style.cursor = 'grab'; };
    container.addEventListener('pointerup', endDrag);
    container.addEventListener('pointercancel', endDrag);

    // Mobile: pinch to zoom
    container._touchCount = 0;
    container.addEventListener('touchstart', e => {
      container._touchCount = e.touches.length;
      if (e.touches.length === 2) {
        dragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDist0 = Math.sqrt(dx*dx + dy*dy);
        pinchVw0 = vw; pinchVh0 = vh;
      }
    }, { passive: true });
    container.addEventListener('touchmove', e => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const f = pinchDist0 / Math.max(dist, 1);
        const cx = vx + vw/2; const cy = vy + vh/2;
        vw = pinchVw0 * f; vh = pinchVh0 * f;
        vx = cx - vw/2; vy = cy - vh/2;
        apply();
      }
    }, { passive: false });
    container.addEventListener('touchend', e => { container._touchCount = e.touches.length; });

    // Hover labels (desktop only)
    svg.querySelectorAll('.vmap-node').forEach(g => {
      g.addEventListener('mouseenter', () => { const l = g.querySelector('.vmap-label'); if (l) l.setAttribute('opacity', '1'); });
      g.addEventListener('mouseleave', () => { const l = g.querySelector('.vmap-label'); if (l && !g.classList.contains('vn-core')) l.setAttribute('opacity', '0'); });
    });

    // Hover labels
    svg.querySelectorAll('.vmap-node').forEach(g => {
      g.addEventListener('mouseenter', () => { const lbl = g.querySelector('.vmap-label'); if (lbl) lbl.setAttribute('opacity', '1'); });
      g.addEventListener('mouseleave', () => { const lbl = g.querySelector('.vmap-label'); if (lbl && !g.classList.contains('vn-core')) lbl.setAttribute('opacity', '0'); });
    });
  }

  _vmapFilter(filter, btn) {
    document.querySelectorAll('.vmap-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.vmap-node').forEach(g => {
      const isCore = g.classList.contains('vn-core');
      const isRead = g.classList.contains('vn-read');
      let show = true;
      if (filter === 'core') show = isCore;
      else if (filter === 'unread') show = !isRead;
      else if (filter === 'read') show = isRead;
      g.style.display = show ? '' : 'none';
    });
  }

  _vmapHighlightCh(chId) {
    const pills = document.querySelectorAll('.vmap-ch-pill');
    const isActive = [...pills].find(p => p.dataset.ch === chId)?.classList.contains('vmap-ch-active');
    pills.forEach(p => { p.classList.remove('vmap-ch-active'); p.style.borderColor = 'transparent'; });
    if (isActive) {
      // Deselect: show all
      document.querySelectorAll('.vmap-node').forEach(g => { g.style.opacity = ''; });
      document.querySelectorAll('.vmap-edge').forEach(e => { e.style.opacity = ''; });
      return;
    }
    const pill = [...pills].find(p => p.dataset.ch === chId);
    if (pill) { pill.classList.add('vmap-ch-active'); pill.style.borderColor = 'var(--accent)'; }
    document.querySelectorAll('.vmap-node').forEach(g => {
      g.style.opacity = g.dataset.ch === chId ? '1' : '0.1';
    });
    document.querySelectorAll('.vmap-edge').forEach(e => { e.style.opacity = '0.05'; });
  }

  // ===== TRANSPARENT FACET PROFILE =====
  // Shows the learned preference model in plain words and lets the reader correct it.
  // A correction is itself the strongest signal (explicit steer pref).
  _renderFacetProfile() {
    const u = this.user;
    const target = u.getTargetFacets();
    const summary = u.getAffinitySummary();
    const FACET_WORDS = {
      lens: { generic: 'examples from everywhere', ecommerce: 'shopping examples', media: 'music & video examples', 'social-feeds': 'social feed examples', education: 'learning examples' },
      visuality: { 'text-first': 'text explanations', balanced: 'a mix of text and diagrams', 'visual-first': 'visual explanations' },
      depth: { intro: 'gentle introductions', standard: 'standard depth', technical: 'technical depth', research: 'research-level depth' },
      formalism: { none: 'no formulas', light: 'a few formulas', full: 'full math' },
    };
    let h = '';

    // ---- Recently viewed: the way back to what you were just reading/editing ----
    // (arrow-key chapter hops made readers lose their place — this is the undo)
    {
      const seen = new Map();
      const missed = new Set();
      for (let i = this.rc.interactions.length - 1; i >= 0 && seen.size < 12; i--) {
        const it = this.rc.interactions[i];
        if (it.type !== 'detailview' || !it.itemId || seen.has(it.itemId) || missed.has(it.itemId)) continue;
        const entry = this._findAnyBlock(it.itemId);
        if (!entry) { missed.add(it.itemId); continue; }
        seen.set(it.itemId, { meta: entry.meta, ts: it.ts });
      }
      if (seen.size) {
        const edited = new Set(Object.values(this.privateBlocks || {}).map(b => b.meta.remixOf).filter(Boolean));
        h += '<div class="profile-section"><h3>🕘 Recently viewed</h3><div class="history-list">';
        for (const [id, { meta, ts }] of seen) {
          const when = ts ? this._timeAgo(ts) : '';
          const mark = edited.has(id) || this._overrides?.[id] ? ' <span class="hist-edit" title="you have edits here">✏️</span>' : '';
          h += `<button class="hist-row" onclick="app.openBlock('${id}')">
            <span class="hist-title">${this.escHtml(meta.title || id)}${mark}</span>
            <span class="hist-meta">${this.escHtml(meta._chapterTitle || '')} · ${when}</span></button>`;
        }
        h += '</div></div>';
      }
    }

    h += '<div class="profile-section"><h3>&#129516; Your Reading DNA</h3>';
    h += '<p style="font-size:.78rem;color:var(--text-2);margin-bottom:.6em">The preference model the book has learned about you — the same kind every recommender builds. Correct it anytime; your corrections always win.</p>';

    // Visual affinity bars (top values per primary facet)
    const FACET_LABELS = { lens: '🌐 Example world', depth: '📏 Depth', visuality: '🖼 Visual style' };
    let hasBars = false;
    for (const facet of ['lens', 'depth', 'visuality']) {
      const aff = u.facetAffinity[facet];
      if (!aff) continue;
      const entries = Object.entries(aff).sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((s, [, v]) => s + v, 0);
      if (!entries.length || total < 2) continue;
      hasBars = true;
      h += `<div class="dna-row"><span class="dna-label">${FACET_LABELS[facet]}</span><div class="dna-bars">`;
      entries.slice(0, 3).forEach(([val, score]) => {
        const pct = Math.round((score / total) * 100);
        const word = (FACET_WORDS[facet] || {})[val] || val;
        const pinned = u.steerPrefs[facet] === val;
        h += `<div class="dna-bar-line"><span class="dna-val">${word}${pinned ? ' 📌' : ''}</span>
          <div class="dna-track"><div class="dna-fill" style="width:${pct}%"></div></div>
          <span class="dna-pct">${pct}%</span></div>`;
      });
      h += '</div></div>';
    }
    if (!hasBars) {
      h += '<p style="font-size:.85rem;margin-bottom:.7em">Still learning about you — read a few sections, tap 👍 or steer any telling, and this fills in.</p>';
    }

    // Contributions to the living book
    const priv = Object.values(this.privateBlocks || {});
    const remixes = priv.filter(b => b.meta.remixOf).length;
    const generated = priv.length - remixes;
    const shared = priv.filter(b => b.meta.state === 'community').length;
    if (priv.length || this.user.readerMode === 'open') {
      const sharedList = priv.filter(b => b.meta.state === 'community');
      const shareRows = sharedList.slice(0, 5).map(b =>
        `<div style="font-size:.72rem;padding:.1em 0">⚡ ${this.escHtml(b.meta.title || b.meta.id)}
          <button class="steer-chip" style="font-size:.62rem;padding:.05em .4em" onclick="app.shareThing('${this.escHtml(b.meta.title || 'My telling')}', 'I wrote this telling in the living book “How Recommendations Work”:', location.origin + '/#${b.meta.id}')">🔗 share</button></div>`).join('');
      h += (shareRows ? `<div style="margin:.3em 0">${shareRows}</div>` : '');
      h += `<div class="dna-contrib">🌱 <b>Your living-book contributions:</b>
        ${generated ? `${generated} generated telling${generated > 1 ? 's' : ''} · ` : ''}${remixes ? `${remixes} remix${remixes > 1 ? 'es' : ''} · ` : ''}${shared ? `<b>${shared} shared with readers</b> · ` : ''}${!priv.length ? 'none yet — select any passage and hit ✨, or find a gap on the ' : 'see the '}<a href="#" onclick="app.switchView('map');app.setMapMode('coverage');return false">🌱 map</a></div>`;
    }

    // Format preferences — explicit pins over the telling taxonomy. One tap per
    // dimension; "auto" = let the learned model decide. This replaces the legacy
    // Explorer/Creator/Thinker bars (voice still feeds ranking silently).
    const PREF_DIMS = [
      { facet: 'lang', label: '🌍 Language', words: { en: 'English', cs: 'česky' } },
      { facet: 'lengthBand', label: '⏱ Length', words: { tldr: 'short & sharp', standard: 'standard', deep: 'long form' } },
      { facet: 'visuality', label: '🖼 Form', words: FACET_WORDS.visuality },
      { facet: 'depth', label: '📏 Depth', words: FACET_WORDS.depth },
      { facet: 'lens', label: '🌐 World', words: FACET_WORDS.lens },
      { facet: 'carriers', label: '🧩 Blocks', words: { prose: 'text', table: 'tables', diagram: 'diagrams', image: 'images', animation: 'animations', formula: 'formulas', code: 'code' } },
    ];
    h += '<div style="margin-top:.6em;padding-top:.5em;border-top:1px solid var(--border)"><b style="font-size:.8rem">🎛 Format preferences</b><p style="font-size:.68rem;color:var(--text-3);margin:.15em 0 .4em">How should the book tell things to you? Explicit picks always beat the learned model.</p>';
    PREF_DIMS.forEach(({ facet, label, words }) => {
      const vals = CONFIG.facets[facet].values.filter(v => facet !== 'lens' || v !== 'generic');
      const pinned = u.steerPrefs[facet] || '';
      h += `<div class="dna-row" style="align-items:center"><span class="dna-label">${label}</span><div style="display:flex;flex-wrap:wrap;gap:.3em">
        <button class="steer-chip ${!pinned ? 'dim-active' : ''}" onclick="app.correctFacetPref('${facet}','')">auto</button>
        ${vals.map(v => `<button class="steer-chip ${pinned === v ? 'dim-active' : ''}" onclick="app.correctFacetPref('${facet}','${v}')">${(words || {})[v] || v}</button>`).join('')}
      </div></div>`;
    });
    h += '</div>';

    // Reader mode: safe (verified only) vs open (community + generation)
    if (this._f('community') || this._f('generation')) {
      h += `<div style="margin-top:.8em;padding-top:.6em;border-top:1px solid var(--border)">
        <label class="intro-toggle" style="display:flex;gap:.5em;align-items:flex-start">
          <input type="checkbox" ${u.readerMode === 'open' ? 'checked' : ''} onchange="app.setReaderMode(this.checked ? 'open' : 'safe')">
          <div><b>Open mode</b> — living book<br><span class="toggle-desc" style="font-size:.7rem">Also show content generated on demand and variants shared by other readers (clearly labelled, not yet editor-verified). Off = verified content only.</span></div>
        </label></div>`;
    }
    h += '</div>';
    return h;
  }

  correctFacetPref(facet, value) {
    this.user.setSteerPref(facet, value || null);
    if (value) this.user.updateFacetAffinity({ [facet]: value }, 3);
    this.rc.logEvent('profile_correction', { facet, value: value || 'auto' });
    this.rc.setUserProperties({ ['pref' + facet.charAt(0).toUpperCase() + facet.slice(1)]: value || '' });
    this.showXPToast('Preference saved', 'achievement');
    if (this.currentView === 'profile') this.renderProfile();
  }

  setReaderMode(mode) {
    try { localStorage.setItem('pbook-mode-chosen', '1'); } catch (e) {}
    this.user.readerMode = mode === 'open' ? 'open' : 'safe';
    this.user.save();
    this.rc.logEvent('reader_mode', { mode: this.user.readerMode });
    this.rc.setUserProperties({ readerMode: this.user.readerMode });
  }

  // ===== PROFILE VIEW =====
  renderProfile() {
    const el = document.getElementById('profileContent');
    const p = this.user.getProfile(this.allBlocks);
    const u = this.user;

    let h = '';

    // ---- Account indicator (compact — full login form is in Settings) ----
    const auth = this._getAuth();
    h += '<div class="profile-section">';
    if (auth) {
      h += `<div class="auth-card auth-logged-in">
        <div class="auth-avatar">${this.getLevelIcon()}</div>
        <div class="auth-info">
          <div class="auth-name">${this.escHtml(auth.displayName || 'Reader')}</div>
          <div class="auth-email"><span style="color:var(--product)">&#9679;</span> Synced &middot; ${this.escHtml(auth.email)}</div>
        </div>
        <button class="auth-sync-btn" onclick="app.syncProfile()" id="syncBtn">Sync</button>
      </div>`;
    } else {
      h += `<div class="auth-card" style="display:flex;align-items:center;gap:.8em">
        <span style="color:var(--text-3);font-size:1.2rem">&#9888;</span>
        <div style="flex:1">
          <div style="font-size:.82rem;font-weight:600">Not logged in</div>
          <div style="font-size:.72rem;color:var(--text-3)">Your progress is saved locally only.</div>
        </div>
        <button class="auth-primary-btn" style="flex:0 0 auto;padding:.4em .8em;font-size:.75rem" onclick="app.toggleSettings()">Log in</button>
      </div>`;
    }
    h += '</div>';

    // Level & XP hero card (gamification only)
    if (!this._f('gamification')) {
      h += `<div class="profile-section"><h3>Reading Progress</h3><p style="font-size:.85rem">${p.progress.read} of ${p.progress.total} sections read (${p.progress.pct}%)</p><p style="font-size:.8rem;color:var(--text-2)">${p.readingTimeMin} min total reading time</p></div>`;
    } else {
    const xpInLevel = u.getXPInCurrentLevel();
    const xpNeeded = u.getXPForNextLevel();
    const xpPct = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));
    h += `<div class="gami-hero">
      <div class="gami-level">Lv.${u.level}</div>
      <div class="gami-info">
        <div class="gami-title">${u.getLevelTitle()}</div>
        <div class="gami-xp-bar"><div class="gami-xp-fill" style="width:${xpPct}%"></div></div>
        <div class="gami-xp-text">${u.xp} XP &middot; ${xpNeeded - xpInLevel} XP to level ${u.level + 1}</div>
      </div>
    </div>`;

    // Quick stats row
    const dueCount = u.getDueRecalls().length;
    const totalRecall = Object.keys(u.recall).length;
    const totalReps = Object.values(u.recall).reduce((s, c) => s + c.reps, 0);
    h += `<div class="gami-stats">
      <div class="gami-stat"><span class="gs-num">${p.progress.read}</span><span class="gs-label">Read</span></div>
      <div class="gami-stat"><span class="gs-num">${p.progress.pct}%</span><span class="gs-label">Done</span></div>
      <div class="gami-stat"><span class="gs-num">${u.achievements.length}</span><span class="gs-label">Badges</span></div>
      <div class="gami-stat"><span class="gs-num">${p.readingTimeMin}</span><span class="gs-label">Min read</span></div>
    </div>`;

    // Recall section
    if (this._f('spaceRepetition')) {
      const totalWithQ = this.allBlocks.filter(b => b.meta.recallQ).length;
      const hardC = Object.values(u.recall).filter(c => c.ease < 1.8).length;
      const medC = Object.values(u.recall).filter(c => c.ease >= 1.8 && c.ease < 2.5).length;
      const easyC = Object.values(u.recall).filter(c => c.ease >= 2.5).length;

      h += '<div class="profile-section"><h3>\u{1F9E0} Memory Cards</h3>';

      if (totalRecall > 0) {
        // Confidence bar
        h += `<div style="display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--border);margin-bottom:.4em">
          ${hardC ? `<div style="width:${Math.round(hardC/totalRecall*100)}%;background:#dc2626"></div>` : ''}
          ${medC ? `<div style="width:${Math.round(medC/totalRecall*100)}%;background:var(--warn)"></div>` : ''}
          ${easyC ? `<div style="width:${Math.round(easyC/totalRecall*100)}%;background:var(--product)"></div>` : ''}
        </div>`;
        h += `<div style="display:flex;gap:.6em;font-size:.68rem;color:var(--text-3);margin-bottom:.5em">`;
        if (hardC) h += `<span style="color:#dc2626">${hardC} struggling</span>`;
        if (medC) h += `<span style="color:var(--warn)">${medC} learning</span>`;
        if (easyC) h += `<span style="color:var(--product)">${easyC} confident</span>`;
        h += `</div>`;

        // Next reviews
        const upcoming = Object.entries(u.recall)
          .filter(([_, c]) => c.nextReview > Date.now())
          .sort((a, b) => a[1].nextReview - b[1].nextReview)
          .slice(0, 3);
        if (upcoming.length) {
          h += `<div style="font-size:.68rem;color:var(--text-3);margin-bottom:.5em">Next reviews: ${upcoming.map(([id, c]) => {
            const title = this.findBlock(id)?.meta?.title || id;
            return `<span style="color:var(--warn)">${this._timeUntil(c.nextReview)}</span> ${this.escHtml(title)}`;
          }).join(' · ')}</div>`;
        }
      }

      // Stats
      h += `<div style="display:flex;gap:.6em;font-size:.78rem;margin-bottom:.5em">`;
      h += `<span>${totalRecall} tracked</span>`;
      h += `<span style="color:var(--text-3)">${totalWithQ} total</span>`;
      if (dueCount > 0) h += `<span style="color:var(--warn);font-weight:600">${dueCount} due now</span>`;
      h += `</div>`;

      // Actions
      h += `<div style="display:flex;gap:.4em">`;
      h += `<button class="btn-primary" style="flex:1;font-size:.78rem;padding:.4em" onclick="app.switchView('quiz')">\u{1F9E0} Quiz tab</button>`;
      if (dueCount > 0) h += `<button class="recall-reveal" style="flex:1" onclick="app.startPractice(true)">Review ${dueCount} due</button>`;
      h += `</div>`;
      h += `</div>`;
    }

    // Achievements
    h += '<div class="profile-section"><h3>&#127942; Achievements</h3>';
    if (u.achievements.length) {
      h += '<div class="gami-badges">';
      u.achievements.forEach(a => {
        h += `<div class="gami-badge earned" title="${a.desc}"><span class="badge-icon">${a.icon}</span><span class="badge-name">${a.name}</span></div>`;
      });
      h += '</div>';
    }
    // Show locked achievements
    const earnedIds = new Set(u.achievements.map(a => a.id));
    const allBadges = [
      { id: 'first_read', icon: '👣', name: 'First Steps' }, { id: 'reader_5', icon: '📚', name: 'Bookworm' },
      { id: 'reader_15', icon: '⚡', name: 'Speed Reader' }, { id: 'reader_30', icon: '🤖', name: 'Knowledge Machine' },
      { id: 'first_like', icon: '❤️', name: 'Thumbs Up' }, { id: 'like_10', icon: '🌟', name: 'Super Fan' },
      { id: 'first_note', icon: '📝', name: 'Note Taker' }, { id: 'voice_all', icon: '🎭', name: 'Triple Threat' },
      { id: 'curious_cat', icon: '🐱', name: 'Curious Cat' }, { id: 'quiz_master', icon: '🧩', name: 'Quiz Master' },
      { id: 'level_5', icon: '🏆', name: 'Level 5!' }, { id: 'save_5', icon: '🔖', name: 'Collector' },
      { id: 'xp_200', icon: '💎', name: 'XP Hunter' }, { id: 'deep_diver', icon: '🤿', name: 'Deep Diver' },
      { id: 'recall_5', icon: '🧠', name: 'Memory Pro' },
      { id: 'certified', icon: '🎓', name: 'Certified!' },
    ];
    const locked = allBadges.filter(a => !earnedIds.has(a.id));
    if (locked.length) {
      h += '<div class="gami-badges">';
      locked.forEach(a => { h += `<div class="gami-badge locked"><span class="badge-icon">🔒</span><span class="badge-name">${a.name}</span></div>`; });
      h += '</div>';
    }
    h += '</div>';

    // XP breakdown
    h += '<div class="profile-section"><h3>How to earn XP</h3>';
    h += '<div style="font-size:.8rem;display:grid;grid-template-columns:auto 1fr;gap:.3em .8em">';
    h += '<span style="font-weight:600;color:var(--accent)">+10 XP</span><span>Read a section</span>';
    h += '<span style="font-weight:600;color:var(--accent)">+5 XP</span><span>Explore a depth card</span>';
    h += '<span style="font-weight:600;color:var(--accent)">+5 XP</span><span>Write a note</span>';
    h += '<span style="font-weight:600;color:var(--accent)">+3 XP</span><span>Like a section</span>';
    h += '<span style="font-weight:600;color:var(--accent)">+2 XP</span><span>Save for later</span>';
    h += '<span style="font-weight:600;color:#F59E0B">+2-8 XP</span><span>Recall review (depends on how well you remember)</span>';
    h += '</div></div>';


    // Voice preference — computed from actually read non-core blocks by voice
    // Transparent facet profile — the book shows you your own preference model (and lets you fix it)
    h += this._renderFacetProfile();

    // Activity heatmap (last 8 weeks, GitHub-style, inline SVG)
    h += this._renderActivityHeatmap();

    // Knowledge cloud — extract terms from read blocks
    const termCounts = {};
    const CLOUD_TERMS = {
      'Collaborative Filtering': ['collaborative filter'],
      'Content-Based': ['content-based', 'content based'],
      'Cold Start': ['cold start', 'cold-start'],
      'Filter Bubble': ['filter bubble', 'bubble'],
      'Echo Chamber': ['echo chamber'],
      'A/B Testing': ['a/b test', 'ab test'],
      'Digital Footprints': ['footprint', 'digital footprint'],
      'Pipeline': ['pipeline', 'candidate generation'],
      'Popularity Bias': ['popular', 'trending', 'popularity'],
      'Privacy': ['privacy', 'gdpr', 'data protection'],
      'Tracking': ['tracker', 'cookie', 'tracking'],
      'Dopamine Loop': ['dopamine'],
      'Autoplay': ['autoplay', 'infinite scroll'],
      'Fairness': ['fair', 'unfair', 'bias'],
      'Diversity': ['diversity', 'long tail', 'coverage'],
      'Algorithms': ['algorithm'],
      'Recommendations': ['recommend', 'suggestion'],
      'User Signals': ['signal', 'implicit', 'explicit'],
      'Ratings': ['rating', 'stars', 'score'],
      'Similarity': ['similar', 'cosine', 'taste twin'],
      'Matrix Factorization': ['matrix factor', 'svd', 'latent'],
      'Machine Learning': ['machine learn', 'neural', 'deep learn'],
      'YouTube': ['youtube'],
      'TikTok': ['tiktok'],
      'Netflix': ['netflix'],
      'Spotify': ['spotify'],
      'Personalization': ['personali', 'personal'],
      'Data Collection': ['data collect', 'item catalog', 'user data'],
      'Exploration': ['exploration', 'exploit', 'bandit'],
      'Ethics': ['ethic', 'responsible', 'transparent'],
      'Embeddings': ['embedding', 'vector space', 'vector represent'],
      'Self-Attention': ['attention', 'transformer', 'self-attention'],
      'Two-Tower': ['two-tower', 'two tower', 'user tower', 'item tower'],
      'nDCG': ['ndcg', 'dcg', 'ranking quality'],
      'ALS': ['alternating least', 'als '],
    };
    [...u.readBlocks].forEach(id => {
      const block = this.findBlock(id);
      if (!block) return;
      const text = ((block.meta.title || '') + ' ' + (block.body || '')).toLowerCase();
      for (const [term, keywords] of Object.entries(CLOUD_TERMS)) {
        if (keywords.some(kw => text.includes(kw))) termCounts[term] = (termCounts[term] || 0) + 1;
      }
    });
    const cloudEntries = Object.entries(termCounts).sort((a, b) => b[1] - a[1]);
    if (cloudEntries.length > 0) {
      h += '<div class="profile-section"><h3>Your Knowledge</h3>';
      h += '<div class="knowledge-cloud">';
      const maxCount = Math.max(cloudEntries[0][1], 1);
      cloudEntries.forEach(([term, count]) => {
        const weight = count / maxCount;
        const size = 0.6 + weight * 0.55;
        const opacity = 0.35 + weight * 0.65;
        h += `<span class="cloud-word" style="font-size:${size}rem;opacity:${opacity}">${term}</span>`;
      });
      h += '</div></div>';
    }

    // Editor track — readers earn editorship through accepted contributions:
    // reported issues, shared tellings, and tellings adopted into the book.
    const et = this.getEditorTrack();
    const etBar = (label, cur, goal) => `<div class="dna-row"><span class="dna-label">${label}</span>
      <div class="dna-bar"><div class="dna-fill" style="width:${Math.min(100, Math.round(cur / goal * 100))}%"></div></div>
      <span class="dna-val">${cur}/${goal}</span></div>`;
    h += `<div class="profile-section"><h3>🛠 Editor track</h3>
      <div style="font-size:.8rem;margin-bottom:.4em">${
        et.tier === 'editor'
          ? `<span class="editor-badge">🛠 EDITOR</span> ${et.invited ? 'Invited to the editorial team — welcome.' : "You've earned editorship — your contributions shape the book."} <a href="admin.html" style="color:var(--accent)">Open the editor console</a> · <a href="HUMANS.md" style="color:var(--accent)">duties</a>`
          : et.tier === 'contributor'
            ? `<b>Contributor.</b> Keep going — editorship is earned, not appointed:`
            : `<b>Reader.</b> Editorship is earned, not appointed — report issues, share tellings:`}</div>
      ${etBar('🚩 issues reported', et.flags, 5)}
      ${etBar('⚡ tellings shared', et.shared, 5)}
      ${etBar('📖 adopted into book', et.adopted, 1)}
      <p style="font-size:.68rem;color:var(--text-3);margin-top:.3em">${et.invited ? 'You were invited as an editor — the bars show your own contributions on top.' : 'Promotion: <b>1 telling adopted</b> into the book (editors reviewed and merged it) — or <b>5 shared + 5 reported</b>. Adoption is detected automatically when your shared telling appears in the book.'}</p>
      ${et.adopted >= 1 ? `<button class="steer-chip" style="border-color:var(--accent);color:var(--accent)" onclick="app.shareThing('My telling made it into the book', 'My explanation was adopted into the living book “How Recommendations Work” 📖', location.origin + '/#' + (Object.values(app.privateBlocks).find(b => (b.meta.sharedAt || b.meta.state === 'community') && app.findBlock(b.meta.id))?.meta.id || ''))">📣 Brag about your adoption</button>` : ''}
    </div>

    <div class="profile-section"><h3>📣 Invite friends</h3>
      <p style="font-size:.78rem;color:var(--text-2)">The book gets better with more readers — every vote, steer and wish shapes what gets written. Invited friends start with <b>+25 XP</b>.</p>
      <div style="display:flex;gap:.4em;flex-wrap:wrap;align-items:center">
        <code style="font-size:.7rem;user-select:all;padding:.25em .5em;border:1px solid var(--border);border-radius:6px" id="inviteLink">${location.origin + '/?invite=R-' + (this.rc.userId || 'me').replace(/[^\w-]/g, '').slice(0, 8)}</code>
        <button class="steer-chip" onclick="navigator.clipboard.writeText(document.getElementById('inviteLink').textContent).then(()=>app.showXPToast('🔗 Invite link copied','achievement'))">copy</button>
        <button class="steer-chip" style="border-color:var(--accent);color:var(--accent)" onclick="app.shareThing('How Recommendations Work','I\'m reading a living book that explains how recommender systems work — and adapts to you. Join me:', document.getElementById('inviteLink').textContent)">share</button>
      </div>
    </div>`;

    // Tiered certificate (spec: Foundations / Practitioner / Guru) — certifies demonstrated
    // understanding by depth level, missions and recall — computed from verified core only
    const { tiers, achievedIdx } = this.getCertTiers();
    h += '<div class="profile-section"><h3>Certificate</h3>';
    if (achievedIdx >= 0) {
      const t = tiers[achievedIdx];
      const savedName = localStorage.getItem('pbook-cert-name') || '';
      h += `<div class="cert-ready">
        <p style="font-size:.85rem;margin-bottom:.6em">${t.icon} You've earned the <strong>${t.title}</strong> certificate — ${t.subtitle}.</p>
        <button class="cert-btn" onclick="app.showCertificateModal()">Get Your ${t.title} Certificate</button>
        ${savedName ? `<p style="font-size:.75rem;color:var(--text-3);margin-top:.4em">Certificate issued to: ${this.escHtml(savedName)}</p>` : ''}
      </div>`;
    }
    // Tier ladder with live requirements — always show the path ahead
    h += '<div style="display:flex;flex-direction:column;gap:.5em;margin-top:.6em">';
    tiers.forEach((t, i) => {
      const achieved = i <= achievedIdx;
      const isNext = i === achievedIdx + 1;
      h += `<div style="border:1.5px solid ${achieved ? t.color : 'var(--border)'};border-radius:10px;padding:.5em .7em;opacity:${achieved || isNext ? 1 : 0.55}">
        <div style="font-size:.82rem;font-weight:700;color:${achieved ? t.color : 'var(--text-2)'}">${t.icon} ${t.title} ${achieved ? '✓' : ''}<span style="font-weight:400;color:var(--text-3);font-size:.72rem"> — ${t.subtitle}</span></div>
        ${!achieved ? `<div style="font-size:.72rem;color:var(--text-3);margin-top:.25em">${t.reqs.map(r => `${r.done ? '☑' : '☐'} ${r.label}`).join(' &middot; ')}</div>` : ''}
      </div>`;
    });
    h += '</div></div>';
    } // end gamification guard

    // Settings link
    h += '<div class="profile-section" style="text-align:center">';
    h += '<button class="btn-ghost" style="border:1px solid var(--border);border-radius:6px;padding:.4em 1em;font-size:.78rem;color:var(--text-2)" onclick="app.toggleSettings()">&#9881; Settings &amp; data</button>';
    h += '</div>';

    h += `<div style=\"text-align:center;font-size:.62rem;color:var(--text-3);margin:.8em 0\">p-book ${APP_VERSION}</div>`;
    el.innerHTML = h;
  }

  // ===== ACCOUNT & SYNC =====
  _syncUserToRecombee() {
    if (!this.rc.enabled) return;
    const u = this.user;
    const prog = u.getProgress(this.allBlocks);
    this.rc.setUserProperties({
      voice: u.preferredVoice || u.getTopVoice(),
      level: u.level,
      xp: u.xp,
      readCount: prog.read,
      totalBlocks: prog.total,
      completedMissions: (u.completedMissions || []).length,
      activePath: u.activePath || '',
    });
  }

  _refreshAfterAuth() {
    // Reload user model from (merged) localStorage and refresh all views
    this.user.load();
    this.updateXPBadge();
    this.renderProfile();
    // If user was on home, re-render to pick up new recs
    if (this.currentView === 'home') this.renderHome();
  }

  _authEndpoint() {
    // Detect Netlify vs Vercel
    if (location.hostname.includes('netlify')) return '/.netlify/functions/auth';
    if (true) return '/api/auth';
    return '/api/auth';
  }

  _getAuth() {
    try {
      const s = localStorage.getItem('pbook-auth');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }

  _setAuth(auth) {
    if (auth) localStorage.setItem('pbook-auth', JSON.stringify(auth));
    else localStorage.removeItem('pbook-auth');
  }

  async _authRequest(body) {
    const res = await fetch(this._authEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  _collectProfileData() {
    // Gather all localStorage keys that should sync
    const data = {};
    const keys = ['pbook-user', 'pbook-notes', 'pbook-highlights', 'pbook-interactions',
                  'pbook-uid', 'pbook-tour-done', 'pbook-cert-name', 'pbook-cert-email',
                  'pbook-content-statuses', 'pbook-flags'];
    keys.forEach(k => {
      const v = localStorage.getItem(k);
      if (v) data[k] = v;
    });
    // Feature toggles
    ['sGamification', 'sPersonalization', 'sSpaceRepetition', 'sMissions', 'sGames', 'sHighlights'].forEach(k => {
      const v = localStorage.getItem(k);
      if (v !== null) data[k] = v;
    });
    return data;
  }

  _restoreProfileData(data) {
    if (!data || typeof data !== 'object') return;
    Object.entries(data).forEach(([k, v]) => {
      if (v !== null && v !== undefined) localStorage.setItem(k, v);
    });
    // Reload user model from restored localStorage
    this.user.load();
  }

  async register() {
    const name = document.getElementById('authName')?.value?.trim();
    const email = document.getElementById('authEmail')?.value?.trim();
    const password = document.getElementById('authPassword')?.value;
    const errEl = document.getElementById('authError');

    if (!email || !password) { errEl.textContent = 'Email and password are required.'; return; }
    if (password.length < 4) { errEl.textContent = 'Password must be at least 4 characters.'; return; }
    errEl.textContent = 'Creating account...';

    const result = await this._authRequest({
      action: 'register', email, password,
      displayName: name || undefined,
      profileData: this._collectProfileData(),
    });

    if (result.error) { errEl.textContent = result.error; return; }

    this._setAuth({ email, token: result.token, displayName: result.displayName || name });
    if (name) localStorage.setItem('pbook-cert-name', name);

    // Switch Recombee identity: merge anonymous → account user
    const accountUid = 'acct-' + email.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
    await this.rc.switchUser(accountUid);
    // Re-sync user properties to Recombee under new identity
    this._syncUserToRecombee();

    this._lastSyncTime = Date.now();
    this.showXPToast('Account created! Your progress is now synced.', 'info');
    this._refreshAfterAuth();
  }

  async login() {
    const email = document.getElementById('authEmail')?.value?.trim();
    const password = document.getElementById('authPassword')?.value;
    const errEl = document.getElementById('authError');

    if (!email || !password) { errEl.textContent = 'Email and password are required.'; return; }
    errEl.textContent = 'Logging in...';

    const result = await this._authRequest({ action: 'login', email, password });
    if (result.error) { errEl.textContent = result.error; return; }

    this._setAuth({ email, token: result.token, displayName: result.displayName });

    // Merge cloud profile with local — cloud wins for reading progress (union of sets)
    if (result.profileData && Object.keys(result.profileData).length > 0) {
      const cloudData = result.profileData;
      // Merge user model: take union of read/seen/saved blocks
      try {
        const localUser = JSON.parse(localStorage.getItem('pbook-user') || '{}');
        const cloudUser = JSON.parse(cloudData['pbook-user'] || '{}');
        if (cloudUser.readBlocks) {
          const merged = new Set([...(localUser.readBlocks || []), ...cloudUser.readBlocks]);
          cloudUser.readBlocks = [...merged];
        }
        if (cloudUser.seenBlocks) {
          const merged = new Set([...(localUser.seenBlocks || []), ...cloudUser.seenBlocks]);
          cloudUser.seenBlocks = [...merged];
        }
        if (cloudUser.savedBlocks) {
          const merged = new Set([...(localUser.savedBlocks || []), ...cloudUser.savedBlocks]);
          cloudUser.savedBlocks = [...merged];
        }
        // Keep higher XP
        cloudUser.xp = Math.max(cloudUser.xp || 0, localUser.xp || 0);
        cloudUser.level = Math.max(cloudUser.level || 1, localUser.level || 1);
        // Merge achievements (union by id)
        const achMap = new Map();
        (localUser.achievements || []).forEach(a => achMap.set(a.id, a));
        (cloudUser.achievements || []).forEach(a => achMap.set(a.id, a));
        cloudUser.achievements = [...achMap.values()];
        cloudData['pbook-user'] = JSON.stringify(cloudUser);
      } catch(e) {}
      // Merge notes (union by blockId, cloud notes added to local)
      try {
        const localNotes = JSON.parse(localStorage.getItem('pbook-notes') || '{}');
        const cloudNotes = JSON.parse(cloudData['pbook-notes'] || '{}');
        for (const [blockId, val] of Object.entries(cloudNotes)) {
          if (!localNotes[blockId]) localNotes[blockId] = val;
          else if (Array.isArray(val) && Array.isArray(localNotes[blockId])) {
            // Merge by timestamp dedup
            const existing = new Set(localNotes[blockId].map(n => n.ts));
            val.forEach(n => { if (!existing.has(n.ts)) localNotes[blockId].push(n); });
          }
        }
        cloudData['pbook-notes'] = JSON.stringify(localNotes);
      } catch(e) {}

      this._restoreProfileData(cloudData);
    }

    // Switch Recombee identity: merge anonymous → account user
    const accountUid = 'acct-' + email.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
    await this.rc.switchUser(accountUid);
    this._syncUserToRecombee();

    this._lastSyncTime = Date.now();
    this.showXPToast(`Welcome back, ${result.displayName || 'reader'}!`, 'info');
    this._refreshAfterAuth();
  }

  async syncProfile() {
    const auth = this._getAuth();
    if (!auth) return;
    const btn = document.getElementById('syncBtn');
    if (btn) btn.textContent = navigator.onLine ? 'Syncing...' : 'Queued';

    if (!navigator.onLine) {
      // Queue for when online
      this.rc._queueOffline({ type: 'log', data: { type: 'profile_sync', userId: auth.email, data: this._collectProfileData() } });
      if (btn) setTimeout(() => { if (btn) btn.textContent = 'Sync'; }, 1500);
      return;
    }

    const result = await this._authRequest({
      action: 'save',
      email: auth.email,
      token: auth.token,
      profileData: this._collectProfileData(),
    });

    if (result.error) {
      this.showXPToast(result.error, 'info');
      if (btn) btn.textContent = 'Sync';
      return;
    }
    this._lastSyncTime = Date.now();
    if (btn) { btn.textContent = 'Synced!'; setTimeout(() => { if (btn) btn.textContent = 'Sync now'; }, 2000); }
  }

  logout() {
    this._setAuth(null);
    this._lastSyncTime = null;
    this.renderProfile();
  }

  // ===== LINEAR DFS NAVIGATION =====
  // linearNav, DFS order removed — navigation is now per-block

  // ===== CHAT (full view) =====
  initChatView() {
    const input = document.getElementById('chatInputFull');
    if (input) input.focus();
  }

  sendFullChat() {
    const input = document.getElementById('chatInputFull');
    const msg = input?.value?.trim();
    if (!msg) return;
    input.value = '';
    // Remove suggestion buttons if present
    document.querySelector('.tutor-suggestions')?.remove();
    const messages = document.getElementById('chatMessagesFull');
    if (!messages) return;
    messages.innerHTML += `<div class="chat-msg user">${this.escHtml(msg)}</div>`;
    // Show typing indicator
    const typing = document.getElementById('tutorTyping');
    if (typing) typing.style.display = 'flex';
    messages.scrollTop = messages.scrollHeight;
    // Simulate thinking delay
    setTimeout(() => {
      if (typing) typing.style.display = 'none';
      const response = this.generateChatResponse(msg);
      messages.innerHTML += `<div class="chat-msg bot">${response}</div>`;
      messages.scrollTop = messages.scrollHeight;
    }, 600 + Math.random() * 400);
  }

  // ===== GLOSSARY / TOPICS =====
  // ===== MISSIONS =====
  getMissions() {
    return [
      {
        id: 'youtube', title: 'How Do Platforms Know?', icon: '\u{1F3AC}',
        difficulty: 'Beginner',
        story: 'A colleague asks: "How does YouTube always know what I want to watch?" Can you explain the mechanisms behind recommendation systems?',
        goal: 'Explain how recommendation algorithms work',
        reward: { title: 'Algorithm Explainer', xp: 20 },
        core: ['ch1-noticed', 'ch1-everywhere', 'ch1-not-magic', 'ch1-three-jobs', 'ch2-footprints', 'ch2-clues'],
        intros: [
          "Let's start with something familiar. Have you noticed that platforms seem to anticipate your interests?",
          "Recommendations aren't limited to YouTube. Let's map the recommendation landscape across platforms.",
          "How does it actually work? It's not intuition — it's statistical pattern recognition at scale.",
          "Every recommender serves three core functions. Consider what they might be before reading.",
          "Now let's examine the user side. What behavioral signals are you generating?",
          "These signals come in different types. Understanding the taxonomy is key to understanding the system."
        ],
        boss: { q: 'A colleague asks: "So how DO platforms know what I want to see?" Explain the mechanism in one paragraph, covering both the data side and the algorithmic side.', hints: ['patterns', 'behavioral signals', 'data', 'collaborative filtering', 'content-based'] },
        branches: {
          explorer: { label: 'See it in action', blocks: ['ch2-track-d-exp', 'ch1-ws-match', 'ch1-history'] },
          creator: { label: 'Try it yourself', blocks: ['ch2-privacy-d-create'] },
          thinker: { label: 'Understand patterns', blocks: ['ch1-patterns-d-think', 'ch1-personalization-spectrum'] }
        }
      },
      {
        id: 'detective', title: 'The Data Detective', icon: '\u{1F575}',
        difficulty: 'Beginner',
        story: 'Your recommendations are corrupted — irrelevant content keeps appearing because a shared account or a gift search polluted your profile. Time to investigate what data the algorithm actually uses.',
        goal: 'Understand what data platforms collect and how signals work',
        reward: { title: 'Data Detective', xp: 20 },
        core: ['ch2-footprints', 'ch2-clues', 'ch2-guess-signal', 'ch2-myth', 'ch2-privacy'],
        intros: [
          "To fix poor recommendations, first understand what behavioral data you're generating.",
          "Not all signals are equal. Some are strong indicators, others are noise.",
          "Can you distinguish a strong signal from a weak one? This is what separates effective analysis from guesswork.",
          "Before we go further, let's debunk some myths. Is your phone really listening to conversations?",
          "Now the fundamental question: whose data is it, and what are your rights under GDPR/CCPA?"
        ],
        boss: { q: 'You notice irrelevant recommendations in your feed — content from a shared account or a one-time search has polluted your profile. Explain why this happened and what steps you would take to fix it.', hints: ['profile pollution', 'signals', 'history', 'preference model', 'negative signals'] },
        branches: {
          explorer: { label: 'Investigate your data', blocks: ['ch2-track-d-exp', 'ch2-ws-detective', 'ch2-negative-signals'] },
          creator: { label: 'Run an experiment', blocks: ['ch2-privacy-d-create'] },
          thinker: { label: 'Analyze signals deeply', blocks: ['ch2-implicit-feedback', 'ch2-user-lifecycle'] }
        }
      },
      {
        id: 'builder', title: 'Build a Recommender', icon: '\u{1F527}',
        difficulty: 'Intermediate',
        story: 'Your team needs a content recommendation system. You volunteer to prototype one from scratch. Can you build a working collaborative filtering implementation?',
        goal: 'Build a working recommendation system step by step',
        reward: { title: 'Recommendation Engineer', xp: 30 },
        core: ['ch5-start', 'ch5-collect', 'ch3-friends', 'ch5-similar', 'ch5-recommend', 'ch5-improve'],
        intros: [
          "You committed to building a recommender prototype. Here's what you'll need.",
          "Step 1: every recommender needs data. Time to collect preference signals.",
          "The key technique is finding users with similar preferences — collaborative filtering.",
          "Now you need a quantitative measure of similarity between users. This is where the math begins.",
          "You have the data and similarity scores. Now generate actual predictions.",
          "Your system works but could be better. Let's systematically improve it."
        ],
        boss: { q: 'A stakeholder complains: "Your recommender suggested something completely irrelevant!" Diagnose what likely went wrong and propose three specific improvements.', hints: ['similarity', 'data sparsity', 'diversity', 'cold start', 'evaluation'] },
        branches: {
          creator: { label: 'Build it for real', blocks: ['ch5-spread-d-create', 'ch5-code-d-create', 'ch5-debug'] },
          thinker: { label: 'Understand the math', blocks: ['ch5-math-d-think', 'ch5-formulas'] },
          explorer: { label: 'See CF in action', blocks: ['ch3-cf-d-exp', 'ch3-cf-limitations'] }
        }
      },
      {
        id: 'algorithms', title: 'The Algorithm Zoo', icon: '\u{1F9EC}',
        difficulty: 'Intermediate',
        story: 'Collaborative filtering, content-based, bandits, graph networks, transformers, LLMs — the recommendation landscape is vast. Can you navigate it and understand when to use what?',
        goal: 'Understand the major algorithm families and their trade-offs',
        reward: { title: 'Algorithm Navigator', xp: 30 },
        core: ['ch3-friends', 'ch3-content', 'ch3-bandits', 'ch3-deep-similarity', 'ch3-graph-methods', 'ch3-session-based', 'ch3-llm-recs'],
        intros: [
          "The oldest trick in recommendations: find people like you and suggest what they liked.",
          "A completely different approach: ignore users, analyze the items themselves.",
          "How much should you exploit what works vs. explore the unknown? Bandits solve this dilemma.",
          "Modern systems represent everything as vectors in high-dimensional space. Here's why that works.",
          "Users and items form a graph. Graph neural networks exploit this network structure directly.",
          "When you don't know the user, you must work with just the current session. Session-based methods handle this.",
          "LLMs are reshaping the interface. Can they replace traditional methods, or do they complement them?"
        ],
        boss: { q: 'You are architecting a recommendation system for a new platform with 10M items. Describe which algorithm family you would use for each pipeline stage (retrieval, scoring, re-ranking) and justify your choices.', hints: ['two-tower', 'collaborative filtering', 'content-based', 'bandits', 'diversity', 'LTR', 'cold start'] },
        branches: {
          thinker: { label: 'Deep math', blocks: ['ch3-matrix-factorization', 'ch3-attention', 'ch3-feature-interactions'] },
          explorer: { label: 'See architectures', blocks: ['ch3-two-tower', 'ch3-hybrid-patterns', 'ch3-multimodal'] },
          creator: { label: 'Choose your tools', blocks: ['ch5-model-selection', 'ch5-open-source'] }
        }
      },
      {
        id: 'bubble', title: 'Pop the Bubble', icon: '\u{1FAE7}',
        difficulty: 'Intermediate',
        story: 'You notice your news feed shows only one perspective. A colleague sees entirely different content. Are algorithmic filter bubbles shaping your information diet?',
        goal: 'Understand filter bubbles, fairness, bias, and how to measure quality',
        reward: { title: 'Bubble Analyst', xp: 25 },
        core: ['ch4-bubbles', 'ch4-fairness', 'ch4-long-tail', 'ch4-satisfaction', 'ch4-testing'],
        intros: [
          "Something seems off. Your feed converges to a narrow content type. A colleague sees entirely different things. Why?",
          "Bubbles are one concern. But is the system fair to all content creators and users?",
          "The long tail: 80% of items never get recommended. Is popularity-based selection inevitable?",
          "Engagement and satisfaction are not the same thing. What should we actually optimize for?",
          "How do organizations evaluate whether their recommendations are working? Rigorous experimentation."
        ],
        boss: { q: 'You are designing a recommendation system for a news platform. How would you balance personalization with information diversity while ensuring both user satisfaction and creator fairness? Discuss specific approaches.', hints: ['diversity', 'MMR', 'long tail', 'satisfaction', 'exploration', 'fairness metrics'] },
        branches: {
          thinker: { label: 'Bias & metrics', blocks: ['ch4-bias-types', 'ch4-diversity-metrics', 'ch4-polarization'] },
          creator: { label: 'Run experiments', blocks: ['ch4-experiment', 'ch4-interleaving'] },
          explorer: { label: 'Design A/B tests', blocks: ['ch4-ab-d-exp', 'ch4-online-offline'] }
        }
      },
      {
        id: 'control', title: 'Take Back Control', icon: '\u{1F6E1}',
        difficulty: 'Advanced',
        story: 'Platforms know more about your preferences than you do. They use persuasive design, dark patterns, and behavioral inference to maximize engagement. Understanding these mechanisms is essential.',
        goal: 'Digital literacy — understand privacy, persuasive design, the attention economy, and your rights',
        reward: { title: 'Informed Digital Citizen', xp: 25 },
        core: ['ch6-who-decides', 'ch6-addictive', 'ch6-privacy-real', 'ch6-ai-future', 'ch6-attention-economy'],
        intros: [
          "When you open a platform, who decided what appears on your screen? The answer reveals the incentive structure.",
          "Infinite scroll. Autoplay. Variable rewards. These are deliberate persuasive design patterns.",
          "Let's get specific: what do platforms actually know about you, and how did they learn it?",
          "You've examined the challenges. Now let's discuss AI's role in the future of recommendations.",
          "The attention economy frames all of this: your attention is the product being sold."
        ],
        boss: { q: 'Describe the attention economy model, explain 3 specific persuasive design patterns platforms use, and recommend concrete countermeasures for each. Reference relevant regulations.', hints: ['attention economy', 'dark patterns', 'variable rewards', 'GDPR', 'DSA', 'privacy audit'] },
        branches: {
          explorer: { label: 'Audit your data', blocks: ['ch6-data-d-exp', 'ch6-dark-patterns'] },
          creator: { label: 'Reclaim control', blocks: ['ch6-control-d-create', 'ch6-ethics-checklist'] },
          thinker: { label: 'Deeper analysis', blocks: ['ch6-hard-d-think', 'ch6-law-sidebar', 'ch6-privacy-preserving'] }
        }
      },
      {
        id: 'creator-boost', title: 'Get Your Content Recommended', icon: '\u{1F4F1}',
        difficulty: 'Intermediate',
        story: "You've published content — an article, video, podcast, or product. But the algorithm doesn't surface it. Can you learn how recommendation and discovery systems work from the creator's perspective?",
        goal: 'Understand discoverability, the pipeline, and the creator-algorithm relationship',
        reward: { title: 'Algorithm Whisperer', xp: 30 },
        core: ['ch5-get-recommended', 'ch5-seo-algorithms', 'ch3-pipeline', 'ch3-search-recs', 'ch3-popular'],
        intros: [
          "You understand how algorithms select content for users. Now flip the perspective — how do you make them select yours?",
          "Search and recommendations are converging. Understanding discoverability is essential for content strategy.",
          "To work with the system, you need to understand the system. How does the recommendation pipeline operate?",
          "Search results are personalized. How do you surface for the right audience segments?",
          "Every creator starts in the cold-start zone. How do you escape the popularity trap?"
        ],
        boss: { q: "You've published a technical tutorial. Describe 5 specific strategies to maximize algorithmic discovery. Then discuss: where is the ethical line between optimization and manipulation?", hints: ['metadata', 'engagement signals', 'first impressions', 'consistency', 'cold start', 'creator economy'] },
        branches: {
          explorer: { label: 'Study the pipeline', blocks: ['ch3-pipeline-d-exp', 'ch3-search-recs-convergence'] },
          creator: { label: 'Build & optimize', blocks: ['ch5-spread-d-create', 'ch5-case-studies'] },
          thinker: { label: 'Creator economy ethics', blocks: ['ch6-creator-economy', 'ch4-objectives'] }
        }
      },
      {
        id: 'production', title: 'Ship It: Production RecSys', icon: '\u{1F680}',
        difficulty: 'Advanced',
        story: 'Your algorithm works in a notebook. Now deploy it to serve 10,000 requests per second with p99 latency under 200ms. Welcome to production recommendation engineering.',
        goal: 'Understand the full production stack — from feature stores to monitoring to incident response',
        reward: { title: 'Production Engineer', xp: 35 },
        core: ['ch5-tech-stack', 'ch5-model-selection', 'ch5-monitoring', 'ch5-caching', 'ch5-scale'],
        intros: [
          "A production RecSys is 10% algorithm, 90% infrastructure. Let's examine the full stack.",
          "With so many algorithms available, choosing the right one for your problem is the first critical decision.",
          "Your system is live. How do you know it's working? Monitoring and observability are your lifeline.",
          "Latency is tight. Caching helps — but introduces freshness trade-offs.",
          "The architecture that works for 10K items is wrong for 100M items. Scale changes everything."
        ],
        boss: { q: 'Design a production recommendation system for a platform with 50M items and 10M daily active users. Describe the architecture, the latency budget per component, and the monitoring strategy.', hints: ['two-tower', 'ANN index', 'feature store', 'caching', 'candidate generation', 're-ranking', 'monitoring', 'latency'] },
        branches: {
          explorer: { label: 'Production ops', blocks: ['ch5-observability', 'ch5-realtime', 'ch5-continual-learning'] },
          creator: { label: 'Build the stack', blocks: ['ch5-open-source', 'ch5-feature-eng'] },
          thinker: { label: 'Production math', blocks: ['ch5-ab-pitfalls', 'ch5-anti-patterns'] }
        }
      },
      {
        id: 'ethics-deep', title: 'The Responsible Recommender', icon: '\u{2696}',
        difficulty: 'Advanced',
        story: 'Recommendation algorithms shape what billions of people see, read, and buy. With that power comes responsibility. Can you navigate the ethical landscape?',
        goal: 'Understand algorithmic accountability, fairness definitions, content safety, and global regulatory context',
        reward: { title: 'Responsible Technologist', xp: 30 },
        core: ['ch4-bias-types', 'ch4-multi-objective', 'ch6-content-safety', 'ch4-accountability', 'ch6-ethics-checklist', 'ch6-global'],
        intros: [
          "Bias in recommender systems isn't a single problem — it's a taxonomy. Selection bias, position bias, popularity bias, and more.",
          "When goals conflict — engagement vs. diversity vs. fairness vs. revenue — how do you decide? Multi-objective optimization provides a framework.",
          "Algorithms can amplify harmful content. Content safety is a design requirement, not an afterthought.",
          "When recommendations fail, who is responsible? Algorithmic accountability is both a legal and organizational challenge.",
          "Before launch, run through this checklist: user impact, fairness, privacy, safety, transparency, accountability.",
          "Recommendations work differently across cultures. What's effective in the US may fail in Japan."
        ],
        boss: { q: 'A news platform asks you to audit their recommendation system for bias and fairness. Describe your methodology: what would you measure, what frameworks would you apply, and what regulatory requirements must be met?', hints: ['bias types', 'fairness definitions', 'DSA', 'GDPR', 'content safety', 'Pareto', 'auditing'] },
        branches: {
          thinker: { label: 'Formal frameworks', blocks: ['ch4-diversity-metrics', 'ch4-counterfactual', 'ch4-reward-design'] },
          explorer: { label: 'Real-world context', blocks: ['ch6-creator-economy', 'ch6-dark-patterns', 'ch4-polarization'] },
          creator: { label: 'Apply in practice', blocks: ['ch6-privacy-preserving', 'ch4-explanation-ux'] }
        }
      },
      {
        id: 'research', title: 'The Research Journey', icon: '\u{1F52C}',
        difficulty: 'Advanced',
        story: 'Behind every recommendation is decades of mathematical research. Trace the journey from elegant formulas to production systems serving billions of users.',
        goal: 'Understand how mathematical research drives recommender system evolution',
        reward: { title: 'Research Explorer', xp: 35 },
        core: ['ch7-why-research', 'ch7-simple-to-scalable', 'ch7-vasp-combining', 'ch7-bandits', 'ch7-cold-start-language', 'ch7-evaluation', 'ch7-production-scale', 'ch7-roadmap'],
        intros: [
          "Every recommendation you see is the product of mathematical research. Let's trace how theory becomes practice.",
          "EASE: a single matrix inverse that outperforms deep learning. Elegant but unscalable. Enter ELSA.",
          "Linear models find smooth patterns. Deep models find complex ones. VASP combines them with a clever trick.",
          "Should you exploit what you know or explore the unknown? Bandit algorithms formalize this dilemma.",
          "New items have zero interactions. beeFormer bridges the gap by teaching algorithms to read.",
          "The biggest risk isn't a bad algorithm — it's measuring the wrong thing. The evaluation problem.",
          "Research must survive the harsh reality of production: latency, memory, and billions of daily interactions.",
          "The frontier: fairness guarantees, LLM integration, causal evaluation, and privacy-preserving personalization."
        ],
        boss: { q: 'Trace the research evolution from EASE to ELSA to beeFormer. For each step, explain what problem the new approach solved and what mathematical insight enabled the breakthrough.', hints: ['matrix inverse', 'low-rank', 'Eckart-Young', 'cold start', 'ELSA loss', 'Transformer'] },
        branches: {
          thinker: { label: 'Full derivations', blocks: ['ch7-ease-math', 'ch7-thompson-math', 'ch7-eval-math', 'ch7-regularization'] },
          explorer: { label: 'Production & tools', blocks: ['ch7-sparse-reps', 'ch7-realm', 'ch7-repsys'] },
          creator: { label: 'Build with code', blocks: ['ch5-code-d-create', 'ch5-open-source'] }
        }
      },
      {
        id: 'deep-tech', title: 'The Deep Tech Dive', icon: '\u{1F9E0}',
        difficulty: 'Advanced',
        story: 'You want the full mathematical picture — derivations, proofs, complexity analysis. This mission takes you through the hardest technical content in the book.',
        goal: 'Master the mathematical foundations: matrix factorization, attention, bandits, evaluation theory',
        reward: { title: 'RecSys Theorist', xp: 40 },
        core: ['ch3-matrix-factorization', 'ch3-als-deep', 'ch3-attention-deep', 'ch7-ease-math', 'ch7-thompson-math', 'ch7-eval-math'],
        intros: [
          "Matrix factorization decomposes user-item interactions into latent factor spaces. Here's the full formulation.",
          "ALS solves the factorization problem via alternating ridge regressions. Every step has a closed-form solution.",
          "Self-attention computes context-dependent importance weights. The scaling, the multi-head trick, the causal mask — all derived.",
          "EASE's beauty: one matrix inverse, one diagonal constraint, and the precision matrix interpretation.",
          "Thompson Sampling is Bayesian-optimal. Here's the proof, the regret bound, and the Lai-Robbins connection.",
          "The offline evaluation bias formalizes why good models can look bad. MNAR, IPS, and the LLOO+β correction."
        ],
        boss: { q: 'Derive the ALS update step from the matrix factorization objective. Then explain why EASE outperforms deep models despite being linear, using the bias-variance trade-off framework.', hints: ['ridge regression', 'closed-form', 'sparse data', 'variance', 'spectral shrinkage', 'nuclear norm'] },
        branches: {
          thinker: { label: 'More theory', blocks: ['ch7-causal-bandits', 'ch7-regularization', 'ch3-two-tower-math'] },
          explorer: { label: 'See in practice', blocks: ['ch7-vasp-ablation', 'ch7-distillation', 'ch7-transfer-learning'] },
          creator: { label: 'Implement it', blocks: ['ch5-code-d-create', 'ch5-feature-eng'] }
        }
      },
      {
        id: 'master', title: 'Recommendation Master', icon: '\u{1F451}',
        difficulty: 'Capstone',
        story: "You've studied the components. Now synthesize everything — algorithms, production, ethics, research. Can you design a complete, responsible recommendation system?",
        goal: 'Deep mastery — synthesize the full picture across all dimensions',
        reward: { title: 'Recommendation Master', xp: 50 },
        prerequisite: 3,
        core: ['ch3-pipeline', 'ch3-content', 'ch3-friends', 'ch4-testing', 'ch5-improve', 'ch6-ai-future', 'ch7-roadmap'],
        intros: [
          "Welcome to the capstone. Production systems combine everything into a multi-stage pipeline.",
          "One approach: analyze the item itself — its features, embeddings, and metadata.",
          "Another approach: analyze user behavior — find preference similarities via collaborative filtering.",
          "How do you validate that the system works? Rigorous experimentation and evaluation.",
          "A working system isn't a finished system. Continuous improvement is the norm.",
          "The future: LLMs, multimodal understanding, and the open research frontier.",
          "What does responsible, effective recommendation look like? This is where it all comes together."
        ],
        boss: { q: 'Design a complete recommendation system for a new content platform. Cover: algorithm selection per pipeline stage, cold-start strategy, evaluation methodology, fairness safeguards, and production architecture. Justify each decision.', hints: ['pipeline', 'collaborative filtering', 'content-based', 'cold start', 'beeFormer', 'A/B testing', 'fairness', 'monitoring', 'diversity'] },
        branches: {
          explorer: { label: 'Case studies', blocks: ['ch5-case-studies', 'ch5-ecommerce', 'ch5-news-recs'] },
          creator: { label: 'Full production', blocks: ['ch5-tech-stack', 'ch5-flywheel', 'ch5-continual-learning'] },
          thinker: { label: 'Theory meets practice', blocks: ['ch7-emerging', 'ch4-counterfactual', 'ch4-multi-objective'] }
        }
      }
    ];
  }

  _getMissionBlocks(mission) {
    const branch = this.user.missionBranches?.[mission.id];
    const branchBlocks = branch && mission.branches[branch] ? mission.branches[branch].blocks : [];
    return [...mission.core, ...branchBlocks];
  }

  _getMissionProgress(mission) {
    const read = mission.core.filter(id => this.user.readBlocks.has(id)).length;
    return { read, total: mission.core.length, pct: Math.round((read / Math.max(mission.core.length, 1)) * 100) };
  }


  _isMissionLocked(mission) {
    if (!mission.prerequisite) return false;
    const completed = (this.user.completedMissions || []).length;
    return completed < mission.prerequisite;
  }

  // Personal mission: the reader says what they want to learn; the book composes
  // a mission from matching concepts (keyword match over contracts — works offline;
  // an LLM pass can re-rank later). Steps = concept anchors in book order.
  composePersonalMission(text) {
    const goal = (text || '').trim();
    if (goal.length < 6 || !this.concepts) return null;
    const stop = new Set(['what', 'how', 'the', 'and', 'for', 'with', 'about', 'learn', 'want', 'chci', 'jak', 'co', 'a', 'se', 'na', 'proc', 'why', 'does', 'know', 'more']);
    const tokens = goal.toLowerCase().split(/[^a-z0-9á-žà-ü-]+/i).filter(w => w.length > 3 && !stop.has(w));
    if (!tokens.length) return null;
    const chOrder = Object.fromEntries(this.book.chapters.map((c, i) => [c.id, i]));
    const scored = Object.values(this.concepts).map(c => {
      const head = `${c.id} ${c.title}`.toLowerCase();
      const body = [c.contract?.objective, c.contract?.recallQ,
        ...(c.contract?.mustCover || []).map(mc => mc.point)].join(' ').toLowerCase();
      // light stemming (trailing s) + id/title hits count triple
      const score = tokens.reduce((s, tok) => {
        const t2 = tok.replace(/s$/, '');
        if (head.includes(tok) || head.includes(t2)) return s + 3;
        if (body.includes(tok) || body.includes(t2)) return s + 1;
        return s;
      }, 0);
      return { c, score };
    }).filter(x => x.score >= 2)
      .sort((x, y) => y.score - x.score || (chOrder[x.c.chapter] ?? 99) - (chOrder[y.c.chapter] ?? 99))
      .slice(0, 6)
      .sort((x, y) => (chOrder[x.c.chapter] ?? 99) - (chOrder[y.c.chapter] ?? 99));
    if (scored.length < 2) return null;
    const mission = {
      goal: goal.slice(0, 120),
      ids: scored.map(x => x.c.anchor),
      concepts: scored.map(x => x.c.id),
      created: new Date().toISOString(),
    };
    this.user.personalMission = mission;
    this.user.save();
    this.rc.logEvent('personal_mission', { goal: mission.goal, concepts: mission.concepts });
    return mission;
  }

  _personalMissionCard() {
    const pm = this.user.personalMission;
    if (!pm) return '';
    const read = pm.ids.filter(id => this.user.readBlocks.has(id)).length;
    const done = read >= pm.ids.length;
    if (done && !pm.rewarded) {
      pm.rewarded = true; this.user.save();
      if (this._f('gamification')) { this.user.addXP(50); this.user.save(); this.updateXPBadge(); }
      setTimeout(() => this.showXPToast('🎯 Personal mission complete! +50 XP', 'achievement'), 800);
    }
    const steps = pm.ids.map(id => {
      const b = this.findBlock(id);
      const isRead = this.user.readBlocks.has(id);
      return `<div class="mission-step ${isRead ? 'step-done' : ''}" onclick="app.openBlock('${id}')" style="cursor:pointer">
        <span>${isRead ? '✅' : '○'}</span> <span>${this.escHtml(b?.meta?.title || id)}</span></div>`;
    }).join('');
    return `<div class="mission-card mission-active" style="border:2px solid var(--accent)">
      <div class="mission-icon">🎯</div>
      <div class="mission-info">
        <div class="mission-title-row"><span class="mission-title">Your mission: ${this.escHtml(pm.goal)}</span>
          <span class="mission-diff" style="background:var(--accent)">PERSONAL</span></div>
        <div style="font-size:.72rem;color:var(--text-3);margin:.2em 0">Composed from ${pm.ids.length} concepts matching your goal — read them all to complete. <a href="#" onclick="event.preventDefault();app.editPersonalMission()" style="color:var(--accent)">change goal</a></div>
        ${steps}
        <div style="font-size:.72rem;color:var(--text-2);margin-top:.3em">${read}/${pm.ids.length} read${done ? ' · complete 🎉' : ''}
          ${done ? `<button class="steer-chip" style="margin-left:.5em;border-color:var(--accent);color:var(--accent)" onclick="app.shareThing('Mission complete', 'I just finished my personal mission “${this.escHtml(pm.goal)}” in the living book How Recommendations Work 🎯', location.origin)">📣 share</button>` : ''}</div>
      </div>
    </div>`;
  }

  editPersonalMission() {
    const cur = this.user.personalMission?.goal || '';
    const text = window.prompt('🎯 What do you want to learn? The book will compose a mission from matching concepts.', cur);
    if (text === null) return;
    if (!text.trim()) { this.user.personalMission = null; this.user.save(); this.renderMissions(); return; }
    const m = this.composePersonalMission(text);
    if (!m) this.showXPToast('No matching concepts found — try different words', 'achievement');
    this.renderMissions();
  }

  renderMissions() {
    const el = document.getElementById('glossaryContent');
    const missions = this.getMissions();
    const completed = new Set(this.user.completedMissions || []);

    let html = '<div class="missions-inner">';
    html += '<div class="missions-head"><h2>Missions</h2><p>Choose your adventure. Each mission tells a story and teaches you something new.</p></div>';
    html += this._personalMissionCard() || `<div style="font-size:.75rem;color:var(--text-3);margin:.2em 0 .6em">🎯 <a href="#" onclick="event.preventDefault();app.editPersonalMission()" style="color:var(--accent)">Tell the book what you want to learn</a> — it will compose a personal mission from matching concepts.</div>`;

    missions.forEach(m => {
      const prog = this._getMissionProgress(m);
      const isComplete = completed.has(m.id);
      const isLocked = this._isMissionLocked(m);
      const isActive = prog.read > 0 && !isComplete;
      const diffColors = { Beginner: '#10B981', Intermediate: '#F59E0B', Advanced: '#EF4444', Capstone: '#8B5CF6' };

      html += `<div class="mission-card ${isComplete ? 'mission-complete' : ''} ${isLocked ? 'mission-locked' : ''} ${isActive ? 'mission-active' : ''}" onclick="${isLocked ? '' : `app.showMission('${m.id}')`}">
        <div class="mission-icon">${isLocked ? '\u{1F512}' : m.icon}</div>
        <div class="mission-info">
          <div class="mission-title-row">
            <span class="mission-title">${m.title}</span>
            <span class="mission-diff" style="background:${diffColors[m.difficulty]}">${m.difficulty}</span>
          </div>
          <div class="mission-story">${isLocked ? `Complete ${m.prerequisite} missions to unlock` : m.story.substring(0, 80) + '...'}</div>
          <div class="mission-progress-dots">
            ${m.core.map((id, i) => {
              const read = isComplete || this.user.readBlocks.has(id);
              return `<span class="mission-dot ${read ? 'done' : i === prog.read ? 'current' : ''}"></span>`;
            }).join('')}
          </div>
          <div class="mission-meta">
            <span class="mission-reward-preview">${m.reward.title} +${m.reward.xp}XP</span>
            ${isComplete ? '<span class="mission-complete-badge">\u2713 Complete</span>' : `<span>${prog.read}/${m.core.length}</span>`}
          </div>
        </div>
      </div>`;
    });

    html += '</div>';
    el.innerHTML = html;
  }

  showMission(missionId) {
    const missions = this.getMissions();
    const m = missions.find(x => x.id === missionId);
    if (!m) return;
    if (this.currentView !== 'glossary') this.switchView('glossary');

    const el = document.getElementById('glossaryContent');
    const prog = this._getMissionProgress(m);
    const isComplete = (this.user.completedMissions || []).includes(m.id);
    const branch = this.user.missionBranches?.[m.id];
    const allBlocks = this._getMissionBlocks(m);
    const coreComplete = m.core.every(id => this.user.readBlocks.has(id));

    let html = '<div class="missions-inner">';
    html += `<button class="btn-ghost" onclick="app.renderMissions()" style="margin-bottom:.5em">&larr; All missions</button>`;
    html += `<div class="mission-detail-header">
      <span class="mission-detail-icon">${m.icon}</span>
      <div>
        <h2 class="mission-detail-title">${m.title}</h2>
        <p class="mission-detail-goal">${m.goal}</p>
      </div>
      <button class="act-btn share-btn" onclick="app.shareMission('${m.id}')" title="Share this mission" style="margin-left:auto;font-size:1rem">&#128279;</button>
    </div>`;
    html += `<div class="mission-detail-story">${m.story}</div>`;

    // Start/Continue wizard button
    if (!isComplete) {
      const wizardLabel = prog.read === 0 ? 'Start mission' : 'Continue mission';
      html += `<div style="text-align:center;margin-bottom:1em"><button class="mission-complete-btn" onclick="app.startMissionWizard('${m.id}')">${wizardLabel} &rarr;</button></div>`;
    }

    // Progress overview — show core dots + optional branch dots
    const coreRead = m.core.filter(id => this.user.readBlocks.has(id)).length;
    html += `<div class="mission-detail-progress">
      <div class="mission-progress-dots" style="justify-content:center">
        ${m.core.map((id, i) => {
          const read = isComplete || this.user.readBlocks.has(id);
          return `<span class="mission-dot ${read ? 'done' : ''}" title="${this.findBlock(id)?.meta?.title || id}"></span>`;
        }).join('')}
        ${branch ? m.branches[branch].blocks.map(id => {
          const read = this.user.readBlocks.has(id);
          return `<span class="mission-dot branch-dot ${read ? 'done' : ''}" title="${this.findBlock(id)?.meta?.title || id}"></span>`;
        }).join('') : ''}
      </div>
      <div style="text-align:center;font-size:.75rem;color:var(--text-3);margin-top:.3em">${coreRead}/${m.core.length} core steps${branch ? ` + bonus ${m.branches[branch].blocks.filter(id => this.user.readBlocks.has(id)).length}/${m.branches[branch].blocks.length}` : ''}</div>
    </div>`;

    // Step list — core blocks
    html += '<div class="mission-steps">';
    html += '<div class="mission-steps-label">Your journey</div>';
    m.core.forEach((id, i) => {
      const block = this.findBlock(id);
      const isRead = this.user.readBlocks.has(id);
      const title = block?.meta?.title || id;
      const ch = block?.meta?._chapterNum || '?';
      html += `<div class="mission-step ${isRead ? 'step-done' : ''}" onclick="app.openBlock('${id}')">
        <div class="step-marker">${isRead ? '\u2713' : i + 1}</div>
        <div class="step-content">
          <div class="step-title">${title}</div>
          <div class="step-meta">Chapter ${ch} &middot; ${block?.meta?.readingTime || 3} min</div>
        </div>
      </div>`;
    });

    // Branch point
    if (!branch) {
      html += `<div class="mission-branch-point">
        <div class="branch-label">Choose your path</div>
        <div class="branch-desc">The story branches here. Pick your style — the book adapts to you!</div>
        <div class="branch-options">`;
      Object.entries(m.branches).forEach(([voice, b]) => {
        const vc = CONFIG.voices[voice] || {};
        html += `<button class="branch-option ${voice}" onclick="app.pickBranch('${m.id}','${voice}')">
          <span class="branch-icon">${vc.icon || ''}</span>
          <span class="branch-name">${vc.label || voice}</span>
          <span class="branch-desc-text">${b.label}</span>
          <span class="branch-count">+${b.blocks.length} sections</span>
        </button>`;
      });
      html += '</div></div>';
    } else {
      // Show chosen branch blocks
      const b = m.branches[branch];
      const vc = CONFIG.voices[branch] || {};
      html += `<div class="mission-branch-chosen">
        <div class="branch-label">${vc.icon || ''} ${vc.label || branch} path <button class="btn-ghost" style="font-size:.7rem" onclick="app.pickBranch('${m.id}',null)">change</button></div>
      </div>`;
      b.blocks.forEach((id, i) => {
        const block = this.findBlock(id);
        const isRead = this.user.readBlocks.has(id);
        const title = block?.meta?.title || id;
        html += `<div class="mission-step ${isRead ? 'step-done' : ''} step-branch" onclick="app.openBlock('${id}')">
          <div class="step-marker">${isRead ? '\u2713' : '\u2022'}</div>
          <div class="step-content">
            <div class="step-title">${title}</div>
            <div class="step-meta">${vc.label} path &middot; ${block?.meta?.readingTime || 3} min</div>
          </div>
        </div>`;
      });
    }

    html += '</div>';

    // Complete button or reward
    if (isComplete) {
      html += `<div class="mission-reward-earned">
        <div class="reward-icon">\u{1F3C6}</div>
        <div class="reward-text">Mission complete! You earned: <b>${m.reward.title}</b> +${m.reward.xp} XP</div>
      </div>`;
    } else if (coreComplete) {
      html += `<div class="mission-complete-action">
        <button class="mission-complete-btn" onclick="app._startBossQuiz('${m.id}')">Face the Final Boss &rarr;</button>
      </div>`;
    }

    html += '</div>';
    el.innerHTML = html;
  }

  pickBranch(missionId, voice) {
    if (!this.user.missionBranches) this.user.missionBranches = {};
    if (voice === null) { delete this.user.missionBranches[missionId]; }
    else { this.user.missionBranches[missionId] = voice; }
    this.user.save();
    this.showMission(missionId);
  }

  _startBossQuiz(missionId) {
    const missions = this.getMissions();
    const m = missions.find(x => x.id === missionId);
    if (!m) return;
    if (!m.boss) { this.completeMission(missionId); return; } // no boss → complete directly
    this._wizardMission = m;
    this._renderBossQuiz();
  }

  completeMission(missionId) {
    const missions = this.getMissions();
    const m = missions.find(x => x.id === missionId);
    if (!m) return;
    if (!this.user.completedMissions) this.user.completedMissions = [];
    if (this.user.completedMissions.includes(missionId)) return;

    this.user.completedMissions.push(missionId);
    if (!this.user.missionTitles) this.user.missionTitles = [];
    this.user.missionTitles.push(m.reward.title);
    this.user.addXP(m.reward.xp);
    this.user.checkAchievements();
    this.user.save();

    this.showXPToast(`\u{1F3C6} ${m.reward.title}! +${m.reward.xp} XP`, 'achievement');
    this.checkGamificationEvents();
    this.showMission(missionId);
  }

  // ===== MISSION WIZARD MODE =====
  startMissionWizard(missionId) {
    const missions = this.getMissions();
    const m = missions.find(x => x.id === missionId);
    if (!m) return;
    this._wizardMission = m;
    this._wizardStep = 0;
    // Find first unread core block
    const firstUnread = m.core.findIndex(id => !this.user.readBlocks.has(id));
    if (firstUnread >= 0) this._wizardStep = firstUnread;
    this._renderWizardStep();
  }

  _renderWizardStep() {
    const m = this._wizardMission;
    if (!m) return;
    const step = this._wizardStep;
    const blocks = m.core;

    // Past the last core block → show boss quiz
    if (step >= blocks.length) {
      this._renderBossQuiz();
      return;
    }

    const blockId = blocks[step];
    const block = this.findBlock(blockId);
    const intro = m.intros?.[step] || '';
    const isRead = this.user.readBlocks.has(blockId);

    // Render wizard overlay in the glossary view
    const el = document.getElementById('glossaryContent');
    let html = '<div class="wizard-container">';

    // Progress bar
    html += `<div class="wizard-progress">
      <div class="wizard-progress-fill" style="width:${Math.round(((step) / blocks.length) * 100)}%"></div>
    </div>
    <div class="wizard-progress-label">${m.icon} ${m.title} &middot; Step ${step + 1} of ${blocks.length}</div>`;

    // Story intro
    if (intro) {
      html += `<div class="wizard-intro">${intro}</div>`;
    }

    // Block content preview
    html += `<div class="wizard-block-card" onclick="app._pendingMissionIntro='${(intro||'').replace(/'/g,"\\'")}';app.openBlock('${blockId}')">
      <div class="wizard-block-title">${block?.meta?.title || blockId}</div>
      <div class="wizard-block-teaser">${block?.meta?.teaser || ''}</div>
      <div class="wizard-block-meta">Chapter ${block?.meta?._chapterNum || '?'} &middot; ${block?.meta?.readingTime || 3} min read</div>
      <button class="wizard-read-btn">${isRead ? '\u2713 Read again' : 'Read this section'} &rarr;</button>
    </div>`;

    // Navigation
    html += `<div class="wizard-nav">
      ${step > 0 ? `<button class="wizard-nav-btn" onclick="app._wizardStep=${step - 1};app._renderWizardStep()">&larr; Previous</button>` : '<span></span>'}
      ${isRead ? `<button class="wizard-nav-btn wizard-nav-next" onclick="app._wizardStep=${step + 1};app._renderWizardStep()">Next &rarr;</button>` : `<button class="wizard-nav-btn" disabled style="opacity:.4">Read to continue</button>`}
    </div>`;

    html += '</div>';
    el.innerHTML = html;
    if (this.currentView !== 'glossary') this.switchView('glossary');
    window.scrollTo(0, 0);
  }

  _renderBossQuiz() {
    const m = this._wizardMission;
    if (!m || !m.boss) { this.completeMission(m.id); return; }

    const el = document.getElementById('glossaryContent');
    let html = '<div class="wizard-container">';

    html += `<div class="wizard-progress">
      <div class="wizard-progress-fill" style="width:100%"></div>
    </div>
    <div class="wizard-progress-label">${m.icon} ${m.title} &middot; Final Challenge!</div>`;

    html += `<div class="boss-card">
      <div class="boss-icon">\u{1F409}</div>
      <h3 class="boss-title">Final Boss: Prove You've Learned!</h3>
      <div class="boss-question">${m.boss.q}</div>
      <textarea class="boss-answer" id="bossAnswer" placeholder="Type your answer here..." rows="4"></textarea>
      <div class="boss-hint" id="bossHint" style="display:none"></div>
      <div class="boss-actions">
        <button class="boss-submit" id="bossSubmit" onclick="app._checkBossAnswer('${m.id}')">Check my answer</button>
        <span class="boss-examiner-note" id="bossExaminerNote"></span>
      </div>
    </div>`;

    html += '</div>';
    el.innerHTML = html;
    window.scrollTo(0, 0);
    // Show whether the AI examiner is on duty (async probe, non-blocking)
    this._probeBoss().then(on => {
      const note = document.getElementById('bossExaminerNote');
      if (note) note.textContent = on ? '🤖 graded by the AI examiner' : '';
    });
  }

  async _probeBoss() {
    if (this._bossAvailable !== undefined) return this._bossAvailable;
    try {
      const res = await fetch('/api/boss');
      this._bossAvailable = res.ok && !!(await res.json()).available;
    } catch (e) { this._bossAvailable = false; }
    return this._bossAvailable;
  }

  async _checkBossAnswer(missionId) {
    const m = this._wizardMission;
    if (!m) return;
    const rawAnswer = document.getElementById('bossAnswer')?.value?.trim() || '';
    const hintEl = document.getElementById('bossHint');
    if (!hintEl) return;

    if (rawAnswer.length < 20) {
      hintEl.style.display = 'block';
      hintEl.className = 'boss-hint boss-retry';
      hintEl.innerHTML = 'Write a bit more! Try to explain in at least a few sentences.';
      return;
    }

    // AI examiner grades substance; keyword check is the offline fallback
    if (await this._probeBoss()) {
      const btn = document.getElementById('bossSubmit');
      if (btn) { btn.disabled = true; btn.textContent = 'The examiner is reading… 🧐'; }
      hintEl.style.display = 'block';
      hintEl.className = 'boss-hint';
      hintEl.innerHTML = '<span class="gen-spinner">The dragon considers your answer…</span>';
      try {
        const res = await fetch('/api/boss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: m.boss.q, hints: m.boss.hints || [], answer: rawAnswer, missionTitle: m.title }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'grading failed');
        const g = data.grade;
        this.rc.logEvent('boss_graded', { missionId, score: g.score, verdict: g.verdict });
        const bar = `<div class="boss-score-bar"><div class="boss-score-fill" style="width:${g.score}%;background:${g.verdict === 'pass' ? '#10B981' : g.verdict === 'almost' ? '#D97706' : '#EF4444'}"></div></div>
          <div style="font-size:.72rem;color:var(--text-3)">${g.score}/100</div>`;
        if (g.verdict === 'pass') {
          hintEl.className = 'boss-hint boss-pass';
          hintEl.innerHTML = `${bar}<b>Passed!</b> ${this.escHtml(g.feedback)}`;
          setTimeout(() => this.completeMission(missionId), 2000);
        } else {
          hintEl.className = 'boss-hint boss-retry';
          hintEl.innerHTML = `${bar}${this.escHtml(g.feedback)}
            ${g.missing?.length ? `<div style="margin-top:.4em">Still missing: ${g.missing.map(x => `<b>${this.escHtml(x)}</b>`).join(' · ')}</div>` : ''}
            ${g.followUp ? `<div style="margin-top:.4em">🐉 <i>${this.escHtml(g.followUp)}</i></div>` : ''}
            <div style="margin-top:.5em">
              <button class="wizard-nav-btn" onclick="document.getElementById('bossAnswer').focus()">Improve my answer</button>
              <button class="wizard-nav-btn" onclick="app._wizardStep=0;app._renderWizardStep()">Review the steps</button>
            </div>`;
        }
        if (btn) { btn.disabled = false; btn.textContent = 'Check my answer'; }
        return;
      } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = 'Check my answer'; }
        /* examiner down → fall through to keyword check */
      }
    }
    this._checkBossAnswerLocal(missionId, rawAnswer.toLowerCase(), hintEl);
  }

  _checkBossAnswerLocal(missionId, answer, hintEl) {
    const m = this._wizardMission;
    const hints = m.boss.hints || [];
    const found = hints.filter(h => answer.includes(h));
    const score = found.length / Math.max(hints.length, 1);

    if (score >= 0.5 || answer.length > 80) {
      hintEl.style.display = 'block';
      hintEl.className = 'boss-hint boss-pass';
      hintEl.innerHTML = `<b>Awesome!</b> You mentioned ${found.length} key concepts. You clearly understand this topic!`;
      setTimeout(() => this.completeMission(missionId), 1500);
    } else {
      const missing = hints.filter(h => !answer.includes(h)).slice(0, 2);
      hintEl.style.display = 'block';
      hintEl.className = 'boss-hint boss-retry';
      hintEl.innerHTML = `Good start! But try to also mention: <b>${missing.join('</b> and <b>')}</b>. Go back and re-read if you need to!`;
      hintEl.innerHTML += `<br><button class="wizard-nav-btn" style="margin-top:.4em" onclick="app._wizardStep=0;app._renderWizardStep()">Review the steps</button>`;
    }
  }

  showTopic(topic) {
    // Redirect topic clicks to missions view
    this.switchView('glossary');
  }



  generateChatResponse(query, targetEl) {
    const context = {
      allBlocks: this.allBlocks,
      topicIndex: this.topicIndex,
      currentBlockId: this.user.currentBlock,
      currentChapterId: this.chapters[this.user.currentChapter]?.id,
      userProfile: this.user
    };

    const result = this.tutor.generateResponse(query, context);

    // Store in conversation
    const blockId = this.user.currentBlock || null;
    const chapterId = context.currentChapterId || null;
    const conv = this.convManager.getOrCreateConversation(blockId, chapterId);
    this._activeConvId = conv.id;
    this.convManager.addMessage(conv.id, 'user', query);
    this.convManager.addMessage(conv.id, 'tutor', result.text, { confidence: result.confidence });

    // Build response with follow-up and escalation
    let html = result.text;
    if (result.followUp) {
      html += `<br><br><i>${result.followUp}</i>`;
    }
    if (result.canEscalate) {
      html += `<br><br><button class="tutor-escalate-btn" onclick="app.escalateToAuthor()">Ask the author instead</button>`;
    }
    return html;
  }

  escalateToAuthor() {
    if (!this._activeConvId) return;
    const conv = this.convManager.conversations.find(c => c.id === this._activeConvId);
    const lastUserMsg = conv?.messages?.filter(m => m.role === 'user').pop();
    if (!lastUserMsg) return;

    this.convManager.escalateToAuthor(
      this._activeConvId,
      lastUserMsg.text,
      this.user.currentBlock,
      this.user
    );

    // Show confirmation in chat
    const msgHtml = '<div class="chat-msg system">Your question has been sent to Pavel (the author). He reads every message! In the meantime, try exploring related sections in the book.</div>';
    const chatEl = document.getElementById('chatMessagesFull') || document.getElementById('chatMessages');
    if (chatEl) chatEl.insertAdjacentHTML('beforeend', msgHtml);
  }

  askAboutBlock(blockId) {
    const block = this.findBlock(blockId);
    if (!block) return;
    this.user.currentBlock = blockId;
    this.user.save();
    this.tutor.resetConversation();
    this.switchView('chat');
    // Pre-seed with suggested questions
    const questions = this.tutor.getSuggestedQuestions(block);
    const chatEl = document.getElementById('chatMessagesFull');
    if (chatEl) {
      chatEl.innerHTML = `<div class="chat-msg bot">Pavel wrote a lot about <b>${block.meta.title}</b>. What would you like to know? I can explain it, find related sections, or go deeper!</div>`;
      if (questions.length) {
        let sugHtml = '<div class="tutor-suggestions">';
        questions.forEach(q => {
          sugHtml += `<button class="tutor-suggest-btn" onclick="app.askSuggested(this,'${this.escHtml(q)}')">${q}</button>`;
        });
        sugHtml += '</div>';
        chatEl.insertAdjacentHTML('beforeend', sugHtml);
      }
    }
    document.getElementById('chatInputFull')?.focus();
  }

  askSuggested(btn, question) {
    // Remove suggestions
    btn.closest('.tutor-suggestions')?.remove();
    // Send as if user typed it
    const input = document.getElementById('chatInputFull');
    if (input) { input.value = question; this.sendFullChat(); }
  }

  // ===== SEARCH =====
  openSearch() {
    document.getElementById('searchOverlay').classList.add('open');
    document.getElementById('searchInput').focus();
  }

  closeSearch() {
    document.getElementById('searchOverlay').classList.remove('open');
    document.getElementById('searchInput').value = '';
  }

  async onSearch(query) {
    const el = document.getElementById('searchResults');
    if (!query || query.length < 2) { el.innerHTML = '<div class="search-empty">Type to search across all content...</div>'; return; }

    // Local search (always works, even offline)
    // Normalize: lowercase, replace hyphens/underscores with spaces, collapse whitespace
    const normalize = s => (s || '').toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ');
    const q = normalize(query);
    const qWords = q.split(' ').filter(w => w.length >= 2);
    const localResults = this.allBlocks
      .map(b => {
        const m = b.meta;
        const title = normalize(m.title);
        const teaser = normalize(m.teaser);
        const body = normalize(b.body);
        let score = 0;
        // Exact phrase match
        if (title.includes(q)) score += 20;
        if (teaser.includes(q)) score += 10;
        if (body.includes(q)) score += 3;
        // Individual word match (fallback for partial queries)
        if (score === 0 && qWords.length > 1) {
          const allText = title + ' ' + teaser + ' ' + body;
          const matched = qWords.filter(w => allText.includes(w));
          if (matched.length === qWords.length) score += 5; // all words found
          else if (matched.length >= qWords.length * 0.6) score += 2; // most words found
        }
        return { block: b, score };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    // Also try Recombee (non-blocking, merge results)
    const rcPromise = this.rc.searchItems(query, 10, null, 'search').catch(() => null);

    // Show local results immediately
    const renderResults = (results) => {
      if (!results.length) { el.innerHTML = '<div class="search-empty">No results found.</div>'; return; }
      el.innerHTML = results.map(r => {
        const meta = r.meta || r;
        const badge = meta.voice && meta.voice !== 'universal' ? `<span class="card-badge ${meta.voice}">${CONFIG.voices[meta.voice]?.label || meta.voice}</span>` : '';
        return `<div class="card" style="margin-bottom:.5em" onclick="app.openBlock('${meta.id}','search');app.closeSearch()"><div class="card-chapter">${meta._chapterTitle || ''}</div><div class="card-title">${meta.title || meta.id}</div><div class="card-meta">${badge}<span class="card-time">${meta.readingTime || 3} min</span></div></div>`;
      }).join('');
    };

    renderResults(localResults.map(r => r.block));

    // Merge Recombee results when they arrive
    const rcResults = await rcPromise;
    if (rcResults?.recomms?.length) {
      const localIds = new Set(localResults.map(r => r.block.meta.id));
      const extra = rcResults.recomms
        .filter(r => !localIds.has(r.id))
        .map(r => this.findBlock(r.id))
        .filter(Boolean)
        .slice(0, 5);
      if (extra.length) renderResults([...localResults.map(r => r.block), ...extra]);
    }
  }

  // ===== INTERACTIONS =====

  answerQ(el, voice, qId) {
    el.closest('.q-opts').querySelectorAll('.q-opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    this.rc.sendRating(qId, 1);
    // voice answers now seed the FACET model (voice is a retired taxonomy; the
    // question options still carry legacy voice tags in content)
    if (voice && voice !== 'universal') {
      const hint = voice === 'thinker' ? { depth: 'technical' }
        : voice === 'creator' ? { genre: 'worked-example' }
        : { genre: 'story' };
      this.user.updateFacetAffinity(hint, 2);
      this.user.save();
    }

    const qBlock = el.closest('.q-block');
    let recsDiv = qBlock.querySelector('.q-recs');
    if (!recsDiv) { recsDiv = document.createElement('div'); recsDiv.className = 'q-recs fade-up'; qBlock.appendChild(recsDiv); }

    // Generate personalized feedback based on the answer
    const answerText = el.textContent.trim();
    const letter = el.querySelector('.q-letter')?.textContent?.trim() || '';
    const feedback = this._generateAnswerFeedback(qId, letter, voice, answerText);

    // Find matching recommendations
    const vc = CONFIG.voices[voice] || {};
    const voiceFilter = voice !== 'universal' ? voice : null;
    let recs = [];
    if (voiceFilter) {
      const voiceDepths = this.allBlocks.filter(b => b.meta.voice === voiceFilter && b.meta.type === 'depth' && !this.user.readBlocks.has(b.meta.id));
      const unreadSpines = this.allBlocks.filter(b => b.meta.type === 'spine' && !this.user.readBlocks.has(b.meta.id));
      recs = [...voiceDepths.slice(0, 3), ...unreadSpines.slice(0, 2)].slice(0, 4);
    } else {
      recs = this.allBlocks.filter(b => b.meta.type === 'spine' && !this.user.readBlocks.has(b.meta.id)).slice(0, 4);
    }

    let html = `<div class="q-feedback fade-up">${feedback}</div>`;
    if (recs.length) {
      html += `<div class="q-recs-title">Here's what to read next${vc.label ? ' (' + vc.label + ' path)' : ''}:</div>`;
      html += recs.map(b => `<div class="q-rec-item">${this.cardHtml(b.meta)}</div>`).join('');
    }
    recsDiv.innerHTML = html;
    recsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  _generateAnswerFeedback(qId, letter, voice, text) {
    // Question-specific feedback
    const feedbacks = {
      'ch1-q1': {
        A: "Awesome choice! You're an Explorer! You'll love seeing how YouTube's algorithm actually decides what to show you — it's like peeking behind a magic curtain. Let's dig into the mechanics!",
        B: "A Creator at heart! Building things is the BEST way to learn. By the end of this book, you'll have made your own recommendation system. How cool is that?",
        C: "Great thinking! Understanding WHY things go wrong helps us make them better. You'll discover some surprising reasons why recommendations mess up — and what we can do about it.",
        D: "You want it all — love it! You'll get to explore, build, AND think deeply. Every chapter has something for everyone."
      },
      'ch3-q1': {
        A: "Collaborative filtering is fascinating! It's basically the idea that birds of a feather flock together. If you and someone else both love the same movies, you'll probably agree on new ones too!",
        B: "Smart thinking! Content-based filtering is super logical — if you liked a video about building Minecraft castles, you'll probably like other building videos. Simple but powerful!",
        C: "You're thinking like a real engineer! The best systems in the world (YouTube, Spotify, Netflix) all use hybrid approaches. Why pick one when you can use them all?",
        D: "Sometimes the simplest solution is the best starting point! Showing what's popular is how most apps begin. Then they add smarter methods over time."
      },
      'ch4-q1': {
        A: "Accuracy matters — nobody likes bad recommendations! But here's a fun twist: sometimes the MOST accurate system only shows you things you already know you like. Is that really the best?",
        B: "You care about fairness — that's awesome! Imagine being a new YouTuber whose amazing videos never get recommended just because you're not famous yet. Fairness means giving everyone a chance.",
        C: "Discovery is what makes recommendations MAGICAL! The best recommendation isn't something you already wanted — it's something you didn't know existed but absolutely love.",
        D: "That's the right answer! The best recommendation systems balance all three. It's tricky, but that's what makes it such an interesting problem to solve."
      },
      'ch5-q1': {
        A: "A Minecraft server recommender — YES! Imagine: it knows you like survival mode with friends, building medieval stuff, and servers with <50 players. It finds your perfect match. You could totally build this!",
        B: "A music discovery engine! What if it could find genres you've never heard of based on the FEEL of music you like? Not just 'more pop' but 'here's this amazing Japanese city pop that has the same vibe.'",
        C: "A smart book recommender! It could track not just what books you like, but how fast you read, whether you prefer short or long chapters, and even match your mood. Libraries would love this!",
        D: "The best inventions are the ones nobody saw coming! Maybe a recommendation system for study buddies, hiking trails, science experiments, or even what to cook for dinner tonight. Dream big!"
      },
      'ch6-q1': {
        A: "That's a valid choice — you value personalization. But think about this: if the algorithm ONLY shows you what you want, how will you ever discover something new? Sometimes the best experiences come from things you didn't know you'd like.",
        B: "You want full control — respect! Some countries are actually making this a legal right. The EU's Digital Services Act lets people opt out of algorithmic recommendations entirely. You're thinking like a lawmaker!",
        C: "That's a really mature perspective. Showing diverse viewpoints is important for understanding the world. The tricky part: who decides what counts as 'diverse'? It's harder than it sounds, but it's worth trying.",
        D: "Honestly? This might be the wisest answer. These are genuinely hard questions with no perfect solutions. The fact that you recognize the complexity means you're thinking more deeply than most adults. Keep questioning!"
      }
    };

    // Look up specific feedback
    const qFeedbacks = feedbacks[qId];
    if (qFeedbacks && qFeedbacks[letter]) {
      return qFeedbacks[letter];
    }

    // Generic voice-based feedback
    const voiceFeedback = {
      explorer: "Great pick! As an Explorer, you'll love the hands-on demos and visual explanations coming up. Let's see how things work under the hood!",
      creator: "Awesome — you chose the Creator path! Get ready for projects, experiments, and building real things. Learning by doing is the best!",
      thinker: "Nice — you're a Thinker! You like understanding the WHY behind things. The deeper explanations coming up are perfect for you.",
      universal: "Great choice! You'll get a mix of everything — exploring, creating, and thinking. Let's keep going!"
    };

    return voiceFeedback[voice] || voiceFeedback.universal;
  }

  toggleLike(blockId) {
    const current = this.user.ratings.get(blockId);
    const newRating = current >= 0.7 ? 0 : 1; // toggle
    this.rc.sendRating(blockId, newRating);
    this.user.trackRating(blockId, newRating);
    if (!this.user.seenBlocks.has(blockId)) this.user.trackSeen(blockId);
    if (newRating >= 0.7 && !this.user.readBlocks.has(blockId)) this.user.trackRead(blockId);
    if (newRating >= 0.7) { this.showXPToast('+3 XP ❤️', 'xp'); this.checkGamificationEvents(); }
    // Update button visually
    const btn = document.querySelector(`.block-reactions[data-block="${blockId}"] .like-btn`);
    if (btn) {
      btn.classList.toggle('liked', newRating >= 0.7);
      btn.innerHTML = newRating >= 0.7 ? '&#10084;&#65039; <span>Liked</span>' : '&#9825; <span>Like</span>';
    }
    // Share gate (spec §6): liking your own generated block opens the consent prompt —
    // the ONLY door from private to the shared community catalog
    if (newRating >= 0.7 && this.privateBlocks?.[blockId] && this._f('community')) {
      this._showShareConsent(blockId);
    }
  }

  // Open a community block: land on its concept's anchor in real reading context,
  // then swap in the shared variant (keeps navigation, dwell tracking and steering alive)
  async openCommunityBlock(itemId) {
    let entry = this._findAnyBlock(itemId);
    if (!entry) {
      const list = await this.rc.listCommunityBlocks(null, 50);
      entry = list.find(b => b.meta.id === itemId);
      if (entry && this._conceptIds(entry.meta)[0]) {
        if (!this._communityCache) this._communityCache = {};
        (this._communityCache[this._conceptIds(entry.meta)[0]] = this._communityCache[this._conceptIds(entry.meta)[0]] || []).push(entry);
      }
    }
    if (!entry) return;
    this.rc.setContext('community', { itemId });
    this.rc.sendView(itemId);
    const concept = this.concepts?.[this._conceptIds(entry.meta)[0]];
    const anchorId = concept?.anchor;
    if (anchorId && this.findBlock(anchorId)) {
      this.openBlock(anchorId, 'community');
      setTimeout(() => this._swapBlock(anchorId, entry, this._blockFacets(entry.meta) || {}), 500);
    }
  }

  // ===== REMIX: select any passage → describe the change → improved version =====
  // Works on ANY content (core/edited/generated). The original stays untouched —
  // a remix is a private variant of the same concept with the changed span marked,
  // shareable through the same ladder (private → community → edited → core).

  remixSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const quote = sel.toString().trim();
    const anchor = sel.anchorNode?.parentElement?.closest('.block-article');
    const blockId = anchor?.id?.replace('b-', '');
    sel.removeAllRanges();
    const popup = document.getElementById('highlightPopup');
    if (popup) popup.style.display = 'none';
    if (!blockId || quote.length < 10) { this.showXPToast('Select a longer passage to remix', 'xp'); return; }
    this._openRemixForm(blockId, quote);
  }

  // One-tap entry from the block footer — no text selection needed (mobile!).
  // Scope = the whole section; the same form serves manual and AI edits.
  improveBlock(blockId) {
    this._openRemixForm(blockId, null);
  }

  async _openRemixForm(blockId, quote) {
    const el = document.getElementById(`b-${blockId}`);
    if (!el) return;
    document.getElementById(`remix-form-${blockId}`)?.remove();

    const canGen = this._f('generation') && await this._probeGeneration();
    const box = document.createElement('div');
    box.id = `remix-form-${blockId}`;
    box.className = 'share-consent remix-form';
    if (this.user.readerMode !== 'open') {
      box.innerHTML = `<b>✨ Remix</b><div style="font-size:.75rem;margin-top:.3em">Remixing creates your own private version of this section. Turn on <b>Open mode</b> in your <a href="#" onclick="app.switchView('profile');return false">Profile</a> first.</div>`;
    } else {
      // Resolve the SOURCE slice now, so the manual path can edit real markdown.
      const entry = this._findAnyBlock(blockId);
      let base = (entry?.body || '').replace(/⟦\/?rx⟧/g, '');
      let span = quote ? this._locateQuote(base, quote) : [0, base.length];
      if (!span) span = [0, base.length];                     // fallback: whole section
      while (span[0] > 0 && /[*_`~]/.test(base[span[0] - 1])) span[0]--;
      while (span[1] < base.length && /[*_`~]/.test(base[span[1]])) span[1]++;
      if (!this._improveCtx) this._improveCtx = {};
      this._improveCtx[blockId] = { base, span };
      this._remixQuote = quote || base.slice(span[0], span[1]);
      const slice = base.slice(span[0], span[1]);
      const scopeLabel = quote ? 'this part' : 'this section';
      box.innerHTML = `
        <b>✏️ Improve ${scopeLabel}</b>
        <div style="font-size:.68rem;color:var(--text-3);margin:.2em 0 .1em">Edit the text directly…</div>
        <textarea id="edit-src-${blockId}" rows="${Math.min(12, Math.max(3, slice.split('\n').length + 1))}"
          style="width:100%;padding:.45em;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:.76rem;font-family:ui-monospace,monospace;line-height:1.45">${this.escHtml(slice)}</textarea>
        ${canGen ? `<div style="font-size:.68rem;color:var(--text-3);margin:.3em 0 .1em">…or describe the change and let AI write it:</div>
        <textarea id="remix-prompt-${blockId}" rows="2" placeholder="e.g. 'explain with a running-shop example', 'simpler words', 'add one concrete number'"
          style="width:100%;padding:.4em;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:.78rem"></textarea>` : ''}
        <div style="font-size:.68rem;color:var(--text-3);margin:.25em 0">Either way the original stays untouched — you get your own version with the change highlighted, and you decide whether to keep or share it.</div>
        <div class="note-actions">
          <button class="note-save" onclick="app.submitManualEdit('${blockId}')">💾 Save my edit</button>
          ${canGen ? `<button class="note-save" style="background:var(--accent)" onclick="app.submitRemix('${blockId}')">✨ AI rewrite</button>` : ''}
          <button class="note-cancel" onclick="document.getElementById('remix-form-${blockId}').remove()">Cancel</button>
        </div>
        <div id="remix-status-${blockId}"></div>`;
    }
    el.querySelector('.block-footer')?.after(box);
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Longest-common prefix/suffix diff: mark ONLY the changed middle, so a
  // one-word manual edit doesn't highlight the whole paragraph.
  _markDiff(oldText, newText) {
    let p = 0;
    while (p < oldText.length && p < newText.length && oldText[p] === newText[p]) p++;
    let s = 0;
    while (s < oldText.length - p && s < newText.length - p &&
           oldText[oldText.length - 1 - s] === newText[newText.length - 1 - s]) s++;
    const head = newText.slice(0, p), mid = newText.slice(p, newText.length - s), tail = newText.slice(newText.length - s);
    if (!mid.trim()) return { marked: newText, oldMid: oldText.slice(p, oldText.length - s), newMid: mid };
    const markedMid = mid.split(/\n{2,}/).map(seg => seg.trim() ? `⟦rx⟧${seg}⟦/rx⟧` : seg).join('\n\n');
    return { marked: head + markedMid + tail, oldMid: oldText.slice(p, oldText.length - s), newMid: mid };
  }

  // Manual path: the reader IS the model. Same preview + accept pipeline as AI remix.
  submitManualEdit(blockId) {
    const edited = document.getElementById(`edit-src-${blockId}`)?.value;
    const ctx = this._improveCtx?.[blockId];
    const entry = this._findAnyBlock(blockId);
    if (edited == null || !ctx || !entry) return;
    const { base, span } = ctx;
    const original = base.slice(span[0], span[1]);
    if (edited.trim() === original.trim()) { this.showXPToast('No change made yet — edit the text first', 'xp'); return; }
    const { marked, oldMid, newMid } = this._markDiff(original, edited);
    const newBody = base.slice(0, span[0]) + marked + base.slice(span[1]);
    const src = entry.meta;
    const rootId = src.remixOf || src.id;
    const isReRemix = !!src.remixOf;
    const id = isReRemix ? src.id : `remix--${rootId}--${Date.now().toString(36)}`;
    const log = [...(src.remixLog || []), { instruction: '(manual edit)', manual: true, ts: Date.now() }];
    const block = {
      meta: {
        ...src, id, state: 'private', generated: true, remixOf: rootId, remixLog: log,
        core: false, status: undefined,
        readingTime: Math.max(1, Math.round(newBody.split(/\s+/).length / 200)),
      },
      body: newBody,
    };
    this._savePrivateBlock(block);
    document.getElementById(`remix-form-${blockId}`)?.remove();
    this._swapBlock(blockId, block, this._blockFacets(block.meta) || {});
    this.rc.logEvent('manual_edit', { blockId, remixId: id });
    document.getElementById(`b-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this._showRemixDecision(isReRemix ? rootId : blockId, id, oldMid || original, newMid || edited);
  }

  // Selection comes from the RENDERED text; the source is markdown. Locate the
  // quote by comparing only [a-z0-9] streams (survives **bold**, list markers,
  // dashes, quotes, collapsed whitespace) and map back to source offsets.
  _locateQuote(source, quote) {
    let i = source.indexOf(quote);
    if (i !== -1) return [i, i + quote.length];
    const norm = s => {
      const chars = [], map = [];
      for (let j = 0; j < s.length; j++) {
        const c = s[j];
        if (/[a-z0-9]/i.test(c)) { chars.push(c.toLowerCase()); map.push(j); }
      }
      return { str: chars.join(''), map };
    };
    const S = norm(source), Q = norm(quote);
    if (Q.str.length < 12) return null;
    const at = S.str.indexOf(Q.str);
    if (at === -1) return null;
    return [S.map[at], S.map[at + Q.str.length - 1] + 1];
  }

  async submitRemix(blockId) {
    const instruction = document.getElementById(`remix-prompt-${blockId}`)?.value?.trim();
    const quote = this._remixQuote;
    if (!instruction || instruction.length < 3 || !quote) return;
    const entry = this._findAnyBlock(blockId);
    if (!entry) return;
    const status = document.getElementById(`remix-status-${blockId}`);
    if (status) status.innerHTML = '<span class="gen-spinner">✨ Rewriting that part… (~20 s)</span>';
    this.rc.logEvent('remix_request', { blockId, concept: this._conceptIds(entry.meta)[0], instruction: instruction.slice(0, 200) });

    try {
      // locate FIRST — and rewrite the exact SOURCE slice (markdown-accurate)
      let base = entry.body || '';
      let span = this._locateQuote(base, quote);
      if (!span) {
        base = base.replace(/⟦\/?rx⟧/g, '');               // selection may overlap an older mark
        span = this._locateQuote(base, quote);
      }
      if (!span) throw new Error('could not locate the selected passage in the source — try selecting a slightly longer stretch');
      // snap span edges over markdown punctuation so we never cut **bold** in half
      while (span[0] > 0 && /[*_`~]/.test(base[span[0] - 1])) span[0]--;
      while (span[1] < base.length && /[*_`~]/.test(base[span[1]])) span[1]++;
      const sourceQuote = base.slice(span[0], span[1]);

      const res = await fetch(CONFIG.steering.generateEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'remix',
          concept: entry.meta.concept || null,
          facets: this._blockFacets(entry.meta) || {},
          selection: sourceQuote.slice(0, 2000),
          instruction: instruction.slice(0, 500),
          context: base.slice(0, 6000),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'remix failed');
      const replacement = data.replacement;
      const attachedSvg = data.svg || null;   // reader asked for a diagram → server drew one

      // mark each paragraph separately — a single mark spanning \n\n breaks when
      // markdown closes the <p> inside it (only the first fragment stayed highlighted)
      const marked = replacement.split(/\n{2,}/).map(seg => seg.trim() ? `⟦rx⟧${seg}⟦/rx⟧` : seg).join('\n\n');
      const newBody = base.slice(0, span[0]) + marked + base.slice(span[1]);

      const src = entry.meta;
      const rootId = src.remixOf || src.id;
      const isReRemix = !!src.remixOf;                       // remixing your remix edits it in place
      const id = isReRemix ? src.id : `remix--${rootId}--${Date.now().toString(36)}`;
      const log = [...(src.remixLog || []), { quote: quote.slice(0, 120), instruction: instruction.slice(0, 200), ts: Date.now() }];
      const block = {
        meta: {
          ...src, id, state: 'private', generated: true, remixOf: rootId, remixLog: log,
          core: false, status: undefined,
          ...(attachedSvg ? { diagramSvg: attachedSvg, visuality: 'balanced' } : {}),
          readingTime: Math.max(1, Math.round(newBody.split(/\s+/).length / 200)),
        },
        body: newBody,
      };
      this._savePrivateBlock(block);
      document.getElementById(`remix-form-${blockId}`)?.remove();
      this._swapBlock(blockId, block, this._blockFacets(block.meta) || {});
      this.rc.logEvent('remix_served', { blockId, remixId: id });
      // PREVIEW: nothing is final until the reader decides. The decision bar sits
      // on top of the previewed version; Accept makes it a persistent override.
      const origForDecision = src.remixOf ? rootId : blockId;
      const art = document.getElementById(`b-${id}`);
      if (art) {
        const oldSnip = this.escHtml(sourceQuote.slice(0, 150)) + (sourceQuote.length > 150 ? '…' : '');
        const newSnip = this.escHtml(replacement.slice(0, 150)) + (replacement.length > 150 ? '…' : '');
        art.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      this._showRemixDecision(origForDecision, id, sourceQuote, replacement);
    } catch (e) {
      if (status) status.innerHTML = `<span style="color:var(--warn,#D97706);font-size:.72rem">Remix didn't work out (${this.escHtml(String(e.message).slice(0, 120))}). Your wish was recorded.</span>`;
      this.rc.logEvent('remix_failed', { blockId, error: String(e.message).slice(0, 150) });
    }
  }

  // ===== DIAGRAM/ANIMATION REMIX (SVG via prompt) =====
  // Same idea as text remix: describe the change, get your own version of the
  // diagram or animation, visibly marked, original untouched, shareable.

  _diagramRemixBtn(block) {
    if (!this._f('steering') || !this._f('generation')) return '';
    return `<button class="diagram-remix-btn" onclick="app.remixDiagram('${block.id}')" title="✨ Remix this diagram — describe what should change">✨</button>`;
  }

  _sanitizeSvgClient(svg) {
    if (!svg || typeof svg !== 'string') return null;
    let s = svg.trim();
    const start = s.indexOf('<svg');
    if (start === -1) return null;
    s = s.slice(start);
    const end = s.lastIndexOf('</svg>');
    if (end === -1) return null;
    s = s.slice(0, end + 6);
    return s.replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
            .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
            .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/(xlink:href|href)\s*=\s*"(?!#)[^"]*"/gi, '')
            .replace(/(xlink:href|href)\s*=\s*'(?!#)[^']*'/gi, '');
  }

  async remixDiagram(blockId) {
    const el = document.getElementById(`b-${blockId}`);
    if (!el) return;
    document.getElementById(`remix-form-${blockId}`)?.remove();
    const canGen = this._f('generation') && await this._probeGeneration();
    const box = document.createElement('div');
    box.id = `remix-form-${blockId}`;
    box.className = 'share-consent remix-form';
    if (!canGen) {
      box.innerHTML = `<b>✨ Remix diagram</b><div style="font-size:.72rem;color:var(--text-3);margin-top:.3em">Generation isn't configured right now — your wish was recorded for the editors.</div>`;
      this.rc.logEvent('remix_miss', { blockId, diagram: true });
    } else if (this.user.readerMode !== 'open') {
      box.innerHTML = `<b>✨ Remix diagram</b><div style="font-size:.75rem;margin-top:.3em">Remixing creates your own private version of this section. Turn on <b>Open mode</b> in your <a href="#" onclick="app.switchView('profile');return false">Profile</a> first.</div>`;
    } else {
      box.innerHTML = `
        <b>✨ Remix this diagram${el.querySelector('animate, animateTransform, animateMotion') ? ' / animation' : ''}</b>
        <textarea id="remix-prompt-${blockId}" rows="2" placeholder="What should change? e.g. 'make the products running shoes', 'slow the animation down', 'add a third user to the example'"
          style="width:100%;padding:.4em;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:.78rem;margin-top:.3em"></textarea>
        <div style="font-size:.68rem;color:var(--text-3);margin:.25em 0">The original stays untouched — you get your own version, marked as remixed. Works on animations too.</div>
        <div class="note-actions">
          <button class="note-save" onclick="app.submitDiagramRemix('${blockId}')">✨ Generate improved version</button>
          <button class="note-cancel" onclick="document.getElementById('remix-form-${blockId}').remove()">Cancel</button>
        </div>
        <div id="remix-status-${blockId}"></div>`;
    }
    el.querySelector('.block-footer')?.after(box);
    box.querySelector('textarea')?.focus();
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async submitDiagramRemix(blockId) {
    const instruction = document.getElementById(`remix-prompt-${blockId}`)?.value?.trim();
    if (!instruction || instruction.length < 3) return;
    const entry = this._findAnyBlock(blockId);
    if (!entry) return;
    const status = document.getElementById(`remix-status-${blockId}`);
    if (status) status.innerHTML = '<span class="gen-spinner">✨ Redrawing… (~30–60 s for animations)</span>';
    this.rc.logEvent('remix_request', { blockId, diagram: true, instruction: instruction.slice(0, 200) });

    try {
      // source of truth: prior remix override, else the original file via the diagram loader
      let srcSvg = entry.meta.diagramSvg;
      if (!srcSvg && entry.meta.diagram) srcSvg = await getDiagram(entry.meta.diagram);
      srcSvg = this._sanitizeSvgClient(srcSvg);
      if (!srcSvg) throw new Error('no remixable inline SVG found for this block');
      if (srcSvg.length > 60000) throw new Error('this diagram is too complex for remix (yet)');

      const res = await fetch(CONFIG.steering.generateEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'svg-remix',
          concept: entry.meta.concept || null,
          facets: this._blockFacets(entry.meta) || {},
          svg: srcSvg,
          instruction: instruction.slice(0, 500),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'svg remix failed');
      const cleanSvg = this._sanitizeSvgClient(data.svg);
      if (!cleanSvg) throw new Error('remixed SVG failed the safety check');

      const src = entry.meta;
      const rootId = src.remixOf || src.id;
      const isReRemix = !!src.remixOf;
      const id = isReRemix ? src.id : `remix--${rootId}--${Date.now().toString(36)}`;
      const log = [...(src.remixLog || []), { diagram: true, instruction: instruction.slice(0, 200), ts: Date.now() }];
      const block = {
        meta: { ...src, id, state: 'private', generated: true, remixOf: rootId, remixLog: log,
                diagramSvg: cleanSvg, core: false, status: undefined },
        body: entry.body,
      };
      this._savePrivateBlock(block);
      document.getElementById(`remix-form-${blockId}`)?.remove();
      this._swapBlock(blockId, block, this._blockFacets(block.meta) || {});
      this.rc.logEvent('remix_served', { blockId, remixId: id, diagram: true });
      const origForDecision = src.remixOf ? rootId : blockId;
      document.getElementById(`b-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this._showRemixDecision(origForDecision, id, null, null, true);
    } catch (e) {
      if (status) status.innerHTML = `<span style="color:var(--warn,#D97706);font-size:.72rem">Remix didn't work out (${this.escHtml(String(e.message).slice(0, 140))}). Your wish was recorded.</span>`;
      this.rc.logEvent('remix_failed', { blockId, diagram: true, error: String(e.message).slice(0, 150) });
    }
  }

  // ===== SHARE GATE → COMMUNITY LAYER (spec §6-§7) =====
  _showShareConsent(blockId) {
    // Floating bottom sheet — the in-article box used to render below the fold
    // and readers never saw it ("I shared it but admin is empty", 2026-07-08).
    document.getElementById('rxfloat')?.remove();
    document.querySelectorAll('.share-consent-float').forEach(n => n.remove());
    this.rc.logEvent('share_consent_shown', { blockId });
    const box = document.createElement('div');
    box.id = `share-consent-${blockId}`;
    box.className = 'share-consent remix-float share-consent-float';
    box.innerHTML = `
      <b>Glad you liked it!</b> Share this telling into the book so other readers with similar settings can discover it?
      <div style="font-size:.7rem;color:var(--text-3);margin:.3em 0">Shared anonymously by default. It stays labelled as reader-generated until an editor reviews it. You can keep it private — it stays yours either way.</div>
      <input type="text" id="share-nick-${blockId}" placeholder="Optional nickname for credit (leave empty = anonymous)" maxlength="40"
        style="width:100%;padding:.4em;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:.75rem;margin:.2em 0">
      <div class="note-actions">
        <button class="note-save" onclick="app.shareGeneratedBlock('${blockId}')">📣 Share into the book</button>
        <button class="note-cancel" onclick="document.getElementById('share-consent-${blockId}').remove()">Keep private</button>
      </div>`;
    document.body.appendChild(box);
  }

  async shareGeneratedBlock(blockId) {
    const block = this.privateBlocks?.[blockId];
    if (!block) return;
    const nick = document.getElementById(`share-nick-${blockId}`)?.value?.trim() || '';
    const meta = block.meta;
    // Community store = the Recombee catalog (state == "community") — immediately recommendable,
    // no extra infrastructure. Body rides as an item property.
    const ok = await this.rc.shareCommunityBlock({
      itemId: meta.id,
      title: meta.title,
      body: block.body,
      concept: meta.concept,
      lens: meta.lens, visuality: meta.visuality, depth: meta.depth,
      formalism: meta.formalism, lengthBand: meta.lengthBand,
      recallQ: meta.recallQ || '', recallA: meta.recallA || '',
      sharedAs: nick || 'anonymous',
      // Remix provenance: what was changed and the wishes behind it travel with the block
      remixOf: meta.remixOf || '',
      remixLog: meta.remixLog ? JSON.stringify(meta.remixLog).slice(0, 1500) : '',
      diagramSvg: meta.diagramSvg || '',
    });
    // Log regardless — the editorial nomination queue reads these events
    this.rc.logEvent('community_share', { blockId, concept: meta.concept, sharedAs: nick ? 'nick' : 'anonymous', ok });
    document.getElementById(`share-consent-${blockId}`)?.remove();
    if (ok) {
      block.meta.state = 'community';
      this._savePrivateBlock(block, 'shared');
      if (this._communityCache?.[meta.concept]) delete this._communityCache[meta.concept];
      this.showXPToast('+10 XP 📖 You enriched the book!', 'achievement');
      if (this._f('gamification')) { this.user.addXP(10); this.user.save(); this.updateXPBadge(); }
    } else {
      this.showXPToast('Sharing failed — kept private, request logged', 'xp');
    }
  }


  saveBlock(blockId) {
    this.user.trackSave(blockId);
    this.rc.sendBookmark(blockId);
    if (!this.user.seenBlocks.has(blockId)) this.user.trackSeen(blockId);
    const btn = document.querySelector(`#b-${blockId} .act-btn[title="Save"]`);
    if (btn) btn.classList.add('active');
  }


  openBlock(blockId, source) {
    const block = this.findBlock(blockId);
    if (!block) return;
    const chIdx = block.meta._chapterIdx;
    const parentId = blockId;

    // Save current position to navigation history (for back button)
    if (this.currentView === 'read' && this.user.currentBlock) {
      if (!this._navHistory) this._navHistory = [];
      this._navHistory.push({ blockId: this.user.currentBlock, chIdx: this.user.currentChapter, scrollY: window.scrollY });
      if (this._navHistory.length > 20) this._navHistory.shift();
    }

    this.user.currentBlock = blockId;
    this.user.currentChapter = chIdx;
    this.user.save();
    // Update URL hash for sharing
    history.replaceState(null, '', '#' + blockId);
    // Set analytics context: where did user discover this block?
    const mode = source || (this._wizardMission ? 'mission' : this.currentView === 'home' ? 'netflix' : this.currentView === 'map' ? 'map' : this.currentView === 'read' ? 'read' : this.currentView);
    this.rc.setContext(mode, { blockId, chapter: chIdx });
    this.rc.logEvent('open_block', { mode, blockId });

    // If already viewing this chapter, just scroll
    if (this.currentView === 'read' && this._renderedChapter === chIdx) {
      this._scrollToBlock(parentId, block.meta);
      this._updateMissionBar();
      return;
    }

    this._pendingScroll = { parentId, meta: block.meta };
    this.switchView('read', true); // auto — don't log as user-initiated mode switch
    this.renderRead(chIdx);
  }

  // Show/hide mission indicator in topbar
  _updateMissionBar() {
    const container = document.getElementById('missionBarInline');
    if (!container) return;
    if (!this._f('missions')) { container.style.display = 'none'; return; }
    const m = this._wizardMission;
    if (!m) { container.style.display = 'none'; return; }

    container.style.display = 'flex';
    const step = this._wizardStep;
    container.innerHTML = `
      <button class="mission-bar-back" onclick="app._returnToWizard()" title="Next step">&#127919;</button>
      <div class="mission-bar-dots">${m.core.map((id, i) => {
        const b = this.findBlock(id);
        const title = b?.meta?.title || id;
        const cls = this.user.readBlocks.has(id) ? 'done' : i === step ? 'current' : '';
        return `<span class="mission-dot ${cls}" title="${this.escHtml(title)}" onclick="app._wizardStep=${i};app._pendingMissionIntro='${(m.intros?.[i]||'').replace(/'/g,"\\'")}';app.openBlock('${id}')" style="cursor:pointer"></span>`;
      }).join('')}</div>
    `;
  }

  _returnToWizard() {
    if (!this._wizardMission) return;
    const m = this._wizardMission;

    // Find next unread step
    let nextStep = this._wizardStep;
    const currentId = m.core[nextStep];
    if (currentId && this.user.readBlocks.has(currentId)) nextStep++;
    while (nextStep < m.core.length && this.user.readBlocks.has(m.core[nextStep])) nextStep++;
    this._wizardStep = nextStep;

    if (nextStep >= m.core.length) {
      // All core read — go to boss quiz
      this._wizardStep = m.core.length;
      this._renderBossQuiz();
      return;
    }

    // Navigate to next block and show intro banner
    const nextId = m.core[nextStep];
    const intro = m.intros?.[nextStep] || '';
    this._pendingMissionIntro = intro;
    this.openBlock(nextId);
  }

  // Show mission intro banner above the read content
  _showMissionIntro() {
    const intro = this._pendingMissionIntro;
    this._pendingMissionIntro = null;
    if (!intro) return;

    const pane = document.getElementById('readPane');
    if (!pane) return;
    // Remove old banner if exists
    pane.querySelector('.mission-intro-banner')?.remove();
    const banner = document.createElement('div');
    banner.className = 'mission-intro-banner fade-up';
    banner.innerHTML = `<span class="mission-intro-text">${this._wizardMission?.icon || ''} ${intro}</span><button class="mission-intro-close" onclick="this.parentElement.remove()">&times;</button>`;
    pane.prepend(banner);
  }

  goBack() {
    if (!this._navHistory || !this._navHistory.length) {
      // No history — go to welcome/home
      this.showWelcome();
      return;
    }
    const prev = this._navHistory.pop();
    // Don't push to history again (avoid infinite loop)
    this.user.currentBlock = prev.blockId;
    this.user.currentChapter = prev.chIdx;
    this.user.save();
    if (this._renderedChapter === prev.chIdx) {
      // Same chapter — just scroll back
      window.scrollTo(0, prev.scrollY);
    } else {
      // Different chapter — render and scroll
      this._pendingScroll = { parentId: prev.blockId, meta: this.findBlock(prev.blockId)?.meta || { id: prev.blockId } };
      this.switchView('read', true);
      this.renderRead(prev.chIdx);
    }
  }


  _scrollToBlock(parentId, meta) {
    setTimeout(() => {
      const el = document.getElementById(`b-${meta.id}`) || document.getElementById(`b-${parentId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }

  goToMapChapter(idx) {
    this.switchView('map');
    // Scroll to the chapter in map after render
    setTimeout(() => {
      const chEl = document.querySelectorAll('.map-chapter')[idx];
      if (chEl) chEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }

  goChapter(idx) {
    this.user.currentChapter = idx;
    this.user.save();
    this.switchView('read');
    this.renderRead(idx);
  }

  // ===== SETTINGS =====
  toggleSettings() {
    const drawer = document.getElementById('settingsDrawer');
    drawer.classList.toggle('open');
    if (drawer.classList.contains('open')) {
      this._renderSettingsAccount();
      this._renderSettingsThemes();
    }
  }

  _renderSettingsAccount() {
    const el = document.getElementById('settingsAccount');
    if (!el) return;
    const auth = this._getAuth();
    if (auth) {
      el.innerHTML = `<label>Account</label>
        <div class="auth-card auth-logged-in" style="margin-top:.3em">
          <div class="auth-avatar" style="width:32px;height:32px;font-size:1.1rem">${this.getLevelIcon()}</div>
          <div class="auth-info">
            <div class="auth-name" style="font-size:.8rem">${this.escHtml(auth.displayName || 'Reader')}</div>
            <div class="auth-email" style="font-size:.65rem"><span style="color:var(--product)">&#9679;</span> ${this.escHtml(auth.email)}</div>
          </div>
          <button class="auth-secondary-btn" style="font-size:.68rem;padding:.3em .5em" onclick="app._showEditAccount()">Edit</button>
          <button class="auth-logout-btn" onclick="app.logout();app._renderSettingsAccount();app.renderProfile()">Log out</button>
        </div>
        <div id="editAccountForm" style="display:none;margin-top:.4em">
          <input type="text" id="editName" class="auth-input" placeholder="Display name" value="${this.escHtml(auth.displayName || '')}" maxlength="60" style="font-size:.78rem;padding:.4em .6em">
          <input type="password" id="editPassword" class="auth-input" placeholder="New password (leave empty to keep)" maxlength="100" style="font-size:.78rem;padding:.4em .6em">
          <div class="auth-btns">
            <button class="auth-primary-btn" style="font-size:.72rem;padding:.35em" onclick="app.updateAccount()">Save changes</button>
            <button class="auth-secondary-btn" style="font-size:.72rem;padding:.35em" onclick="document.getElementById('editAccountForm').style.display='none'">Cancel</button>
          </div>
          <div id="editAccountError" class="auth-error"></div>
        </div>`;
    } else {
      const savedName = localStorage.getItem('pbook-cert-name') || '';
      el.innerHTML = `<label>Account</label>
        <div style="margin-top:.3em">
          <input type="text" id="authName" class="auth-input" placeholder="Your name" value="${this.escHtml(savedName)}" maxlength="60" style="font-size:.78rem;padding:.4em .6em">
          <input type="email" id="authEmail" class="auth-input" placeholder="Email" maxlength="120" style="font-size:.78rem;padding:.4em .6em">
          <input type="password" id="authPassword" class="auth-input" placeholder="Password (4+ chars)" maxlength="100" style="font-size:.78rem;padding:.4em .6em">
          <div class="auth-btns">
            <button class="auth-primary-btn" style="font-size:.75rem;padding:.4em" onclick="app.register()">Create account</button>
            <button class="auth-secondary-btn" style="font-size:.75rem;padding:.4em" onclick="app.login()">Log in</button>
          </div>
          <div id="authError" class="auth-error"></div>
        </div>`;
    }
  }

  _showEditAccount() {
    const form = document.getElementById('editAccountForm');
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }

  async updateAccount() {
    const auth = this._getAuth();
    if (!auth) return;
    const name = document.getElementById('editName')?.value?.trim();
    const password = document.getElementById('editPassword')?.value;
    const errEl = document.getElementById('editAccountError');

    const body = { action: 'update', email: auth.email };
    if (name) body.displayName = name;
    if (password) {
      if (password.length < 4) { if (errEl) errEl.textContent = 'Password must be at least 4 characters.'; return; }
      body.password = password;
    }
    if (!name && !password) { if (errEl) errEl.textContent = 'Nothing to update.'; return; }
    if (errEl) errEl.textContent = 'Saving...';

    const result = await this._authRequest(body);
    if (result.error) { if (errEl) errEl.textContent = result.error; return; }

    if (name) {
      auth.displayName = name;
      this._setAuth(auth);
      localStorage.setItem('pbook-cert-name', name);
    }
    document.getElementById('editAccountForm').style.display = 'none';
    this._renderSettingsAccount();
    this.renderProfile();
  }

  _renderSettingsThemes() {
    const el = document.getElementById('settingsThemes');
    if (!el) return;
    const rewards = this.getLevelRewards();
    const activeCosmetic = localStorage.getItem('pbook-cosmetic') || null;
    const u = this.user;
    let h = '<div class="cosmetic-grid" style="margin-top:.2em">';
    rewards.forEach(r => {
      const unlocked = u.level >= r.level;
      const active = r.theme ? (r.theme === activeCosmetic) : !activeCosmetic;
      const onclick = unlocked ? (r.theme ? `app.setCosmetic('${r.theme}');app._renderSettingsThemes()` : `app.setCosmetic(null);app._renderSettingsThemes()`) : '';
      h += `<button class="cosmetic-item ${unlocked ? '' : 'cosmetic-locked'} ${active ? 'cosmetic-active' : ''}" ${unlocked ? `onclick="${onclick}"` : ''}>
        <span class="cosmetic-icon">${unlocked ? r.icon : '\u{1F512}'}</span>
        <span class="cosmetic-name">${r.name}</span>
        <span class="cosmetic-level">${unlocked ? (active ? '\u2713' : '') : 'Lv.' + r.level}</span>
      </button>`;
    });
    h += '</div>';
    el.innerHTML = h;
  }

  exportData() {
    const u = this.user;
    const p = u.getProfile(this.allBlocks);
    const data = {
      exportedAt: new Date().toISOString(),
      profile: p,
      user: JSON.parse(localStorage.getItem('pbook-user') || '{}'),
      notes: JSON.parse(localStorage.getItem('pbook-notes') || '{}'),
      highlights: JSON.parse(localStorage.getItem('pbook-highlights') || '{}'),
      interactions: this.rc.interactions,
      features: JSON.parse(localStorage.getItem('pbook-features') || '{}'),
      account: this._getAuth() ? { email: this._getAuth().email, displayName: this._getAuth().displayName } : null,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pbook-data-${(p.userId || 'reader').substring(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? '' : theme);
    localStorage.setItem('pbook-theme', theme);
    this.updateSettingsUI();
  }

  setFontSize(size) {
    const map = { small: '0.95rem', medium: '1.1rem', large: '1.3rem' };
    document.documentElement.style.setProperty('--fs', map[size]);
    localStorage.setItem('pbook-fs', size);
    this.updateSettingsUI();
  }

  applyTheme() {
    const theme = localStorage.getItem('pbook-theme');
    if (theme && theme !== 'light') document.documentElement.setAttribute('data-theme', theme);
    const fs = localStorage.getItem('pbook-fs');
    if (fs) { const map = { small: '0.95rem', medium: '1.1rem', large: '1.3rem' }; document.documentElement.style.setProperty('--fs', map[fs]); }
    this._applyLevelTheme();
    this.updateSettingsUI();
  }

  updateSettingsUI() {
    document.querySelectorAll('.sg-opt').forEach(o => o.classList.remove('active'));
    const fs = localStorage.getItem('pbook-fs') || 'medium';
    document.querySelector(`.sg-opt[data-fs="${fs}"]`)?.classList.add('active');
    // Sync feature checkboxes
    const f = CONFIG.features;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val !== false; };
    set('sGamification', f.gamification);
    set('sPersonalization', f.personalization);
    set('sRecall', f.spaceRepetition);
    set('sMissions', f.missions);
    set('sGames', f.games);
    set('sHighlights', f.highlights);
  }

  updateSettingsFeature() {
    const get = id => document.getElementById(id)?.checked !== false;
    const features = {
      gamification: get('sGamification'),
      personalization: get('sPersonalization'),
      spaceRepetition: get('sRecall'),
      missions: get('sMissions'),
      games: get('sGames'),
      highlights: get('sHighlights'),
    };
    localStorage.setItem('pbook-features', JSON.stringify(features));
    Object.assign(CONFIG.features, features);
    if (!features.personalization) this.rc.enabled = false;
    if (!this._f('missions')) document.querySelector('[data-view="glossary"]')?.style.setProperty('display', 'none');
    else document.querySelector('[data-view="glossary"]')?.style.removeProperty('display');
    this.updateXPBadge();
  }


  // Level rewards — cosmetic unlocks
  _renderActivityHeatmap() {
    // Build day → count map from interactions + read blocks
    const dayCounts = {};
    // From interactions (timestamps)
    this.rc.interactions.forEach(i => {
      if (!i.ts) return;
      const day = new Date(i.ts).toISOString().slice(0, 10);
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    // From block signals (dwell timestamps)
    Object.values(this.user.signals).forEach(sig => {
      if (sig.seenAt) { const d = new Date(sig.seenAt).toISOString().slice(0, 10); dayCounts[d] = (dayCounts[d] || 0) + 1; }
    });

    if (Object.keys(dayCounts).length === 0) return '';

    // Last 56 days (8 weeks)
    const today = new Date();
    const days = [];
    for (let i = 55; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, count: dayCounts[key] || 0, dow: d.getDay() });
    }

    const maxCount = Math.max(...days.map(d => d.count), 1);
    const cellSize = 13, gap = 2, rowH = cellSize + gap;
    const weeks = Math.ceil(days.length / 7);
    const svgW = weeks * (cellSize + gap) + 20;
    const svgH = 7 * rowH + 20;

    const totalActive = days.filter(d => d.count > 0).length;
    const totalInteractions = days.reduce((s, d) => s + d.count, 0);

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" style="display:block;max-width:100%">`;
    // Day labels
    const labels = ['', 'M', '', 'W', '', 'F', ''];
    labels.forEach((l, i) => {
      if (l) svg += `<text x="0" y="${i * rowH + cellSize + 2}" font-size="8" fill="var(--text-3)" font-family="var(--font-ui)">${l}</text>`;
    });
    // Cells
    days.forEach((d, i) => {
      const week = Math.floor(i / 7);
      const dow = i % 7;
      const x = 16 + week * (cellSize + gap);
      const y = 2 + dow * rowH;
      const intensity = d.count > 0 ? Math.max(0.2, d.count / maxCount) : 0;
      const fill = d.count === 0 ? 'var(--border-light)' : `rgba(124,58,237,${intensity})`;
      svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${fill}"><title>${d.key}: ${d.count} interactions</title></rect>`;
    });
    svg += '</svg>';

    let h = '<div class="profile-section"><h3>Your Activity</h3>';
    h += `<div style="display:flex;gap:1em;margin-bottom:.6em;font-size:.78rem">`;
    h += `<span style="color:var(--text-3)">${totalActive} active days</span>`;
    h += `<span style="color:var(--text-3)">${totalInteractions} interactions</span>`;
    h += `</div>`;
    h += svg;
    // Chapter breakdown bars
    const chCounts = {};
    this.rc.interactions.forEach(i => {
      if (i.type !== 'detailview' || !i.itemId) return;
      const block = this.findBlock(i.itemId);
      if (!block) return;
      const ch = block.meta._chapterNum || '?';
      chCounts[ch] = (chCounts[ch] || 0) + 1;
    });
    const chEntries = Object.entries(chCounts).sort((a, b) => a[0] - b[0]);
    if (chEntries.length > 1) {
      const chMax = Math.max(...chEntries.map(([_, c]) => c), 1);
      h += '<div style="margin-top:.8em;font-size:.72rem;color:var(--text-3)">Reading by chapter</div>';
      h += '<div style="display:flex;flex-direction:column;gap:.2em;margin-top:.3em">';
      chEntries.forEach(([ch, count]) => {
        const pct = Math.round((count / chMax) * 100);
        const chTitle = this.book.chapters[ch - 1]?.title || `Chapter ${ch}`;
        h += `<div style="display:flex;align-items:center;gap:.4em;font-size:.72rem">
          <span style="width:1.5em;text-align:right;color:var(--text-3);font-weight:600">${ch}</span>
          <div style="flex:1;height:6px;background:var(--border);border-radius:3px"><div style="width:${pct}%;height:100%;background:var(--accent);border-radius:3px"></div></div>
          <span style="width:2em;color:var(--text-3)">${count}</span>
        </div>`;
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  getLevelIcon() {
    const rewards = this.getLevelRewards();
    const reward = rewards.filter(r => r.level <= this.user.level).pop();
    return reward?.icon || '\u{1F331}';
  }

  getLevelRewards() {
    return [
      { level: 1, name: 'Default', theme: null, icon: '\u{1F331}' },
      { level: 2, name: 'Ocean', theme: 'ocean', icon: '\u{1F30A}' },
      { level: 3, name: 'Sunset', theme: 'sunset', icon: '\u{1F305}' },
      { level: 4, name: 'Forest', theme: 'forest', icon: '\u{1F332}' },
      { level: 5, name: 'Galaxy', theme: 'galaxy', icon: '\u{1F30C}' },
      { level: 7, name: 'Neon', theme: 'neon', icon: '\u{1F4A1}' },
      { level: 10, name: 'Gold', theme: 'gold', icon: '\u{1F451}' },
    ];
  }

  updateXPBadge() {
    const el = document.getElementById('xpBadge');
    if (!el) return;
    if (!this._f('gamification')) { el.style.display = 'none'; return; }
    el.style.display = '';
    const reward = this.getLevelRewards().filter(r => r.level <= this.user.level).pop();
    const editor = this.getEditorTrack?.().tier === 'editor' ? '🛠 ' : '';
    el.textContent = editor + (reward?.icon || '') + ' Lv.' + this.user.level + ' · ' + this.user.xp + 'XP';
    el.title = editor ? 'Editor — earned through accepted contributions' : '';
    // Apply cosmetic theme
    this._applyLevelTheme();
    // Update quiz tab badge
    const quizTab = document.querySelector('.tab[data-view="quiz"] .tab-label');
    if (quizTab && this._f('spaceRepetition')) {
      const dueCount = this.user.getDueRecalls().length;
      quizTab.textContent = dueCount > 0 ? `Quiz (${dueCount})` : 'Quiz';
    }
  }

  _applyLevelTheme() {
    const active = localStorage.getItem('pbook-cosmetic') || null;
    if (active) document.documentElement.setAttribute('data-cosmetic', active);
  }

  setCosmetic(theme) {
    if (theme) {
      localStorage.setItem('pbook-cosmetic', theme);
      document.documentElement.setAttribute('data-cosmetic', theme);
    } else {
      localStorage.removeItem('pbook-cosmetic');
      document.documentElement.removeAttribute('data-cosmetic');
    }
  }

  showXPToast(text, type) {
    if (!this._f('gamification') && type !== 'info') return;
    const toast = document.getElementById('xpToast');
    if (!toast) return;
    toast.textContent = text;
    toast.className = 'xp-toast ' + (type || 'xp') + ' show';
    clearTimeout(this._xpToastTimer);
    this._xpToastTimer = setTimeout(() => { toast.classList.remove('show'); }, 2500);
  }

  // Check for pending gamification events and show toasts
  checkGamificationEvents() {
    if (!this._f('gamification')) return;
    if (this.user._pendingLevelUp) {
      this.showXPToast('Level ' + this.user._pendingLevelUp + '! You are now: ' + this.user.getLevelTitle(), 'levelup');
      this.user._pendingLevelUp = null;
    } else if (this.user._pendingAchievement) {
      const a = this.user._pendingAchievement;
      this.showXPToast(a.icon + ' ' + a.name + '!', 'achievement');
      this.user._pendingAchievement = null;
    }
    this.updateXPBadge();
  }

  updateVoiceBadge() {
    const el = document.getElementById('voiceBadge');
    if (!el) return;
    const v = this.user.preferredVoice || this.user.getTopVoice() || 'universal';
    el.textContent = (CONFIG.voices[v]?.label || v).toUpperCase();
    el.className = `voice-badge ${v}`;
  }


  // ===== TIERED CERTIFICATE (Foundations / Practitioner / Guru) =====
  // Tiers certify demonstrated understanding: what depth of verified core content was read,
  // which mission bosses were beaten, how much recall practice happened. Cumulative ladder.
  // Readers can demand more than tellings: propose a MISSING CONCEPT. The wish is
  // logged (cross-user aggregation in admin) and recorded locally (feeds the editor
  // track); the drafting AI turns ranked wishes into contract proposals for editors.
  proposeConcept(seed) {
    const text = (window.prompt('🌱 What concept is missing from this book?\n\nDescribe it in a sentence or two — editors (and the drafting AI) review every proposal.', seed || '') || '').trim();
    if (!text || text.length < 8) return;
    try {
      const flags = JSON.parse(localStorage.getItem('pbook-flags') || '[]');
      flags.push({ blockId: 'book', type: 'concept-wish', text, timestamp: new Date().toISOString() });
      localStorage.setItem('pbook-flags', JSON.stringify(flags));
    } catch (e) {}
    this.rc.logEvent('concept_wish', { text: text.slice(0, 300) });
    if (this._f('gamification')) { this.user.addXP(10); this.user.save(); this.updateXPBadge(); }
    this.showXPToast('🌱 +10 XP — concept proposal recorded for the editors', 'achievement');
  }

  // Share helper: native share sheet where available, clipboard elsewhere.
  async shareThing(title, text, url) {
    const payload = { title, text, url };
    try {
      if (navigator.share) { await navigator.share(payload); this.rc.logEvent('share', { what: title, via: 'native' }); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      this.showXPToast('🔗 Link copied — paste it to a friend', 'achievement');
      this.rc.logEvent('share', { what: title, via: 'clipboard' });
    } catch (e) {}
  }

  // ===== GHOST ITEMS: concept proposals under interest testing =====
  // Proposals are recommended to readers as clearly labeled "proposed / not written
  // yet" cards. Votes measure demand BEFORE anyone invests writing effort — the
  // pre-mint stage of the elastic catalog. Curated in content/concept-proposals.json.
  async _loadProposals() {
    this.proposals = [];
    try {
      const res = await fetch('content/concept-proposals.json');
      if (res.ok) this.proposals = (await res.json()).proposals || [];
    } catch (e) { /* optional file */ }
  }
  _ghostVotes() {
    try { return JSON.parse(localStorage.getItem('pbook-ghost-votes') || '{}'); } catch (e) { return {}; }
  }
  _unvotedProposals() {
    const votes = this._ghostVotes();
    return (this.proposals || []).filter(p => !(p.slug in votes));
  }
  _ghostCardHtml(p, ctx) {
    if (!this._ghostSeen) this._ghostSeen = new Set();
    if (!this._ghostSeen.has(p.slug)) {
      this._ghostSeen.add(p.slug);
      this.rc.logEvent('ghost_view', { slug: p.slug, ctx });
    }
    return `<div class="card ghost-card" style="flex:0 0 262px;border-top:3px solid #0EA5E9">
      <div class="card-chapter" style="color:#0EA5E9;font-weight:700">🌱 PROPOSED · not written yet</div>
      <div class="card-title">${this.escHtml(p.title)}</div>
      <div class="card-teaser" style="font-size:.72rem">${this.escHtml(p.objective)}</div>
      <div style="font-size:.64rem;color:var(--text-3);font-style:italic;margin:.3em 0">You'd be able to answer: ${this.escHtml(p.recallQ)}</div>
      <div id="ghost-${p.slug}-${ctx}" style="display:flex;gap:.4em;margin-top:.35em">
        <button class="steer-chip" style="border-color:#0EA5E9;color:#0EA5E9" onclick="app.ghostVote('${p.slug}',1,'${ctx}')">👍 I'd read this</button>
        <button class="steer-chip" onclick="app.ghostVote('${p.slug}',-1,'${ctx}')">Not for me</button>
      </div>
    </div>`;
  }
  ghostVote(slug, v, ctx) {
    const votes = this._ghostVotes();
    votes[slug] = v;
    localStorage.setItem('pbook-ghost-votes', JSON.stringify(votes));
    this.rc.logEvent(v > 0 ? 'ghost_want' : 'ghost_skip', { slug });
    if (v > 0 && this._f('gamification')) { this.user.addXP(2); this.user.save(); this.updateXPBadge(); }
    const el = document.getElementById(`ghost-${slug}-${ctx}`);
    if (el) {
      el.innerHTML = v > 0
        ? `<span style="font-size:.7rem;color:#0EA5E9">✓ +2 XP — demand recorded, editors see the totals. <a href="#" onclick="event.preventDefault();app.proposeConcept('${this.escHtml(slug)}: ')" style="color:var(--accent)">add your angle</a></span>`
        : `<span style="font-size:.7rem;color:var(--text-3)">✓ noted — you won't see this one again</span>`;
    }
  }

  // ===== EDITOR TRACK =====
  // Editorship is earned, not appointed. All three signals are client-verifiable:
  // - flags: issues this reader reported (pbook-flags)
  // - shared: own tellings consciously shared into the community layer
  // - adopted: shared tellings whose id now exists in the git corpus — i.e. an
  //   editor reviewed the nomination and merged it into the book
  getEditorTrack() {
    let flags = 0;
    try { flags = JSON.parse(localStorage.getItem('pbook-flags') || '[]').length; } catch (e) {}
    const mine = Object.values(this.privateBlocks || {});
    const shared = mine.filter(b => b.meta.sharedAt || b.meta.state === 'community');
    const adopted = shared.filter(b => this.findBlock(b.meta.id));
    const invited = localStorage.getItem('pbook-role') === 'editor';
    const tier = (invited || adopted.length >= 1 || (shared.length >= 5 && flags >= 5)) ? 'editor'
      : (shared.length >= 1 || flags >= 3) ? 'contributor' : 'reader';
    return { tier, invited, flags, shared: shared.length, adopted: adopted.length };
  }

  // Detect fresh adoptions (my shared telling merged into the book) → celebrate once.
  _checkAdoptions() {
    let awarded;
    try { awarded = new Set(JSON.parse(localStorage.getItem('pbook-adoption-awarded') || '[]')); } catch (e) { awarded = new Set(); }
    let changed = false;
    for (const b of Object.values(this.privateBlocks || {})) {
      const id = b.meta.id;
      if ((b.meta.sharedAt || b.meta.state === 'community') && this.findBlock(id) && !awarded.has(id)) {
        awarded.add(id); changed = true;
        if (this._f('gamification')) { this.user.addXP(100); this.user.save(); }
        setTimeout(() => this.showXPToast('📖 Your telling was adopted into the book! +100 XP — Editor track', 'achievement'), 1200);
      }
    }
    if (changed) {
      localStorage.setItem('pbook-adoption-awarded', JSON.stringify([...awarded]));
      this.updateXPBadge();
    }
  }

  getCertTiers() {
    const u = this.user;
    const core = this.allBlocks.filter(b => b.meta.core && b.meta.type === 'spine');
    const byDepth = want => core.filter(b => want.includes(b.meta.depth || 'standard'));
    const readCount = list => list.filter(b => u.readBlocks.has(b.meta.id)).length;
    const readAll = list => list.length === 0 || list.every(b => u.readBlocks.has(b.meta.id));

    const base = byDepth(['intro', 'standard']);
    const tech = byDepth(['technical']);
    const research = byDepth(['research']);
    const missions = this._f('missions') ? this.getMissions() : [];
    const done = u.completedMissions || [];
    const advancedDone = done.filter(id => missions.find(m => m.id === id)?.difficulty === 'Advanced').length;
    const recallReps = Object.values(u.recall || {}).reduce((s, c) => s + (c.reps || 0), 0);

    const tiers = [
      { id: 'foundations', icon: '\u{1F949}', title: 'Foundations', subtitle: 'Understands Recommendations', color: '#B45309',
        reqs: [{ label: `core essentials read (${readCount(base)}/${base.length})`, done: readAll(base) }] },
      { id: 'practitioner', icon: '\u{1F948}', title: 'Practitioner', subtitle: 'Can Build Recommenders', color: '#64748B',
        reqs: [
          { label: `technical core read (${readCount(tech)}/${tech.length})`, done: readAll(tech) },
          { label: `missions completed (${Math.min(done.length, 2)}/2)`, done: done.length >= 2 },
        ] },
      { id: 'guru', icon: '\u{1F947}', title: 'Recommendation Guru', subtitle: 'Masters the Algorithms', color: '#CA8A04',
        reqs: [
          { label: `research-level core read (${readCount(research)}/${research.length})`, done: readAll(research) },
          { label: `advanced mission boss beaten (${Math.min(advancedDone, 1)}/1)`, done: advancedDone >= 1 },
          { label: `recall reviews (${Math.min(recallReps, 10)}/10)`, done: recallReps >= 10 },
        ] },
    ];
    let achievedIdx = -1;
    for (let i = 0; i < tiers.length; i++) {
      if (i === achievedIdx + 1 && tiers[i].reqs.every(r => r.done)) achievedIdx = i;
    }
    return { tiers, achievedIdx };
  }

  showCertificateModal() {
    const savedName = localStorage.getItem('pbook-cert-name') || '';
    const savedEmail = localStorage.getItem('pbook-cert-email') || '';
    const overlay = document.createElement('div');
    overlay.className = 'cert-overlay';
    overlay.innerHTML = `
      <div class="cert-modal">
        <button class="cert-close" onclick="this.closest('.cert-overlay').remove()">&times;</button>
        <h2>Your Certificate</h2>
        <p style="font-size:.82rem;color:var(--text-2);margin-bottom:1em">Congratulations on completing the book! Fill in your details to personalize your certificate.</p>
        <label class="cert-label">Your name <span style="color:var(--accent)">*</span></label>
        <input type="text" id="certName" class="cert-input" placeholder="e.g. Maya Johnson" value="${this.escHtml(savedName)}" maxlength="60">
        <label class="cert-label">What did you think of the book? <span style="font-weight:400;color:var(--text-3)">(optional)</span></label>
        <textarea id="certComment" class="cert-input" rows="3" placeholder="I learned that recommendations work by..." maxlength="500"></textarea>
        <label class="cert-label">Would you recommend this book? <span style="font-weight:400;color:var(--text-3)">(optional)</span></label>
        <div class="cert-stars" id="certStars">
          ${[1,2,3,4,5].map(i => `<button class="cert-star" data-val="${i}" onclick="app._setCertStars(${i})">${i <= 0 ? '\u2606' : '\u2606'}</button>`).join('')}
        </div>
        <label class="cert-label">Email <span style="font-weight:400;color:var(--text-3)">(optional — we'll let you know about new books)</span></label>
        <input type="email" id="certEmail" class="cert-input" placeholder="your@email.com" value="${this.escHtml(savedEmail)}" maxlength="120">
        <div class="cert-actions">
          <button class="cert-btn cert-btn-primary" onclick="app.generateCertificate()">Download Certificate</button>
          <button class="cert-btn cert-btn-share" onclick="app.shareCertificate()">Share</button>
        </div>
        <div id="certPreview" style="margin-top:1em"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('certName').focus();
  }

  _setCertStars(n) {
    this._certStars = n;
    document.querySelectorAll('.cert-star').forEach(btn => {
      btn.textContent = parseInt(btn.dataset.val) <= n ? '\u2605' : '\u2606';
      btn.classList.toggle('active', parseInt(btn.dataset.val) <= n);
    });
  }

  _buildCertSVG(name) {
    const u = this.user;
    const p = u.getProfile(this.allBlocks);
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    // Specialization line from the facet profile (voice is legacy)
    const _tf = u.getTargetFacets();
    const voiceLabel = [
      _tf.depth && _tf.depth !== 'standard' ? `${_tf.depth} depth` : null,
      _tf.lens && _tf.lens !== 'generic' ? `${_tf.lens} world` : null,
      _tf.lang === 'cs' ? 'Czech edition' : null,
    ].filter(Boolean).join(' · ') || 'Universal';
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const displayName = esc(name || 'Anonymous Reader');
    // Adjust font size for long names
    const nameSize = displayName.length > 25 ? 18 : displayName.length > 18 ? 21 : 24;
    // Tier (Foundations / Practitioner / Guru) — header, subtitle and accent follow the achieved tier
    const { tiers, achievedIdx } = this.getCertTiers();
    const tier = tiers[Math.max(achievedIdx, 0)];
    const tierHeader = achievedIdx >= 0 ? `CERTIFICATE • ${tier.title.toUpperCase()}` : 'CERTIFICATE OF COMPLETION';
    const tierLine = achievedIdx >= 0 ? esc(`${tier.subtitle} — verified core content at ${tier.id === 'guru' ? 'research' : tier.id === 'practitioner' ? 'technical' : 'foundational'} depth`) : 'has successfully completed the study of Modern Recommender Systems';
    const tierColor = achievedIdx >= 0 ? tier.color : '#7C3AED';

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 566" width="800" height="566">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F5F3FF"/>
      <stop offset="100%" stop-color="#EDE9FE"/>
    </linearGradient>
  </defs>
  <rect width="800" height="566" fill="url(#bg)" rx="16"/>
  <rect x="20" y="20" width="760" height="526" fill="none" stroke="#7C3AED" stroke-width="2" rx="12" stroke-dasharray="8 4"/>
  <rect x="30" y="30" width="740" height="506" fill="none" stroke="#7C3AED" stroke-width="1" rx="10" opacity=".3"/>

  <!-- Header -->
  <text x="400" y="80" text-anchor="middle" font-family="Georgia,serif" font-size="14" fill="${tierColor}" letter-spacing="6">${tierHeader}</text>
  <line x1="200" y1="95" x2="600" y2="95" stroke="#C4B5FD" stroke-width="1"/>

  <!-- Title -->
  <text x="400" y="140" text-anchor="middle" font-family="Georgia,serif" font-size="28" fill="#4C1D95" font-weight="bold">How Recommendations Work</text>
  <text x="400" y="168" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" fill="#7C3AED">A p-book by Pavel Kordik</text>

  <!-- This certifies -->
  <text x="400" y="210" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="#6B7280">This certifies that</text>
  <text x="400" y="248" text-anchor="middle" font-family="Georgia,serif" font-size="${nameSize}" fill="#1C1917" font-weight="bold">${displayName}</text>
  <line x1="250" y1="260" x2="550" y2="260" stroke="#D4B5FD" stroke-width="1"/>

  <!-- Achievement stats -->
  <text x="400" y="295" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="#6B7280">${tierLine}</text>

  <text x="200" y="335" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#7C3AED" font-weight="600">${p.progress.read} sections read</text>
  <text x="400" y="335" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#7C3AED" font-weight="600">Level ${u.level} \u2022 ${u.xp} XP</text>
  <text x="600" y="335" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#7C3AED" font-weight="600">${u.achievements.length} badges earned</text>

  <text x="200" y="358" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#9CA3AF">${p.progress.pct}% complete</text>
  <text x="400" y="358" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#9CA3AF">${voiceLabel} path</text>
  <text x="600" y="358" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#9CA3AF">${p.readingTimeMin} min reading</text>

  <!-- Specialization -->
  <rect x="280" y="378" width="240" height="30" rx="15" fill="#7C3AED" opacity=".1"/>
  <text x="400" y="398" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="#7C3AED" font-weight="600">Specialization: ${voiceLabel}</text>

  <!-- Topics -->
  <text x="400" y="438" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#9CA3AF">Key topics: ${(p.topTopics || []).slice(0, 4).join(' \u2022 ') || 'Recommender Systems'}</text>

  <!-- Footer -->
  <line x1="150" y1="470" x2="350" y2="470" stroke="#D4B5FD" stroke-width="1"/>
  <text x="250" y="488" text-anchor="middle" font-family="Georgia,serif" font-size="12" fill="#4C1D95">Pavel Kordik</text>
  <text x="250" y="502" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" fill="#9CA3AF">Author &amp; Recombee Co-founder</text>

  <line x1="450" y1="470" x2="650" y2="470" stroke="#D4B5FD" stroke-width="1"/>
  <text x="550" y="488" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="#4C1D95">${date}</text>
  <text x="550" y="502" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" fill="#9CA3AF">Date of completion</text>

  <!-- Seal -->
  <circle cx="400" cy="490" r="22" fill="#7C3AED" opacity=".15"/>
  <text x="400" y="496" text-anchor="middle" font-size="20">\u{1F393}</text>
</svg>`;
  }

  generateCertificate() {
    const nameInput = document.getElementById('certName');
    const name = nameInput?.value?.trim();
    if (!name) { nameInput?.classList.add('cert-error'); nameInput?.focus(); return; }
    nameInput?.classList.remove('cert-error');

    const comment = document.getElementById('certComment')?.value?.trim() || '';
    const email = document.getElementById('certEmail')?.value?.trim() || '';
    const stars = this._certStars || 0;

    // Save locally
    localStorage.setItem('pbook-cert-name', name);
    if (email) localStorage.setItem('pbook-cert-email', email);

    const u = this.user;
    const p = u.getProfile(this.allBlocks);

    // Award certificate achievement
    if (!u.achievements.find(a => a.id === 'certified')) {
      u.achievements.push({ id: 'certified', name: 'Certified!', icon: '\u{1F393}', desc: 'Earned your certificate', earnedAt: Date.now() });
      u.addXP(50);
      u.save();
      this.showXPToast('+50 XP \u{1F393} Certificate earned!', 'achievement');
    }

    // Store to Supabase
    this.rc._sendToLog({
      type: 'certificate',
      userId: localStorage.getItem('pbook-uid') || 'unknown',
      event: 'certificate_issued',
      data: {
        name,
        comment: comment.substring(0, 500),
        email: email.substring(0, 120),
        stars,
        level: u.level,
        xp: u.xp,
        sectionsRead: p.progress.read,
        totalSections: p.progress.total,
        pct: p.progress.pct,
        voice: u.getTopVoice(),
        readingTimeMin: p.readingTimeMin,
        achievements: u.achievements.length,
        completedMissions: (u.completedMissions || []).length,
      }
    });

    // Generate and download SVG
    const svg = this._buildCertSVG(name);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `recsys-certificate-${name.replace(/[^a-zA-Z0-9]/g, '-')}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);

    // Show preview in modal
    const preview = document.getElementById('certPreview');
    if (preview) {
      preview.innerHTML = `<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:.5em">${svg.replace('<?xml version="1.0" encoding="UTF-8"?>', '')}</div>
        <p style="font-size:.75rem;color:var(--product);font-weight:600">Certificate downloaded! You can also share it below.</p>`;
    }
  }

  async shareCertificate() {
    const name = document.getElementById('certName')?.value?.trim();
    if (!name) { document.getElementById('certName')?.focus(); return; }

    const svg = this._buildCertSVG(name);

    // Convert SVG to PNG for sharing via canvas
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 800; canvas.height = 566;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const pngBlob = await new Promise(r => canvas.toBlob(r, 'image/png'));

      // Try Web Share API (mobile-friendly)
      if (navigator.share && navigator.canShare?.({ files: [new File([pngBlob], 'certificate.png', { type: 'image/png' })] })) {
        await navigator.share({
          title: 'I completed "How Recommendations Work"!',
          text: `I just finished the p-book "How Recommendations Work" by Pavel Kordik and earned my certificate!`,
          files: [new File([pngBlob], 'recsys-certificate.png', { type: 'image/png' })]
        });
      } else {
        // Fallback: copy PNG to clipboard
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
        this.showXPToast('Certificate copied to clipboard! Paste it anywhere to share.', 'info');
      }
    } catch (e) {
      // Final fallback: download the SVG
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `recsys-certificate-${name.replace(/[^a-zA-Z0-9]/g, '-')}.svg`;
      a.click();
      URL.revokeObjectURL(a.href);
      this.showXPToast('Certificate saved! Share it with your friends.', 'info');
    }
  }

  resetAll() {
    if (!confirm('Reset all reading data? This clears your progress, notes, and preferences.')) return;
    this.user.reset();
    localStorage.removeItem('pbook-theme');
    localStorage.removeItem('pbook-fs');
    localStorage.removeItem('pbook-uid');
    localStorage.removeItem('pbook-notes');
    localStorage.removeItem('pbook-flags');
    localStorage.removeItem('pbook-state');
    location.reload();
  }

  // ===== HELPERS =====
  findBlock(id) {
    if (!this._blockIndex || this._blockIndex.size !== this.allBlocks.length) {
      this._blockIndex = new Map(this.allBlocks.map(b => [b.meta.id, b]));
    }
    return this._blockIndex.get(id) || null;
  }

  getChapterLabel(block) {
    for (const [i, ch] of Object.entries(this.chapters)) {
      if (ch.blocks.some(b => b.id === block.id)) return `Ch${ch.number}: ${ch.title}`;
    }
    return '';
  }
}

// ===== INIT =====
const app = new PBook();
window.app = app;
app.init();

// Text highlight on selection (desktop + mobile)
function _showHighlightPopup() {
  const popup = document.getElementById('highlightPopup');
  if (!popup) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) { popup.style.display = 'none'; return; }
  const anchor = sel.anchorNode?.parentElement?.closest('.spine-body, .d-content, .sb-block');
  if (!anchor) { popup.style.display = 'none'; return; }
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  popup.style.display = 'flex';
  popup.style.top = (rect.top + window.scrollY - 40) + 'px';
  popup.style.left = Math.max(8, Math.min(rect.left + rect.width / 2 - 40, window.innerWidth - 90)) + 'px';
}
document.addEventListener('mouseup', _showHighlightPopup);
// Right-click on a selection inside a block → our action menu (highlight / note / remix) at the cursor
// Concept cross-links (AGENTS.md convention): [text](#c/<slug>) resolves through the
// concept index to its anchor — links survive re-tagging, swaps and chapter moves.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#c/"]');
  if (!a) return;
  e.preventDefault();
  const slug = a.getAttribute('href').slice(3);
  const concept = app?.concepts?.[slug];
  if (concept?.anchor && app.findBlock(concept.anchor)) {
    app.rc.logEvent('concept_link', { slug });
    app.openBlock(concept.anchor, 'crosslink');
  }
});

document.addEventListener('contextmenu', (e) => {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
  if (!e.target.closest?.('.spine-body, .d-content, .sb-block')) return;
  const popup = document.getElementById('highlightPopup');
  if (!popup) return;
  e.preventDefault();
  popup.style.display = 'flex';
  popup.style.top = (e.clientY + window.scrollY - 44) + 'px';
  popup.style.left = Math.max(8, Math.min(e.clientX - 40, window.innerWidth - 130)) + 'px';
});
// Mobile: selectionchange fires when user adjusts selection handles
document.addEventListener('selectionchange', () => {
  clearTimeout(window._hlDebounce);
  window._hlDebounce = setTimeout(_showHighlightPopup, 300);
});

// Click on highlight to remove it
document.addEventListener('click', (e) => {
  const mark = e.target.closest('mark.user-highlight');
  if (!mark) return;
  // Don't remove if user is selecting text (mouseup fires click too)
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed) return;
  // Don't remove during flash animation
  if (mark.classList.contains('highlight-flash')) return;
  // Unwrap: replace <mark> with its text content
  const parent = mark.parentNode;
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
  parent.removeChild(mark);
  parent.normalize();
});

// Keyboard: arrows for chapter nav in read view
document.addEventListener('keydown', e => {
  if (app.currentView !== 'read' || !app.book) return;
  if (e.key === 'ArrowRight' && app.user.currentChapter < app.book.chapters.length - 1) app.goChapter(app.user.currentChapter + 1);
  if (e.key === 'ArrowLeft' && app.user.currentChapter > 0) app.goChapter(app.user.currentChapter - 1);
});
