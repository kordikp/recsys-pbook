---
id: ch3-pipeline
type: spine
title: "The Recommendation Pipeline"
readingTime: 3
standalone: true
core: true
teaser: "Production systems don't use just one method. They orchestrate ALL of them in a multi-stage pipeline."
voice: universal
parent: null
diagram: kids-pipeline
recallQ: "What are the 3 stages of a recommendation pipeline?"
recallA: "RETRIEVE candidates (fast, high recall), RANK them (precise scoring model), RE-RANK for business logic and diversity."
highlights:
  - "Production systems combine methods in 3 stages: Retrieve → Score → Re-rank"
  - "Retrieval is fast and rough; scoring is precise; re-ranking adds diversity"
  - "The entire pipeline runs in under 200 milliseconds"
status: accepted
---

Here's a critical architectural insight: production recommendation systems don't commit to a single method. They don't say "we're a collaborative filtering company" or "we only use content-based approaches."

They use **everything**. All methods. Together. In a carefully orchestrated sequence.

This is the **recommendation pipeline** (sometimes called the funnel or cascade architecture), and every major platform deploys one. The design follows a fundamental engineering principle: progressive refinement with increasing computational cost at each stage.

## Stage 1: CANDIDATE GENERATION (Retrieval)

First, the system casts a wide net. Out of millions (or billions) of possible items, it rapidly retrieves a few hundred to a few thousand that MIGHT be relevant to this user.

It deploys multiple retrieval sources in parallel:
- **Collaborative filtering**: "Users with similar interaction patterns engaged with these"
- **Content-based**: "These items share features with recently consumed items"
- **Two-tower models**: ANN search for nearest items in the embedding space
- **Popularity**: "These are trending in the user's region/segment"
- **Social graph**: "People in the user's network engaged with these"

The goal at this stage is **high recall, not precision**. The system needs to narrow millions of items down to roughly 500-1000 candidates in single-digit milliseconds. False positives are acceptable here -- false negatives are costly.

This is the stage where most computational savings occur. Going from 100M items to 1000 candidates is a 100,000x reduction in the search space.

## Stage 2: SCORING (Ranking)

Now the system takes those ~1000 candidates and carefully scores each one with a more expressive (and expensive) model. This is where the sophisticated ML happens.

For each candidate, the scoring model predicts:
- P(click) -- probability of engagement initiation
- P(completion) -- probability of full consumption (e.g., watch time)
- P(positive signal) -- probability of explicit positive feedback (like, save, share)
- P(conversion) -- probability of downstream action (purchase, subscription)

These predictions are combined into a composite score, often as a weighted sum calibrated to the platform's optimization objective. The weights reflect business priorities (e.g., optimizing for long-term retention vs. short-term engagement).

Each item receives a score. The system ranks them from highest to lowest.

This stage typically uses cross-feature models (deep neural networks with user-item feature interactions) that are too expensive to run over the full corpus but feasible for ~1000 candidates.

## Stage 3: RE-RANKING (Post-Processing)

The top-ranked items aren't presented directly. The system applies final business logic and diversity constraints:

- **Diversity**: Avoid serving 10 items from the same category consecutively. Apply intra-list diversity using techniques like MMR (Maximal Marginal Relevance) or DPP (Determinantal Point Processes).
- **Freshness**: Inject recent content to avoid staleness and support content ecosystem health.
- **Policy compliance**: Apply content safety filters, regulatory constraints, and platform rules.
- **De-duplication**: Remove near-duplicate items and previously consumed content.
- **Position bias correction**: Account for the fact that higher positions receive more attention regardless of item quality.
- **Exploration slots**: Reserve positions for bandit-selected items to enable preference discovery.

This stage balances the scoring model's predictions against system-level objectives that no single-item model can capture.

## The Result

After all three stages, approximately 10-30 items appear on the user's screen. Each one survived a rigorous funnel:

- Started as one of hundreds of millions of possibilities
- Survived retrieval to enter the ~1000 candidate set
- Was scored and ranked by an expressive prediction model
- Passed re-ranking filters for diversity, freshness, and policy

All of this happens in **under 200 milliseconds**. Every single request. For billions of daily active users. For a look at how this is achieved in practice, see Recombee's overview of [performance at scale](https://www.recombee.com/how-it-works/performance-at-scale).

> **Did you know?** Amazon has estimated that 35% of their revenue is driven by recommendations. That's hundreds of billions of dollars annually -- generated by "Customers who bought this also bought..."

**Consider this:** Next time you refresh your feed on any major platform, remember: in the fraction of a second it took to load, the system evaluated millions of items, retrieved candidates from multiple sources, scored them with a neural network, applied diversity and policy constraints, and assembled a personalized slate -- just for you. That's remarkable systems engineering.
