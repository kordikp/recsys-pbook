---
id: comic-production-scale
type: spine
title: "The Lunch Rush Has a Memory Budget"
readingTime: 1
standalone: true
core: false
teaser: "A four-panel comic: keep only each item's strongest few numbers and 307 GB of item data fits in 26 GB, with clicks only 1.35% lower."
voice: explorer
parent: production-scale
recallQ: "How does CompresSAE achieve 12× embedding compression with minimal quality loss?"
recallA: "A sparse autoencoder compresses dense embeddings using top-k sparsification. The kernel trick enables O(k²) retrieval on sparse codes instead of O(d) on dense vectors. Result: 307 GB → 26 GB with only 1.35% CTR loss."
status: accepted
concept: production-scale
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

![The Lunch Rush Has a Memory Budget — a four-panel comic: 100 million items need 307 GB; CompresSAE keeps each item's strongest few numbers, compares items through a ready-made table, and fits everything in 26 GB with clicks only 1.35% lower](images/comic-production-scale.svg)

*CompresSAE keeps only each item's strongest few numbers: 307 GB shrinks to 26 GB (12× smaller), and clicks drop only 1.35%.*