---
id: ch7-realm
type: spine
title: "ReALM: When Linear Models Beat Transformers"
readingTime: 2
standalone: true
core: false
teaser: "A linear model with a closed-form solution outperforms LSTMs and Transformers on next-basket prediction. Here's why simplicity wins."
voice: universal
parent: ch7-production-scale
diagram: null
recallQ: "Why does ReALM outperform deep models for next-basket prediction?"
recallA: "Grocery shopping sequences are short (5-20 visits), highly habitual, and repetitive. Linear models capture 'if you bought X last time, you'll probably buy X again' without overfitting — deep models have too many parameters for this amount of data."
publishedAt: "2026-04-03"
status: accepted
---

In the age of Transformers and billion-parameter models, a research team at FIT CTU Prague and Recombee showed that a **linear model** with a closed-form solution outperforms LSTMs and Transformers for next-basket prediction.

ReALM (Recurrent Autoregressive Linear Model) predicts which products a customer will buy on their next grocery shopping trip. And it does so in **seconds of training time**, compared to hours for deep models.

## The Model

Given a sequence of past shopping baskets $\mathbf{b}_1, \mathbf{b}_2, \ldots, \mathbf{b}_T$ (each a binary vector indicating purchased items), ReALM predicts the next basket:

$$\hat{\mathbf{b}}_{T+1} = \sum_{\tau=1}^{T} \mathbf{b}_\tau \mathbf{W}_\tau$$

Each past basket contributes through a learned weight matrix $\mathbf{W}_\tau$ that captures the influence of basket-at-lag-τ on the next purchase.

**The solution is closed-form:** Stack all baskets into matrices and solve a linear system via least squares. No gradient descent, no learning rate tuning, no epochs.

## Why Simple Wins Here

**Short sequences.** Each user has 5–20 shopping trips. Transformers need hundreds of tokens to learn meaningful attention patterns. With 10 baskets, there simply isn't enough data for self-attention to shine.

**Highly habitual behavior.** People buy roughly the same groceries each week. The dominant pattern is "I bought milk last time → I'll buy milk again." A linear model captures this perfectly. Adding non-linear capacity doesn't help — there's no complex non-linear pattern to find.

**Data efficiency.** The closed-form solution uses every data point optimally. SGD-trained models introduce randomness through initialization, mini-batching, and learning rate scheduling — all sources of variance that hurt on small datasets.

## The Broader Lesson

ReALM is a specific example of a general principle: **match model complexity to data density.**

- Deep models shine when data is abundant, patterns are complex, and sequences are long (language modeling, music playlists with 100+ songs)
- Linear models win when data is scarce, patterns are simple, and the closed-form solution eliminates variance (grocery baskets, short-term purchase prediction)

The EASE-to-ELSA story tells the same lesson at the collaborative filtering level: a linear model (EASE) outperforms deep networks because sparse interaction data doesn't support the complexity that deep models introduce.

## Practical Implications

If you're building a recommendation system for a domain with:
- Short user histories (< 20 interactions)
- Repetitive behavior patterns
- Small catalogs (< 50K items)

**Start with a linear model.** You might be surprised how competitive it is — and how much engineering complexity you save. Add deep components only when you have clear evidence that they improve metrics on your specific data.

> **Research publication:** Zmeškalová et al., "[ReALM: Next-Basket Recommendation with Autoregressive Linear Models](https://dl.acm.org/doi/full/10.1145/3705328.3759313)," RecSys 2025. See the [full list of Recombee research publications](https://www.recombee.com/research-publications).

**Consider this:** ReALM's training time is measured in seconds. A Transformer's in hours. If both achieve similar quality, the seconds option gives you faster iteration, cheaper experiments, and simpler production deployment. Simplicity isn't just elegant — it's practical.