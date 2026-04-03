---
id: ch7-cold-start-language
type: spine
title: "Cold Start and Language: Teaching Algorithms to Read"
readingTime: 4
standalone: true
core: true
teaser: "New items have zero interactions. How do you recommend something nobody has seen? The answer involves teaching computers to read."
voice: universal
parent: null
diagram: null
recallQ: "How does beeFormer solve the cold-start problem?"
recallA: "It trains a Transformer on item text/images using ELSA's recommendation loss, learning to map descriptions to embeddings that predict user behavior — enabling recommendation of items with zero interactions."
highlights:
  - "beeFormer learns 'who would like this' from text, not 'what this is about'"
  - "Zero-shot transfer to unseen domains: +131% Recall without any retraining"
  - "Cold start has economic implications -- new creators can't compete without it"
publishedAt: "2026-04-03"
status: accepted
---

Every recommendation system faces a chicken-and-egg problem: **you can't recommend items nobody has interacted with, but nobody can interact with items that aren't recommended.**

This is the **cold-start problem**, and it's one of the most practically important challenges in the field. A new product on Amazon, a fresh article on a news site, an emerging artist on Spotify — all start with zero interaction data.

## The Limitation of Collaborative Filtering

Pure collaborative filtering — including EASE, ELSA, and standard matrix factorization — works by finding patterns in the interaction matrix **X**. If an item has no column in **X** (or a column of all zeros), these methods literally have nothing to work with.

Traditional solutions include:
- **Popularity-based fallback:** Show trending items to new users, show new items based on popularity signals — but this creates a rich-get-richer cycle.
- **Content-based filtering:** Use item metadata (genre, tags, description) to find similar items — but this requires hand-crafted features and misses subtle behavioral patterns.
- **Explicit feedback:** Ask users to rate a few items upfront — but this adds friction and most users skip it.

None of these solutions leverage the deep understanding that collaborative filtering has built up from millions of interactions.

## beeFormer: Bridging Text and Behavior

[beeFormer](https://www.recombee.com/blog/introducing-beeformer-a-framework-for-training-foundational-models-for-recommender-systems) (RecSys 2024) proposes an elegant solution: **train a language model to produce embeddings that predict user behavior, not just semantic similarity.**

The architecture:
1. **Input:** Item text (title, description, metadata) and optionally images
2. **Encoder:** A Sentence Transformer processes the text into an embedding vector
3. **Training objective:** Not standard NLP loss, but **ELSA's recommendation loss**

$$\mathcal{L} = \|\operatorname{norm}(\mathbf{X}_u) - \operatorname{norm}(\mathbf{X}_u(\mathbf{A}\mathbf{A}^\top - \mathbf{I}))\|_F^2$$

where **A** = g(**T**, θ_g) is the output of the Transformer applied to item texts **T**.

**The key insight:** By training the Transformer with a collaborative filtering loss, it learns to map text descriptions to the same embedding space that ELSA uses for recommendation. The Transformer doesn't learn "what this item is about" — it learns "what kind of user would interact with this item."

## Why This Matters: The Difference Between Similarity and Preference

Standard text embeddings (from models like Sentence-BERT) capture **semantic similarity**: "Inception" and "The Matrix" have similar descriptions (sci-fi, mind-bending, visual effects). But in user behavior, "Inception" fans might actually prefer "Interstellar" (same director, similar emotional tone) over "The Matrix."

beeFormer's embeddings capture **behavioral similarity**: items that the same users tend to interact with, as predicted from their textual descriptions. This is a fundamentally different and more useful notion of similarity for recommendation.

## Zero-Shot Transfer: The Breakthrough Result

The most remarkable finding: a beeFormer model trained on MovieLens and Amazon data can recommend books on Goodbooks — **without any retraining or fine-tuning.**

The results are dramatic:
- **Zero-shot transfer to Goodbooks:** +131% improvement in Recall@20 (from 0.1146 to 0.2649)
- **Cold-start on ML-20M (new items):** +49% improvement (from 0.3114 to 0.4630)
- **Multi-domain transfer:** +8% from cross-domain knowledge accumulation

This is possible because the Transformer has learned a general mapping from text to recommendation-relevant features. The textual bridge works across domains: the concept of "character-driven narrative" is relevant whether describing a movie, a book, or a podcast.

## The Production Architecture

In practice, Recombee uses a hybrid approach:
- **Items with sufficient interactions:** ELSA/VASP for collaborative filtering
- **New items (zero interactions):** beeFormer embeddings for initial recommendations
- **Exploration:** Bandit algorithms to balance known items with new ones
- **Transition:** As interactions accumulate, the system gradually shifts from text-based to behavior-based recommendations

This graceful degradation ensures that every item gets a fair chance at discovery, while established items benefit from the richer behavioral signal.

> **Research publication:** Vančura, Kordík & Straka, "beeFormer: Bridging the Gap Between Semantic and Interaction Similarity," RecSys 2024. The framework is [open-source on GitHub](https://github.com/recombee/beeFormer).

**Consider this:** The cold-start problem isn't just technical — it has economic and cultural implications. If new items can't get recommended, established content has an insurmountable advantage. beeFormer doesn't just solve a technical problem; it creates a more level playing field for new creators and content.