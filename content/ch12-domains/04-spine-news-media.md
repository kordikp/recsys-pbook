---
id: ch13-news
type: spine
title: "News & Media: Racing Against the Clock"
readingTime: 3
standalone: true
core: true
teaser: "News recommendation is a race against time — content goes stale in hours, and the stakes include an informed society."
voice: universal
parent: null
diagram: null
recallQ: "What makes news recommendation the hardest domain in RecSys?"
recallA: "Extreme content velocity (articles stale in hours), no repeat consumption, editorial responsibility for information quality, filter bubble risks, and the need for human-in-the-loop editorial curation."
highlights:
  - "Every article is a cold-start item — CF is nearly useless without content features"
  - "Editorial voice preservation (human-in-the-loop) is a key differentiator"
  - "Topic diversity isn't optional — it's a democratic responsibility"
publishedAt: "2026-04-03"
status: accepted
---

News is the most time-sensitive recommendation domain. A breaking story needs to reach users within minutes. An analysis piece has a few days of relevance. Yesterday's headlines are worthless. This extreme content velocity makes news recommendation fundamentally different from every other domain.

## What Makes News Unique

**Every article is cold-start.** A news site publishes hundreds of articles daily. Each one has zero interaction data at publication time. By the time collaborative filtering could learn from interactions, the article is stale. News recommendation must rely heavily on content-based features (topic, entities, sentiment) and contextual signals (trending topics, user's topic preferences).

**No repeat consumption.** Users never re-read an article. Once consumed, it's done. This eliminates a key signal available in music and video — repeat engagement as a quality indicator. The system must model preferences purely from consumption patterns across articles, not from repeated interactions with individual items.

**Editorial responsibility.** A music recommender that plays only pop is a mild annoyance. A news recommender that shows only one political perspective is a societal failure. News platforms have a responsibility that entertainment platforms arguably don't — maintaining information diversity and quality. This is why [human-in-the-loop editorial curation](https://www.recombee.com/domains/articles-news-media) matters more here than in any other domain.

![lottie:human-in-the-loop-achieve-better-results-with-editors-in-charge](Editors guiding algorithmic recommendations to maintain journalistic standards and diversity)

**Breaking news detection.** The system must identify sudden emerging topics and surface them immediately — before there's enough interaction data to know they're important. NLP-based topic detection and velocity monitoring are essential.

![lottie:deliver-breaking-news-in-real-time](Detecting and surfacing breaking stories within minutes of publication)

## Key Scenarios

**Personalized Feed.** The core experience — a stream of articles ranked by relevance to the individual user. Must balance personalization with editorial diversity (topic breadth, viewpoint diversity, local vs. national news).

![Personalized news feed with articles ranked by individual reader relevance and topic diversity](/images/domains/articles-news-media/personalized-news-feed.png)

**Related Articles.** "Read also" sidebar on article pages. Content-based similarity (same topic, same entities) combined with collaborative signals (readers who read this also read...).

**Trending.** What's being read right now — by region, by topic, by demographic. Important for social proof and cultural relevance.

![Trending articles section showing the most-read stories across regions and topics](/images/domains/articles-news-media/trending-articles.png)

**Sections For You.** Personalized ordering of news sections (Politics, Sports, Tech, Local). Each user sees sections in the order that matches their reading patterns.

**Newsletters.** Periodic email digests with personalized article selection. Must include smart rotation and respect email frequency preferences.

**Cross-Site Recommendations.** Media companies often own multiple publications. Recommending across titles ("You read this in the financial paper → you might like this in the tech magazine") creates cross-platform value.

## The Diversity Imperative

News recommendation faces the sharpest version of the filter bubble problem. Standard optimization would narrow each user's feed to their most-engaged topics — creating information silos.

**Practical solutions:**
- **Topic quotas:** Each feed must include articles from at least N different topic categories
- **Viewpoint diversity:** For political topics, include coverage from different editorial perspectives
- **Serendipity slots:** Reserve positions for articles outside the user's typical interests
- **Editorial overrides:** Editors can pin important stories that all users should see, regardless of personalization

![lottie:enhance-content-discoverability-with-diverse-recommendations](Enhancing content discoverability through topic diversity and serendipitous suggestions)

## Real-World Results

- **9GAG:** [+37% Post Views](https://www.recombee.com/case-studies/9gag) through personalized content
- **Unfiltered Media Group:** [+50% CTR](https://www.recombee.com/case-studies/unfiltered-media-group) with recommendations
- **Mafra:** [+40% CTR](https://www.recombee.com/case-studies/mafra) on suggested articles
- **Economia:** [+64% CTR](https://www.recombee.com/case-studies/economia) through personalization

For implementation details, see the [news recommendation recipes](https://docs.recombee.com/recipes/news) and the [news & media domain overview](https://www.recombee.com/domains/articles-news-media).

**Consider this:** News recommendation is where the tension between engagement and responsibility is most acute. An algorithm that maximizes clicks will gravitate toward sensationalism. One that maximizes read-through rate will favor quality but may miss breaking stories. The best news recommenders navigate this tension through explicit multi-objective optimization — with editorial judgment as a first-class input, not an afterthought.