---
id: recsys-foundation-models-inside
type: spine
title: "Inside a Recommendation Foundation Model: Pretrain, Plug In, Pay the Bill"
readingTime: 8
standalone: true
core: false
teaser: "How Netflix, Meta and Pinterest pretrain on behavior, the three ways a surface consumes the result, what the scaling evidence does and does not show, and a checklist before you build one."
parent: recsys-foundation-models
recallQ: "Which three integration patterns let surfaces consume a recommendation foundation model, and why does the scaling evidence not settle whether you should build one?"
recallA: "Precomputed embeddings (cheap, stale between refreshes), the model as a subgraph fine-tuned inside the surface's model (fresh, but heavier and slower), and a fine-tuned copy used directly (adapted to one surface, but another model to serve and maintain). Scaling curves show quality rising with compute at platforms with billions of interactions, while at low compute hand-engineered models can win and tuned simple baselines are often competitive; whether a step up pays depends on how many surfaces and how much traffic share its training and serving cost."
status: accepted
concept: recsys-foundation-models
state: edited
lens: generic
lang: en
visuality: text-first
depth: technical
formalism: light
lengthBand: deep
genre: explainer
carriers: prose|table|formula
---

A **recommendation foundation model** is one large model pretrained on a platform's whole interaction stream, usually by predicting the next event, whose learning many surfaces then reuse. This telling covers what you would actually be building, drawing on what Netflix, Meta and Pinterest have published about their own systems.

## Pretraining on behavior

**The corpus is the interaction log.** Netflix reports hundreds of billions of interactions from over 300 million users, a volume it compares to the token counts of language-model training. Raw events are **tokenized**: adjacent actions on the same title are merged into one token (the post draws the analogy to byte-pair encoding), keeping details such as the total watch duration. The trade-off mirrors vocabulary size against context length in LLMs: overly lossy tokens lose signal, overly granular sequences exceed practical limits on processing time and memory.

**Tokens are heterogeneous.** Each one carries action attributes (time, device, duration, locale) and item attributes (ID, genre, release country). Netflix splits them into *request-time* features, known when the prediction is made, and *post-action* features, known only afterwards; the input for each step combines that step's request-time features with the previous step's post-action features, so the model never peeks at the answer.

**The objective is next-token prediction, adjusted for recommendation.** Not every target is equal (a five-minute trailer play should not count like a two-hour watch), and the very next click is a short-sighted target. Netflix describes multi-token prediction, which asks the model for the next several actions to capture longer-term dependencies, and auxiliary targets such as genre, which regularize the noisy item-ID target and narrow the candidate list.

**Context is the hard constraint.** Active members' histories run to thousands of events, but serving windows are often limited to hundreds because the surfaces need millisecond latency. Netflix trains with sparse attention (low-rank compression) and sliding-window sampling over the full history, and uses KV caching when it needs multi-step decoding at inference.

## What the scaling evidence shows, and what it does not

- **Meta (HSTU, ICML 2024)** reformulated retrieval and ranking as sequential transduction. Quality followed a power law in training compute across three orders of magnitude; the classic deep-learning recommendation models (DLRMs) it compared against plateaued and saturated at about 200 billion parameters, while the generative recommenders reached 1.5 trillion. Deployed on multiple surfaces "of a large internet platform with billions of users", they report a 12.4% improvement in online A/B test metrics. The same paper notes that **at low compute, DLRMs may outperform them thanks to hand-crafted features**.
- **Netflix** reports that the scaling law also holds for its foundation model, with consistent gains as data and model size grow.
- **Academic scale (Zhang et al., RecSys 2024):** ID-only sequential models up to 0.8B parameters still followed a scaling law, even with constrained data, and larger models clearly helped on harder tasks such as cold start and long-term preference.

Read a power law $L(C) \approx a\,C^{-\alpha}$ (loss $L$ against training compute $C$) as an economic statement: inside the fitted range, every tenfold increase in compute cuts the loss by the same factor $10^{-\alpha}$. Each step costs ten times the training compute and buys a constant fraction of a shrinking loss. Whether that step pays depends on what a point of quality is worth, multiplied by traffic and by the number of surfaces sharing the cost. That is why the curves come from platforms where a fraction of a percent justifies a GPU cluster.

What the curves do not show is that a mid-sized catalog sits on the same curve. The bar to beat is a tuned simple model: Dacrema et al. (RecSys 2019) could reproduce only 7 of 18 neural recommenders from top venues with reasonable effort, and 6 of those 7 were often beaten by simple nearest-neighbor or graph heuristics. The [EASE and ELSA](#c/ease-elsa) line of linear models makes the same point from the other side.

## Three ways to plug it in

Netflix runs all three in production and picks one per use case:

| Pattern | What the surface gets | Freshness | Cost to the surface |
|---|---|---|---|
| **Embeddings** from a store | member and title vectors as features or retrieval candidates | refreshed daily; stale in between | lowest; Netflix calls it "low cost and high leverage" and the default starting point |
| **Subgraph** | the decoder runs inside the surface's model and is fine-tuned with it | no gap | extra feature generation, a larger model, higher latency; reserved for high-impact uses |
| **Fine-tuned copy** | the model trained further on the surface's data and objective, optionally with a new head or frozen layers | depends on its own retraining and serving | its own latency and SLA work, and one more model to maintain |

The operational rhythm matters as much as the architecture: Netflix pretrains from scratch monthly and fine-tunes daily, and the daily job extends the ID vocabulary to newly launched titles. Because each retrain starts from a new random initialization, embedding spaces are incompatible between runs, so Netflix maps every day's embeddings into a stable space. Without that step, every downstream consumer would have to adapt to every retrain, risking bugs.

**Pinterest's PinFM** (RecSys 2025) takes the fine-tuning route. A transformer with over 20 billion parameters, pretrained on two years of activity sequences, is fine-tuned together with the ranking models of the Home feed and the Related Items feed. Those models must answer within hundreds of milliseconds and score millions of items per second. The ID embedding table is served from a CPU cluster, separate from the GPU-served dense model, and a deduplicated cross-attention design (DCAT) raised throughput by 600% on internal data; with int4-quantized embeddings, the deployment came at neutral cost and marginal latency increase. The paper also explains why Pinterest preferred fine-tuning to using the large model only as a distillation teacher: waiting for production models to learn from a new teacher "can take months" and slows experimentation.

## Cold start in a model with an ID vocabulary

Language models keep a stable vocabulary; a catalog does not. Netflix warm-starts each new model from the previous parameters and initializes new title embeddings from averages or from metadata-similar titles. More importantly, it **mixes a learnable ID embedding with a metadata embedding through attention keyed on the title's age**, so young titles lean on metadata, and it adds randomness in training so the model learns to use metadata at all. Pinterest randomizes candidate IDs during fine-tuning and adds dropout for fresh items, and reports a 20% increase in engagement with new items. Both are learned versions of the content bridge from [item cold start](#c/item-cold-start).

## Honest limits

- **Fixed cost before the first benefit.** Pretraining compute, a retraining cadence, an embedding store and a platform team come before any surface improves. A foundation model is infrastructure, not a model.
- **The zoo partly returns.** Netflix notes that fine-tuned copies "can lead to more models and pipelines to maintain across the organization".
- **Coupling.** Every surface now depends on one upstream artifact. Version it, stabilize its embeddings, and watch each surface's own guardrail metrics after every release (see [monitoring](#c/monitoring)).
- **Latency stays the master.** Serving windows of hundreds of events against histories of thousands; distillation helps (Netflix is building a smaller distilled version) but slows iteration, as the Pinterest authors point out. See [production at scale](#c/production-scale).
- **Data governance.** One model trained on every surface's behavior is a decision for your privacy team as well as your ML team: check whether data collected for one surface may train a model that serves all of them. Meta's authors argue a possible upside, that needing fewer hand-built features could make systems more privacy-friendly.
- **It is not the whole [pipeline](#c/pipeline).** A foundation model improves the predictions that retrieval and ranking consume; diversity, business rules and safety policy still need their own owners.

## Before you build one

| Signals it may pay | Signals it will not, yet |
|---|---|
| many surfaces with duplicated pipelines over the same logs | one or two surfaces |
| long histories that per-surface models truncate | short or sparse histories |
| frequent new items or new surfaces | a tuned simple baseline you have not yet beaten |
| a platform team, a feature or embedding store, a GPU budget | none of those |

The middle path is to **borrow representations** instead of pretraining your own: text encoders trained on behavior such as [beeFormer](#c/beeformer), or LLM-derived item embeddings (see [LLM-powered recommendation](#c/llm-recommenders)), feeding small per-surface models. For most product teams the deciding question is how many surfaces would share the bill, not which architecture to pick.

**Sources:**
- Hsiao, Feng, Lamkhede: [Foundation Model for Personalized Recommendation](https://netflixtechblog.com/foundation-model-for-personalized-recommendation-1a0bd8e02d39), Netflix TechBlog, March 2025
- Gadde, Hsiao, Patel, Bhattacharya: [Integrating Netflix's Foundation Model into Personalization applications](https://netflixtechblog.medium.com/integrating-netflixs-foundation-model-into-personalization-applications-cf176b5860eb), Netflix TechBlog, November 2025
- Zhai et al.: [Actions Speak Louder than Words: Trillion-Parameter Sequential Transducers for Generative Recommendations](https://proceedings.mlr.press/v235/zhai24a.html), ICML 2024
- Chen et al.: [PinFM: Foundation Model for User Activity Sequences at a Billion-scale Visual Discovery Platform](https://doi.org/10.1145/3705328.3748050), RecSys 2025
- Zhang et al.: [Scaling Law of Large Sequential Recommendation Models](https://doi.org/10.1145/3640457.3688129), RecSys 2024
- Ferrari Dacrema, Cremonesi, Jannach: [Are We Really Making Much Progress? A Worrying Analysis of Recent Neural Recommendation Approaches](https://doi.org/10.1145/3298689.3347058), RecSys 2019
