---
id: ch5-formulas
type: spine
title: "The Math Behind Recommendations"
readingTime: 5
standalone: false
teaser: "Cosine similarity, matrix factorization, precision, recall, and nDCG — the core formulas behind every production recommender system."
voice: thinker
parent: null
diagram: null
core: false
recallQ: "What does cosine similarity actually measure?"
recallA: "The angle between two vectors of preferences. If two users rate things in the same pattern (even at different scales), the angle is small and similarity is high."
status: accepted
---

This section provides a reference for the key mathematical formulas underlying recommendation systems. The goal is not rote memorization but rather building fluency -- you should be able to recognize each formula, understand what it measures, and know when to apply it.

## 1. Cosine Similarity — "Are we pointing the same direction?"

$$\text{sim}(A, B) = \frac{A \cdot B}{\|A\| \times \|B\|} = \frac{\sum_{i=1}^{n} a_i b_i}{\sqrt{\sum_{i=1}^{n} a_i^2} \times \sqrt{\sum_{i=1}^{n} b_i^2}}$$

**Components:**

- **A** and **B** are user rating vectors over co-rated items
- **A · B** (dot product) = the sum of element-wise products
- **||A||** = the L2 norm (Euclidean length) of vector A
- The result is bounded: **-1 ≤ sim(A, B) ≤ 1**

**Example:** Alice rates [5, 4, 5] and Bob rates [4, 3, 4].

- A · B = 5×4 + 4×3 + 5×4 = 20 + 12 + 20 = **52**
- ||A|| = √(25 + 16 + 25) = √66 ≈ **8.12**
- ||B|| = √(16 + 9 + 16) = √41 ≈ **6.40**
- sim = 52 / (8.12 × 6.40) = 52 / 51.97 ≈ **1.00** (near-perfect alignment)

**Interpretation:** Bob rates everything slightly lower, but in the same pattern. Cosine similarity captures this -- it measures direction (relative ordering), not magnitude (absolute scale).

**Variant -- Adjusted Cosine Similarity:** To account for user rating bias, subtract each user's mean rating μ before computing cosine:

$$\text{sim}_{\text{adj}}(A, B) = \frac{\sum_{i \in I_{AB}} (a_i - \bar{a})(b_i - \bar{b})}{\sqrt{\sum_{i \in I_{AB}} (a_i - \bar{a})^2} \times \sqrt{\sum_{i \in I_{AB}} (b_i - \bar{b})^2}}$$

where I_AB is the set of co-rated items and ā, b̄ are the respective user means. This is equivalent to Pearson correlation and is often preferred in practice.

## 2. Matrix Factorization & ALS — "Find the hidden dimensions"

For the full treatment of matrix factorization -- how it decomposes the rating matrix **R ≈ P × Qᵀ** into low-rank user and item factor matrices, how the ALS (Alternating Least Squares) algorithm optimizes the latent factors, and why this approach won the Netflix Prize -- see the dedicated section in Chapter 3.

## 3. Precision and Recall — "Did we recommend the right items?"

Before measuring ranking quality, it's essential to understand two fundamental classification metrics:

$$\text{Precision@k} = \frac{|\text{relevant items in top-k}|}{k}$$

$$\text{Recall@k} = \frac{|\text{relevant items in top-k}|}{|\text{total relevant items}|}$$

**Precision** answers: "Of the items we recommended, how many were actually relevant?" A Precision@10 of 0.6 means 6 out of 10 recommended items were relevant.

**Recall** answers: "Of all relevant items, how many did we manage to recommend?" A Recall@10 of 0.3 means we surfaced 30% of the user's relevant items in our top-10 list.

**The precision-recall tradeoff:** Recommending more items typically increases recall (you capture more relevant items) but decreases precision (you also include more irrelevant ones). The optimal balance depends on the application -- an e-commerce site may favor precision (don't waste screen space), while a music playlist may favor recall (don't miss good songs).

**F1 Score** combines both into a single metric:

$$F_1 = 2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$$

## 4. nDCG — "How good is this ranked list?"

$$\text{DCG@k} = \sum_{i=1}^{k} \frac{2^{\text{rel}_i} - 1}{\log_2(i + 1)}$$

$$\text{nDCG@k} = \frac{\text{DCG@k}}{\text{IDCG@k}}$$

**Components:**

- A ranked list of recommended items, positions 1 through k
- Each item has a graded **relevance score** rel_i (e.g., 0, 1, 2, or 3)
- The logarithmic denominator applies a **position discount** -- items ranked higher contribute more to the score
- **IDCG** (Ideal DCG) is computed from the best possible ranking
- **nDCG** is normalized to [0, 1] by dividing by IDCG

**Example:** A system returns [Great(3), OK(1), Bad(0), Great(3)]:

- DCG = (2³-1)/log₂(2) + (2¹-1)/log₂(3) + (2⁰-1)/log₂(4) + (2³-1)/log₂(5) = 7/1 + 1/1.58 + 0/2 + 7/2.32 = 7 + 0.63 + 0 + 3.02 = **10.65**
- Ideal ordering [Great, Great, OK, Bad]: IDCG = 7/1 + 7/1.58 + 1/2 + 0/2.32 = 7 + 4.43 + 0.5 + 0 = **11.93**
- nDCG = 10.65 / 11.93 = **0.893**

**Why it matters:** nDCG answers the central evaluation question: "How close is our ranking to the ideal?" A score of 1.0 means perfect ranking. Production systems typically achieve nDCG values of 0.3-0.7, reflecting the inherent difficulty of preference prediction.

## Summary

| Formula | What it measures | Application |
|---------|-----------------|-------------|
| Cosine similarity | Direction alignment between preference vectors | User-user or item-item collaborative filtering |
| Adjusted cosine / Pearson | Mean-centered pattern similarity | Bias-aware collaborative filtering |
| Matrix factorization | Latent factor decomposition | Model training (see Ch. 3) |
| Precision@k | Fraction of relevant items in top-k | Recommendation quality (relevance) |
| Recall@k | Fraction of relevant items captured | Recommendation quality (coverage) |
| nDCG@k | Ranking quality with position discounting | Evaluation of ranked recommendation lists |

These formulas constitute the mathematical core. Production systems layer additional techniques on top -- learning-to-rank models, multi-objective optimization, contextual bandits -- but fluency with these fundamentals provides the foundation for understanding any recommender system.
