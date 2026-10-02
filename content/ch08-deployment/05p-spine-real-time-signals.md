---
id: real-time-signals
type: spine
title: "Real-Time Signals: Why the Last Five Minutes Matter"
readingTime: 3
standalone: true
core: false
teaser: "She has opened three tents in five minutes. The homepage still offers her a frying pan. Freshness costs money, and it can break in a way no dashboard shows."
parent: null
diagram: diagram-real-time-signals-tiers
recallQ: "What is training–serving skew, and why do real-time features make it more likely?"
recallA: "Training–serving skew is when the features a model sees in production differ from the ones it was trained on: computed by different code, at a different time, or with future information that leaked into the training data. Real-time features are computed on a separate streaming path, under time pressure, while the training copy is usually rebuilt later from complete logs, so the two versions drift apart easily. The fix is to log the features exactly as they were served and train on those logs."
highlights:
  - "Signals arrive in three tiers: nightly batch (long-term taste), streaming (minutes: counts and trends), request-time (seconds: this session)"
  - "Freshness pays where intent shifts fast (news, live events, short video, in-session shopping); a stable catalog and stable taste can live with daily updates"
  - "Training–serving skew: the model is trained on one version of a feature and served another, so it fails quietly"
  - "Log features at serving time and train on those logs; reuse the same feature code in both paths"
status: draft
concept: real-time-signals
conceptTitle: "Real-time signals"
parents: pipeline|session-based|context-awareness
state: edited
lens: ecommerce
lang: en
depth: standard
formalism: none
visuality: balanced
lengthBand: deep
genre: explainer
carriers: prose|diagram
---

For a year, Maya has bought kitchen gear from an online department store. Tonight at 21:04 she searches "tent" and opens three of them. The homepage still offers her a frying pan, because her profile was last computed at 3 a.m.

**Real-time signals** are what the store knows about her from the last few minutes, delivered to the model before it ranks the next page. A model reads **features**: single facts or numbers about the user, the item and the moment ("bought kitchenware 14 times", "this tent was viewed 300 times in the last hour"). Features come in three tiers of freshness:

- **Batch (daily).** Long-term taste, item similarities, bestseller lists, recomputed overnight. Cheap and stable, but up to a day old.
- **Streaming (minutes).** Each click becomes an **event** on a stream, a conveyor belt of events that a job keeps reading to update counters such as "views in the last hour" or "sold out". The results go into a **feature store**, a shared table that hands features to the model in milliseconds.
- **Request-time (seconds).** The current session (her last three clicks) travels with the request itself, so the [pipeline](#c/pipeline) can rank with it straight away (see [session-based recommendation](#c/session-based)).

With all three, the page Maya loads at 21:06 leads with sleeping bags and camping stoves.

**What it costs.** The nightly batch can fail and be rerun the next morning. A stream runs around the clock, needs someone on call, and when it stalls, its features freeze without an error: the model keeps ranking with half-hour-old "last hour" counts. Freshness pays where intent moves fast: news, live sports, short video, a shopping session that just changed direction. Where the catalog changes weekly and taste is stable, daily is often enough. Google's *Rules of Machine Learning* suggests one question to ask first: how much quality do you lose with a model that is a day old? A week old?

**The failure nobody sees: training–serving skew.** The store adds the feature "tent views in the last hour". For training, an engineer rebuilds it afterwards from the complete click logs with a database query. In production, the streaming job computes it with different code, and phone events arrive late, so the live number usually comes out lower. Worse, the training query counted views up to the end of each hour, including some from *after* the recommendation was shown, often by the very shoppers who went on to buy. The model learned "many recent views means a sale" partly from the future. The offline test looks excellent, and the A/B test shows nothing.

That is **training–serving skew**: the model sees different features in production from those it learned on. Different code, different timing, or **leakage** (future information in training data) all produce it. Real-time features are especially prone because they have two implementations, one fast and live and one rebuilt later, and no error message tells you they disagree.

Two habits prevent most of it. **Log features at serving time**: save every feature exactly as the model saw it and train on those logs. Google's guide reports that the YouTube home page gained quality and lost code complexity by switching to this. When you must rebuild features, use **point-in-time** joins, which give each training example only the values that existed at that moment. Check for skew the way you check anything else in [monitoring](#c/monitoring).

Before you buy a stream, measure what a day of staleness costs you. If you buy one, log what you serve.

**Sources:**
- Zinkevich, M. *Rules of Machine Learning: Best Practices for ML Engineering*, Google (Rule #8 freshness, Rule #29 logging features at serving time with the YouTube example, Rule #32 code reuse, definition of training–serving skew). https://developers.google.com/machine-learning/guides/rules-of-ml
- Feast documentation, *Point-in-time joins* (reproducing feature values as of each event; keeping backfilled values out of training data). https://docs.feast.dev/getting-started/concepts/point-in-time-joins
