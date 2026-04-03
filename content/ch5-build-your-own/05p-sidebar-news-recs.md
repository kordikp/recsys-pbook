---
id: ch5-news-recs
type: spine
title: "Recommendations for News: When Every Minute Counts"
readingTime: 3
standalone: true
core: false
teaser: "News recommendation is the hardest domain in RecSys — content goes stale in hours, user intent shifts constantly, and the stakes are societal."
voice: universal
parent: null
diagram: null
recallQ: "What makes news recommendation fundamentally different from entertainment recommendation?"
recallA: "Extreme content velocity (articles go stale in hours), no long-term item value, editorial responsibility for information quality, and the risk of creating political filter bubbles."
publishedAt: "2026-04-03"
status: accepted
---

News recommendation is arguably the most challenging domain in recommender systems. Every design decision carries implications not just for engagement, but for an informed society.

## What Makes News Different

**Extreme content velocity.** A news article's useful life is measured in hours, not months. By the time a collaborative filtering model has enough interaction data, the article is stale. Traditional CF approaches that rely on accumulated interactions are nearly useless.

**No repeat consumption.** Users almost never re-read a news article. Once consumed, it's done. This eliminates a key signal that works well for music and video — repeat engagement as a quality indicator.

**Topic diversity is essential.** A music recommender that plays only jazz is fine if you love jazz. A news recommender that shows only one political perspective is a democratic failure. Diversity isn't a nice-to-have — it's a core requirement.

**Editorial responsibility.** News platforms have a societal responsibility that entertainment platforms arguably don't. Recommending misinformation, even if it drives engagement, is actively harmful.

## The Cold-Start Challenge at Scale

Every article is a cold-start item. Typical news sites publish hundreds of articles per day, and each one needs to be recommended within minutes of publication.

**Solutions in practice:**

- **Content-based features:** Analyze the article text (topic, entities, sentiment, complexity) and match to user topic preferences. This works immediately — no interactions needed.
- **Recency-weighted popularity:** New articles get an initial boost based on early engagement signals (first 100 readers' behavior predicts well).
- **Editorial curation + algorithmic ranking:** Editors select a pool of quality articles; the algorithm personalizes the ranking within that curated pool.
- **Contextual bandits:** Thompson Sampling explores new articles aggressively, with rapid prior updates as early signals arrive.

## The Filter Bubble Risk

News recommendation faces the sharpest version of the filter bubble problem. If the system learns that a user engages more with left-leaning commentary, it shows more left-leaning commentary. The user's information diet narrows. Multiply by millions of users and the result is societal polarization — or at least the perception of it.

**Research findings are nuanced:** Bakshy et al. (2015) found that Facebook's algorithm had a relatively small effect on cross-cutting exposure compared to users' own choices. But Guess et al. (2023) showed that removing algorithmic curation on Facebook and Instagram did change content consumption patterns.

**Practical approaches:**
- **Topic diversity requirements:** Ensure each user sees articles from at least N different topic categories
- **Viewpoint diversity:** For political topics, explicitly include coverage from different editorial perspectives
- **Serendipity slots:** Reserve recommendation positions for articles outside the user's typical interests
- **Transparency:** Label why each article was recommended ("Trending," "Based on your interests," "Editor's pick")

## The Google News Approach

Google News uses a multi-signal system:
- **Freshness:** Heavy weight on recency, with topic-adaptive decay (breaking news decays in hours; analysis pieces persist for days)
- **Authority:** Publisher reputation and journalistic quality signals
- **Personalization:** Topic preferences learned from reading history
- **Local relevance:** Geographic signals for local news
- **Diversity:** Explicit coverage from multiple sources on the same story

## Metrics That Matter

Standard RecSys metrics (CTR, session length) are insufficient for news:

| Metric | What It Measures | News-Specific Value |
|--------|-----------------|-------------------|
| CTR | Click-through | Incentivizes clickbait |
| Read-through rate | Fraction of article read | Better quality signal |
| Topic diversity | Breadth of topics consumed | Information diet health |
| Source diversity | Number of publishers seen | Perspective breadth |
| Return rate | Voluntary daily returns | Trust and habit formation |
| Satisfaction survey | User-reported value | Ground truth (sampled) |

## The Telegraph Case Study

[The Daily Telegraph](https://www.recombee.com/case-studies) (from the MFF UK presentation) uses sparse autoencoders to map articles to semantic "neurons" described by an LLM. This enables real-time analytics showing which reader segments engage with which topics — Labour/Tax, F1 Racing, Tory Politics, Justice, Middle East. Editors use this to understand their audience, not just serve them algorithmically.

For a deeper dive into the unique challenges of [news and media recommendations](https://www.recombee.com/domains/articles-news-media), including practical implementation patterns, see the [news recipe documentation](https://docs.recombee.com/recipes/news).

**Consider this:** News recommendation sits at the intersection of technology, editorial judgment, and democratic responsibility. Getting it right requires all three — no algorithm alone can solve it.