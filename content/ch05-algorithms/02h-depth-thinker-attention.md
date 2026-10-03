---
id: ch3-attention
type: spine
title: "Self-Attention: Not All Interactions Matter Equally"
readingTime: 3
standalone: false
teaser: "Why the article you read yesterday matters more than the one from 3 months ago -- and how transformers learn which history to attend to."
voice: thinker
parent: null
diagram: diagram-attention
core: false
recallQ: "Why doesn't a recommender treat all past interactions equally?"
recallA: "Recent interactions and contextually relevant interactions carry more predictive signal. Self-attention lets the model learn adaptive, position-aware weights over the interaction history."
highlights:
  - "Self-attention weights interaction history: recent and relevant items get higher weight"
  - "Multi-head attention captures different relationship types simultaneously"
  - "The same transformer technology behind ChatGPT now powers sequential recommendation"
status: accepted
concept: embeddings
state: edited
lens: generic
visuality: balanced
depth: research
formalism: full
lengthBand: deep
genre: explainer
carriers: prose|diagram|formula
---

You've consumed 500 items this year. When the system decides what to surface next, should it weight all 500 equally? Obviously not -- the technical deep dive you read yesterday is far more predictive of your current interests than the travel article you skimmed three months ago.

## The Problem with Naive History Aggregation

Basic recommenders treat interaction history as a flat bag -- every interaction counts equally. Watched a horror film once during October? You'll keep getting horror recommendations in March. Binged cooking content while home sick? The algorithm overweights a transient behavior.

Simple approaches like averaging all historical item embeddings lose temporal and contextual signal. Using only the last $k$ items discards potentially relevant long-range patterns.

## Self-Attention: Learned Relevance Weighting

**Self-attention** (Vaswani et al., 2017) -- the core mechanism behind the transformer architecture that powers GPT, BERT, and their successors -- solves this by computing dynamic relevance weights: "For THIS query context, which past interactions carry the most predictive signal?"

### The Attention Mechanism

Given a sequence of historical item embeddings $\{e_1, e_2, \ldots, e_n\}$, self-attention computes:

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right) V$$

where:
- $Q$ (queries), $K$ (keys), and $V$ (values) are linear projections of the input embeddings
- $d_k$ is the key dimension (the scaling factor prevents softmax saturation)
- The softmax produces a weight distribution over all positions

Each position attends to every other position, learning which historical items are most relevant for predicting the next interaction.

### Multi-Head Attention

In practice, a single attention head captures one type of relevance pattern. **Multi-head attention** runs $h$ parallel attention heads, each with its own learned projection matrices:

$$\text{MultiHead}(Q, K, V) = \text{Concat}(\text{head}_1, \ldots, \text{head}_h) W^O$$

where $\text{head}_i = \text{Attention}(QW_i^Q, KW_i^K, VW_i^V)$

Different heads can capture different relevance signals: one head might attend to recency, another to topical similarity, another to engagement depth.

### Positional Encoding

Since self-attention is permutation-invariant by default, the model needs explicit **positional encoding** to capture temporal order. In recommendation transformers (like SASRec by Kang & McAuley, 2018), learned positional embeddings encode both absolute position and relative temporal gaps between interactions.

## Why This Is Revolutionary

Before attention, sequential recommenders used RNNs (which struggle with long-range dependencies) or simple windowed approaches. Self-attention enables the model to be surgical -- focusing on the 5 items from your history that actually predict your current intent, while appropriately downweighting the other 495.

The SASRec architecture (Self-Attentive Sequential Recommendation, 2018) outperformed recurrent and Markov-chain sequential models on standard benchmarks, and BERT4Rec (2019) claimed to beat SASRec. That second claim turned out to be fragile: a replicability study (Petrov & Macdonald, RecSys 2022) found that later papers disagreed, and that BERT4Rec reaches its reported accuracy only when trained up to 30 times longer than its default configuration. The lesson generalizes: compare against well-tuned baselines before believing a leaderboard.

## Transformer-Based Recommendation Architectures

The full transformer block used in recommendation combines:

1. **Multi-head self-attention** (as described above)
2. **Position-wise feed-forward networks** (two linear layers with ReLU/GELU activation)
3. **Layer normalization** and **residual connections**
4. **Causal masking** (in autoregressive models) to prevent attending to future items

These blocks are stacked (typically 2-4 layers for recommendation) to create increasingly abstract representations of user intent.

## Production Impact

Platforms rarely publish *which* attention pattern drives *which* result, so treat confident claims about "how TikTok weights your late-night scrolling" with suspicion. Two published, dated examples of sequence models in production:

- **Meta (HSTU, ICML 2024):** a transformer-style generative recommender over users' action sequences, benchmarked on histories of 8,192 actions. A 1.5-trillion-parameter version improved online A/B metrics by 12.4% and runs on surfaces with billions of users.
- **Netflix (2025):** a single foundation model, built on ideas from large language models and trained on hundreds of billions of member interactions, replaces many specialized recommendation models.

Both bets pay off most for users with long and diverse interaction histories, which is where attention has the most to choose from.

**Sources:**
- Kang & McAuley, "Self-Attentive Sequential Recommendation," ICDM 2018. [arXiv:1808.09781](https://arxiv.org/abs/1808.09781)
- Petrov & Macdonald, "A Systematic Review and Replicability Study of BERT4Rec for Sequential Recommendation," RecSys 2022. [arXiv:2207.07483](https://arxiv.org/abs/2207.07483)
- Zhai et al., "Actions Speak Louder than Words: Trillion-Parameter Sequential Transducers for Generative Recommendations," ICML 2024. [arXiv:2402.17152](https://arxiv.org/abs/2402.17152)
- Netflix Technology Blog, "[Foundation Model for Personalized Recommendation](https://netflixtechblog.com/foundation-model-for-personalized-recommendation-1a0bd8e02d39)," 21 March 2025.
