---
id: ch3-feature-interactions
type: spine
title: "Feature Interaction Models: From Factorization Machines to Deep Cross Networks"
readingTime: 5
standalone: false
core: false
voice: thinker
parent: ch3-deep-similarity
publishedAt: "2026-04-03"
status: accepted
---

Matrix factorization captures interactions between users and items -- but what about interactions between *features*? A 25-year-old male who watches sci-fi on weekday evenings is a very different signal than any of those features alone. The challenge is modeling these combinatorial feature interactions efficiently and at scale.

## Why Feature Interactions Matter

Consider a simple linear model for click-through rate prediction:

$$\hat{y} = w_0 + \sum_{i=1}^{n} w_i x_i$$

This model treats each feature independently. It can learn that "sci-fi" is generally popular or that "male users" click more on average -- but it completely misses the *conjunction*: "young males who like sci-fi and are browsing late at night."

### The Manual Feature Engineering Problem

The traditional solution is **feature crossing**: explicitly creating new features like `gender_x_genre` or `age_bucket_x_time_of_day_x_category`. But this approach has severe limitations:

- **Combinatorial explosion**: With $n$ features, there are $\binom{n}{2}$ pairwise interactions, $\binom{n}{3}$ three-way interactions, and so on
- **Sparsity**: High-order crosses produce extremely sparse features with few training examples per combination
- **Domain expertise**: Engineers must decide *which* crosses matter -- a labor-intensive, error-prone process
- **No generalization**: An unseen combination (e.g., a new genre-age pairing) gets zero signal

What we need are models that learn feature interactions *automatically* from data.

## Factorization Machines (FM)

**Factorization Machines** (Rendle, 2010) elegantly solve the sparsity problem of pairwise feature interactions by factorizing the interaction weight matrix.

### The FM Formulation

Instead of learning an independent weight $w_{ij}$ for every feature pair $(i, j)$, FM represents each feature $i$ with a latent vector $\mathbf{v}_i \in \mathbb{R}^k$ and models interactions via inner products:

$$\hat{y} = w_0 + \sum_{i=1}^{n} w_i x_i + \sum_{i=1}^{n} \sum_{j=i+1}^{n} \langle \mathbf{v}_i, \mathbf{v}_j \rangle x_i x_j$$

where $\langle \mathbf{v}_i, \mathbf{v}_j \rangle = \sum_{f=1}^{k} v_{i,f} \cdot v_{j,f}$ is the dot product of the two latent vectors.

### Why This Works

The key insight is parameter sharing through factorization:

- **Full interaction matrix**: Learning all pairwise weights requires $\binom{n}{2}$ parameters -- infeasible for sparse, high-dimensional feature spaces (e.g., one-hot encoded user IDs)
- **Factorized interactions**: FM uses only $n \times k$ parameters (one $k$-dimensional vector per feature), where $k \ll n$
- **Generalization to unseen pairs**: Even if features $i$ and $j$ never co-occur in training data, their interaction weight $\langle \mathbf{v}_i, \mathbf{v}_j \rangle$ is estimated through each feature's interactions with *other* features

### Efficient Computation

The naive computation of all pairwise interactions is $O(kn^2)$. Rendle showed this can be reformulated to $O(kn)$:

$$\sum_{i=1}^{n} \sum_{j=i+1}^{n} \langle \mathbf{v}_i, \mathbf{v}_j \rangle x_i x_j = \frac{1}{2} \sum_{f=1}^{k} \left[ \left( \sum_{i=1}^{n} v_{i,f} x_i \right)^2 - \sum_{i=1}^{n} v_{i,f}^2 x_i^2 \right]$$

This linear-time computation makes FM practical for real-time serving with millions of sparse features -- precisely the setting of click-through rate prediction with categorical features like user ID, item ID, context, and demographics.

## DeepFM: Combining FM with Deep Networks

**DeepFM** (Guo et al., 2017) addresses a fundamental limitation of FM: it only models *second-order* (pairwise) feature interactions. Higher-order interactions like "young + male + sci-fi + late-night" require stacking multiple FM layers or exponentially more parameters.

DeepFM's architecture combines two parallel components:

### FM Component (Low-Order Interactions)

The FM component models explicit pairwise interactions exactly as described above, capturing structured low-order feature interactions with mathematical precision.

### Deep Component (High-Order Interactions)

A deep neural network (DNN) takes the same input features and learns implicit, high-order feature interactions through its hidden layers:

$$\mathbf{a}^{(l+1)} = \sigma(\mathbf{W}^{(l)} \mathbf{a}^{(l)} + \mathbf{b}^{(l)})$$

where $\sigma$ is typically ReLU. Each hidden layer implicitly combines features, enabling the network to learn complex interaction patterns that are difficult to specify manually.

### Shared Embedding

The critical design choice in DeepFM is that the FM component and the deep component **share the same feature embedding layer**. This means:

- The embedding vectors $\mathbf{v}_i$ used for FM interactions are the *same* vectors fed into the DNN
- Both components jointly influence the embeddings during backpropagation
- No separate feature engineering is needed for either component

The final prediction combines both:

$$\hat{y} = \sigma(y_{\text{FM}} + y_{\text{DNN}})$$

This end-to-end architecture eliminates the need for manual feature engineering while capturing both low-order and high-order interactions.

## Deep & Cross Network (DCN)

**Deep & Cross Network** (Wang et al., 2017) takes a different approach: instead of relying on implicit interaction learning through dense layers, it introduces an explicit **cross network** that models feature interactions in a structured, bounded-degree manner.

### The Cross Network

The cross network applies the following update at each layer $l$:

$$\mathbf{x}_{l+1} = \mathbf{x}_0 \mathbf{x}_l^T \mathbf{w}_l + \mathbf{b}_l + \mathbf{x}_l$$

where:
- $\mathbf{x}_0$ is the original input (always re-introduced)
- $\mathbf{x}_l$ is the output of the current layer
- $\mathbf{w}_l$ and $\mathbf{b}_l$ are learned parameters
- The term $\mathbf{x}_0 \mathbf{x}_l^T \mathbf{w}_l$ creates explicit feature crosses

### Bounded-Degree Polynomial Interactions

A cross network with $L$ layers models feature interactions up to degree $L + 1$. This is powerful because:

- **Layer 1**: Captures pairwise interactions ($x_i \cdot x_j$)
- **Layer 2**: Captures three-way interactions ($x_i \cdot x_j \cdot x_k$)
- **Layer $L$**: Captures $(L+1)$-way interactions

Each cross layer adds only $O(d)$ parameters (where $d$ is the input dimension), making the cross network extremely parameter-efficient compared to a DNN of equivalent expressiveness for polynomial interactions.

### Full DCN Architecture

The complete DCN runs the cross network and a deep network in parallel, then combines their outputs:

$$\hat{y} = \sigma(\mathbf{w}_{\text{logit}}^T [\mathbf{x}_{\text{cross}}, \mathbf{x}_{\text{deep}}] + b_{\text{logit}})$$

The cross network handles explicit, structured interactions; the deep network handles implicit, complex patterns.

### DCN-V2

The updated **DCN-V2** (Wang et al., 2021) replaces the vector $\mathbf{w}_l$ with a full matrix $\mathbf{W}_l$, significantly increasing the expressiveness of each cross layer at the cost of more parameters. It also introduces a "stacked" variant where the cross network feeds into the deep network sequentially, rather than running in parallel.

## Wide & Deep Learning

**Wide & Deep** (Cheng et al., 2016) was developed at Google for the Google Play Store and addresses a fundamental tension in recommendation: **memorization** vs. **generalization**.

### The Wide Component (Memorization)

The wide component is a generalized linear model operating on raw input features *and* manually designed cross-product transformations:

$$y_{\text{wide}} = \mathbf{w}_{\text{wide}}^T [\mathbf{x}, \boldsymbol{\phi}(\mathbf{x})] + b$$

where $\boldsymbol{\phi}(\mathbf{x})$ represents cross-product features like `installed_app_x_impression_app`. This component memorizes specific, frequent feature combinations -- "users who installed Netflix also install Hulu" -- with high precision.

### The Deep Component (Generalization)

The deep component is a standard feed-forward neural network operating on dense embeddings of categorical features. It generalizes to unseen feature combinations through learned representations -- even if a specific app pairing has never been observed, similar apps will have similar embeddings.

### Joint Training

Both components are trained jointly with a combined loss:

$$P(\hat{y} = 1 | \mathbf{x}) = \sigma(y_{\text{wide}} + y_{\text{deep}})$$

### Practical Impact

Google reported significant improvements in app acquisition rate on Google Play when deploying Wide & Deep:

- The wide component prevented over-generalization (recommending irrelevant but "similar" apps)
- The deep component prevented the system from only recommending the most obvious, memorized patterns
- The combination outperformed either component alone

## Comparison

| Aspect | FM | DeepFM | DCN | Wide & Deep |
|---|---|---|---|---|
| **Interaction order** | 2nd order | Low + high order | Bounded polynomial | Memorized crosses + learned |
| **Interaction type** | Explicit (factorized) | Explicit + implicit | Explicit (cross net) + implicit | Explicit (manual) + implicit |
| **Feature engineering** | None | None | None | Required for wide component |
| **Parameter efficiency** | $O(kn)$ | $O(kn) + O(\text{DNN})$ | $O(Ld) + O(\text{DNN})$ | $O(\text{crosses}) + O(\text{DNN})$ |
| **Sparse feature handling** | Excellent | Excellent | Moderate | Good (via wide component) |
| **Dense feature handling** | Limited | Good | Excellent | Good |
| **Training** | SGD / ALS | End-to-end | End-to-end | Joint training |
| **Key paper** | Rendle, 2010 | Guo et al., 2017 | Wang et al., 2017 | Cheng et al., 2016 |

## When to Use Which

The choice between these architectures depends on the nature of your feature space and the interaction patterns you need to capture:

**Highly sparse categorical features** (user IDs, item IDs, categorical attributes):
- **FM** or **DeepFM** -- the factorized interaction mechanism handles sparsity gracefully, and shared embeddings make the most of limited co-occurrence data

**Dense or continuous features** (numerical attributes, pre-computed embeddings):
- **DCN** or **DCN-V2** -- the cross network efficiently models polynomial interactions between dense features without requiring factorization

**Mixed feature spaces** (both sparse categoricals and dense numerics):
- **Wide & Deep** when you have strong domain knowledge about which specific crosses matter
- **DCN-V2** when you want automatic interaction learning without manual feature engineering

**Production considerations:**
- FM is the simplest to deploy and fastest at inference -- often a strong baseline
- DeepFM adds modeling power with minimal architectural complexity
- DCN-V2 is the current state of the art for many CTR prediction benchmarks
- Wide & Deep remains widely used at Google-scale systems where domain-specific crosses provide clear value

In practice, the gap between these architectures is often smaller than the gap between good and bad feature engineering, embedding quality, or training data coverage. Start with FM as a baseline, then progressively add complexity only when validated on held-out data.
