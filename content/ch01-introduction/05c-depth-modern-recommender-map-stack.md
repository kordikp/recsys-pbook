---
id: modern-recommender-map-stack
type: spine
title: "The Modern Stack, Station by Station"
readingTime: 6
standalone: true
core: false
teaser: "The one-page map with the practitioner details put back: candidate sources, pre-ranking, multi-task scores, impression logs, five LLM sockets, and generative models that merge two stations."
parent: modern-recommender-map
recallQ: "In a current recommender stack, what do LLMs and generative recommenders change, and which jobs stay no matter which model you use?"
recallA: "LLMs plug in at five sockets, mostly beside the cascade: feature engineering, feature encoding, scoring or reranking a short list, the conversational interface, and pipeline control. Generative recommenders such as TIGER, HSTU and OneRec merge retrieval and ranking into one model. The jobs stay: find candidates, order them, enforce rules and policy on the final list, present it, and log what was shown so the next model can learn from it."
status: draft
concept: modern-recommender-map
lens: generic
lang: en
depth: technical
formalism: light
visuality: text-first
lengthBand: deep
genre: explainer
state: edited
carriers: prose|formula
---

The one-page map has four stations, a loop, and a few spots where LLMs plug in. In production each of these hides decisions that set the system's quality and its cost.

## Station 1: retrieval is a union of sources

No single retriever covers everything. A typical setup runs several in parallel: a **two-tower model** with approximate nearest-neighbour search over item [embeddings](#c/embeddings), item-to-item co-occurrence, content embeddings that can reach items with no history yet ([item cold start](#c/item-cold-start)), trending and fresh-item pools, sometimes editorial lists. Each returns its top-k, and the union is deduplicated. Covington et al.'s 2016 description of YouTube has this shape: candidate generation narrows millions of videos to hundreds, candidates from other sources can be blended in, and the ranker is "crucial for ensembling different candidate sources whose scores are not directly comparable."

## Between 1 and 2: pre-ranking

Large cascades often insert a light model between retrieval and the heavy ranker, so the expensive model only sees what the latency and compute budget allows. Alibaba's COLD paper describes the cascade as matching, pre-ranking, ranking, and treats pre-ranking as a model-and-compute co-design problem rather than a shrunken copy of the ranker.

## Station 2: ranking is multi-task

The ranker predicts several outcomes per candidate and combines them into one value, for example $v = w_1\hat{p}_{\text{click}} + w_2\hat{p}_{\text{buy}} - w_3\hat{p}_{\text{return}}$, where each $\hat{p}$ is a predicted probability and the weights $w$ encode business priorities. Choosing those weights is a product decision disguised as a hyperparameter. YouTube's 2019 ranker used Multi-gate Mixture-of-Experts to serve several competing objectives and added a component to reduce selection bias in the feedback it learns from. → [the recommendation pipeline](#c/pipeline)

## Station 3: re-ranking works on the list, not the item

Diversity, de-duplication and exploration slots depend on what *else* is in the list, so a per-item scorer cannot learn them. Stock, contract, policy and safety rules are hard constraints that nobody wants a model to learn approximately. Both kinds live in a final list-level step. → [business rules](#c/business-rules), [diversity](#c/filter-bubbles)

## Station 4 and the loop: log impressions, not just clicks

Record what was shown, at which position, from which source and model version. Without impression logs a non-click is invisible, position bias cannot be corrected, and neither [A/B tests](#c/ab-testing) nor offline evaluation can be trusted. The loop also confounds learning. Chaney et al. (RecSys 2018) showed in simulation that training on data from users already exposed to recommendations homogenizes behaviour without raising utility, and Jiang et al. (AIES 2019) analysed such "degenerate feedback loops". The usual countermeasures are exploration traffic, randomized holdouts, and logging enough to reweight later. → [exploration](#c/explore-exploit), [monitoring](#c/monitoring)

## Five LLM sockets

Lin et al.'s survey (ACM TOIS) sorts LLM use into five places. Mapped onto the stations:

1. **Feature engineering (offline).** Amazon's COSMO prompts an LLM with query-purchase and co-purchase data to produce commonsense relations, filters them with human annotation and classifiers, and feeds the resulting knowledge-graph triples to relevance models.
2. **Feature encoder (retrieval).** Language-model embeddings of item text place new items next to known ones.
3. **Scoring and ranking (short list).** Hou et al. (ECIR 2024) found zero-shot LLM rankers promising but sensitive to item order in the prompt and to popularity, weak at perceiving the order of a user's history, and still dependent on candidates from conventional retrievers. Cost grows with list and prompt length, so the list stays short.
4. **User interaction (front door).** Conversational assistants ground replies with retrieval-augmented generation (Lewis et al., NeurIPS 2020). Amazon describes Rufus as a RAG system that retrieves product information from Amazon search results. The guardrail: name only items that retrieval returned. → [LLM-powered recommendation](#c/llm-recommenders)
5. **Pipeline controller.** An LLM decides which tools to call (search, filters, cart). This is the least settled socket.

## Generative recommenders merge stations 1 and 2

TIGER (Rajput et al., NeurIPS 2023) gives each item a **Semantic ID**, a tuple of codewords, and trains a sequence-to-sequence model to decode the next item's ID, which also helped items with no interaction history. HSTU (Zhai et al., ICML 2024) treats recommendation as sequential transduction; the authors report deployment on multiple surfaces of a platform with billions of users and quality that scales as a power law of training compute. OneRec (Kuaishou, 2025) replaces the retrieve-then-rank cascade with one generative model and reports a 1.6% watch-time gain in Kuaishou's main scene. These figures are the authors' own measurements in their own settings, not estimates for yours.

## Honest limits

- **Cost.** An LLM call costs far more than a dot product, which is why LLMs mostly run offline, on short lists, or on chat traffic rather than on every feed request.
- **Faithful explanations.** An LLM asked to justify a pick after the fact can produce a plausible reason the ranker never used. Generate explanations from the signals that drove the score. → [explanations](#c/explanations)
- **Merging stations does not remove jobs.** A generative model still needs stock and policy constraints on its output, and it still trains on logs of what it showed.

**What to remember:** stations are jobs, not boxes. Models merge and split them, but every production system still finds candidates, orders them, enforces constraints, shows them, and learns from what it showed.

**Sources:**
- Covington, Adams, Sargin: *Deep Neural Networks for YouTube Recommendations*, RecSys 2016 — https://doi.org/10.1145/2959100.2959190
- Wang et al.: *COLD: Towards the Next Generation of Pre-Ranking System*, DLP-KDD 2020 — https://arxiv.org/abs/2007.16122
- Zhao et al.: *Recommending What Video to Watch Next: A Multitask Ranking System*, RecSys 2019 — https://doi.org/10.1145/3298689.3346997
- Chaney, Stewart, Engelhardt: *How Algorithmic Confounding in Recommendation Systems Increases Homogeneity and Decreases Utility*, RecSys 2018 — https://doi.org/10.1145/3240323.3240370
- Jiang, Chiappa, Lattimore, György, Kohli: *Degenerate Feedback Loops in Recommender Systems*, AIES 2019 — https://arxiv.org/abs/1902.10730
- Lin et al.: *How Can Recommender Systems Benefit from Large Language Models: A Survey*, ACM TOIS — https://arxiv.org/abs/2306.05817
- Amazon Science: *Building commonsense knowledge graphs to aid product recommendation* (COSMO, SIGMOD 2024) — https://www.amazon.science/blog/building-commonsense-knowledge-graphs-to-aid-product-recommendation
- Hou et al.: *Large Language Models are Zero-Shot Rankers for Recommender Systems*, ECIR 2024 — https://arxiv.org/abs/2305.08845
- Lewis et al.: *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks*, NeurIPS 2020 — https://arxiv.org/abs/2005.11401
- AWS Machine Learning Blog: *Scaling Rufus*, 2024 — https://aws.amazon.com/blogs/machine-learning/scaling-rufus-the-amazon-generative-ai-powered-conversational-shopping-assistant-with-over-80000-aws-inferentia-and-aws-trainium-chips-for-prime-day/
- Rajput et al.: *Recommender Systems with Generative Retrieval* (TIGER), NeurIPS 2023 — https://arxiv.org/abs/2305.05065
- Zhai et al.: *Actions Speak Louder than Words: Trillion-Parameter Sequential Transducers for Generative Recommendations* (HSTU), ICML 2024 — https://arxiv.org/abs/2402.17152
- Deng et al.: *OneRec: Unifying Retrieve and Rank with Generative Recommender and Iterative Preference Alignment*, 2025 — https://arxiv.org/abs/2502.18965
