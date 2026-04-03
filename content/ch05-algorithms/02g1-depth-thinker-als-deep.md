---
id: ch3-als-deep
type: spine
title: "ALS: The Complete Algorithm"
readingTime: 6
standalone: false
core: false
voice: thinker
parent: ch3-matrix-factorization
publishedAt: "2026-04-03"
status: accepted
---

Matrix factorization is the conceptual foundation. ALS is the workhorse algorithm that makes it practical at scale. This section derives the algorithm from first principles, extends it to implicit feedback, and analyzes the computational properties that made it the dominant approach in distributed recommender systems.

![Matrix factorization: sparse X decomposes into dense U and V](/images/anim-matrix-factorization.svg)

## The Optimization Problem

Given a sparse ratings matrix $X \in \mathbb{R}^{m \times n}$ with $m$ users and $n$ items, we seek low-rank factor matrices $U \in \mathbb{R}^{m \times k}$ and $V \in \mathbb{R}^{n \times k}$ that minimize the regularized reconstruction error over observed entries:

$$\min_{U, V} \sum_{(i,j) \in \Omega} \left( X_{ij} - \mathbf{u}_i^T \mathbf{v}_j \right)^2 + \lambda \left( \|U\|_F^2 + \|V\|_F^2 \right)$$

where:
- $\Omega$ is the set of observed (user, item) pairs
- $\mathbf{u}_i \in \mathbb{R}^k$ is the latent factor vector for user $i$ (the $i$-th row of $U$)
- $\mathbf{v}_j \in \mathbb{R}^k$ is the latent factor vector for item $j$ (the $j$-th row of $V$)
- $\|U\|_F^2 = \sum_i \|\mathbf{u}_i\|^2$ is the squared Frobenius norm
- $\lambda > 0$ is the regularization strength

This objective is **non-convex** jointly in $(U, V)$ -- there is no global minimum we can reach in closed form. However, it is **biconvex**: fixing $V$ makes it convex in $U$, and fixing $U$ makes it convex in $V$. ALS exploits exactly this structure.

## Connection to SVD and the Eckart-Young Theorem

Before deriving ALS, it's worth understanding its relationship to classical SVD. The Eckart-Young theorem states that the best rank-$k$ approximation to a fully observed matrix $X$ (in Frobenius norm) is obtained by truncated SVD:

$$X_k = U_k \Sigma_k V_k^T$$

where $U_k$, $\Sigma_k$, $V_k$ contain the top-$k$ singular vectors and values. This is optimal when all entries are observed and there is no regularization.

For recommender systems, we have two complications: (1) the matrix is overwhelmingly sparse -- 99%+ entries missing -- so classical SVD is undefined or at best misleading (imputing zeros confounds "missing" with "disliked"), and (2) we want regularization to prevent overfitting. ALS handles both by optimizing only over observed entries with explicit $\ell_2$ penalties.

There is also a deeper connection via **nuclear norm regularization**. The nuclear norm $\|M\|_* = \sum_i \sigma_i(M)$ (the sum of singular values) is the tightest convex relaxation of matrix rank. For the factorized form $M = UV^T$, we have the inequality:

$$\|UV^T\|_* \leq \frac{1}{2} \left( \|U\|_F^2 + \|V\|_F^2 \right)$$

with equality when $U$ and $V$ have the same column space and equal singular values. This means that Frobenius-norm regularization on the factors implicitly encourages low nuclear norm -- and therefore low rank -- of the reconstructed matrix. This provides a principled justification for the regularization term beyond simple "shrinkage."

## Deriving the ALS Updates

### Step 1: Fix $V$, Solve for Each $\mathbf{u}_i$

When $V$ is fixed, the objective decomposes across users. For user $i$, let $\Omega_i = \{j : (i,j) \in \Omega\}$ be the set of items rated by user $i$, and let $V_i \in \mathbb{R}^{|\Omega_i| \times k}$ be the submatrix of $V$ restricted to those items. Let $\mathbf{x}_i \in \mathbb{R}^{|\Omega_i|}$ be the corresponding observed ratings.

The per-user subproblem is:

$$\min_{\mathbf{u}_i} \| \mathbf{x}_i - V_i \mathbf{u}_i \|^2 + \lambda \|\mathbf{u}_i\|^2$$

This is **ridge regression** (linear regression with $\ell_2$ penalty). Taking the gradient and setting it to zero:

$$\nabla_{\mathbf{u}_i} = -2 V_i^T (\mathbf{x}_i - V_i \mathbf{u}_i) + 2\lambda \mathbf{u}_i = 0$$

$$V_i^T V_i \mathbf{u}_i + \lambda \mathbf{u}_i = V_i^T \mathbf{x}_i$$

$$(V_i^T V_i + \lambda I) \mathbf{u}_i = V_i^T \mathbf{x}_i$$

Yielding the closed-form solution:

$$\mathbf{u}_i^* = (V_i^T V_i + \lambda I)^{-1} V_i^T \mathbf{x}_i$$

**Interpreting each term:**
- $V_i^T V_i \in \mathbb{R}^{k \times k}$: the Gram matrix of item factors for items rated by user $i$. Captures how the item embedding space is shaped around this user's observed ratings.
- $\lambda I \in \mathbb{R}^{k \times k}$: the regularization term. Ensures the matrix is invertible (even when user $i$ has rated fewer than $k$ items) and shrinks the solution toward zero.
- $V_i^T \mathbf{x}_i \in \mathbb{R}^k$: the "moment vector" -- a rating-weighted sum of item factors. It encodes what the ratings tell us about the user's position in latent space.
- $(V_i^T V_i + \lambda I)^{-1}$: the precision-weighted inverse that balances the observed signal against the regularization prior.

### Step 2: Fix $U$, Solve for Each $\mathbf{v}_j$

By symmetry, for item $j$ with observed users $\Omega_j = \{i : (i,j) \in \Omega\}$:

$$\mathbf{v}_j^* = (U_j^T U_j + \lambda I)^{-1} U_j^T \mathbf{x}_j$$

where $U_j$ is the submatrix of $U$ for users who rated item $j$, and $\mathbf{x}_j$ is the vector of their ratings.

### The Full ALS Algorithm

```
Initialize U randomly (or via SVD warm-start)
Initialize V randomly (or via SVD warm-start)

for iteration = 1, 2, ..., T:
    # User step: fix V, update all users
    for each user i in parallel:
        V_i = V[items rated by user i, :]
        x_i = ratings by user i
        u_i = solve( V_i^T V_i + λI, V_i^T x_i )

    # Item step: fix U, update all items
    for each item j in parallel:
        U_j = U[users who rated item j, :]
        x_j = ratings for item j
        v_j = solve( U_j^T U_j + λI, U_j^T x_j )

    Compute loss on observed entries (optional, for convergence check)
```

### Numerical Example

Consider a tiny system with 3 users and 4 items, $k = 2$, $\lambda = 0.1$:

Suppose after several iterations, the current item matrix for items rated by user 1 (items 1, 3) is:

$$V_1 = \begin{pmatrix} 0.8 & 0.3 \\ 0.1 & 0.9 \end{pmatrix}, \quad \mathbf{x}_1 = \begin{pmatrix} 5 \\ 3 \end{pmatrix}$$

Then:

$$V_1^T V_1 = \begin{pmatrix} 0.65 & 0.33 \\ 0.33 & 0.90 \end{pmatrix}, \quad V_1^T V_1 + 0.1 I = \begin{pmatrix} 0.75 & 0.33 \\ 0.33 & 1.00 \end{pmatrix}$$

$$V_1^T \mathbf{x}_1 = \begin{pmatrix} 0.8 \cdot 5 + 0.1 \cdot 3 \\ 0.3 \cdot 5 + 0.9 \cdot 3 \end{pmatrix} = \begin{pmatrix} 4.3 \\ 4.2 \end{pmatrix}$$

Solving the $2 \times 2$ linear system $(V_1^T V_1 + \lambda I) \mathbf{u}_1 = V_1^T \mathbf{x}_1$:

$$\mathbf{u}_1^* = \begin{pmatrix} 0.75 & 0.33 \\ 0.33 & 1.00 \end{pmatrix}^{-1} \begin{pmatrix} 4.3 \\ 4.2 \end{pmatrix} \approx \begin{pmatrix} 4.09 \\ 2.85 \end{pmatrix}$$

This single user update is a $k \times k$ linear solve -- fast and numerically stable.

## Extension to Implicit Feedback

Explicit ratings are a luxury. Most real-world data consists of implicit signals: clicks, views, purchases, play counts. The seminal work by Hu, Koren, and Volinsky (2008), "Collaborative Filtering for Implicit Feedback Datasets," reformulates ALS for this setting.

### The Key Idea: Preferences and Confidences

Given an implicit interaction matrix $R$ (e.g., play counts), define:

**Binary preferences:**

$$p_{ij} = \begin{cases} 1 & \text{if } r_{ij} > 0 \\ 0 & \text{otherwise} \end{cases}$$

**Confidence weights:**

$$c_{ij} = 1 + \alpha \cdot r_{ij}$$

where $\alpha$ is a hyperparameter (typically 40 in the original paper). The intuition: a user who played a song 100 times almost certainly likes it ($c_{ij} = 4001$ with $\alpha = 40$). A user who played it once -- maybe accidental, maybe lukewarm ($c_{ij} = 41$). An unobserved interaction gets baseline confidence ($c_{ij} = 1$) toward the preference $p_{ij} = 0$.

### The Implicit ALS Objective

$$\min_{U, V} \sum_{i,j} c_{ij} \left( p_{ij} - \mathbf{u}_i^T \mathbf{v}_j \right)^2 + \lambda \left( \|U\|_F^2 + \|V\|_F^2 \right)$$

Note the critical difference from explicit ALS: the sum is over **all** user-item pairs, not just observed ones. Every zero is a data point (with low confidence). This means a naive implementation scales as $O(m \cdot n)$ per iteration -- potentially billions of operations.

### The User Update for Implicit ALS

For user $i$, define $C_i = \text{diag}(c_{i1}, c_{i2}, \ldots, c_{in})$ as the $n \times n$ diagonal matrix of confidences. The closed-form update becomes:

$$\mathbf{u}_i^* = (V^T C_i V + \lambda I)^{-1} V^T C_i \mathbf{p}_i$$

where $\mathbf{p}_i \in \{0,1\}^n$ is the full preference vector for user $i$.

### The Computational Trick

Computing $V^T C_i V$ naively requires $O(n \cdot k^2)$ for each user -- too expensive when $n$ is large. The key insight from Hu et al. (2008) is to decompose:

$$V^T C_i V = V^T V + V^T (C_i - I) V$$

Since $C_i - I$ is diagonal with nonzeros only where user $i$ has interactions:

$$V^T (C_i - I) V = \sum_{j \in \Omega_i} (c_{ij} - 1) \mathbf{v}_j \mathbf{v}_j^T$$

The term $V^T V \in \mathbb{R}^{k \times k}$ is **precomputed once** and shared across all users. The correction term requires only $|\Omega_i|$ rank-1 updates (one per observed interaction).

Similarly, $V^T C_i \mathbf{p}_i$ simplifies because $p_{ij} = 0$ for unobserved items:

$$V^T C_i \mathbf{p}_i = \sum_{j \in \Omega_i} c_{ij} \mathbf{v}_j$$

This reduces the per-user cost from $O(n \cdot k^2)$ to $O(|\Omega_i| \cdot k^2 + k^3)$, making implicit ALS practical even for millions of items.

## Complexity Analysis

### Per-Iteration Cost (Explicit ALS)

**User update step** -- for all $m$ users:
- Building $V_i^T V_i$ for user $i$: $O(|\Omega_i| \cdot k^2)$
- Summed over all users: $O(|\Omega| \cdot k^2)$ where $|\Omega|$ is the total number of observed ratings
- Solving $k \times k$ system for each user: $O(m \cdot k^3)$
- Total user step: $O(|\Omega| \cdot k^2 + m \cdot k^3)$

**Item update step** -- by symmetry: $O(|\Omega| \cdot k^2 + n \cdot k^3)$

**Total per iteration:**

$$O(|\Omega| \cdot k^2 + (m + n) \cdot k^3)$$

Since typically $k \ll m, n$ and $|\Omega| \gg m + n$, the dominant term is $O(|\Omega| \cdot k^2)$.

### Per-Iteration Cost (Implicit ALS)

**User update step:**
- Precompute $V^T V$: $O(n \cdot k^2)$ (once)
- Per-user correction and solve: $O(|\Omega_i| \cdot k^2 + k^3)$
- Summed: $O(n \cdot k^2 + |\Omega| \cdot k^2 + m \cdot k^3)$

**Total per iteration:**

$$O((m + n) \cdot k^2 + |\Omega| \cdot k^2 + (m + n) \cdot k^3)$$

which simplifies to $O(|\Omega| \cdot k^2 + (m+n) \cdot k^2 + (m+n) \cdot k^3)$. With $k$ typically 50--200, the $k^3$ term stays manageable.

## Parallelization: Why ALS Is Embarrassingly Parallel

The term "embarrassingly parallel" applies precisely: during the user update step, each user's update depends only on the (fixed) item matrix $V$ and the user's own ratings. There are no data dependencies between users. The same holds for items during the item step.

This means:
- **Shared-memory parallelism**: Distribute users across CPU cores. Each core reads $V$ (shared, read-only) and writes to its assigned rows of $U$.
- **Distributed parallelism**: Partition users across machines. Each machine needs only a copy of $V$ (broadcast once per iteration) and the ratings for its assigned users. This is the design behind ALS in Apache Spark MLlib.
- **GPU parallelism**: The user updates can be batched into a single large linear algebra operation -- solving thousands of $k \times k$ systems simultaneously.

SGD, by contrast, updates are inherently sequential: each gradient step modifies the global factor matrices, creating write conflicts in parallel settings. Lock-free SGD variants (HOGWILD!) exist but require careful tuning and provide weaker convergence guarantees.

## Convergence Properties

ALS belongs to the family of **block coordinate descent** methods. Its convergence properties are well-characterized:

1. **Monotonic decrease**: Each half-step (user update or item update) solves a convex subproblem exactly. Therefore the objective value is non-increasing after every half-step. This is a provable guarantee, not empirical observation.

2. **Convergence to a stationary point**: Under mild regularity conditions (which the $\lambda I$ term ensures), ALS converges to a stationary point of the objective. However, due to non-convexity, this is generally a **local minimum**, not a global one.

3. **Sensitivity to initialization**: Different random initializations yield different local optima. In practice, this is mitigated by: (a) running multiple restarts and selecting the best, (b) initializing with truncated SVD on observed entries, or (c) accepting that for recommendation quality, most local optima perform comparably.

4. **Rate of convergence**: ALS typically converges in 10--20 iterations for explicit feedback. Implicit ALS may require more iterations (20--50) due to the denser optimization landscape. The convergence rate is generally **linear** (i.e., the error decreases by a constant factor per iteration), which is slower than the superlinear convergence of second-order methods but compensated by the cheap per-iteration cost.

## ALS vs. SGD (Funk SVD): A Systematic Comparison

Simon Funk popularized SGD-based matrix factorization during the Netflix Prize (2006), updating factors one rating at a time:

$$\mathbf{u}_i \leftarrow \mathbf{u}_i + \eta \left( e_{ij} \mathbf{v}_j - \lambda \mathbf{u}_i \right)$$
$$\mathbf{v}_j \leftarrow \mathbf{v}_j + \eta \left( e_{ij} \mathbf{u}_i - \lambda \mathbf{v}_j \right)$$

where $e_{ij} = X_{ij} - \mathbf{u}_i^T \mathbf{v}_j$ is the prediction error and $\eta$ is the learning rate.

| Dimension | ALS | SGD (Funk SVD) |
|---|---|---|
| **Update granularity** | Full user/item vector via closed-form solve | Incremental per-rating gradient step |
| **Missing data handling** | Natural: optimizes only over $\Omega$ | Natural: iterates only over observed ratings |
| **Implicit feedback** | Elegant extension (Hu et al., 2008) with efficient precomputation | Less natural; requires negative sampling strategies |
| **Parallelization** | Embarrassingly parallel within each half-step | Inherently sequential; HOGWILD! variants lose guarantees |
| **Hyperparameters** | $\lambda$, $k$, number of iterations | $\lambda$, $k$, $\eta$ (learning rate), learning rate schedule, epochs |
| **Convergence** | Monotonic, guaranteed decrease | Non-monotonic, may oscillate, requires careful $\eta$ tuning |
| **Memory** | Must store full factor matrices + Gram matrix ($k \times k$) | Streams through data; minimal memory beyond factors |
| **Speed to reasonable solution** | Fast (few iterations) | Can be faster for very sparse data with good $\eta$ |
| **Distributed systems** | Excellent (Spark MLlib, etc.) | Harder; parameter server architecture needed |
| **Scalability wall** | $k \times k$ matrix inversion per user/item | Per-rating cost is $O(k)$ -- scales to very large $k$ |

**When to use ALS:**
- Implicit feedback data (the Hu et al. extension is the standard approach)
- Distributed computing environments
- When you need stable, monotonic convergence without hyperparameter sensitivity
- Moderate $k$ (up to ~200; beyond that, the $k^3$ solve becomes a bottleneck)

**When to use SGD:**
- Explicit ratings with very sparse matrices
- When $k$ is very large (no $k^3$ bottleneck)
- Online learning scenarios (streaming data)
- Resource-constrained environments (lower memory footprint)

**When to use neither (closed-form SVD):**
- Small, dense matrices where full SVD is tractable
- When you need the theoretically optimal rank-$k$ approximation
- Feature extraction pipelines where exact decomposition matters

## Practical Hyperparameter Guidance

### Latent dimension $k$

- **Typical range**: 50--200 for production systems
- **Too small** ($k < 20$): insufficient capacity to capture the preference structure. Underfitting.
- **Too large** ($k > 500$): overfitting risk increases, diminishing returns on recommendation quality, and the $O(k^3)$ solve cost becomes significant
- **Selection**: cross-validate on held-out data. The marginal gain from increasing $k$ typically flattens around 100--200

### Regularization $\lambda$

- **Typical range**: 0.01--1.0
- **Scales with data density**: sparser data requires stronger regularization
- **Rule of thumb**: start with $\lambda = 0.1$ and grid-search over $\{0.01, 0.05, 0.1, 0.5, 1.0\}$
- **Per-user/item regularization**: some implementations scale $\lambda$ by $|\Omega_i|$ (number of ratings per user) to normalize regularization strength across users with varying activity levels

### Number of iterations $T$

- **Explicit ALS**: 10--20 iterations typically sufficient. Monitor training loss; stop when relative decrease falls below $10^{-4}$
- **Implicit ALS**: 15--50 iterations. The denser loss surface requires more passes
- **Early stopping**: validate on held-out interactions each iteration; stop when validation metric stops improving

### Confidence scaling $\alpha$ (implicit only)

- **Original paper**: $\alpha = 40$ (for TV viewing data)
- **Practical range**: 1--100, highly dependent on the scale of the interaction counts
- **Log-transform alternative**: $c_{ij} = 1 + \alpha \log(1 + r_{ij} / \epsilon)$ dampens the influence of extreme interaction counts and is often more robust
- **Selection**: cross-validate on ranking metrics (precision@k, NDCG) rather than regression metrics, since the goal is correct ranking of preferences

## Key References

- **Koren, Y., Bell, R., & Volinsky, C. (2009)**. "Matrix Factorization Techniques for Recommender Systems." *IEEE Computer*. The definitive survey connecting SVD, neighborhood methods, and latent factor models. Introduced temporal dynamics and bias terms.

- **Hu, Y., Koren, Y., & Volinsky, C. (2008)**. "Collaborative Filtering for Implicit Feedback Datasets." *ICDM*. The foundational paper for implicit ALS, introducing confidence-weighted preferences and the computational trick for efficient full-matrix optimization.

- **Funk, S. (2006)**. "Netflix Update: Try This at Home." Blog post. Popularized SGD-based matrix factorization during the Netflix Prize. Simple, effective, and the ancestor of modern embedding-based approaches.

- **Zhou, Y., Wilkinson, D., Schreiber, R., & Pan, R. (2008)**. "Large-Scale Parallel Collaborative Filtering for the Netflix Prize." *AAIM*. Demonstrated ALS at scale with distributed computation, establishing the template later adopted by Spark MLlib.
