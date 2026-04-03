---
id: ch5-recommend
type: spine
title: "Step 3: Make Your Predictions"
readingTime: 3
standalone: true
core: true
teaser: "Use nearest neighbors to predict ratings and generate actionable recommendations."
voice: universal
parent: null
diagram: null
recallQ: "How do you predict a rating for an unseen item?"
recallA: "Find 2-3 most similar users who rated it → compute weighted average of their ratings. Above threshold = recommend."
status: accepted
---

You have your rating matrix. You know each user's nearest neighbors. Now for the core step: **predicting ratings and generating recommendations.**

**The Method (k-Nearest Neighbors):**

For every empty cell in your matrix (an item a user hasn't rated), follow this procedure:

1. Identify the k most similar users (k=2 or k=3 is a good starting point) who DID rate that item
2. Collect their ratings
3. Compute the (optionally weighted) average
4. That average is your **predicted rating**

**Example:**

Bob hasn't rated The Grand Budapest Hotel. Who are Bob's nearest neighbors?

From Step 2, we determined:
- Alice is very similar to Bob (low distance / high similarity)
- Diana is moderately similar to Bob (medium similarity)

Alice rated Grand Budapest Hotel: **3 stars**
Diana rated Grand Budapest Hotel: **4 stars**

Predicted rating for Bob = (3 + 4) / 2 = **3.5 stars**

A moderate prediction -- suggests Bob would find it decent but not outstanding.

**Generating the Recommendation List:**

Apply this for every item Bob hasn't rated:

| Item Bob hasn't rated | Predicted rating |
|---|---|
| The Grand Budapest Hotel | 3.5 |
| Dune: Part Two | 4.5 |
| No Country for Old Men | 2.0 |
| Interstellar | 4.0 |

**Your recommendation threshold:** Items predicted at **4 stars or above** get recommended.

Recommendations for Bob:
1. Dune: Part Two (predicted: 4.5)
2. Interstellar (predicted: 4.0)

Items below threshold are filtered: No Country for Old Men (2.0) and Grand Budapest Hotel (3.5).

**Now validate!**

This is the most critical step. Return to Bob (or whichever user you generated predictions for) and collect their actual ratings on the predicted items. This is your **ground truth** for evaluation.

If Bob rates Dune: Part Two a 5 -- your system performed well.
If Bob rates it a 2 -- your model needs refinement.

**Track your results:**

| User | Item predicted | Predicted rating | Actual rating | Absolute error |
|---|---|---|---|---|
| Bob | Dune: Part Two | 4.5 | ? | |
| Bob | Interstellar | 4.0 | ? | |

Compute the **Mean Absolute Error (MAE)** across all predictions: MAE = (1/n) × Σ|predicted - actual|. If your MAE is below 1.0, you've built a genuinely useful recommendation system. For reference, the Netflix Prize baseline had an RMSE of about 0.95 on a 1-5 scale.

**Consider this:** How accurate were your predictions? If some were significantly off, analyze why. Possible causes include insufficient co-rated items, outlier preferences, or context-dependent ratings (mood, time of day). This is normal -- even Netflix's production model has substantial prediction error on individual ratings. The value is in being right *on average* and *most of the time*.
