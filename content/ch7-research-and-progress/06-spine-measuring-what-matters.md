---
id: ch7-evaluation
type: spine
title: "Measuring What Matters: The Evaluation Problem"
readingTime: 4
standalone: true
core: true
teaser: "The biggest risk in recommender systems isn't a bad algorithm — it's measuring the wrong thing."
voice: universal
parent: null
diagram: null
recallQ: "What is the offline evaluation bias and how can it be corrected?"
recallA: "Offline data reflects the OLD system — new models recommending different items look worse because those items were never shown. Correction: LLOO with popularity penalization (β ≈ 0.30) improves model selection accuracy from 12.9% to 34.3%."
status: accepted
---

You've built a promising new recommendation algorithm. It outperforms the baseline on all your offline metrics. You deploy it — and user engagement drops. What happened?

Welcome to the **evaluation problem**: the gap between offline metrics and real-world performance. It's arguably the most dangerous challenge in recommender systems, because it can silently steer an entire organization toward building the wrong thing.

## Standard Evaluation: nDCG and Recall

The standard metrics in recommendation are well-established:

**Recall@K:** What fraction of relevant items appear in the top K recommendations?

**nDCG@K (Normalized Discounted Cumulative Gain):** Do relevant items appear near the top of the ranked list?

$$DCG@K = \sum_{i=1}^{K} \frac{rel_i}{\log_2(i+1)}$$

The logarithmic discount models the empirical observation that user attention decays roughly logarithmically with position: position 1 gets 100% attention, position 10 gets about 29%.

These metrics are mathematically sound. The problem isn't the metrics — it's the data they're computed on.

## The Offline Evaluation Bias

Here's the fundamental issue: **offline evaluation data reflects the behavior of the old system, not the new one.**

When you evaluate a new model offline, you're asking: "Would this model have recommended the items that users actually interacted with?" But users only interacted with items *the old system showed them*. Items the old system never surfaced have zero interactions — not because users wouldn't like them, but because they never had the chance.

**The consequence:** Models that recommend items similar to the old system's recommendations score well. Models that recommend different — potentially better — items score poorly.

This creates a systematic bias toward **conservative, exploitative algorithms**. The system optimizes for staying the same, not for getting better.

## Formal Statement

Let π₀ be the old system (logging policy) and π be the new system. The offline estimate of π's quality is:

$$\hat{V}(\pi) = \frac{1}{N}\sum_{t=1}^N r_t \cdot \mathbb{1}[\pi(c_t) = a_t]$$

This estimate is **zero for any action π takes that π₀ didn't take**. It's not just biased — it's structurally incapable of evaluating novel recommendations.

The data is **Missing Not At Random (MNAR)**: popular items and previously-recommended items have much higher observation probability than niche or novel items. Standard metrics assume Missing Completely At Random (MCAR), which is flatly wrong.

## The Solution: LLOO with Popularity Penalization

Research at the Recombee lab identified a practical correction with two components:

**1. Leave-Last-One-Out (LLOO):** Instead of randomly holding out interactions, hold out the chronologically *last* interaction per user. This simulates the actual deployment scenario: train on past data, predict future behavior.

**2. Popularity penalization (β):** Down-weight predictions on popular items (which are "easy" to get right) and up-weight predictions on niche items (which actually test personalization ability):

$$\operatorname{recall@K}_{\text{LLOO}}^{\beta} = \sum_u w^\beta(u) \frac{\sum_{(i,t) \in F_u} \mathbb{1}[i \in \text{Top-K}] \cdot p(i)^{-\beta}}{\sum_i p(i)^{-\beta}}$$

where p(i) is the item's popularity and β controls the penalization strength.

**The results are striking:** Without correction (β = 0), the offline winner matches the online winner only 12.9% of the time (essentially random among top models). At the optimal β ≈ 0.30, this jumps to 34.3% — nearly tripling model selection accuracy.

The curve is not monotonic: β → 1 overcorrects (ignoring popular items entirely is also harmful). The optimal point balances rewarding genuine personalization without penalizing broadly appealing recommendations.

## Beyond Metrics: What Are We Really Optimizing?

The evaluation problem extends beyond metric design. Even with perfect offline-online correlation, we need to ask: **are we measuring the right thing?**

Engagement metrics (clicks, watch time, session length) are easy to measure but may not align with user well-being. A user who spent 3 hours in a recommendation rabbit hole had high "engagement" but might not be satisfied.

The field is increasingly exploring **beyond-accuracy metrics** (tools like [RepSys](https://www.recombee.com/blog/repsys-opensource-library-for-interactive-evaluation-of-recommendation-systems), an [open-source evaluation library](https://github.com/cowjen01/repsys), help researchers interactively compare these dimensions):
- **Diversity:** Are recommendations varied, or repetitive?
- **Serendipity:** Do users discover genuinely unexpected items?
- **Fairness:** Do all content creators get a fair chance at exposure?
- **Long-term satisfaction:** Does the user return tomorrow, next week, next month?

These metrics are harder to define and measure, but they capture dimensions of quality that pure accuracy misses.

> **Research publication:** Kasalický, Alves & Kordík, "Bridging Offline-Online Evaluation with Popularity Debiasing," evalRS@KDD 2023.

**Consider this:** The offline evaluation bias is a specific instance of a broader problem: **Goodhart's Law** — "When a measure becomes a target, it ceases to be a good measure." The moment you optimize for an offline metric, the metric stops accurately reflecting what you care about. Research helps us recognize these traps and design better evaluation frameworks.