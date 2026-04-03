---
id: ch4-interleaving
type: spine
title: "Interleaving: The Faster Alternative to A/B Testing"
readingTime: 2
standalone: true
core: false
teaser: "Interleaving detects ranking differences 100× faster than A/B tests by showing results from two models side by side."
voice: explorer
parent: null
diagram: null
recallQ: "How does interleaving compare to A/B testing for evaluating recommender systems?"
recallA: "Interleaving shows items from two models interleaved in a single list, then counts which model's items the user engages with. It requires ~100× fewer users to detect the same difference, making it much faster than standard A/B tests."
publishedAt: "2026-04-03"
status: accepted
---

A/B testing is the gold standard for recommendation evaluation, but it's **slow**. Detecting a 1% improvement with statistical significance can require weeks of traffic. Interleaving offers a much faster alternative.

## How Interleaving Works

Instead of showing different users different models (A/B test), interleaving shows **one user a merged list from both models:**

**Team Draft Interleaving:**
1. Model A produces ranking: [a₁, a₂, a₃, a₄, ...]
2. Model B produces ranking: [b₁, b₂, b₃, b₄, ...]
3. Merge: alternately pick top items from each model, skipping duplicates
4. Result: [a₁, b₁, a₂, b₂, a₃, b₃, ...] (or similar merged list)
5. Track which model's items the user engages with
6. Model with more engaged items "wins" for that user

## Why It's 100× More Sensitive

**Within-user comparison eliminates variance.** A/B tests compare *different* users, introducing between-user variance (one group might be more active for exogenous reasons). Interleaving compares models within the *same* user, eliminating this noise.

**Chapelle et al. (2012)** showed that interleaving achieves statistical significance with ~100× fewer impressions than A/B tests. A difference that takes 2 weeks to detect with A/B testing can be detected in hours with interleaving.

## Limitations

**Only measures relative preference.** Interleaving tells you which model is *better*, not by *how much*. It can't estimate the absolute impact on business metrics (revenue, retention).

**Position confounds.** Items shown at the top of the interleaved list get more clicks regardless of which model produced them. Careful randomization of positions is needed.

**Not suitable for all metrics.** Session-level metrics (session length, return rate) can't be measured through interleaving because both models contribute to the same session.

## When to Use What

| Method | Speed | What It Measures | Best For |
|--------|-------|-----------------|----------|
| Offline metrics | Minutes | Correlation with online quality | Initial screening |
| Interleaving | Hours–days | Relative model quality | Rapid model comparison |
| A/B test | Weeks | Absolute business impact | Final deployment decision |

**The evaluation funnel:** Use offline metrics to screen candidates → interleaving to identify the winner → A/B test to measure business impact before full deployment.

**Consider this:** Interleaving is underused in practice — many teams jump straight from offline metrics to A/B testing, missing the fast feedback that interleaving provides. Adding interleaving to your evaluation pipeline can accelerate model development by an order of magnitude.