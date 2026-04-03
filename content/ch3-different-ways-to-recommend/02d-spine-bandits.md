---
id: ch3-bandits
type: spine
title: "The Explore-Exploit Dilemma"
readingTime: 3
standalone: true
core: true
teaser: "Should the algorithm serve a proven winner or test an unknown candidate? This is one of the most fundamental trade-offs in recommendations."
voice: universal
parent: null
diagram: null
recallQ: "What is the explore-exploit dilemma?"
recallA: "Should the system serve items with known high reward (exploit) or test uncertain items that might yield higher reward (explore)? Optimal strategies balance both using bandit algorithms."
highlights:
  - "The exploration-exploitation trade-off is the central dilemma in recommendation"
  - "Thompson Sampling balances both automatically via Bayesian posterior sampling"
  - "Contextual bandits add features — time of day, device, user segment"
status: accepted
---

![The Explore-Exploit Restaurant](/images/comic-bandits.svg)

Imagine you're choosing a restaurant in an unfamiliar city. You've tried 3 out of 20 options and found one excellent place. Do you return to the proven choice (guaranteed satisfaction) or try somewhere new (potentially better, potentially worse)?

This is called the **explore-exploit dilemma**, and every recommender system faces it on every request.

## Exploit: Maximize Short-Term Reward

**Exploiting** means recommending items the algorithm already has high confidence you'll engage with. You consumed 10 data engineering articles? Here are 10 more data engineering articles.

The problem: the system converges on a narrow preference model. Maybe you'd deeply value content on systems design, but the algorithm never surfaces it because it's too busy exploiting the known signal.

## Explore: Reduce Uncertainty

**Exploring** means serving items the algorithm is uncertain about. Perhaps a product management article, a design systems deep dive, an economics analysis. Most won't resonate -- but one might reveal an entirely new preference dimension.

## Bandit Algorithms: Principled Exploration

Computer scientists formalized this trade-off through **bandit algorithms** (named after multi-armed slot machines -- "one-armed bandits" -- in casinos). The multi-armed bandit (MAB) problem has been studied since the 1930s (Thompson, 1933; Robbins, 1952) and remains central to modern recommendation systems. For a practical look at how bandits power content discovery in production, see Recombee's post on [exploiting popularity and curiosity to recommend trending content](https://www.recombee.com/blog/bandit-models-exploiting-popularity-and-curiosity-to-recommend-trending-content).

### Thompson Sampling

**Thompson Sampling** is one of the most elegant and empirically effective approaches. The mathematical intuition:

1. For each item (arm), maintain a **Beta distribution** parameterized by successes ($\alpha$) and failures ($\beta$): $\text{Beta}(\alpha, \beta)$
2. On each request, **sample** a value from each item's distribution: $\theta_i \sim \text{Beta}(\alpha_i, \beta_i)$
3. Serve the item with the highest sampled value: $a^* = \arg\max_i \theta_i$
4. Observe the outcome and update: success increments $\alpha$, failure increments $\beta$

The elegance: items with few observations have wide (uncertain) distributions, so they occasionally produce high samples and get explored. Items with many observations have narrow distributions clustered around their true reward rate. Exploration happens naturally through sampling uncertainty -- no explicit exploration parameter needed.

### Upper Confidence Bound (UCB)

An alternative family of algorithms, **UCB** (Auer et al., 2002), takes a deterministic approach: select the item that maximizes:

$$a^* = \arg\max_i \left[ \hat{\mu}_i + c\sqrt{\frac{\ln t}{n_i}} \right]$$

where $\hat{\mu}_i$ is the estimated reward, $t$ is the total number of rounds, $n_i$ is the number of times item $i$ has been served, and $c$ controls the exploration-exploitation balance. The second term -- the confidence bonus -- is large for items with few observations, encouraging exploration.

## Contextual Bandits: State-Dependent Exploration

Real recommendations depend on **context**. You might engage with technical content during work hours but prefer lighter content in the evening.

**Contextual bandits** extend the MAB framework by conditioning the reward model on observable context features:

- Time of day and day of week
- Device type (mobile vs. desktop)
- Recent interaction history
- Session context (what was just consumed)

They learn: "For THIS user, in THIS context, THESE items tend to maximize engagement." This is formalized as learning a policy $\pi(a|x)$ that maps context features $x$ to actions $a$ (items to serve).

Contextual bandits power much of the exploration logic at companies like Microsoft (in Bing and MSN), Netflix, and Spotify. The LinUCB algorithm (Li et al., 2010) and its variants remain widely deployed.

![Explore-Exploit Dilemma](/images/diagram-bandit-exploration.svg)

**Why this matters in production**: Without exploration, recommendations converge to a stale, narrow set and the system loses the ability to adapt to changing user preferences. Without exploitation, the user experience feels random and unsatisfying. The best systems maintain a principled balance -- and bandit algorithms provide the theoretical framework for doing so optimally.
