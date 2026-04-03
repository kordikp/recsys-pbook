---
id: ch2-rating-quality
type: spine
title: "The Anna vs. Bob Problem: Not All Ratings Are Equal"
readingTime: 3
standalone: true
core: false
teaser: "Two users both give 5 stars. One wrote a detailed review explaining why. The other just clicked. Should the algorithm trust them equally?"
voice: thinker
parent: ch2-interactions
diagram: null
recallQ: "Why should recommender systems weight ratings differently based on quality?"
recallA: "Noisy ratings propagate through collaborative filtering — one unreliable rating can affect predictions for thousands of users. Weighting by review quality (comprehensiveness, consistency) improves model accuracy by reducing noise propagation."
publishedAt: "2026-04-03"
status: accepted
---

Consider two users rating the same product:

**Anna** gives 5 stars and writes: "Excellent noise cancellation, the ANC algorithm handles both low and high-frequency noise well. Battery lasts 28 hours as advertised. The companion app's EQ customization is intuitive. Only downside: the headband pressure increases after 3+ hours."

**Bob** gives 5 stars and writes: "Great!"

Both ratings are "5 stars." But they carry very different amounts of information. Anna has clearly evaluated the product across multiple dimensions. Bob might have clicked 5 stars out of habit, social pressure, or because the product was a gift he hasn't used yet.

**Should the recommendation algorithm trust both ratings equally?**

## Why This Matters: Noise Propagation

In collaborative filtering, every user's ratings influence predictions for other users through shared latent factors. This is the core strength of CF — but it also means **noise propagates.**

If Bob's 5-star rating doesn't reflect genuine preference (perhaps he rates everything 5 stars, or he was influenced by the product's marketing), this noise enters the latent factor model. Through matrix factorization, Bob's noisy rating affects the user and item factors, which in turn affect predictions for thousands of other users.

One unreliable rating doesn't cause much damage. But across millions of ratings, the cumulative noise can significantly degrade recommendation quality.

## The Weighted Loss Approach

Research from the [Recombee lab](https://www.recombee.com/blog/is-this-comment-useful-enhancing-personalized-recommendations-by-considering-user-rating-uncertainty) proposes a solution: **weight each user's contribution based on estimated trustworthiness.**

Instead of the standard loss:

$$\mathcal{L} = \sum_{(u,i) \in \Omega} (r_{ui} - \hat{r}_{ui})^2 + \lambda \|\theta\|^2$$

Use a weighted loss:

$$\mathcal{L} = \sum_{(u,i) \in \Omega} w_u \cdot (r_{ui} - \hat{r}_{ui})^2 + \lambda \|\theta\|^2$$

where $w_u$ is a trustworthiness weight for user u, estimated from:

- **Review comprehensiveness:** Users who write detailed, specific reviews demonstrate engagement with the product
- **Rating consistency:** Users whose ratings are internally consistent (not random) are more reliable
- **Behavioral signals:** Time spent evaluating, comparison browsing, return rates

Anna gets a high weight (detailed review, specific observations). Bob gets a lower weight (minimal evidence of genuine evaluation). The model still learns from Bob — but trusts Anna more.

## Beyond Star Ratings

The rating quality problem extends to all feedback types:

**Implicit feedback quality varies too:**
- A user who watches a video to completion after searching for it (high-quality positive signal) vs. one who had it autoplay while they were away (low-quality positive signal)
- A user who carefully browses and clicks on specific items (intentional) vs. one who scrolls rapidly and clicks accidentally (noise)

**How platforms address this:**
- **YouTube:** Weights "active" engagement (choosing to click) higher than "passive" engagement (autoplay)
- **Spotify:** The 30-second threshold filters out accidental plays, but creates its own bias (songs with slow intros are disadvantaged)
- **Netflix:** Distinguishes between "started watching" (weak signal) and "watched 70%+" (strong signal)

## Practical Implications

For recommendation engineers:

1. **Not all feedback is equally informative.** Design your data pipeline to capture feedback quality signals, not just feedback values.
2. **Consider confidence-weighted models.** The Hu et al. (2008) implicit feedback framework already uses confidence weights — extend this principle to explicit feedback too.
3. **LLMs can assess review quality.** Modern language models can score review comprehensiveness, enabling automatic trustworthiness estimation at scale.
4. **Ask the right questions.** Instead of "Rate this 1-5 stars," consider "Would you recommend this to a friend?" or "Would you use this again?" — questions that elicit more thoughtful responses.

**Consider this:** The Anna vs. Bob problem is a specific instance of a universal challenge: **signal quality matters as much as signal quantity.** A recommender system trained on 1 million high-quality ratings will outperform one trained on 10 million noisy ones. Investing in data quality — not just data volume — is one of the highest-leverage improvements you can make.