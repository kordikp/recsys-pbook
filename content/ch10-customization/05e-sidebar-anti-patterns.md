---
id: ch5-anti-patterns
type: spine
title: "RecSys Anti-Patterns: Mistakes Everyone Makes"
readingTime: 4
standalone: true
core: false
teaser: "The most instructive lessons in recommendation engineering come from failures. These eight anti-patterns have derailed systems at companies of every scale -- and recognizing them early can save months of wasted effort."
voice: universal
parent: null
diagram: null
recallQ: "What is the most dangerous recommender system anti-pattern?"
recallA: "The Popularity Feedback Loop -- popular items get recommended more, receive more interactions, and become even more popular, while new and niche content is permanently buried. It is self-reinforcing and, once entrenched, extremely difficult to reverse."
publishedAt: "2026-04-03"
status: accepted
---

Every recommendation system that reaches production will eventually exhibit at least one of these failure modes. They are not signs of incompetence -- they emerge naturally from reasonable-sounding decisions. The difference between a mediocre system and a great one is how quickly the team recognizes these patterns and corrects course.

## 1. The Accuracy Trap

**The anti-pattern:** The team optimizes relentlessly for offline accuracy metrics -- precision, recall, RMSE -- and celebrates when the model achieves 0.95 recall on a held-out test set. Then they deploy it and users complain that recommendations feel repetitive, predictable, and boring.

**Why it happens:** Accuracy metrics are easy to measure, easy to optimize, and easy to report to stakeholders. They provide a clean, single-number summary of model quality. The problem is that they measure how well the system predicts what users *already did*, not what users *want to discover*. A system that recommends the 20 most obvious items for each user can score extremely well on recall while providing zero value.

**How to detect it:** Compare your top-k recommendations against a random sample of users. If every user's list looks nearly identical, or if the lists contain only items the user has already seen variants of, accuracy is masking a deeper problem. Track diversity metrics (intra-list diversity), novelty (how surprising recommendations are relative to popularity), and coverage (what fraction of the catalog is ever recommended).

**How to fix it:** Adopt a multi-objective evaluation framework. Accuracy is necessary but not sufficient. Add diversity, novelty, serendipity, and coverage to your evaluation suite. Use re-ranking strategies that introduce controlled diversity -- for example, Maximal Marginal Relevance (MMR) or determinantal point processes (DPPs) -- to balance relevance with variety. Accept a small accuracy trade-off in exchange for a dramatically better user experience.

## 2. The Popularity Feedback Loop

**The anti-pattern:** Popular items appear in recommendations. Users interact with them because they are visible. Those interactions make the items more popular. The system recommends them even more aggressively. New content, niche content, and long-tail items are permanently buried. This is the Matthew effect: "the rich get richer."

**Why it happens:** Collaborative filtering learns from interaction data, and interaction data is inherently biased toward items that were already shown to users. The system never observes what would have happened if it had recommended a different item. It confuses "this item was clicked because it was shown" with "this item was clicked because it is genuinely good."

**How to detect it:** Plot the distribution of recommendations across your catalog. If a small fraction of items (say, 5%) accounts for the vast majority of recommendations (say, 90%), the feedback loop is active. Track catalog coverage over time -- if it is shrinking, the loop is tightening. Monitor the "Gini coefficient" of recommendation frequency; a high value indicates extreme concentration.

**How to fix it:** Introduce exploration mechanisms. Epsilon-greedy strategies reserve a fraction of recommendation slots for random or underexposed items. Thompson sampling and Upper Confidence Bound (UCB) bandits balance exploitation with principled exploration. Inverse propensity scoring (IPS) can debias training data by upweighting interactions with items that had low exposure. Most importantly, build a dedicated pipeline for surfacing new and cold-start content rather than relying solely on collaborative signal.

## 3. Overfitting to Power Users

**The anti-pattern:** The top 1% of users generate 30% of the interaction data. The model trains disproportionately on their behavior. Recommendations become excellent for heavy users and irrelevant for casual users -- who represent 80% or more of the user base.

**Why it happens:** Standard training procedures weight all interactions equally, which means users who interact 500 times per day contribute 500 times more gradient signal than users who interact once per week. The model learns the preferences of power users in exquisite detail and treats casual users as noisy afterthoughts.

**How to detect it:** Segment your evaluation metrics by user activity level. If precision@10 for the top decile of users is 0.45 but for the bottom decile is 0.08, the model is overfitting to heavy users. Conduct qualitative reviews: pull up recommendations for a newly registered user with 3 interactions and ask whether the list makes sense.

**How to fix it:** Subsample or cap per-user contributions during training. If a user has 10,000 interactions, sample 200 per training epoch. Use importance weighting to rebalance the training distribution toward the median user. Build separate models or model components for different user segments -- a lightweight content-based model for new users and a deep collaborative model for established users. Evaluate on stratified user cohorts, not just aggregate metrics.

## 4. Ignoring Temporal Dynamics

**The anti-pattern:** The model treats all interactions as equally informative regardless of when they occurred. A user who binge-watched horror films two years ago during October still gets horror recommendations in July, long after their interests shifted. The system has no concept of "now."

**Why it happens:** Most introductory collaborative filtering tutorials present the user-item matrix as a static snapshot. Adding time awareness requires more complex architectures -- temporal decay functions, session-aware models, or sequential recommendation approaches -- and complicates both training and serving infrastructure.

**How to detect it:** Sample users who have been active for more than a year. Compare their recent interactions with the system's current recommendations. If there is a significant mismatch -- the user is watching documentaries but the system recommends action films from six months ago -- temporal dynamics are being ignored. Track a "recommendation freshness" metric: the average age of items in recommendation lists.

**How to fix it:** Apply exponential decay to interaction weights, so recent behavior contributes more than historical behavior. Use session-based models (GRU4Rec, SASRec, BERT4Rec) that model sequential patterns and capture evolving preferences. Implement sliding-window training that drops interactions older than a configurable threshold. For systems with strong seasonal patterns, incorporate time-of-year and time-of-day features. The key insight is that user preferences are not stationary -- they are a time series, and the model should treat them accordingly.

## 5. The Cold Start Avoidance

**The anti-pattern:** When a new user signs up or a new item enters the catalog, the system defaults to "most popular" and calls it a day. The cold-start problem is acknowledged but never actively solved. New users receive generic recommendations. New items never escape obscurity.

**Why it happens:** Cold start is genuinely hard, and "most popular" is a surprisingly strong baseline. It is easy to implement, requires no additional infrastructure, and performs adequately in aggregate metrics. Teams under delivery pressure rationally choose to optimize the warm-user experience (where they have data) and defer the cold-start problem indefinitely.

**How to detect it:** Measure the conversion rate and engagement of new users during their first session compared to established users. If new users have dramatically lower engagement, the onboarding experience is failing. For new items, track the time from catalog entry to first recommendation -- if it takes weeks for new items to appear in any recommendation list, cold start is not being addressed.

**How to fix it:** For new users: implement an onboarding flow that elicits a small number of explicit preferences (Spotify's "choose 3 artists you like"). Use contextual bandits that learn quickly from initial interactions. Leverage demographic or registration data as prior signals. For new items: use content-based features (metadata, text embeddings, image features) to compute similarity with existing items and bootstrap collaborative signal. Apply explore-exploit strategies that deliberately surface new items to a small fraction of users and gather feedback rapidly. Transfer learning from related domains can also provide useful priors for entirely new item types.

## 6. Optimizing for Clicks, Not Satisfaction

**The anti-pattern:** The system is trained to maximize click-through rate (CTR). It learns to surface provocative thumbnails, sensational titles, and curiosity-gap content. CTR goes up. User satisfaction goes down. Long-term retention degrades as users lose trust in the system's recommendations.

**Why it happens:** Clicks are abundant, immediate, and easy to log. Satisfaction is diffuse, delayed, and hard to measure. When the objective function rewards clicks, the model will find every shortcut to generate them -- including recommending items that users click on but immediately abandon, regret consuming, or find misleading.

**How to detect it:** Compare CTR with downstream engagement metrics: watch time, completion rate, return visits, and "would you recommend this?" survey responses. If CTR is rising but completion rate is falling, the system is recommending clickbait. Track the "click-to-satisfaction ratio" -- the fraction of clicks that result in meaningful engagement (for example, watching more than 50% of a video or reading more than 30 seconds of an article).

**How to fix it:** Replace or augment CTR with satisfaction-oriented objectives. YouTube famously shifted from optimizing clicks to optimizing watch time, and later to a weighted combination of engagement signals that penalizes regretful consumption. Use composite reward functions that combine short-term signals (click) with medium-term signals (dwell time, completion) and long-term signals (return rate, subscription). Implement explicit feedback mechanisms -- thumbs up/down, "not interested" -- and incorporate them into the training signal. When in doubt, optimize for the metric that best predicts 30-day retention.

## 7. The Feature Kitchen Sink

**The anti-pattern:** The team adds every available feature to the model: user demographics, device type, screen resolution, ISP, weather, day of week, moon phase, stock market indices. The model becomes massive, slow to train, and -- counterintuitively -- less accurate. Every new feature adds noise alongside signal, and eventually the noise wins.

**Why it happens:** Feature engineering feels productive. Each new feature represents a plausible hypothesis ("maybe users prefer different content on mobile vs. desktop"). Without rigorous feature selection, teams accumulate hundreds of features because removing any one feature rarely causes a measurable degradation. The model gradually becomes a kitchen sink of marginally useful signals.

**How to detect it:** Run ablation studies. Remove features one at a time (or in groups) and measure the impact on evaluation metrics. If removing 40% of features changes performance by less than 0.1%, those features are noise. Monitor training time and model size -- if they have grown 10x while performance improved 2%, the signal-to-noise ratio is deteriorating. Check for multicollinearity: highly correlated features add complexity without adding information.

**How to fix it:** Adopt a disciplined feature selection process. Use L1 regularization (Lasso) to automatically zero out low-value features. Run systematic ablation studies before adding any new feature to production. Apply the principle of parsimony: the best model is the simplest one that achieves the performance target. Implement feature importance tracking in your training pipeline and regularly prune features that contribute less than a meaningful threshold. Treat feature count as a cost, not an achievement.

## 8. Ignoring Position Bias

**The anti-pattern:** Items shown at position 1 in a list receive dramatically more clicks than items at position 10, regardless of quality. The model observes these clicks and concludes that position-1 items are better. It learns to rank popular, previously-top-ranked items even higher, while items that were never given a prominent position are assumed to be low quality -- because they were never clicked in a position where clicking was likely.

**Why it happens:** Position bias is an instance of a broader problem: confounding exposure with preference. Standard click-through data does not distinguish "the user liked this item" from "the user clicked because it was the first thing they saw." Most training pipelines treat all clicks as positive signal and all non-clicks as negative signal, without accounting for the position in which each item was displayed.

**How to detect it:** Run a randomization experiment: shuffle the order of a small fraction of recommendation lists and observe how click-through rate changes by position. If position 1 consistently gets 5-10x the clicks of position 5 regardless of what item occupies each slot, position bias is significant. Alternatively, analyze whether the same item receives different click rates when shown at different positions -- this is the most direct evidence.

**How to fix it:** Log the position at which each item was displayed alongside the click/no-click outcome. During training, use inverse propensity scoring to weight interactions by the inverse of the position's click probability -- an item clicked at position 8 should receive more credit than an item clicked at position 1. Alternatively, train a separate position bias model (a "propensity model") and subtract its contribution from the click signal. Unbiased Learning to Rank (ULTR) methods, including dual learning architectures that jointly estimate relevance and position bias, are now mature enough for production use. The critical first step is simply logging position data -- without it, correction is impossible.

---

These anti-patterns are not academic curiosities. Every major recommendation platform has encountered most of them, and several have written public postmortems describing the damage. The common thread is that each anti-pattern produces metrics that *look* good while the user experience quietly degrades. The antidote is a combination of diverse evaluation metrics, regular qualitative review of actual recommendations, and a healthy skepticism toward any single number that claims to summarize system quality.
