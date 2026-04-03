---
id: ch5-caching
type: spine
title: "Recommendation Caching: The Speed-Freshness Trade-off"
readingTime: 2
standalone: true
core: false
teaser: "Pre-computing recommendations saves latency and cost — but risks serving stale suggestions."
voice: explorer
parent: null
diagram: null
recallQ: "What is the main trade-off in recommendation caching?"
recallA: "Speed vs. freshness — cached recommendations are fast and cheap but may not reflect the user's most recent behavior or new items in the catalog."
publishedAt: "2026-04-03"
status: accepted
---

Computing personalized recommendations in real-time for every request is expensive. At scale — millions of users, millions of items, thousands of requests per second — the compute cost and latency add up. **Caching** pre-computes recommendations and stores the results, serving them instantly on subsequent requests.

## What to Cache

**Pre-computed candidate sets.** For each user, compute the top 1,000 candidates offline (e.g., nightly). Store these per-user. Online serving then only needs to score and re-rank this smaller set — a 100× reduction in work.

**Embedding lookups.** Item embeddings rarely change between model updates. Cache them in memory (Redis, Memcached) or in a dedicated vector store. User embeddings are more dynamic but can still be cached with short TTLs.

**Feature values.** Expensive feature computations (e.g., user preference aggregations over 30 days of history) can be pre-computed and cached, updating incrementally as new interactions arrive.

**Full recommendation lists.** For users who visit infrequently, pre-compute the entire recommendation list and serve it directly. This is the most aggressive caching — and the most prone to staleness.

## TTL Strategies

| Content Type | Typical TTL | Rationale |
|-------------|------------|-----------|
| Item embeddings | Until model retrain | Change only on retrain |
| User candidate set | 1–6 hours | Balances freshness with cost |
| Feature cache | 15–60 minutes | Should reflect recent behavior |
| Full rec list | 30 min–1 hour | High risk of staleness |

## Invalidation Triggers

Beyond time-based expiry, certain events should invalidate the cache immediately:

- **New interaction:** User just purchased/rated something — their candidate set is now stale
- **New item in catalog:** Cached candidate sets miss this item entirely
- **Model update:** All cached predictions are based on the old model
- **Context change:** User switches device, time of day shifts from morning to evening

## When NOT to Cache

Caching works poorly when:

- **Recommendations are highly contextual** — time of day, location, or session intent matters. Cached lists can't adapt to "browsing at lunch vs. researching at night."
- **Real-time signals dominate** — news recommendations that must reflect events happening now
- **The catalog changes rapidly** — flash sales, breaking content, ticket availability
- **Exploration matters** — cached lists are deterministic; you lose the randomness that Thompson Sampling relies on for exploration

## Practical Pattern: Layered Caching

The production-standard approach uses layered caching:

1. **Cache the candidate set** (hourly update, ~1000 items per user)
2. **Recompute scoring in real-time** (fast, because only scoring 1000 candidates vs. millions)
3. **Apply real-time context** (time, device, business rules) during re-ranking
4. **Inject fresh exploration slots** (bypass cache for bandit-selected items)

This preserves freshness where it matters (scoring, context, exploration) while eliminating the most expensive computation (candidate generation over the full catalog).

**Consider this:** The best caching strategy depends on how fast your domain changes. A movie recommender can cache aggressively (preferences shift slowly). A news recommender can barely cache at all. Know your domain's clock speed.