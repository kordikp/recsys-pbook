---
id: multi-task-ranking-tldr
type: spine
title: "Multi-Task Ranking in 30 Seconds"
readingTime: 1
standalone: true
core: false
teaser: "Why the ranker predicts clicks, purchases, returns and hides, and who decides what each one is worth."
parent: multi-task-ranking
recallQ: "Why does a modern ranking model predict several behaviours for each item instead of one score, and how do those predictions become a single ranking?"
recallA: "Because no single behaviour captures value: optimizing clicks alone rewards clickbait, and a purchase that gets returned or an item the user hides is a loss. One shared model predicts several behaviours per item (click, purchase, return, hide), and a value model multiplies each prediction by a weight, negative for unwanted behaviours, and adds them up into one score. The weights encode the product's goals and are tuned with experiments."
status: accepted
concept: multi-task-ranking
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

A ranker that only predicts clicks fills a shop's front page with clickbait: items people click, rarely keep, and often send back.

So a modern ranker predicts several behaviours for each item: will this shopper click, buy, return it, or tap "not interested"? One model with a separate output per behaviour learns them all together. That is **multi-task ranking**.

A **value model** turns the predictions into one score for sorting: multiply each chance by a weight and add them up. Wanted behaviours get positive weights, unwanted ones negative. A dress with many clicks and many returns can then rank below plain jeans that people keep.

The weights are **product decisions** ("a purchase is worth twenty clicks", "a return is worse than no sale"). Teams test them in A/B tests and can change them without retraining the model.
