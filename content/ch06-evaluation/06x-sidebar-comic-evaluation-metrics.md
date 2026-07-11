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
carriers: image
---

![The Clean-Plate Test Has a Serving Problem — a four-panel comic](images/comic-evaluation-metrics.svg)

*Offline logs favor popular items; a β=0.30 penalty reduces bias, unless the metric gets gamed.*