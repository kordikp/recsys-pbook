---
id: ch4-bias-types
type: spine
title: "A Taxonomy of Bias in Recommender Systems"
readingTime: 5
standalone: false
core: false
voice: thinker
parent: ch4-bubbles
status: accepted
---

The parent section introduced filter bubbles as a visible symptom of algorithmic narrowing. But bubbles are only one manifestation of a deeper, more pervasive problem: **bias**. Recommender systems are bias-generating machines -- not because they are poorly engineered, but because they learn from data that is itself the product of biased processes. Understanding where bias enters, how it propagates, and how to mitigate it is arguably the most important unsolved problem in recommendation research.

This section provides a structured taxonomy. For each bias type: what it is, how to detect it, and what can be done about it.

## 1. Selection Bias

**Definition.** Users choose what to interact with. The data a recommender system observes is not a random sample of user preferences -- it is a self-selected sample. Users who dislike a genre never rate items in that genre. Users who love a niche topic over-represent it in the data. The missing ratings are **Missing Not At Random (MNAR)**: the *reason* a rating is missing is correlated with the *value* the rating would have taken.

**Formal statement.** Let $r_{ui}$ denote the true rating user $u$ would assign to item $i$, and let $o_{ui} \in \{0, 1\}$ indicate whether the rating is observed. Under MNAR:

$$P(o_{ui} = 1 \mid r_{ui}) \neq P(o_{ui} = 1)$$

The probability of observing a rating depends on the rating itself. Users are more likely to rate items they feel strongly about (very positive or very negative), creating a **J-shaped** or **bimodal** distribution of observed ratings that does not reflect true preferences.

**Detection.** Compare the distribution of observed ratings to ratings collected through controlled experiments (e.g., forced-rating surveys where users rate randomly selected items). Schnabel et al. (2016) demonstrated that the gap between these distributions is substantial: on average, observed ratings skew 0.3-0.5 points higher on a 5-star scale than controlled ratings for the same user-item pairs.

**Mitigation.** The primary technique is **Inverse Propensity Scoring (IPS)**, discussed in detail below. Alternatively, imputation-based methods fill in missing ratings using a model and then train on the completed matrix, though this introduces its own biases through the imputation model's assumptions.

## 2. Position Bias

**Definition.** Items displayed in higher positions on a ranked list receive disproportionately more clicks, regardless of their intrinsic quality. A mediocre item in position 1 will typically receive more clicks than an excellent item in position 10. This is not a user preference signal -- it is an artifact of how users scan lists.

**Formal model.** Under the **examination hypothesis** (Richardson, Dominowska, and Ragno, 2007), a click on item $i$ at position $k$ requires two independent events:

$$P(\text{click}_{u,i,k}) = P(\text{examine}_k) \cdot P(\text{relevant}_{u,i})$$

where $P(\text{examine}_k)$ is the probability that the user examines position $k$ (a function of position alone), and $P(\text{relevant}_{u,i})$ is the true relevance of item $i$ to user $u$ (independent of position). Empirically, examination probability drops roughly as:

$$P(\text{examine}_k) \approx \frac{1}{k^\eta}$$

with $\eta \approx 1$ for web search results (Joachims et al., 2017), meaning position 10 receives roughly 10x fewer examinations than position 1.

**Detection.** Run **randomization experiments**: shuffle item positions for a small fraction of traffic and compare click-through rates across positions. If the same item's CTR varies dramatically by position, position bias is present.

**Mitigation.** The standard correction is **Inverse Propensity Weighting (IPW)** applied to position. Given estimated examination probabilities $\hat{P}(\text{examine}_k)$, re-weight each click observation by:

$$w_{u,i,k} = \frac{1}{\hat{P}(\text{examine}_k)}$$

A click in position 10 (low examination probability) receives a high weight; a click in position 1 receives a low weight. This de-biases the training signal so the model learns relevance rather than positional advantage. Google's unbiased learning-to-rank framework (Ai et al., 2018; Joachims et al., 2017) implements this at scale.

## 3. Popularity Bias

**Definition.** Popular items dominate the training signal. A blockbuster movie with 100,000 ratings provides 1,000x more gradient updates than a niche film with 100 ratings. The model becomes very good at predicting preferences for popular items and very poor at recommending long-tail items -- even when those long-tail items would be highly relevant to specific users.

**Formal measure.** One common metric is the **Average Recommendation Popularity (ARP)**:

$$\text{ARP} = \frac{1}{|U|} \sum_{u \in U} \frac{1}{|L_u|} \sum_{i \in L_u} \phi(i)$$

where $L_u$ is the recommendation list for user $u$ and $\phi(i)$ is the popularity of item $i$ (e.g., number of interactions). A system with high ARP relative to the catalog's popularity distribution is exhibiting popularity bias.

Another diagnostic is the **Gini coefficient** of item exposure: if a small fraction of items receives the vast majority of impressions, the Gini coefficient approaches 1.

**Detection.** Segment items into popularity tiers (e.g., head/torso/tail by interaction count). Measure recommendation accuracy (hit rate, nDCG) separately for each tier. If the model performs well on head items but collapses on tail items, popularity bias is present. Abdollahpouri et al. (2019) proposed measuring the calibration gap: do users who historically prefer niche content actually receive niche recommendations?

**Mitigation.**
- **Regularization**: Penalize the model's tendency to assign high scores to popular items. $L_2$ regularization on item embeddings implicitly reduces popularity bias by preventing popular item embeddings from growing disproportionately large.
- **Inverse popularity weighting**: Down-weight training examples from popular items: $w_i \propto \phi(i)^{-\alpha}$ for some $\alpha > 0$.
- **Causal debiasing**: Separate the "popularity effect" from the "relevance effect" using causal inference techniques (Zhang et al., 2021).
- **LLOO+$\beta$ reranking**: Leave-Last-One-Out evaluation combined with a popularity damping parameter $\beta$ that explicitly penalizes recommending items that would have been discovered without algorithmic assistance. This approach, explored in the MFF research context, directly targets the question: *did the recommendation add value beyond what popularity alone would provide?*

## 4. Exposure Bias

**Definition.** Users can only interact with items they have been shown. The absence of an interaction with item $i$ does not mean user $u$ dislikes it -- it may mean user $u$ was never exposed to it. Standard negative sampling (treating unobserved interactions as negatives) conflates "not interested" with "not exposed."

**Formal statement.** Let $\mathcal{E}_u$ denote the set of items user $u$ has been exposed to. Then:

$$P(\text{interact}_{u,i} = 0 \mid i \notin \mathcal{E}_u) = 1$$

regardless of the user's true preference. A model trained on implicit feedback without accounting for exposure will learn:

$$\hat{r}_{ui} \propto P(\text{interact}_{u,i} = 1) = \underbrace{P(\text{exposed}_{u,i})}_{\text{system's past policy}} \cdot \underbrace{P(\text{prefer}_{u,i} \mid \text{exposed})}_{\text{true preference}}$$

The predicted score entangles the system's *past recommendation policy* with *actual user preferences*. Items the old policy never showed will be predicted as irrelevant, creating a self-fulfilling prophecy.

**Detection.** Exposure bias is difficult to detect directly because exposure logs are often unavailable or incomplete. Indirect detection involves comparing recommendations from a model trained on logged data against those from a model trained on data from a random exposure policy (collected through exploration traffic).

**Mitigation.**
- **Exposure-aware training**: If exposure logs are available, train only on truly exposed items as positives and negatives, discarding unexposed items entirely.
- **Exploration**: Dedicate a fraction of traffic (e.g., 5-10%) to showing items selected uniformly at random or via an exploration policy ($\varepsilon$-greedy, Thompson sampling). This generates unbiased feedback data.
- **Propensity-scored learning**: Weight each observation by the inverse of its exposure probability under the logging policy, similar to IPS for selection bias.

## 5. Conformity Bias

**Definition.** Users' ratings are influenced by the ratings of other users. When a platform displays an item's average rating, users' subsequent ratings are pulled toward that displayed average. This is not a reflection of true preference -- it is social conformity.

**Empirical evidence.** Muchnik, Aral, and Taylor (2013) ran a large-scale experiment on a social news site: randomly assigned positive or negative vote treatments to comments. Comments that received an artificial initial upvote accumulated 25% more upvotes over time compared to control. The initial signal created a herding effect that persisted and compounded.

**Formal model.** Let $r_{ui}^{\text{true}}$ be the rating user $u$ would assign without social influence, and $\bar{r}_i$ be the displayed average rating. The observed rating is:

$$r_{ui}^{\text{obs}} = (1 - \gamma) \cdot r_{ui}^{\text{true}} + \gamma \cdot \bar{r}_i$$

where $\gamma \in [0, 1]$ captures the strength of conformity. Krishnan, Srivastava, and Agarwal (2014) estimated $\gamma \approx 0.2$-$0.3$ on movie rating platforms -- meaning roughly a quarter of a user's expressed rating reflects social influence rather than personal taste.

**Detection.** A/B test: show one group of users the item's average rating before they rate; show the other group no rating information. If the distribution of ratings differs significantly between groups, conformity bias is present.

**Mitigation.**
- **Delay display**: Do not show aggregate ratings until after a user submits their own rating.
- **Debiasing models**: Incorporate the displayed rating as a feature and learn to discount its influence (Chen et al., 2020).
- **Bayesian correction**: Use a prior based on early ratings (before enough ratings are displayed to trigger conformity) and progressively shrink toward that prior.

## 6. Algorithmic Amplification

**Definition.** The recommender system amplifies its own biases through feedback loops. Unlike the biases above, which originate from user behavior or data collection, algorithmic amplification is endogenous: the system's output becomes its future input.

**The feedback loop.**

$$\text{Biased data} \xrightarrow{\text{train}} \text{Biased model} \xrightarrow{\text{serve}} \text{Biased recommendations} \xrightarrow{\text{collect}} \text{More biased data}$$

Each cycle of this loop concentrates the bias further. Suppose the model slightly over-recommends item $A$ relative to its true relevance. Item $A$ receives more exposure, generating more interaction data. The model retrains on this data, where item $A$ now appears even more popular. The over-recommendation intensifies. Over multiple training cycles, a small initial bias can compound into a large distortion.

**Formal analysis.** Chaney, Stewart, and Engelhardt (2018) modeled this as a dynamical system and proved that homogeneous recommendations (all users seeing similar items) are a **stable fixed point** of the feedback loop, while diverse recommendations are **unstable**. In other words, the loop does not just amplify bias -- it drives the system toward a specific kind of bias: homogeneity.

Mansoury et al. (2020) quantified the effect empirically: after simulating multiple rounds of recommendation and retraining, the Gini coefficient of item exposure increased by 15-30% relative to the initial model, and long-tail items lost 40-60% of their already-small share of impressions.

**Detection.** Track bias metrics (ARP, Gini coefficient, coverage) across retraining cycles. If they deteriorate monotonically, the feedback loop is active.

**Mitigation.**
- **Periodic injection of exploration data** to break the loop
- **Counterfactual training**: Train the model not on what happened, but on what *would have* happened under an unbiased policy
- **Regularization toward a prior**: Constrain each retrained model to stay close to a "reference" model trained on unbiased data, preventing runaway drift

## The Feedback Loop Problem

The six bias types above are not independent -- they interact and reinforce each other through feedback loops. This is the central difficulty.

Consider the full cycle:

1. **Selection bias** ensures that observed data over-represents strong preferences
2. A model trained on this data exhibits **popularity bias** (popular items have more observations) and **exposure bias** (items the previous model never showed have no data)
3. The model's ranked output introduces **position bias** (top-ranked items get more clicks)
4. Displayed ratings create **conformity bias** (users anchor to the shown average)
5. All of this feeds back as training data for the next model iteration, creating **algorithmic amplification**
6. The cycle repeats with compounding distortions

Breaking this cycle requires intervening at multiple points simultaneously. No single debiasing technique is sufficient because correcting one bias source while ignoring others can actually *worsen* the overall problem. For example, correcting position bias alone (so the model learns true relevance) may amplify popularity bias (because truly popular items *are* more relevant on average, and removing the positional noise makes this signal cleaner -- further concentrating exposure on popular items).

## Counterfactual Evaluation

A fundamental question in bias correction is: **what would have happened if we had used a different recommendation policy?** This is a causal, counterfactual question, and answering it from observational data is the core challenge of **off-policy evaluation**.

**The problem.** We have logged data collected under a *logging policy* $\pi_0$ (the production recommender). We want to evaluate a new *target policy* $\pi_1$ without deploying it. But $\pi_0$ and $\pi_1$ show different items, so the logged data is biased toward $\pi_0$'s choices.

**Inverse Propensity Scoring (IPS).** The standard correction, formalized by Schnabel et al. (2016) for recommender systems, adapts the Horvitz-Thompson estimator from survey sampling:

$$\hat{V}_{\text{IPS}}(\pi_1) = \frac{1}{|U|} \sum_{u \in U} \sum_{i \in \mathcal{O}_u} \frac{\pi_1(i \mid u)}{\pi_0(i \mid u)} \cdot r_{ui}$$

where $\mathcal{O}_u$ is the set of items observed for user $u$, $\pi_0(i \mid u)$ is the probability that the logging policy showed item $i$ to user $u$ (the **propensity score**), and $\pi_1(i \mid u)$ is the probability under the target policy.

**Intuition.** Items that $\pi_0$ showed frequently (high $\pi_0(i \mid u)$) are down-weighted because they are over-represented in the data. Items that $\pi_0$ rarely showed (low $\pi_0(i \mid u)$) are up-weighted because they are under-represented. The reweighting produces an unbiased estimate of $\pi_1$'s performance, assuming $\pi_0(i \mid u) > 0$ whenever $\pi_1(i \mid u) > 0$ (the **overlap assumption**).

**The variance problem.** IPS is unbiased but can have extremely high variance. When $\pi_0(i \mid u)$ is very small (the logging policy rarely showed item $i$), the weight $1 / \pi_0(i \mid u)$ becomes enormous, and a single observation can dominate the entire estimate.

**Clipped IPS (CIPS).** Cap the importance weights at a maximum value $M$:

$$w_{ui}^{\text{clipped}} = \min\left(\frac{\pi_1(i \mid u)}{\pi_0(i \mid u)},\; M\right)$$

This introduces a small bias but dramatically reduces variance. In practice, clipping values of $M \in [5, 50]$ work well.

**Self-Normalized IPS (SNIPS).** Normalize the weights to sum to 1:

$$\hat{V}_{\text{SNIPS}}(\pi_1) = \frac{\sum_{u, i \in \mathcal{O}} w_{ui} \cdot r_{ui}}{\sum_{u, i \in \mathcal{O}} w_{ui}}$$

SNIPS is a consistent estimator with lower variance than IPS, at the cost of a small bias (Swaminathan and Joachims, 2015).

**Doubly Robust (DR) estimation.** Combines a direct estimate $\hat{r}_{ui}$ (from a model) with IPS correction for the model's errors:

$$\hat{V}_{\text{DR}}(\pi_1) = \frac{1}{|U|} \sum_u \left[\sum_i \pi_1(i \mid u) \cdot \hat{r}_{ui} + \sum_{i \in \mathcal{O}_u} \frac{\pi_1(i \mid u)}{\pi_0(i \mid u)} (r_{ui} - \hat{r}_{ui})\right]$$

The DR estimator is unbiased if *either* the propensity model *or* the reward model is correct (hence "doubly robust"). It typically achieves the best bias-variance trade-off among these estimators (Wang, Agarwal, and Dudik, 2017).

## Practical Guidelines for Bias Auditing in Production

Bias auditing should be a continuous practice, not a one-time check. The following framework is adapted from industry best practices and the research of Chen et al. (2020):

**1. Measure before you mitigate.** Quantify each bias type with dedicated metrics:

| Bias Type | Diagnostic Metric | Method |
|---|---|---|
| Selection | Rating distribution skew | Compare logged vs. controlled ratings |
| Position | CTR by position | Randomization experiments |
| Popularity | ARP, Gini coefficient, coverage | Compute on recommendation logs |
| Exposure | Overlap between recommended and catalog | Track catalog coverage over time |
| Conformity | Rating variance conditioned on displayed avg. | A/B test with/without displayed ratings |
| Amplification | Bias metric drift across retraining cycles | Track Gini, ARP, coverage longitudinally |

**2. Establish baselines.** Compare your system's bias metrics against a random recommendation policy and against a popularity-only baseline. If your sophisticated model is *more* biased than the popularity baseline, something is wrong.

**3. Segment your analysis.** Aggregate metrics hide disparate impacts. Break down bias metrics by:
- User activity level (power users vs. casual users)
- Item popularity tier (head/torso/tail)
- Demographic groups (if available and legally permissible)
- Content category

**4. Monitor longitudinally.** Bias metrics should be tracked on dashboards alongside accuracy metrics (nDCG, hit rate). If accuracy improves but bias worsens, the accuracy gains may be illusory -- the model is getting better at predicting biased data, not at capturing true preferences.

**5. Use counterfactual evaluation before deploying.** Before shipping a debiased model to production, estimate its performance using IPS or DR estimation on logged data. This catches problems before they affect users and provides a principled alternative to naive train/test splits that reproduce the biases of the logging policy.

**6. Close the loop with online experiments.** Counterfactual evaluation is an estimate. Validate it with A/B tests. Compare the debiased model against the production model on both accuracy metrics *and* bias metrics. A model that is slightly less accurate but substantially less biased may be the better choice for long-term health of the system.

> **Key references:**
> - Schnabel, T., Swaminathan, A., Singh, A., Chandak, N., & Joachims, T. (2016). [Recommendations as Treatments: Debiasing Learning and Evaluation](https://proceedings.mlr.press/v48/schnabel16.html). *ICML 2016*.
> - Chen, J., Dong, H., Wang, X., Feng, F., Wang, M., & He, X. (2020). [Bias and Debias in Recommender System: A Survey and Future Directions](https://arxiv.org/abs/2010.03240). *arXiv:2010.03240*.
> - Joachims, T., Swaminathan, A., & Schnabel, T. (2017). [Unbiased Learning-to-Rank with Biased Feedback](https://doi.org/10.1145/3018661.3018699). *WSDM 2017*.
> - Chaney, A. J. B., Stewart, B. M., & Engelhardt, B. E. (2018). [How Algorithmic Confounding in Recommendation Systems Increases Homogeneity and Decreases Utility](https://doi.org/10.1145/3240323.3240370). *RecSys 2018*.
> - Swaminathan, A. & Joachims, T. (2015). [The Self-Normalized Estimator for Counterfactual Learning](https://proceedings.neurips.cc/paper/2015/hash/39027f33e6c862f3af3a1eb51a1a3165-Abstract.html). *NeurIPS 2015*.
> - Muchnik, L., Aral, S., & Taylor, S. J. (2013). [Social Influence Bias: A Randomized Experiment](https://doi.org/10.1126/science.1240466). *Science*, 341(6146).
> - Abdollahpouri, H., Mansoury, M., Burke, R., & Mobasher, B. (2019). The Unfairness of Popularity Bias in Recommendation. *RecSys Workshop on Recommendation in Multistakeholder Environments*.
> - LLOO+$\beta$ framework: Evaluating recommendation quality with leave-last-one-out protocol and popularity damping to measure genuine algorithmic value-add. For more on this and related Recombee research, see the [full publications list](https://www.recombee.com/research-publications).
