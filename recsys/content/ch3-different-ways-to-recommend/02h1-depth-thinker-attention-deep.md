---
id: ch3-attention-deep
type: spine
title: "Transformers for Sequential Recommendation: The Complete Architecture"
readingTime: 6
standalone: false
core: false
voice: thinker
parent: ch3-attention-d-think
status: accepted
---

Every recommendation you receive carries an implicit assumption about how much your past matters -- and *which* parts of your past matter most. Sequential recommendation models take this seriously: they treat your interaction history not as a bag of events but as an ordered narrative, where timing, ordering, and context all carry predictive signal.

This section provides a complete architectural walkthrough of how transformer-based sequential recommenders work, from the foundational self-attention mechanism through production-deployed architectures.

## Why Sequence Matters: Temporal Dynamics in Recommendation

Consider two users who have each watched the same 50 films. If those 50 films were consumed in different orders, those users likely have very different current preferences. The user who recently binged science fiction has different immediate intent than the user who just finished a documentary marathon -- even if their all-time viewing histories are identical.

Temporal dynamics manifest at multiple scales:

- **Short-term intent**: The last 3--5 interactions often reveal a micro-session goal (e.g., researching a purchase, exploring a genre)
- **Medium-term drift**: Preferences shift over weeks and months as interests evolve
- **Long-term stability**: Core taste dimensions (e.g., preference for complex narratives) persist across years
- **Periodic patterns**: Weekend behavior differs from weekday behavior; seasonal preferences recur annually

A model that flattens all of this into a single average embedding discards precisely the signal that distinguishes "what you want right now" from "what you've ever liked."

## The Self-Attention Mechanism in Full

Self-attention (Vaswani et al., 2017) provides the mathematical machinery to learn adaptive, context-dependent weights over a sequence. Here is the complete derivation.

### Setup: The Input Sequence

Let $X \in \mathbb{R}^{n \times d}$ be a matrix where each row $x_i$ is the $d$-dimensional embedding of the $i$-th item in a user's interaction history of length $n$.

### Query, Key, and Value Projections

Self-attention projects the input into three distinct representation spaces via learned weight matrices:

$$Q = XW_Q, \quad K = XW_K, \quad V = XW_V$$

where $W_Q, W_K \in \mathbb{R}^{d \times d_k}$ and $W_V \in \mathbb{R}^{d \times d_v}$.

The intuition behind this decomposition:

- **Query** ($Q$): "What am I looking for?" -- each position broadcasts a query describing the type of context it needs
- **Key** ($K$): "What do I contain?" -- each position advertises what information it can provide
- **Value** ($V$): "What information do I carry?" -- the actual content that gets aggregated

Separating keys from values is crucial. The key determines *how much* attention a position receives; the value determines *what information* flows through that attention connection. A position might be highly relevant (high key-query alignment) but contribute very different information than its key would suggest.

### Computing Attention Weights

The raw attention scores are computed as the scaled dot product between queries and keys:

$$A = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)$$

The matrix $QK^T \in \mathbb{R}^{n \times n}$ contains pairwise compatibility scores between all positions. Entry $(i, j)$ measures how much position $i$ should attend to position $j$.

### Why $\sqrt{d_k}$ Scaling Prevents Gradient Saturation

The scaling factor $\sqrt{d_k}$ is not cosmetic -- it's essential for stable training. Here's the entropy-based analysis:

Assume the components of $q$ and $k$ are independent random variables with mean 0 and variance 1. The dot product $q \cdot k = \sum_{i=1}^{d_k} q_i k_i$ has mean 0 and variance $d_k$. As $d_k$ grows, the dot products grow in magnitude, pushing the softmax into regions where its gradient is vanishingly small.

Concretely, if $d_k = 512$, unscaled dot products have standard deviation $\sqrt{512} \approx 22.6$. Softmax over values of this magnitude produces near-one-hot distributions -- the entropy collapses to near zero, and the model can barely update the attention weights via gradient descent. Dividing by $\sqrt{d_k}$ normalizes the variance back to 1, keeping the softmax in its high-entropy, gradient-rich regime.

Without scaling: $\text{Var}(q \cdot k) = d_k$ (grows with dimension)

With scaling: $\text{Var}\left(\frac{q \cdot k}{\sqrt{d_k}}\right) = 1$ (dimension-independent)

### Output Computation

The final attention output aggregates values weighted by the attention distribution:

$$Z = AV$$

Each row $z_i$ of the output is a weighted combination of all value vectors, where the weights are determined by the attention scores from position $i$. Positions that are more relevant (higher attention weight) contribute more to the output representation.

## Multi-Head Attention

A single attention head learns one notion of "relevance." But relevance in recommendation is multi-faceted: recency matters, topical similarity matters, engagement depth matters, and these are distinct signals.

### Architecture

Multi-head attention runs $h$ parallel attention computations, each with its own learned projection matrices:

$$\text{head}_i = \text{Attention}(XW_i^Q, XW_i^K, XW_i^V)$$

$$\text{MultiHead}(X) = \text{Concat}(\text{head}_1, \ldots, \text{head}_h) W^O$$

where $W_i^Q, W_i^K \in \mathbb{R}^{d \times d_k/h}$, $W_i^V \in \mathbb{R}^{d \times d_v/h}$, and $W^O \in \mathbb{R}^{d_v \times d}$.

Each head operates in a reduced dimensionality ($d_k/h$ instead of $d_k$), so the total computation is comparable to a single full-dimensional head.

### Why Multiple Heads Capture Different Relationship Types

Empirical analysis of trained recommendation transformers reveals that different heads specialize:

- **Recency heads**: Attend primarily to the most recent 2--3 positions, capturing short-term intent
- **Similarity heads**: Attend to items in the same category or genre, regardless of position
- **Contrast heads**: Attend to items that are *different* from the current position, potentially capturing diversity-seeking behavior
- **Long-range heads**: Attend to distant positions, capturing stable long-term preferences

This specialization emerges entirely from training -- it is not engineered. The separate projection matrices give each head the freedom to define its own notion of relevance.

## Positional Encoding

Self-attention is permutation-invariant by construction: swapping two rows of $X$ and correspondingly swapping the output rows yields an identical result. For recommendation, this is a problem -- the *order* of interactions carries critical signal.

### Sinusoidal Positional Encoding

The original transformer (Vaswani et al., 2017) proposed deterministic sinusoidal encodings:

$$PE_{(pos, 2i)} = \sin\left(\frac{pos}{10000^{2i/d}}\right)$$

$$PE_{(pos, 2i+1)} = \cos\left(\frac{pos}{10000^{2i/d}}\right)$$

where $pos$ is the position index and $i$ is the dimension index. Each dimension operates at a different frequency, creating a unique "fingerprint" for each position. A key property: the encoding of position $pos + k$ can be expressed as a linear function of the encoding of position $pos$, which in principle allows the model to learn relative positional relationships.

### Learned Positional Embeddings

In practice, recommendation transformers (including SASRec and BERT4Rec) typically use **learned positional embeddings** -- a trainable matrix $P \in \mathbb{R}^{n_{\max} \times d}$ where each row is a learned vector for that position.

The input to the first attention layer becomes:

$$X' = X + P$$

Learned embeddings outperform sinusoidal encodings for recommendation because:

1. Interaction sequences are bounded in length (typically $n_{\max} \leq 200$), so the model can afford to learn a vector per position
2. The temporal semantics of "position 1 vs. position 50" in a viewing history differ from the linguistic semantics of word positions in a sentence
3. The model can learn non-linear positional effects (e.g., the most recent position is disproportionately important)

### Why Position Matters for Temporal Ordering

Without positional encoding, the model cannot distinguish the sequence [A, B, C] from [C, A, B]. In recommendation, these represent fundamentally different user trajectories. A user who watched a documentary, then a thriller, then a comedy is on a different journey than one who started with comedy. Positional encoding is what gives the model access to this ordering information.

## Causal Masking for Autoregressive Recommendation

In next-item prediction, the model at position $t$ should only attend to positions $1, 2, \ldots, t$ -- attending to future items would constitute information leakage during training.

Causal masking enforces this by adding $-\infty$ to attention scores for future positions before the softmax:

$$A_{ij} = \begin{cases} \text{softmax}\left(\frac{q_i \cdot k_j}{\sqrt{d_k}}\right) & \text{if } j \leq i \\ 0 & \text{if } j > i \end{cases}$$

In practice, this is implemented by adding a triangular mask matrix $M$ where $M_{ij} = 0$ if $j \leq i$ and $M_{ij} = -\infty$ if $j > i$:

$$A = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}} + M\right)$$

The $-\infty$ values become zero after softmax, effectively blocking information flow from future positions.

## SASRec: Self-Attentive Sequential Recommendation

SASRec (Kang & McAuley, 2018) was the first major application of self-attention to sequential recommendation, and it remains a strong baseline that many subsequent models struggle to consistently outperform.

### Architecture

The full SASRec architecture consists of:

**1. Embedding Layer + Positional Encoding**

Each item $i$ is mapped to a $d$-dimensional embedding $e_i$. The input sequence $\{s_1, s_2, \ldots, s_n\}$ becomes:

$$\hat{E} = \begin{bmatrix} e_{s_1} + p_1 \\ e_{s_2} + p_2 \\ \vdots \\ e_{s_n} + p_n \end{bmatrix}$$

where $p_t$ is the learned positional embedding for position $t$.

**2. Self-Attention Blocks with Causal Mask**

SASRec stacks $b$ identical blocks (typically $b = 2$). Each block contains:

$$S^{(l)} = \text{LayerNorm}\left(\hat{E}^{(l-1)} + \text{MultiHead}(\hat{E}^{(l-1)})\right)$$

followed by a point-wise feed-forward network:

$$\hat{E}^{(l)} = \text{LayerNorm}\left(S^{(l)} + \text{FFN}(S^{(l)})\right)$$

All self-attention layers use causal masking to prevent future information leakage.

**3. Point-Wise Feed-Forward Network**

The FFN applies two linear transformations with a ReLU activation:

$$\text{FFN}(x) = \text{ReLU}(xW_1 + b_1)W_2 + b_2$$

where $W_1 \in \mathbb{R}^{d \times 4d}$ and $W_2 \in \mathbb{R}^{4d \times d}$. The inner dimension is typically $4\times$ the model dimension, providing the model with a non-linear transformation capacity that pure attention lacks.

**4. Prediction and Loss**

The output embedding at position $t$ predicts the next item at position $t+1$. SASRec computes the relevance score for a candidate item $j$ as:

$$r_{t,j} = \hat{e}_t^{(b)} \cdot e_j$$

Training uses **binary cross-entropy loss with negative sampling**: for each observed next item (positive), one or more randomly sampled items serve as negatives:

$$\mathcal{L} = -\sum_{t=1}^{n-1} \left[\log \sigma(r_{t, s_{t+1}}) + \sum_{j \sim \text{neg}} \log(1 - \sigma(r_{t,j}))\right]$$

where $\sigma$ is the sigmoid function. This is more efficient than a full softmax over all items, which would be prohibitively expensive for large item catalogs.

## BERT4Rec: Bidirectional Sequential Recommendation

BERT4Rec (Sun et al., 2019) adapts BERT's masked language modeling objective to sequential recommendation.

### Masked Item Prediction (Cloze Task)

Instead of predicting the next item autoregressively, BERT4Rec randomly masks items in the sequence and trains the model to predict them:

Given sequence [A, B, C, D, E], a masked version might be [A, [MASK], C, [MASK], E]. The model must predict B and D using bidirectional context -- both past and future items.

During training, a fixed proportion (typically 20%) of items in each sequence are replaced with a special [MASK] token.

### Bidirectional Attention vs. Unidirectional

The critical architectural difference: BERT4Rec removes the causal mask. Every position can attend to every other position, including future items:

- **SASRec (unidirectional)**: Position $t$ sees only $\{1, \ldots, t\}$
- **BERT4Rec (bidirectional)**: Position $t$ sees $\{1, \ldots, n\}$

This means the representation for each position is informed by the full context, not just the history up to that point.

### When Bidirectional Is Better

Bidirectional attention excels when:

- **The task involves understanding context, not just prediction**: If you need to infer a user's preference given their complete session, bidirectional context is strictly more informative
- **Dense interaction data**: With enough data, the model can exploit future context without overfitting
- **Gap-filling scenarios**: Recommending items that fit into a user's existing collection (e.g., "you have items A, C, and E -- you'd probably like B and D")

Unidirectional (SASRec-style) attention is preferable when:

- **Real-time next-item prediction**: At serving time, there are no future items to attend to, so the bidirectional training objective creates a train/test mismatch
- **Sparse data**: The Cloze objective requires more data to train effectively
- **Streaming settings**: Items arrive one at a time and the model must produce predictions incrementally

In practice, the train/test mismatch is BERT4Rec's primary limitation. During training, it can see surrounding context; during inference, it can only see past items. SASRec's training and inference conditions are aligned.

## Computational Complexity

Understanding the computational cost is essential for production decisions.

**Per attention layer:**

- **Time complexity**: $O(n^2 \cdot d)$ -- the $QK^T$ computation produces an $n \times n$ matrix, and each entry requires a $d_k$-dimensional dot product
- **Memory complexity**: $O(n^2 + n \cdot d)$ -- the $n \times n$ attention matrix must be stored, plus the $n \times d$ representations

**Implications for recommendation:**

- With $n = 50$ (typical short sequence), the $n^2 = 2500$ attention entries are trivial
- With $n = 200$ (longer history), $n^2 = 40000$ is still manageable
- With $n = 1000+$ (full history for power users), the quadratic cost becomes a bottleneck

This is why most recommendation transformers truncate sequences to the most recent $n_{\max}$ items (typically 50--200). The information lost from truncation is usually less damaging than the computational cost of processing full histories.

## Comparison with RNN/LSTM/GRU Approaches

Before transformers, sequential recommendation was dominated by recurrent architectures:

| Aspect | RNN/LSTM/GRU | Transformer |
|---|---|---|
| Long-range dependencies | Degrades with distance; LSTM/GRU partially mitigate via gates | Direct attention to any position regardless of distance |
| Parallelization | Sequential by nature; each step depends on the previous hidden state | Fully parallelizable across positions during training |
| Training speed | Slower (cannot parallelize across time steps) | Faster (parallelizable), but higher per-step memory |
| Interpretability | Hidden state is opaque | Attention weights provide some interpretability |
| Gradient flow | Vanishing/exploding gradients despite gating mechanisms | Residual connections provide stable gradient flow |
| Inductive bias | Strong sequential inductive bias (locality) | Weak inductive bias; must learn sequential patterns from data + positional encoding |

The transformer's advantage in parallelization is particularly significant for recommendation model training, where datasets contain billions of interaction sequences. However, the RNN's strong sequential inductive bias means it can be more data-efficient for short sequences.

## ReALM: When Linear Models Beat Transformers

A counterintuitive but practically important finding: transformers are not always the best sequential model.

The ReALM model (Zmeškalová et al., 2025) demonstrated that for grocery shopping recommendation, a linear sequential model outperformed transformer-based approaches. The key insight is about the nature of the sequential patterns:

- **Grocery shopping sequences are short** (typically 5--20 items per basket) and highly repetitive (people buy similar items week after week)
- **The patterns are predominantly linear**: "bought milk last week" is a strong predictor of "will buy milk this week," and this relationship doesn't require the complex non-linear interactions that transformers capture
- **Limited data per user**: With weekly shopping trips, most users have only 50--100 historical sequences -- insufficient to train transformer attention patterns without severe overfitting

This aligns with a broader principle in machine learning: **model complexity should match the complexity of the underlying patterns**. Transformers excel when sequences contain complex, long-range, non-linear dependencies (e.g., media consumption, web browsing). For domains with simple, repetitive sequential patterns, simpler models achieve comparable or better performance with lower computational cost and less overfitting risk.

## Practical Considerations

### Sequence Length Truncation

Most deployed systems truncate to the most recent $n$ interactions. The choice of $n$ involves a trade-off:

- **Too short** ($n < 20$): Loses medium-term preference signals; the model sees only the current micro-session
- **Too long** ($n > 200$): Quadratic attention cost becomes significant; ancient interactions contribute noise more than signal
- **Sweet spot** ($n = 50$--$100$): Captures multiple sessions and preference drift without excessive cost

Some systems use logarithmic sampling from history -- dense sampling of recent interactions and sparse sampling of older ones -- to capture both recency and long-term patterns within a fixed sequence budget.

### Computational Cost

A single SASRec-style model with $d = 256$, $h = 4$ heads, $b = 2$ blocks, and $n = 50$:
- **Parameters**: ~1M (excluding item embedding table)
- **Inference latency**: ~1ms per user on GPU
- **Training**: Hours on a single GPU for millions of sequences

This is significantly more expensive than a matrix factorization model but far cheaper than large language models. The computational cost is manageable for online serving but requires careful engineering for systems handling millions of requests per second.

### When to Use Transformer-Based Sequential Models

**Strong fit:**
- Media consumption (video, music, articles) with diverse, evolving preferences
- Session-based recommendation where order within a session matters
- Users with rich interaction histories (50+ interactions)
- Domains where temporal patterns are complex and non-linear

**Weak fit:**
- Cold-start users with fewer than 10 interactions
- Domains with highly repetitive, periodic behavior (grocery, utilities)
- Systems where the item catalog is small (< 1,000 items)
- Latency-critical environments without GPU serving infrastructure

The transformer is a powerful tool, but like all tools, it has a domain of applicability. Understanding where sequence complexity justifies architectural complexity is the key engineering judgment in deploying these systems.
