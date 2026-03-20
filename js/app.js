// p-book v3: Adaptive UX with Netflix home, map, search, feedback, Recombee-powered

import { CONFIG } from './config.js';
import { renderMarkdown, parseFrontmatter } from './markdown.js';
import { RecombeeClient, UserModel } from './recombee.js';
import { getDiagram } from './diagrams.js';

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
  }

  // ===== INIT =====
  async init() {
    try {
      this.book = await (await fetch(CONFIG.book.bookIndex)).json();
    } catch (e) {
      document.body.innerHTML = '<div style="padding:3em;text-align:center;font-family:sans-serif;color:#888">Could not load book. Run <code>./serve.sh</code> first.</div>';
      return;
    }
    // Preload all content for search and map
    await this.loadAllContent();
    this.autoTagBlocks();
    this.rc.setAllBlocks(this.allBlocks);
    this.rc._loadInteractions(); // Restore persisted interactions

    // Sync voice preference to Recombee
    if (this.user.preferredVoice && this.rc.enabled) {
      this.rc.setUserProperties({ voice: this.user.preferredVoice });
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

    // Apply saved settings
    if (this.user.preferredVoice || this.user.totalInteractions > 0) {
      this.startApp();
    }
    this.applyTheme();
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
      const valid = blocks.filter(Boolean).sort((a, b) => a.sequence - b.sequence);
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

  // ===== ONBOARDING =====
  showStep(n) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.querySelector(`.step[data-step="${n}"]`).classList.add('active');
  }

  pickVoice(el) {
    document.querySelectorAll('.opt-card').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    this.user.setVoice(el.dataset.voice);
    setTimeout(() => this.startApp(), 400);
  }

  startReading() { this.startApp(); }

  startApp() {
    document.getElementById('onboarding').classList.add('hidden');
    this.updateVoiceBadge();
    this.switchView('home');
  }

  // ===== VIEW SWITCHING =====
  switchView(view) {
    this.currentView = view;

    // Hide all views, show the selected one
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const viewEl = document.getElementById(`view-${view}`);
    if (viewEl) viewEl.classList.add('active');

    // Update tab highlights
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));

    // Linear nav only in read view
    const linearNav = document.getElementById('linearNav');
    if (linearNav) linearNav.style.display = view === 'read' ? 'flex' : 'none';

    if (view === 'home') this.renderHome();
    else if (view === 'read') { this.renderRead(); this.updateLinearNav(); }
    else if (view === 'map') this.renderMap();
    else if (view === 'glossary') this.renderGlossary();
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

    // 2. Recommended for you
    const forYou = await this.rc.getRecsForUser('pbook:personal', 8, this.rc.reql({ type: 'spine' }), this.rc.reqlBoost(this.user));
    if (forYou?.recomms?.length) {
      html += this.shelf('Picked for you', forYou.recomms.map(r => this.cardFromRec(r)));
    }

    // 3. Matching your interest (preferred voice depth cards)
    const topVoice = this.user.getTopVoice();
    if (topVoice) {
      const voiceLabel = CONFIG.voices[topVoice]?.label || topVoice;
      const voiceBlocks = this.allBlocks.filter(b => b.meta.voice === topVoice && b.meta.type === 'depth' && !this.user.readBlocks.has(b.meta.id)).slice(0, 10);
      if (voiceBlocks.length) {
        html += this.shelf(`${voiceLabel} deep dives`, voiceBlocks.map(b => this.cardHtml(b.meta)));
      }
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

    // 8. By chapter
    this.book.chapters.forEach((ch, i) => {
      const chBlocks = (this.chapters[i]?.blocks || []).filter(b => b.type === 'spine').slice(0, 8);
      if (chBlocks.length) {
        html += this.shelf(`Ch${ch.number}: ${ch.title}`, chBlocks.map(b => this.cardHtml(b)));
      }
    });

    el.innerHTML = html || '<div class="search-empty">Loading content...</div>';
    // Hide arrows on shelves that don't overflow
    requestAnimationFrame(() => this._updateShelfArrows());
  }

  shelf(title, cardHtmls) {
    const id = 'shelf-' + (this._shelfCounter = (this._shelfCounter || 0) + 1);
    return `<section class="shelf fade-up">
      <div class="shelf-head"><h3 class="shelf-title">${title}</h3></div>
      <div class="shelf-wrap">
        <button class="shelf-btn shelf-btn-left" onclick="app.scrollShelf('${id}',-1)">&#8249;</button>
        <div class="shelf-scroll" id="${id}">${cardHtmls.join('')}</div>
        <button class="shelf-btn shelf-btn-right" onclick="app.scrollShelf('${id}',1)">&#8250;</button>
      </div>
    </section>`;
  }

  scrollShelf(id, dir) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollBy({ left: dir * 300, behavior: 'smooth' });
  }

  // Hide shelf arrows when content doesn't overflow
  _updateShelfArrows() {
    document.querySelectorAll('.shelf-wrap').forEach(wrap => {
      const scroll = wrap.querySelector('.shelf-scroll');
      if (!scroll) return;
      const overflows = scroll.scrollWidth > scroll.clientWidth + 10;
      wrap.classList.toggle('no-scroll', !overflows);
    });
  }

  cardHtml(block, hero = false) {
    const chLabel = block._chapterTitle || this.getChapterLabel(block);
    const isRead = this.user.readBlocks.has(block.id);
    const badge = block.type === 'depth' ? `<span class="card-badge ${block.voice}">${CONFIG.voices[block.voice]?.label || block.voice}</span>` :
                  block.type === 'sidebar' ? '<span class="card-badge sidebar">Story</span>' : '';
    const teaser = block.teaser ? `<div class="card-teaser">${block.teaser}</div>` : '';

    // Visual preview strip: detect content type from body
    const fullBlock = this.findBlock(block.id);
    const body = fullBlock?.body || block.body || '';
    const hasMath = /\$\$/.test(body);
    const hasTable = /^\|/m.test(body);
    const hasDiagram = !!block.diagram;
    const hasCode = /```/.test(body);

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
    const borderStyle = block.type === 'depth' && block.voice ? `border-top: 3px solid var(--${block.voice})` :
                        block.type === 'sidebar' ? 'border-top: 3px solid var(--sidebar-color)' : '';

    // Topic tags
    const topics = (this.blockTopics[block.id] || []).slice(0, 2);
    const topicHtml = topics.length ? `<div class="card-topics">${topics.map(t => `<span class="card-topic" onclick="event.stopPropagation();app.showTopic('${t}')">${t}</span>`).join('')}</div>` : '';

    return `<div class="card ${hero ? 'card-hero' : ''} ${isRead ? 'card-read' : ''}" style="${borderStyle}" onclick="app.openBlock('${block.id}')">
      ${preview}
      <div class="card-chapter">${chLabel}</div>
      <div class="card-title">${block.title}</div>
      ${teaser}
      ${topicHtml}
      <div class="card-meta">${badge}<span class="card-time">${block.readingTime || 3} min</span></div>
    </div>`;
  }

  cardFromRec(rec) {
    const block = this.findBlock(rec.id);
    if (block) return this.cardHtml(block.meta);
    const v = rec.values || {};
    return `<div class="card" onclick="app.openBlock('${rec.id}')"><div class="card-title">${v.title || rec.id}</div><div class="card-meta"><span class="card-time">${v.readingTime || 3} min</span></div></div>`;
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

    // Render math, context panel, observe blocks
    this.renderMath();
    this.renderContext(ch, idx);
    this._observeBlocks(ch);
    this.updateLinearNav();
  }

  async _renderChapterContent(ch, idx) {
    const visibleVoices = this.user.getVisibleVoices();
    const depths = ch.blocks.filter(b => b.type === 'depth');
    const sidebars = ch.blocks.filter(b => b.type === 'sidebar');

    let html = `<div class="ch-head fade-up" id="ch-head-${idx}"><div class="ch-label">Chapter ${ch.number}</div><h2>${ch.title}</h2><div class="ch-sub">${ch.subtitle}</div></div>`;

    for (const block of ch.blocks) {
      if (block.type === 'spine') {
        html += await this.renderSpine(block);
        const blockDepths = depths.filter(d => d.parent === block.id && visibleVoices.includes(d.voice));
        if (blockDepths.length) html += this.renderDepthGroup(blockDepths, block.id);
        sidebars.filter(s => s.parent === block.id).forEach(s => { html += this.renderSidebar(s); });
      } else if (block.type === 'question') {
        html += this.renderQuestion(block);
      } else if (block.type === 'sidebar' && !block.parent) {
        html += this.renderSidebar(block);
      }
    }
    return html;
  }

  _setupInfiniteScroll(pane, startIdx) {
    if (this._scrollHandler) window.removeEventListener('scroll', this._scrollHandler);
    this._isLoadingMore = false;

    this._scrollHandler = async () => {
      if (this._isLoadingMore || this.currentView !== 'read') return;
      // Check if near bottom (within 600px)
      const scrollBottom = window.innerHeight + window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      if (scrollBottom < docHeight - 600) return;

      this._isLoadingMore = true;

      // Ask Recombee what chapter/block to show next
      const nextChIdx = await this._getNextChapter();
      if (nextChIdx !== null && !this._loadedChapters.has(nextChIdx)) {
        const nextCh = this.chapters[nextChIdx];
        if (nextCh) {
          this._loadedChapters.add(nextChIdx);
          const html = await this._renderChapterContent(nextCh, nextChIdx);
          pane.insertAdjacentHTML('beforeend', '<hr style="margin:2em 0;border:none;border-top:2px solid var(--border)">');
          pane.insertAdjacentHTML('beforeend', html);
          this.renderMath();
          this._observeBlocks(nextCh);
          this.user.currentChapter = nextChIdx;
          this.user.save();
          this.updateLinearNav();
        }
      }
      this._isLoadingMore = false;
    };

    window.addEventListener('scroll', this._scrollHandler, { passive: true });
  }

  async _getNextChapter() {
    // Try Recombee first — ask for next recommended spine block
    if (this.rc.enabled) {
      const readIds = [...this.user.readBlocks].join(',');
      const result = await this.rc.getRecsForUser('pbook:next-read', 1,
        this.rc.reql({ type: 'spine' }));
      if (result?.recomms?.length) {
        const recId = result.recomms[0].id;
        const block = this.findBlock(recId);
        if (block) return block.meta._chapterIdx;
      }
    }
    // Fallback: next chapter in sequence that hasn't been loaded
    const loaded = this._loadedChapters || new Set();
    for (let i = 0; i < this.book.chapters.length; i++) {
      if (!loaded.has(i)) return i;
    }
    return null;
  }

  // (moved inline to renderRead)

  _observeBlocks(ch) {
    // Dwell-time tracking: seen after 3s visible, read after estimated reading time
    if (this._observer) this._observer.disconnect();
    if (this._dwellTimers) Object.values(this._dwellTimers).forEach(t => clearInterval(t));
    this._dwellTimers = {};

    this._observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const id = e.target.id?.replace('b-', '');
        if (!id) return;

        if (e.isIntersecting) {
          // Start dwell timer
          const block = ch.blocks.find(b => b.id === id);
          const readTimeMs = Math.min(((block?.readingTime || 3) * 60 * 1000) * 0.25, 30000); // 25% of estimated, max 30s
          const startTime = Date.now();

          this._dwellTimers[id] = setInterval(() => {
            const elapsed = Date.now() - startTime;

            // After 3s: mark as "seen" + update sidebar context
            if (elapsed >= 3000 && !this.user.seenBlocks.has(id)) {
              this.user.trackSeen(id);
              this.rc.sendView(id, Math.round(elapsed / 1000));
              e.target.querySelector('.block-status')?.classList.add('seen');
              this._lastVisibleBlock = id;
              this.updateContext(id);
            }

            // After reading time: mark as "read"
            if (elapsed >= readTimeMs && !this.user.readBlocks.has(id)) {
              this.user.trackRead(id);
              this.rc.sendView(id, Math.round(elapsed / 1000));
              e.target.querySelector('.block-status')?.classList.remove('seen');
              e.target.querySelector('.block-status')?.classList.add('read');
              this.updateContext(id);
              this._updateInlineReadNext(id, ch);
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
    }, { threshold: 0.3 });

    document.querySelectorAll('.block-article').forEach(el => this._observer.observe(el));
  }

  async renderSpine(block) {
    const bodyHtml = renderMarkdown(block.body);
    let diagramHtml = '';
    if (block.diagram) { const svg = await getDiagram(block.diagram); diagramHtml = `<div class="diagram-wrap">${svg}</div>`; }
    const isRead = this.user.readBlocks.has(block.id);
    const savedNote = this.getNote(block.id);
    const noteHtml = savedNote ? `<div class="block-note-display"><span class="note-icon">&#128221;</span><span>${this.escHtml(savedNote)}</span><button class="note-edit" onclick="app.editNote('${block.id}')">edit</button></div>` : '';

    return `<article class="block-article fade-up" id="b-${block.id}">
      <div class="block-header">
        <div class="block-status ${isRead ? 'read' : ''}"></div>
        <h3>${block.title}</h3>
        <div class="block-meta">
          <span>${block.readingTime || 3} min read</span>
          ${block.standalone ? '<span class="meta-standalone">Standalone</span>' : ''}
        </div>
      </div>
      ${diagramHtml}
      <div class="spine-body">${bodyHtml}</div>
      ${noteHtml}
      <div class="block-footer">
        <div class="block-reactions" data-block="${block.id}">
          <button class="like-btn ${this.user.ratings.get(block.id)>=0.7?'liked':''}" onclick="app.toggleLike('${block.id}')">
            ${this.user.ratings.get(block.id)>=0.7?'&#10084;&#65039;':'&#9825;'}
            <span>${this.user.ratings.get(block.id)>=0.7?'Liked':'Like'}</span>
          </button>
        </div>
        <div class="block-actions">
          <button class="act-btn" onclick="app.toggleNote('${block.id}')" title="Add note">&#128221;</button>
          <button class="act-btn ${this.user.savedBlocks.has(block.id)?'active':''}" onclick="app.saveBlock('${block.id}')" title="Save">&#128278;</button>
          <button class="act-btn flag-btn" onclick="app.flagBlock('${block.id}')" title="Suggest edit to author">&#9873;</button>
        </div>
      </div>
      <div class="note-editor" id="note-${block.id}" style="display:none">
        <textarea placeholder="Your private note on this section..." id="note-text-${block.id}">${this.escHtml(savedNote || '')}</textarea>
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

  // Notes system
  getNote(blockId) {
    try { const notes = JSON.parse(localStorage.getItem('pbook-notes') || '{}'); return notes[blockId] || ''; } catch(e) { return ''; }
  }
  toggleNote(blockId) {
    const ed = document.getElementById(`note-${blockId}`);
    if (!ed) return;
    const visible = ed.style.display !== 'none';
    ed.style.display = visible ? 'none' : 'block';
    if (!visible) ed.querySelector('textarea')?.focus();
  }
  editNote(blockId) { this.toggleNote(blockId); }
  saveNote(blockId) {
    const text = document.getElementById(`note-text-${blockId}`)?.value?.trim() || '';
    try {
      const notes = JSON.parse(localStorage.getItem('pbook-notes') || '{}');
      if (text) { notes[blockId] = text; this.user.trackNote(blockId); }
      else delete notes[blockId];
      localStorage.setItem('pbook-notes', JSON.stringify(notes));
    } catch(e) {}
    this.toggleNote(blockId);
    // Re-render note display
    const article = document.getElementById(`b-${blockId}`);
    const existing = article?.querySelector('.block-note-display');
    if (text && !existing) {
      const div = document.createElement('div');
      div.className = 'block-note-display';
      div.innerHTML = `<span class="note-icon">&#128221;</span><span>${this.escHtml(text)}</span><button class="note-edit" onclick="app.editNote('${blockId}')">edit</button>`;
      article?.querySelector('.block-footer')?.before(div);
    } else if (existing) {
      if (text) existing.querySelector('span:last-of-type').textContent = text;
      else existing.remove();
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
    this.flagBlock(blockId); // close form
    // Show confirmation
    const form = document.getElementById(`flag-${blockId}`);
    if (form) {
      form.style.display = 'block';
      form.innerHTML = '<div style="padding:.8em;color:var(--product);font-size:.85rem">Thanks! Your feedback has been recorded for the author.</div>';
      setTimeout(() => { form.style.display = 'none'; }, 2000);
    }
  }

  escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  highlightSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    try {
      const range = sel.getRangeAt(0);
      const mark = document.createElement('mark');
      mark.className = 'user-highlight';
      range.surroundContents(mark);
      // Find which block this is in
      const article = mark.closest('.block-article');
      const blockId = article?.id?.replace('b-', '');
      if (blockId) {
        this._saveHighlight(blockId, sel.toString());
        this.rc.sendRating(blockId, 0.8); // highlight = strong positive signal
      }
    } catch (e) { /* selection spans elements */ }
    sel.removeAllRanges();
    document.getElementById('highlightPopup').style.display = 'none';
  }

  highlightAndNote() {
    const sel = window.getSelection();
    const text = sel?.toString() || '';
    this.highlightSelection();
    // Find the block and open note with pre-filled highlight
    const mark = document.querySelector('.user-highlight:last-of-type');
    const article = mark?.closest('.block-article');
    const blockId = article?.id?.replace('b-', '');
    if (blockId) {
      this.toggleNote(blockId);
      const textarea = document.getElementById(`note-text-${blockId}`);
      if (textarea && !textarea.value) textarea.value = `"${text}" — `;
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

  renderDepthGroup(depths, parentId) {
    const topVoice = this.user.getTopVoice();
    const tabsHtml = depths.map(d => {
      const vc = CONFIG.voices[d.voice] || {};
      const isDefault = d.voice === topVoice;
      return `<button class="d-tab ${d.voice} ${isDefault ? 'active' : ''}" data-voice="${d.voice}" onclick="app.toggleDepth('${d.id}','${parentId}','${d.voice}')"> ${vc.icon || ''} ${vc.label || d.voice} <span class="t-time">${d.readingTime || 3}m</span></button>`;
    }).join('');
    const cardsHtml = depths.map(d => {
      const vc = CONFIG.voices[d.voice] || {};
      const isDefault = d.voice === topVoice;
      return `<div class="d-content ${d.voice} ${isDefault ? 'active' : ''}" id="dc-${d.id}"><span class="vlabel">${vc.label || d.voice} perspective</span><h4>${d.title}</h4>${renderMarkdown(d.body)}</div>`;
    }).join('');
    // Auto-track if default voice is expanded
    if (topVoice) {
      const autoBlock = depths.find(d => d.voice === topVoice);
      if (autoBlock) setTimeout(() => this.rc.sendView(autoBlock.id), 100);
    }
    return `<div class="depth-group" data-parent="${parentId}"><div class="depth-tabs">${tabsHtml}</div>${cardsHtml}</div>`;
  }

  renderSidebar(block) {
    return `<div class="sb-block fade-up"><div class="sb-label">&#9670; Sidebar</div><h4>${block.title}</h4>${renderMarkdown(block.body)}</div>`;
  }

  renderQuestion(block) {
    if (!block.options || !Array.isArray(block.options)) return '';
    const opts = block.options.map(o => `<button class="q-opt" onclick="app.answerQ(this,'${o.voice || 'universal'}','${block.id}')"><span class="q-letter">${o.letter}</span><span>${o.text}</span></button>`).join('');
    return `<div class="q-block fade-up"><h4>${block.title}</h4><div class="q-desc">${block.description || ''}</div><div class="q-opts">${opts}</div></div>`;
  }

  // Inline "read next" below each article — shown after block is read
  renderReadNext(blockId, ch) {
    const spines = ch.blocks.filter(b => b.type === 'spine');
    const currentIdx = spines.findIndex(b => b.id === blockId);
    const nextInChapter = spines[currentIdx + 1];
    // Also find a related block from another chapter
    const otherChapterBlock = this.allBlocks.find(b =>
      b._chapter !== ch.id && b.meta.type === 'spine' && !this.user.readBlocks.has(b.meta.id)
    );

    let items = '';
    if (nextInChapter) {
      items += `<div class="rn-item" onclick="app.openBlock('${nextInChapter.id}')"><span class="rn-label">Next in chapter</span><span class="rn-title">${nextInChapter.title}</span><span class="rn-time">${nextInChapter.readingTime || 3}m</span></div>`;
    }
    if (otherChapterBlock) {
      items += `<div class="rn-item" onclick="app.openBlock('${otherChapterBlock.meta.id}')"><span class="rn-label">From Ch${otherChapterBlock.meta._chapterNum}</span><span class="rn-title">${otherChapterBlock.meta.title}</span><span class="rn-time">${otherChapterBlock.meta.readingTime || 3}m</span></div>`;
    }
    if (!items) return '';
    return `<div class="read-next" id="rn-${blockId}">${items}</div>`;
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

  renderChapterNav(idx) {
    const prev = idx > 0 ? this.book.chapters[idx - 1] : null;
    const next = idx < this.book.chapters.length - 1 ? this.book.chapters[idx + 1] : null;
    return `<div class="ch-nav"><button class="ch-nav-btn ${prev ? '' : 'disabled'}" onclick="${prev ? `app.goChapter(${idx - 1})` : ''}"><span class="nl">&larr; Previous</span>${prev ? `${prev.number}. ${prev.title}` : ''}</button><button class="ch-nav-btn ${next ? '' : 'disabled'}" onclick="${next ? `app.goChapter(${idx + 1})` : ''}"><span class="nl">Next &rarr;</span>${next ? `${next.number}. ${next.title}` : ''}</button></div>`;
  }

  renderContext(ch, idx) {
    this._ctxChapter = ch;
    this._ctxIdx = idx;
    this.updateContext();
  }

  updateContext(currentBlockId) {
    const ch = this._ctxChapter;
    if (!ch) return;

    const show = (id, html) => { const el = document.getElementById(id); if (el) { el.innerHTML = html; el.style.display = 'block'; }};
    const hide = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };

    // 1. Current block metadata
    const currentBlock = currentBlockId ? ch.blocks.find(b => b.id === currentBlockId) : ch.blocks.find(b => b.type === 'spine');
    if (currentBlock) {
      const topics = (this.blockTopics[currentBlock.id] || []).slice(0, 4);
      const sig = this.user.getBlockSignals(currentBlock.id);
      const depthCards = ch.blocks.filter(b => b.type === 'depth' && b.parent === currentBlock.id);
      const sidebarCards = ch.blocks.filter(b => b.type === 'sidebar' && b.parent === currentBlock.id);

      let meta = `<h4>Current section</h4>`;
      meta += `<div class="ctx-current-title">${currentBlock.title}</div>`;
      meta += `<div class="ctx-meta-row"><span>Ch${ch.number}</span><span>${currentBlock.readingTime || 3} min</span>`;
      if (sig.dwellMs > 1000) meta += `<span>&#9201; ${Math.round(sig.dwellMs/1000)}s read</span>`;
      meta += `</div>`;
      if (topics.length) meta += `<div class="ctx-topics">${topics.map(t => `<span class="ctx-topic" onclick="app.showTopic('${t}')">${t}</span>`).join('')}</div>`;
      if (depthCards.length) meta += `<div class="ctx-depths"><span class="ctx-depths-label">Deep dives:</span>${depthCards.map(d => `<span class="ctx-depth-badge ${d.voice}">${CONFIG.voices[d.voice]?.label || d.voice}</span>`).join('')}</div>`;
      show('ctxMeta', meta);
    }

    // 2. Up next
    const nextBlock = this.getContinueBlock();
    if (nextBlock) {
      show('ctxNext', `<h4>Up next</h4><div class="ctx-next" onclick="app.openBlock('${nextBlock.id}')"><span class="ctx-next-label">Continue</span><span>${nextBlock.title}</span></div>`);
    } else hide('ctxNext');

    // 3. Related
    const pool = this.allBlocks.filter(b => b._chapter !== ch.id && b.meta.type === 'spine');
    const unread = pool.filter(b => !this.user.readBlocks.has(b.meta.id));
    const related = (unread.length >= 4 ? unread : [...unread, ...pool]).sort(() => Math.random() - 0.5).slice(0, 4);
    show('ctxRelated', `<h4>Related</h4>${related.map(b =>
      `<div class="ctx-item" onclick="app.openBlock('${b.meta.id}')"><span>Ch${b.meta._chapterNum}: ${b.meta.title}</span></div>`
    ).join('')}`);

    // 4. Quiz / comprehension check
    if (currentBlock) {
      const quiz = this._generateQuiz(currentBlock);
      if (quiz) show('ctxQuiz', quiz);
      else hide('ctxQuiz');
    }

    // 5. Chat
    const ctxChat = document.getElementById('ctxChat');
    if (ctxChat && !ctxChat.dataset.init) {
      ctxChat.dataset.init = '1';
      ctxChat.style.display = 'block';
      ctxChat.innerHTML = `<h4>&#128172; Ask about this</h4>
        <div class="ctx-chat-messages" id="chatMessages"><div class="chat-msg bot" style="font-size:.75rem">Ask me anything about what you're reading.</div></div>
        <div class="ctx-chat-input">
          <input type="text" id="chatInput" placeholder="Ask a question..." onkeydown="if(event.key==='Enter')app.sendChat()">
          <button onclick="app.sendChat()">&#10148;</button>
        </div>`;
    }
  }

  _generateQuiz(block) {
    // Generate a comprehension question based on the block content
    const body = (block.body || '').toLowerCase();
    const title = block.title || '';

    // Simple quiz templates based on content keywords
    const quizzes = [];
    if (body.includes('collaborative filter')) quizzes.push({ q: 'What is the core assumption behind collaborative filtering?', a: 'People who agreed in the past will agree in the future.' });
    if (body.includes('cold start') || body.includes('cold-start')) quizzes.push({ q: 'What is the cold start problem in recommendation?', a: 'New users or items have no interaction history, making personalization difficult.' });
    if (body.includes('a/b test')) quizzes.push({ q: 'Why is A/B testing the gold standard for evaluating recommenders?', a: 'It measures real user outcomes, not just offline proxies.' });
    if (body.includes('diversity') && body.includes('relevance')) quizzes.push({ q: 'Why can maximizing relevance alone be harmful?', a: 'It creates filter bubbles — users only see familiar content and never discover new things.' });
    if (body.includes('matrix factor')) quizzes.push({ q: 'What does matrix factorization discover?', a: 'Hidden "taste dimensions" — latent factors that capture user preferences and item characteristics.' });
    if (body.includes('adtech') || body.includes('targeted ad')) quizzes.push({ q: 'How do recommender systems differ from targeted advertising?', a: 'Recommenders use on-site behavior only. AdTech tracks users across the entire web.' });
    if (body.includes('objective') && body.includes('metric')) quizzes.push({ q: 'Why is choosing the right objective critical?', a: 'The objectives you set shape the product users experience. Wrong objectives create wrong behavior.' });
    if (body.includes('scenario') && body.includes('homepage')) quizzes.push({ q: 'Why do different scenarios need different optimization?', a: 'User intent differs: browsing (homepage) vs searching (query) vs checkout have different expectations.' });
    if (body.includes('engagement') && body.includes('retention')) quizzes.push({ q: 'Can higher engagement lead to worse outcomes?', a: 'Yes — clickbait increases CTR but destroys long-term retention and trust.' });
    if (body.includes('recombee') && body.includes('logic')) quizzes.push({ q: 'What are Recombee Logics?', a: 'Pre-configured recommendation algorithms/ensembles (e.g., recombee:personal, recombee:similar-items).' });

    if (quizzes.length === 0) return null;
    const quiz = quizzes[Math.floor(Math.random() * quizzes.length)];
    return `<h4>&#129504; Check yourself</h4>
      <div class="ctx-quiz">
        <div class="ctx-quiz-q">${quiz.q}</div>
        <button class="ctx-quiz-reveal" onclick="this.nextElementSibling.style.display='block';this.style.display='none'">Show answer</button>
        <div class="ctx-quiz-a" style="display:none">${quiz.a}</div>
      </div>`;
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
  renderMap() {
    const el = document.getElementById('mapContent');
    const prog = this.user.getProgress(this.allBlocks);
    const visibleVoices = this.user.getVisibleVoices();
    const mapMode = this._mapMode || 'visual';

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
      </div>
      <button class="map-reset-btn" onclick="app.resetAll()">Reset progress</button>
    </div>`;

    if (mapMode === 'visual') {
      html += this.renderVisualMap(visibleVoices);
      el.innerHTML = html;
      return;
    }

    // List mode legend
    html += `<div class="map-legend">
      <span class="ml-item"><svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#059669"/></svg> Read</span>
      <span class="ml-item"><svg width="14" height="14"><circle cx="7" cy="7" r="4" fill="#D97706" stroke="#D97706" stroke-width="3" opacity=".3"/><circle cx="7" cy="7" r="4" fill="#D97706"/></svg> Next</span>
      <span class="ml-item"><svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#E7E5E4"/></svg> Unread</span>
      <span class="ml-item"><svg width="10" height="10"><circle cx="5" cy="5" r="3.5" fill="none" stroke="#57534E" stroke-width="1.5"/></svg> Depth</span>
    </div>`;

    // Chapter reading order — which chapters should come before which
    const chapterPrereqs = {
      0: [],           // Ch1 Introduction — start here
      1: [0],          // Ch2 Data — read after Intro
      2: [0, 1],       // Ch3 Objectives — read after Intro + Data
      3: [2],          // Ch4 Scenarios — read after Objectives
      4: [2, 3],       // Ch5 Tasks — read after Objectives + Scenarios
      5: [4],          // Ch6 Algorithms — read after Tasks
      6: [2, 5]        // Ch7 Evaluation — read after Objectives + Algorithms
    };

    // Find suggested next block
    const suggestedNext = this.getSuggestedNext(chapterPrereqs);

    this.book.chapters.forEach((ch, ci) => {
      const blocks = this.chapters[ci]?.blocks || [];
      const spines = blocks.filter(b => b.type === 'spine');
      const depths = blocks.filter(b => b.type === 'depth');
      const sidebars = blocks.filter(b => b.type === 'sidebar');
      const readCount = spines.filter(b => this.user.readBlocks.has(b.id)).length;
      const totalCount = spines.length;
      const chPct = Math.round((readCount / Math.max(totalCount, 1)) * 100);

      // Check if prerequisites are met
      const prereqs = chapterPrereqs[ci] || [];
      const prereqsMet = prereqs.every(pi => {
        const pSpines = (this.chapters[pi]?.blocks || []).filter(b => b.type === 'spine');
        const pRead = pSpines.filter(b => this.user.readBlocks.has(b.id)).length;
        return pRead >= Math.ceil(pSpines.length * 0.5); // At least 50% read
      });
      const prereqLabels = prereqs.map(pi => `Ch${this.book.chapters[pi].number}`).join(', ');
      const isLocked = !prereqsMet && prereqs.length > 0 && readCount === 0;

      html += `<div class="map-chapter ${isLocked ? 'map-ch-locked' : ''} fade-up">`;

      // Chapter header with progress ring
      html += `<div class="map-ch-head" onclick="app.goChapter(${ci})">
        <div class="map-ch-ring" data-pct="${chPct}">
          <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="none" stroke="var(--border)" stroke-width="2.5"/>
          <circle cx="18" cy="18" r="16" fill="none" stroke="${chPct === 100 ? 'var(--product)' : 'var(--accent)'}" stroke-width="2.5" stroke-dasharray="${chPct} ${100 - chPct}" stroke-dashoffset="25" stroke-linecap="round"/></svg>
          <span class="map-ch-num">${ch.number}</span>
        </div>
        <div class="map-ch-info">
          <div class="map-ch-title">${ch.title}</div>
          <div class="map-ch-sub">${ch.subtitle}</div>
          <div class="map-ch-stats">${readCount}/${totalCount} sections${isLocked ? ` &middot; <span class="map-prereq">Read ${prereqLabels} first</span>` : ''}</div>
        </div>
        <div class="map-ch-arrow">&rsaquo;</div>
      </div>`;

      // Spine blocks with their depth cards + signals
      html += '<div class="map-blocks">';
      spines.forEach((spine, si) => {
        const isRead = this.user.readBlocks.has(spine.id);
        const isSeen = this.user.seenBlocks.has(spine.id);
        const isSuggested = suggestedNext === spine.id;
        const sig = this.user.getBlockSignals(spine.id);
        const spineDepths = depths.filter(d => d.parent === spine.id);
        const spineDepthsVisible = spineDepths.filter(d => visibleVoices.includes(d.voice));
        const spineSidebars = sidebars.filter(s => s.parent === spine.id);
        const hasChildren = spineDepthsVisible.length > 0 || spineSidebars.length > 0;

        // Signal icons for this block
        const signals = this._signalIcons(sig, spine.id);

        html += `<div class="map-spine-group">
          <div class="map-block map-spine ${isRead ? 'read' : isSeen ? 'seen' : ''} ${isSuggested ? 'suggested' : ''}" onclick="app.openBlock('${spine.id}')">
            <div class="map-dot ${isRead ? 'done' : isSeen ? 'seen-dot' : ''} ${isSuggested ? 'next' : ''}"></div>
            <span class="map-block-title">${spine.title}</span>
            <span class="map-signals">${signals}</span>
            <span class="map-block-time">${spine.readingTime || 3}m</span>
          </div>`;

        // Depth cards + sidebars
        if (hasChildren) {
          html += '<div class="map-children">';
          spineDepthsVisible.forEach(d => {
            const dRead = this.user.readBlocks.has(d.id);
            const dSeen = this.user.seenBlocks.has(d.id);
            const dSig = this.user.getBlockSignals(d.id);
            const vc = CONFIG.voices[d.voice] || {};
            const dSignals = this._signalIcons(dSig, d.id);
            html += `<div class="map-block map-depth ${dRead ? 'read' : dSeen ? 'seen' : ''}" onclick="app.openBlock('${d.parent}')">
              <div class="map-dot depth-dot" style="border-color:var(--${d.voice})"></div>
              <span class="map-block-title">${d.title}</span>
              <span class="map-signals">${dSignals}</span>
              <span class="map-voice-tag ${d.voice}">${vc.label || d.voice}</span>
            </div>`;
          });
          spineSidebars.forEach(s => {
            const sSig = this.user.getBlockSignals(s.id);
            const sSignals = this._signalIcons(sSig, s.id);
            html += `<div class="map-block map-depth" onclick="app.openBlock('${s.parent}')">
              <div class="map-dot depth-dot" style="border-color:var(--sidebar-color)"></div>
              <span class="map-block-title">${s.title}</span>
              <span class="map-signals">${sSignals}</span>
              <span class="map-voice-tag" style="background:var(--sidebar-color)">Story</span>
            </div>`;
          });
          html += '</div>';
        }
        html += '</div>';
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

  _signalIcons(sig) {
    if (!sig || Object.keys(sig).length === 0) return '';
    const icons = [];
    if (sig.read) icons.push('<span class="sig-icon sig-read" title="Read">&#10003;</span>');
    else if (sig.seen) icons.push('<span class="sig-icon sig-seen" title="Seen">&#128065;</span>');
    if (sig.dwellMs > 5000) icons.push(`<span class="sig-icon sig-dwell" title="Dwell ${Math.round(sig.dwellMs/1000)}s">${Math.round(sig.dwellMs/1000)}s</span>`);
    if (sig.rated !== undefined) icons.push(sig.rated >= 0.7 ? '<span class="sig-icon sig-liked" title="Liked">&#128293;</span>' : '<span class="sig-icon sig-meh" title="Rated">&#128164;</span>');
    if (sig.saved) icons.push('<span class="sig-icon sig-saved" title="Saved">&#128278;</span>');
    if (sig.expanded) icons.push('<span class="sig-icon sig-exp" title="Expanded">&#128295;</span>');
    if (sig.noted) icons.push('<span class="sig-icon sig-note" title="Note">&#128221;</span>');
    return icons.join('');
  }

  // Show item detail inspector in map (clicked block)
  showItemDetail(blockId) {
    const block = this.findBlock(blockId);
    if (!block) return;
    const b = block.meta;
    const sig = this.user.getBlockSignals(blockId);
    const note = this.getNote(blockId);
    const isRead = this.user.readBlocks.has(blockId);
    const isSeen = this.user.seenBlocks.has(blockId);
    const isSaved = this.user.savedBlocks.has(blockId);
    const rating = this.user.ratings.get(blockId);

    const detail = document.getElementById('vmapDetail');
    if (!detail) return;

    // Build signal table
    const rows = [];
    rows.push(tr('Item ID', `<code>${blockId}</code>`));
    rows.push(tr('Type', badge(b.type, b.type === 'depth' ? b.voice : b.type)));
    rows.push(tr('Chapter', `${b._chapterNum}. ${b._chapterTitle}`));
    if (b.voice && b.voice !== 'universal') rows.push(tr('Voice', `<span class="cl-voice" style="background:var(--${b.voice})">${b.voice}</span>`));
    rows.push(tr('Reading time', `${b.readingTime || 3} min`));

    // Engagement signals
    rows.push(trHead('Collected Signals'));
    rows.push(tr('Status', isRead ? '<span style="color:var(--product);font-weight:600">&#10003; Read</span>' : isSeen ? '<span style="color:#fbbf24;font-weight:600">&#128065; Seen</span>' : '<span style="color:var(--text-3)">Not visited</span>'));
    rows.push(tr('Dwell time', sig.dwellMs ? `${Math.round(sig.dwellMs/1000)}s` : '—'));
    rows.push(tr('First seen', sig.seenAt ? new Date(sig.seenAt).toLocaleString() : '—'));
    rows.push(tr('Scroll portion', sig.portion ? `${Math.round((sig.portion||0)*100)}%` : '—'));
    rows.push(tr('Rating', rating !== undefined ? (rating >= 0.7 ? '&#128293; Great' : rating >= 0.4 ? '&#128161; Useful' : '&#128164; Known') : '—'));
    rows.push(tr('Saved', isSaved ? '&#128278; Yes' : '—'));
    rows.push(tr('Depth expanded', sig.expanded ? '&#128295; Yes' : '—'));
    rows.push(tr('Personal note', note ? `"${this.escHtml(note.substring(0,80))}${note.length>80?'...':''}"` : '—'));

    // Recombee signals
    rows.push(trHead('Sent to Recombee'));
    const rcSent = this.rc.interactions.filter(i => i.itemId === blockId);
    if (rcSent.length) {
      rcSent.forEach(i => {
        rows.push(tr(i.type, `${new Date(i.ts).toLocaleTimeString()}${i.duration ? ' ('+i.duration+'s)' : ''}`));
      });
    } else {
      rows.push(tr('—', 'No interactions sent yet'));
    }

    detail.innerHTML = `
      <div class="item-detail fade-up">
        <div class="id-head">
          <h3>${b.title}</h3>
          <button onclick="app.openBlock('${blockId}')" class="id-read-btn">Read this &rarr;</button>
        </div>
        <div class="id-teaser">${b.teaser || ''}</div>
        <table class="id-table">${rows.join('')}</table>
        <div class="id-actions">
          <button onclick="app.openBlock('${blockId}')">Open in reader</button>
          <button onclick="document.getElementById('vmapDetail').innerHTML=''">Close</button>
        </div>
      </div>`;

    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    function tr(label, value) { return `<tr><td class="id-label">${label}</td><td class="id-value">${value}</td></tr>`; }
    function trHead(text) { return `<tr><td colspan="2" class="id-section">${text}</td></tr>`; }
    function badge(type, sub) {
      const colors = { spine: 'var(--text-3)', engineer: 'var(--engineer)', product: 'var(--product)', business: 'var(--business)', sidebar: 'var(--sidebar-color)' };
      return `<span style="background:${colors[sub]||colors[type]||'var(--text-3)'};color:#fff;padding:.1em .4em;border-radius:3px;font-size:.65rem;font-weight:600">${type}${sub !== type ? ' / '+sub : ''}</span>`;
    }
  }

  // ===== VISUAL RPG MAP =====
  renderVisualMap(visibleVoices) {
    const chapterPrereqs = { 0:[], 1:[0], 2:[0,1], 3:[2], 4:[2,3], 5:[4], 6:[2,5] };
    const suggestedNext = this.getSuggestedNext(chapterPrereqs);

    // Layout: position chapters on a grid
    const layout = [
      { ci: 0, x: 50,  y: 60,  label: 'Intro' },
      { ci: 1, x: 220, y: 30,  label: 'Data' },
      { ci: 2, x: 220, y: 100, label: 'Objectives' },
      { ci: 3, x: 390, y: 100, label: 'Scenarios' },
      { ci: 4, x: 500, y: 60,  label: 'Tasks' },
      { ci: 5, x: 620, y: 30,  label: 'Algorithms' },
      { ci: 6, x: 620, y: 100, label: 'Evaluation' },
    ];

    // Connections (prerequisite arrows)
    const connections = [
      [0, 1], [0, 2], [2, 3], [2, 4], [3, 4], [4, 5], [2, 6], [5, 6]
    ];

    // Compute stats per chapter
    const chData = layout.map(l => {
      const blocks = this.chapters[l.ci]?.blocks || [];
      const spines = blocks.filter(b => b.type === 'spine');
      const depths = blocks.filter(b => b.type === 'depth');
      const readSpines = spines.filter(b => this.user.readBlocks.has(b.id)).length;
      const total = spines.length;
      const pct = Math.round((readSpines / Math.max(total, 1)) * 100);
      const hasNext = spines.some(b => b.id === suggestedNext);
      const depthCount = depths.filter(d => visibleVoices.includes(d.voice)).length;
      const savedCount = spines.filter(b => this.user.savedBlocks.has(b.id)).length;
      const ratedCount = spines.filter(b => this.user.ratings.has(b.id) && this.user.ratings.get(b.id) >= 0.7).length;
      return { ...l, spines, depths, readSpines, total, pct, hasNext, depthCount, savedCount, ratedCount };
    });

    const W = 740, H = 180;
    let svg = `<div class="visual-map-wrap"><svg viewBox="0 0 ${W} ${H}" class="visual-map">`;

    // Background grid pattern
    svg += `<defs>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--border)" stroke-width="0.3" opacity="0.5"/></pattern>
      <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#grid)" rx="12"/>`;

    // Draw connections first (behind nodes)
    connections.forEach(([from, to]) => {
      const a = chData[from], b = chData[to];
      const ax = a.x + 40, ay = a.y + 15;
      const bx = b.x, by = b.y + 15;
      // Curved path
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const color = a.pct >= 50 ? 'var(--product)' : 'var(--border)';
      const opacity = a.pct >= 50 ? '0.6' : '0.3';
      svg += `<path d="M${ax},${ay} Q${mx},${ay} ${bx},${by}" fill="none" stroke="${color}" stroke-width="2" opacity="${opacity}" stroke-dasharray="${a.pct >= 50 ? 'none' : '4 4'}"/>`;
    });

    // Draw chapter nodes
    chData.forEach(ch => {
      const nodeW = 110, nodeH = 50;
      const isComplete = ch.pct === 100;
      const isStarted = ch.readSpines > 0;
      const isNext = ch.hasNext;

      // Node background
      const fillColor = isComplete ? 'var(--product-bg)' : isStarted ? 'var(--accent-bg)' : 'var(--surface)';
      const strokeColor = isComplete ? 'var(--product)' : isNext ? 'var(--accent)' : 'var(--border)';
      const strokeW = isNext ? '2' : '1.5';

      svg += `<g class="map-node" onclick="app.goChapter(${ch.ci})" style="cursor:pointer">`;

      // Glow for suggested next
      if (isNext) {
        svg += `<rect x="${ch.x - 4}" y="${ch.y - 4}" width="${nodeW + 8}" height="${nodeH + 8}" rx="14" fill="var(--accent)" opacity="0.12"/>`;
      }

      // Main rect
      svg += `<rect x="${ch.x}" y="${ch.y}" width="${nodeW}" height="${nodeH}" rx="10" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeW}"/>`;

      // Chapter number badge
      const badgeColor = isComplete ? 'var(--product)' : 'var(--accent)';
      svg += `<circle cx="${ch.x + 14}" cy="${ch.y + 14}" r="9" fill="${badgeColor}"/>`;
      svg += `<text x="${ch.x + 14}" y="${ch.y + 18}" text-anchor="middle" font-family="system-ui" font-size="9" font-weight="700" fill="white">${this.book.chapters[ch.ci].number}</text>`;

      // Title
      svg += `<text x="${ch.x + 28}" y="${ch.y + 17}" font-family="system-ui" font-size="9.5" font-weight="700" fill="var(--text)">${ch.label}</text>`;

      // Progress bar inside node
      const barX = ch.x + 8, barY = ch.y + 28, barW = nodeW - 16, barH = 4;
      svg += `<rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="2" fill="var(--border)"/>`;
      svg += `<rect x="${barX}" y="${barY}" width="${barW * ch.pct / 100}" height="${barH}" rx="2" fill="${isComplete ? 'var(--product)' : 'var(--accent)'}"/>`;

      // Stats line
      svg += `<text x="${ch.x + 8}" y="${ch.y + 44}" font-family="system-ui" font-size="7.5" fill="var(--text-3)">${ch.readSpines}/${ch.total} spine`;
      if (ch.depthCount > 0) svg += ` · ${ch.depthCount} depth`;
      svg += `</text>`;

      // Icons for saved/liked
      let iconX = ch.x + nodeW - 8;
      if (ch.savedCount > 0) {
        svg += `<text x="${iconX}" y="${ch.y + 44}" text-anchor="end" font-size="8">&#128278;${ch.savedCount}</text>`;
        iconX -= 20;
      }
      if (ch.ratedCount > 0) {
        svg += `<text x="${iconX}" y="${ch.y + 44}" text-anchor="end" font-size="8">&#128293;${ch.ratedCount}</text>`;
      }

      svg += '</g>';
    });

    svg += '</svg>';

    // Legend below SVG
    svg += `<div class="vmap-legend">
      <span><svg width="12" height="12"><rect width="12" height="12" rx="3" fill="var(--product-bg)" stroke="var(--product)" stroke-width="1.5"/></svg> Complete</span>
      <span><svg width="16" height="16"><rect x="2" y="2" width="12" height="12" rx="3" fill="var(--accent-bg)" stroke="var(--accent)" stroke-width="2"/></svg> In progress / Next</span>
      <span><svg width="12" height="12"><rect width="12" height="12" rx="3" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/></svg> Not started</span>
      <span>&#128278; Saved</span>
      <span>&#128293; Liked</span>
      <span style="color:var(--text-3)">--- Prerequisites not met</span>
    </div>`;

    // Spine block detail below (expandable per chapter)
    svg += '<div class="vmap-detail" id="vmapDetail"></div>';
    svg += '</div>';
    return svg;
  }

  // ===== PROFILE VIEW =====
  renderProfile() {
    const el = document.getElementById('profileContent');
    const p = this.user.getProfile(this.allBlocks);
    const status = this.rc.getStatus();

    let h = '<h2 style="font-family:var(--font-ui);font-size:1.3rem;font-weight:800;margin-bottom:1em">Your Reader Profile</h2>';

    // Identity
    h += '<div class="profile-section"><h3>Identity</h3>';
    h += `<div class="stat-row"><span>Reader ID</span><span class="stat-val" style="font-size:.7rem;font-family:var(--font-mono)">${p.userId}</span></div>`;
    h += `<div class="stat-row"><span>First visit</span><span class="stat-val">${p.firstVisit || 'Today'}</span></div>`;
    h += `<div class="stat-row"><span>Sessions</span><span class="stat-val">${p.sessions}</span></div>`;
    h += `<div class="stat-row"><span>Recombee</span><span class="stat-val" style="color:${status.mode==='live'?'var(--product)':'var(--text-3)'}">${status.mode === 'live' ? 'Connected' : 'Local mode'}</span></div>`;
    h += '</div>';

    // Reading stats
    h += '<div class="profile-section"><h3>Reading Statistics</h3>';
    h += `<div class="stat-row"><span>Sections read</span><span class="stat-val">${p.progress.read} / ${p.progress.total}</span></div>`;
    h += `<div class="stat-row"><span>Sections seen</span><span class="stat-val">${p.progress.seen}</span></div>`;
    h += `<div class="stat-row"><span>Completion</span><span class="stat-val">${p.progress.pct}%</span></div>`;
    h += `<div class="stat-row"><span>Reading time</span><span class="stat-val">${p.readingTimeMin} min</span></div>`;
    h += `<div class="stat-row"><span>Total interactions</span><span class="stat-val">${p.totalInteractions}</span></div>`;
    h += `<div class="stat-row"><span>Ratings given</span><span class="stat-val">${p.signals.ratings}</span></div>`;
    h += `<div class="stat-row"><span>Items saved</span><span class="stat-val">${p.savedCount}</span></div>`;
    h += `<div class="stat-row"><span>Notes written</span><span class="stat-val">${p.notesCount}</span></div>`;
    h += '</div>';

    // Voice preference
    h += '<div class="profile-section"><h3>Your Perspective</h3>';
    ['engineer', 'product', 'business'].forEach(v => {
      const pct = p.voicePreference[v];
      const color = `var(--${v})`;
      h += `<div class="voice-bar"><span class="voice-bar-label" style="color:${color}">${CONFIG.voices[v]?.label || v}</span><div style="flex:1;height:6px;background:var(--border);border-radius:3px"><div class="voice-bar-fill" style="width:${pct}%;background:${color}"></div></div><span style="font-family:var(--font-ui);font-size:.72rem;color:var(--text-3);width:2.5em;text-align:right">${pct}%</span></div>`;
    });
    h += '<div style="font-size:.75rem;color:var(--text-3);margin-top:.5em">The book adapts which depth cards it shows based on your clicks.</div>';
    h += '</div>';

    // Top topics
    if (p.topTopics.length) {
      h += '<div class="profile-section"><h3>Your Top Topics</h3>';
      h += '<div style="display:flex;flex-wrap:wrap;gap:.3em">';
      p.topTopics.forEach(t => { h += `<span class="card-topic" onclick="app.showTopic('${t}')" style="font-size:.75rem;padding:.25em .6em">${t}</span>`; });
      h += '</div></div>';
    }

    // Liked blocks
    if (p.liked.length) {
      h += '<div class="profile-section"><h3>Liked Content</h3>';
      const likedIds = [...this.user.ratings].filter(([_, r]) => r >= 0.7).map(([id]) => id);
      likedIds.forEach(id => {
        const b = this.findBlock(id);
        if (b) h += `<div class="saved-item" onclick="app.openBlock('${id}')">&#10084; ${b.meta.title}</div>`;
      });
      h += '</div>';
    }

    // Saved blocks
    const saved = [...this.user.savedBlocks].map(id => this.findBlock(id)).filter(Boolean);
    if (saved.length) {
      h += '<div class="profile-section"><h3>Saved for Later</h3>';
      saved.forEach(b => { h += `<div class="saved-item" onclick="app.openBlock('${b.meta.id}')">&#128278; ${b.meta.title}</div>`; });
      h += '</div>';
    }

    // Data & privacy
    h += '<div class="profile-section"><h3>Your Data</h3>';
    h += '<div style="font-size:.78rem;color:var(--text-2);line-height:1.5">';
    h += '<p>All reading data is stored in your browser (localStorage). ';
    if (status.mode === 'live') h += 'Interactions are also sent to Recombee to personalize recommendations. ';
    h += 'Your reader ID is anonymous — no personal information is collected.</p>';
    h += `<div style="margin-top:.8em;display:flex;gap:.5em">`;
    h += '<button class="btn-ghost" style="border:1px solid var(--border);border-radius:6px;padding:.3em .8em;font-size:.75rem" onclick="app.exportProfile()">Export my data</button>';
    h += '<button class="btn-ghost" style="border:1px solid #dc2626;border-radius:6px;padding:.3em .8em;font-size:.75rem;color:#dc2626" onclick="app.resetAll()">Delete all data</button>';
    h += '</div></div></div>';

    el.innerHTML = h;
  }

  // ===== LINEAR DFS NAVIGATION =====
  // Build flat DFS order: Ch1 spine→depth→sidebar, Ch2 spine→depth→sidebar, ...
  getDFSOrder() {
    if (this._dfsOrder) return this._dfsOrder;
    const order = [];
    // Chapter sequence: 1, 2, 3, 4, 5, 6, 7
    for (let ci = 0; ci < this.book.chapters.length; ci++) {
      const ch = this.chapters[ci];
      if (!ch) continue;
      const spines = ch.blocks.filter(b => b.type === 'spine');
      const depths = ch.blocks.filter(b => b.type === 'depth');
      const sidebars = ch.blocks.filter(b => b.type === 'sidebar');
      const questions = ch.blocks.filter(b => b.type === 'question');
      // For each spine: spine → its depth cards → its sidebars
      spines.forEach(spine => {
        order.push({ id: spine.id, chIdx: ci, type: 'spine', title: spine.title, ch: ch.number });
        depths.filter(d => d.parent === spine.id).forEach(d => {
          order.push({ id: d.id, chIdx: ci, type: 'depth', title: d.title, voice: d.voice, ch: ch.number, parent: spine.id });
        });
        sidebars.filter(s => s.parent === spine.id).forEach(s => {
          order.push({ id: s.id, chIdx: ci, type: 'sidebar', title: s.title, ch: ch.number, parent: spine.id });
        });
      });
      // Questions at end of chapter
      questions.forEach(q => {
        order.push({ id: q.id, chIdx: ci, type: 'question', title: q.title, ch: ch.number });
      });
    }
    this._dfsOrder = order;
    return order;
  }

  getCurrentDFSIndex() {
    const order = this.getDFSOrder();
    const current = this.user.currentBlock;
    if (!current) return 0;
    const idx = order.findIndex(n => n.id === current);
    return idx >= 0 ? idx : 0;
  }

  linearPrev() {
    const order = this.getDFSOrder();
    let idx = this.getCurrentDFSIndex() - 1;
    if (idx < 0) idx = 0;
    const node = order[idx];
    this.user.currentBlock = node.id;
    this.user.save();
    // Navigate to the block (spine directly, depth/sidebar via parent)
    const targetId = node.parent || node.id;
    this.openBlock(targetId);
    this.updateLinearNav();
  }

  linearNext() {
    const order = this.getDFSOrder();
    let idx = this.getCurrentDFSIndex() + 1;
    if (idx >= order.length) idx = order.length - 1;
    const node = order[idx];
    this.user.currentBlock = node.id;
    this.user.save();
    const targetId = node.parent || node.id;
    this.openBlock(targetId);
    this.updateLinearNav();
  }

  updateLinearNav() {
    const nav = document.getElementById('linearNav');
    if (!nav) return;
    const order = this.getDFSOrder();
    const idx = this.getCurrentDFSIndex();
    const current = order[idx];
    const prev = order[idx - 1];
    const next = order[idx + 1];

    document.getElementById('lnPrev').disabled = !prev;
    document.getElementById('lnNext').disabled = !next;

    const pct = Math.round(((idx + 1) / order.length) * 100);
    const info = document.getElementById('lnInfo');
    if (info) {
      info.innerHTML = `<span style="color:var(--accent);font-weight:600">${idx + 1}</span>/${order.length} &middot; Ch${current?.ch || '?'}: ${(current?.title || '').substring(0, 40)}`;
    }
  }

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
    const messages = document.getElementById('chatMessagesFull');
    if (!messages) return;
    messages.innerHTML += `<div class="chat-msg user">${this.escHtml(msg)}</div>`;
    const response = this.generateChatResponse(msg);
    setTimeout(() => { messages.innerHTML += `<div class="chat-msg bot">${response}</div>`; messages.scrollTop = messages.scrollHeight; }, 300);
    messages.scrollTop = messages.scrollHeight;
  }

  // ===== GLOSSARY / TOPICS =====
  renderGlossary() {
    const el = document.getElementById('glossaryContent');
    const sorted = Object.entries(this.topicIndex).sort((a, b) => b[1].length - a[1].length);

    let html = '<div class="glossary-head"><h2>Topics & Concepts</h2><p>All topics covered in the book. Click to explore.</p></div>';
    html += '<div class="topic-grid">';
    sorted.forEach(([topic, ids]) => {
      const readCount = ids.filter(id => this.user.readBlocks.has(id)).length;
      const pct = Math.round((readCount / ids.length) * 100);
      html += `<div class="topic-card" onclick="app.showTopic('${topic}')">
        <div class="topic-name">${topic}</div>
        <div class="topic-count">${ids.length} blocks</div>
        <div class="topic-bar"><div class="topic-bar-fill" style="width:${pct}%"></div></div>
        <div class="topic-pct">${readCount} read</div>
      </div>`;
    });
    html += '</div>';
    el.innerHTML = html;
  }

  showTopic(topic) {
    const ids = this.topicIndex[topic] || [];
    const blocks = ids.map(id => this.findBlock(id)).filter(Boolean);

    const el = document.getElementById('glossaryContent') || document.getElementById('homeContent');
    if (this.currentView !== 'glossary') this.switchView('glossary');

    let html = `<div class="glossary-head"><button class="btn-ghost" onclick="app.renderGlossary()">&larr; All topics</button><h2>${topic}</h2><p>${blocks.length} blocks about this topic</p></div>`;

    // Group by type
    const spines = blocks.filter(b => b.meta.type === 'spine');
    const depths = blocks.filter(b => b.meta.type === 'depth');
    const sidebars = blocks.filter(b => b.meta.type === 'sidebar');

    if (spines.length) {
      html += '<h3 class="topic-section-title">Core sections</h3><div class="topic-list">';
      spines.forEach(b => { html += this.topicItem(b); });
      html += '</div>';
    }
    if (depths.length) {
      html += '<h3 class="topic-section-title">Deep dives</h3><div class="topic-list">';
      depths.forEach(b => { html += this.topicItem(b); });
      html += '</div>';
    }
    if (sidebars.length) {
      html += '<h3 class="topic-section-title">Stories & sidebars</h3><div class="topic-list">';
      sidebars.forEach(b => { html += this.topicItem(b); });
      html += '</div>';
    }

    document.getElementById('glossaryContent').innerHTML = html;
  }

  topicItem(b) {
    const isRead = this.user.readBlocks.has(b.meta.id);
    const isLiked = (this.user.ratings.get(b.meta.id) || 0) >= 0.7;
    const voiceTag = b.meta.voice && b.meta.voice !== 'universal' ? `<span class="card-badge ${b.meta.voice}" style="font-size:.55rem">${b.meta.voice}</span>` : '';
    return `<div class="topic-item ${isRead ? 'topic-read' : ''}" onclick="app.openBlock('${b.meta.id}')">
      <span class="topic-item-status">${isRead ? '&#10003;' : isLiked ? '&#10084;' : '&#9675;'}</span>
      <span class="topic-item-title">${b.meta.title}</span>
      ${voiceTag}
      <span class="topic-item-ch">Ch${b.meta._chapterNum}</span>
    </div>`;
  }

  // ===== CHAT =====
  toggleMobileChat() {
    const panel = document.getElementById('chatPanelMobile');
    if (!panel) return;
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) document.getElementById('chatInputMobile')?.focus();
  }

  sendMobileChat() {
    const input = document.getElementById('chatInputMobile');
    const msg = input?.value?.trim();
    if (!msg) return;
    input.value = '';
    const messages = document.getElementById('chatMessagesMobile');
    if (!messages) return;
    messages.innerHTML += `<div class="chat-msg user">${this.escHtml(msg)}</div>`;
    const response = this.generateChatResponse(msg);
    setTimeout(() => { messages.innerHTML += `<div class="chat-msg bot">${response}</div>`; messages.scrollTop = messages.scrollHeight; }, 300);
    messages.scrollTop = messages.scrollHeight;
  }

  sendChat() {
    const input = document.getElementById('chatInput');
    const msg = input?.value?.trim();
    if (!msg) return;
    input.value = '';
    const messages = document.getElementById('chatMessages');
    if (!messages) return;
    messages.innerHTML += `<div class="chat-msg user">${this.escHtml(msg)}</div>`;
    const response = this.generateChatResponse(msg);
    setTimeout(() => { messages.innerHTML += `<div class="chat-msg bot">${response}</div>`; messages.scrollTop = messages.scrollHeight; }, 300);
    messages.scrollTop = messages.scrollHeight;
  }

  generateChatResponse(query) {
    const q = query.toLowerCase();

    // Find relevant blocks
    const scored = this.allBlocks.map(b => {
      let score = 0;
      const title = (b.meta.title || '').toLowerCase();
      const body = (b.body || '').toLowerCase();
      for (const word of q.split(/\s+/)) {
        if (word.length < 3) continue;
        if (title.includes(word)) score += 5;
        if (body.includes(word)) score += 1;
      }
      return { block: b, score };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

    // Find matching topics
    const matchTopics = Object.keys(this.topicIndex).filter(t => t.toLowerCase().includes(q) || q.includes(t.toLowerCase().split(' ')[0]));

    if (scored.length === 0 && matchTopics.length === 0) {
      return "I couldn't find content matching that. Try asking about specific topics like <b>collaborative filtering</b>, <b>cold start</b>, <b>A/B testing</b>, or <b>conversion rate</b>.";
    }

    let resp = '';

    // Socratic: don't just answer, ask a question back
    if (scored.length > 0) {
      const top = scored[0].block;
      const teaser = top.meta.teaser || (top.body || '').substring(0, 150).replace(/[#*_]/g, '');
      resp += `<b>${top.meta.title}</b> (Ch${top.meta._chapterNum}) covers this. `;
      resp += `${teaser}... `;
      resp += `<br><br><a href="#" onclick="event.preventDefault();app.openBlock('${top.meta.id}');void(0)">Read this section &rarr;</a>`;

      if (scored.length > 1) {
        resp += '<br><br>Also related:';
        scored.slice(1).forEach(s => {
          resp += `<br>&middot; <a href="#" onclick="event.preventDefault();app.openBlock('${s.block.meta.id}');void(0)">${s.block.meta.title}</a>`;
        });
      }
    }

    if (matchTopics.length > 0) {
      resp += '<br><br>Explore the topic: ';
      matchTopics.slice(0, 3).forEach(t => {
        resp += `<a href="#" onclick="event.preventDefault();app.showTopic('${t}');void(0)">${t}</a> `;
      });
    }

    // Socratic follow-up
    const followUps = [
      'What aspect interests you most — the technical details, practical application, or business impact?',
      'Would you like to dive deeper into the math, or see how this works in practice?',
      'Have you read about the related concepts? I can suggest a reading path.',
    ];
    resp += `<br><br><i>${followUps[Math.floor(Math.random() * followUps.length)]}</i>`;

    return resp;
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
    const results = await this.rc.searchItems(query, 15);
    if (!results?.recomms?.length) { el.innerHTML = '<div class="search-empty">No results found.</div>'; return; }
    el.innerHTML = results.recomms.map(r => {
      const b = this.findBlock(r.id);
      const meta = b?.meta || r.values || {};
      const badge = meta.voice && meta.voice !== 'universal' ? `<span class="card-badge ${meta.voice}">${CONFIG.voices[meta.voice]?.label || meta.voice}</span>` : '';
      return `<div class="card" style="margin-bottom:.5em" onclick="app.openBlock('${r.id}');app.closeSearch()"><div class="card-chapter">${meta._chapterTitle || ''}</div><div class="card-title">${meta.title || r.id}</div><div class="card-meta">${badge}<span class="card-time">${meta.readingTime || 3} min</span></div></div>`;
    }).join('');
  }

  // ===== INTERACTIONS =====
  toggleDepth(blockId, parentId, voice) {
    const container = document.querySelector(`.depth-group[data-parent="${parentId}"]`);
    if (!container) return;
    const card = document.getElementById(`dc-${blockId}`);
    const tab = container.querySelector(`.d-tab[data-voice="${voice}"]`);
    const wasActive = card?.classList.contains('active');
    container.querySelectorAll('.d-tab').forEach(t => t.classList.remove('active'));
    container.querySelectorAll('.d-content').forEach(c => c.classList.remove('active'));
    if (!wasActive && card && tab) {
      tab.classList.add('active');
      card.classList.add('active');
      this.user.trackVoiceExpand(voice, blockId);
      this.rc.sendCartAdd(blockId); // Strong positive signal
      this.renderMath(card); // Render math in newly revealed depth card
    }
  }

  answerQ(el, voice, qId) {
    el.closest('.q-opts').querySelectorAll('.q-opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    this.rc.sendRating(qId, 1);
    if (voice && voice !== 'universal') {
      this.user.setVoice(voice);
      this.user.voiceScores[voice] = Math.max(this.user.voiceScores[voice] || 0, 1);
      this.user.save();
      this.updateVoiceBadge();
    }
    // Show recommendations based on answer
    const qBlock = el.closest('.q-block');
    let recsDiv = qBlock.querySelector('.q-recs');
    if (!recsDiv) { recsDiv = document.createElement('div'); recsDiv.className = 'q-recs fade-up'; qBlock.appendChild(recsDiv); }
    const vc = CONFIG.voices[voice] || {};
    const voiceFilter = voice !== 'universal' ? voice : null;
    // Prioritize: matching voice depth cards first, then spine blocks
    let recs = [];
    if (voiceFilter) {
      // Voice-specific: show depth cards in that voice first
      const voiceDepths = this.allBlocks.filter(b => b.meta.voice === voiceFilter && b.meta.type === 'depth' && !this.user.readBlocks.has(b.meta.id));
      const unreadSpines = this.allBlocks.filter(b => b.meta.type === 'spine' && !this.user.readBlocks.has(b.meta.id));
      recs = [...voiceDepths.slice(0, 3), ...unreadSpines.slice(0, 2)].slice(0, 4);
    } else {
      recs = this.allBlocks.filter(b => b.meta.type === 'spine' && !this.user.readBlocks.has(b.meta.id)).slice(0, 4);
    }
    recsDiv.innerHTML = `<div class="q-recs-title">Recommended for you${vc.label ? ` (${vc.label})` : ''}:</div>${recs.map(b => `<div class="q-rec-item">${this.cardHtml(b.meta)}</div>`).join('')}`;
    recsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  toggleLike(blockId) {
    const current = this.user.ratings.get(blockId);
    const newRating = current >= 0.7 ? 0 : 1; // toggle
    this.rc.sendRating(blockId, newRating);
    this.user.trackRating(blockId, newRating);
    // Like implies you saw it
    if (!this.user.seenBlocks.has(blockId)) this.user.trackSeen(blockId);
    if (newRating >= 0.7 && !this.user.readBlocks.has(blockId)) this.user.trackRead(blockId);
    // Update button visually
    const btn = document.querySelector(`.block-reactions[data-block="${blockId}"] .like-btn`);
    if (btn) {
      btn.classList.toggle('liked', newRating >= 0.7);
      btn.innerHTML = newRating >= 0.7 ? '&#10084;&#65039; <span>Liked</span>' : '&#9825; <span>Like</span>';
    }
  }

  feedBlock(blockId, rating) {
    this.rc.sendRating(blockId, rating);
    this.user.trackRating(blockId, rating);
  }

  saveBlock(blockId) {
    this.user.trackSave(blockId);
    this.rc.sendBookmark(blockId);
    if (!this.user.seenBlocks.has(blockId)) this.user.trackSeen(blockId);
    const btn = document.querySelector(`#b-${blockId} .act-btn[title="Save"]`);
    if (btn) btn.classList.add('active');
  }

  saveCurrent() { if (this.user.currentBlock) this.saveBlock(this.user.currentBlock); }
  rateCurrent(r) { if (this.user.currentBlock) this.feedBlock(this.user.currentBlock, r); }

  revealVoice(voice, chapterIdx) {
    this.user.voiceScores[voice] = Math.max(this.user.voiceScores[voice], 1);
    this.user.save();
    this.renderRead(chapterIdx);
  }

  openBlock(blockId) {
    const block = this.findBlock(blockId);
    if (!block) return;
    const chIdx = block.meta._chapterIdx;
    const parentId = block.meta.parent || blockId; // depth cards → scroll to parent
    this.user.currentBlock = blockId;
    this.user.currentChapter = chIdx;
    this.user.save();

    // If already viewing this chapter, just scroll
    if (this.currentView === 'read' && this._renderedChapter === chIdx) {
      this._scrollToBlock(parentId, block.meta);
      return;
    }

    this._pendingScroll = { parentId, meta: block.meta };
    this.switchView('read');
    this.renderRead(chIdx);
  }

  _scrollToBlock(parentId, meta) {
    setTimeout(() => {
      const el = document.getElementById(`b-${parentId}`);
      if (!el) return;

      if (meta.type === 'depth' && meta.voice) {
        // For depth cards: first expand the tab, then scroll to the depth content
        const tab = document.querySelector(`.depth-group[data-parent="${parentId}"] .d-tab[data-voice="${meta.voice}"]`);
        if (tab && !tab.classList.contains('active')) tab.click();
        // Scroll to the expanded depth card content, not the parent spine
        setTimeout(() => {
          const depthContent = document.getElementById(`dc-${meta.id}`);
          if (depthContent) depthContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
          else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
      } else if (meta.type === 'sidebar') {
        // For sidebars: scroll to the sidebar block itself
        // Sidebars don't have unique IDs in DOM, scroll to parent
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        // Spine blocks: scroll directly
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  }

  goChapter(idx) {
    this.user.currentChapter = idx;
    this.user.save();
    this.switchView('read');
    this.renderRead(idx);
  }

  // ===== SETTINGS =====
  toggleSettings() {
    document.getElementById('settingsDrawer').classList.toggle('open');
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? '' : theme);
    localStorage.setItem('pbook-theme', theme);
    this.updateSettingsUI();
  }

  setFontSize(size) {
    const map = { small: '1rem', medium: '1.125rem', large: '1.25rem' };
    document.documentElement.style.setProperty('--fs', map[size]);
    localStorage.setItem('pbook-fs', size);
    this.updateSettingsUI();
  }

  applyTheme() {
    const theme = localStorage.getItem('pbook-theme');
    if (theme && theme !== 'light') document.documentElement.setAttribute('data-theme', theme);
    const fs = localStorage.getItem('pbook-fs');
    if (fs) { const map = { small: '1rem', medium: '1.125rem', large: '1.25rem' }; document.documentElement.style.setProperty('--fs', map[fs]); }
    this.updateSettingsUI();
  }

  updateSettingsUI() {
    document.querySelectorAll('.sg-opt').forEach(o => o.classList.remove('active'));
    const theme = localStorage.getItem('pbook-theme') || 'light';
    const fs = localStorage.getItem('pbook-fs') || 'medium';
    document.querySelector(`.sg-opt[data-theme="${theme}"]`)?.classList.add('active');
    document.querySelector(`.sg-opt[data-fs="${fs}"]`)?.classList.add('active');
    document.getElementById('recStatus').textContent = this.rc.enabled ? `Connected: ${this.rc.config.database}` : 'Demo mode (local simulation)';
  }

  cycleVoice() {
    const voices = ['universal', 'engineer', 'product', 'business'];
    const current = this.user.preferredVoice || 'universal';
    const next = voices[(voices.indexOf(current) + 1) % voices.length];
    this.user.setVoice(next);
    if (this.rc.enabled) this.rc.setUserProperties({ voice: next });
    this.updateVoiceBadge();
    // Re-render current view to reflect voice change
    if (this.currentView === 'read') this.renderRead();
    else if (this.currentView === 'home') this.renderHome();
  }

  updateVoiceBadge() {
    const el = document.getElementById('voiceBadge');
    if (!el) return;
    const v = this.user.preferredVoice || this.user.getTopVoice() || 'universal';
    el.textContent = (CONFIG.voices[v]?.label || v).toUpperCase();
    el.className = `voice-badge ${v}`;
  }

  exportProfile() {
    const profile = this.user.getProfile(this.allBlocks);
    const interactions = this.rc.interactions;
    const notes = JSON.parse(localStorage.getItem('pbook-notes') || '{}');
    const data = { profile, interactions, notes, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pbook-profile-${profile.userId.substring(0, 8)}.json`;
    a.click();
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
    for (const b of this.allBlocks) { if (b.meta.id === id) return b; }
    return null;
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

// Text highlight on selection
document.addEventListener('mouseup', () => {
  const popup = document.getElementById('highlightPopup');
  if (!popup) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) { popup.style.display = 'none'; return; }
  // Only in read view, inside spine-body
  const anchor = sel.anchorNode?.parentElement?.closest('.spine-body, .d-content, .sb-block');
  if (!anchor) { popup.style.display = 'none'; return; }
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  popup.style.display = 'flex';
  popup.style.top = (rect.top + window.scrollY - 40) + 'px';
  popup.style.left = (rect.left + rect.width / 2 - 40) + 'px';
});

// Keyboard: arrows for chapter nav in read view
document.addEventListener('keydown', e => {
  if (app.currentView !== 'read' || !app.book) return;
  if (e.key === 'ArrowRight' && app.user.currentChapter < app.book.chapters.length - 1) app.goChapter(app.user.currentChapter + 1);
  if (e.key === 'ArrowLeft' && app.user.currentChapter > 0) app.goChapter(app.user.currentChapter - 1);
});
