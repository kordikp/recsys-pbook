// Completion mechanics: quiet nudges toward finishing a book, never a lock or a streak.
// A book turns each one on in CONFIG.completion; with no config nothing here renders.
//
//   completion: {
//     goalLine: true,      // "Next: 🥉 Explorer · core concepts read 12/24 · …" under core sections and on Browse
//     knowIt: true,        // "I know this → check" on an unread core section: answer its recall card, skip the reading
//     bridges: true,       // under a core section: a mini question on an earlier idea it builds on
//     doneForToday: 4,     // after N new core sections in one sitting: a "good place to stop" card with the plan
//   }
//
// Mastery is derived from what the engine already keeps (no new store to sync):
//   understood = the concept's recall card was answered (Hard or better) or one of its games scored ≥ 70 %
//   kept       = a recall answer (Hard or better) came two or more days after the previous review
import { CONFIG } from './config.js';
import { tr, trn } from './i18n.js';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clean = s => String(s || '').replace(/\\"/g, '"');
const DAY = 864e5;

const CSS = `
.cp-goal{display:flex;align-items:center;gap:.5em;flex-wrap:wrap;width:100%;text-align:left;font:inherit;font-size:.78rem;color:var(--text-2);background:var(--accent-bg,rgba(124,58,237,.07));border:1px solid var(--border);border-radius:10px;padding:.45em .7em;margin:.8em 0 .2em;cursor:pointer}
.cp-goal b{color:var(--text)}
.cp-goal .cp-bar{flex:1 1 90px;min-width:70px;height:6px;border-radius:3px;background:var(--border);overflow:hidden}
.cp-goal .cp-bar i{display:block;height:100%;background:var(--accent)}
.cp-know{font:inherit;font-size:.76rem;font-weight:600;color:var(--accent);background:none;border:1.5px solid var(--accent);border-radius:999px;padding:.25em .8em;margin:.1em 0 .5em;cursor:pointer}
.cp-check,.cp-bridge,.cp-today{border:1.5px solid var(--border);border-radius:12px;padding:.7em .85em;margin:.8em 0;background:var(--surface,var(--card,#fff));font-size:.88rem}
.cp-check{border-color:var(--accent)}
.cp-kicker{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--accent);margin-bottom:.25em}
.cp-q{font-weight:600;margin:.2em 0 .45em}
.cp-a{color:var(--text-2);border-left:3px solid var(--accent);padding:.15em 0 .15em .6em;margin:.4em 0}
.cp-btns{display:flex;flex-wrap:wrap;gap:.4em;margin-top:.45em}
.cp-btn{font:inherit;font-size:.8rem;font-weight:600;padding:.35em .85em;border-radius:8px;border:1.5px solid var(--border);background:var(--bg);color:var(--text);cursor:pointer}
.cp-btn.cp-yes{border-color:#10B981;color:#047857}
.cp-btn.cp-main{background:var(--accent);border-color:var(--accent);color:#fff}
.cp-bridge summary{cursor:pointer;font-weight:600;list-style:none}
.cp-bridge summary::-webkit-details-marker{display:none}
.cp-bridge summary::before{content:"🔁 ";}
.cp-small{font-size:.75rem;color:var(--text-3)}
.cp-today ul{margin:.3em 0 .2em 1.1em}
`;

export const completionMethods = {
  _cpCfg() { return CONFIG.completion || {}; },
  _cpOn(k) { return !!this._cpCfg()[k]; },
  _cpStyle() {
    if (this._cpStyled || !Object.keys(this._cpCfg()).length) return;
    this._cpStyled = true;
    const st = document.createElement('style');
    st.id = 'pbook-completion-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  },

  // ---------------------------------------------------------------- mastery (derived)
  _cpCoreConcepts() {
    const out = [], seen = new Set();
    for (const b of (this.allBlocks || [])) {
      if (!b.meta.core || b.meta.type !== 'spine') continue;
      const cid = this._conceptIds(b.meta)[0];
      if (cid && this.concepts?.[cid] && !seen.has(cid)) { seen.add(cid); out.push(cid); }
    }
    return out;
  },
  _cpCard(cid) {
    const c = this.concepts?.[cid];
    const key = c && (c.anchorKey || c.anchor);
    return key ? (this.user.recall?.[key] || null) : null;
  },
  _cpGameBest(cid) {
    if (!this._cpGameIdx || this._cpGameIdxN !== (this.allBlocks || []).length) {
      this._cpGameIdx = {};
      this._cpGameIdxN = (this.allBlocks || []).length;
      for (const b of (this.allBlocks || [])) {
        if (b.meta.type !== 'game') continue;
        const c = this._conceptIds(b.meta)[0];
        if (c) (this._cpGameIdx[c] = this._cpGameIdx[c] || []).push(b.meta.id);
      }
    }
    const store = this._gameStore ? this._gameStore() : {};
    return Math.max(0, ...(this._cpGameIdx[cid] || []).map(id => store[id]?.best || 0));
  },
  conceptUnderstood(cid) {
    const card = this._cpCard(cid);
    return !!(card && (card.kept || (card.reps > 0 && card.interval >= 1))) || this._cpGameBest(cid) >= 0.7;
  },
  conceptKept(cid) { return !!this._cpCard(cid)?.kept; },
  _cpRecallKey(cid) { const c = this.concepts?.[cid]; return c && (c.anchorKey || c.anchor); },
  // Answer a concept's recall card from a check or a bridge (same scheduler as the recall view).
  _cpScore(cid, quality) {
    const key = this._cpRecallKey(cid);
    if (!key) return 0;
    if (!this.user.recall[key]) this.user.scheduleRecall(key);
    const xp = this.user.processRecall(key, quality) || 0;
    this.rc.logEvent('recall_score', { blockId: key, concept: cid, quality, via: this._cpVia || 'check' });
    this.updateXPBadge?.();
    return xp;
  },

  // ---------------------------------------------------------------- goal line
  _cpGoal() {
    if (!this._f('gamification')) return null;
    const { tiers, achievedIdx } = this.getCertTiers();
    const next = tiers[achievedIdx + 1];
    if (!next) return { done: true, tiers, achievedIdx };
    // progress inside the next tier: every requirement counts by its own x/y
    let have = 0, need = 0;
    for (const r of next.reqs) { have += Math.min(r.have ?? (r.done ? 1 : 0), r.need ?? 1); need += r.need ?? 1; }
    return { next, frac: need ? have / need : 0, open: next.reqs.filter(r => !r.done) };
  },
  _goalLineHtml() {
    if (!this._cpOn('goalLine')) return '';
    const g = this._cpGoal();
    if (!g) return '';
    if (g.done) return `<button class="cp-goal" onclick="app.showCertProgress()"><span>${tr('🏆 Every certificate level reached')}</span></button>`;
    return `<button class="cp-goal" onclick="app.showCertProgress()" title="${esc(tr('Your way to the certificate'))}">
      <span>${tr('Next: {0}', `<b>${g.next.icon} ${esc(g.next.title)}</b>`)}</span>
      <span class="cp-bar" aria-hidden="true"><i style="width:${Math.round(g.frac * 100)}%"></i></span>
      <span>${g.open.map(r => esc(r.label)).join(' · ')}</span></button>`;
  },
  showCertProgress() {
    this.switchView('profile');
    setTimeout(() => document.getElementById('certSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
  },

  // ---------------------------------------------------------------- per-section pieces
  // Right under the section title: "I know this → check" (unread core sections only).
  _knowItHtml(block) {
    if (!this._cpOn('knowIt') || !block?.core || block.type !== 'spine') return '';
    if (this.user.readBlocks.has(block.id)) return '';
    const cid = this._conceptIds(block)[0];
    const k = cid && this.concepts?.[cid]?.contract;
    if (!k?.recallQ || !k?.recallA || this.conceptUnderstood(cid)) return '';
    return `<div id="cpk-${esc(block.id)}"><button class="cp-know" onclick="app.knowIt('${esc(block.id)}')">${tr('I know this → check')}</button></div>`;
  },
  knowIt(blockId) {
    const slot = document.getElementById(`cpk-${blockId}`);
    const b = this.findBlock(blockId)?.meta;
    const cid = b && this._conceptIds(b)[0];
    const k = cid && this.concepts?.[cid]?.contract;
    if (!slot || !k) return;
    this._cpGameBest(cid);                       // builds the concept → games index
    const game = (this._cpGameIdx?.[cid] || []).map(id => this.findBlock(id)?.meta).find(m => m && this._covers?.(m, 'lens', 'generic'))
      || (this._cpGameIdx?.[cid] || []).map(id => this.findBlock(id)?.meta).find(Boolean);
    slot.innerHTML = `<div class="cp-check" role="group" aria-label="${esc(tr('Quick check'))}">
      <div class="cp-kicker">${tr('Quick check')}</div>
      <div class="cp-q">${esc(clean(k.recallQ))}</div>
      <div class="cp-small">${tr('Answer in your head, then compare.')}</div>
      <div class="cp-btns"><button class="cp-btn cp-main" onclick="app._knowItReveal('${esc(blockId)}')">${tr('Show the answer')}</button></div>
      <div class="cp-reveal" hidden>
        <div class="cp-a">${esc(clean(k.recallA))}</div>
        <div class="cp-btns">
          <button class="cp-btn cp-yes" onclick="app._knowItAnswer('${esc(blockId)}', true)">${tr('✓ I knew it')}</button>
          <button class="cp-btn" onclick="app._knowItAnswer('${esc(blockId)}', false)">${tr('↺ Not quite — I will read it')}</button>
        </div>
        ${game ? `<div class="cp-small" style="margin-top:.4em">${tr('Or check it in a game:')} <a href="#${esc(game.id)}" onclick="event.preventDefault(); app.openBlock('${esc(game.id)}', 'know_it')">${esc(game.title)}</a></div>` : ''}
      </div></div>`;
    this.rc.logEvent('know_it_open', { blockId, concept: cid });
  },
  _knowItReveal(blockId) {
    const slot = document.getElementById(`cpk-${blockId}`);
    if (!slot) return;
    slot.querySelector('.cp-reveal').hidden = false;
    slot.querySelector('.cp-main')?.closest('.cp-btns')?.remove();
  },
  _knowItAnswer(blockId, knew) {
    const slot = document.getElementById(`cpk-${blockId}`);
    const b = this.findBlock(blockId)?.meta;
    const cid = b && this._conceptIds(b)[0];
    if (!slot || !cid) return;
    this._cpVia = 'know_it';
    this._cpScore(cid, knew ? 2 : 0);
    this._cpVia = null;
    this.rc.logEvent('know_it', { blockId, concept: cid, knew });
    if (knew) {
      this._markRead(blockId, b, null, 0);      // checked counts as met: the section needs no reading
      slot.innerHTML = `<div class="cp-check"><div class="cp-kicker">${tr('✓ Checked')}</div>
        <div class="cp-small">${tr('Counted as understood. The card comes back for a recall in a few days.')}</div></div>`;
    } else {
      slot.innerHTML = `<div class="cp-small" style="margin:.2em 0 .6em">${tr('Good call: read on, the card comes back after the section.')}</div>`;
    }
    this._cpRefreshGoal();
  },

  // Under the section: one mini question on an earlier idea it builds on (a prerequisite
  // or a concept it links to) that the reader has met and not yet kept.
  _bridgeHtml(block) {
    if (!this._cpOn('bridges') || !block?.core || block.type !== 'spine') return '';
    const cid = this._conceptIds(block)[0];
    if (!cid) return '';
    const cand = [];
    const node = this._cmapNodes?.[cid];
    const preEdges = (this._cmapData?.edges || []).filter(e => e.type === 'prereq' && e.b === cid).map(e => e.a);
    cand.push(...(node?.prereq || []), ...preEdges, ...(node?.rel || []));   // prerequisites first, then related ideas
    for (const m of String(block.body || '').matchAll(/\]\(#c\/([\w-]+)\)/g)) cand.push(m[1]);
    const seen = new Set();
    const order = this._conceptOrder ? this._conceptOrder() : [];
    const mine = order.indexOf(cid);
    const pick = cand.find(s => {
      if (s === cid || seen.has(s)) return false;
      seen.add(s);
      const k = this.concepts?.[s]?.contract;
      if (!k?.recallQ || !k?.recallA) return false;
      if (mine >= 0 && order.indexOf(s) > mine) return false;       // only ideas from before this one
      return this._cRead?.(s) && !this.conceptKept(s) && !this._cpBridged?.has(s);
    });
    if (!pick) return '';
    const c = this.concepts[pick];
    return `<details class="cp-bridge" data-cid="${esc(pick)}" ontoggle="this.open&&app._bridgeOpened('${esc(pick)}')">
      <summary>${tr('You already know this: {0}', esc(c.title))}</summary>
      <div class="cp-q">${esc(clean(c.contract.recallQ))}</div>
      <div class="cp-a">${esc(clean(c.contract.recallA))}</div>
      <div class="cp-btns">
        <button class="cp-btn cp-yes" onclick="app._bridgeAnswer('${esc(pick)}', true, this)">${tr('✓ I knew it')}</button>
        <button class="cp-btn" onclick="app._bridgeAnswer('${esc(pick)}', false, this)">${tr('↺ Not quite')}</button>
      </div></details>`;
  },
  _bridgeOpened(cid) { this.rc.logEvent('bridge_open', { concept: cid }); },
  _bridgeAnswer(cid, knew, btn) {
    if (!this._cpBridged) this._cpBridged = new Set();
    this._cpBridged.add(cid);
    this._cpVia = 'bridge';
    this._cpScore(cid, knew ? 2 : 0);
    this._cpVia = null;
    const box = btn?.closest('.cp-bridge');
    if (box) box.querySelector('.cp-btns').outerHTML = `<div class="cp-small">${knew ? tr('✓ Kept. It comes back later, spaced out.') : tr('It comes back sooner, so it sticks.')}</div>`;
    this._cpRefreshGoal();
  },

  // Everything a core section shows below its text (bridge, goal line).
  _completionHtml(block) {
    if (!block?.core || block.type !== 'spine' || !Object.keys(this._cpCfg()).length) return '';
    // The slot is filled again after each read: a chapter renders all its sections at once,
    // so a later section learns only after the reader got there what it can bridge to.
    return `<div class="cp-bridge-slot" data-block="${esc(block.id)}">${this._bridgeHtml(block)}</div>` + this._goalLineHtml();
  },
  _cpRefreshGoal() {
    const html = this._goalLineHtml();
    if (html) document.querySelectorAll('#readPane .cp-goal, #view-home .cp-goal').forEach(el => { el.outerHTML = html; });
    document.querySelectorAll('#readPane .cp-bridge-slot:empty').forEach(el => {
      const b = this.findBlock(el.dataset.block)?.meta;
      if (b) el.innerHTML = this._bridgeHtml(b);
    });
  },

  // ---------------------------------------------------------------- done for today
  _afterReadCompletion(id) {
    this._cpRefreshGoal();
    const n = +this._cpCfg().doneForToday || 0;
    if (!n || this._cpTodayShown) return;
    try { if (sessionStorage.getItem('pbook-done-today')) return; } catch (e) {}
    const meta = this.findBlock(id)?.meta;
    if (!meta?.core) return;
    const fresh = [...this.user.readBlocks].filter(x => !this._sessionStart?.has(x) && this.findBlock(x)?.meta?.core);
    if (fresh.length < n) return;
    this._cpTodayShown = true;
    try { sessionStorage.setItem('pbook-done-today', '1'); } catch (e) {}
    const art = document.getElementById(`b-${id}`);
    if (!art || this.currentView !== 'read') return;
    art.insertAdjacentHTML('afterend', this._todayCardHtml(fresh.length));
    this.rc.logEvent('done_today_shown', { sections: fresh.length });
  },
  _cpNextCore() {
    const cid = this._cpCoreConcepts().find(c => !this._cRead?.(c));
    if (!cid) return null;
    const id = this._servedTellingId?.(cid) || this.concepts[cid].anchor;
    const b = this.findBlock(id)?.meta;
    return b ? { id: b.id, title: b.title, ch: b._chapterNum } : null;
  },
  _todayCardHtml(sections) {
    const next = this._cpNextCore();
    const soon = Object.values(this.user.recall || {}).filter(c => c.nextReview <= Date.now() + 1.5 * DAY).length;
    return `<div class="cp-today fade-up" id="cpToday" role="status">
      <div class="cp-kicker">${tr('✓ A good place to stop')}</div>
      <div>${tr('Today: {0}.', trn('{0} core section', '{0} core sections', sections))}</div>
      <ul>
        ${next ? `<li>${tr('Next time: {0}', `<b>${esc(next.title)}</b>`)}</li>` : ''}
        ${soon ? `<li>${trn('{0} recall card waits for you tomorrow', '{0} recall cards wait for you tomorrow', soon)}</li>` : ''}
      </ul>
      ${this._goalLineHtml()}
      <div class="cp-btns">
        <button class="cp-btn cp-main" onclick="app._todayChoice(false)">${tr('Keep reading')}</button>
        <button class="cp-btn" onclick="app._todayChoice(true)">${tr('Done for today')}</button>
      </div></div>`;
  },
  _todayChoice(stop) {
    const card = document.getElementById('cpToday');
    this.rc.logEvent('done_today', { stop });
    if (!card) return;
    if (!stop) { card.remove(); return; }
    const next = this._cpNextCore();
    card.innerHTML = `<div class="cp-kicker">${tr('✓ Saved')}</div>
      <div>${next ? tr('When you come back, the book opens at {0}.', `<b>${esc(next.title)}</b>`) : tr('Your progress is saved on this device.')}</div>
      <div class="cp-small" style="margin-top:.3em">${tr('No streaks, no pressure: come back whenever it suits you.')}</div>`;
    if (next) { this.user.currentBlock = next.id; this.user.save(); }
  },
};


// The profile map is not one of the nudges above: every book with core concepts shows it.
const MAP_CSS = `
.pm-legend{display:flex;flex-wrap:wrap;gap:.3em .9em;font-size:.72rem;color:var(--text-3);margin:.1em 0 .5em}
.pm-ch{margin:.6em 0}
.pm-ch-t{display:flex;justify-content:space-between;gap:.5em;font-size:.78rem;font-weight:700;color:var(--text-2)}
.pm-chips{display:flex;flex-wrap:wrap;gap:.3em;margin-top:.3em}
.pm-chip{font:inherit;font-size:.75rem;line-height:1.3;padding:.28em .65em;border-radius:999px;border:1.5px dashed var(--border);background:none;color:var(--text-3);cursor:pointer;text-align:left}
.pm-chip.pm-read{border-style:solid;color:var(--text)}
.pm-chip.pm-checked{border:1.5px solid var(--accent);color:var(--accent);font-weight:600}
.pm-chip.pm-kept{border:1.5px solid var(--accent);background:var(--accent);color:#fff;font-weight:600}
.pm-sum{display:flex;flex-wrap:wrap;gap:.3em 1.1em;font-size:.78rem;color:var(--text-2);margin-top:.7em;padding-top:.5em;border-top:1px solid var(--border)}
`;

export const profileMapMethods = {
  // ---------------------------------------------------------------- profile map
  // Every core concept by chapter in its state (the same states the certificate counts):
  // not yet · read · checked (understood) · kept, and under it missions and group tasks done.
  _cpCoreByChapter() {
    const chs = new Map(), seen = new Set();
    for (const b of (this.allBlocks || [])) {
      if (!b.meta.core || b.meta.type !== 'spine') continue;
      const cid = this._conceptIds(b.meta)[0];
      if (!cid || !this.concepts?.[cid] || seen.has(cid)) continue;
      seen.add(cid);
      const k = b.meta._chapter || b._chapter || b.meta.chapter || '';
      if (!chs.has(k)) chs.set(k, []);
      chs.get(k).push(cid);
    }
    return chs;
  },
  _cpChapterTitle(id) { return (this.book?.chapters || []).find(c => c.id === id)?.title || ''; },
  _cpState(cid) {
    if (this.conceptKept(cid)) return 'kept';
    if (this.conceptUnderstood(cid)) return 'checked';
    return this._cRead?.(cid) ? 'read' : 'none';   // any telling read (as the goal line counts)
  },
  _profileMapHtml() {
    const chs = this._cpCoreByChapter();
    if (!chs.size) return '';
    if (!document.getElementById('pbook-pmap-css')) {
      const st = document.createElement('style');
      st.id = 'pbook-pmap-css';
      st.textContent = MAP_CSS;
      document.head.appendChild(st);
    }
    const SYM = { none: '○', read: '📖', checked: '✓', kept: '★' };
    const NAME = { none: tr('not yet'), read: tr('read'), checked: tr('checked'), kept: tr('kept') };
    const all = [...chs.values()].flat();
    const st = Object.fromEntries(all.map(c => [c, this._cpState(c)]));
    const count = (...s) => all.filter(c => s.includes(st[c])).length;
    const short = t => String(t || '').split(/[:：]/)[0].trim();
    let h = `<div class="profile-section pm-map"><h3>${tr('🗺️ Your map of the book')}</h3>
      <p class="profile-hint" style="margin:.1em 0 .3em">${tr('Every core idea of the book. Tap one to open it. ✓ means you answered its check, ★ means you still knew it days later.')}</p>
      <div class="pm-legend">${Object.keys(SYM).map(k => `<span>${SYM[k]} ${NAME[k]}</span>`).join('')}</div>`;
    for (const [k, cids] of chs) {
      const got = cids.filter(c => st[c] !== 'none').length;
      h += `<div class="pm-ch"><div class="pm-ch-t"><span>${esc(this._cpChapterTitle(k) || k)}</span><span>${got}/${cids.length}</span></div>
        <div class="pm-chips">${cids.map(c => `<button class="pm-chip pm-${st[c]}" title="${NAME[st[c]]}" onclick="app.openConcept('${esc(c)}')">${SYM[st[c]]} ${esc(short(this.concepts[c].title))}</button>`).join('')}</div></div>`;
    }
    const ms = this.getMissions ? this.getMissions() : [];
    const passed = new Set(this.user.completedMissions || []);
    const teams = this._teams ? this._teams() : [];
    const tdone = teams.length ? this._teamsDone() : {};
    h += `<div class="pm-sum"><span>${tr('core concepts read ({0}/{1})', count('read', 'checked', 'kept'), all.length)}</span>
      <span>${tr('core concepts checked ({0}/{1})', count('checked', 'kept'), all.length)}</span>
      ${ms.length ? `<span>🎯 ${tr('missions passed ({0}/{1})', ms.filter(m => passed.has(m.id)).length, ms.length)}</span>` : ''}
      ${teams.length ? `<span>👥 ${tr('group tasks done ({0}/{1})', teams.filter(t => tdone[t.id]).length, teams.length)}</span>` : ''}</div></div>`;
    return h;
  },
  // Certificate "Key topics": the chapters where the reader got furthest; null in a book without core concepts
  _cpTopChapters(max = 4) {
    const chs = this._cpCoreByChapter();
    if (!chs.size) return null;
    const w = { kept: 3, checked: 2, read: 1, none: 0 };
    return [...chs.entries()].map(([k, cids]) => ({ t: this._cpChapterTitle(k), s: cids.reduce((a, c) => a + w[this._cpState(c)], 0) }))
      .filter(x => x.s > 0 && x.t).sort((a, b) => b.s - a.s).slice(0, max).map(x => x.t);
  },
};

export function installCompletion(cls) {
  Object.assign(cls.prototype, completionMethods, profileMapMethods);
}
