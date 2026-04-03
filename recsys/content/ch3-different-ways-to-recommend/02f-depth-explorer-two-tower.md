---
id: ch3-two-tower
type: spine
title: "The Two-Tower Architecture"
readingTime: 3
standalone: false
teaser: "How modern systems match users and items at scale using dual encoder networks -- the retrieval workhorse behind YouTube, Instagram, and TikTok."
voice: explorer
parent: null
diagram: diagram-two-tower
recallQ: "What are the two towers in the two-tower architecture?"
recallA: "A user encoder (processes interaction history, demographics, context) and an item encoder (processes title, category, features). Both produce embeddings in the same vector space -- proximity indicates relevance."
highlights:
  - "Dual encoder: user tower and item tower produce embeddings in the same space"
  - "Item embeddings are pre-computed; only user embedding is computed per request"
  - "Enables retrieval from millions of items in single-digit milliseconds"
status: accepted
---

You understand how embeddings map items to vectors where similar items cluster together. But how do you match a USER to relevant items -- not just compute item-item similarity?

## Dual Encoder Architecture

The **two-tower architecture** (also called dual encoder) is one of the most widely deployed retrieval architectures at companies like YouTube (Covington et al., 2016), Instagram, Pinterest, and TikTok. The key idea:

- **User Tower**: A neural network that ingests user features -- interaction history, demographics, temporal patterns, device context -- and produces a single embedding vector.
- **Item Tower**: A separate neural network that ingests item features -- title, description, category, visual features, metadata -- and produces an embedding vector of the same dimensionality.

Both towers output vectors in the **same learned space**. If a user vector is geometrically close to an item vector, the system predicts relevance (high engagement probability).

## Why Decouple the Encoders?

The architectural separation is the key design insight:

1. **Serving efficiency**: Item embeddings can be **pre-computed offline** and indexed (using ANN structures like HNSW or ScaNN). At request time, only the user embedding needs to be computed fresh -- then it's a nearest-neighbor lookup against the pre-built item index. This takes milliseconds, even over hundreds of millions of items.

2. **Scale**: YouTube has 800+ million videos. Scoring each one individually with a cross-attention model is computationally intractable. But searching a pre-built ANN index for the nearest items to a user embedding is sublinear in the corpus size.

3. **Real-time adaptation**: The user embedding changes with every interaction (new watch, new click). The item embeddings remain stable between periodic re-indexing. So the system only needs to update one side in real time.

## Training Setup

During training, the model sees millions of (user, item) interaction pairs. For each positive example ("User A watched Video X"), the loss function pulls the user and item embeddings closer together. For negative examples (typically in-batch negatives or hard negatives), it pushes them apart.

Common loss functions include:
- **Softmax cross-entropy** over in-batch negatives
- **Triplet loss**: $\max(0, d(u, i^+) - d(u, i^-) + \text{margin})$
- **Sampled softmax** for computational efficiency at scale

After training, the two towers can operate **independently** at serving time -- that's the source of the massive latency advantage.

## Serving Infrastructure

A typical production serving stack:

1. **User tower**: Runs online, computing a fresh user embedding per request (~1-5ms)
2. **Item index**: Pre-built ANN index (FAISS, ScaNN, or Milvus) containing embeddings for all items, rebuilt periodically (hourly or daily)
3. **ANN retrieval**: Queries the index for the top-k nearest items (~1-10ms for millions of items)
4. **Result**: ~100-500 candidate items retrieved in under 20ms total

## The Accuracy-Latency Tradeoff

Two-tower models trade some accuracy for massive speed gains. Because the user and item representations are computed independently, the model cannot capture fine-grained user-item feature interactions (e.g., "this specific user responds to this specific thumbnail style"). Cross-attention models can capture such interactions but are too expensive to run over the full corpus.

That's why production systems use two-tower models for **retrieval** (finding 500 candidates from millions) and then a more expressive cross-feature model for **ranking** (ordering those 500 by predicted engagement). This staged architecture -- fast retrieval followed by precise ranking -- is the standard pattern at scale.
