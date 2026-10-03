---
id: modern-recommender-map
type: spine
title: "A Modern Recommender on One Page"
readingTime: 3
standalone: true
core: false
teaser: "Follow one tap through the whole machine: the data, four stations, the feedback loop, and the places where LLMs now plug in."
parent: null
diagram: diagram-modern-recommender-map
recallQ: "Which stations does a modern recommender pass a request through, what closes the loop, and where do LLMs plug in?"
recallA: "Data (catalog, users, interactions) feeds four stations: candidate retrieval (fast and broad), ranking (a heavier model scores each candidate on predicted outcomes), re-ranking with business rules, variety and policy, and presentation in a placement such as a homepage row, search or chat. What users do with what they were shown is logged and becomes the next training data: the feedback loop. LLMs mostly plug in beside the stations: as the conversational front door, as offline enrichers of item data, as rerankers of a short list, and as writers of answers and explanations."
highlights:
  - "The fuel: the catalog (items and attributes), the users, and the interactions between them (views, add-to-carts, purchases, returns)"
  - "Station 1, candidate retrieval: several fast sources (co-purchase/collaborative, similar-to-viewed, bestsellers, new arrivals) each nominate a broad shortlist from the whole catalog. The aim is not to miss good items; precision comes later."
  - "Station 2, ranking: a heavier model scores each candidate on predicted outcomes (click, purchase, return) and blends them into one score that reflects what the business values"
  - "Station 3, re-ranking and rules: a list-level step removes sold-out or policy-violating items, adds variety and honours agreed promotions"
  - "Station 4, presentation: the same engine fills many placements (homepage row, similar items, search, email, chat), each a scenario with its own goal. The label shown with the list is part of the product."
  - "Feedback loop: what users do with what they were shown is logged and becomes the next training data. The system learns only about what it chose to show, so it needs exploration and A/B tests."
  - "LLMs mostly plug in beside the stations: as a conversational front door whose answers are built from the catalog via retrieval, as offline enrichers of item data, as rerankers of a short list, and as writers of answers and explanations. (Optional beyond standard depth: generative recommenders merge retrieval and ranking at a few large platforms, but the jobs remain.)"
status: accepted
concept: modern-recommender-map
conceptTitle: "A modern recommender on one page"
parents: patterns-not-magic|three-jobs
lens: ecommerce
lang: en
depth: standard
formalism: none
visuality: balanced
lengthBand: deep
genre: explainer
state: edited
carriers: prose|diagram
objective: "Give a reader without a CS background one mental map of a modern recommender. Data feeds four stations: candidate retrieval, then ranking, then re-ranking with rules, then presentation. A feedback loop turns what users do with what they were shown into the next training data. LLMs and AI assistants plug in at several points. Every later chapter should have a place on this map."
forbidden: "invented statistics or benchmark numbers (e.g. a universal pipeline latency in milliseconds, or revenue shares attributed to recommendations) | invented citations, URLs, or paper titles | claiming LLMs have replaced the behavioural recommender, or that an AI assistant picks products without retrieving them from a real catalog | claiming a single method or model fully solves recommendation | presenting a vendor's or paper's self-reported uplift as a general expectation"
---

Petra opens an outdoor-gear shop app, and a row called **Picked for you** appears before she starts scrolling. Behind it run four stations, fed by data and closed by a loop; the links lead to the chapters that zoom in.

**The fuel.** The shop knows its **catalog** (every product and its attributes), its **users**, and the **interactions** between them: views, add-to-carts, purchases, returns. → [the three data pillars](#c/data-pillars)

**Station 1: candidate retrieval.** Say the shop sells 50,000 products. Scoring all of them carefully for every visitor is too slow, so quick methods each nominate a few hundred: what shoppers with similar baskets bought ([collaborative filtering](#c/collaborative-filtering)), products resembling what Petra viewed, this week's bestsellers, new arrivals. The goal is to miss nothing good. YouTube described the same shape in 2016: millions of videos cut to hundreds, then ranked down to dozens.

**Station 2: ranking.** A heavier model scores each candidate for Petra: how likely is a click, a purchase, a return? The predictions blend into one score that reflects what the shop values. → [the recommendation pipeline](#c/pipeline)

**Station 3: re-ranking and rules.** The top of the list is not shown as is. Sold-out items and anything against policy drop out, a promoted brand gets its agreed slot, six near-identical black jackets are thinned to two. → [business rules](#c/business-rules)

**Station 4: presentation.** The same engine fills the homepage row, "similar items", search results and emails, each a [scenario](#c/scenarios) with its own goal. Even the label ("Because you viewed trail shoes") is part of the product.

**The loop.** Whatever Petra does next (tap, ignore, buy, return) is logged next to what she was shown and becomes tomorrow's training data. That is how the system learns, and how it fools itself: it only learns about what it chose to show. Hence [exploration](#c/explore-exploit) and [A/B tests](#c/ab-testing).

**Where LLMs plug in.** Large language models (LLMs), the technology behind chat assistants, mostly sit *beside* the stations:

- **Front door.** Petra types "shoes for a muddy trail half-marathon". The LLM reads the request, retrieval and ranking fetch real products, the LLM writes the reply. Amazon's Rufus answers from product information it pulls out of Amazon's search results.
- **Stockroom.** Ahead of time, LLMs enrich item data: Amazon's COSMO uses one to spell out links such as "shoes for pregnant women" → slip-resistant shoes.
- **Short list.** An LLM can reorder the top few candidates; judging all 50,000 would be too slow and costly.
- **Label.** In Spotify's DJ, personalization picks the tracks and generative AI helps editors write the commentary.

→ [LLM-powered recommendation](#c/llm-recommenders)

**Takeaway:** when a pick looks wrong, ask *which station*: retrieval that never fetched the right product, a ranker chasing the wrong goal, a rule that pushed something in, or a loop learning from its own past. Each fix lives in a different place.

**Sources:**
- Covington, Adams, Sargin: *Deep Neural Networks for YouTube Recommendations*, RecSys 2016 — https://doi.org/10.1145/2959100.2959190
- Amazon: *Amazon announces Rufus* — https://www.aboutamazon.com/news/retail/amazon-rufus
- AWS Machine Learning Blog: *Scaling Rufus* (Rufus as a retrieval-augmented system), 2024 — https://aws.amazon.com/blogs/machine-learning/scaling-rufus-the-amazon-generative-ai-powered-conversational-shopping-assistant-with-over-80000-aws-inferentia-and-aws-trainium-chips-for-prime-day/
- Amazon Science: *Building commonsense knowledge graphs to aid product recommendation* (COSMO, SIGMOD 2024) — https://www.amazon.science/blog/building-commonsense-knowledge-graphs-to-aid-product-recommendation
- Spotify Newsroom: *Spotify debuts a new AI DJ, right in your pocket*, 2023 — https://newsroom.spotify.com/2023-02-22/spotify-debuts-a-new-ai-dj-right-in-your-pocket/
