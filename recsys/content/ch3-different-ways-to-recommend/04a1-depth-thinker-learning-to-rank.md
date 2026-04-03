---
id: ch3-ltr
type: spine
title: "Learning to Rank: From Pointwise to Listwise"
readingTime: 5
standalone: false
core: false
voice: thinker
parent: ch3-pipeline
status: accepted
---

The ranking stage of a recommendation pipeline takes a set of candidate items and must order them by predicted relevance to the user. This is fundamentally a **ranking problem**, not a regression or classification problem -- yet the distinction is surprisingly subtle and has profound consequences for model design.

This section formalizes the three families of Learning to Rank (LTR) approaches, derives their loss functions, and examines the practical trade-offs that determine which approach fits which production scenario.

## The Ranking Problem Formulation

Given a user $u$ and a set of candidate items $\mathcal{C} = \{i_1, i_2, \ldots, i_n\}$, a ranking model produces a scoring function $f(u, i) \in \mathbb{R}$ that induces an ordering over $\mathcal{C}$. The goal is to learn $f$ such that the induced ordering maximizes a ranking quality metric (e.g., NDCG, MAP) on held-out data.

The ground truth is typically a set of relevance labels $y_j \in \{0, 1, \ldots, L\}$ for each item $j$ in $\mathcal{C}$, where higher values indicate greater relevance. In implicit feedback settings, $y_j \in \{0, 1\}$ (clicked or not). In graded relevance settings (e.g., web search), $y_j$ ranges from 0 (irrelevant) to 4 (perfectly relevant).

The key insight that separates LTR from standard supervised learning: **what matters is the relative ordering, not the absolute scores**. A model that assigns scores $(3.0, 1.0, 2.0)$ to three items is equally good as one that assigns $(300, 100, 200)$ -- the ranking is identical. This observation motivates three fundamentally different approaches to learning $f$.

## Pointwise Approaches

The simplest formulation ignores the ranking structure entirely and treats each item independently.

### Regression Formulation

Treat the relevance label $y_j$ as a continuous target and minimize the mean squared error:

$$\mathcal{L}_{\text{MSE}} = \frac{1}{n} \sum_{j=1}^{n} \left( f(u, i_j) - y_j \right)^2$$

The model learns to predict the absolute relevance of each item. Ranking is then obtained by sorting items by their predicted scores.

### Classification Formulation

For binary relevance ($y_j \in \{0, 1\}$), use binary cross-entropy:

$$\mathcal{L}_{\text{BCE}} = -\frac{1}{n} \sum_{j=1}^{n} \left[ y_j \log \sigma(f(u, i_j)) + (1 - y_j) \log(1 - \sigma(f(u, i_j))) \right]$$

where $\sigma(\cdot)$ is the sigmoid function. For multi-level relevance, ordinal regression or multi-class cross-entropy can be used.

### Limitations

Pointwise approaches have a fundamental mismatch with the ranking objective:

1. **Scale sensitivity**: MSE penalizes a prediction of 3.5 for a true label of 4.0 identically whether the item is at position 1 or position 100 -- but ranking errors at the top of the list are far more costly than errors at the bottom.

2. **Independence assumption**: Each item is scored independently, so the model has no mechanism to learn that item $A$ should rank above item $B$. The relative ordering emerges only as a side effect of accurate absolute predictions.

3. **Label imbalance**: In recommendation, the vast majority of candidates are irrelevant ($y_j = 0$). The model optimizes heavily for correctly predicting "not relevant" rather than correctly ordering the few relevant items.

Despite these limitations, pointwise approaches remain widely used because they are simple to implement, compatible with any regression or classification model, and often provide a strong baseline.

## Pairwise Approaches

Pairwise methods address the core deficiency of pointwise approaches by directly optimizing the relative ordering of item pairs. The key idea: decompose the ranking problem into a set of pairwise comparison problems.

Given a pair of items $(i_a, i_b)$ where $y_a > y_b$ (item $a$ is more relevant), the model should assign $f(u, i_a) > f(u, i_b)$. The loss penalizes violations of this ordering.

### BPR: Bayesian Personalized Ranking

Rendle et al. (2009) derived BPR from a Bayesian maximum a posteriori formulation for implicit feedback. The key assumption: a user prefers an observed (interacted) item over an unobserved one.

For a user $u$, let $i^+$ be an observed item and $i^-$ an unobserved item. Define $\hat{x}_{uij} = f(u, i^+) - f(u, i^-)$ as the score difference. The BPR objective maximizes the posterior probability of the correct ordering:

$$\mathcal{L}_{\text{BPR}} = -\sum_{(u, i^+, i^-)} \ln \sigma(\hat{x}_{uij}) + \lambda \|\Theta\|^2$$

where $\sigma(\cdot)$ is the sigmoid function and $\Theta$ represents all model parameters.

**Interpreting the gradient**: The derivative of the BPR loss with respect to $\hat{x}_{uij}$ is:

$$\frac{\partial \mathcal{L}_{\text{BPR}}}{\partial \hat{x}_{uij}} = -\frac{1}{1 + e^{\hat{x}_{uij}}} = -(1 - \sigma(\hat{x}_{uij}))$$

When the model already scores the positive item much higher than the negative ($\hat{x}_{uij} \gg 0$), $\sigma(\hat{x}_{uij}) \approx 1$ and the gradient vanishes -- the model focuses its learning on pairs it currently gets wrong. This is an implicit form of hard-negative mining.

BPR is model-agnostic: $f(u, i)$ can be matrix factorization, a neural network, or any differentiable scoring function. Combined with matrix factorization, BPR-MF became a standard baseline for implicit collaborative filtering.

### RankNet

Burges et al. (2005) at Microsoft Research formulated pairwise ranking as a probabilistic classification problem. For items $i_a$ and $i_b$, the model estimates the probability that $i_a$ should be ranked above $i_b$:

$$P(i_a \succ i_b) = \sigma(s_a - s_b)$$

where $s_a = f(u, i_a)$ and $s_b = f(u, i_b)$. The loss for a pair where the ground truth ordering is $i_a \succ i_b$ is:

$$\mathcal{L}_{\text{RankNet}} = -\bar{P}_{ab} \log P(i_a \succ i_b) - (1 - \bar{P}_{ab}) \log(1 - P(i_a \succ i_b))$$

where $\bar{P}_{ab} \in \{0, 0.5, 1\}$ is the target probability (1 if $y_a > y_b$, 0 if $y_a < y_b$, 0.5 if $y_a = y_b$).

For the common case $\bar{P}_{ab} = 1$:

$$\mathcal{L}_{\text{RankNet}} = -\log \sigma(s_a - s_b) = \log(1 + e^{-(s_a - s_b)})$$

This is equivalent to logistic regression on the score differences.

### Computational Cost of Pairwise Methods

The number of item pairs in a candidate set of size $n$ is $\binom{n}{2} = O(n^2)$. For a candidate set of 1000 items, this means up to 500,000 pairs per query.

In practice, this is mitigated by:
- **Sampling**: Only a subset of pairs is used per training step (BPR samples one positive and one negative per user)
- **Focusing on discordant pairs**: Many pairs are already correctly ordered; the model only needs gradient signal from violations
- **Efficient gradient computation**: RankNet's "speed-up" observes that the gradient for item $i_a$ across all its pairs can be accumulated as a single sum, avoiding explicit enumeration

## Listwise Approaches

Listwise methods operate on the entire ranked list simultaneously, directly optimizing ranking metrics. This is the most natural formulation but also the most technically challenging, because ranking metrics like NDCG are **discontinuous and non-differentiable** -- they depend on sort operations and indicator functions.

### The NDCG Metric

Normalized Discounted Cumulative Gain at position $K$ is defined as:

$$\text{NDCG@}K = \frac{\text{DCG@}K}{\text{IDCG@}K}$$

where:

$$\text{DCG@}K = \sum_{j=1}^{K} \frac{2^{y_{\pi(j)}} - 1}{\log_2(j + 1)}$$

Here $\pi(j)$ is the item at position $j$ in the model's ranking, and $y_{\pi(j)}$ is its relevance label. IDCG is the DCG of the ideal (ground-truth) ranking.

NDCG is non-differentiable because it depends on the discrete permutation $\pi$ induced by sorting the scores. Small perturbations to scores that don't change the sort order produce zero gradient; perturbations that swap adjacent items produce a discontinuous jump.

### LambdaMART

LambdaMART (Burges, 2010) is the most successful listwise method in practice. It is a gradient boosted decision tree model that uses "lambda gradients" -- pseudo-gradients that incorporate the change in NDCG caused by swapping a pair of items.

The core idea: for each pair $(i_a, i_b)$ where $y_a > y_b$, define the lambda gradient as:

$$\lambda_{ab} = \frac{-\sigma(s_b - s_a)}{1 + e^{\sigma(s_a - s_b)}} \cdot |\Delta \text{NDCG}_{ab}|$$

where $|\Delta \text{NDCG}_{ab}|$ is the absolute change in NDCG that would result from swapping items $i_a$ and $i_b$ in the current ranking.

**Why this works**: The term $-\sigma(s_b - s_a)$ is the RankNet gradient -- it pushes the model to correct pairwise ordering violations. The $|\Delta \text{NDCG}_{ab}|$ factor **weights** each pair by how much correcting it would improve the ranking metric. Swapping items at positions 1 and 2 produces a much larger $\Delta\text{NDCG}$ than swapping items at positions 99 and 100 -- so the model focuses its capacity on the top of the ranking.

The per-item gradient is the sum of its lambda contributions across all pairs:

$$\lambda_a = \sum_{b: y_a > y_b} \lambda_{ab} - \sum_{b: y_b > y_a} \lambda_{ba}$$

LambdaMART trains a gradient boosted tree ensemble using these lambda gradients in place of standard gradients. It has won numerous LTR competitions and remains a production workhorse at major search engines.

### SoftRank: Differentiable NDCG Approximation

SoftRank (Taylor et al., 2008) takes a different approach: instead of engineering pseudo-gradients, it makes the ranking metric itself differentiable by replacing the hard sort with a probabilistic approximation.

The key idea: treat each score $s_j$ as the mean of a Gaussian random variable $S_j \sim \mathcal{N}(s_j, \sigma^2)$. The probability that item $i_a$ is ranked at position $r$ is:

$$P(\text{rank}(i_a) = r) \approx \prod_{b \neq a} \left[ P(S_a > S_b) \right]^{\mathbb{I}[r \text{ requires } a \succ b]}$$

where the probability that $S_a > S_b$ is:

$$P(S_a > S_b) = \Phi\left( \frac{s_a - s_b}{\sqrt{2}\sigma} \right)$$

with $\Phi$ being the standard normal CDF. The expected NDCG under this soft ranking distribution is differentiable with respect to the scores $s_j$, enabling standard gradient-based optimization.

The temperature parameter $\sigma$ controls the smoothness: large $\sigma$ produces a smooth but loose approximation; small $\sigma$ approaches the true (non-differentiable) NDCG but has sharper gradients. Annealing $\sigma$ during training (starting large, decreasing over epochs) combines the stability of smooth optimization with the precision of sharp ranking.

## Comparison: Pointwise vs. Pairwise vs. Listwise

| Dimension | Pointwise | Pairwise | Listwise |
|---|---|---|---|
| **Input unit** | Single item | Item pair | Full ranked list |
| **Loss function** | MSE, cross-entropy | BPR, RankNet, hinge | LambdaMART, SoftRank, ListNet |
| **Optimizes for** | Absolute relevance prediction | Relative ordering of pairs | Ranking metric directly (e.g., NDCG) |
| **Position sensitivity** | None -- all positions weighted equally | Indirect -- via pair sampling | Explicit -- top positions weighted more |
| **Computational cost** | $O(n)$ per query | $O(n^2)$ pairs (reducible via sampling) | $O(n^2)$ for lambda computation, $O(n \log n)$ for sort |
| **Implementation complexity** | Low -- standard supervised learning | Moderate -- pair generation and sampling | High -- custom gradients or differentiable approximations |
| **Typical models** | Any regressor/classifier | MF + BPR, neural + RankNet | GBDT (LambdaMART), neural + SoftRank |
| **Ranking quality** | Baseline | Strong | Best (on well-curated data) |
| **When to use** | Quick baseline; abundant graded labels | Implicit feedback; pairwise preferences | Search ranking; high-stakes recommendation slates |

## Position Bias Correction in LTR

A critical complication in learning from user interaction data: users tend to click on items at higher positions regardless of relevance. This is **position bias**, and it corrupts the training signal for all LTR approaches.

### The Examination Hypothesis

The standard model for position bias (Richardson et al., 2007) decomposes click probability as:

$$P(\text{click} \mid u, i, k) = P(\text{relevant} \mid u, i) \cdot P(\text{examine} \mid k)$$

where $k$ is the position at which item $i$ is displayed. The user must both find the item relevant AND examine the position for a click to occur. Examination probability decreases with position -- a near-universal empirical finding across platforms.

This means a clicked item at position 10 provides stronger evidence of relevance than a clicked item at position 1 (the user examined position 1 with high probability regardless). Conversely, a non-clicked item at position 20 provides weak evidence of irrelevance (the user may never have examined it).

### Unbiased LTR via Inverse Propensity Scoring

Joachims et al. (2017) proposed correcting position bias using Inverse Propensity Scoring (IPS). Define the propensity of position $k$ as:

$$\theta_k = P(\text{examine} \mid k)$$

The unbiased estimator of a ranking metric $\Delta$ is obtained by re-weighting each observation by the inverse of its examination probability:

$$\hat{\Delta}_{\text{IPS}} = \frac{1}{|\mathcal{Q}|} \sum_{q \in \mathcal{Q}} \sum_{j=1}^{n_q} \frac{c_j}{\theta_{k_j}} \cdot w(j)$$

where $c_j \in \{0, 1\}$ is the click indicator, $k_j$ is the position at which item $j$ was shown, and $w(j)$ is a position-dependent weight from the ranking metric (e.g., the DCG discount $1/\log_2(j+1)$).

**Intuition**: A click at position 10 (where $\theta_{10}$ is low) is up-weighted because it represents many unobserved relevant items that were examined but not clicked at higher positions. A click at position 1 (where $\theta_1 \approx 1$) receives minimal up-weighting.

**Estimating propensities**: The examination probabilities $\theta_k$ can be estimated via:
- **Randomized experiments**: Randomly shuffle items across positions and measure click rates (the gold standard but expensive)
- **Result randomization**: Swap items between adjacent positions and compare click rates (Joachims et al., 2017)
- **EM algorithms**: Jointly estimate relevance and propensity from observational data (Wang et al., 2018)

The IPS approach is model-agnostic -- it can be applied to pointwise, pairwise, or listwise losses by incorporating the propensity weights into the loss function.

## Feature Engineering for Ranking Models

Production ranking models in the scoring stage of the recommendation pipeline rely on rich feature representations that go far beyond user-item IDs.

### Feature Categories

**User features**: Demographics (age, gender, location), account age, activity level, historical engagement statistics (click-through rate, average session length), user segment membership, subscription tier.

**Item features**: Content metadata (genre, duration, author), creation date, historical performance statistics (global CTR, average rating, view count), content quality signals, item embeddings from the retrieval stage.

**Cross features (user-item interactions)**: Whether the user has previously interacted with this item's creator, similarity between the item's category and the user's preferred categories, match between item language and user's language preferences, cosine similarity of user and item embeddings.

**Contextual features**: Time of day, day of week, device type (mobile vs. desktop), session depth (how many items has the user already viewed in this session), preceding items in the session.

### Feature Interactions

Raw features are often insufficient -- the ranking model needs to learn feature interactions. For example, "time of day" and "content genre" interact: a user might prefer news in the morning and entertainment at night.

Traditional approaches engineer these interactions manually (e.g., creating a "morning $\times$ news" feature). Neural feature interaction models like DeepFM (Guo et al., 2017) automate this by learning both low-order (factorization machine) and high-order (deep neural network) feature interactions end-to-end. These models combine the efficiency of factored representations for sparse high-cardinality features with the expressiveness of deep networks for complex interactions.

## Practical Guidance: When to Use Which Approach

**Start with pointwise** if you have explicit relevance labels (star ratings, editorial judgments) and need a quick baseline. Logistic regression or gradient boosted trees with binary cross-entropy loss are hard to beat for their simplicity.

**Use pairwise (BPR)** when working with implicit feedback (clicks, purchases, views) where you have positive signals but no explicit negative signals. BPR with matrix factorization or neural scoring functions is the standard approach for collaborative filtering with implicit data.

**Use pairwise (RankNet)** when you have graded relevance labels and want a step up from pointwise without the complexity of listwise methods. RankNet with neural networks provides a clean, well-understood training framework.

**Use listwise (LambdaMART)** when ranking quality at the top of the list is paramount and you have well-curated training data with graded relevance labels. LambdaMART with gradient boosted trees is the default choice for web search ranking and has strong empirical performance in recommendation re-ranking.

**Invest in position bias correction** whenever you train on user interaction data (clicks, views) collected from a system that displays items in a ranked list. Without correction, the model learns to replicate the biases of the logging policy rather than the true user preferences.

**Combine approaches across pipeline stages**: Use BPR for the retrieval model (implicit feedback, scalable), and LambdaMART or a neural listwise model for the ranking stage (rich features, position-sensitive optimization). This is the architecture deployed at most major platforms.

## References

- Rendle, S., Freudenthaler, C., Gantner, Z., & Schmidt-Thieme, L. (2009). "BPR: Bayesian Personalized Ranking from Implicit Feedback." *Proceedings of the 25th Conference on Uncertainty in Artificial Intelligence (UAI)*.

- Burges, C., Shaked, T., Renshaw, E., et al. (2005). "Learning to Rank using Gradient Descent." *Proceedings of the 22nd International Conference on Machine Learning*.

- Burges, C. J. C. (2010). "From RankNet to LambdaRank to LambdaMART: An Overview." *Microsoft Research Technical Report*.

- Taylor, M., Guiver, J., Robertson, S., & Minka, T. (2008). "SoftRank: Optimizing Non-Smooth Rank Metrics." *Proceedings of the 1st ACM International Conference on Web Search and Data Mining*.

- Joachims, T., Swaminathan, A., & Schnabel, T. (2017). "Unbiased Learning-to-Rank with Biased Feedback." *Proceedings of the 10th ACM International Conference on Web Search and Data Mining*.

- Richardson, M., Dominowska, E., & Ragno, R. (2007). "Predicting Clicks: Estimating the Click-Through Rate for New Ads." *Proceedings of the 16th International Conference on World Wide Web*.

- Wang, X., Bendersky, M., Metzler, D., & Najork, M. (2018). "Learning to Rank with Selection Bias in Personal Search." *Proceedings of the 41st ACM SIGIR Conference*.

- Guo, H., Tang, R., Ye, Y., Li, Z., & He, X. (2017). "DeepFM: A Factorization-Machine based Neural Network for CTR Prediction." *Proceedings of the 26th International Joint Conference on Artificial Intelligence*.
