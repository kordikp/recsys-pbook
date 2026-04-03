---
id: ch3-q1
type: question
title: "Which Method Would You Deploy First?"
readingTime: 1
standalone: false
teaser: "If you were building a recommendation system from scratch, which approach would you prioritize?"
voice: universal
parent: null
diagram: null
status: accepted
options:
  - letter: A, text: Collaborative filtering -- leverage behavioral signals!, voice: explorer
  - letter: B, text: Content-based -- understand the item catalog!, voice: thinker
  - letter: C, text: Hybrid -- combine multiple signals from day one!, voice: creator
  - letter: D, text: Popularity -- start with the simplest baseline!, voice: universal
---

You've just been tasked with building a recommendation system for a new platform. You need to select your initial approach. There's no wrong answer -- each choice reveals a different engineering philosophy.

**A) Collaborative filtering** -- Start by mining behavioral patterns. If enough users interact with the platform, their co-consumption signals will reveal what to recommend. Discovery through behavioral data is the most powerful signal.

**B) Content-based** -- Start by deeply understanding the item catalog. Analyze content features, build rich representations. Strong item understanding provides a foundation everything else builds on.

**C) Hybrid** -- Why choose? Architect a system that integrates multiple retrieval sources from day one. The upfront complexity pays dividends in recommendation quality.

**D) Popularity** -- Start with the simplest approach that delivers value. Surface what's trending. Accumulate interaction data first, deploy sophisticated models later. Ship the baseline, then iterate.
