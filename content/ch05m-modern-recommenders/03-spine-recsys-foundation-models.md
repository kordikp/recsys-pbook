---
id: recsys-foundation-models
type: spine
title: "One Model, Many Surfaces: Foundation Models for Recommendation"
readingTime: 3
standalone: true
core: false
teaser: "Six widgets, six models, six opinions about the same viewer. Why the largest platforms now pretrain one model for all of them, and why you might not want to."
parent: null
diagram: diagram-recsys-foundation-model
recallQ: "What is a recommendation foundation model, and when is it worth building one?"
recallA: "One large model pretrained on a platform's whole stream of user interactions (typically by predicting each person's next action) whose learning is reused by many surfaces: as shared embeddings, as a part plugged into a surface's own model, or as a fine-tuned copy. It pays off with very large behavior data and many surfaces to share the cost; with modest data or few surfaces, well-tuned simpler models are often as good and far cheaper."
highlights:
  - "One large model pretrained on all interactions (predict the next action) replaces the core of many per-widget models"
  - "Surfaces reuse it as embeddings, as a plug-in part of their own model, or as a fine-tuned copy"
  - "It buys shared learning and a head start for new titles and new surfaces; it costs compute, latency work and coupling"
  - "The evidence comes from platforms with hundreds of millions of users or more; with modest data, tuned simple models often win on value"
status: draft
concept: recsys-foundation-models
conceptTitle: "Foundation models for recommendation"
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
---

Count the places in your product that recommend something, then count the models behind them: if the numbers match, this idea is about you.

## The zoo: one model per widget

Picture **Nightjar**, a fictional streaming service. Its home rows, search, "more like this" strip and new-episode alerts are each a **surface**, a place where recommendations appear, and each grew its own model and team. Six surfaces, six models, six slightly different opinions about whether you like documentaries. A trick one team discovers never reaches the other five.

Not a strawman: in 2025 Netflix wrote that, as its specialized models multiplied, maintenance "became quite costly" and innovations were hard to transfer because each model was trained on its own.

## One model that reads everything

A **foundation model for recommendation** is one large model **pretrained** on the platform's whole interaction stream (plays, searches and skips from every surface) on one task: **predict each person's next action**, the task of [sequential recommendation](#c/sequential-recommendation). Language models do this with words; here the "words" are actions such as *watched 40 minutes of a thriller on the TV at 9 pm*. It learns from behavior, not internet text, so it is not a chatbot.

Netflix's surfaces reuse it in three ways:

- its [embeddings](#c/embeddings) of members and titles as ready-made inputs (cheap, slightly stale);
- the model plugged into a surface's own model (fresher, heavier);
- a **fine-tuned** copy, trained a little further on one surface's data and goal.

## What it buys, what it costs

**It buys** shared learning: one improvement reaches every surface. A new surface starts from a fine-tuned copy instead of months of hand-building inputs. New titles get a head start: Netflix blends each title's description (genre, tone, storyline) with its learned identity, leaning on the description while the title is young, an [item cold start](#c/item-cold-start) bridge built into the model.

**It costs** compute: Netflix pretrains from scratch monthly and fine-tunes daily. It must still fit the [pipeline](#c/pipeline)'s millisecond budget, which pushes teams towards precomputed embeddings and smaller **distilled** copies trained to imitate the big one. And it couples everything: retrain the shared model and every surface that uses it must cope.

The evidence comes from giants: Netflix (over 300 million users), Meta and Pinterest. Meta's researchers saw quality keep rising with compute where classic models plateaued, yet at small compute budgets the classic models with hand-built inputs could still win.

**The takeaway:** a foundation model is a bet that you have enough behavior, and enough surfaces sharing it, to fill a very large model. With modest traffic, well-tuned simple models, or a pretrained encoder you borrow such as [beeFormer](#c/beeformer), are often the better trade. Count your surfaces and your data before you count parameters.

**Sources:**
- Hsiao, Feng, Lamkhede: [Foundation Model for Personalized Recommendation](https://netflixtechblog.com/foundation-model-for-personalized-recommendation-1a0bd8e02d39), Netflix TechBlog, March 2025
- Gadde, Hsiao, Patel, Bhattacharya: [Integrating Netflix's Foundation Model into Personalization applications](https://netflixtechblog.medium.com/integrating-netflixs-foundation-model-into-personalization-applications-cf176b5860eb), Netflix TechBlog, November 2025
- Zhai et al.: [Actions Speak Louder than Words: Trillion-Parameter Sequential Transducers for Generative Recommendations](https://proceedings.mlr.press/v235/zhai24a.html), ICML 2024 (Meta)
- Chen et al.: [PinFM: Foundation Model for User Activity Sequences at a Billion-scale Visual Discovery Platform](https://doi.org/10.1145/3705328.3748050), RecSys 2025 (Pinterest)
