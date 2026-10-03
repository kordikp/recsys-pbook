---
id: llm-recommenders-four-jobs
type: spine
title: "Four Jobs for an LLM in Your Recommender"
readingTime: 3
standalone: true
core: true
teaser: "The CEO wants to 'just put ChatGPT on the shop'. An LLM can do four jobs inside a recommender: here is what each one buys, what it risks, and the one job to keep away from it."
parent: null
diagram: diagram-llm-four-roles
recallQ: "What are the key strengths and limitations of using LLMs for recommendations?"
recallA: "Strengths: natural language preference articulation, zero-shot reasoning about items, conversational interface. Limitations: hallucination (recommending nonexistent items), no real personalization without user interaction data, popularity bias amplification, high inference latency, and knowledge cutoff."
highlights:
  - "An LLM can take four jobs in a recommender: conversational front-end, metadata/feature generator, re-ranker of a retrieved shortlist, explainer. Each has its own cost profile: offline once per item, or online on every request."
  - "LLMs can confidently recommend items that do not exist or that the catalog does not carry, so hallucination is critical. Constrain output to catalog queries or candidate IDs."
  - "Without the user's interaction history an LLM recommends for a stereotype, so personalization still comes from behavioral data."
  - "Best results: the LLM as interface, enrichment and reasoning layer, with the behavioral recommender as the backbone that picks from the real catalog."
status: accepted
concept: llm-recommenders
conceptTitle: "LLM-powered recommendation"
parents: embeddings|pipeline
state: edited
lens: ecommerce
lang: en
depth: standard
formalism: none
visuality: balanced
lengthBand: standard
genre: explainer
carriers: prose|table|diagram
objective: "Know the four jobs an LLM can do inside a recommender (conversational front-end, feature/metadata generator, re-ranker of a retrieved shortlist, explainer), what each one buys and risks, and why picking items from the real catalog stays with the behavioral recommender."
forbidden: "presenting an LLM as a drop-in replacement for the behavioral recommender | specific latency or cost figures, or named company deployments, without a source"
---

The CEO of Trailhead, an outdoor-gear shop, is back from a conference with one request: "Put ChatGPT on the shop and let it recommend."

A **large language model (LLM)**, the technology behind ChatGPT, is good with words. The shop's recommender is good with behavior: it learns from purchases what suits whom, then retrieves and ranks candidates on every page view (the [pipeline](#c/pipeline)). Jana, the product owner, answers with four jobs an LLM can take inside it.

**1. Conversational front-end: the receptionist.** A customer types "a tent for two that survives Scottish wind and fits in a bike pannier". The LLM turns the wish into terms the catalog understands (two persons, wind-rated, short packed length) and asks back: "Summer only, or all year?" Retrieval and ranking still run on real stock.

**2. Metadata generator: the night-shift cataloguer.** Overnight, the LLM reads product descriptions and reviews and fills in attributes nobody typed: season, weight class, "bikepacking-friendly". These feed the recommender's [embeddings](#c/embeddings) (the numbers it compares products by), so a tent added this morning is findable before its first click ([item cold start](#c/item-cold-start)).

**3. Re-ranker: the second opinion.** The LLM reorders the pipeline's top 20 using the customer's words and the product texts. It judges items from their descriptions alone, with no clicks to learn from (**zero-shot reasoning**): someone who wrote "my partner is 1.95 m tall" needs a long tent.

**4. Explainer: the narrator.** "Packs to 38 cm, so it fits your pannier." The LLM turns the recommender's reasons and the product's real attributes into a sentence. Spotify's DJ works this way: Spotify's personalization picks the music, and generative AI writes what the DJ says about it.

| Job | Runs | Risk | Guardrail |
|---|---|---|---|
| Front-end | every message | misreads the wish | show the filters it understood |
| Metadata | once per product, offline | wrong attributes | spot checks; supplier data wins |
| Re-ranker | every request, top 20 only | slow, costly, swayed by list order and fame | chat pages only; measure it |
| Explainer | every item shown | fluent but false reasons | cite only reasons it was given ([explanations](#c/explanations)) |

**The one job to keep.** Picking from its own memory, an LLM shows five weaknesses. It **hallucinates** tents that don't exist, or that Trailhead doesn't sell. It **doesn't know this customer**: without their purchase history it recommends for a stereotype. It **favors the famous** and buries the [long tail](#c/long-tail) (**popularity bias**). It is **slow and costly**: every answer is a fresh model call that writes word by word. And it is **frozen in time**, knowing the world up to its training date and the catalog only if you hand it over. Picking from the full catalog stays with the behavioral recommender.

**The recommender picks; the LLM listens, labels, reorders and talks.** Jana's plan: the cataloguer this month, the receptionist next quarter, a re-ranker only once an A/B test (half the visitors get it, half don't) shows it earns its cost.

**Sources:**
- Hou et al., "Large Language Models are Zero-Shot Rankers for Recommender Systems", ECIR 2024 (zero-shot ranking ability; sensitivity to candidate order and popularity): https://arxiv.org/abs/2305.08845
- Spotify Newsroom, "Spotify Debuts a New AI DJ, Right in Your Pocket", 22 Feb 2023: https://newsroom.spotify.com/2023-02-22/spotify-debuts-a-new-ai-dj-right-in-your-pocket/
