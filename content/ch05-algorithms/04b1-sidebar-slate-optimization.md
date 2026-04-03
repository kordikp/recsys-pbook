---
id: ch3-slate
type: spine
title: "Slate Optimization: Recommending Sets, Not Items"
readingTime: 3
standalone: true
core: false
voice: universal
parent: null
diagram: null
recallQ: "Why is recommending items independently suboptimal?"
recallA: "Scoring items independently ignores interactions between them -- you get redundant recommendations. Slate optimization selects a diverse, complementary set that maximizes the value of the entire page."
publishedAt: "2026-04-03"
status: accepted
---

Most recommendation algorithms score items independently: compute a relevance score for each candidate, sort by score, take the top $k$. This feels natural but misses something fundamental -- the user sees a **set** of recommendations, not individual items in isolation.

If your top 10 items by independent score are all variations of the same topic, the user sees a wall of redundancy. The ninth-best item on a different topic would have been far more valuable than the third-best item on the same topic. Independent scoring cannot capture this.

![Slate optimization: individual vs set-based scoring](/images/anim-slate-optimization.svg)

## The Page-Level Problem

The real optimization target is the **utility of the entire slate** (the set of items displayed together), not the sum of individual item utilities:

$$\text{maximize } U(S) \quad \text{subject to } |S| = k$$

where $S$ is the selected slate and $U(S)$ is a set function that captures both relevance and diversity. If $U(S) = \sum_{i \in S} u(i)$ -- a simple sum of individual scores -- then the optimal slate is just the top-$k$ items. But realistic utility functions are **submodular**: they exhibit diminishing returns.

## Submodularity and Diminishing Returns

A set function $f$ is **submodular** if adding an item to a smaller set yields at least as much marginal gain as adding it to a larger set:

$$f(A \cup \{e\}) - f(A) \geq f(B \cup \{e\}) - f(B) \quad \text{for all } A \subseteq B$$

Intuitively: the first science fiction recommendation is highly valuable. The second adds less. The fifth adds almost nothing. This is exactly the diminishing returns structure that captures redundancy.

The good news: maximizing a monotone submodular function subject to a cardinality constraint admits a simple **greedy algorithm** with a $(1 - 1/e) \approx 0.63$ approximation guarantee (Nemhauser et al., 1978). The greedy approach: start with an empty slate, and at each step add the item with the highest marginal gain. This guarantee is the best possible in polynomial time unless P = NP.

## Determinantal Point Processes for Diverse Slates

**Determinantal Point Processes (DPPs)** provide an elegant probabilistic framework for sampling diverse subsets. A DPP defines a probability distribution over subsets $S$ of items:

$$P(S) \propto \det(\mathbf{L}_S)$$

where $\mathbf{L}$ is a positive semidefinite kernel matrix and $\mathbf{L}_S$ is the submatrix indexed by $S$. The determinant naturally balances two forces:

- **Diagonal entries** $L_{ii}$ encode item quality (relevance)
- **Off-diagonal entries** $L_{ij}$ encode item similarity

High-quality items increase the determinant. Similar items decrease it (the determinant of a matrix with near-identical rows is near zero). The result: DPP sampling favors sets of high-quality, dissimilar items -- exactly what a good recommendation slate should be.

In practice, the kernel matrix is often decomposed as $L_{ij} = q_i \cdot \phi_i^T \phi_j \cdot q_j$, where $q_i$ is a scalar quality score and $\phi_i$ is a normalized feature vector capturing item characteristics. This separates the relevance signal from the diversity signal.

## YouTube's SlateQ Approach

YouTube's SlateQ (Ie et al., 2019) tackles slate optimization from an RL perspective. The challenge: if the action space is "choose a slate of $k$ items from $n$ candidates," the number of possible actions is $\binom{n}{k}$, which is computationally intractable for realistic $n$.

SlateQ decomposes the problem by assuming a **user choice model** -- a model of how users select among items on a slate (e.g., a conditional logit model). Under this assumption, the Q-value of a slate can be expressed in terms of per-item Q-values:

$$Q(s, \text{slate}) = \sum_{i \in \text{slate}} P(\text{user picks } i \mid \text{slate}) \cdot Q(s, i)$$

This decomposition reduces the combinatorial action space to a tractable optimization: find the slate that maximizes the expected per-item Q-value under the choice model. The key insight is that you only need to learn item-level Q-values, not slate-level ones.

## Practical Implementation: Re-Ranking with Diversity Constraints

In production systems, full slate optimization is often approximated through **re-ranking** -- a post-processing stage applied to the top candidates from the scoring model. Common approaches:

**Maximal Marginal Relevance (MMR)** iteratively selects items that balance relevance and novelty:

$$\text{MMR} = \arg\max_{i \in R \setminus S} \left[ \lambda \cdot \text{rel}(i) - (1 - \lambda) \cdot \max_{j \in S} \text{sim}(i, j) \right]$$

where $R$ is the candidate set, $S$ is the current slate, and $\lambda$ controls the relevance-diversity trade-off. At each step, the selected item must be both relevant and dissimilar to items already on the slate.

**Category-based constraints** enforce hard diversity rules: no more than 3 items from the same category, at least 1 item from a discovery source, alternate between content types. Simple, interpretable, and widely used despite their lack of theoretical elegance.

**Sliding window deduplication** removes items that are too similar to recently shown items (within the current session or across recent sessions), preventing the "echo chamber" effect where the same recommendations appear repeatedly.

## Why This Matters

The difference between item-level and slate-level optimization is not academic. A/B tests at major platforms consistently show that diversity-aware re-ranking improves long-term engagement metrics even when it slightly reduces per-item click-through rates. Users don't evaluate recommendations in isolation -- they evaluate the page. Slate optimization aligns the algorithm's objective with the user's actual experience.
