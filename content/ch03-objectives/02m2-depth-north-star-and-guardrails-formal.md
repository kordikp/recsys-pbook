---
id: north-star-and-guardrails-formal
type: spine
title: "North Star and Guardrails, Formally"
readingTime: 5
standalone: true
core: false
teaser: "The launch rule as one superiority test plus a set of non-inferiority tests, what each extra guardrail costs in power, and how to check that a fast proxy points the same way as the slow north star."
parent: north-star-and-guardrails
recallQ: "Why do guardrails need no multiple-testing correction of the false-positive rate, yet still make experiments bigger?"
recallA: "A change ships only if every test passes at once (north star superior, every guardrail non-inferior within its margin), so there are no multiple chances to ship by luck and the significance level needs no adjustment for guardrails. But the probability that all tests pass together falls with each added guardrail, so each test must be powered more strictly, which takes more users or a longer test."
status: draft
concept: north-star-and-guardrails
state: edited
lens: generic
lang: en
visuality: text-first
depth: technical..research
formalism: full
lengthBand: deep
genre: explainer
carriers: prose|formula
---

Before an experiment, the team commits to one **north-star metric** $n$, the quantity it tries to improve because it tracks long-term value, and a set $G$ of **guardrail metrics** that must not deteriorate. Kohavi et al. (2012) call the agreed primary criterion the **Overall Evaluation Criterion (OEC)** and argue that customer lifetime value should guide its choice. Guardrails exist because a change can raise $n$ through a side effect nobody priced in.

## The launch rule as hypothesis tests

Let $\Delta_m = (\bar m_T - \bar m_C)/\bar m_C$ be the relative treatment effect on metric $m$ in a randomized [A/B test](#c/ab-testing). For each guardrail, fix a **non-inferiority margin** $\mu_g > 0$: the largest relative drop the business accepts. The rule is an intersection of one-sided tests:

$$H_0^{(n)}:\ \Delta_n \le 0 \qquad\qquad H_0^{(g)}:\ \Delta_g \le -\mu_g \quad \text{for every } g \in G$$

Ship if and only if **all** $|G|+1$ null hypotheses are rejected. Equivalently, the lower confidence bound of $\Delta_n$ lies above $0$ and that of every $\Delta_g$ lies above $-\mu_g$ (flip the sign for lower-is-better metrics such as latency or return rate). Spotify's experimentation platform uses this structure and adds two families: **deterioration** tests, where significant harm on a monitored metric blocks the launch, and **quality** checks such as sample ratio mismatch (Schultzberg et al., 2024).

The asymmetry matters. A guardrail passes on *evidence of no material harm*, not on absence of evidence of harm. A flat but noisy guardrail whose interval reaches below $-\mu_g$ does not pass.

## What each guardrail costs

Shipping requires every null to fall, so there are no multiple chances across guardrails, and the level $\alpha$ needs no multiplicity correction for them. A correction is needed only across several *success* metrics, because any one of them can trigger a launch (Schultzberg et al., 2024). Power runs the other way. With $G$ independent guardrails each powered at 80 %, the probability that all pass under a true improvement is $0.8^{G}$: about 33 % for $G = 5$ and 11 % for $G = 10$. Their Proposition 3.1 restores decision-level power of at least $1-\beta$ by designing every test for power

$$1 - \frac{\beta}{G+1}.$$

Each added guardrail therefore costs users or days. A guardrail list is a sample-size budget, not a wish list.

## Is the north star pointing the right way?

Deng & Shi (2016) name two mandatory qualities of a goal metric. **Directionality**: it moves one way when user experience improves and the other way when it degrades. **Sensitivity**: it moves detectably within a test. Bing's search metrics illustrate both. Distinct queries per user fails directionality: an experiment that accidentally degraded results raised it by more than 10 % (Kohavi et al., 2012). Sessions per user points the right way but moves slowly; Deng & Shi prefer metrics built on *successful* sessions, which react faster when relevance changes. To check direction on purpose they recommend **degradation experiments**: worsen the product in a controlled way and confirm the candidate metric moves in the bad direction.

Sensitivity is why proxies exist. Netflix reported that, at a 50 % retention rate, detecting a 0.1-percentage-point retention difference takes roughly 2 million members per cell, so its tests also read engagement, which it found strongly correlated with retention (Gomez-Uribe & Hunt, 2015). It describes a ladder of wins: local engagement (the changed part of the product is used more), overall engagement, then retention. Many local wins never climb the ladder, because they only cannibalize viewing from elsewhere in the product. A proxy measured too close to the change is the cheapest way to fool yourself.

When the north star itself is slow, such as visits months later, predict it from many fast signals. Athey et al. formalize a **surrogate index** that combines many intermediate outcomes and links them to the long-term outcome through a separate observational dataset. Wang et al. (2022) selected short-term behaviors that predict users' increased visiting five months later and used them as rewards in a reinforcement-learning recommender. McDonald et al. (2023) update a Bayesian estimate of a podcast's two-month engagement as partial outcomes arrive.

## Honest limits

- **Short-term effects can mislead about the long term.** Hohnhold et al. (2015) showed that users' propensity to click ads depends on the quality of ads they saw before. Acting on these findings, Google cut the ad load on its mobile search interface by 50 %.
- **Some value never enters the test.** Netflix notes it cannot measure word-of-mouth per variant, because that effect reaches people outside the experiment.
- **Margins are value judgments.** A test checks $\mu_g$; it cannot choose it. Whether diversity may fall by 0.5 % or 2 % is a product decision that needs an owner and a written reason.
- **A proxy used as a training reward gets gamed** (Goodhart's law). Keep at least one judge that comes from a different source than the reward, such as asking users. YouTube, for example, measures "valued watchtime" through surveys in which viewers rate videos they watched.

**Takeaway:** the launch rule is only as trustworthy as the north star's direction. Validate that first, then price each guardrail in sample size before you add it.

**Sources:**

- Kohavi, Deng, Frasca, Longbotham, Walker, Xu (2012). Trustworthy Online Controlled Experiments: Five Puzzling Outcomes Explained. KDD. https://doi.org/10.1145/2339530.2339653
- Deng, Shi (2016). Data-Driven Metric Development for Online Controlled Experiments: Seven Lessons Learned. KDD. https://doi.org/10.1145/2939672.2939700
- Gomez-Uribe, Hunt (2015). The Netflix Recommender System: Algorithms, Business Value, and Innovation. ACM TMIS 6(4). https://doi.org/10.1145/2843948
- Schultzberg, Ankargren, Frånberg (2024). Risk-aware product decisions in A/B tests with multiple metrics. https://arxiv.org/abs/2402.11609
- Athey, Chetty, Imbens, Kang (arXiv 2016, revised 2024). Estimating Treatment Effects using Multiple Surrogates: The Role of the Surrogate Score and the Surrogate Index. https://arxiv.org/abs/1603.09326
- Wang et al. (2022). Surrogate for Long-Term User Experience in Recommender Systems. KDD. https://doi.org/10.1145/3534678.3539073
- McDonald, Maystre, Lalmas, Russo, Ciosek (2023). Impatient Bandits: Optimizing Recommendations for the Long-Term Without Delay. KDD. https://doi.org/10.1145/3580305.3599386
- Hohnhold, O'Brien, Tang (2015). Focusing on the Long-term: It's Good for Users and Business. KDD. https://doi.org/10.1145/2783258.2788583
- Goodrow (2021). On YouTube's recommendation system. YouTube Official Blog. https://blog.youtube/inside-youtube/on-youtubes-recommendation-system/
