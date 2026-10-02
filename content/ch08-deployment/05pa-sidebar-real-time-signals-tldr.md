---
id: real-time-signals-tldr
type: spine
title: "Real-Time Signals in 30 Seconds"
readingTime: 1
standalone: true
core: false
teaser: "Fresh clicks make better recommendations, until the model is trained on one version of a number and served another."
parent: real-time-signals
recallQ: "What is training–serving skew, and why do real-time features make it more likely?"
recallA: "Training–serving skew is when the features a model sees in production differ from the ones it was trained on: computed by different code, at a different time, or with future information that leaked into the training data. Real-time features are computed on a separate streaming path, under time pressure, while the training copy is usually rebuilt later from complete logs, so the two versions drift apart easily. The fix is to log the features exactly as they were served and train on those logs."
status: draft
concept: real-time-signals
state: edited
lens: ecommerce
lang: en
depth: intro..standard
formalism: none
visuality: text-first
lengthBand: tldr
genre: explainer
carriers: prose
---

Maya opens three tents; the shop, working from last night's profile, offers her a frying pan. **Real-time signals** fix that: her latest clicks reach the model within seconds.

The model reads **features**, small facts like "views of this tent in the last hour". Live, a fast streaming program computes them. For training, the team usually rebuilds them later from complete logs, with different code. The two versions drift: live counts arrive late, and the rebuilt ones may include clicks from *after* the moment being predicted. That mismatch is **training–serving skew**. The model learns from one number and gets another, and nothing raises an error.

The fix: **save features exactly as served and train on those**. And streams cost round-the-clock care, so add them only where a day-old view really hurts.
