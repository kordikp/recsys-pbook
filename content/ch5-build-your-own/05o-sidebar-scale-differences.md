---
id: ch5-scale
type: spine
title: "Recommendation at Different Scales: Startup to Hyperscaler"
readingTime: 3
standalone: true
core: false
teaser: "The right approach for a 1,000-item catalog is completely wrong for a 100-million-item catalog. Scale changes everything."
voice: universal
parent: null
diagram: null
recallQ: "How does the optimal RecSys architecture change with scale?"
recallA: "Small: simple CF or popularity-based. Medium: matrix factorization + content features. Large: multi-stage pipeline with retrieval, scoring, and re-ranking. Each scale introduces new constraints."
status: accepted
---

A common mistake in recommendation engineering: designing for the wrong scale. The architecture that works for Netflix (15,000 titles) would fail catastrophically at YouTube (800M videos), and vice versa. Scale isn't just a performance concern — it fundamentally changes which algorithms, architectures, and trade-offs are appropriate.

## Small Scale: Startup (< 10K items, < 100K users)

**Typical domains:** Niche e-commerce, small SaaS platforms, internal content management.

**What works:**
- Popularity-based recommendations (surprisingly strong baseline)
- Item-based k-NN (co-occurrence or content similarity)
- Simple collaborative filtering (user-user or item-item)
- Manual curation and editorial picks

**What to avoid:**
- Matrix factorization (not enough data to learn meaningful latent factors)
- Deep learning (will overfit massively)
- Two-tower architectures (unnecessary complexity for small catalogs)

**Key insight:** At this scale, **data sparsity is extreme** — most users have interacted with < 1% of items. Focus on collecting more data, not building better models. Your biggest improvement will come from a better onboarding survey, not a fancier algorithm.

## Medium Scale: Growth Stage (10K–1M items, 100K–10M users)

**Typical domains:** Mid-size e-commerce, media companies, professional platforms.

**What works:**
- Matrix factorization (ALS, EASE) — enough data for meaningful factors
- Content-based features for cold-start handling
- Simple bandit exploration for new items
- A/B testing infrastructure becomes essential

**Architecture shift:** You now need to think about candidate generation vs. scoring as separate stages, but a single model can often handle both (score all items, take top-K).

**Key insight:** At this scale, **evaluation becomes critical**. You have enough users to run meaningful A/B tests, and offline metrics start to diverge from online performance. Invest in evaluation infrastructure.

## Large Scale: Enterprise (1M–100M items, 10M–1B users)

**Typical domains:** Major e-commerce, streaming platforms, social media.

**What works:**
- Two-tower models for candidate retrieval (ANN search over embeddings)
- Multi-stage pipeline: retrieval → scoring → re-ranking
- ELSA / deep models for scoring
- Contextual bandits for exploration
- Feature interaction models (DeepFM, DCN) for ranking

**Architecture shift:** You **cannot score all items** for every request. Candidate generation must narrow millions of items to hundreds, and this stage dominates latency and quality.

**Key insight:** At this scale, **infrastructure is the bottleneck**, not algorithms. Feature stores, embedding indexes, caching layers, and serving infrastructure determine what's possible more than model architecture.

## Hyperscale: Platform (100M+ items, 1B+ users)

**Typical domains:** YouTube, TikTok, Amazon, Spotify.

**What works:**
- Everything above, plus:
- CompresSAE for embedding compression (memory at this scale is prohibitive)
- Distributed training (models don't fit on one machine)
- Multi-objective optimization (engagement + diversity + fairness + revenue)
- Sophisticated evaluation (interleaving, counterfactual, multi-metric)

**Architecture shift:** Every component must be **distributed, fault-tolerant, and horizontally scalable**. Custom infrastructure replaces off-the-shelf tools.

**Key insight:** At hyperscale, **the system is the product**. The recommendation algorithm is inseparable from the serving infrastructure, monitoring systems, experimentation platform, and data pipeline. The best algorithm means nothing if it can't serve 100K requests per second with p99 latency under 200ms.

## The Scale Progression

| Scale | Primary Challenge | Primary Solution |
|-------|------------------|-----------------|
| Small | Data sparsity | More data collection, simple models |
| Medium | Model quality | Better algorithms, evaluation |
| Large | Serving latency | Multi-stage pipeline, ANN search |
| Hyperscale | System complexity | Infrastructure, compression, distributed systems |

**Consider this:** Most teams overengineer for their current scale — building YouTube-scale infrastructure for a 5,000-item catalog. The right question isn't "What does YouTube use?" but "What's the simplest thing that works at my scale?" You can always add complexity later. You can rarely remove it.