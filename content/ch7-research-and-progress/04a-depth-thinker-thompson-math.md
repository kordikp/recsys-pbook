---
id: ch7-thompson-math
type: spine
title: "Thompson Sampling: The Full Mathematical Framework"
readingTime: 5
standalone: false
core: false
teaser: "From Bayesian inference to regret bounds — the complete mathematical treatment of Thompson Sampling."
voice: thinker
parent: ch7-bandits
diagram: null
recallQ: "What is the regret bound for Thompson Sampling and why is it near-optimal?"
recallA: "O(√(KT log T)) regret, matching the Lai-Robbins lower bound Ω(√(KT)) up to logarithmic factors. It achieves this by being Bayesian-optimal: selecting the arm with highest posterior probability of being optimal."
status: accepted
---

Thompson Sampling is one of the oldest algorithms in machine learning (1933) and one of the most theoretically elegant. Here's the complete mathematical framework.

## The Bayesian Optimality Principle

Thompson Sampling is **Bayesian-optimal** in a precise sense: at each step, it selects the arm that has the highest *probability of being optimal* given the posterior:

$$a_t = \arg\max_k P(\mu_k = \mu^* | \mathcal{H}_t)$$

where μ* = max_k μ_k is the true optimal reward and H_t is the history of observations.

This is computationally implemented by sampling from the posterior and selecting the argmax of the samples — a Monte Carlo approximation of the Bayesian decision rule.

## The Beta-Bernoulli Case

For binary rewards (click/no-click), the Beta distribution is the **conjugate prior** for Bernoulli observations:

**Prior:** θ_k ~ Beta(α_k, β_k), starting at Beta(1, 1) = Uniform(0, 1)

**Posterior update:** After observing success x = 1 or failure x = 0:
$$\theta_k | x \sim \operatorname{Beta}(\alpha_k + x, \beta_k + 1 - x)$$

**Key moments of Beta(α, β):**
- Mean: α / (α + β)
- Variance: αβ / ((α+β)²(α+β+1))
- Mode: (α-1) / (α+β-2) for α, β > 1

As evidence accumulates (α + β grows), variance decreases → the distribution concentrates → less exploration. This is the **natural annealing** property — no cooling schedule needed.

## Regret Analysis

**Regret** measures cumulative suboptimality:

$$R_T = \sum_{t=1}^T (\mu^* - \mu_{a_t}) = T\mu^* - \sum_{t=1}^T \mu_{a_t}$$

**Thompson Sampling achieves:**
$$R_T = O(\sqrt{KT \log T})$$

For Bernoulli bandits, the asymptotic regret is:

$$R_T \sim \sum_{k: \mu_k < \mu^*} \frac{\mu^* - \mu_k}{\operatorname{KL}(\mu_k \| \mu^*)} \log T$$

where KL(μ_k ‖ μ*) is the Kullback-Leibler divergence between the arm's distribution and the optimal arm's distribution. This matches the **Lai-Robbins lower bound** — no algorithm can do better asymptotically.

## UCB: The Frequentist Alternative

Upper Confidence Bound (UCB) provides a frequentist counterpart:

$$a_t = \arg\max_k \left(\hat{\mu}_k + \sqrt{\frac{2 \ln t}{N_k(t)}}\right)$$

where μ̂_k is the empirical mean and N_k(t) is the number of pulls.

**Comparison:**
- UCB is deterministic (given the same history, always makes the same choice)
- Thompson Sampling is stochastic (samples introduce randomness)
- Both achieve O(√(KT log T)) regret
- Thompson Sampling often performs better empirically, especially with many arms (large K)
- Thompson Sampling naturally extends to complex reward models via posterior sampling

## Contextual Bandits: Adding Features

In recommendation, we have **context** — user features, time of day, device type. Contextual bandits extend the framework:

$$\mu_k(\mathbf{x}) = f_k(\mathbf{x}; \theta)$$

where **x** is the context vector and f_k is a model mapping context to expected reward for arm k.

**LinUCB** (Li et al., 2010) assumes linear rewards:
$$\mu_k(\mathbf{x}) = \theta_k^\top \mathbf{x}$$

with ridge regression for θ_k and confidence bounds from the posterior covariance:
$$a_t = \arg\max_k \left(\hat{\theta}_k^\top \mathbf{x}_t + \alpha \sqrt{\mathbf{x}_t^\top \mathbf{A}_k^{-1} \mathbf{x}_t}\right)$$

where **A**_k = **X**_k^T**X**_k + λ**I** is the regularized design matrix.

## The BMAB Extension: Non-Stationary Rewards

Standard bandit theory assumes stationary rewards. BMAB models non-stationarity via a mixture of Poisson processes:

$$N(t) \sim \text{Poi}(\lambda_{\text{loyal}}) + \text{Poi}(\lambda_{\text{curious}}(t))$$

The curious component has time-varying intensity that spikes during burst events.

**Burst detection** uses change-point detection on the event rate. Upon detection:
1. Reset Thompson priors to Beta(1,1) → force re-exploration
2. Quickly identify the new best arm under changed conditions
3. When the burst subsides, another change point triggers adaptation back

**BPoP** (WWW 2024) extends this to a formal self-feeding process (Hawkes-like):

$$\lambda_{\text{SFP}}(t) = \sum_{t_i < t} \phi(t - t_i)$$

where φ is a triggering kernel — each event increases the probability of future events, modeling viral cascades.

> **Key references:**
> - Thompson, W.R. (1933). On the likelihood that one unknown probability exceeds another.
> - Li et al. (2010). A Contextual-Bandit Approach to Personalized News Article Recommendation. WWW 2010.
> - Agrawal & Goyal (2012). Analysis of Thompson Sampling for the Multi-Armed Bandit Problem.
> - Alves et al. (2021). Burst-aware Multi-Armed Bandits. RecSys 2021.
> - Alves et al. (2024). BPoP: Unraveling Dynamics. WWW 2024.