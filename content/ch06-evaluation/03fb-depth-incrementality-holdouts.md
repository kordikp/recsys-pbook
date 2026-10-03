---
id: incrementality-holdout-design
type: spine
title: "Designing a Recommender Holdout: Estimand, Power and Honest Limits"
readingTime: 6
standalone: true
core: false
teaser: "A holdout sounds simple until you choose what the control sees, size it, and wait out the slow effects. The design choices, the arithmetic, and where the method stops."
parent: incrementality
recallQ: "Why does a randomized holdout measure a recommender's incremental lift when attributed revenue cannot, and what limits how precisely it measures it?"
recallA: "Attributed revenue counts every sale that passed through a recommendation, including sales that would have happened anyway or moved from another surface. Random assignment makes the holdout comparable to the treated users, so the site-wide difference in revenue or retention per user (intent-to-treat) is the caused lift. Precision is limited by the small holdout arm and heavy-tailed outcomes; outlier capping, CUPED, triggered analysis with counterfactual logging and longer, sticky holdouts tighten the confidence interval."
status: accepted
concept: incrementality
state: edited
lens: generic
lang: en
depth: technical
formalism: light
visuality: text-first
lengthBand: deep
genre: explainer
carriers: prose|table|formula
---

"Holdout" here means a held-out group of **users** in a live experiment, not the held-out test set of offline evaluation. Users are randomized once into treatment (recommender on) or holdout, and you report the average treatment effect on a business outcome per user over a fixed window: $\widehat{\text{lift}} = \bar{Y}_T - \bar{Y}_H$, the difference between the two groups' mean outcomes.

## Three rules that make the number mean something

- **Measure the site, not the widget.** The outcome is total revenue, orders or retention per user, not revenue through recommendation clicks. Cannibalization (a sale moved from search to the carousel) then nets out, and so does the halo of a recommendation that leads to a later search purchase. Widget-level metrics see neither.
- **Analyse everyone you assigned** (intent-to-treat), including users who never scrolled to a carousel. Filtering on "saw recommendations" compares different populations, because in the treatment arm the recommender itself influences who keeps browsing.
- **Make the holdout sticky and complete.** Same user, same arm, on every device and channel. If holdout users still get personalized emails or a "For you" row in the app, you measure part of the recommender, and the leakage biases the lift toward zero.

## What the control sees decides the question

| Holdout gets | Question answered |
|---|---|
| no recommendation slots | what the whole feature is worth (the layout changes too) |
| a non-personalized list, e.g. bestsellers, in the same slots | what **personalization** is worth |
| the previous model | what the latest change is worth (an ordinary A/B test) |

The three answers differ in size. A model-based analysis of Netflix viewing data (Zielnicki et al., 2025) estimated that replacing the deployed recommender with random recommendations would cut engagement by 16%, with a popularity list by 12%, and with the matrix-factorization approach Netflix used about a decade earlier by 4%. Same system, three "values".

## Sizing: the small arm dominates

With per-user standard deviation σ of the outcome, the standard error of the lift is approximately $\mathrm{SE} \approx \sigma\sqrt{1/n_T + 1/n_H}$. With a 5% holdout, the holdout term dominates.

Take the anchor's illustrative shop: 400,000 users a month, 20,000 of them in the holdout, and assume σ = €70 (revenue is heavy-tailed: most users spend nothing, a few spend a lot). SE ≈ €0.51, so the 95% interval is about ±€1.00. A true lift of €1.50 shows up in a month; a true lift of €0.50 does not. Halving the interval takes roughly four times the holdout, a longer window, or less variance:

- **Cap outliers** (winsorize the top spenders). They add variance and say little about the recommender; you accept a small bias for a much tighter interval.
- **CUPED** adjusts each user's outcome using pre-experiment data, typically the same metric measured before the test. On Bing, its authors reported about 50% variance reduction, the same power with half the users (Deng et al., 2013).
- **Trigger with counterfactual logging.** In the holdout, compute and log the recommendations each user *would* have seen, without showing them. You can then restrict both arms to users who reached a recommendation slot under the same rule (a fair comparison, unlike filtering on actual exposure), and check item by item whether holdout users bought the would-be recommendations anyway. That gives a direct estimate of the "would have happened anyway" share. Advertising uses the same idea to measure incrementality, under the name "ghost ads" (Johnson, Lewis & Nubbemeyer, 2017).

## Duration: keep it running, keep it small

Effects drift: novelty fades, a brand discovered through a recommendation gets bought later via search, stale suggestions push customers away weeks later. Participants in a 2026 industry workshop (26 experts from 15 online platforms and 4 universities) largely agreed that sign reversals between short- and long-run effects are rare, concentrated in cases like content-quality changes, and still concluded that "there is no substitute for a well-run long-term experiment" (Sigerson et al.). One of their examples: YouTube demoted "tabloid-style" videos, watch time was down 0.5% after three weeks, and after three months it had recovered and risen above a holdout group.

A long-running recommender holdout is in effect a **cumulative holdback**: the treatment arm keeps receiving every model update, so the lift measures the recommender program, not one model. The same paper notes that long-term holdouts carry a high operational and engineering burden and are typically reserved for the most impactful treatments. The cost is also commercial: holdout users get the worse experience, and the business forgoes their lift (about €30,000 a month in the shop example).

## When you can't hold out

- **Natural experiments.** Sharma, Hofman & Watts (2015) analysed Amazon.com browsing logs with an instrumental variable: a sudden spike in direct traffic to a product whose recommended neighbours saw no such spike. For the 4,000+ products studied, at least 75% of recommendation click-through activity would likely have occurred anyway. They caution against extrapolating to other products or sites.
- **Off-policy estimators** reweight logged data to estimate what another policy would have done. They are cheap and lean heavily on propensity estimates; see the [counterfactual deep dive](#ch4-counterfactual).
- **Structural models.** The Netflix analysis split the gap between "recommended to a targeted user" and "not recommended to an average user": 51% selection (targeted users were likelier to watch anyway), 42% targeting, 7% mere exposure. Attribution books all three as recommender value; only the last two were caused by recommending.

## From measuring to optimizing

Sato et al. (2019) define **uplift** as the increase in user actions caused by recommendations and illustrate that a list can be perfectly precise, with every recommended item bought, and still add nothing. Their uplift-based optimization favours items whose purchase probability rises most when recommended. Sato (2021) adapts [interleaving](#ch4-interleaving) to compare models on causal effect; in simulated online experiments it was more efficient than A/B testing.

**A reporting line that survives a CFO:** "Revenue per user +€1.50 (95% CI €0.50 to €2.50), +3.0%. Holdout: 5% of users, sticky across devices and email, sees bestsellers in the same slots. Intent-to-treat, 30-day window. Attributed share (18%) shown for reference only."

**Sources:**
- Sharma, A., Hofman, J. M. & Watts, D. J. (2015). Estimating the Causal Impact of Recommendation Systems from Observational Data. *ACM EC '15*. https://doi.org/10.1145/2764468.2764488 (preprint: https://arxiv.org/abs/1510.05569)
- Zielnicki, K., Aridor, G., Bibaut, A., Tran, A., Chou, W. & Kallus, N. (2025, arXiv preprint). The Value of Personalized Recommendations: Evidence from Netflix. https://arxiv.org/abs/2511.07280
- Deng, A., Xu, Y., Kohavi, R. & Walker, T. (2013). Improving the Sensitivity of Online Controlled Experiments by Utilizing Pre-Experiment Data. *WSDM '13*. https://doi.org/10.1145/2433396.2433413
- Johnson, G. A., Lewis, R. A. & Nubbemeyer, E. I. (2017). Ghost Ads: Improving the Economics of Measuring Online Ad Effectiveness. *Journal of Marketing Research* 54(6). https://doi.org/10.1509/jmr.15.0297
- Sigerson, L. et al. (2026). Evaluating for the Long Term: Learnings from Industry. https://arxiv.org/abs/2608.08043
- Sato, M., Singh, J., Takemori, S., Sonoda, T., Zhang, Q. & Ohkuma, T. (2019). Uplift-based Evaluation and Optimization of Recommenders. *RecSys '19*. https://doi.org/10.1145/3298689.3347018
- Sato, M. (2021). Online Evaluation Methods for the Causal Effect of Recommendations. *RecSys '21*. https://doi.org/10.1145/3460231.3474235 (preprint: https://arxiv.org/abs/2107.06630)
