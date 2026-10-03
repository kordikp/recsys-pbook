---
id: sequential-recommendation
type: spine
title: "Sequential Recommendation: Order Matters"
readingTime: 2
standalone: true
core: false
teaser: "Two listeners played the same five tracks in a different order. They should not get the same next song."
parent: null
diagram: diagram-order-matters
recallQ: "What does a sequential recommender use that an unordered profile ignores, and when is the extra cost worth it?"
recallA: "The order and recency of a person's actions. It predicts the next item from the sequence, like next-word prediction, so it catches the current intent that an all-time profile averages away (models range from transition counts and recurrent networks to transformers such as SASRec, whose attention weighs which past actions matter now). It pays off with long, varied histories where intent shifts; on short sessions or repetitive habits, simple 'what usually comes next' baselines often match it at much lower cost."
highlights:
  - "Same items in a different order imply a different next need: order and recency reveal current intent, which an unordered (bag-of-items) profile averages away; the task is next-item prediction, framed like next-word prediction."
  - "The model ladder: transition counts / Markov chains -> recurrent networks (GRU4Rec) -> transformers with self-attention (SASRec, BERT4Rec) that learn which past actions matter now; items enter as embeddings, and the output feeds retrieval (a 'right now' query) or ranking."
  - "Why order pays off for a product: intent shifts within and across sessions (moods, series, complements); training to predict the next action from earlier ones beats predicting a randomly held-out one (Covington et al., 2016)."
  - "Costs and limits: fresh events must reach the model quickly (streaming vs daily batch), attention cost grows with the square of history length (truncate, or retrieve the relevant part and then attend), and on short or repetitive sequences simple co-occurrence or linear baselines often match deep sequence models, so compare against tuned baselines."
status: accepted
concept: sequential-recommendation
conceptTitle: "Sequential recommendation"
parents: embeddings|pipeline
state: edited
lens: media
lang: en
visuality: balanced
depth: standard
formalism: none
lengthBand: standard
genre: explainer
carriers: prose|diagram
objective: "Understand that reading a person's actions as an ordered sequence and predicting the next one (next-item prediction, framed like next-word prediction) captures current intent that an unordered profile averages away; know the model ladder from transition counts to transformers, and judge when the extra cost is worth paying."
forbidden: "invented statistics or benchmark numbers | invented citations, URLs, or paper titles | claiming a single method fully solves the problem | claiming transformers always beat simple sequence baselines | presenting BERT4Rec as settled-superior to SASRec (contested by Petrov & Macdonald 2022 and Klenitskiy & Vasilev 2023) | unsourced platform-specific claims about how a named company weights user history"
---

Ana and Ben each played the same five tracks in the last 24 hours: three fast running songs and two recordings of gentle rain. Ana ran in the morning and has just put the rain on at 23:00. Ben fell asleep to the rain last night and is three songs into his morning run.

A profile that stores history as an **unordered bag of items** sees two identical listeners and serves them the same next track. Somebody is about to get 170 beats per minute at bedtime.

**Sequential recommendation** reads the history in order, the way you read a sentence, with the latest actions weighing most. The task becomes **next-item prediction**: given what this person just did, what comes next? Language models guess the next word the same way. Ana gets more rain; Ben gets the next running track.

Models that read the sequence, lightest first:

- **Transition counts** (a *Markov chain*): "after track A, listeners usually play B." Only the last track or two matter, and it is cheap.
- **Recurrent networks** such as GRU4Rec (2016) read actions one at a time and carry a running summary of where the listener is heading.
- **Transformers** such as SASRec (2018) and BERT4Rec (2019), the architecture family behind today's chatbots, look at the whole recent history at once. Their **self-attention** learns how much each past action should count for *this* prediction. Each track enters as an [embedding](#c/embeddings), so similar tracks look alike to the model.

In the [retrieve-then-rank pipeline](#c/pipeline), the sequence model's output usually becomes a "right now" query for retrieval or extra input for the ranker.

**Why order pays off.** It catches **intent shifts**: focus music turning into a party mix, a viewer halfway through a series who wants episode 5, not a new pilot. YouTube's engineers reported much better results when their model learned to predict a user's *next* watch instead of a randomly hidden one, partly because series are watched in order.

**What it costs.**

1. *Freshness.* The model is only as current as the last play it sees, so new plays should reach it within seconds. Fed yesterday's history, it predicts yesterday.
2. *Compute.* Attention compares every past action with every other, so doubling the history roughly quadruples that work. Systems keep only recent actions, or search a long history for the relevant part first.
3. *It does not always win.* Long, varied histories reward it. On short visits and repetitive habits, careful comparisons found simple "what usually comes next" baselines matching or beating deep sequence models (see [session-based recommendation](#c/session-based)).

**Takeaway:** if your users' last few actions predict their next one better than their all-time favorites, order is worth paying for. Tune a "what usually comes next" baseline first: it sets the bar the transformer must clear.

**Sources:**

- [Covington, Adams & Sargin (2016), Deep Neural Networks for YouTube Recommendations, RecSys](https://doi.org/10.1145/2959100.2959190)
- [Hidasi et al. (2016), Session-based Recommendations with Recurrent Neural Networks (GRU4Rec), ICLR](https://arxiv.org/abs/1511.06939)
- [Kang & McAuley (2018), Self-Attentive Sequential Recommendation (SASRec), ICDM](https://arxiv.org/abs/1808.09781)
- [Sun et al. (2019), BERT4Rec, CIKM](https://arxiv.org/abs/1904.06690)
- [Ludewig & Jannach (2018), Evaluation of Session-based Recommendation Algorithms, UMUAI](https://arxiv.org/abs/1803.09587)
- [Pancha et al. (2022), PinnerFormer: Sequence Modeling for User Representation at Pinterest, KDD](https://arxiv.org/abs/2205.04507)
- [Zmeškalová et al. (2025), Recurrent Autoregressive Linear Model for Next-Basket Recommendation (ReALM), RecSys](https://doi.org/10.1145/3705328.3759313)
