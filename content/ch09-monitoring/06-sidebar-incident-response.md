---
id: ch9-incidents
type: spine
title: "Incident Response: When Recommendations Go Wrong"
readingTime: 2
standalone: true
core: false
teaser: "Every recommendation system will eventually fail. The difference between a minor hiccup and a headline-making disaster is whether you have a structured incident response plan before it happens."
voice: universal
parent: null
diagram: null
recallQ: "What are the three fallback tiers for a recommendation system incident?"
recallA: "Tier 1: degrade gracefully (roll back to the previous known-good model). Tier 2: popular fallback (switch to a non-ML heuristic like trending/popular items). Tier 3: disable (serve cached results or remove the recommendation widget entirely)."
highlights:
  - "Three-tier fallback: degrade gracefully → popular fallback → disable entirely"
  - "Detection is the hardest step -- most recommendation incidents are silent quality failures, not crashes"
  - "Every incident should produce at least one new monitor or automated check that would have caught it earlier"
publishedAt: "2026-04-03"
status: accepted
---

A recommendation system will fail. Not might -- will. The model will serve degenerate results. A data pipeline will silently break. A deployment will ship the wrong artifact. The question is not whether an incident will occur but whether the team has a response plan that minimizes user impact and maximizes learning.

![Incident response lifecycle: detect to post-mortem](/images/anim-incident-response.svg)

## Step 1: Detection

The hardest part of a recommendation incident is knowing it is happening. Unlike a service outage, where users see error pages and support tickets spike immediately, a recommendation quality failure is often **silent**. The system continues serving results. The results are just wrong.

Detection comes from three sources:

**Automated monitoring.** Alerts on CTR drops, coverage declines, score distribution anomalies, and data freshness violations. These catch systematic failures within minutes to hours.

**User reports.** "My recommendations are terrible today" or "Why am I seeing baby products? I don't have children." User reports are noisy and delayed but catch problems that automated monitoring misses -- particularly problems affecting specific user segments.

**Manual review.** Engineers periodically inspect a sample of recommendations for sanity. This catches subtle issues like a model that technically performs well on aggregate metrics but produces bizarre results for edge cases. Scheduled manual reviews (weekly or biweekly) complement automated monitoring.

## Step 2: Classification

Once a problem is detected, classify its severity immediately. The classification determines the response urgency and the fallback tier.

**Severity 1 -- Critical.** Recommendations are actively harmful: offensive content surfaced to inappropriate audiences, legally non-compliant results (e.g., age-restricted content shown to minors), or recommendations that reveal private user data. Response: activate fallback immediately, all-hands investigation.

**Severity 2 -- Major.** Recommendations are significantly degraded for a large fraction of users: all users seeing the same items, wildly irrelevant suggestions, or a complete category of items missing from recommendations. Response: activate fallback within 30 minutes, assign investigation team.

**Severity 3 -- Minor.** Recommendations are noticeably suboptimal but not harmful: slightly lower diversity, mild staleness, a niche user segment underserved. Response: investigate within 24 hours, no fallback needed unless metrics continue to decline.

## Step 3: Fallback Activation

Every production recommender system should have a fallback strategy that can be activated within minutes -- not hours. Pre-build and pre-test these tiers:

**Tier 1: Degrade gracefully.** Roll back to the previous known-good model version. This is a configuration change, not a deployment. It should take under five minutes and should be executable by any on-call engineer without specialized knowledge. Keep the last three model versions deployable at all times.

**Tier 2: Popular fallback.** Switch to a non-ML heuristic: trending items, most popular items in the user's region or category, or editorially curated lists. This eliminates model risk entirely. The experience is impersonal but functional. Users see reasonable items even if they are not personalized.

**Tier 3: Disable.** Serve cached recommendations from the last successful batch run, or remove the recommendation widget entirely and replace it with a search prompt, a category browser, or a static promotional banner. This is the last resort -- it acknowledges that the system cannot safely recommend and steps aside.

The key architectural requirement: fallback tiers must be independently deployable. If your fallback depends on the same feature store that is broken, it is not a fallback.

## Step 4: Diagnosis

With the fallback in place and user impact contained, investigate the root cause. Common culprits, in rough order of frequency:

1. **Data pipeline failure.** A feature pipeline failed silently, introducing nulls, stale values, or incorrect joins. This is the single most common cause of recommendation incidents.
2. **Model artifact mismatch.** A deployment shipped the wrong model file, an outdated version, or a model trained on corrupted data.
3. **Upstream schema change.** A data source changed its schema (renamed a field, changed a data type, altered an enum) without notifying the recommendation team.
4. **Configuration error.** A business rule was misconfigured: wrong candidate pool, incorrect filtering logic, broken A/B test allocation.
5. **Genuine model failure.** The model converged to a degenerate solution during training (e.g., predicting the same score for all items) and the training pipeline's validation checks did not catch it.

## Step 5: Fix and Verify

Apply the fix in a staging environment first. Verify that model metrics recover to pre-incident levels on holdout data. If possible, run a shadow deployment -- the fixed model scores requests in parallel with the fallback but does not serve results to users -- to confirm behavior on production traffic before switching back.

## Step 6: Post-Mortem

Every incident should produce a written post-mortem that documents:
- **Timeline.** When did the problem start, when was it detected, when was the fallback activated, when was the fix deployed?
- **Impact.** How many users were affected? What was the estimated business impact?
- **Root cause.** What specifically went wrong?
- **Detection gap.** Why did existing monitoring not catch this sooner?
- **Action items.** At least one new monitor, alert, or automated check that would have caught the problem earlier or prevented it entirely.

The most valuable output of a post-mortem is not blame -- it is a new safeguard. Over time, the cumulative effect of post-incident improvements transforms a fragile system into a resilient one.
