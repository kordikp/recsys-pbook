---
id: ch4-counterfactual
type: spine
title: "Counterfactual Reasoning: What Would Have Happened?"
readingTime: 4
standalone: false
core: false
teaser: "Standard evaluation asks 'did users engage?' Counterfactual reasoning asks the harder question: 'would they have engaged anyway?'"
voice: thinker
parent: ch4-testing
diagram: null
recallQ: "What is counterfactual evaluation and why does it matter for recommender systems?"
recallA: "Counterfactual evaluation estimates what would have happened under a different recommendation policy, using logged data from the current policy. It separates the algorithm's causal contribution from confounding factors like item popularity."
publishedAt: "2026-04-03"
status: accepted
---

Standard recommendation evaluation asks: **"Did users interact with what we recommended?"** This is a correlational question. The answer conflates the algorithm's contribution with pre-existing user intent, item popularity, and position effects.

Counterfactual reasoning asks the harder question: **"Would users have interacted with these items even without our recommendation?"** This is a causal question — and answering it requires fundamentally different methods.

![Counterfactual: what happened vs what would have happened](/images/anim-counterfactual.svg)

## Why Correlation Isn't Enough

Consider this scenario: you recommend a blockbuster movie to 1,000 users. 500 of them watch it. Great performance?

Not necessarily. The movie was already trending — 400 of those users would have found it anyway through search, social media, or browsing. Your recommendation only caused 100 additional views. The **causal impact** is 100, not 500.

Now consider recommending a niche documentary. Only 50 users watch it. Worse performance?

Not necessarily. Zero of those users would have found it without your recommendation. The causal impact is 50 — half the absolute number, but a much higher **causal uplift** per recommendation.

A system optimizing for correlational metrics would recommend the blockbuster. A system optimizing for causal impact would recommend the documentary. Which is actually more valuable to users?

## The Potential Outcomes Framework

Formally, for each user-item pair (u, i):

- $Y_i(1)$: outcome if item i is recommended (treatment)
- $Y_i(0)$: outcome if item i is not recommended (control)
- **Causal effect:** $\tau_i = Y_i(1) - Y_i(0)$

The fundamental problem: we observe either $Y_i(1)$ or $Y_i(0)$, never both. The unobserved outcome is the **counterfactual**.

## Inverse Propensity Scoring (IPS)

If we know the probability (propensity) that the old system would recommend each item, we can correct for the selection bias:

$$\hat{V}_{\text{IPS}}(\pi) = \frac{1}{N}\sum_{t=1}^{N} \frac{\pi(a_t | c_t)}{\pi_0(a_t | c_t)} \cdot r_t$$

where $\pi_0$ is the logging policy (old system) and $\pi$ is the new policy.

**Intuition:** If the old system rarely showed item A (low propensity), but users engaged when it was shown, the IPS upweights this observation — it's more informative precisely because it's rare.

**Problem:** When the new policy $\pi$ and old policy $\pi_0$ diverge significantly, the importance weights $\pi/\pi_0$ become very large, causing high variance. This is known as the **support problem** — you can't evaluate a policy on actions the logging policy never took.

## Doubly Robust Estimation

Combines a direct prediction model with IPS to reduce variance:

$$\hat{V}_{\text{DR}} = \frac{1}{N}\sum_{t=1}^{N} \left[\hat{r}(c_t, a_t) + \frac{\pi(a_t | c_t)}{\pi_0(a_t | c_t)}(r_t - \hat{r}(c_t, a_t))\right]$$

where $\hat{r}$ is a reward prediction model. This estimator is consistent if *either* the propensity model or the reward model is correct — hence "doubly robust."

## Practical Applications

**1. Policy evaluation without deployment.** Before deploying a new recommendation algorithm, estimate its performance from logged data. This avoids the risk of an A/B test with a potentially bad algorithm.

**2. Uplift modeling.** Identify which users benefit most from recommendations vs. those who would find content anyway. Focus recommendation effort where the causal impact is highest.

**3. Attribution.** Separate the recommendation system's contribution from organic discovery, marketing campaigns, and social sharing. Critical for justifying investment in RecSys.

## Limitations

- **Propensity estimation is hard.** The logging policy is often implicit (not a clean probability distribution), making propensity scores unreliable.
- **Support problem.** You can't evaluate recommendations for items the old system never showed.
- **Stationarity assumption.** Counterfactual methods assume user behavior is consistent across time — but preferences drift.

## Connection to the LLOO+β Approach

The LLOO+β metric from the Recombee lab can be viewed as a lightweight counterfactual correction: by down-weighting popular items (which users would likely find anyway), it approximates the causal uplift of the recommendation system on niche items — without requiring explicit propensity estimation.

> **Key references:**
> - Rubin, D. B. (1974). [Estimating Causal Effects of Treatments in Randomized and Nonrandomized Studies](https://doi.org/10.1037/h0037350). *Journal of Educational Psychology*, 66(5).
> - Schnabel, T. et al. (2016). [Recommendations as Treatments: Debiasing Learning and Evaluation](https://proceedings.mlr.press/v48/schnabel16.html). *ICML 2016*.
> - Dudik, M., Langford, J., & Li, L. (2011). [Doubly Robust Policy Evaluation and Learning](https://proceedings.mlr.press/v15/dudik11a.html). *ICML 2011*.

**Consider this:** Counterfactual reasoning forces a humbling question: how much of our recommendation system's "success" is actually causal, and how much is just correlation with what users would have done anyway? Answering honestly might reveal that some of our most "successful" recommendations add less value than we think.