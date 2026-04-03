---
id: ch7-vasp-ablation
type: spine
title: "What VASP Teaches About Model Design: Ablation Insights"
readingTime: 2
standalone: true
core: false
teaser: "Removing components from VASP reveals which parts actually matter — and the answer challenges deep learning orthodoxy."
voice: universal
parent: ch7-vasp-combining
diagram: null
recallQ: "What did VASP's ablation studies reveal about the relative importance of linear vs. deep components?"
recallA: "Removing the linear path (ELSA) hurt performance significantly more than removing the deep path (FLVAE). The linear model provides the reliable foundation; the deep model adds refinement. This challenges the assumption that deep learning is always superior."
status: accepted
---

VASP's most revealing contribution isn't its architecture — it's what happens when you take pieces away.

## The Ablation Experiments

The VASP paper systematically removed components to measure their contribution:

| Configuration | nDCG@100 | vs. Full VASP |
|--------------|----------|---------------|
| Full VASP (ELSA ⊙ FLVAE) | Best | Baseline |
| ELSA only (remove deep) | -2–3% | Small loss |
| FLVAE only (remove linear) | -8–15% | Large loss |
| Addition instead of Hadamard | -3–5% | Moderate loss |

**The key finding:** Removing the linear path causes much more damage than removing the deep path. The linear model is not a "warm-up" for the deep model — it's the essential component.

## What This Means

**Linear models aren't just baselines.** The recommendation community often treats linear models as baselines to beat with deep learning. VASP shows that a well-regularized linear model captures the most important patterns in sparse interaction data — patterns that deep models can refine but not replace.

**Deep models add marginal value on sparse data.** FLVAE's contribution is real but modest. On dense datasets, the deep component would contribute more. On the typical sparse interaction data of recommendation (< 0.1% observed), the deep model's extra capacity mostly models noise.

**Combination method matters.** Hadamard (element-wise multiplication) outperforms addition by 3–5%. The AND-logic of multiplication filters false positives that either path alone would produce.

## The Broader Lesson

VASP's ablation results generalize beyond this specific architecture:

1. **Start with a strong linear baseline** (EASE, ELSA, ALS). If it's competitive, adding deep components may not be worth the engineering cost.
2. **Measure incremental value.** Always ablate: does each component contribute enough to justify its complexity?
3. **Combine carefully.** How you combine components (addition vs. multiplication vs. attention) can matter as much as the components themselves.
4. **Match model complexity to data density.** Deep models shine with dense data. For sparse RecSys data, simplicity often wins.

**Consider this:** The VASP ablation is a concrete instance of a general principle: the most informative experiment isn't "does the full model work?" but "what breaks when I remove things?" Ablation studies reveal not just whether a system works, but *why* it works — and that understanding is what enables genuine progress.