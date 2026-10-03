---
id: recsys-foundation-models-tldr
type: spine
title: "Foundation Models for Recommendation in 30 Seconds"
readingTime: 1
standalone: true
core: false
teaser: "One big model instead of one per widget: what it is and who should build one, in under 150 words."
parent: recsys-foundation-models
recallQ: "What is a recommendation foundation model, and who should build one?"
recallA: "One large model that learns from all user actions on a platform by guessing each person's next action, then shares what it learned with every widget. It suits platforms with huge behavior data and many widgets; smaller products are often better served by simple, well-tuned models."
status: accepted
concept: recsys-foundation-models
state: edited
lens: generic
lang: en
visuality: text-first
depth: intro..standard
formalism: none
lengthBand: tldr
genre: explainer
carriers: prose
---

Many products run a separate recommendation model for every widget: one for the home page, one for "similar items", one for search, one for emails. Each learns alone, from its own slice of the data.

A **foundation model** flips this. One large model learns from **all** the actions people take on the platform by practicing a single task: guess each person's next action. Every widget then borrows what it learned, either its ready-made summaries of people and items or a copy trained a little further for that widget's job.

It pays off when you have **enormous amounts of behavior and many widgets** to share the cost; Netflix, Meta and Pinterest run them. A smaller shop is often better served by simple, well-tuned models that cost far less to train and run.
