---
id: ch7-production-scale
type: spine
title: "Production at Scale: From Papers to Billions of Interactions"
readingTime: 4
standalone: true
core: true
teaser: "Research algorithms must survive the harsh reality of production: latency budgets, memory limits, and billions of daily interactions."
voice: universal
parent: null
diagram: null
recallQ: "How does CompresSAE achieve 12× embedding compression with minimal quality loss?"
recallA: "A sparse autoencoder compresses dense embeddings using top-k sparsification. The kernel trick enables O(k²) retrieval on sparse codes instead of O(d) on dense vectors. Result: 307 GB → 26 GB with only 1.35% CTR loss."
highlights:
  - "CompresSAE: 12x embedding compression (307 GB to 26 GB), only 1.35% CTR loss"
  - "Sparse ELSA gets slightly better accuracy than dense -- sparsity regularizes"
  - "Mathematical elegance in research translates to robustness in production"
publishedAt: "2026-04-03"
status: accepted
---

A research algorithm that works on a benchmark dataset and a production system serving billions of interactions daily are very different things. The gap between "achieves state-of-the-art nDCG on MovieLens" and "serves 500+ customers across 40 countries in under 200 milliseconds" is enormous.

This section examines what it takes to bridge that gap.

## The Production Constraints

Production recommender systems operate under constraints that benchmark papers rarely address:

**Latency:** Users expect results in under 200ms. A two-tower model that takes 500ms to score candidates is useless regardless of its accuracy.

**Memory:** 100 million items × 768-dimensional embeddings = **307 GB** of raw embedding storage. That's before considering user embeddings, feature stores, or model weights.

**Throughput:** Recombee processes billions of interactions daily across hundreds of customers, each with different catalog sizes, interaction patterns, and business rules. See [how Recombee achieves performance at scale](https://www.recombee.com/how-it-works/performance-at-scale).

**Reliability:** A research prototype that crashes once a week is fine. A production system with 99.9% SLA cannot afford that — 0.1% downtime is 8.7 hours per year.

## CompresSAE: Solving the Memory Problem

[CompresSAE](https://github.com/recombee/CompresSAE) (RecSys 2025) addresses the memory bottleneck with a sparse autoencoder that compresses dense item embeddings:

**The encoder:**
$$\mathbf{s} = \phi(\mathbf{W}_{\text{enc}} \bar{\mathbf{x}} + \mathbf{b}_{\text{enc}}, k)$$

where φ(·, k) is a top-k sparsification operator — keep only the k largest absolute values, preserving their signs. The input x̄ is L2-normalized.

**The decoder:** Linear, bias-free, with row-normalized weights:
$$\hat{\mathbf{x}} = \mathbf{W}_{\text{dec}} \mathbf{s}$$

**The loss:** Cosine similarity (not MSE), computed at two sparsity levels:
$$\mathcal{L} = \mathcal{L}_{\text{cos}}^{(k)} + \mathcal{L}_{\text{cos}}^{(4k)}$$

The dual-sparsity loss prevents dead neurons — dimensions that never activate during training.

**The kernel trick for fast retrieval:** Instead of decompressing both vectors and computing similarity in the original space (O(d)), use the precomputed kernel matrix:

$$\cos(\mathbf{x}, \mathbf{y}) \approx \frac{\mathbf{s}_x^\top \mathbf{K} \mathbf{s}_y}{\sqrt{\mathbf{s}_x^\top \mathbf{K} \mathbf{s}_x} \cdot \sqrt{\mathbf{s}_y^\top \mathbf{K} \mathbf{s}_y}}$$

where **K** = W_dec^T W_dec is precomputed. Since s_x and s_y are k-sparse, the products touch only k×k entries of K → **O(k²) complexity** instead of O(d).

**Results:**
| Representation | CTR Impact | Memory |
|---------------|-----------|--------|
| Dense (768-dim) | +4.86% | 307 GB |
| CompresSAE | +3.44% | 26 GB |

**12× compression with only 1.35% CTR loss.** Training takes 15 seconds on an H100 GPU.

## Sparse ELSA: Interpretable Compression

Sparse ELSA takes a different approach: instead of compressing dense embeddings post-hoc, it learns **intrinsically sparse** embeddings during training.

The method uses a top-k sparsification schedule with exponential decay: start with dense embeddings, then gradually prune during training:

$$k_t = k_{\max} \cdot \exp(-\gamma \cdot t)$$

**Performance:** 10× compression with minimal loss (nDCG@100: 0.489 → 0.491 — actually *slightly better* than the dense version due to the regularization effect of sparsification).

**Interpretability bonus:** The sparse factors naturally correspond to semantic categories — children's classics, detective fiction, science fiction romance — emerging purely from interaction data without any metadata input.

## The Real-World System Architecture

In production at Recombee, these components integrate as follows:

1. **Offline training:** ELSA embeddings computed from the full interaction matrix (batch, typically nightly)
2. **Cold-start path:** beeFormer generates initial embeddings from text/images
3. **Embedding compression:** CompresSAE reduces storage for ANN index
4. **Online serving:** Two-tower retrieval (candidate generation) → ELSA/VASP scoring → bandit-based exploration slots → business rule re-ranking
5. **Evaluation:** LLOO+β offline metrics → A/B testing for final deployment decisions

The total latency budget is under 200ms, split roughly:
- Candidate retrieval (ANN search): ~50ms
- Scoring and re-ranking: ~100ms
- Business rules and filtering: ~30ms
- Network overhead: ~20ms

## The Telegraph Case Study

A compelling real-world application: The Daily Telegraph uses sparse autoencoders to map articles to semantic "neurons," which an LLM then describes. Editors see real-time analytics showing which reader segments engage with specific topics — Labour/Tax policy, F1 Racing, Tory Politics, Justice, Middle East.

This is recommendation infrastructure being used not just for serving readers, but for **understanding audience behavior** at a level that was previously impossible.

> **Research publications:** See the [full list of Recombee research publications](https://www.recombee.com/research-publications).
> - Kasalický et al., "[CompresSAE: Embedding Compression via Sparse Autoencoders](https://dl.acm.org/doi/full/10.1145/3705328.3748147)," RecSys 2025.
> - Vančura et al., "[Sparse ELSA](https://www.recombee.com/research-publications)," WWW 2026.
> - Telegraph case study, [INRA@RecSys 2025](https://www.recombee.com/research-publications).

**Consider this:** The gap between research and production is where most algorithms die. The ones that survive are typically those with strong mathematical properties (closed-form solutions, provable guarantees, interpretable structure) — because these properties translate directly into engineering virtues (efficiency, predictability, debuggability). Elegance in mathematics often corresponds to robustness in production.