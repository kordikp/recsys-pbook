// Group tasks (jigsaw): every member of a team holds part of what the team needs, and the team
// answers one question together. AI assistants can take seats: each one knows only its own card,
// tells it when asked and never writes the answer. The teacher sets the team in the link:
//
//   #tym-<id>~<children>~<assistants>    children 1–4, assistants 0–3, a team of 2–4
//
// Tasks come from content/missions.json → "teams": [{id, chapter, icon, title, story,
// cards: [{label, text}] ×4, boss: {q, hints}}]. Card i goes to member i % size; the children
// are members 1…k, the assistants follow. Devices share nothing: the child who sends the answer
// gets a short code, and the others type it in to count the task on their own device.
import { tr, LANG } from './i18n.js';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LETTERS = 'ABCD';
const MAX_ASKS = 15;          // messages to one assistant per visit; then it shows its card
const XP = 30;
const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return {}; } };
const day = (offset = 0) => new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10);

const CSS = `
.tm-card{border:1.5px solid var(--border);border-radius:12px;padding:.7em .85em;margin:.7em 0;background:var(--surface,var(--card,#fff));font-size:.9rem}
.tm-mine{border-color:var(--accent);background:var(--accent-bg,rgba(124,58,237,.06))}
.tm-kicker{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--accent);margin-bottom:.3em}
.tm-letter{display:inline-flex;align-items:center;justify-content:center;width:1.6em;height:1.6em;border-radius:50%;background:var(--accent);color:#fff;font-weight:800;font-size:.8rem;margin-right:.4em;flex:none}
.tm-row{display:flex;align-items:flex-start;gap:.2em;margin:.35em 0}
.tm-row b{font-weight:700}
.tm-steps{margin:.3em 0 0 1.2em;padding:0;font-size:.85rem;color:var(--text-2)}
.tm-steps li{margin:.2em 0}
.tm-pick{display:flex;flex-wrap:wrap;gap:.4em;margin:.35em 0 .7em}
.tm-pick button{font:inherit;font-weight:700;min-width:2.6em;padding:.45em .8em;border-radius:10px;border:1.5px solid var(--border);background:var(--bg);color:var(--text);cursor:pointer}
.tm-pick button.on{background:var(--accent);border-color:var(--accent);color:#fff}
.tm-pick button:disabled{opacity:.35;cursor:default}
.tm-ai{border:1.5px solid var(--border);border-radius:10px;margin:.45em 0;background:var(--bg)}
.tm-ai>summary{cursor:pointer;padding:.5em .7em;font-weight:600;font-size:.88rem}
.tm-log{padding:0 .7em;font-size:.85rem;max-height:45vh;overflow-y:auto}
.tm-msg{margin:.35em 0;padding:.4em .6em;border-radius:10px;max-width:92%;overflow-wrap:anywhere}
.tm-msg.ai{background:var(--accent-bg,rgba(124,58,237,.08))}
.tm-msg.me{background:var(--border);margin-left:auto}
.tm-say{display:flex;gap:.4em;padding:.5em .7em .7em}
.tm-say input{flex:1;min-width:0;font:inherit;font-size:.88rem;padding:.45em .6em;border:1.5px solid var(--border);border-radius:8px;background:var(--card,#fff);color:var(--text)}
.tm-btn{font:inherit;font-size:.82rem;font-weight:600;padding:.4em .9em;border-radius:8px;border:1.5px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer}
.tm-btn.ghost{background:none;color:var(--accent)}
.tm-code{font-family:ui-monospace,monospace;font-size:1.6rem;font-weight:800;letter-spacing:.2em;color:var(--accent)}
.tm-small{font-size:.75rem;color:var(--text-3)}
.tm-list .mission-card .mission-story{white-space:normal}
`;

export const teamMethods = {
  _teamStyle() {
    if (this._tmStyled) return;
    this._tmStyled = true;
    const st = document.createElement('style');
    st.id = 'pbook-teams-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  },

  _teams() { return Array.isArray(this._bookTeams) ? this._bookTeams : []; },
  _teamFind(id) { return this._teams().find(t => t.id === id) || null; },
  _teamsDone() { return store('pbook-teams-done'); },
  // a team of k children and a assistants, or null when the link asks for something else
  _teamSize(k, a) {
    k = parseInt(k, 10); a = parseInt(a, 10);
    if (!(k >= 1 && k <= 4 && a >= 0 && a <= 3 && k + a >= 2 && k + a <= 4)) return null;
    return { k, a, n: k + a };
  },
  _teamCards(member, n) { return [0, 1, 2, 3].filter(i => i % n === member); },
  _teamLink(id, k, a) { return location.origin + location.pathname + `#tym-${id}~${k}~${a}`; },
  // the same 4 characters on every device on the same day: FNV-1a of the task and the date
  _teamCode(id, offset = 0) {
    let h = 0x811c9dc5;
    for (const c of `${id}|${day(offset)}`) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
    const A = 'ACDEFHJKMNPRTUVWXY3479';
    let s = '';
    for (let i = 0; i < 4; i++) { s += A[h % A.length]; h = Math.floor(h / A.length); }
    return s;
  },
  _teamMarkDone(id, score, via) {
    const done = this._teamsDone();
    const first = !done[id];
    done[id] = { at: Date.now(), score: score ?? null, via };
    store('pbook-teams-done', done);
    const p = store('pbook-team-pending'); delete p[id]; store('pbook-team-pending', p);
    if (first && this._f('gamification')) { this.user.addXP(XP); this.user.save(); this.updateXPBadge(); }
    this.rc.logEvent('team_done', { teamId: id, via });
    return first;
  },

  // ---------------------------------------------------------------- entry points
  // #tym-<id>~<k>~<a> (from the init deep links and from a hash change while the book is open)
  openTeamLink(rest) {
    const [id, k, a] = String(rest || '').split('~');
    document.getElementById('onboarding')?.classList.add('hidden');
    this.updateXPBadge();
    if (this.currentView !== 'glossary') this.switchView('glossary');
    this.showTeam(decodeURIComponent(id), k, a);
  },
  _teamWatchHash() {
    if (this._tmWatch) return;
    this._tmWatch = true;
    window.addEventListener('hashchange', () => {
      const h = location.hash.slice(1);
      if (h.startsWith('tym-')) this.openTeamLink(h.slice(4));
    });
  },

  // the "Group tasks" section of the mission list
  teamListHtml() {
    const teams = this._teams();
    if (!teams.length) return '';
    this._teamStyle();
    const done = this._teamsDone();
    return `<div class="mission-group-head tm-list" id="missions-teams" style="margin:1.6em 0 .5em">
        <h3 style="font-family:var(--font-ui);font-size:1.05rem;font-weight:800;margin:0">${tr('👥 Group tasks')}</h3>
        <p style="font-size:.85rem;color:var(--text-2);margin:.2em 0 0">${tr('Each member of the team knows a different piece. Put them together and answer the dragon as a team. AI assistants can join the team.')}</p></div>`
      + teams.map(t => `<div class="mission-card ${done[t.id] ? 'mission-complete' : ''}" onclick="app.showTeam('${esc(t.id)}')">
        <div class="mission-icon">${esc(t.icon || '👥')}</div>
        <div class="mission-info">
          <div class="mission-title-row"><span class="mission-title">${esc(t.title)}</span></div>
          <div class="mission-story">${esc(String(t.story || '').slice(0, 90))}…</div>
          <div class="mission-meta"><span class="mission-reward-preview">${tr('{0} +{1}XP', tr('Team'), XP)}</span>
            ${done[t.id] ? `<span class="mission-complete-badge">${tr('✓ Complete')}</span>` : ''}</div>
        </div></div>`).join('');
  },

  showTeam(id, k, a) {
    const t = this._teamFind(id);
    const el = document.getElementById('glossaryContent');
    if (!el) return;
    this._teamStyle();
    if (this.currentView !== 'glossary') this.switchView('glossary');
    if (!t) { this.renderMissions(); return; }
    const size = this._teamSize(k, a);
    let html = `<div class="missions-inner">
      <button class="btn-ghost" onclick="app.renderMissions()" style="margin-bottom:.5em">${tr('&larr; All missions')}</button>
      <div class="mission-detail-header"><span class="mission-detail-icon">${esc(t.icon || '👥')}</span>
        <div><div class="tm-kicker">${tr('👥 Group task')}</div><h2 class="mission-detail-title">${esc(t.title)}</h2></div></div>
      <div class="mission-detail-story">${esc(t.story)}</div>`;
    if (!size) html += this._teamSetupHtml(t);
    else {
      const seats = store('pbook-team-seat');
      const s = seats[t.id];
      const seat = size.k === 1 ? 1 : (s && s.k === size.k && s.a === size.a ? s.seat : 0);
      this._team = this._team?.id === t.id && this._team.k === size.k && this._team.a === size.a
        ? Object.assign(this._team, { seat }) : { id: t.id, ...size, seat, talk: { turns: [], lastQ: '' }, chats: {} };
      html += seat ? this._teamTaskHtml(t) : this._teamSeatHtml(t);
    }
    el.innerHTML = html + '</div>';
    window.scrollTo(0, 0);
    const key = `${t.id}~${size?.k}~${size?.a}`;   // once per task and team size, not on every redraw
    if (this._tmLogged !== key) { this._tmLogged = key; this.rc.logEvent('team_open', { teamId: t.id, kids: size?.k ?? null, ai: size?.a ?? null }); }
  },

  // ---------------------------------------------------------------- setup: who is in the team
  _teamSetupHtml(t) {
    const p = this._tmPick || (this._tmPick = { k: 1, a: 1 });
    const kBtn = n => `<button class="${p.k === n ? 'on' : ''}" onclick="app._teamSet('${esc(t.id)}','k',${n})">${n}</button>`;
    const aBtn = n => `<button class="${p.a === n ? 'on' : ''}" ${this._teamSize(p.k, n) ? '' : 'disabled'} onclick="app._teamSet('${esc(t.id)}','a',${n})">${n}</button>`;
    return `<div class="tm-card">
      <div class="tm-kicker">${tr('Who is in the team?')}</div>
      <div style="font-weight:600">${tr('Children')}</div><div class="tm-pick">${[1, 2, 3, 4].map(kBtn).join('')}</div>
      <div style="font-weight:600">${tr('🤖 AI assistants')}</div><div class="tm-pick">${[0, 1, 2, 3].map(aBtn).join('')}</div>
      <div class="tm-small">${tr('A team has 2 to 4 members. Each child opens the task on their own device with the same link.')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:.5em;margin-top:.7em">
        <button class="tm-btn" onclick="app._teamStart('${esc(t.id)}')">${tr('Start')} &rarr;</button>
        ${p.k > 1 ? `<button class="tm-btn ghost" onclick="app._teamCopyLink('${esc(t.id)}')">${tr('🔗 copy link')}</button>` : ''}
      </div></div>`;
  },
  _teamSet(id, key, n) {
    const p = this._tmPick || (this._tmPick = { k: 1, a: 1 });
    p[key] = n;
    if (!this._teamSize(p.k, p.a)) p.a = p.k === 1 ? Math.max(1, Math.min(p.a, 3)) : Math.min(p.a, 4 - p.k);
    if (!this._teamSize(p.k, p.a)) p.a = p.k === 1 ? 1 : 0;
    this.showTeam(id);
  },
  _teamStart(id) {
    const p = this._tmPick || { k: 1, a: 1 };
    try { history.replaceState(null, '', `#tym-${id}~${p.k}~${p.a}`); } catch (e) {}
    this.showTeam(id, p.k, p.a);
  },
  _teamCopyLink(id) {
    const p = this._tmPick || { k: 1, a: 1 };
    const url = this._teamLink(id, p.k, p.a);
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
      .then(() => this.showXPToast(tr('Link copied!'), 'info')).catch(() => { prompt(tr('Copy this link:'), url); });
  },

  // ---------------------------------------------------------------- seat: which child am I
  _teamSeatHtml(t) {
    const tm = this._team;
    return `<div class="tm-card">
      <div class="tm-kicker">${tr('Which number are you?')}</div>
      <div style="font-size:.88rem;margin-bottom:.3em">${tr('Agree in the team who is which number. Each child picks a different one.')}</div>
      <div class="tm-pick">${Array.from({ length: tm.k }, (_, i) => `<button onclick="app._teamSeat(${i + 1})">${i + 1}</button>`).join('')}</div>
    </div>`;
  },
  _teamSeat(n) {
    const tm = this._team;
    if (!tm) return;
    const seats = store('pbook-team-seat');
    seats[tm.id] = { k: tm.k, a: tm.a, seat: n };
    store('pbook-team-seat', seats);
    this.showTeam(tm.id, tm.k, tm.a);
  },
  _teamReseat() {
    const tm = this._team;
    if (!tm) return;
    const seats = store('pbook-team-seat');
    delete seats[tm.id];
    store('pbook-team-seat', seats);
    this.showTeam(tm.id, tm.k, tm.a);
  },

  // ---------------------------------------------------------------- the task
  _teamTaskHtml(t) {
    const tm = this._team, me = tm.seat - 1;
    const done = this._teamsDone()[t.id];
    const card = i => `<div class="tm-row"><span class="tm-letter">${LETTERS[i]}</span><div><b>${esc(t.cards[i]?.label)}</b><div>${esc(t.cards[i]?.text)}</div></div></div>`;
    const mine = this._teamCards(me, tm.n), names = mine.map(i => LETTERS[i]).join(', '), many = mine.length > 1;
    const kicker = tm.k > 1 ? (many ? tr('You are number {0} · your cards {1}', tm.seat, names) : tr('You are number {0} · your card {1}', tm.seat, names))
      : (many ? tr('Your cards {0}', names) : tr('Your card {0}', names));
    let html = `<div class="tm-card tm-mine"><div class="tm-kicker">${kicker}</div>
      ${this._teamCards(me, tm.n).map(card).join('')}</div>`;

    // the rest of the team: children by number, assistants with a chat each
    const others = [];
    for (let m = 0; m < tm.k; m++) if (m !== me) {
      const cs = this._teamCards(m, tm.n);
      const list = cs.map(i => `${LETTERS[i]} (${esc(t.cards[i]?.label)})`).join(', ');
      others.push(`<div class="tm-row">👤&nbsp;${cs.length > 1 ? tr('Number {0} has cards {1}', m + 1, list) : tr('Number {0} has card {1}', m + 1, list)}</div>`);
    }
    for (let j = 1; j <= tm.a; j++) {
      const cs = this._teamCards(tm.k + j - 1, tm.n);
      const label = cs.map(i => `${LETTERS[i]} (${esc(t.cards[i]?.label)})`).join(', ');
      others.push(`<details class="tm-ai" id="tmAi${j}" ${tm.k === 1 && j === 1 ? 'open' : ''}>
        <summary>🤖 ${cs.length > 1 ? tr('AI assistant {0} · cards {1}', j, label) : tr('AI assistant {0} · card {1}', j, label)}</summary>
        <div class="tm-log" id="tmLog${j}">${this._teamLogHtml(j, cs, t)}</div>
        <div class="tm-say"><input id="tmMsg${j}" maxlength="400" placeholder="${tr('Ask the assistant…')}" onkeydown="if(event.key==='Enter')app._teamAsk(${j})">
          <button class="tm-btn" id="tmAsk${j}" onclick="app._teamAsk(${j})">${tr('Send')}</button></div>
      </details>`);
    }
    html += `<div class="tm-card"><div class="tm-kicker">${tr('Your team')}</div>${others.join('')}
      <ol class="tm-steps">
        <li>${tm.k > 1 ? tr('Read your card. Tell the others what is on it in your own words; don\'t just show it.') : tr('Read your card.')}</li>
        ${tm.a ? `<li>${tr('Ask the AI assistants what their cards say. Each one knows only its own card.')}</li>` : ''}
        <li>${tm.k > 1 ? tr('Put all the pieces together and write one answer as a team.') : tr('Put all the pieces together and write one answer.')}</li>
        <li>${tm.k > 1 ? tr('One of you sends it to the dragon. The others then type in the code.') : tr('Send the answer to the dragon.')}</li>
      </ol>
      ${tm.k > 1 ? `<div class="tm-small" style="margin-top:.4em"><a href="#" onclick="event.preventDefault();app._teamReseat()" style="color:var(--accent)">${tr('I am a different number')}</a></div>` : ''}
    </div>`;

    const pending = store('pbook-team-pending')[t.id];
    html += `<div class="boss-card">
      <div class="boss-icon">\u{1F409}</div>
      <h3 class="boss-title">${tr('The team question')}</h3>
      <div class="boss-question">${esc(t.boss?.q)}</div>
      <div class="boss-howto" style="font-size:.8rem;color:var(--text-2);margin:-.2em 0 .6em">${tr('✍️ Your own words are enough: spelling and exact terms don\'t matter.')}</div>
      ${done ? this._teamDoneHtml(t, done) : `<textarea class="boss-answer" id="tmAnswer" rows="5" placeholder="${tr('Our team answer…')}">${esc(pending || '')}</textarea>
      <div class="boss-hint" id="tmHint" style="${pending ? '' : 'display:none'}">${pending ? tr('Your saved answer is back in the box. The examiner could not grade it last time; check it now.') : ''}</div>
      <div class="boss-actions"><button class="boss-submit" id="tmSubmit" onclick="app._teamCheck()">${tr('Check our answer')}</button></div>
      ${tm.k > 1 ? this._teamCodeEntryHtml() : ''}`}
    </div>`;
    return html;
  },

  _teamDoneHtml(t, done) {
    const tm = this._team;
    return `<div class="boss-hint boss-pass" id="tmHint"><b>${tr('✓ Your team has completed this task.')}</b>
      ${tm.k > 1 && done.via !== 'code' ? `<div style="margin-top:.5em">${tr('Show the others in the team this code. They type it in on their device and the task counts for them too.')}</div>
        <div class="tm-code" style="margin:.3em 0">${this._teamCode(t.id)}</div>
        <div class="tm-small">${tr('The code works today and tomorrow.')}</div>` : ''}</div>`;
  },
  _teamCodeEntryHtml() {
    return `<details style="margin-top:.8em;font-size:.85rem"><summary style="cursor:pointer;color:var(--accent)">${tr('Someone else in the team sent the answer?')}</summary>
      <div style="margin-top:.4em">${tr('Type in the code from their screen.')}</div>
      <div class="tm-say" style="padding:.4em 0 0"><input id="tmCode" maxlength="6" autocapitalize="characters" autocomplete="off" style="text-transform:uppercase;letter-spacing:.15em" onkeydown="if(event.key==='Enter')app._teamEnterCode()">
        <button class="tm-btn" onclick="app._teamEnterCode()">${tr('Confirm')}</button></div>
      <div id="tmCodeMsg" class="tm-small" style="margin-top:.3em"></div></details>`;
  },
  _teamEnterCode() {
    const tm = this._team, box = document.getElementById('tmCode');
    if (!tm || !box) return;
    const v = box.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (v && (v === this._teamCode(tm.id) || v === this._teamCode(tm.id, 1))) {
      if (this._teamMarkDone(tm.id, null, 'code')) this.showXPToast(tr('👥 Team task complete! +{0} XP', XP), 'achievement');
      this.showTeam(tm.id, tm.k, tm.a);
    } else {
      const msg = document.getElementById('tmCodeMsg');
      if (msg) msg.textContent = tr('This code does not match. Check it with the one who sent the answer.');
      box.focus();
    }
  },

  // ---------------------------------------------------------------- AI assistants
  _teamLogHtml(j, cs, t) {
    const log = this._team.chats[j] || [];
    const letters = cs.map(i => LETTERS[i]).join(', ');
    const hello = `<div class="tm-msg ai">${cs.length > 1 ? tr('Hi, I am AI assistant {0}. I have cards {1}. What do you want to know?', j, letters)
      : tr('Hi, I am AI assistant {0}. I have card {1}. What do you want to know?', j, letters)}</div>`;
    return hello + log.map(m => `<div class="tm-msg ${m.from === 'ai' ? 'ai' : 'me'}">${esc(m.text)}</div>`).join('');
  },
  // offline, or after many questions, the assistant simply shows its card so the team can go on
  _teamShowCard(j, why) {
    const t = this._teamFind(this._team.id), tm = this._team;
    const cs = this._teamCards(tm.k + j - 1, tm.n);
    const text = cs.map(i => `${LETTERS[i]} · ${t.cards[i]?.label}: ${t.cards[i]?.text}`).join('\n\n');
    (tm.chats[j] = tm.chats[j] || []).push({ from: 'ai', text: `${why}\n\n${text}`, card: true });
  },
  async _teamAsk(j) {
    const tm = this._team, t = tm && this._teamFind(tm.id);
    const box = document.getElementById(`tmMsg${j}`), logEl = document.getElementById(`tmLog${j}`), btn = document.getElementById(`tmAsk${j}`);
    if (!t || !box || !logEl) return;
    const msg = box.value.trim().slice(0, 400);
    if (!msg) { box.focus(); return; }
    const log = (tm.chats[j] = tm.chats[j] || []);
    const cs = this._teamCards(tm.k + j - 1, tm.n);
    log.push({ from: 'me', text: msg });
    box.value = '';
    const redraw = () => { logEl.innerHTML = this._teamLogHtml(j, cs, t); logEl.scrollTop = logEl.scrollHeight; };
    if (log.some(m => m.card)) { this._teamShowCard(j, tr('My card is already here above.')); redraw(); return; }
    if (log.filter(m => m.from === 'me').length > MAX_ASKS) {
      this._teamShowCard(j, tr('We have talked a lot. So that the team can go on, here is my whole card:'));
      redraw(); return;
    }
    redraw();
    logEl.insertAdjacentHTML('beforeend', `<div class="tm-msg ai" id="tmWait${j}"><span class="gen-spinner">${tr('thinking…')}</span></div>`);
    if (btn) btn.disabled = true;
    let reply = '';
    try {
      if (!(await this._probeBoss())) throw new Error('offline');
      const res = await fetch('/api/boss', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'teammate', lang: LANG, assistant: j, title: t.title, story: t.story, question: t.boss?.q,
          cards: cs.map(i => t.cards[i]), message: msg, history: log.slice(0, -1).filter(m => !m.card).slice(-8) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'assistant failed');
      reply = data.reply;
      this.rc.logEvent('team_ai', { teamId: t.id, assistant: j });
    } catch (e) {}
    if (reply) log.push({ from: 'ai', text: reply });
    else this._teamShowCard(j, tr('I can\'t think right now (no connection). So that the team can go on, here is my card:'));
    if (btn) btn.disabled = false;
    redraw();
    box.focus({ preventScroll: true });
  },

  // ---------------------------------------------------------------- the dragon grades the team answer
  async _teamCheck() {
    const tm = this._team, t = tm && this._teamFind(tm.id);
    const answer = (document.getElementById('tmAnswer')?.value || '').trim();
    const hint = document.getElementById('tmHint');
    if (!t || !hint) return;
    hint.style.display = 'block';
    if (answer.length < 20) {
      hint.className = 'boss-hint boss-retry';
      hint.innerHTML = tr('Write a bit more! Try to explain in at least a few sentences.');
      return;
    }
    const talk = tm.talk;
    const btn = document.getElementById('tmSubmit');
    if (await this._probeBoss()) {
      if (btn) { btn.disabled = true; btn.textContent = tr('The examiner is reading… 🧐'); }
      hint.className = 'boss-hint';
      hint.innerHTML = `<span class="gen-spinner">${tr('The dragon considers your answer…')}</span>`;
      try {
        const res = await fetch('/api/boss', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: t.boss.q, hints: t.boss.hints || [], answer, missionTitle: t.title, lang: LANG, dialogue: talk.turns }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'grading failed');
        const g = data.grade;
        this.rc.logEvent('team_graded', { teamId: t.id, score: g.score, verdict: g.verdict, round: talk.turns.length + 1, kids: tm.k, ai: tm.a });
        if (g.verdict === 'pass') {
          if (this._teamMarkDone(t.id, g.score, 'boss')) this.showXPToast(tr('👥 Team task complete! +{0} XP', XP), 'achievement');
          const box = hint.parentElement;
          hint.outerHTML = this._teamDoneHtml(t, { via: 'boss' });
          document.getElementById('tmHint')?.insertAdjacentHTML('afterbegin', `<div style="margin-bottom:.4em">${esc(g.feedback)}${this._bossFairHtml('team', t.id, talk.turns.length + 1, g.verdict)}</div>`);
          box?.querySelectorAll('#tmAnswer, .boss-actions, details').forEach(n => n.remove());
          return;
        }
        talk.lastQ = g.followUp || '';
        hint.className = 'boss-hint boss-retry';
        hint.innerHTML = `${esc(g.feedback)}
          ${g.followUp ? `<div class="boss-guide" style="margin-top:.5em"><div>🐉 <b>${esc(g.followUp)}</b></div>
            <textarea class="boss-answer" id="tmReply" rows="2" style="margin-top:.4em" placeholder="${tr('Your answer to the dragon\'s question…')}"></textarea>
            <button class="boss-submit" id="tmReplyBtn" onclick="app._teamReply()">${tr('Reply to the dragon')}</button></div>` : ''}
          ${this._bossFairHtml('team', t.id, talk.turns.length + 1, g.verdict)}`;
        if (btn) { btn.disabled = false; btn.textContent = tr('Check our answer'); }
        document.getElementById('tmReply')?.focus({ preventScroll: true });
        return;
      } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = tr('Check our answer'); }
      }
    }
    // no examiner: never a pass; the answer waits on this device
    const p = store('pbook-team-pending'); p[t.id] = [answer, ...talk.turns.map(x => x.a)].join('\n').slice(0, 5000); store('pbook-team-pending', p);
    this.rc.logEvent('team_pending', { teamId: t.id });
    hint.className = 'boss-hint';
    hint.innerHTML = tr('<b>The examiner is not reachable right now, so this answer is not graded yet.</b> It is saved on this device; open this mission again later and check it then.');
  },
  _teamReply() {
    const tm = this._team, box = document.getElementById('tmReply');
    const reply = (box?.value || '').trim();
    if (!tm || !box) return;
    if (reply.length < 3) { box.placeholder = tr('Write at least a few words.'); box.focus(); return; }
    tm.talk.turns.push({ q: tm.talk.lastQ, a: reply.slice(0, 800) });
    tm.talk.lastQ = '';
    const btn = document.getElementById('tmReplyBtn');
    if (btn) btn.disabled = true;
    this._teamCheck();
  },
};

export function installTeams(cls) {
  Object.assign(cls.prototype, teamMethods);
}
