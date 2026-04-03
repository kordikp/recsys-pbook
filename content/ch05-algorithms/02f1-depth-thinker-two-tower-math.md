---
id: ch3-two-tower-math
type: spine
title: "Two-Tower Architecture: Training, Serving, and the Mathematics of Scale"
readingTime: 5
standalone: false
core: false
voice: thinker
parent: ch3-two-tower
publishedAt: "2026-04-03"
status: accepted
---

The two-tower architecture achieves its scalability through a single structural commitment: **the independence assumption**. The user encoder and item encoder never share intermediate representations at inference time. This means the item tower's output for a given item is identical regardless of which user is being scored -- and that invariance is what makes the entire serving infrastructure possible.

This section formalizes the training objectives, negative sampling strategies, and approximate nearest neighbor algorithms that make two-tower retrieval practical at the scale of hundreds of millions of items.

## The Independence Assumption

![Two-tower architecture with user and item towers converging to similarity score](/images/diagram-two-tower-architecture.svg)

In a general scoring model, relevance is a function of the joint input:

$$s(u, i) = f(x_u, x_i)$$

where $f$ can model arbitrary interactions between user features $x_u$ and item features $x_i$. A cross-attention model, for instance, computes representations where each user token attends to each item token -- powerful, but $O(n)$ forward passes are required to score $n$ items.

The two-tower model restricts $f$ to a **factored form**:

$$s(u, i) = g_\theta(x_u)^T h_\phi(x_i) = \mathbf{e}_u^T \mathbf{e}_i$$

where $g_\theta$ and $h_\phi$ are independent neural networks (the "towers") producing $d$-dimensional embeddings. The score is their dot product (or cosine similarity).

This factorization is the source of both the architecture's power and its limitation:

- **Power**: Item embeddings $\mathbf{e}_i = h_\phi(x_i)$ can be computed once and cached. Retrieval becomes a nearest-neighbor search in $\mathbb{R}^d$.
- **Limitation**: The model cannot learn features like "this user responds to red thumbnails" -- any interaction between user features and item features must be captured entirely through the geometry of the shared embedding space.

## Training Objectives

### Softmax Cross-Entropy

The most common formulation treats retrieval as a classification problem. Given a user $u$ with a positive item $i^+$ and a set of candidate items $\{i_1, i_2, \ldots, i_K\}$ (where $i_1 = i^+$), the loss is:

$$\mathcal{L} = -\log \frac{\exp(s(u, i^+))}{\sum_{j=1}^{K} \exp(s(u, i_j))}$$

where $s(u, i) = \mathbf{e}_u^T \mathbf{e}_i / \tau$ and $\tau$ is a temperature hyperparameter controlling the sharpness of the distribution. Lower $\tau$ amplifies differences between scores, making the softmax peakier.

The gradient pushes $\mathbf{e}_u$ toward $\mathbf{e}_{i^+}$ and away from all negative items $i_j$, with the magnitude of each repulsive gradient proportional to the softmax probability assigned to that negative. This means **hard negatives** (items the model incorrectly scores highly) receive larger gradient signals -- a desirable property.

### Triplet Loss (Margin-Based)

Triplet loss operates on $(u, i^+, i^-)$ triples directly:

$$\mathcal{L} = \max(0,\; d(u, i^+) - d(u, i^-) + m)$$

where $d$ is a distance function (typically $d(u, i) = \|\mathbf{e}_u - \mathbf{e}_i\|_2$ or $d(u, i) = 1 - \cos(\mathbf{e}_u, \mathbf{e}_i)$) and $m > 0$ is the margin.

The loss is zero when the positive is closer than the negative by at least margin $m$. Key properties:

- Triplet loss only considers pairwise ordering, not absolute scores
- It requires careful triplet selection -- random triplets are often trivially satisfied (loss = 0), producing zero gradients
- Semi-hard mining (select negatives where $d(u, i^+) < d(u, i^-) < d(u, i^+) + m$) provides the most useful training signal

### Sampled Softmax

Full softmax over the entire item catalog is computationally prohibitive. With $N$ items, each training step would require $N$ dot products. **Sampled softmax** approximates the denominator by sampling $K \ll N$ negative items:

$$\mathcal{L} \approx -\log \frac{\exp(s(u, i^+))}{\exp(s(u, i^+)) + \sum_{j=1}^{K} \exp(s(u, i_j^-))}$$

To correct for sampling bias, each negative's score is adjusted by the log of its sampling probability:

$$\tilde{s}(u, i_j^-) = s(u, i_j^-) - \log Q(i_j^-)$$

where $Q(i_j^-)$ is the probability of sampling item $i_j^-$. This correction ensures that the gradient is an unbiased estimator of the full softmax gradient (Bengio & Senécal, 2003). Without it, frequently sampled items accumulate disproportionate repulsive gradients.

### In-Batch Negatives

A computationally elegant technique: within a training batch of $B$ (user, item) pairs, treat every other item in the batch as a negative for each user. This produces $B-1$ negatives per example at zero additional compute cost for embedding computation.

Given a batch with user embeddings $\mathbf{E}_U \in \mathbb{R}^{B \times d}$ and item embeddings $\mathbf{E}_I \in \mathbb{R}^{B \times d}$, the score matrix is:

$$S = \mathbf{E}_U \mathbf{E}_I^T \in \mathbb{R}^{B \times B}$$

The loss for user $k$ is:

$$\mathcal{L}_k = -\log \frac{\exp(S_{kk} / \tau)}{\sum_{j=1}^{B} \exp(S_{kj} / \tau)}$$

The diagonal entries $S_{kk}$ are positive pairs; off-diagonal entries are negatives. This formulation is highly GPU-efficient since the entire score matrix is computed with a single matrix multiplication.

**Caveat**: In-batch negatives are biased toward popular items (popular items appear more frequently in batches). This requires popularity-based correction (see below).

## Negative Sampling Strategies

The choice of negatives profoundly affects model quality. Poor negatives provide trivial training signal; overly hard negatives can destabilize training.

### Random Negatives

Sample items uniformly from the catalog. Simple and unbiased, but most random negatives are trivially distinguishable from the positive (e.g., a children's cartoon vs. a documentary for an adult user). The model learns quickly to distinguish gross mismatches but receives diminishing signal as training progresses.

### Hard Negative Mining

Select negatives that are close to the positive in embedding space -- items the model currently struggles to distinguish from the true positive. Methods include:

- **ANN-based mining**: Use the current model to retrieve the top-$k$ nearest items to the user and sample negatives from them (excluding the positive)
- **Cross-batch memory**: Maintain a memory bank of recent embeddings and select hard negatives from it (He et al., 2020)
- **Offline mining**: Periodically run the model over the corpus, identify confusing pairs, and construct hard-negative training sets

Hard negatives provide strong gradient signal but can be noisy (a "hard negative" may actually be a relevant item the user hasn't interacted with yet). Excessive hard negative mining can cause the model to overfit to boundary cases.

### Mixed Negatives (Random + Hard)

The most common production strategy combines both:

- Sample $K_r$ random negatives (ensures broad coverage of the embedding space)
- Sample $K_h$ hard negatives (provides focused training signal at decision boundaries)

Typical ratios range from 50-80% random and 20-50% hard negatives. Google's work on YouTube recommendations (Yang et al., 2020) found that mixing strategies consistently outperform either extreme.

### Popularity-Based Sampling Correction

When negatives are sampled proportionally to item frequency (as with in-batch negatives), popular items are overrepresented as negatives. This biases the model to push user embeddings away from popular items, underranking them.

The correction applies a log-frequency weight:

$$\tilde{s}(u, i_j^-) = s(u, i_j^-) - \beta \log p(i_j)$$

where $p(i_j)$ is the item's frequency in the training data and $\beta$ is a tunable hyperparameter (typically $\beta \in [0.5, 1.0]$). At $\beta = 1.0$, this exactly cancels the frequency bias under log-uniform sampling.

## Approximate Nearest Neighbor Search

At serving time, finding the exact nearest neighbors to a user embedding among $n$ items (each $d$-dimensional) requires brute-force computation of all $n$ dot products. The following algorithms trade small recall losses for orders-of-magnitude speedup.

### Complexity Comparison

| Algorithm | Query Time | Build Time | Memory | Recall@100 | Best For |
|-----------|-----------|------------|--------|------------|----------|
| Brute Force | $O(nd)$ | $O(nd)$ | $O(nd)$ | 100% | $n < 10^5$, exact results |
| HNSW | $O(\log n)$ | $O(n \log n)$ | $O(nd + nm)$ | 95-99% | Low-latency, moderate memory budget |
| ScaNN | $O(n/p + k'd)$ | $O(nd)$ | $O(n \cdot d/s)$ | 95-99% | Large-scale with quantization |
| FAISS IVF+PQ | $O((n/c) \cdot d/s)$ | $O(nd)$ | $O(n \cdot d/s + cd)$ | 90-98% | Billion-scale, memory-constrained |

Variables: $n$ = corpus size, $d$ = embedding dimension, $m$ = max connections per node (HNSW), $p$ = number of partitions (ScaNN), $k'$ = re-scoring candidates, $s$ = compression ratio (PQ), $c$ = number of clusters (IVF).

### Brute Force: $O(nd)$

Compute the dot product between the query vector and every item vector. Exact but prohibitively slow at scale. For $n = 10^8$ items and $d = 256$, a single query requires ~25 billion FLOPs. Even on modern hardware, this takes hundreds of milliseconds -- far too slow for real-time serving.

### HNSW (Hierarchical Navigable Small World)

HNSW (Malkov & Yashunin, 2018) builds a multi-layer graph where each node is an item embedding and edges connect nearby points.

**Structure**:
- Layer 0 contains all $n$ items, with each node connected to its $M$ nearest neighbors
- Higher layers contain geometrically decreasing subsets of nodes (skip-list structure)
- The top layer contains $O(\log n)$ nodes

**Query procedure**:
1. Enter the graph at the top layer
2. Greedily traverse to the nearest node in each layer
3. Descend to the next layer, using the arrival node as the starting point
4. At layer 0, perform a beam search with beam width $ef$ to find the $k$ nearest neighbors

**Complexity**: $O(\log n)$ query time in practice (each layer traversal is $O(1)$ amortized). Build time is $O(n \log n)$ since each insertion traverses the hierarchy. Memory overhead is the graph structure: $O(nm)$ edges in addition to the $O(nd)$ vectors.

**Trade-off knobs**: $M$ (connections per node) and $ef$ (search beam width) control the recall-latency trade-off. Higher values improve recall but increase latency and memory.

### ScaNN (Score-Aware Nearest Neighbors)

Google's ScaNN (Guo et al., 2020) introduces **anisotropic vector quantization**: it quantizes vectors in a way that prioritizes preserving the inner product (score) rather than minimizing reconstruction error in $\ell_2$ distance.

**Two-phase approach**:
1. **Coarse quantization**: Partition the space and use quantized representations to cheaply score all items, selecting the top $k'$ candidates (where $k' \gg k$)
2. **Re-scoring**: Compute exact dot products for the $k'$ candidates using their original uncompressed vectors

The score-aware quantization ensures that errors in the compressed representation are concentrated in directions orthogonal to the query, preserving ranking accuracy. ScaNN consistently achieves state-of-the-art recall-vs-latency curves on standard ANN benchmarks.

### FAISS: IVF + PQ

Facebook's FAISS (Johnson et al., 2019) combines two techniques:

**Inverted File Index (IVF)**:
- Cluster the $n$ item vectors into $c$ clusters (typically $c \approx \sqrt{n}$) using $k$-means
- At query time, find the nearest $p$ clusters (probes) and only score items within those clusters
- Reduces candidates from $n$ to approximately $pn/c$

**Product Quantization (PQ)**:
- Split each $d$-dimensional vector into $d/s$ sub-vectors
- Quantize each sub-vector independently to its nearest centroid from a learned codebook (typically 256 centroids per sub-space)
- Store each item as $d/s$ bytes instead of $d$ floats -- a compression ratio of $4s : 1$

The combination IVF+PQ first narrows the candidate set via cluster pruning, then scores candidates using compressed representations. The distance computation operates on lookup tables rather than raw vectors, providing further speedup.

**Trade-off knobs**: Number of probes $p$ (more probes = higher recall, more compute), number of sub-quantizers $d/s$, and codebook size.

### Recall vs. Latency vs. Memory Trade-offs

The fundamental tension in ANN search:

| Optimization | Cost |
|-------------|------|
| Higher recall | Increased latency (more candidates scored) |
| Lower latency | Reduced recall (fewer candidates considered) |
| Lower memory | Reduced recall (lossy compression) |
| Exact results | Brute-force compute ($O(nd)$ per query) |

Production systems typically target **95%+ recall@100** (95% of the true top-100 items appear in the retrieved set) while keeping **query latency under 10ms** for corpora of $10^7$--$10^9$ items.

## Serving Infrastructure

### Latency Breakdown

A production two-tower retrieval system decomposes into distinct stages with characteristic latencies:

| Stage | Computation | Typical Latency | Frequency |
|-------|------------|-----------------|-----------|
| Item embedding | $h_\phi(x_i)$ for all items | Minutes--hours | Offline (periodic) |
| Index construction | Build ANN structure from item embeddings | Minutes--hours | Offline (periodic) |
| User embedding | $g_\theta(x_u)$ for the requesting user | 1--5 ms | Online (per request) |
| ANN retrieval | Query the index for top-$k$ nearest items | 1--10 ms | Online (per request) |
| **Total online latency** | | **2--15 ms** | **Per request** |

### Pre-Computing Item Embeddings (Offline)

The item tower runs a batch inference job over the full catalog:

1. Extract features for all $n$ items (title text, category, image features, metadata)
2. Run the item tower $h_\phi$ to produce $n$ embeddings of dimension $d$
3. Store embeddings in a vector database or file system

For $n = 10^8$ items and $d = 256$, the embedding table is ~100 GB in float32. This job runs periodically (hourly to daily) or is triggered by catalog updates. New items can be embedded incrementally without reprocessing the full catalog.

### User Embedding Computation (Online)

For each incoming request, the user tower $g_\theta$ computes a fresh embedding:

1. Fetch the user's recent interaction history and context features
2. Run the user tower forward pass (typically a lightweight model: MLP or shallow transformer)
3. Output a $d$-dimensional user embedding

This must complete in single-digit milliseconds. The user tower is typically smaller and faster than the item tower because it runs on the critical serving path.

### ANN Index Construction and Updates

The ANN index is built from the pre-computed item embeddings:

1. **Full rebuild**: Reconstruct the entire index from scratch (required when the embedding model changes)
2. **Incremental updates**: Add or remove individual items (supported by HNSW; more complex for IVF-based indices that rely on cluster structure)

Index rebuild frequency depends on how quickly the catalog changes. A news platform might rebuild hourly; a movie catalog might rebuild daily. Stale indices mean newly added items are invisible to retrieval until the next rebuild -- a cold-start problem at the infrastructure level.

## The Key Limitation: No Cross-Attention

The factored scoring function $s(u, i) = \mathbf{e}_u^T \mathbf{e}_i$ means user and item representations are computed in complete isolation. The model cannot learn:

- Feature interactions ("users who watched horror films prefer dark thumbnails")
- Conditional representations ("represent this item differently depending on whether the user is a genre enthusiast or a casual browser")
- Fine-grained matching ("this specific paragraph in the item description matches this user's demonstrated expertise level")

Cross-attention models can capture all of these by computing $s(u, i) = f(\text{CrossAttn}(x_u, x_i))$, but they require a full forward pass for every $(u, i)$ pair -- computationally intractable for retrieval over millions of items.

This is precisely why production systems adopt a **two-stage architecture**: the two-tower model retrieves hundreds of candidates efficiently, and a more expressive cross-feature ranking model (which can afford to score hundreds, not millions) re-orders them.

## References

- Covington, P., Adams, J., & Sargin, E. (2016). "Deep Neural Networks for YouTube Recommendations." *Proceedings of the 10th ACM Conference on Recommender Systems*.
- Yang, J., Yi, X., Zhiyuan Cheng, D., et al. (2020). "Mixed Negative Sampling for Learning Two-Tower Neural Networks in Recommendations." *Companion Proceedings of the Web Conference 2020*.
- Malkov, Y. A., & Yashunin, D. A. (2018). "Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs." *IEEE Transactions on Pattern Analysis and Machine Intelligence*.
- Guo, R., Sun, P., Lindgren, E., et al. (2020). "Accelerating Large-Scale Inference with Anisotropic Vector Quantization." *Proceedings of the 37th International Conference on Machine Learning*.
- Johnson, J., Douze, M., & Jegou, H. (2019). "Billion-scale similarity search with GPUs." *IEEE Transactions on Big Data*.
- Bengio, Y., & Senecal, J.-S. (2003). "Quick Training of Probabilistic Neural Nets by Importance Sampling." *AISTATS*.
- Kang, W. C., & McAuley, J. (2018). "Self-Attentive Sequential Recommendation." *IEEE International Conference on Data Mining*.
