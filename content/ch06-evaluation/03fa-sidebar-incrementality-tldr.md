---
id: incrementality-tldr
type: spine
title: "Incrementality in 30 Seconds"
readingTime: 1
standalone: true
core: false
teaser: "Why 'recommendations bring in X% of revenue' proves little, and the one test that does."
parent: incrementality
recallQ: "What is the difference between attributed and incremental revenue from recommendations, and how do you measure the incremental part?"
recallA: "Attributed revenue is everything that passed through a recommendation, including sales that would have happened anyway; incremental revenue is only what the recommendations caused. You measure it as the difference in revenue (or retention) per user between a recommended group and a randomly held-out group without recommendations, reported with a range."
status: draft
concept: incrementality
state: edited
lens: ecommerce
lang: en
depth: intro..standard
formalism: none
visuality: text-first
lengthBand: tldr
genre: explainer
carriers: prose
---

Pete stands by the milk fridge saying "Milk?" to everyone, then claims credit for every bottle sold. Most of those shoppers were heading for the milk anyway.

"Recommendations bring in 18% of revenue" makes Pete's mistake. It is **attributed revenue**: every sale that passed through a recommendation, including sales that would have happened anyway or only moved from another shelf.

What matters is **incrementality**: the sales that happen *because of* the recommendations. To measure it, keep a **holdout**: a random slice of shoppers (say 5%) who get no personalized recommendations. The difference between the two groups in revenue per shopper (or in how many customers stay) is what the recommender caused.

Report it in money, with a range: "+€1.50 per shopper, plausibly €0.50 to €2.50". Keep the holdout running for months, because some effects take that long to show.
