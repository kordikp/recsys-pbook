---
id: ch3-deep-similarity
type: spine
title: "How Computers Understand Similarity"
readingTime: 3
standalone: true
core: true
teaser: "A jazz ballad and an ambient electronic track might evoke similar feelings. How does a machine learn to capture that?"
voice: universal
parent: null
diagram: diagram-embedding-space
recallQ: "What are \"embeddings\" in recommendation systems?"
recallA: "Dense vector representations where items are mapped to points in a continuous space. Proximity in the space corresponds to semantic or behavioral similarity. Learned via neural networks from interaction data."
highlights:
  - "Embeddings represent items as vectors where proximity = behavioral similarity"
  - "Neural networks discover latent qualities that handcrafted features miss"
  - "ANN search finds nearest neighbors among billions of vectors in milliseconds"
status: accepted
---

You can intuitively sense that two items "feel similar" even across genres or categories. A machine has no such intuition -- so how does it compute similarity?

## The Legacy Approach: Tags and Categorical Features

Early systems relied on explicit labels: "This film is tagged Action + Sci-Fi, that film is tagged Action + Thriller -- they share Action, so they're 60% similar."

The limitations? Labels are coarse-grained. Two items tagged "Business" might be completely different. And who assigns the labels? Manual taxonomy is expensive, inconsistent, and doesn't scale.

## The Modern Approach: Embeddings

Modern systems use **embeddings** -- mapping items (and users) into dense vector representations that capture their semantic "essence."

Imagine every song as a point in a multi-dimensional space:
- One dimension represents energy (calm to intense)
- Another represents mood (melancholic to euphoric)
- Another represents acoustic vs. electronic character

Two items close together in this space are similar -- even if they carry different categorical labels. A calm acoustic folk track might sit near a calm acoustic jazz recording.

### The Word2Vec Analogy

The intuition behind learned embeddings was popularized by **Word2Vec** (Mikolov et al., 2013), which showed that training a shallow neural network on word co-occurrence patterns produces vector representations where semantic relationships are encoded as geometric relationships. The famous example: $\text{vec}(\text{king}) - \text{vec}(\text{man}) + \text{vec}(\text{woman}) \approx \text{vec}(\text{queen})$.

The same principle applies to recommendation embeddings. Items that appear in similar behavioral contexts (consumed by the same users, in the same sessions) develop similar vector representations. This is the foundation of approaches like **Prod2Vec** (Grbovic et al., 2015), which applies Word2Vec's skip-gram model to product sequences.

## How Deep Learning Discovers These Representations

**Neural networks** learn embedding vectors by processing millions of interaction examples:

1. Feed the network pairs: "These two items were consumed by the same user in the same session" or "This image shares visual characteristics with that image"
2. The network learns to position similar items close together and dissimilar items far apart in the embedding space (typically optimized via contrastive loss or triplet loss)
3. After training, every item has a **vector** -- its coordinate in the learned similarity space

This is how Spotify's "Discover Weekly" identifies tracks you've never encountered that align with your taste. It's not matching genre labels -- it's matching the learned geometric *structure* of musical preference.

## Approximate Nearest Neighbor (ANN) Search

Once you have embeddings for millions of items, finding the closest ones to a given query vector is a nearest-neighbor search problem. Exact search is $O(n)$ -- too slow for millions of items in real time.

Production systems use **Approximate Nearest Neighbor** (ANN) algorithms that trade a small amount of accuracy for dramatic speed improvements:

- **HNSW** (Hierarchical Navigable Small World graphs): Builds a multi-layer graph structure enabling logarithmic search time. Used in libraries like FAISS and Hnswlib.
- **FAISS** (Facebook AI Similarity Search): Meta's library supporting multiple index types including IVF (Inverted File Index) with product quantization for billion-scale search.
- **ScaNN** (Google): Optimized for maximum inner product search with learned quantization.

These enable querying billions of embeddings in single-digit milliseconds -- making real-time embedding-based recommendations feasible at scale.

## Why This Addresses Cold Start

Modern recommender systems like [Recombee](https://www.recombee.com/blog/modern-recommender-systems-part-2-data) create embeddings from item descriptions, images, and user behavior simultaneously. This means a new item with just a title and description can immediately be positioned in the embedding space and matched to users who would appreciate it -- no interaction history needed.

**Why this matters**: When a recommendation feels remarkably well-calibrated -- as if the system genuinely understands your preferences -- it's because deep learning has identified the latent structure connecting your taste to new content. It's not reading your mind. It's reading millions of users' behavioral signals and discovering the mathematical geometry of preference. To learn more about how these techniques work in practice, see Recombee's overview of [AI and machine learning in recommender systems](https://www.recombee.com/how-it-works/ai-and-machine-learning).

![ANN Search](/images/diagram-ann-search.svg)
