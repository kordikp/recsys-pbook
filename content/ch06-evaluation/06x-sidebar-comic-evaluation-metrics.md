---
id: comic-evaluation-metrics
type: spine
title: "The Clean-Plate Test Has a Serving Problem"
readingTime: 1
standalone: true
core: false
teaser: "A four-panel comic: Offline logs favor popular items; a β=0.30 penalty reduces bias, unless the metric gets gamed."
voice: explorer
parent: evaluation-metrics
recallQ: "What is the offline evaluation bias and how can it be corrected?"
recallA: "Offline data reflects the OLD system — new models recommending different items look worse because those items were never shown. Correction: LLOO with popularity penalization (β ≈ 0.30) improves model selection accuracy from 12.9% to 34.3%."
status: accepted
concept: evaluation-metrics
state: edited
generator: gpt-5.6-sol
lens: generic
lang: en
visuality: visual-first
depth: intro..standard
formalism: none
lengthBand: tldr
genre: comic
carriers: prose|image
---

![The Clean-Plate Test Has a Serving Problem — a four-panel comic: the old waiter served the burger 100 times and the bowl only 4, so the offline test says the burger wins; counting rarely served dishes more, with a popularity penalty of β ≈ 0.30, makes the offline test pick the live winner 34.3% instead of 12.9% of the time; once clean plates become the goal, portions shrink](images/comic-evaluation-metrics.svg)

*Offline logs favor popular items; a β=0.30 penalty reduces bias, unless the metric gets gamed.*