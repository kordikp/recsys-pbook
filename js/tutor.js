// TutorEngine — Mock implementation with LLM-ready interface
// Architecture: TutorEngine.generateResponse(message, context) → response
// MockTutorEngine: keyword search + kid-friendly templates + author escalation
// LLMTutorEngine: future drop-in replacement via Netlify function → Claude API

export class MockTutorEngine {
  constructor() {
    this._usedBlocks = new Set(); // avoid repeating same blocks in a conversation
  }

  resetConversation() {
    this._usedBlocks.clear();
  }

  generateResponse(message, context) {
    const { allBlocks, topicIndex, currentBlockId, currentChapterId, userProfile } = context;
    const q = message.toLowerCase().trim();

    // Detect question type
    const qType = this._detectQuestionType(q);

    // Score blocks with context awareness
    const scored = allBlocks.map(b => {
      let score = 0;
      const title = (b.meta.title || '').toLowerCase();
      const body = (b.body || '').toLowerCase();
      const words = q.split(/\s+/).filter(w => w.length >= 3);

      for (const word of words) {
        if (title.includes(word)) score += 5;
        if (body.includes(word)) score += 1;
      }

      // Boost current chapter content 3x
      if (currentChapterId && b._chapter === currentChapterId) score *= 3;
      // Boost current block's related content
      if (currentBlockId && b.meta.parent === currentBlockId) score *= 2;
      // Penalize already-shown blocks
      if (this._usedBlocks.has(b.meta.id)) score *= 0.3;

      return { block: b, score };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);

    // Find matching topics
    const matchTopics = Object.keys(topicIndex || {}).filter(t =>
      t.toLowerCase().includes(q) || q.includes(t.toLowerCase().split(' ')[0])
    );

    // Calculate confidence
    const topScore = scored[0]?.score || 0;
    const confidence = Math.min(1, topScore / 15); // normalize: 15+ = high confidence

    // Track used blocks
    scored.forEach(s => this._usedBlocks.add(s.block.meta.id));

    // Build response
    const blocks = scored.map(s => ({
      id: s.block.meta.id,
      title: s.block.meta.title,
      chapter: s.block.meta._chapterNum,
      score: s.score
    }));

    if (confidence < 0.1) {
      return {
        text: this._noMatchResponse(),
        blocks: [],
        followUp: 'Try asking about recommendations, algorithms, filter bubbles, or how YouTube works!',
        confidence: 0,
        canEscalate: true
      };
    }

    const top = scored[0].block;
    const teaser = top.meta.teaser || (top.body || '').substring(0, 180).replace(/[#*_\[\]]/g, '').trim();

    let text = this._openingLine(qType, confidence);
    text += `<b>${top.meta.title}</b> (Chapter ${top.meta._chapterNum}) is about exactly this! `;
    text += `${teaser}... `;
    text += `<br><br><a href="#" onclick="event.preventDefault();app.openBlock('${top.meta.id}')">Read this section &rarr;</a>`;

    if (scored.length > 1) {
      text += '<br><br>You might also like:';
      scored.slice(1, 3).forEach(s => {
        text += `<br>&bull; <a href="#" onclick="event.preventDefault();app.openBlock('${s.block.meta.id}')">${s.block.meta.title}</a> (Ch${s.block.meta._chapterNum})`;
      });
    }

    if (matchTopics.length > 0) {
      text += '<br><br>Related topics: ';
      text += matchTopics.slice(0, 3).map(t =>
        `<a href="#" onclick="event.preventDefault();app.showTopic('${t}')">${t}</a>`
      ).join(' &middot; ');
    }

    const followUp = this._socraticFollowUp(qType, top);

    return { text, blocks, followUp, confidence, canEscalate: confidence < 0.3 };
  }

  _detectQuestionType(q) {
    if (/^(why|how come|what makes)/.test(q)) return 'why';
    if (/^(how|how do|how does|how can)/.test(q)) return 'how';
    if (/^(what if|what would|imagine)/.test(q)) return 'whatif';
    if (/^(what is|what are|what's|define|explain)/.test(q)) return 'what';
    if (/^(can you|could you|tell me|show me)/.test(q)) return 'request';
    return 'general';
  }

  _openingLine(qType, confidence) {
    const lines = {
      why: ["Great question! Pavel talks about this in the book. ", "That's exactly what Pavel asked when designing Recombee! ", "You're thinking like a real engineer! "],
      how: ["Let me show you — Pavel explains this really well. ", "Good question! Here's how it works: ", "Pavel would break this down like this: "],
      whatif: ["Ooh, Pavel loves these thought experiments! ", "Interesting! At Recombee we think about this a lot. ", "Let's explore that idea! "],
      what: ["Good question! Let me check what Pavel wrote about this. ", "Here's what that means: ", "Pavel explains this in the book: "],
      request: ["Sure! Let me find the right section for you. ", "On it! ", "Happy to help — that's what I'm here for! "],
      general: ["Let me look that up in the book! ", "Interesting question! ", "Here's what I found: "]
    };
    const options = lines[qType] || lines.general;
    return options[Math.floor(Math.random() * options.length)];
  }

  _socraticFollowUp(qType, topBlock) {
    const followUps = {
      why: [
        'Can you think of a real-life example where this matters?',
        'What do you think would happen if we did the opposite?',
        'Why do you think engineers designed it this way?'
      ],
      how: [
        'Could you explain this process to a friend in simple words?',
        'What part of this process do you think is hardest for a computer?',
        'Can you think of a situation where this method would fail?'
      ],
      whatif: [
        'What evidence would you need to test that idea?',
        'How would you design an experiment to find out?',
        'What are the possible downsides of that approach?'
      ],
      what: [
        'Can you think of an everyday example of this?',
        'How is this different from what you expected?',
        'What surprised you most about this concept?'
      ],
      general: [
        'What about this topic interests you the most?',
        'Would you like to explore the hands-on activities related to this?',
        'Try explaining what you learned to someone — it helps it stick!'
      ]
    };
    const options = followUps[qType] || followUps.general;
    return options[Math.floor(Math.random() * options.length)];
  }

  _noMatchResponse() {
    const responses = [
      "Hmm, Pavel didn't write about that in this book! I'm best at explaining recommendation systems. Try asking about <b>how YouTube picks videos</b>, <b>filter bubbles</b>, or <b>collaborative filtering</b>!",
      "That's outside what Pavel covered here! But I'd love to help with <b>how apps learn your taste</b>, <b>A/B testing</b>, or <b>the cold start problem</b>. Or you can message the real Pavel!",
      "I couldn't find that in the book. Pavel focused on <b>algorithms</b>, <b>privacy</b>, <b>digital footprints</b>, and <b>building your own recommendation system</b> — ask me about any of those!"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Generate suggested questions based on current block content
  getSuggestedQuestions(block) {
    if (!block) return [];
    const body = (block.body || '').toLowerCase();
    const title = block.meta?.title || '';
    const questions = [];

    if (body.includes('collaborative')) questions.push('How does collaborative filtering actually find similar people?');
    if (body.includes('content-based')) questions.push('What features does content-based filtering look at?');
    if (body.includes('cold start')) questions.push('How do apps handle brand new users with no data?');
    if (body.includes('filter bubble') || body.includes('echo chamber')) questions.push('How can I escape my filter bubble?');
    if (body.includes('a/b test')) questions.push('How do companies decide which version is better?');
    if (body.includes('privacy') || body.includes('data')) questions.push('What data do apps collect about me?');
    if (body.includes('popular') || body.includes('trending')) questions.push('Why is "most popular" not always the best recommendation?');
    if (body.includes('pipeline') || body.includes('candidate')) questions.push('What are the steps in a recommendation pipeline?');
    if (body.includes('fair') || body.includes('bias')) questions.push('Can recommendation systems be unfair?');
    if (body.includes('autoplay') || body.includes('addictive')) questions.push('Why is it so hard to stop scrolling?');
    if (body.includes('dopamine')) questions.push('What does dopamine have to do with recommendations?');
    if (body.includes('youtube') || body.includes('tiktok')) questions.push('How does the YouTube algorithm actually work?');

    // Fallback
    if (questions.length === 0) {
      questions.push(`What is the main idea of "${title}"?`);
      questions.push(`Why is this topic important?`);
    }

    return questions.slice(0, 3);
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
