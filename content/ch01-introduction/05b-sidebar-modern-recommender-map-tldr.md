---
id: modern-recommender-map-tldr
type: spine
title: "A Modern Recommender in One Minute"
readingTime: 1
standalone: true
core: false
teaser: "Four stations, one loop and a chatty helper, in under a minute."
parent: modern-recommender-map
recallQ: "What are a recommender's four stations, what closes the loop, and what do LLMs mostly do?"
recallA: "Retrieval, ranking, re-ranking with rules, and presentation; the feedback loop turns what users do into new training data; LLMs mostly help beside the stations by understanding requests, enriching item data, reordering a short list and writing replies."
status: accepted
concept: modern-recommender-map
lens: ecommerce
lang: en
depth: intro..standard
formalism: none
visuality: text-first
lengthBand: tldr
genre: explainer
state: edited
carriers: prose
---

A recommendation row is the last leg of a relay that starts with **data**: the shop's products, its shoppers, and what each shopper viewed, bought or sent back.

Then come four stations. **Retrieval** quickly grabs a few hundred promising products out of tens of thousands. **Ranking** scores each one carefully: will this shopper click, buy, keep it? **Re-ranking** applies the shop's rules: nothing sold out or against policy, some variety, the agreed promotions. **Presentation** puts the result somewhere: a homepage row, search results, an email, a chat reply.

Whatever the shopper does with it is recorded and teaches the system for next time. That is the **feedback loop**.

**Large language models**, the engines behind chat assistants, mostly help beside the stations: they understand typed requests, enrich product descriptions in advance, reorder a short list and write the replies. The products still come from the shop's own retrieval and ranking.
