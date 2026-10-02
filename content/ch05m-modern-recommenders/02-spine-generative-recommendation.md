---
id: generative-recommendation
type: spine
title: "Spelling the Next Item: Generative Recommendation"
readingTime: 3
standalone: true
core: false
teaser: "Instead of searching the catalog for the closest products, a generative recommender writes the next product's code, one piece at a time, like autocomplete for a shop."
parent: null
diagram: diagram-semantic-id-spelling
recallQ: "What is a semantic ID, and how does a generative recommender use it to pick the next item instead of searching for nearest neighbours?"
recallA: "A semantic ID is a short code of tokens learned from an item's content, built coarse to fine, so similar items share the beginning of their code. A generative recommender reads the user's history as such codes and writes the next item's code token by token (several candidates in parallel); each code is looked up in the catalog and codes that match no item are dropped. It does not compare the user's embedding against an index of item embeddings."
highlights:
  - "A semantic ID is a short code learned from an item's content; similar items share the start of their code"
  - "A generative recommender writes the next item's code token by token instead of searching an index for nearest neighbours"
  - "New items get a code on day one; the price is more computing per request and codes that must be rebuilt"
  - "In production so far it mostly supplies candidates to a separate ranking stage"
status: draft
concept: generative-recommendation
conceptTitle: "Generative recommendation and semantic IDs"
parents: embeddings|pipeline|item-cold-start
state: edited
lens: ecommerce
lang: en
visuality: balanced
depth: standard
formalism: none
lengthBand: standard
genre: explainer
carriers: prose|diagram
---

Lena runs product at an outdoor-gear shop with 80,000 products, and her data team wants to try **generative retrieval**.

**The classic way: search, then rank.** The first stage of her recommender, [retrieval](#c/pipeline), turns the shopper's recent clicks into an [embedding](#c/embeddings) (a list of numbers that describes taste) and searches an index of product embeddings for the few hundred nearest ones. A ranking model then orders that shortlist.

**The generative way: write the answer.** First, every product gets a **semantic ID**: a short code such as 7-1-4, learned from its title, description and photos. The code goes from coarse to fine, so similar products share the start of their code. Picture a shop where the system drew the floor plan itself: aisle 7, shelf 1, slot 4. Nobody named the aisles. The system has no idea that shelf 7-3 means "boots and the socks you wear in them", only that those products belong together.

Then a **[sequence model](#c/sequential-recommendation)** (the kind behind chatbots, trained here on shopping histories) reads the shopper's recent products as codes and **writes the next product's code, one piece at a time**:

- Viewed: hiking boots (7-3-12), wool socks (7-3-40), rain jacket (7-1-4)
- The model writes **7** (same aisle), then **1** (the rain jacket's shelf), then **9**. Code 7-1-9 is the rain trousers.

The model writes several codes in parallel (**beam search**); each is looked up in the catalog, and the occasional code that matches no product is dropped. Ranking and business rules then run as usual.

**What it buys.** A rain poncho added this morning gets its code from its description straight away, so it can be recommended next to its neighbours before anyone has bought it, which eases [item cold start](#c/item-cold-start). There is also no separate vector per product: in the TIGER research system (2023), about a thousand code tokens covered the whole catalog.

**What it costs.** Writing codes piece by piece costs more computing per request than a nearest-neighbour lookup, as TIGER's authors note. Codes that also use behaviour data go stale as habits shift, and rebuilding them means retraining the model.

**Where it stands.** The best-known starting point is TIGER (Google researchers, 2023), tested on Amazon product data. Production reports come from giants. At YouTube and Spotify, generative retrieval supplies candidates that their ranking stages then order. Kuaishou, a short-video platform, reports one generative model doing both retrieval and ranking for about a quarter of its traffic. A 2026 study finds that a well-built classic retrieval model is still competitive.

**Lena's takeaway:** today, generative retrieval is mostly one more source of candidates, not a new recommender. She should ask what it beats in a live [A/B test](#c/ab-testing), what it costs per request, and how often the codes get rebuilt.

**Sources:**
- Rajput et al., "Recommender Systems with Generative Retrieval" (TIGER), NeurIPS 2023 — https://arxiv.org/abs/2305.05065
- He et al., "PLUM: Adapting Pre-trained Language Models for Industrial-scale Generative Recommendations" (YouTube), 2025 — https://arxiv.org/abs/2510.07784
- D'Amico et al., "Deploying Semantic ID-based Generative Retrieval for Large-Scale Podcast Discovery at Spotify", 2026 — https://arxiv.org/abs/2603.17540
- Zhou et al., "OneRec Technical Report" (Kuaishou), 2025 — https://arxiv.org/abs/2506.13695
- Xu et al., "The Case Against Generation for Retrieval: Discriminative Language Models as Effective Retrievers", 2026 — https://arxiv.org/abs/2607.25346
