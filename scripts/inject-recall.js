#!/usr/bin/env node
// Injects recallQ and recallA into markdown frontmatter from the QUESTIONS map.
// Run once: node scripts/inject-recall.js

const fs = require('fs');
const path = require('path');

const QUESTIONS = {
  'ch1-noticed': { q: 'How do apps like YouTube seem to "know" what you want?', a: 'They track your clicks, watches, and skips to build a picture of your taste — then use algorithms to find similar content.' },
  'ch1-everywhere': { q: 'Name 4 apps that use recommendation algorithms.', a: 'YouTube, TikTok, Spotify, Netflix, Amazon, Instagram, App Store — almost every app you use daily.' },
  'ch1-not-magic': { q: 'Recommendations feel like magic — what are they really based on?', a: 'Patterns! Watch → find patterns → predict. Like a detective finding clues in your clicks.' },
  'ch1-wrong-sidebar': { q: 'Why do recommendations sometimes go hilariously wrong?', a: 'The system only sees clicks, not reasons. If your sibling watches cartoons on your account, it thinks YOU like cartoons!' },
  'ch1-patterns-d-think': { q: 'Why is finding patterns a "superpower" for algorithms?', a: 'Machines can spot patterns across millions of people simultaneously — connections no human could ever find manually.' },
  'ch1-three-jobs': { q: 'What are the 3 jobs of a recommender system?', a: 'DISCOVER new things, FIND things faster in huge catalogs, and ENGAGE — keep you interested.' },
  'ch1-wyr': { q: 'What is the main trade-off in recommendations?', a: 'Better recommendations need more data, but more data means companies know more about you. Privacy vs. personalization.' },
  'ch1-ws-match': { q: 'Name 3 different recommendation models.', a: 'Friend-based, follow-based, interest-based, algorithm-based, and group-based. Most apps use hybrids.' },
  'ch2-footprints': { q: 'What are digital footprints?', a: 'Every click, watch, skip, and search — invisible tracks that teach the system about your taste.' },
  'ch2-track-d-exp': { q: 'Which signal is stronger: clicking a video or watching it to the end?', a: 'Watching to the end is MUCH stronger. The system tracks watch time, not just clicks.' },
  'ch2-guess-signal': { q: 'What is the strongest signal you can send to an algorithm?', a: 'Sharing something! It takes real effort, which tells the system you really care about that content.' },
  'ch2-clues': { q: 'Name the 3 types of clues recommenders use.', a: 'Item clues (what it IS), person clues (who YOU are), action clues (what you DO).' },
  'ch2-incognito-sidebar': { q: 'What is the "cold start" problem?', a: "When you create a new account, the system has zero info — it shows popular stuff until it learns who you are." },
  'ch2-myth': { q: 'True or false: your phone listens to your conversations for ads.', a: "False! Algorithms predict so well from your clicks that it FEELS like they heard you — but they didn't." },
  'ch2-privacy': { q: 'Name 3 tools you have to control your data.', a: '"Not Interested" button, clear history, separate profiles, incognito mode, and app settings.' },
  'ch2-privacy-d-create': { q: 'How fast does an algorithm start personalizing for you?', a: 'Just 5-10 videos! Watch a few cooking videos and your feed fills with cooking in minutes.' },
  'ch2-ws-detective': { q: 'Can you train the algorithm on purpose?', a: "Yes! Search for topics you want, like content deliberately, use \"Not Interested\" on what you don't want." },
  'ch3-friends': { q: 'How does collaborative filtering work?', a: "Find people with similar taste → recommend what THEY liked that you haven't tried yet." },
  'ch3-cf-d-exp': { q: 'What are "taste twins" in collaborative filtering?', a: 'People who liked the same things as you. If they also liked something new, you probably will too!' },
  'ch3-cf-d-create': { q: 'Can you build collaborative filtering without a computer?', a: 'Yes! Survey friends, create a rating grid on paper, find who matches you best, check what they liked.' },
  'ch3-netflix-sidebar': { q: 'What lesson did the Netflix Prize teach about algorithms?', a: "Better accuracy doesn't always win — speed and simplicity matter more than perfection in real systems." },
  'ch3-content': { q: 'How does content-based filtering differ from collaborative?', a: 'Content-based looks at item FEATURES (genre, tags). Collaborative looks at USER BEHAVIOR (who liked what).' },
  'ch3-compare-d-think': { q: 'When is content-based better than collaborative filtering?', a: 'For new items with no ratings yet, and for niche interests. Collaborative is better for surprising discoveries.' },
  'ch3-spot-method': { q: '"Because you watched X" uses which method?', a: '"Fans also listen to" is collaborative filtering. "Because you watched" is content-based!' },
  'ch3-bandits': { q: 'What is the explore-exploit dilemma?', a: "Should the system show safe picks you'll like (exploit) or try new things you might discover (explore)? Both matter." },
  'ch3-deep-similarity': { q: 'What are "embeddings" in recommendation systems?', a: 'Items turned into lists of numbers (vectors). Close vectors = similar items. Neural networks learn these patterns.' },
  'ch3-popular': { q: 'What is the biggest weakness of popularity-based recommendations?', a: "No personalization — everyone sees the same thing. It can't account for YOUR unique taste." },
  'ch3-popular-sidebar': { q: 'What is the "rich-get-richer" problem?', a: 'Popular content gets more visibility → more views → stays popular. New creators get buried forever.' },
  'ch3-pipeline': { q: 'What are the 3 stages of a recommendation pipeline?', a: 'FIND candidates (fast + rough), RANK them (precise scoring), CHECK for diversity.' },
  'ch3-pipeline-d-exp': { q: 'How does YouTube find 20 videos from 800 million in 0.2 seconds?', a: 'Staged pipeline! Quick rough filters narrow 800M to 500 candidates, then careful ranking picks the best 20.' },
  'ch3-speed': { q: 'How long would it take a human to do what YouTube does in 1 second?', a: "25 YEARS! That's why we need algorithms — the scale is impossibly large for humans." },
  'ch3-search-recs': { q: 'Are search results the same for everyone?', a: 'No! Search is increasingly personalized — what you see depends on your history, location, and past behavior.' },
  'ch4-bubbles': { q: 'What is a filter bubble?', a: "When the algorithm only shows you things you already like — you never discover anything new. The bubble is invisible." },
  'ch4-echo-d-think': { q: 'How is an echo chamber worse than a filter bubble?', a: 'Echo chambers make you think EVERYONE agrees with you — different people see different realities about the same topic.' },
  'ch4-experiment': { q: 'How can you break out of a filter bubble?', a: 'Deliberately explore new content! Watch 3 videos on a new topic and your feed will start to change.' },
  'ch4-fairness': { q: 'How can algorithms be unfair to new creators?', a: 'Popular → more recommended → more popular (repeat). New creators never get seen. Good systems give everyone a fair start.' },
  'ch4-youtube-sidebar': { q: 'What percentage of YouTube watch time comes from recommendations?', a: '70%! That means algorithms — not you searching — drive most of what people watch.' },
  'ch4-unfair-game': { q: 'How can platforms make recommendations fairer?', a: 'Random sampling, guaranteed visibility for new content, small-audience testing before scaling.' },
  'ch4-objectives': { q: 'What is the algorithm actually trying to do?', a: "It depends! Subscription services optimize for YOUR happiness. Free/ad services optimize for ADVERTISER revenue." },
  'ch4-explainability': { q: "Why can't platforms fully explain their recommendations?", a: "Neural networks use hundreds of signals — even engineers can't trace exactly why one item was chosen over another." },
  'ch4-testing': { q: 'What is an A/B test?', a: 'Show version A to half the users, version B to the other half, compare real behavior. Data decides, not guessing.' },
  'ch4-ab-d-exp': { q: 'Do personalized recommendations actually work better than "just show popular"?', a: 'Yes! Tests show 37% more songs played, 4x more artist discovery, and higher engagement with personalization.' },
  'ch5-start': { q: 'What are the 4 steps to build a recommendation system?', a: 'Collect data → find similar users → make predictions → test and improve.' },
  'ch5-collect': { q: 'What is a rating matrix?', a: "Users as rows, items as columns, ratings in cells. Most cells are empty — that's what you predict." },
  'ch5-spread-d-create': { q: 'Why can a spreadsheet help you build recommendations?', a: 'Color-coded ratings reveal taste patterns visually — you can see who matches before doing any math.' },
  'ch5-similar': { q: 'How do you find "taste neighbors"?', a: 'Compare ratings on shared items — lower average difference = more similar taste.' },
  'ch5-math-d-think': { q: 'What does cosine similarity measure?', a: 'The angle between two preference vectors — so someone who rates everything low but in the same PATTERN as you is still similar.' },
  'ch5-real-numbers': { q: 'How many possible user-item combinations does Netflix have?', a: '3.4 TRILLION! And most cells are empty. Finding patterns in this sparse data is the core challenge.' },
  'ch5-recommend': { q: 'How do you predict a rating for an unseen item?', a: 'Find 2-3 most similar users who rated it → average their ratings. Above 4 stars = recommend it.' },
  'ch5-code-d-create': { q: 'How many lines of Python does it take to build basic collaborative filtering?', a: 'About 20! Data loading, similarity calculation, and prediction — the same logic Netflix uses, just smaller scale.' },
  'ch5-debug': { q: "Even Netflix's algorithm is wrong how often?", a: "20-30% of the time! Perfection isn't the goal — being right MOST of the time is what matters." },
  'ch5-improve': { q: 'What is the single biggest improvement for a recommendation system?', a: 'More data! More users and more ratings create more connections, which means better matches and predictions.' },
  'ch5-career-sidebar': { q: 'What skills does a recommendation engineer need?', a: 'Math (statistics, linear algebra), programming (Python), creativity, and curiosity about user behavior.' },
  'ch5-get-recommended': { q: 'What matters more to YouTube: clicks or watch time?', a: 'Watch time! A video 100 people watch fully beats 1,000 clicks that leave immediately.' },
  'ch5-seo-algorithms': { q: "Why doesn't \"ranking #1 on Google\" exist anymore?", a: 'Results are personalized — your content can be #1 for your audience and invisible to everyone else.' },
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
  'ch6-hard-d-think': { q: 'Name a hard question about algorithms that nobody has answered yet.', a: "Should kids get different algorithms? Who defines \"harmful\"? Should algorithms show disagreement? No right answers exist yet." },
  'ch6-law-sidebar': { q: 'What right did the EU give people regarding algorithms?', a: "The right to opt OUT of algorithmic recommendations, and a ban on using kids' personal data for targeting." },
  'ch6-conversational': { q: 'How will LLMs change recommendations?', a: "You'll ASK for what you want instead of scrolling. LLMs understand language, recommenders have the data — together they're powerful." },
};

const CONTENT_DIR = path.join(__dirname, '..', 'content');
const book = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, 'book.json'), 'utf8'));

let updated = 0, skipped = 0;

for (const ch of book.chapters) {
  const dir = path.join(CONTENT_DIR, ch.directory);
  for (const file of ch.files) {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) continue;

    const frontmatter = match[1];
    const body = match[2];

    // Extract id
    const idMatch = frontmatter.match(/^id:\s*(.+)$/m);
    if (!idMatch) continue;
    const id = idMatch[1].trim().replace(/^["']|["']$/g, '');

    // Skip if already has recallQ
    if (frontmatter.includes('recallQ:')) { skipped++; continue; }

    // Find question for this ID
    const qa = QUESTIONS[id];
    if (!qa) continue;

    // Escape for YAML (wrap in quotes)
    const q = qa.q.replace(/"/g, '\\"');
    const a = qa.a.replace(/"/g, '\\"');

    // Insert before status line (or at end of frontmatter)
    let newFrontmatter;
    if (frontmatter.includes('status:')) {
      newFrontmatter = frontmatter.replace(/^(status:.*)$/m, `recallQ: "${q}"\nrecallA: "${a}"\n$1`);
    } else {
      newFrontmatter = frontmatter + `\nrecallQ: "${q}"\nrecallA: "${a}"`;
    }

    fs.writeFileSync(filePath, `---\n${newFrontmatter}\n---\n${body}`);
    updated++;
    console.log(`  + ${id}`);
  }
}

console.log(`\nDone: ${updated} files updated, ${skipped} already had recallQ.`);
