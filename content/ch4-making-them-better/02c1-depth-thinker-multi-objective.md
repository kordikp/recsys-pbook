---
id: ch4-multi-objective
type: spine
title: "Multi-Objective Optimization: When Goals Conflict"
readingTime: 5
standalone: false
core: false
voice: thinker
parent: ch4-objectives
status: accepted
teaser: "When a recommender must be relevant, diverse, fair, and profitable all at once, simple optimization breaks down. Multi-objective methods navigate the trade-offs."
recallQ: "Why can't a multi-objective recommender simply maximize all objectives at once?"
recallA: "Because objectives conflict — improving one (e.g., diversity) necessarily degrades another (e.g., click-through rate). The best achievable solutions form a Pareto frontier where no objective can improve without sacrificing another."
---

The parent section established that every recommender optimizes an objective function, and that different stakeholders want different things. This section confronts the mathematical reality of what happens when you try to optimize for *all of them at once*.

The short answer: you cannot. The longer answer involves Pareto frontiers, Lagrangian multipliers, and a healthy respect for Goodhart's Law.

## The Multi-Objective Problem

A production recommender system must simultaneously satisfy objectives that pull in fundamentally different directions. Consider a single recommendation slate of $K$ items for a given user. The system might want to:

1. **Maximize relevance**: Show items the user is most likely to enjoy
2. **Maximize diversity**: Ensure the slate covers a range of genres, topics, or perspectives
3. **Ensure fairness**: Give emerging creators minimum viable exposure
4. **Maximize revenue**: Prioritize items with higher monetization potential

These objectives are not merely different -- they are *structurally antagonistic*. A perfectly relevant slate (all items from the user's favorite genre) scores zero on diversity. A perfectly fair slate (equal exposure across all creators) ignores the user's preferences entirely. A revenue-maximizing slate pushes promoted content at the expense of user satisfaction.

Formally, we want to solve:

$$\max_{\pi} \bigl(f_1(\pi),\; f_2(\pi),\; \ldots,\; f_m(\pi)\bigr)$$

where $\pi$ is the recommendation policy and $f_1, \ldots, f_m$ are the $m$ competing objective functions. There is no single $\pi^*$ that simultaneously maximizes all objectives.

## Pareto Optimality: The Frontier of Trade-Offs

The central concept in multi-objective optimization is the **Pareto frontier** (also called the Pareto front or Pareto optimal set).

**Definition.** A solution $\pi^*$ is **Pareto optimal** if there exists no other feasible solution $\pi'$ such that $f_k(\pi') \geq f_k(\pi^*)$ for all objectives $k$ and $f_j(\pi') > f_j(\pi^*)$ for at least one objective $j$. In other words, you cannot improve any objective without making at least one other objective worse.

The set of all Pareto optimal solutions forms the **Pareto frontier** -- a surface (or curve, in two dimensions) representing the best achievable trade-offs. Every point on this frontier is equally "optimal" in the multi-objective sense; choosing among them is a *value judgment*, not a mathematical one.

Consider a simplified two-objective problem: relevance (measured by nDCG) versus diversity (measured by intra-list distance). The Pareto frontier might look like this:

| Configuration | nDCG@10 | Diversity | Pareto Optimal? |
|---|---|---|---|
| Pure relevance ranking | 0.82 | 0.31 | Yes |
| Mild diversification | 0.79 | 0.52 | Yes |
| Balanced | 0.73 | 0.68 | Yes |
| Heavy diversification | 0.61 | 0.84 | Yes |
| Random ranking | 0.35 | 0.90 | No (dominated) |

The random ranking is *not* Pareto optimal because the heavy diversification configuration achieves both better relevance and nearly as much diversity. Every other configuration is Pareto optimal -- improving one metric necessarily degrades the other.

## Scalarization: Reducing Many Objectives to One

The most common practical approach is **scalarization**: combine multiple objectives into a single scalar score and optimize that.

### Weighted Linear Sum

The simplest scalarization assigns a weight to each objective:

$$F(\pi) = \sum_{k=1}^{m} w_k \cdot f_k(\pi), \qquad \sum_{k=1}^{m} w_k = 1, \quad w_k \geq 0$$

For a concrete example, a video platform might score each candidate item $i$ for user $u$ as:

$$\text{score}(u, i) = w_1 \cdot P(\text{click} \mid u, i) + w_2 \cdot \mathbb{E}[\text{watch time} \mid u, i] + w_3 \cdot \text{diversity}(i) + w_4 \cdot \text{boost}_{\text{fair}}(i)$$

**Strengths**: Simple to implement, easy to understand, weights provide interpretable knobs for product teams.

**Weaknesses**: The weighted sum can only find solutions on the *convex* part of the Pareto frontier. If the frontier is non-convex (which is common), entire regions of optimal trade-offs are unreachable regardless of how you set the weights. The method is also fragile -- small changes in weights can cause large jumps in the selected solution.

### $\varepsilon$-Constraint Method

An alternative that handles non-convex frontiers: optimize one objective while constraining the others:

$$\max_{\pi} \; f_1(\pi) \qquad \text{subject to} \quad f_k(\pi) \geq \varepsilon_k \quad \text{for } k = 2, \ldots, m$$

For example: *maximize click-through rate, subject to the constraint that at least 30% of impressions go to items from underrepresented creators and that the intra-list diversity score exceeds 0.5.*

This formulation is more expressive than weighted sums (it can find any Pareto optimal solution, including those on non-convex regions) and maps naturally to business constraints ("we *must* show at least X% fair content").

## Common Objective Functions in Practice

### Click-Through Rate (CTR) Prediction

$$f_{\text{CTR}}(u, i) = P(\text{click} \mid u, i)$$

Typically modeled by a binary classifier (logistic regression, deep neural network, or gradient-boosted trees). CTR is easy to measure and provides fast feedback, but it rewards clickbait -- items with enticing thumbnails or titles that do not deliver on their promise.

### Watch Time (or Dwell Time) Prediction

$$f_{\text{time}}(u, i) = \mathbb{E}[\text{time spent} \mid u, i]$$

A regression target. Watch time is a stronger signal of genuine engagement than clicks, but it has its own pathologies: a user might spend 45 minutes hate-watching content they regret, or leave a tab open without actually watching. Netflix discovered that **"would watch again"** -- a post-consumption satisfaction signal -- correlated more strongly with long-term retention than raw watch time. The two metrics can point in opposite directions for entire categories of content.

### Diversity: Maximal Marginal Relevance (MMR)

The classic diversity-aware ranking function, introduced by Carbonell and Goldstein (1998):

$$\text{MMR}(i) = \lambda \cdot \text{sim}(i, q) - (1 - \lambda) \cdot \max_{j \in S} \text{sim}(i, j)$$

where $q$ is the user query or profile, $S$ is the set of items already selected for the slate, and $\lambda \in [0, 1]$ controls the relevance-diversity trade-off.

The first term rewards relevance to the user. The second term penalizes redundancy with items already in the slate. When $\lambda = 1$, MMR reduces to pure relevance ranking. When $\lambda = 0$, it maximizes diversity with no regard for relevance.

MMR selects items greedily: at each step, add the item with the highest MMR score given the items already chosen. This greedy procedure does not guarantee the globally optimal diverse set, but it is computationally efficient and works well in practice.

### Fairness: Minimum Exposure Guarantees

Fairness objectives ensure that items or creators receive a minimum share of impressions:

$$f_{\text{fair}}: \quad \frac{\text{impressions}(g)}{\text{total impressions}} \geq \tau_g \quad \text{for each protected group } g$$

This can be formulated as a constraint (in the $\varepsilon$-constraint framework) or as a penalty term. More sophisticated formulations use **amortized fairness**, which allows individual recommendation lists to be unfair as long as the aggregate exposure over time meets the fairness targets.

## Re-Ranking as Multi-Objective Optimization

In practice, most production systems implement multi-objective optimization through **re-ranking**: a two-stage process where objectives are applied sequentially.

**Stage 1: Relevance ranking.** A high-capacity model scores all candidate items by predicted relevance (CTR, watch time, or a combination). This produces a ranked list optimized purely for user preference.

**Stage 2: Re-ranking for secondary objectives.** A second pass modifies the list to incorporate diversity, fairness, and business constraints. Common re-ranking strategies include:

- **MMR-based diversification** (described above)
- **Slot-based insertion**: Reserve specific positions (e.g., positions 3, 7, 15) for fairness-mandated or editorially curated items
- **Constrained re-ranking**: Solve an optimization problem that maximizes relevance subject to diversity and fairness constraints

The re-ranking approach is pragmatic: it preserves the primary relevance signal while giving product teams explicit control over secondary objectives. Its limitation is that the two stages are only loosely coupled -- the re-ranker cannot recover good diverse candidates that the first stage failed to retrieve.

## The Lagrangian Framework

For the mathematically inclined, the $\varepsilon$-constraint formulation naturally leads to **Lagrangian relaxation**. Consider the constrained problem:

$$\max_{\pi} \; f_1(\pi) \quad \text{s.t.} \quad f_k(\pi) \geq \varepsilon_k, \; k = 2, \ldots, m$$

The Lagrangian is:

$$\mathcal{L}(\pi, \boldsymbol{\mu}) = f_1(\pi) + \sum_{k=2}^{m} \mu_k \bigl(f_k(\pi) - \varepsilon_k\bigr)$$

where $\mu_k \geq 0$ are the Lagrange multipliers (dual variables). The dual problem is:

$$\min_{\boldsymbol{\mu} \geq 0} \max_{\pi} \; \mathcal{L}(\pi, \boldsymbol{\mu})$$

Each multiplier $\mu_k$ has a concrete interpretation: it is the **shadow price** of relaxing constraint $k$ by one unit. A large $\mu_k$ means the constraint on objective $k$ is binding and costly -- relaxing it slightly would yield a significant improvement in the primary objective. This provides a principled mechanism for understanding the cost of each fairness or diversity constraint.

In practice, the multipliers can be learned end-to-end via dual gradient descent: alternate between (1) optimizing $\pi$ for fixed $\boldsymbol{\mu}$, and (2) updating $\boldsymbol{\mu}$ based on constraint violations.

## Multi-Tower Models: Learning Objectives Jointly

Modern deep learning systems implement multi-objective optimization architecturally through **multi-tower** (or **multi-head**) models. The architecture consists of:

- A **shared backbone** that learns a common representation of the (user, item) pair
- Separate **prediction heads** (towers) for each objective: one for CTR, one for watch time, one for satisfaction, etc.

$$\mathbf{h} = \text{SharedEncoder}(x_u, x_i)$$
$$\hat{y}_{\text{CTR}} = \text{Head}_{\text{CTR}}(\mathbf{h}), \qquad \hat{y}_{\text{time}} = \text{Head}_{\text{time}}(\mathbf{h}), \qquad \hat{y}_{\text{sat}} = \text{Head}_{\text{sat}}(\mathbf{h})$$

The total training loss is a weighted combination:

$$\mathcal{L} = \alpha_1 \mathcal{L}_{\text{CTR}} + \alpha_2 \mathcal{L}_{\text{time}} + \alpha_3 \mathcal{L}_{\text{sat}}$$

At serving time, the final ranking score combines the predicted values from each head using product-defined weights -- which can be adjusted without retraining the model. This separation of *learning* (model training) from *policy* (weight tuning) is one of the key practical advantages of multi-tower architectures.

Google's multi-objective ranking system for YouTube recommendations (Zhao et al., 2019) uses exactly this pattern, with separate heads for click probability, expected watch time, and multiple engagement signals, combined at serving time through a configurable blending function.

## Goodhart's Law: When Metrics Become Targets

Perhaps the most important lesson in multi-objective optimization is not mathematical but philosophical. **Goodhart's Law** states: *When a measure becomes a target, it ceases to be a good measure.*

In recommender systems, this manifests concretely:

- **Optimizing for clicks** produces clickbait
- **Optimizing for watch time** produces addictive content loops
- **Optimizing for shares** amplifies outrage and controversy
- **Optimizing for completion rate** biases toward short content

Each of these metrics was originally chosen as a *proxy* for user satisfaction. Once the algorithm optimized for them aggressively enough, the proxy diverged from the underlying goal it was meant to represent.

Netflix provides an instructive case study. The company initially optimized for predicted star ratings, but found that users rated films they "should" watch (prestige dramas) higher than films they actually enjoyed rewatching (comfort comedies). Switching to behavioral signals (what users actually watch and finish) improved engagement but introduced new problems: autoplay-driven completions inflated the signal for mediocre content that users did not actively choose to stop. The eventual solution involved multiple signals -- **"would watch again"** surveys, re-watch behavior, and explicit thumbs feedback -- combined through a multi-objective framework.

## The Stakeholder Triangle

The multi-objective challenge is fundamentally a *political* problem as much as a mathematical one. Three stakeholder groups have partially aligned but partially conflicting interests:

**Users** want content they will genuinely value. They benefit from relevance, diversity, and serendipity. They are harmed by addictive design patterns, filter bubbles, and manipulative recommendations.

**Content creators** want fair access to audiences. They benefit from exposure guarantees and transparent ranking criteria. They are harmed by winner-take-all dynamics where a small number of items capture the vast majority of impressions.

**The platform** wants sustainable business metrics: revenue, retention, growth. The platform benefits when users and creators are satisfied (long-term alignment) but faces constant temptation to extract short-term value at their expense (misalignment).

As Recombee's objectives framework illustrates, effective recommendation design requires explicitly mapping these stakeholder perspectives onto measurable objectives and understanding their interactions -- which objectives reinforce each other, and which ones trade off. The four-perspective model (user, content provider, business, platform) from the parent section provides a structured way to audit whether a system's objective function reflects a reasonable balance among stakeholders, or has been captured by one group's interests at the expense of the others.

## Practical Takeaways

1. **There is no single "best" recommendation** -- only Pareto optimal trade-offs. Anyone claiming to have found the perfect objective function is either oversimplifying or selling something.

2. **Scalarization is the pragmatic default**, but be aware of its blind spots (non-convex frontiers, fragility to weight changes). Complement it with constraint-based approaches for hard business requirements.

3. **Separate learning from policy.** Train multi-head models that predict multiple objectives; combine predictions at serving time with tunable weights. This lets product teams iterate on trade-offs without retraining models.

4. **Monitor for Goodhart effects continuously.** When a proxy metric improves but user satisfaction surveys or retention metrics stagnate or decline, the proxy has been gamed -- either by the algorithm itself or by strategic content creators.

5. **Make the trade-offs explicit and auditable.** The weights $w_k$ in a scalarization, or the thresholds $\varepsilon_k$ in a constraint formulation, encode value judgments. They should be documented, reviewed, and debated -- not buried in a configuration file.

> **Key references:**
> - Carbonell, J. & Goldstein, J. (1998). The Use of MMR, Diversity-Based Reranking for Reordering Documents and Producing Summaries. *SIGIR 1998*.
> - Zhao, Z., Hong, L., Wei, L., et al. (2019). Recommending What Video to Watch Next: A Multitask Ranking System. *RecSys 2019*.
> - Steck, H. (2018). Calibrated Recommendations. *RecSys 2018*.
> - Mehrotra, R., McInerney, J., Bouchard, H., Lalmas, M., & Diaz, F. (2018). Towards a Fair Marketplace: Counterfactual Evaluation of the Trade-off Between Relevance, Fairness & Satisfaction in Recommendation Systems. *CIKM 2018*.
> - Recombee (2024). Modern Recommender Systems, Part 3: Objectives. *recombee.com/blog*.
