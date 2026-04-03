---
id: ch5-improve
type: spine
title: "Step 4: Make It Better"
readingTime: 3
standalone: true
core: true
teaser: "Your system works. Now let's iterate toward production quality."
voice: universal
parent: null
diagram: null
recallQ: "What is the single biggest improvement for a recommendation system?"
recallA: "More data. More users and more ratings increase matrix density, which means better neighbor matching and more accurate predictions."
status: accepted
---

You've built a working recommendation system. If you've evaluated it, you've likely noticed that some predictions are accurate while others are significantly off.

Welcome to the reality of recommendation engineering. The system is never "done." Iteration is the norm. Here are the proven strategies for improvement:

**1. Increase data density**

The single most impactful improvement is more data. If you surveyed 10 users, recruit 20. If you used 10 items, expand to 20. Higher matrix density means more co-rated items per user pair, which yields more reliable similarity estimates. Netflix's recommendation quality is directly tied to their 200+ million users generating billions of ratings.

**2. Incorporate item features (hybrid filtering)**

Pure collaborative filtering uses only ratings. But items have metadata -- genre, director, release year, tags. A user who highly rates Parasite and Oppenheimer likely appreciates ambitious, auteur-driven films. You can boost predictions for similar items even when collaborative signal is sparse.

This is **content-based filtering**, and combining it with collaborative filtering creates a **hybrid system** -- the approach most production systems use.

**3. Address the cold-start problem**

A newly added item with zero ratings will never be recommended by a pure CF system. Strategies include: giving new items a temporary exploration boost, using content features to bootstrap predictions, or applying bandit algorithms that balance exploitation (recommending known-good items) with exploration (surfacing new items to gather signal).

**4. Diversify recommendations**

Optimizing purely for predicted rating produces homogeneous recommendation lists. Research shows that users value diversity -- a mix of highly relevant items and serendipitous discoveries. Consider adding a diversity penalty: re-rank the list to ensure coverage across genres, categories, or content types. The metric to track here is **intra-list diversity (ILD)**.

**5. Leverage implicit feedback**

Explicit ratings (1-5 stars) are sparse -- most users never rate items. But implicit signals are abundant: views, clicks, dwell time, purchases, shares, skips, and replays. A product someone purchased three times is clearly a favorite, even without a star rating. Production systems weight implicit signals heavily, often using models like **Implicit ALS** or **Bayesian Personalized Ranking (BPR)**.

**6. Validate every change with A/B testing**

Every improvement hypothesis should be tested empirically. Adding content features might help predictions -- or it might introduce noise. You won't know until you run a controlled experiment. Offline metrics (MAE, nDCG) provide directional signal, but online A/B tests measuring user engagement are the gold standard.

**The big picture:** You're now thinking like a recommendation engineer. You built a system, evaluated it against ground truth, identified failure modes, and formulated improvement hypotheses. This is exactly the iterative process used at YouTube, Spotify, Netflix, and every company operating a recommendation platform.

**Consider this:** Which improvement would most benefit your specific system? Implement one change, re-evaluate your MAE, and compare. This hypothesis-driven iteration is the scientific method applied to engineering.
