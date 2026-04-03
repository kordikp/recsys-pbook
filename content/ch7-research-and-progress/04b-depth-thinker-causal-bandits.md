---
id: ch7-causal-bandits
type: spine
title: "Causal Bandits: When Correlation Isn't Enough"
readingTime: 4
standalone: false
core: false
teaser: "Standard bandits learn what works. Causal bandits learn WHY it works — enabling better generalization and fairer decisions."
voice: thinker
parent: ch7-bandits
diagram: null
recallQ: "What is the difference between standard and causal bandit algorithms?"
recallA: "Standard bandits learn correlational reward patterns (arm A yields high reward). Causal bandits learn causal mechanisms (arm A works BECAUSE of feature X), enabling transfer to new contexts and identification of confounders."
status: accepted
---

Standard multi-armed bandits learn through trial and error: pull arm A, observe reward, update belief. This works well when the reward distribution is stationary and the arms are independent. But in recommendation, neither assumption holds.

## The Confounder Problem

Consider a recommendation bandit that shows article A to user groups and observes clicks. Group 1 (tech professionals) clicks 40% of the time. Group 2 (general audience) clicks 5%. The overall click rate is 22%.

A standard bandit learns: "Article A has ~22% click rate." But this number is meaningless — it's a confounded average across two populations with very different behavior.

**The causal question:** Does Article A *cause* clicks, or do user characteristics (tech background) *cause* both the recommendation and the click? If users are not randomly assigned, the observed click rate conflates the article's quality with selection bias.

## Structural Causal Models for Bandits

A causal bandit maintains a **structural causal model** (SCM) of the recommendation process:

$$\text{User Context } X \rightarrow \text{Recommendation } A \rightarrow \text{Outcome } Y$$
$$X \rightarrow Y \quad \text{(direct confounding path)}$$

The causal effect of recommendation A on outcome Y, controlling for context X:

$$\text{CATE}(a, x) = E[Y | do(A=a), X=x] - E[Y | do(A=a'), X=x]$$

where $do(A=a)$ denotes an intervention (showing article A regardless of context), not an observation.

## Why Causal Bandits Matter for RecSys

### 1. Better Generalization

A correlational bandit learns: "Users who see item A click 40%." But if this correlation is driven by the logging policy (the old system showed A primarily to users who would click anyway), the bandit's estimate is inflated.

A causal bandit asks: "What is the *incremental* click probability from showing item A, compared to showing nothing?" This counterfactual estimate is more useful for decision-making.

### 2. Fairness

Standard bandits can perpetuate bias: if the logging policy over-recommended items to majority demographics, the bandit learns that these items are "better" — when in reality they just had more opportunity.

Causal bandits can identify and correct for this **exposure bias** by modeling the causal path from demographics to recommendation to outcome.

### 3. Non-Stationary Environments

In non-stationary environments (like the BMAB burst scenario from the MFF presentation), causal models help distinguish between:
- The item became popular because we recommended it more (our causal effect)
- The item became popular due to an external event (exogenous cause)

This distinction is critical for deciding whether to sustain or reduce recommendations for trending items.

## The Propensity-Weighted Bandit

A practical approach combines bandit algorithms with inverse propensity scoring:

$$\hat{\mu}_a^{IPS} = \frac{1}{N_a}\sum_{t: A_t=a} \frac{r_t}{p(A_t=a | X_t)}$$

where $p(A_t=a | X_t)$ is the propensity — the probability that the logging policy would have chosen action a in context X.

**Thompson Sampling with IPS:** Instead of updating Beta priors with raw rewards, update with propensity-weighted rewards:

$$\alpha_a \leftarrow \alpha_a + \frac{r_t}{p(A_t=a | X_t)}, \quad \beta_a \leftarrow \beta_a + \frac{1 - r_t}{p(A_t=a | X_t)}$$

This corrects for the logging policy's selection bias, producing unbiased reward estimates even from observational data.

## Off-Policy Bandit Evaluation

Before deploying a new bandit policy, evaluate it on logged data:

$$\hat{V}(\pi) = \frac{1}{N}\sum_{t=1}^{N} \frac{\pi(A_t | X_t)}{\pi_0(A_t | X_t)} r_t$$

This **off-policy evaluation** estimates the new policy's performance without running it live. The challenge is variance: when π and π₀ diverge, the importance weights can be extreme.

**Clipped IPS** bounds the weights:

$$\hat{V}_{\text{clip}}(\pi) = \frac{1}{N}\sum_{t=1}^{N} \min\left(\frac{\pi(A_t | X_t)}{\pi_0(A_t | X_t)}, M\right) r_t$$

with typical clipping threshold M ∈ [5, 50].

## Connection to LLOO+β

The LLOO+β metric from the Recombee lab (evalRS@KDD 2023) can be understood through a causal lens: the popularity penalization ($p(i)^{-\beta}$) acts as an approximate inverse propensity weight. Popular items have high propensity (they would be consumed regardless of the recommendation), so down-weighting them approximates the causal effect of the recommendation system on niche items.

This connection reveals why β ≈ 0.30 is optimal: it approximates the true propensity distribution of the logging policy without needing to estimate individual propensities — a pragmatic shortcut that achieves 34.3% Model Selection Recall.

> **Key references:**
> - Lattimore, T. & Szepesvári, C. (2020). Bandit Algorithms. Cambridge University Press.
> - Li, L. et al. (2011). Unbiased Offline Evaluation of Contextual-Bandit-Based News Article Recommendation. WSDM 2011.
> - Swaminathan, A. & Joachims, T. (2015). Batch Learning from Logged Bandit Feedback. ICML 2015.

**Consider this:** The shift from correlational to causal thinking in bandits mirrors a broader trend in machine learning. As systems become more consequential — influencing what people read, buy, and believe — understanding *why* interventions work, not just *that* they work, becomes essential for responsible deployment.