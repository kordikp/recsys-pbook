// p-book challenges ("⭐ Extra challenge"): an optional, harder task after a concept, for readers who want more.
//
// A block with `type: challenge`. Its body is markdown cut by marker lines:
//   hook (shown on the closed card) · <!-- task --> · <!-- hint --> (one per hint) · <!-- solution --> · <!-- more -->
// Frontmatter: level (1–3), minutes. The card opens on a click; hints come one at a time, the solution
// only when asked for, and "Done" gives XP once. Nothing here counts toward reading progress or a certificate.
// Mixed into the PBook class (js/app.js calls installChallenges(PBook)); state lives in localStorage.

import { tr } from './i18n.js';
import { renderMarkdown } from './markdown.js?v=4';

const KEY = 'pbook-challenges';
const XP = 15;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// body → { hook, task, hints[], solution, more }
export function challengeParts(body) {
  const out = { hook: '', task: '', hints: [], solution: '', more: '' };
  let cur = 'hook';
  for (const part of String(body || '').split(/^[ \t]*<!--\s*(task|hint|solution|more)\s*-->[ \t]*$/m)) {
    if (['task', 'hint', 'solution', 'more'].includes(part)) { cur = part; if (part === 'hint') out.hints.push(''); continue; }
    if (cur === 'hint') out.hints[out.hints.length - 1] += part;
    else out[cur] += part;
  }
  for (const k of ['hook', 'task', 'solution', 'more']) out[k] = out[k].trim();
  out.hints = out.hints.map(h => h.trim()).filter(Boolean);
  return out;
}

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
function save(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode: the card still works this visit */ }
}

const Challenges = {
  _chState(id) { return load()[id] || {}; },
  _chSet(id, patch) { const all = load(); all[id] = { ...(all[id] || {}), ...patch }; save(all); return all[id]; },

  renderChallenge(block) {
    const id = block.id;
    const P = challengeParts(block.body);
    const st = this._chState(id);
    const open = this._chOpen?.has(id);
    const level = Math.min(3, Math.max(1, parseInt(block.level, 10) || 2));
    const dots = `<span class="chl-level" role="img" aria-label="${esc(tr('Difficulty {0} of 3', level))}">${'●'.repeat(level)}<span class="chl-off">${'●'.repeat(3 - level)}</span></span>`;
    const meta = [dots, block.minutes ? esc(tr('~{0} min', block.minutes)) : ''].filter(Boolean).join('<span class="chl-sep">·</span>');
    const shown = Math.min(st.h || 0, P.hints.length);
    const hints = P.hints.map((h, k) => `<li class="chl-hint"${k < shown ? '' : ' hidden'}><span class="chl-hint-n">${esc(tr('Hint {0}', k + 1))}</span><div class="spine-body">${renderMarkdown(h)}</div></li>`).join('');
    const hintBtn = P.hints.length
      ? `<button class="g-btn chl-hint-btn" onclick="app.challengeHint('${esc(id)}')"${shown >= P.hints.length ? ' hidden' : ''}>${esc(tr('💡 Hint {0} of {1}', shown + 1, P.hints.length))}</button>` : '';
    return `<section class="chl-block fade-up${st.d ? ' is-done' : ''}${open ? ' is-open' : ''}" id="b-${esc(id)}" data-block="${esc(id)}" aria-labelledby="chl-h-${esc(id)}">
      <div class="chl-kicker"><span class="chl-kind">${esc(tr('⭐ Extra challenge'))}</span><span class="chl-meta">${meta}</span><span class="chl-done-badge"${st.d ? '' : ' hidden'}>${esc(tr('✓ Done'))}</span></div>
      <h4 class="chl-title" id="chl-h-${esc(id)}">${esc(block.title)}</h4>
      ${P.hook ? `<div class="spine-body chl-hook">${renderMarkdown(P.hook)}</div>` : ''}
      <button class="g-btn g-btn-primary chl-open" onclick="app.challengeToggle('${esc(id)}')" aria-expanded="${open ? 'true' : 'false'}" aria-controls="chl-body-${esc(id)}">${esc(open ? tr('Close the challenge') : tr('Take it on'))}</button>
      <div class="chl-body" id="chl-body-${esc(id)}"${open ? '' : ' hidden'}>
        <div class="spine-body chl-task" tabindex="-1">${renderMarkdown(P.task)}</div>
        ${P.hints.length ? `<ol class="chl-hints">${hints}</ol>` : ''}
        <div class="chl-actions">
          ${hintBtn}
          ${P.solution ? `<button class="g-btn chl-sol-btn" onclick="app.challengeSolution('${esc(id)}')"${st.s ? ' hidden' : ''}>${esc(tr('🔑 Show the solution'))}</button>` : ''}
          <button class="g-btn chl-done-btn" onclick="app.challengeDone('${esc(id)}')"${st.d ? ' hidden' : ''}>${esc(tr('✓ I did it'))}</button>
        </div>
        ${P.solution ? `<div class="chl-solution"${st.s ? '' : ' hidden'}><div class="chl-sub">${esc(tr('Solution'))}</div><div class="spine-body">${renderMarkdown(P.solution)}</div></div>` : ''}
        ${P.more ? `<div class="chl-more"><div class="chl-sub">${esc(tr('🚀 Want to go further?'))}</div><div class="spine-body">${renderMarkdown(P.more)}</div></div>` : ''}
      </div>
    </section>`;
  },

  challengeToggle(id) {
    const el = document.getElementById(`b-${id}`);
    if (!el) return;
    this._chOpen = this._chOpen || new Set();
    const open = !this._chOpen.has(id);
    if (open) this._chOpen.add(id); else this._chOpen.delete(id);
    el.classList.toggle('is-open', open);
    el.querySelector('.chl-body').hidden = !open;
    const b = el.querySelector('.chl-open');
    b.textContent = open ? tr('Close the challenge') : tr('Take it on');
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && !this._chState(id).o) { this._chSet(id, { o: 1 }); this.rc?.logEvent('challenge_open', { blockId: id }); }
    if (open) el.querySelector('.chl-task')?.focus?.({ preventScroll: true });
  },

  challengeHint(id) {
    const el = document.getElementById(`b-${id}`);
    if (!el) return;
    const items = [...el.querySelectorAll('.chl-hint')];
    const n = Math.min(items.length, (this._chState(id).h || 0) + 1);
    this._chSet(id, { h: n });
    items.forEach((li, k) => { li.hidden = k >= n; });
    const btn = el.querySelector('.chl-hint-btn');
    if (btn) { btn.hidden = n >= items.length; btn.textContent = tr('💡 Hint {0} of {1}', n + 1, items.length); }
    items[n - 1]?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    this.rc?.logEvent('challenge_hint', { blockId: id, hint: n });
  },

  challengeSolution(id) {
    const el = document.getElementById(`b-${id}`);
    if (!el) return;
    this._chSet(id, { s: 1 });
    el.querySelector('.chl-solution').hidden = false;
    el.querySelector('.chl-sol-btn').hidden = true;
    el.querySelector('.chl-solution').scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    this.rc?.logEvent('challenge_solution', { blockId: id, hints: this._chState(id).h || 0 });
  },

  challengeDone(id) {
    const el = document.getElementById(`b-${id}`);
    const st = this._chState(id);
    if (st.d) return;
    this._chSet(id, { d: Date.now() });
    if (el) {
      el.classList.add('is-done');
      el.querySelector('.chl-done-badge').hidden = false;
      el.querySelector('.chl-done-btn').hidden = true;
    }
    if (this._f('gamification')) { this.user.addXP(XP); this.user.save(); this.updateXPBadge?.(); this.showXPToast?.(tr('+{0} XP ⭐ challenge done', XP), 'achievement'); }
    this.rc?.logEvent('challenge_done', { blockId: id, hints: st.h || 0, solution: !!st.s });
  },

  // How many challenges the reader finished (profile, teacher view)
  challengesDone() { return Object.values(load()).filter(x => x.d).length; },
};

export function installChallenges(Cls) {
  Object.assign(Cls.prototype, Challenges);
  if (typeof document !== 'undefined' && !document.querySelector('link[data-challenge-css]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'css/challenge.css?v=1';
    l.setAttribute('data-challenge-css', '');
    document.head.appendChild(l);
  }
}
