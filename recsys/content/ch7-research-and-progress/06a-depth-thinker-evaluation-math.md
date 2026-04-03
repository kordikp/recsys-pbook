---
id: ch7-eval-math
type: spine
title: "Evaluation Metrics: The Mathematical Details"
readingTime: 5
standalone: false
core: false
teaser: "From nDCG to MNAR bias correction — the complete mathematical framework for recommendation evaluation."
voice: thinker
parent: ch7-evaluation
diagram: null
recallQ: "Why does standard offline evaluation systematically favor exploitative algorithms?"
recallA: "Because the observation probability P(O_ij=1) depends on the logging policy — items the old system showed have interactions, items it didn't show have none. This is MNAR (Missing Not At Random), not MCAR as metrics assume."
status: accepted
---

Evaluation in recommender systems requires careful mathematical thinking. Here's the full framework, from standard metrics to the corrections needed for unbiased assessment.

## Ranking Metrics: Formal Definitions

**Precision@K:**
$$\text{Precision@K} = \frac{|\{i \in \text{Top-K} : i \in \text{Relevant}\}|}{K}$$

**Recall@K:**
$$\text{Recall@K} = \frac{|\{i \in \text{Top-K} : i \in \text{Relevant}\}|}{|\text{Relevant}|}$$

**DCG@K:**
$$DCG@K = \sum_{i=1}^{K} \frac{2^{rel_i} - 1}{\log_2(i+1)}$$

The exponential gain (2^rel - 1) rewards highly relevant items more aggressively than linearly relevant ones. The logarithmic discount models position-dependent user attention:

| Position | Discount | Relative Attention |
|----------|----------|-------------------|
| 1 | 1.000 | 100% |
| 2 | 0.631 | 63% |
| 3 | 0.500 | 50% |
| 5 | 0.387 | 39% |
| 10 | 0.289 | 29% |
| 20 | 0.231 | 23% |

**nDCG@K:**
$$nDCG@K = \frac{DCG@K}{IDCG@K}$$

where IDCG@K is the DCG of the ideal ranking. Normalization enables comparison across users with different numbers of relevant items.

## The MNAR Problem: Formal Treatment

Let O_ij ∈ {0,1} indicate whether entry (i,j) was observed. Standard evaluation assumes:

$$P(O_{ij} = 1) = \text{const} \quad \text{(MCAR)}$$

In reality:
$$P(O_{ij} = 1 | X_{ij}) \neq P(O_{ij} = 1) \quad \text{(MNAR)}$$

Popular items have much higher observation probability. Items recommended by the previous system have inflated observation probability. This creates a feedback loop where offline evaluation systematically favors the status quo.

## Inverse Propensity Scoring (IPS)

One correction approach uses importance weighting:

$$\hat{V}_{\text{IPS}}(\pi) = \frac{1}{N}\sum_{t=1}^N \frac{\pi(a_t | c_t)}{\pi_0(a_t | c_t)} r_t$$

where π₀(a|c) is the logging policy's probability of taking action a in context c. This corrects the bias but introduces high variance when π and π₀ diverge significantly (the propensity ratio can be very large for rare actions).

**Doubly Robust** estimators combine IPS with a direct method to reduce variance:
$$\hat{V}_{\text{DR}} = \hat{V}_{\text{DM}} + \frac{1}{N}\sum_{t=1}^N \frac{\pi(a_t | c_t)}{\pi_0(a_t | c_t)}(r_t - \hat{r}(c_t, a_t))$$

## The LLOO+β Approach

The pragmatic alternative developed at Recombee avoids the need to estimate propensity scores (which are often unknown in practice):

**Leave-Last-One-Out:** For each user u with interactions ordered by time (t₁, ..., t_T), train on interactions {1, ..., T-1} and evaluate on interaction T. This respects the temporal structure of real deployment.

**Popularity penalization:** The weighted recall metric:

$$\text{recall@K}_{\text{LLOO}}^{\beta} = \frac{1}{|U|}\sum_{u \in U} \frac{\mathbb{1}[i_u \in \text{Top-K}_u] \cdot p(i_u)^{-\beta}}{Z_\beta}$$

where p(i) = count(i)/N is the item popularity and Z_β is a normalization constant.

**Optimal β:** Found by maximizing **Model Selection Recall (MSR)** — the probability that the offline metric correctly identifies the best model as measured by online A/B testing.

$$\text{MSR}(\beta) = \frac{1}{|\mathcal{M}|}\sum_{m \in \mathcal{M}} \mathbb{1}[\text{offline-best}(\beta) = \text{online-best}]$$

Empirically, β ≈ 0.30 maximizes MSR, improving from 12.9% (β=0) to 34.3%.

## Simpson's Paradox in Evaluation

An important subtlety: a model can have high aggregate nDCG but perform poorly for specific user groups. Popular items inflate the aggregate metric, hiding poor performance on niche-taste users who matter most for personalization.

The β-penalization explicitly addresses this form of Simpson's paradox by down-weighting the "easy" popular-item predictions that dominate the aggregate.

> **Key references:** See the [full list of Recombee research publications](https://www.recombee.com/research-publications).
> - Järvelin & Kekäläinen (2002). Cumulated Gain-Based Evaluation of IR Techniques.
> - Schnabel et al. (2016). Recommendations as Treatments. ICML 2016.
> - Kasalický et al. (2023). [Bridging Offline-Online Evaluation](https://www.recombee.com/research-publications). evalRS@KDD 2023.