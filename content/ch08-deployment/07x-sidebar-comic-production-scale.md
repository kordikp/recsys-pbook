---
id: comic-production-scale
type: spine
title: "The Lunch Rush Has a Memory Budget"
readingTime: 1
standalone: true
core: false
teaser: "A four-panel comic: CompresSAE reconstructs embeddings from sparse codes: 307 GB to 26 GB, with 1.35% CTR loss."
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
carriers: image
---

![The Lunch Rush Has a Memory Budget — a four-panel comic](images/comic-production-scale.svg)

*CompresSAE reconstructs embeddings from sparse codes: 307 GB to 26 GB, with 1.35% CTR loss.*