---
id: ch3-neg-sampling
type: spine
title: "Negative Sampling Strategies: Learning From What Users Didn't Choose"
readingTime: 3
standalone: true
core: false
teaser: "In recommendation, most items are irrelevant. How you sample 'negatives' during training determines what the model actually learns."
voice: thinker
parent: null
diagram: null
recallQ: "Why is negative sampling strategy important and what are the main approaches?"
recallA: "Models need negative examples but can't use all unobserved items. Random sampling is biased toward easy negatives. Hard negative mining improves discrimination but risks false negatives. Mixed strategies (random + hard) offer the best balance."
status: accepted
---

In recommendation training, the model learns from positive examples (items the user interacted with) and negative examples (items the user did not interact with). The challenge: there are millions of potential negatives for each positive, and you can only sample a fraction.

**The choice of negative sampling strategy fundamentally shapes what the model learns.**

## Why Sampling Is Necessary

For a user with 100 interactions out of 1 million items, there are 999,900 potential negatives. Training on all of them is computationally prohibitive and creates extreme class imbalance (1:10,000 positive:negative ratio).

Typical practice: sample 5–100 negatives per positive example. But *which* negatives you sample matters enormously.

## Strategy 1: Uniform Random Sampling

**Method:** For each positive (u, i⁺), sample k items uniformly at random as negatives.

**Advantage:** Simple, unbiased, efficient.

**Problem:** Most random samples are "easy" negatives — items so irrelevant that the model can trivially distinguish them (a cooking recipe as a negative for a user who only watches sci-fi). The model doesn't learn to make hard distinctions.

## Strategy 2: Popularity-Biased Sampling

**Method:** Sample negatives proportional to item popularity: $p(i) \propto f(i)^{0.75}$

The 0.75 exponent (from Word2Vec) smooths the distribution, giving rare items some sampling probability.

**Advantage:** Popular items are more likely to be true negatives (the user probably saw them but chose not to interact). This produces harder negatives than uniform sampling.

**Problem:** Can introduce popularity bias in the learned representations.

## Strategy 3: Hard Negative Mining

**Method:** Use the current model's scores to find items that the model incorrectly ranks highly — items it thinks the user would like but actually didn't interact with.

$$\text{hard negatives} = \text{top-K scored items} \setminus \text{positive items}$$

**Advantage:** Forces the model to learn fine-grained distinctions. Much more informative per training example.

**Problem:** Risk of **false negatives** — items the user would have liked but never encountered. Pushing these down in the ranking is counterproductive.

## Strategy 4: Mixed Sampling

**Method:** Combine random and hard negatives:
- 50–70% uniform random (maintains calibration)
- 30–50% hard negatives from model (improves discrimination)

**Why it works:** Random negatives prevent the model from overfitting to hard cases. Hard negatives ensure the model learns to make difficult distinctions. The mix provides both calibration and discrimination.

## Strategy 5: In-Batch Negatives

**Method:** In a training batch of B users, each user's positives serve as negatives for other users. No explicit negative sampling needed.

**Advantage:** Computationally efficient — negatives come "for free" from the batch. Natural diversity.

**Problem:** Batch composition affects the implicit negative distribution. Small batches have few negatives; large batches may include false negatives.

## Impact on Model Quality

The effect of negative sampling is measurable:

| Strategy | Training Speed | Model Quality | Risk |
|----------|---------------|---------------|------|
| Uniform random | Fast | Moderate | Under-discrimination |
| Popularity-biased | Fast | Good | Popularity bias |
| Hard negative | Slower | Best (careful tuning) | False negatives |
| Mixed (70/30) | Moderate | Best (robust) | Minimal |
| In-batch | Very fast | Good | Batch size sensitivity |

## Practical Recommendations

1. **Start with popularity-biased sampling** — it's a strong default
2. **Add hard negatives** only after the model has converged on easy negatives
3. **Monitor for false negatives** — if hard negatives push down items the model should recommend, reduce the hard negative ratio
4. **Match sampling to evaluation** — if your evaluation metric weights popular items differently, your training sampling should be aware of this

**Consider this:** Negative sampling is a form of curriculum design — you're choosing what examples the model learns from. Easy negatives teach the basics; hard negatives teach refinement. Like any curriculum, the progression matters.