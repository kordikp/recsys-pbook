---
id: ch5-math-d-think
type: spine
title: "The Math Behind Similarity"
readingTime: 4
standalone: false
teaser: "Cosine similarity, vector geometry, and why scale-invariant measures matter."
voice: thinker
parent: null
diagram: null
recallQ: "What does cosine similarity measure?"
recallA: "The angle between two preference vectors — so someone who rates everything low but in the same PATTERN as you is still similar."
status: accepted
---

The mean absolute difference method from the main section works for a quick prototype. But production recommendation systems require a more principled similarity measure. The most widely used is **cosine similarity**, and its geometric interpretation makes it remarkably intuitive.

**The geometric intuition.**

Represent each user's ratings as a vector in *n*-dimensional space, where *n* is the number of co-rated items. If Alice rates three movies [5, 4, 5], that vector points in a specific direction. If Bob rates the same movies [5, 5, 4], his vector points in a very similar direction. If Carlos rates them [1, 2, 1], his vector points in a different direction entirely.

Cosine similarity measures the **angle θ** between two vectors. When the vectors point in the same direction, θ ≈ 0 and cos(θ) ≈ **1**. When they are orthogonal, cos(θ) = **0**. When they point in opposite directions, cos(θ) = **-1**.

**Formal definition:**

Given two user rating vectors **A** = (a₁, a₂, ..., aₙ) and **B** = (b₁, b₂, ..., bₙ), cosine similarity is defined as:

$$\text{sim}(A, B) = \cos(\theta) = \frac{A \cdot B}{\|A\| \times \|B\|} = \frac{\sum_{i=1}^{n} a_i b_i}{\sqrt{\sum_{i=1}^{n} a_i^2} \times \sqrt{\sum_{i=1}^{n} b_i^2}}$$

**Worked example:**

Alice rates two movies: **A** = [5, 4]
Bob rates the same movies: **B** = [5, 5]

- **A · B** = 5×5 + 4×5 = 25 + 20 = **45**
- **||A||** = √(5² + 4²) = √(25 + 16) = √41 ≈ **6.40**
- **||B||** = √(5² + 5²) = √(25 + 25) = √50 ≈ **7.07**
- **sim(A, B)** = 45 / (6.40 × 7.07) = 45 / 45.25 ≈ **0.994**

Now consider Carlos: **C** = [1, 2]
- **A · C** = 5×1 + 4×2 = 5 + 8 = **13**
- **||C||** = √(1 + 4) = √5 ≈ **2.24**
- **sim(A, C)** = 13 / (6.40 × 2.24) = 13 / 14.33 ≈ **0.907**

This result is noteworthy: Carlos gave low ratings, yet the similarity is still high (0.907) because the *relative pattern* is similar (both slightly favor the first movie). This illustrates a critical property: **cosine similarity is scale-invariant** -- it measures the direction of the vector, not its magnitude.

**Why scale invariance matters:**

Users exhibit different rating behaviors. Some are "generous raters" who rarely go below 4 stars; others are "tough critics" who reserve 5 stars for truly exceptional items. Cosine similarity normalizes for these individual biases by focusing on whether users *agree on the relative ordering* of items.

To address the scale-invariance limitation (where a user rating [1, 2] appears similar to [5, 4]), practitioners often use **adjusted cosine similarity**, which subtracts each user's mean rating before computing the cosine. This centers the vectors and makes the measure sensitive to both pattern and relative scale.

**Computational complexity:** For *m* users and *n* items, computing pairwise cosine similarity for all user pairs is O(m² × n). In practice, sparse data structures and approximate nearest neighbor algorithms (e.g., LSH, FAISS) reduce this dramatically.

![Matrix Factorization](/images/comic-mf.svg)

![Matrix Decomposition](/images/diagram-mf-decomposition.svg)

**The key takeaway:** Similarity measures quantify how closely two users' preference vectors align in rating space. The choice of measure -- cosine, Pearson correlation, adjusted cosine, or Jaccard -- encodes different assumptions about what "similar" means. Production systems typically evaluate multiple measures via A/B testing to determine which yields the best downstream recommendation quality.
