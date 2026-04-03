---
id: ch5-observability
type: spine
title: "RecSys Observability: When Things Go Wrong at 3 AM"
readingTime: 3
standalone: true
core: false
teaser: "Your recommendations suddenly got worse. How do you find out why? Observability is the difference between debugging for hours and debugging for minutes."
voice: explorer
parent: null
diagram: null
recallQ: "What are the three pillars of RecSys observability?"
recallA: "Metrics (what happened), logs (what the system did), and traces (how a specific recommendation was generated). Together they enable rapid root cause analysis."
publishedAt: "2026-04-03"
status: accepted
---

It's 3 AM. An alert fires: recommendation CTR dropped 15% in the last hour. Is it a model bug? A data pipeline failure? A catalog issue? A seasonal pattern? Without proper observability, you're guessing in the dark.

## The Three Pillars

### 1. Metrics: What Happened?

Time-series metrics tell you *that* something changed:

**Business metrics (lagging):**
- CTR, conversion rate, revenue per session
- Tracked with 15-minute granularity minimum
- Compared against same time last week (not yesterday — weekday effects)

**Model metrics (leading):**
- Recommendation coverage (what % of catalog was recommended?)
- Score distribution (are prediction scores compressed? inflated?)
- Candidate set size (is retrieval returning enough candidates?)
- Feature freshness (when was the newest interaction in the feature store?)

**Infrastructure metrics:**
- Latency percentiles (p50, p95, p99)
- Error rates per endpoint
- Cache hit rates
- Model serving memory and CPU usage

### 2. Logs: What the System Did

Structured logs capture the system's decisions:

```
{
  "timestamp": "2026-04-03T03:15:22Z",
  "user_id": "u-12345",
  "request_type": "homepage",
  "candidates_retrieved": 847,
  "candidates_scored": 847,
  "model_version": "v42",
  "feature_staleness_ms": 3200,
  "top_item": "item-789",
  "top_score": 0.94,
  "diversity_score": 0.67,
  "latency_ms": 142
}
```

**Key fields:** Always log the model version, feature staleness, number of candidates at each pipeline stage, and the top scores. These enable post-hoc analysis of degradation.

### 3. Traces: How a Specific Recommendation Was Made

A trace follows a single recommendation request through every pipeline stage:

1. **Feature lookup:** Which features were used? Were any missing? What were their values?
2. **Candidate generation:** Which retrieval sources contributed? How many candidates from each?
3. **Scoring:** What was each candidate's score? Which features contributed most?
4. **Re-ranking:** How did diversity/business rules change the order?
5. **Final slate:** What was actually shown to the user?

Traces are expensive — you can't trace every request. Sample 0.1–1% and store them for debugging.

## Common Failure Patterns

| Symptom | Likely Cause | How to Diagnose |
|---------|-------------|-----------------|
| CTR drops suddenly | Model deployment bug, data pipeline failure | Check model version, feature freshness |
| CTR drops gradually | Concept drift, catalog staleness | Compare score distributions over time |
| All users see same items | Feature store returning defaults | Check feature miss rate |
| Latency spike | ANN index corruption, feature computation timeout | Check infrastructure metrics |
| Coverage drops | Candidate generation filtering too aggressively | Check candidate counts per stage |
| Score distribution changes | Feature drift, model overfit on recent batch | Compare score histograms |

## The Recommendation Debugger

When a user reports "my recommendations are bad," you need to be able to reconstruct exactly what happened:

1. Pull the user's recent interactions from the log
2. Retrieve their feature vector at the time of the request
3. Re-run the recommendation pipeline with those inputs
4. Compare the actual recommendations against what the model would produce now
5. Identify the discrepancy

This "recommendation replay" capability is the gold standard of observability — and it requires logging enough state to reconstruct past decisions.

## Practical Setup

**Minimum viable observability:**
- Business metrics dashboard (Grafana, Datadog) with alerting
- Structured request logs with model version and latency
- Weekly model quality report comparing offline metrics across versions

**Production-grade observability:**
- All of the above, plus:
- Sampled request traces with full pipeline detail
- Feature distribution monitoring with drift detection
- A/B test result tracking with automatic statistical analysis
- Recommendation replay capability for debugging specific users

**Consider this:** The time you invest in observability pays for itself the first time something goes wrong. And in recommendation systems, something *always* goes wrong — the only question is how quickly you can diagnose it.