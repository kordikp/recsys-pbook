---
id: ch4-online-offline
type: spine
title: "Online vs. Offline Evaluation: Bridging the Gap"
readingTime: 4
standalone: false
core: false
voice: thinker
parent: ch4-testing
publishedAt: "2026-04-03"
status: accepted
---

The parent section established that A/B testing is the gold standard for evaluating recommender systems. But A/B tests are expensive, slow, and risky. You cannot A/B test every idea -- you would need millions of users and months of experimentation time. This creates a fundamental tension: **offline evaluation is cheap but biased; online evaluation is trustworthy but scarce.** The field's central evaluation challenge is bridging this gap.

## Offline Evaluation: Fast, Cheap, and Wrong

Offline evaluation uses historical interaction data -- logs of what users clicked, watched, rated, or purchased under a previous recommendation policy. You hold out some interactions, train your model on the rest, and measure how well the model predicts the held-out data.

**Advantages:**

- **Speed.** Evaluate hundreds of model variants in hours, not weeks.
- **Cost.** No infrastructure, no user exposure, no risk of degrading the product.
- **Reproducibility.** The same dataset yields the same results. Different researchers can compare methods on identical benchmarks.
- **Scale of comparison.** You can evaluate model architectures, hyperparameters, feature sets, and ranking functions in a combinatorial sweep that would be impossible online.

**Disadvantages:**

- **MNAR bias.** The held-out data reflects items the *old* system chose to show, not items the new model would recommend. Items the old system never surfaced have zero interactions -- not because users dislike them, but because they were never exposed. This is Missing Not At Random (MNAR), and it systematically favors conservative models that mimic the logging policy.
- **No user feedback on novel recommendations.** Offline data cannot tell you how users would react to items they have never seen. The most interesting recommendations -- genuinely novel, serendipitous suggestions -- are precisely the ones offline evaluation cannot assess.
- **Static data.** Real users change their preferences, react to recommendations, and exhibit session-level dynamics. Offline datasets freeze a single snapshot of behavior, ignoring temporal evolution and feedback effects.
- **Proxy metric mismatch.** Offline metrics (nDCG, recall, precision) measure ranking quality against observed interactions. But the business cares about engagement, retention, revenue, and satisfaction -- quantities that depend on the full user experience, not just ranking accuracy.

## Online Evaluation (A/B Testing): Trustworthy but Expensive

Online evaluation deploys candidate models to real users and measures behavioral outcomes under controlled experimental conditions. As described in the parent section, users are randomly assigned to treatment groups, and statistical tests determine whether observed differences are significant.

**Advantages:**

- **Causal evidence.** Random assignment isolates the effect of the recommendation algorithm from confounding factors. This is the only evaluation method that provides genuine causal claims.
- **Real user behavior.** Users react to actual recommendations in their natural context -- including reactions to novelty, diversity, and items the old system never showed.
- **Full-stack measurement.** Online experiments capture effects that offline evaluation misses entirely: latency impact on engagement, UI interactions with recommendation slates, cross-session effects, and long-term retention.
- **Accounts for feedback loops.** The model's recommendations influence user behavior, which generates new data, which feeds future recommendations. Online experiments observe this full loop; offline evaluation sees only a single static snapshot.

**Disadvantages:**

- **Slow.** A typical A/B test runs for 1-4 weeks to achieve adequate statistical power. Testing 50 model variants sequentially would take 1-4 years.
- **Expensive.** Each experiment requires engineering effort to deploy, monitor, and analyze. Infrastructure must support concurrent model serving.
- **Risky.** A bad model variant degrades the experience for real users. For high-stakes domains (e-commerce, news), a poorly performing treatment group translates directly into lost revenue or user trust.
- **Requires traffic.** Small platforms or niche products may not have enough users to detect meaningful effect sizes. A platform with 10,000 daily active users cannot reliably detect a 1% improvement in click-through rate.

## The Correlation Problem

The most troubling finding in evaluation research: **offline metrics often correlate poorly with online outcomes.**

A model that achieves the highest offline nDCG may not produce the best online engagement. Conversely, models that look mediocre offline sometimes win online experiments decisively.

Why does this happen? Several factors compound:

1. **MNAR bias** inflates offline scores for models similar to the logging policy.
2. **Popularity dominance** means offline metrics are driven primarily by correct predictions on popular items -- items users would have found anyway.
3. **Missing coverage of novel items** means offline metrics cannot reward the most valuable aspect of a good recommender: surfacing items users did not know they wanted.
4. **Metric definition mismatch** between offline (ranking accuracy) and online (behavioral outcomes like session length, return rate, satisfaction).

Empirical studies have documented this gap repeatedly. The LLOO+$\beta$ research (discussed below) found that without correction, the offline winner matches the online winner only 12.9% of the time -- barely better than random selection among top candidate models.

## Interleaving: A More Sensitive Alternative

**Interleaving** offers a middle ground between offline evaluation and full A/B testing. Instead of assigning users to separate groups (each seeing results from only one model), interleaving presents each user with a single result list that merges outputs from two models.

**How it works (Team Draft Interleaving):**

Given two ranking models $A$ and $B$, construct a combined list by alternating selections:

1. Flip a fair coin. The winner picks first.
2. Model $A$ selects its highest-ranked item not yet in the combined list. Model $B$ selects its highest-ranked item not yet in the combined list.
3. Repeat until the combined list is full.
4. Track which model "contributed" each item. When a user clicks or engages with an item, credit goes to the contributing model.

The model whose contributed items receive more engagement wins.

**Why interleaving is powerful:**

- **Sensitivity.** Interleaving detects differences with an order of magnitude fewer observations than A/B testing. Chapelle et al. (2012) showed that interleaving experiments at a major search engine required approximately 100x fewer queries than A/B tests to detect the same effect size. The reason: each user serves as their own control, eliminating between-user variance.
- **Speed.** Higher sensitivity means shorter experiments. What takes 2 weeks in an A/B test might take 2 days with interleaving.
- **Lower risk.** Every user sees a mix of both models, so no user group receives a purely inferior experience.

**Limitations:**

- Interleaving answers "which model is better?" but not "by how much?" It provides ordinal comparisons, not absolute metric estimates.
- It is most natural for ranked list interfaces (search, recommendations) and harder to apply to non-list experiences.
- The interleaved list itself is neither model's output, so presentation effects (e.g., position bias interactions) can introduce subtle confounds.

## Counterfactual Evaluation: Offline Estimation of Online Effects

Counterfactual (off-policy) evaluation attempts to answer the question "how would a new policy perform?" using only logged data from the current policy. The core technique is **Inverse Propensity Scoring (IPS)**.

Given logged data collected under policy $\pi_0$, estimate the value of a new policy $\pi_1$:

$$\hat{V}_{\text{IPS}}(\pi_1) = \frac{1}{N} \sum_{t=1}^{N} \frac{\pi_1(a_t \mid c_t)}{\pi_0(a_t \mid c_t)} \cdot r_t$$

where $a_t$ is the action taken in context $c_t$, and $r_t$ is the observed reward. The ratio $\pi_1 / \pi_0$ corrects for the distributional mismatch between the two policies.

**The practical challenge:** propensity scores $\pi_0(a \mid c)$ are often unknown, difficult to estimate, or extremely small (leading to high-variance estimates). This limits IPS-based methods to settings where the logging policy is well-characterized and has sufficient overlap with the target policy.

**Doubly robust** estimators improve on IPS by combining it with a direct model estimate, achieving unbiasedness if *either* the propensity model *or* the reward model is correct:

$$\hat{V}_{\text{DR}}(\pi_1) = \hat{V}_{\text{DM}} + \frac{1}{N} \sum_{t=1}^{N} \frac{\pi_1(a_t \mid c_t)}{\pi_0(a_t \mid c_t)} \bigl(r_t - \hat{r}(c_t, a_t)\bigr)$$

Counterfactual evaluation is an active research area. It is theoretically elegant but practically fragile -- small errors in propensity estimation can compound into large errors in policy value estimates.

## The Evaluation Funnel

Mature recommendation teams organize their evaluation process as a **funnel** -- a sequence of increasingly expensive but increasingly trustworthy stages:

**Stage 1: Offline evaluation.** Screen hundreds of candidates using offline metrics (nDCG, recall, LLOO+$\beta$). Discard clearly inferior models. Cost: compute time only. Turnaround: hours.

**Stage 2: Counterfactual evaluation.** For the top 10-20 candidates surviving Stage 1, apply IPS or doubly robust estimators to get better-calibrated performance estimates from logged data. Discard models with poor counterfactual estimates. Cost: moderate (requires propensity estimation infrastructure). Turnaround: hours to days.

**Stage 3: Interleaving.** For the top 3-5 candidates surviving Stage 2, run interleaving experiments against the production model. Identify which candidates outperform the baseline with high confidence. Cost: low user exposure, short duration. Turnaround: days.

**Stage 4: A/B testing.** For the 1-2 winners from Stage 3, run a full A/B test to quantify the magnitude of improvement on primary business metrics. Cost: significant user exposure, long duration. Turnaround: 1-4 weeks.

**Stage 5: Full deployment.** Gradual rollout with monitoring. Ramp from 5% to 25% to 50% to 100% while watching guardrail metrics.

Each stage filters out candidates at low cost, reserving the most expensive evaluation (A/B testing with full traffic) for only the most promising models. This funnel can compress what would otherwise take years of sequential A/B testing into a manageable process.

## Multi-Metric Evaluation: Guardrails and Success Metrics

Production A/B tests rarely optimize a single metric. Instead, teams define two categories:

**Success metrics** -- the metrics the change is intended to improve. For a new recommendation algorithm, this might be click-through rate, content completion rate, or 7-day retention. The experiment succeeds if these metrics show a statistically significant improvement.

**Guardrail metrics** -- metrics that should *not* decrease. These represent constraints: revenue per user, app crash rate, latency p99, customer support ticket volume, or content diversity. A model that improves CTR by 3% but increases latency p99 by 200ms is not shippable.

The decision rule is:

$$\text{Ship if: } \forall\, g \in \text{guardrails},\; \Delta g \geq -\epsilon_g \quad \textbf{and} \quad \exists\, s \in \text{success},\; \Delta s > 0 \text{ (significant)}$$

where $\epsilon_g$ is the acceptable tolerance for guardrail metric $g$ (often zero, but sometimes a small acceptable degradation is defined).

This framework prevents the common failure mode of optimizing one metric at the expense of everything else -- the Goodhart's Law problem discussed in the multi-objective optimization section.

## Novelty Effects and Temporal Confounds

A/B test results can be misleading due to temporal effects that masquerade as genuine improvements:

**Novelty effect.** Users may initially engage more with *any* change simply because it is new. A fresh recommendation layout, a different ranking order, or even a new visual design can produce a temporary engagement spike that decays over weeks. If the A/B test is too short, it captures the novelty effect and declares a false positive.

**Primacy effect.** Conversely, users may initially engage *less* with a change because it disrupts their established habits. Power users who have learned the old system's behavior may resist the new one. If the A/B test is too short in this case, it captures the primacy effect and declares a false negative.

**Detecting temporal confounds.** Plot the treatment effect over time. A genuine improvement produces a stable (or growing) effect. A novelty effect produces a decaying curve. A primacy effect produces an initially negative effect that stabilizes or reverses. The standard practice is to exclude the first 1-2 days of data ("burn-in period") and to verify that the effect is stable in the second half of the experiment compared to the first.

## Statistical Considerations

Rigorous experimentation requires attending to several statistical details:

**Power analysis.** Before running an experiment, calculate the minimum sample size needed to detect a given effect size with adequate power:

$$n \geq \frac{(z_{1-\alpha/2} + z_{1-\beta})^2 \cdot 2\sigma^2}{\delta^2}$$

where $\alpha$ is the significance level (typically 0.05), $1 - \beta$ is the desired power (typically 0.80), $\sigma^2$ is the variance of the metric, and $\delta$ is the minimum detectable effect (MDE). Running an underpowered experiment wastes time -- it is unlikely to detect a real effect even if one exists.

**Minimum detectable effect (MDE).** The smallest effect size an experiment can reliably detect given its sample size and duration. Platforms with millions of daily users can detect very small effects ($\delta \approx 0.1\%$); smaller platforms may only detect large effects ($\delta \approx 5\%$). The MDE determines which improvements are "visible" to experimentation -- real but small improvements may be undetectable.

**Multiple testing correction.** When measuring $m$ metrics simultaneously, the probability of at least one false positive is $1 - (1 - \alpha)^m$. With 20 metrics at $\alpha = 0.05$, there is a 64% chance of at least one spurious significant result. Standard corrections include:

- **Bonferroni**: Use significance threshold $\alpha / m$ for each test. Conservative but simple.
- **Benjamini-Hochberg**: Controls the false discovery rate (FDR) rather than the family-wise error rate. Less conservative, more appropriate when many metrics are correlated.
- **Pre-registration**: Designate a single primary metric before the experiment begins. Secondary metrics are treated as exploratory and do not drive the ship/no-ship decision.

## The LLOO+$\beta$ Approach: A Practical Bridge

The evaluation funnel above assumes you have infrastructure for counterfactual estimation and interleaving. Many teams do not. The **LLOO+$\beta$ approach**, developed in the Recombee research lab (Kasalicky, Alves & Kordik, evalRS@KDD 2023), offers a pragmatic alternative that improves offline evaluation without requiring propensity scores, additional infrastructure, or online traffic.

The method has two components:

**Leave-Last-One-Out (LLOO).** For each user $u$ with temporally ordered interactions $(i_1, i_2, \ldots, i_T)$, train on the first $T - 1$ interactions and evaluate on the last interaction $i_T$. This respects the temporal structure of real deployment -- you are always predicting the future from the past, never the reverse.

**Popularity penalization ($\beta$).** Weight the recall metric to down-weight correct predictions on popular items:

$$\text{recall@K}_{\text{LLOO}}^{\beta} = \frac{1}{|U|} \sum_{u \in U} \frac{\mathbb{1}[i_u \in \text{Top-K}_u] \cdot p(i_u)^{-\beta}}{Z_\beta}$$

where $p(i)$ is the item's popularity fraction and $Z_\beta$ is a normalization constant. When $\beta = 0$, this reduces to standard recall. As $\beta$ increases, correctly predicting a popular item (high $p(i)$, thus small $p(i)^{-\beta}$ contribution) counts for less, while correctly predicting a niche item counts for more.

**Model Selection Recall (MSR).** The key insight is that $\beta$ can be *tuned* by measuring how well the offline metric identifies the online winner:

$$\text{MSR}(\beta) = \frac{1}{|\mathcal{M}|} \sum_{m \in \mathcal{M}} \mathbb{1}[\text{offline-best}(\beta) = \text{online-best}]$$

Empirical results show that $\beta \approx 0.30$ maximizes MSR, improving offline-online agreement from 12.9% ($\beta = 0$) to 34.3%. The curve is non-monotonic: over-penalization ($\beta \to 1$) degrades MSR by ignoring legitimately popular items.

This approach is particularly valuable because it requires no infrastructure beyond what is already needed for offline evaluation. It works with standard ranking metrics, standard training procedures, and standard datasets. The only addition is a single hyperparameter $\beta$ that can be calibrated once against historical A/B test results and reused across future model selection decisions.

## RepSys: Interactive Evaluation for Practitioners

For teams seeking to build intuition about evaluation trade-offs before committing to expensive online experiments, the **[RepSys](https://github.com/cowjen01/repsys)** open-source framework provides an interactive environment for exploring recommender system behavior. RepSys allows practitioners to visualize how different models rank items, compare recommendation lists across user segments, and inspect the interplay between accuracy, diversity, novelty, and fairness metrics -- all within an [interactive interface](https://www.recombee.com/blog/repsys-opensource-library-for-interactive-evaluation-of-recommendation-systems).

Tools like RepSys complement the evaluation funnel by providing qualitative insight alongside quantitative metrics. A model might achieve strong nDCG but produce visually monotonous recommendation lists that an experienced practitioner would immediately flag. Interactive exploration surfaces these patterns before they reach users.

## Bringing It Together

The offline-online gap is not a problem to be solved once and forgotten. It is a structural feature of recommendation evaluation that requires ongoing attention. The evaluation funnel -- offline screening, counterfactual estimation, interleaving, A/B testing, gradual rollout -- provides the architecture. The LLOO+$\beta$ correction improves the weakest link (offline evaluation) without requiring heavy infrastructure investment. And multi-metric evaluation with guardrails ensures that improvements on one dimension do not come at the expense of others.

The ultimate test of any recommendation system is whether real users, over sustained periods, find genuine value in its suggestions. Every other evaluation method is an approximation of that test -- some better than others, but none a substitute.

> **Key references:**
> - Chapelle, O., Joachims, T., Radlinski, F., & Yue, Y. (2012). [Large-scale Validation and Analysis of Interleaved Search Evaluation](https://doi.org/10.1145/2094072.2094078). *TOIS*, 30(1).
> - Gilotte, A., Calauzenes, C., Nedelec, T., Abraham, A., & Dolle, S. (2018). [Offline A/B Testing for Recommender Systems](https://doi.org/10.1145/3159652.3159687). *WSDM 2018*.
> - Kasalicky, F., Alves, R., & Kordik, P. (2023). [Bridging Offline-Online Evaluation with a Rejection Sampling Estimator](https://ceur-ws.org/Vol-3450/). *evalRS@KDD 2023*. See also the [Recombee publications list](https://www.recombee.com/research-publications).
> - Schnabel, T., Swaminathan, A., Singh, A., Chandak, N., & Joachims, T. (2016). [Recommendations as Treatments: Debiasing Learning and Evaluation](https://proceedings.mlr.press/v48/schnabel16.html). *ICML 2016*.
> - Kohavi, R., Tang, D., & Xu, Y. (2020). *Trustworthy Online Controlled Experiments: A Practical Guide to A/B Testing*. Cambridge University Press.
