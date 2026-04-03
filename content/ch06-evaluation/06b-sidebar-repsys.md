---
id: ch7-repsys
type: spine
title: "RepSys: Interactive Evaluation You Can See"
readingTime: 2
standalone: true
core: false
teaser: "Numbers on a spreadsheet don't reveal why one model feels better than another. RepSys lets you see and compare recommendations interactively."
voice: explorer
parent: ch7-evaluation
diagram: null
recallQ: "What does RepSys provide that standard evaluation metrics don't?"
recallA: "Qualitative, visual comparison of recommendation models. You can see actual recommended items side by side, explore user segments, and understand failure modes that aggregate metrics hide."
publishedAt: "2026-04-03"
status: accepted
---

Standard recommendation evaluation produces a table: Model A nDCG@10 = 0.342, Model B nDCG@10 = 0.351. Model B wins. Ship it.

But **why** is Model B better? Does it find better niche items? Is it less biased toward popular content? Does it work better for some user segments and worse for others? The numbers don't tell you.

**RepSys** (Šafařík, Vančura, Kordík, Kasalický — RecSys 2022) is an open-source tool that makes recommendation evaluation visual and interactive.

## What RepSys Shows

**Side-by-side comparison.** View actual recommendations from multiple models for the same user. Not scores — actual items. This immediately reveals qualitative differences invisible in aggregate metrics.

**User segment exploration.** Select user groups (by activity level, preference diversity, lifecycle stage) and see how models perform differently across segments.

**Item distribution analysis.** Visualize which items each model recommends — does it concentrate on the head or explore the tail? Does it cover all categories or favor certain genres?

**Embedding space visualization.** Explore learned user and item embeddings with interactive t-SNE/UMAP plots. See clusters, outliers, and neighborhood structure.

## Why Visual Evaluation Matters

**Aggregate metrics hide failures.** A model with nDCG 0.35 might achieve this by perfectly serving 80% of users and completely failing for 20%. Only visual inspection reveals this.

**Qualitative signals matter.** A model that recommends "technically correct" items might still feel wrong — the items are relevant but boring, or diverse but incoherent. Human judgment catches this; metrics don't.

**Debugging requires examples.** When you find a problem ("Model B is worse for new users"), you need to see specific examples to diagnose the cause. Abstract metrics don't support diagnosis.

## Using RepSys in Practice

1. **After training:** Compare new model against production baseline visually before A/B testing
2. **During analysis:** When offline metrics are close (Model A: 0.342 vs Model B: 0.345), visual comparison reveals which model you'd actually prefer
3. **For stakeholders:** Product managers and executives understand concrete examples better than metric tables
4. **For debugging:** When users report bad recommendations, trace through the model's decisions

**Open source:** github.com/cowjen01/repsys

**Consider this:** The best evaluation combines quantitative metrics (for overall comparison) with qualitative inspection (for understanding). RepSys provides the qualitative half — and often, that's where the most actionable insights live.