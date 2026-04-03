---
id: ch13-deals
type: spine
title: "Deal Aggregators: Time-Sensitive Recommendations"
readingTime: 2
standalone: true
core: false
teaser: "A deal that expires in 2 hours needs instant matching — the cold-start problem measured in minutes, not days."
voice: universal
parent: null
diagram: null
recallQ: "What is unique about deal aggregator recommendations?"
recallA: "Extreme time sensitivity (deals expire in hours), cold-start at the minute level (new deals need instant matching), geographic relevance, and commission-based ranking where affiliate partner visibility matters."
highlights:
  - "Deal cold-start must be solved in minutes, not days"
  - "Commission-based boosting balances user relevance with affiliate revenue"
publishedAt: "2026-04-03"
status: accepted
---

Deal aggregators (Slickdeals, Pepper, HotUKDeals) aggregate time-limited offers from hundreds of affiliate partners. A deal posted at 10 AM might expire by noon. The recommendation system must match users to relevant deals **immediately** — before the offer disappears.

## Key Challenges

**Extreme time sensitivity.** Deals have lifecycles measured in hours, not days. The system must surface a new deal to interested users within minutes of publication — there's no time for collaborative filtering to accumulate interaction data.

![lottie:display-emerging-time-sensitive-offers](Surfacing emerging time-sensitive deals to the right users before offers expire)

**Commission-based ranking.** Not all affiliate partners are equal. Premium partners pay higher commissions, and the platform needs to balance user relevance with [revenue from promoted deals](https://www.recombee.com/domains/deal-aggregators). Boosting is essential — but over-boosting erodes user trust.

**Geographic targeting.** A deal on a restaurant in Munich is irrelevant to a user in Berlin. Local deals need geographic filtering; global deals (online retailers) need no geographic constraint. The system must handle both.

![lottie:overcome-cold-start-problem-with-real-time-model-training](Overcoming the cold-start problem with real-time model training to match new deals instantly)

## Real-World Results

- **Slickdeals:** [+70% CTR](https://www.recombee.com/case-studies/slickdeals) to detail page views
- **Pepper:** [+21% click-outs](https://www.recombee.com/case-studies/pepper) to affiliate links
- **itison:** [2,000% ROI](https://www.recombee.com/case-studies/itison) on newsletter personalization

**Consider this:** Deal aggregators represent the most extreme cold-start challenge in recommendation — every item is time-limited and must find its audience before it expires. The algorithms that work here (content-based instant matching, bandit exploration, geographic filtering) are applicable to any domain with ephemeral content.