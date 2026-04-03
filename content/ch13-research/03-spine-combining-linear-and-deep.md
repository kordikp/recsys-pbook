---
id: ch7-vasp-combining
type: spine
title: "Combining Linear and Deep: The VASP Architecture"
readingTime: 3
standalone: true
core: true
teaser: "Linear models find smooth patterns. Deep models find complex clusters. What happens when you combine them?"
voice: universal
parent: null
diagram: null
recallQ: "Why does VASP use Hadamard product instead of addition to combine linear and deep paths?"
recallA: "Hadamard (element-wise multiply) acts as logical AND — both paths must agree, filtering false positives. Addition acts as OR — either path can contribute, amplifying false positives."
highlights:
  - "Multiply (not add) outputs -- both paths must agree, filtering false positives"
  - "Removing the linear path hurts more than removing the deep path"
  - "For sparse data, the linear model is the essential one, not deep learning"
publishedAt: "2026-04-03"
status: accepted
---

EASE and ELSA are impressively effective, but they have a fundamental limitation: they're **linear models**. They can capture smooth, gradual patterns in user behavior (action fans tend to like sci-fi) but struggle with complex, non-linear clusters (users who like *both* art films and comic book movies but nothing in between).

Deep learning excels at finding these complex patterns — but tends to overfit on sparse recommendation data. The question becomes: **can we get the best of both worlds?**

## The VASP Architecture

VASP (Deep Variational Autoencoder with Shallow Parallel Path) answers this with an elegant design:

**Two parallel paths:**
- **Linear path:** ELSA — captures smooth, reliable patterns with high precision
- **Deep path:** FLVAE (Focal Loss Variational Autoencoder) — captures complex non-linear clusters

**The combination:** Instead of adding the outputs (as in Wide & Deep architectures), VASP uses **Hadamard product** — element-wise multiplication.

$$\hat{\mathbf{x}} = \hat{\mathbf{x}}_{\text{linear}} \odot \hat{\mathbf{x}}_{\text{deep}}$$

## Why Multiplication, Not Addition?

This is a crucial design decision with clear mathematical reasoning:

**Addition** (as in Wide & Deep) acts as **logical OR**: if *either* path gives a high score, the item is recommended. This amplifies false positives — the deep model might hallucinate a pattern, and the score passes through.

**Hadamard product** acts as **logical AND**: *both* paths must agree for an item to get a high score. The linear path's reliable predictions gate the deep model's more speculative ones, filtering out false positives.

In practice, this means:
- Items that both the linear and deep models like → **high score** (genuine signal)
- Items only the deep model likes → **suppressed** (possibly noise)
- Items only the linear model likes → **suppressed** (the deep model disagrees for a reason)

## The Deep Path: Focal Loss

The deep path faces a severe class imbalance problem: most items are irrelevant to any given user. Standard cross-entropy loss treats all negative examples equally, but VASP uses **focal loss**:

$$FL(p_t) = -\alpha_t (1-p_t)^\gamma \log(p_t)$$

With γ = 2: well-classified examples (p_t ≈ 1) get weight (1-1)² = 0, while hard examples (p_t ≈ 0.5) get weight (0.5)² = 0.25. This focuses training on the informative boundary cases rather than the trivially negative majority.

## Results: Better Than Either Alone

VASP consistently outperforms both EASE and deep models alone on standard benchmarks. The key insight from ablation studies: **removing the linear path hurts more than removing the deep path**. The linear model provides the reliable foundation; the deep model adds refinement.

This finding challenges the prevailing narrative that deep learning is always superior. For sparse collaborative filtering data, the linear model is not just a useful component — it's the essential one.

> **Research publication:** Vančura & Kordík, "Deep Variational Autoencoder with Shallow Parallel Path for Top-N Recommendation," RecSys 2021. VASP is part of the broader research program at the [Recombee research lab](https://www.recombee.com/research).

**Consider this:** The VASP principle — combining a reliable, interpretable model with a flexible, expressive one — applies far beyond recommendation. It's a general strategy for any domain where data is sparse but patterns are both simple and complex.