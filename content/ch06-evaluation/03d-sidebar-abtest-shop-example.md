---
id: abtest-shop-example
type: spine
title: "One Shelf, Two Shops: an A/B Test with Real Numbers"
readingTime: 3
standalone: true
core: false
teaser: "The new ranker looked smarter. The test said: for wallets, yes — for the business, wait."
voice: creator
parent: ab-testing
recallQ: "Why do we A/B test recommendations instead of trusting offline metrics?"
recallA: "Offline metrics score yesterday's logs; only a live randomized test shows how real users react — including effects logs can't contain, like discovery and behavior change."
status: accepted
concept: ab-testing
state: edited
lens: ecommerce
lang: en
visuality: balanced
depth: standard
formalism: light
lengthBand: standard
genre: worked-example
carriers: prose|table
---

An e-shop replaces the "You might also like" shelf model. Offline, the new ranker wins clearly: +9 % nDCG on logged clicks. Ship it? Not yet. Half the visitors get the old shelf (A), half the new one (B), for two weeks.

**The numbers that came back:**

| Metric (per 10 000 visitors) | A · old | B · new | Δ |
|---|---|---|---|
| shelf clicks | 1 180 | 1 310 | **+11 %** |
| add-to-cart from shelf | 205 | 214 | +4 % |
| orders (whole site) | 312 | 309 | −1 % (n.s.) |
| average order value | € 41.20 | € 43.90 | **+6.6 %** |
| returns after 30 days | 2.1 % | 2.9 % | **+38 %** ⚠ |

Three lessons hide in that table.

**Clicks lie first.** B wins clicks by a mile — the new model surfaces flashier products. But clicks are the cheapest currency; follow the money down the funnel and the gap shrinks to noise.

**The win moved sideways.** Orders didn't rise; order *value* did. B nudges people toward pricier alternatives. That's a real effect — just not the one anybody designed for.

**The bill arrives late.** The returns spike is the kicker: pricier impulse adds come back more often. A two-week test almost missed it; a two-day test certainly would have. Revenue after returns — the metric that pays salaries — ends up roughly flat.

Verdict: no rollout. Instead, a follow-up test caps the price-jump B can suggest. The offline +9 % was true and useless on its own — **the experiment didn't measure the model, it measured the business with the model inside it.**
