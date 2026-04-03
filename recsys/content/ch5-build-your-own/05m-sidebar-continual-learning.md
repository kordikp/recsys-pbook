---
id: ch5-continual-learning
type: spine
title: "Continual Learning: Keeping Models Fresh Without Starting Over"
readingTime: 3
standalone: true
core: false
teaser: "Retraining from scratch every day is wasteful. Here's how production systems update incrementally."
voice: thinker
parent: null
diagram: null
recallQ: "What is the main challenge of incremental model updates?"
recallA: "Catastrophic forgetting — new data can overwrite patterns learned from historical data. Solutions include replay buffers, warm-starting, and scheduled full retrains."
status: accepted
---

A recommender system trained on yesterday's data is already slightly wrong today. User preferences shift, new items appear, trends emerge. But retraining a model from scratch every few hours is computationally expensive and wasteful — most of the learned patterns haven't changed.

**Continual learning** addresses this by updating models incrementally, preserving what's still valid while adapting to what's new.

## Why Not Just Retrain?

Full retraining has clear advantages: it's simple, reproducible, and guarantees a globally optimal solution given the data. But the costs scale poorly:

- **Computational:** Training ELSA on 100M items takes hours on GPU. Doing this hourly is prohibitive.
- **Data movement:** Shuffling terabytes of interaction data through training pipelines consumes bandwidth and storage.
- **Latency:** Users interacting right now won't see their behavior reflected until the next full retrain.

## Incremental Approaches

**Warm-starting SGD.** Instead of random initialization, start from the previous model's weights and train only on new data. Fast convergence, but risks overfitting to recent patterns.

**Online ALS updates.** For matrix factorization, new user interactions can update user factors without recomputing item factors. When a user interacts with a new item, solve a single ridge regression:

$$\mathbf{u}_i^{\text{new}} = (\mathbf{V}_i^T \mathbf{V}_i + \lambda\mathbf{I})^{-1} \mathbf{V}_i^T \mathbf{x}_i$$

This takes milliseconds per user — fast enough for real-time updates.

**Incremental embedding updates.** For embedding-based models, new items can be embedded using the existing model (e.g., beeFormer encodes text → embedding) without retraining the entire system. The ANN index is updated with the new embedding.

## Catastrophic Forgetting

The fundamental challenge: **new data can overwrite patterns learned from historical data.** If you only train on today's interactions, the model "forgets" stable long-term preferences.

This is especially dangerous for items with seasonal patterns. A model updated only on summer data will forget that users like holiday movies in December.

**Solutions:**

- **Replay buffers:** Mix new data with a random sample of historical data during each update. Typical ratio: 70% new, 30% historical.
- **Elastic Weight Consolidation (EWC):** Penalize large changes to weights that were important for previous tasks. Adds a regularization term proportional to the Fisher information matrix.
- **Progressive networks:** Keep old model frozen, add new capacity for new patterns. Prevents forgetting but grows model size.

## Practical Schedules

Most production systems use a hybrid approach:

| Update Type | Frequency | What Changes | Latency Impact |
|------------|-----------|-------------|----------------|
| Real-time | Per interaction | User factors, ANN index | Minutes |
| Incremental | Hourly | Model fine-tuning, new item embeddings | Hours |
| Full retrain | Daily/weekly | Complete model from scratch | Overnight |

**The cadence depends on domain:**
- **News:** Real-time updates are essential (content is stale in hours)
- **E-commerce:** Hourly incremental updates capture purchase intent
- **Music/video:** Daily retrains usually suffice (preferences evolve slowly)

## When to Fully Retrain

Incremental updates accumulate drift over time. Periodically, a full retrain "resets" the model to a globally optimal state. Triggers for full retrain include:

- Significant catalog changes (new category, major item removal)
- Model performance degradation beyond threshold
- Feature schema changes
- Scheduled cadence (weekly or monthly)

**Consider this:** The optimal update strategy is itself a research problem. Too-frequent updates chase noise; too-infrequent updates miss real shifts. The right cadence depends on how fast your domain changes — and the only way to know is to measure.