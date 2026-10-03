---
id: sequential-recommendation-practice
type: spine
title: "Sequence Models in Practice: What Each Step Up Buys, and What It Costs"
readingTime: 5
standalone: true
core: false
teaser: "From Markov chains to sequence transducers at Meta scale, the replication studies that rewrote the leaderboard, and the serving bill."
parent: sequential-recommendation
recallQ: "What should a team check before believing that a transformer sequence model beats a simple baseline in its product?"
recallA: "That the split runs forward in time (predict the next action from earlier ones only), that 'what usually comes next' and linear baselines are tuned as carefully, that implementations are correct and both models get the same loss and training budget (BERT4Rec's lead over SASRec vanished under equal loss), and that the freshness and history-length budget fit serving: real-time stream, daily batch or hybrid; truncation or retrieve-then-attend. Order pays off on long, varied histories; on short or habitual sequences simple models often match it."
status: accepted
concept: sequential-recommendation
state: edited
lens: generic
lang: en
visuality: text-first
depth: technical
formalism: light
lengthBand: deep
genre: explainer
carriers: prose|formula
---

A sequential recommender takes a user's chronologically ordered actions $s_1, \dots, s_t$ and scores every item $i$ by an estimate of $P(s_{t+1} = i \mid s_1, \dots, s_t)$, the probability that $i$ is the next action given everything so far. That framing has a practical consequence before any architecture is chosen: **train and test forward in time.** YouTube's team found that using the user's next watch as the label, with only earlier actions as input, worked much better than predicting a randomly held-out watch, which leaks future information and ignores asymmetric patterns such as series watched in order (Covington et al., 2016). Offline splits should follow the same rule.

## The ladder

**Markov chains.** The next item depends on the last one (or last few). FPMC (Rendle et al., 2010) factorized personalized transition matrices and combined them with matrix factorization for next-basket recommendation. The SASRec authors note that Markov-chain methods do best on very sparse datasets, where a parsimonious model matters.

**Recurrent networks.** GRU4Rec (Hidasi et al., 2016) ran a gated recurrent unit over short sessions, with a ranking loss and session-parallel mini-batches. The hidden state is a running summary of where the session is going.

**Self-attention.** SASRec (Kang & McAuley, 2018) applies causal, left-to-right attention to the most recent $n$ actions; the paper used $n = 200$ on MovieLens-1M and 50 elsewhere, roughly in proportion to actions per user. The authors report that it attends to long-range history on dense data and to recent actions on sparse data, and that it is an order of magnitude more efficient than comparable CNN/RNN models. BERT4Rec (Sun et al., 2019) attends in both directions and trains on a Cloze task: mask items, predict them from context. The full architecture, with equations, is in [the transformer walkthrough](#ch3-attention-deep).

**Linear models** stay competitive where sequences are short and habitual. ReALM (Zmeškalová et al., 2025, co-authored by one of this book's authors), an autoregressive linear model with a closed-form solution, reports beating several state-of-the-art next-basket baselines in quality and efficiency ([details](#ch7-realm)).

## Leaderboards that did not survive replication

- **Sessions.** Ludewig & Jannach (2018) compared GRU4Rec, factorized Markov models and nearest-neighbor methods; the near-trivial methods often performed equally well or significantly better. A follow-up comparing twelve algorithms, six of them neural, found nearest-neighbor heuristics preferable in most cases (Ludewig et al., 2019).
- **BERT4Rec vs SASRec.** Petrov & Macdonald (2022) reviewed the papers comparing the two and found BERT4Rec's reported superiority inconsistent; the original results replicated only when training ran far longer than the default, up to 30 times. Klenitskiy & Vasilev (2023) then trained both with the same loss, cross-entropy over all items, and SASRec beat BERT4Rec on quality and training speed. With sampled losses, SASRec needed far more than one negative per positive. The headline gap owed more to the loss and the training budget than to bidirectional attention.
- **Implementations.** Hidasi & Czapp (2023) examined six third-party reimplementations of GRU4Rec. All were flawed or missed features, with up to 99% lower accuracy and up to 335 times longer training. A broken baseline flatters every model compared against it.

## Long histories: retrieve, then attend

Self-attention over $n$ actions with $d$-dimensional embeddings costs $O(n^2 d)$ per layer: double the history and the attention work quadruples. The classic answer, as in SASRec, is to truncate to the latest few dozen or few hundred actions. Industrial systems went the other way and kept far longer histories, either by searching them first or by making attention cheaper:

- **SIM** (Pi et al., 2020, Alibaba display advertising): a General Search Unit pulls the sub-sequence relevant to the candidate item out of an arbitrarily long history, and an Exact Search Unit attends over that subset. In serving it handled histories of up to 54,000 behaviors.
- **TWIN** (Chang et al., 2023, Kuaishou) made both stages use the same relevance metric and extended target attention (the candidate item attending over the history) from about 10² to 10⁴–10⁵ behaviors.
- **HSTU** (Zhai et al., 2024, Meta) recast recommendation as sequential transduction in a generative framework. The authors report a 5.3–15.2× speed-up over FlashAttention2-based transformers on sequences of 8,192 actions, model quality that scales as a power law of training compute across three orders of magnitude, and deployment on several surfaces of a platform with billions of users.

## Freshness: stream, batch, or both

A sequence model is only as current as its last input. The PinnerFormer paper (Pancha et al., 2022) points out that sequential models commonly need streaming infrastructure to reflect the latest activity. Pinterest instead trained its user model to predict engagement over a longer future window (a "dense all-action loss"), which substantially closed the gap between an embedding computed once a day and one recomputed after every action. TransAct (Xia et al., 2023) combines the two: a transformer over the user's real-time actions inside the ranking model, plus batch user representations learned over a longer period, deployed on Pinterest's Homefeed, Related Pins, Notifications and Search.

## Before you ship a sequence model

1. Split by time; predict each next action from earlier ones only.
2. Tune "what usually comes next" item-KNN and a linear model as carefully as the transformer.
3. Use the official implementation, or reproduce its published numbers first.
4. Compare models under the same loss and training budget; with sampled losses, use many negatives.
5. Fix the freshness contract (real-time stream, daily batch, or hybrid) before choosing the architecture.
6. Budget history length: truncate, or retrieve the relevant part and then attend.

Point the same next-token machinery at item identifiers instead of scores, and you arrive at the next idea in this chapter: recommenders that *generate* the next item ([generative recommendation](#c/generative-recommendation)).

**Sources:**

- [Covington, Adams & Sargin (2016), Deep Neural Networks for YouTube Recommendations, RecSys](https://doi.org/10.1145/2959100.2959190)
- [Rendle, Freudenthaler & Schmidt-Thieme (2010), Factorizing Personalized Markov Chains for Next-Basket Recommendation, WWW](https://doi.org/10.1145/1772690.1772773)
- [Hidasi et al. (2016), Session-based Recommendations with Recurrent Neural Networks, ICLR](https://arxiv.org/abs/1511.06939)
- [Kang & McAuley (2018), Self-Attentive Sequential Recommendation, ICDM](https://arxiv.org/abs/1808.09781)
- [Sun et al. (2019), BERT4Rec, CIKM](https://arxiv.org/abs/1904.06690)
- [Zmeškalová et al. (2025), Recurrent Autoregressive Linear Model for Next-Basket Recommendation, RecSys](https://doi.org/10.1145/3705328.3759313)
- [Ludewig & Jannach (2018), Evaluation of Session-based Recommendation Algorithms, UMUAI](https://arxiv.org/abs/1803.09587)
- [Ludewig, Mauro, Latifi & Jannach (2019), Empirical Analysis of Session-Based Recommendation Algorithms](https://arxiv.org/abs/1910.12781)
- [Petrov & Macdonald (2022), A Systematic Review and Replicability Study of BERT4Rec for Sequential Recommendation, RecSys](https://arxiv.org/abs/2207.07483)
- [Klenitskiy & Vasilev (2023), Turning Dross Into Gold Loss: is BERT4Rec really better than SASRec?, RecSys](https://doi.org/10.1145/3604915.3610644)
- [Hidasi & Czapp (2023), The Effect of Third Party Implementations on Reproducibility, RecSys](https://arxiv.org/abs/2307.14956)
- [Pi et al. (2020), Search-based User Interest Modeling with Lifelong Sequential Behavior Data for CTR Prediction (SIM), CIKM](https://doi.org/10.1145/3340531.3412744)
- [Chang et al. (2023), TWIN: TWo-stage Interest Network for Lifelong User Behavior Modeling in CTR Prediction at Kuaishou, KDD](https://doi.org/10.1145/3580305.3599922)
- [Zhai et al. (2024), Actions Speak Louder than Words: Trillion-Parameter Sequential Transducers for Generative Recommendations (HSTU), ICML](https://arxiv.org/abs/2402.17152)
- [Pancha et al. (2022), PinnerFormer: Sequence Modeling for User Representation at Pinterest, KDD](https://arxiv.org/abs/2205.04507)
- [Xia et al. (2023), TransAct: Transformer-based Realtime User Action Model for Recommendation at Pinterest, KDD](https://arxiv.org/abs/2306.00248)
