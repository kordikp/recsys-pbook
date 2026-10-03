// "Ask the book" — an honest, local question answerer.
//
// It answers ONLY from the concept contracts in content/concepts.json (title,
// objective, mustCover, recallQ/recallA — the human-owned summaries every telling
// is checked against). Retrieval is BM25-lite over those fields; the answer is the
// matching concept's recallA plus a link to its anchor section and its other
// tellings. No language model, no generated text: when nothing in the book
// matches, it says so and offers "propose this concept" or "message the authors".
// (The retrieval half of retrieval-augmented generation, without the generation —
// see the llm-recommenders concept for what the other half adds and risks.)

const STOP = new Set(('the a an and or but of to in on for with by from at as is are was were be been being do does did ' +
  'what whats which who whom whose why how when where can could should would will shall may might must this that these ' +
  'those it its they them their there here about into than then so such not no yes you your yours i me my we our us ' +
  'has have had get gets got make makes made use used using work works explain tell mean means difference between ' +
  'vs versus does doing thing things way ways one ones also just very really some any all more most').split(' '));

const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const stem = w => w.length > 5 ? w.replace(/(ations?|ings?|ers?|ed|es|s)$/, '') : w.length > 3 ? w.replace(/s$/, '') : w;
export const tokenize = s => fold(s).replace(/\\"/g, ' ').split(/[^a-z0-9]+/).filter(w => w.length >= 2 && !STOP.has(w)).map(stem);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clean = s => String(s || '').replace(/\\"/g, '"').replace(/ -- /g, ' – ');

// field → weight
const FIELDS = { title: 4, id: 3, recallQ: 2, objective: 1.5, mustCover: 1, recallA: 1, anchor: 1 };

export class AskTheBook {
  constructor(app) {
    this.app = app;
    this._index = null;
    this._indexKey = '';
  }

  resetConversation() {}

  _build() {
    const concepts = Object.values(this.app.concepts || {});
    const key = concepts.length + ':' + (concepts[0]?.id || '');
    if (this._index && this._indexKey === key) return this._index;
    const docs = concepts.map(c => {
      const k = c.contract || {};
      const f = {
        title: tokenize(c.title), id: tokenize(c.id), recallQ: tokenize(k.recallQ), objective: tokenize(k.objective),
        mustCover: tokenize((k.mustCover || []).map(p => p.point || p).join(' ')), recallA: tokenize(k.recallA),
        anchor: (m => tokenize(m ? `${m.title || ''} ${m.teaser || ''}` : ''))(this.app.findBlock?.(c.anchor)?.meta),
      };
      const tf = {};
      for (const [field, words] of Object.entries(f)) for (const w of words) tf[w] = (tf[w] || 0) + FIELDS[field];
      return { c, tf, titleFold: fold(c.title) };
    });
    const df = {};
    docs.forEach(d => Object.keys(d.tf).forEach(w => { df[w] = (df[w] || 0) + 1; }));
    const N = docs.length || 1;
    const idf = w => Math.log(1 + N / (df[w] || 0.5));
    this._index = { docs, idf, df };
    this._indexKey = key;
    return this._index;
  }

  // → [{ concept, score, coverage }] best first
  search(query, limit = 3) {
    const { docs, idf, df } = this._build();
    const q = [...new Set(tokenize(query))];
    if (!q.length) return [];
    const known = q.filter(w => df[w]);
    const qMass = q.reduce((s, w) => s + idf(w), 0) || 1;
    const qf = fold(query);
    return docs.map(d => {
      let score = 0, hit = 0;
      for (const w of known) {
        const tf = d.tf[w];
        if (!tf) continue;
        score += idf(w) * (tf * 2.2) / (tf + 1.2);
        hit += idf(w);
      }
      if (d.titleFold.length > 4 && qf.includes(d.titleFold)) score += 8;      // the concept named outright
      return { concept: d.c, score, coverage: hit / qMass };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  }

  // Interface kept from the old engine: generateResponse(message, context) → { text, confidence, canEscalate }
  generateResponse(message) {
    const app = this.app;
    const res = this.search(message, 3);
    const top = res[0];
    const n = Object.keys(app.concepts || {}).length;
    if (!top || top.coverage < 0.34 || top.score < 2) {
      const seed = esc(String(message).slice(0, 160)).replace(/'/g, '&#39;');
      return {
        confidence: 0,
        canEscalate: false,
        text: `I could not find that in the book. I only answer from its ${n} concept summaries, so I would rather say so than guess.
          <div class="ask-actions">
            <button class="tutor-suggest-btn" onclick="app.proposeConcept(this.dataset.q)" data-q="${seed}">🌱 Suggest it as a new topic</button>
            <button class="tutor-suggest-btn" onclick="app.escalateToAuthor()">✉ Send the question to the authors</button>
          </div>`,
      };
    }
    const card = (r, lead) => {
      const c = r.concept, k = c.contract || {};
      const tellings = (app.conceptBlocks?.[c.id] || []).filter(b => b.meta.type === 'spine').length;
      // draft anchor (admin preview only): point at a visible telling instead
      const anchor = app.findBlock(c.anchor) || (app.conceptBlocks?.[c.id] || []).find(b => b.meta.type === 'spine') || null;
      const ch = app._conceptChapterNum ? app._conceptChapterNum(c.id) : '';
      return `<div class="ask-card${lead ? '' : ' ask-card-related'}">
        <div class="ask-kicker">${lead ? 'From the book' : 'Related'} · Chapter ${esc(ch)}</div>
        <div class="ask-title">${esc(c.title)}</div>
        ${lead && k.recallQ ? `<div class="ask-q">${esc(clean(k.recallQ))}</div>` : ''}
        <p class="ask-a">${esc(clean(k.recallA || k.objective || ''))}</p>
        ${anchor ? `<button class="tutor-suggest-btn" onclick="app.openBlock('${esc(anchor.meta.id)}','ask')">Read: ${esc(anchor.meta.title || c.title)} →</button>` : ''}
        ${lead && tellings > 1 ? `<span class="ask-note">${tellings} ways to read it in the book</span>` : ''}
      </div>`;
    };
    const related = res.slice(1).filter(r => r.score >= top.score * 0.6 && r.coverage >= 0.34).slice(0, 1);
    return {
      confidence: Math.min(1, top.coverage),
      canEscalate: true,
      text: card(top, true) + related.map(r => card(r, false)).join('') +
        '<div class="ask-source">Answered from the book’s concept summaries — no AI model involved.</div>',
    };
  }

  // Questions the book can actually answer about this section: its concept's
  // recall question, then the recall questions of neighbouring concepts.
  getSuggestedQuestions(block) {
    const app = this.app;
    if (!block) return [];
    const cid = app._conceptIds ? app._conceptIds(block.meta)[0] : null;
    const order = app._conceptOrder ? app._conceptOrder() : Object.keys(app.concepts || {});
    const i = order.indexOf(cid);
    const ids = [cid, order[i + 1], order[i - 1]].filter(id => id && app.concepts?.[id]?.contract?.recallQ);
    return ids.slice(0, 3).map(id => clean(app.concepts[id].contract.recallQ));
  }
}

// Conversation manager — persists chat history
export class ConversationManager {
  constructor() {
    this.conversations = [];
    this.authorMessages = [];
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem('pbook-conversations') || '{}');
      this.conversations = data.conversations || [];
      this.authorMessages = data.authorMessages || [];
    } catch (e) {}
  }

  save() {
    try {
      // Keep last 20 conversations
      const recent = this.conversations.slice(-20);
      localStorage.setItem('pbook-conversations', JSON.stringify({
        conversations: recent,
        authorMessages: this.authorMessages
      }));
    } catch (e) {}
  }

  getOrCreateConversation(blockId, chapterId) {
    // Find recent active conversation for this context
    const recent = this.conversations.find(c =>
      c.status === 'active' &&
      c.context.blockId === blockId &&
      Date.now() - c.startedAt < 30 * 60 * 1000 // within 30 min
    );
    if (recent) return recent;

    const conv = {
      id: 'conv-' + Date.now(),
      startedAt: Date.now(),
      context: { blockId, chapterId },
      messages: [],
      status: 'active'
    };
    this.conversations.push(conv);
    this.save();
    return conv;
  }

  addMessage(convId, role, text, extra = {}) {
    const conv = this.conversations.find(c => c.id === convId);
    if (!conv) return;
    conv.messages.push({ role, text, timestamp: Date.now(), ...extra });
    this.save();
  }

  escalateToAuthor(convId, question, blockId, readerProfile) {
    const msg = {
      id: 'msg-' + Date.now(),
      conversationId: convId,
      blockId,
      question,
      readerProfile: {
        level: readerProfile.level,
        xp: readerProfile.xp,
        readCount: readerProfile.readBlocks?.size || 0
      },
      status: 'pending',
      createdAt: Date.now()
    };
    this.authorMessages.push(msg);

    const conv = this.conversations.find(c => c.id === convId);
    if (conv) conv.status = 'escalated';

    this.save();
    return msg;
  }

  getAuthorMessageCount() {
    return this.authorMessages.filter(m => m.status === 'pending').length;
  }
}
