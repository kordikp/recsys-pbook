---
id: ch3-matrix-factorization
type: spine
title: "Matrix Factorization: The Netflix Method"
readingTime: 4
standalone: false
teaser: "How Netflix compressed millions of ratings into latent taste dimensions -- and why this technique won the million-dollar prize."
voice: thinker
parent: null
diagram: diagram-mf-decomposition
recallQ: "What does matrix factorization do to a giant ratings matrix?"
recallA: "It decomposes it into two lower-rank matrices -- one for users and one for items -- each containing learned latent factors. Their product approximates the original matrix, filling in missing entries with predicted ratings."
highlights:
  - "Decompose a sparse million×million matrix into two compact factor matrices"
  - "Latent dimensions are learned automatically — each captures a taste factor"
  - "ALS alternates between solving for users and items, each step in closed form"
status: accepted
---

![Matrix Factorization Story](/images/comic-mf.svg)

Imagine you operate a content platform with 100 million users and 500,000 items. If you represented every user's rating for every item in a matrix, that's **50 trillion cells**. And here's the critical challenge: approximately 99% of those cells are empty. No user has time to rate half a million items.

So how do you predict what someone would rate an item they've never encountered?

## The Core Insight: Latent Factor Models

**Matrix factorization** says: forget the massive sparse matrix. Instead, describe every user and every item with a compact vector of learned numbers -- typically 50 to 200 dimensions. These are called **latent factors**, and they capture implicit preference dimensions like:

- "How strongly does this user prefer intellectually demanding content?"
- "How dark or lighthearted is this user's taste?"
- "Does this item have strong visual aesthetics?"

The system discovers these factors purely from the patterns in the observed ratings. Nobody defines what the dimensions mean -- the structure emerges from the data.

## The Mathematics

We take the sparse ratings matrix **R** (users $\times$ items) and decompose it into two lower-rank matrices:

$$R \approx U \times V^T$$

- **U** $\in \mathbb{R}^{m \times k}$ is the user matrix -- each user becomes a $k$-dimensional vector
- **V** $\in \mathbb{R}^{n \times k}$ is the item matrix -- each item becomes a $k$-dimensional vector
- Their product $U \times V^T$ yields an $m \times n$ matrix that approximates $R$ -- with the empty cells now filled with predicted ratings

This is closely related to **Singular Value Decomposition (SVD)**. Classical SVD decomposes any matrix $R = U \Sigma V^T$, where $\Sigma$ contains singular values. Truncating to the top-$k$ singular values gives the best rank-$k$ approximation (Eckart-Young theorem). However, SVD requires a fully observed matrix. For sparse recommendation matrices, we instead optimize directly on the observed entries -- sometimes called "SVD-like" or "funk SVD" (after Simon Funk, who popularized it during the Netflix Prize).

**Example with 2 latent factors:**

Suppose the two factors capture (roughly) "intensity preference" and "humor preference":

- You = [0.9 intensity, 0.2 humor]
- Item A (thriller) = [0.8 intensity, 0.1 humor]
- Predicted rating = 0.9 $\times$ 0.8 + 0.2 $\times$ 0.1 = 0.72 + 0.02 = **0.74** -- strong match
- Item B (comedy) = [0.1 intensity, 0.9 humor]
- Predicted rating = 0.9 $\times$ 0.1 + 0.2 $\times$ 0.9 = 0.09 + 0.18 = **0.27** -- weak match

## Learning the Factors: Optimization

The objective is to minimize the reconstruction error on observed entries:

$$\min_{U, V} \sum_{(i,j) \in \text{observed}} (r_{ij} - \mathbf{u}_i^T \mathbf{v}_j)^2 + \lambda (\|\mathbf{u}_i\|^2 + \|\mathbf{v}_j\|^2)$$

Two dominant optimization approaches:

### Alternating Least Squares (ALS)

**ALS** exploits the biconvex structure of the problem:

1. **Initialize** user and item vectors randomly
2. **Fix item vectors**, solve for optimal user vectors (closed-form least squares)
3. **Fix user vectors**, solve for optimal item vectors (closed-form least squares)
4. **Alternate** until convergence

The closed-form update for a single user vector:

$$\mathbf{u}_i = (V^T V + \lambda I)^{-1} V^T \mathbf{r}_i$$

Each component:
- $\mathbf{u}_i$ = the latent factor vector for user $i$
- $V$ = the item factor matrix (held fixed during this step)
- $\mathbf{r}_i$ = user $i$'s observed ratings vector
- $\lambda I$ = regularization term (discussed below)

ALS is particularly well-suited for parallelization -- all user updates are independent given fixed item factors, and vice versa. This made it the algorithm of choice for Spark MLlib and other distributed frameworks.

### Stochastic Gradient Descent (SGD)

SGD updates factors incrementally for each observed rating, making it more memory-efficient for very large datasets but potentially slower to converge.

## Why $\lambda$ Matters (Regularization)

The $\lambda$ (lambda) term is **regularization**, and it's critical for generalization. Without it, the model can perfectly fit every observed rating -- including noisy or accidental interactions -- leading to severe overfitting.

Regularization constrains the magnitude of the learned vectors: "Capture the general preference structure, not the noise." A small $\lambda$ allows the model to fit more precisely; a large $\lambda$ enforces simpler representations. Tuning this hyperparameter is essential for production performance -- typically via cross-validation on held-out interaction data.

## The Netflix Prize Connection

In 2006, Netflix offered **$1,000,000** to anyone who could beat their recommendation algorithm by 10% (measured by RMSE on held-out ratings). Thousands of teams competed for three years. The winning approach by the BellKor team (Koren, Bell, & Volinsky, 2009) was built on sophisticated matrix factorization variants -- including temporal dynamics, implicit feedback signals, and neighborhood models integrated with latent factor models.

Their seminal paper "Matrix Factorization Techniques for Recommender Systems" remains one of the most cited works in the field.

## Contemporary Relevance

Even as deep learning has transformed many areas of ML, matrix factorization remains widely deployed because:

- It's **computationally efficient** -- scales to massive datasets with ALS on distributed systems
- It's **interpretable** -- latent factors often capture semantically meaningful dimensions
- It's **well-understood** -- decades of theoretical analysis and empirical validation
- It's the **conceptual foundation** -- modern embedding-based approaches are direct descendants

When you encounter "embeddings" in modern recommender systems, you're looking at the intellectual descendants of matrix factorization. The idea of representing users and items as compact vectors in a shared latent space traces directly back to this technique.
