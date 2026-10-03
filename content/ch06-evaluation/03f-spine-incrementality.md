---
id: incrementality
type: spine
title: "Incrementality: Would They Have Bought It Anyway?"
readingTime: 3
standalone: true
core: false
teaser: "The dashboard says recommendations bring in 18% of revenue. The number that matters is how much of it would have happened without them."
parent: null
diagram: diagram-incrementality-holdout
recallQ: "Why is 'X% of revenue comes through recommendations' not proof that the recommender works, and what is?"
recallA: "That number is attributed revenue: it counts every sale that passed through a recommendation, including sales that would have happened anyway or only moved from another shelf. Proof is incremental lift: compare shoppers who get recommendations with a randomly held-out control group that doesn't, and report the difference in revenue or retention per user, with its uncertainty (a confidence interval)."
highlights:
  - "Attributed revenue (sales that passed through a recommendation click, the 'X% of revenue' figure) overstates impact: many of those purchases would have happened anyway (habitual reorders, items found by search) or only moved from another shelf (cannibalization). Attribution can also miss indirect effects."
  - "Incrementality is the difference in outcomes between users who get recommendations and a randomly assigned holdout group that gets none (or a non-personalized baseline). Randomization is what makes the gap causal."
  - "Report lift per user in business units (revenue, orders, retention) with a confidence interval, not CTR or attributed share. A range that includes zero means the effect is not shown yet."
  - "Keep a small, long-running holdout to catch slow effects in both directions (later purchases via search, churn), and accept its cost in forgone lift."
status: accepted
concept: incrementality
conceptTitle: "Incrementality"
parents: ab-testing|objectives
state: edited
lens: ecommerce
lang: en
depth: intro..standard
formalism: none
visuality: balanced
lengthBand: deep
genre: explainer
carriers: prose|diagram
objective: "Revenue that flows through recommendations is not revenue the recommender created. Its real value is the incremental lift over a randomly held-out control group, reported per user in business units with its uncertainty."
forbidden: "invented statistics or benchmark numbers (illustrative numbers must be labelled as illustrative) | invented citations, URLs, or paper titles | presenting an attributed share (e.g. 'X% of a retailer's sales come from recommendations') as proof of causal impact | claiming that a high CTR or click share proves the recommender caused the sales | claiming a single method fully solves the problem"
---

A grocery store hires Pete to stand by the milk fridge and say "Milk?" to everyone who walks past. His monthly report: **4,000 bottles sold** after his recommendation. Employee of the month, by his own count. The manager is unmoved: most of them were heading for the milk anyway.

Plenty of recommender dashboards have a Pete problem. "Recommendations bring in 18% of revenue" measures **attributed revenue**: sales that *passed through* a recommendation click. It counts the customer who reorders the same printer ink every quarter via "Buy again". It counts the jacket someone would have found by search two minutes later, and sales that only moved from one shelf to another (**cannibalization**). A study of Amazon browsing logs estimated that at least 75% of visits via recommendation clicks to the products it examined would probably have happened anyway (through search, for example).

What you want is **incrementality**: the extra sales that happen *because of* the recommendations. No single customer can show it, since nobody both gets and doesn't get recommendations. Two groups can.

**The holdout.** Pick a random 5% of shoppers and show them no personalized recommendations (or a plain bestseller list). This **holdout group** is your world without Pete. The split is random, so on average the groups differ only in the recommender, and any gap in spending is its doing. It is an [A/B test](#c/ab-testing) where one side gets no personalized recommendations.

An online department store, after one month (illustrative numbers):

- Shoppers with recommendations spent **€51.50** each, €9.30 of it through recommendation clicks.
- Holdout shoppers spent **€50.00** each.

The dashboard credits the recommender with €9.30 per shopper. The holdout says it caused **€1.50**, a 3% lift. Across 400,000 monthly shoppers that is about €600,000 a month, roughly a sixth of the dashboard's claim and still a good result: published field tests most often report direct revenue lifts of 1–5%.

**Report the wobble.** One month of a small holdout is noisy, so the honest sentence is a range: "+€1.50 per shopper, plausibly between €0.50 and €2.50." That range is a **confidence interval**; if it includes zero, the answer is "we can't tell yet". Report lift per shopper in the units the business plans in (revenue, orders, retention, meaning customers who stay; see [objectives](#c/objectives)), not clicks.

**Keep the holdout running.** Some effects are slow, and attribution can miss value too. At one online grocer, recommendations added almost no direct revenue, yet sales in one category rose by up to 26% through purchases not made from a recommendation list. Stale suggestions can also drive customers away weeks later. A small holdout kept for months catches both. Here it costs about €30,000 a month: the price of knowing.

Next time someone says "recommendations bring in X% of revenue", ask one question: **compared to what?**

**Sources:**
- Sharma, A., Hofman, J. M. & Watts, D. J. (2015). Estimating the Causal Impact of Recommendation Systems from Observational Data. *ACM EC '15*. https://doi.org/10.1145/2764468.2764488 (preprint: https://arxiv.org/abs/1510.05569)
- Jannach, D. & Jugovac, M. (2019). Measuring the Business Value of Recommender Systems. *ACM TMIS* 10(4). https://doi.org/10.1145/3370082 (typical 1–5% direct revenue lifts; the online-grocer case from Dias et al., RecSys '08)
