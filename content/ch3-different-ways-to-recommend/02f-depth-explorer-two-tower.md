---
id: ch3-two-tower
type: spine
title: "The Two-Tower Architecture"
readingTime: 3
standalone: false
teaser: "How modern systems match users and items at blazing speed using two separate neural networks."
voice: explorer
parent: null
diagram: diagram-two-tower
recallQ: "What are the two towers in the two-tower architecture?"
recallA: "One tower encodes users (their history, demographics, context) and one encodes items (title, category, image). Both produce embeddings in the same space — close = good match."
status: accepted
---

You know how embeddings turn items into lists of numbers and similar items end up close together. But how do you find matches for a USER — not just between items?

## Two Separate Networks

The **two-tower architecture** is one of the most popular designs at companies like YouTube, Instagram, and TikTok. Here's the key idea:

- **User Tower**: A neural network that takes everything about you — what you watched, when you watch, what device you use — and produces a single embedding (a list of numbers).
- **Item Tower**: A separate neural network that takes everything about a video — its title, description, category, thumbnail — and produces an embedding of the same size.

Both towers output vectors in the **same space**. If your user vector is close to a video's item vector, the system predicts you'll like it.

## Why Two Towers?

The genius is in the separation:

1. **Speed**: Item embeddings can be pre-computed and stored. When you open the app, only YOUR embedding needs to be calculated fresh — then it's just a nearest-neighbor search in the pre-built index. This takes milliseconds, not seconds.

2. **Scale**: YouTube has 800 million videos. You can't score each one individually. But you CAN search a pre-built index of item embeddings for the closest matches to your user embedding.

3. **Real-time**: Your user embedding changes with every click. The item embeddings stay stable. So the system only needs to update one side.

## How It's Trained

During training, the system sees millions of examples: "User A watched Video X." It adjusts both towers so that the user embedding and item embedding end up close together for positive examples, and far apart for negative ones.

After training, the two towers can work independently — that's why it's so fast in production.

## The Tradeoff

Two-tower models are incredibly fast but slightly less accurate than models that look at user-item pairs together. That's why real systems use two-tower for the initial **retrieval** (finding 500 candidates from millions) and then a more precise model for **ranking** (ordering those 500).
