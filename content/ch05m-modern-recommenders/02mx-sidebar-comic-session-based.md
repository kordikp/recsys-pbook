---
id: comic-session-based
type: spine
title: "No Past, Just Browsing"
readingTime: 1
standalone: true
core: false
teaser: "A four-panel comic: three anonymous clicks starve a deep model, while item-KNN just counts what other shoppers clicked alongside."
voice: explorer
parent: session-based
recallQ: "Why do simple baselines like item-KNN often outperform deep learning models in session-based recommendation?"
recallA: "Sessions are typically very short (3-10 items), providing minimal sequential signal for complex models to exploit. Simple co-occurrence patterns -- 'users who clicked X in this session also clicked Y' -- capture most of the useful information. Deep models need longer sequences to learn meaningful temporal dependencies that justify their added complexity."
status: accepted
concept: session-based
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

![No Past, Just Browsing — a four-panel comic](images/comic-session-based.svg)

*A visit gives only a few clicks: too little for a deep model to learn a pattern from, but enough for item-KNN, which simply counts what other shoppers clicked alongside.*