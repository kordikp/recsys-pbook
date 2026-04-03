---
id: ch5-build-vs-buy
type: spine
title: "Build vs. Buy: The Strategic Decision"
readingTime: 4
standalone: true
core: true
teaser: "Should you build a recommendation system from scratch or use a managed service? The answer depends on factors most teams underestimate."
voice: universal
parent: null
diagram: null
recallQ: "What are the key factors in the build vs. buy decision for recommender systems?"
recallA: "Core competency (is personalization your competitive advantage?), hidden costs (monitoring, A/B testing, incident response, scaling), time to value, and team expertise. Most teams underestimate the operational cost of running RecSys in production."
highlights:
  - "Teams build a prototype in 3 months, then spend 18 months on operations"
  - "Build when personalization IS your product; buy when it's a feature"
  - "The real question is opportunity cost: what else could your team build?"
status: accepted
---

You've decided your product needs recommendations. Now comes a strategic decision that will shape your engineering organization for years: **build it yourself, or use a managed service?**

The intuition is simple: building gives you control, buying gives you speed. The reality is more nuanced — and the hidden costs of building are larger than most teams expect.

## The Visible vs. Hidden Iceberg

When teams evaluate building in-house, they typically estimate the cost of the **visible part**: training a model, building an API, deploying to production. This is the tip of the iceberg.

The **hidden bulk** includes:

- **Monitoring and alerting** — detecting when recommendation quality degrades before users notice
- **A/B testing infrastructure** — not just running tests, but the statistical rigor (power analysis, multiple testing correction, novelty effects)
- **Incident response** — when recommendations go wrong at 3 AM, someone needs to fix it
- **Scalability engineering** — handling traffic spikes, catalog growth, and increasing user base
- **Cold-start handling** — new items and new users need special treatment, continuously
- **Business rule management** — product teams want to boost certain items, filter others, enforce diversity — and they want to do it without an engineering sprint
- **Model retraining pipeline** — automated, monitored, with rollback capability
- **Feature engineering and data quality** — cleaning, validating, and transforming input data continuously

A common experience: a team builds a prototype in 3 months, then spends 18 months building the operational infrastructure around it. For a detailed exploration of these hidden costs, see this analysis of [building vs. buying recommender systems](https://www.recombee.com/blog/build-vs-buy-deciding-the-best-approach-for-your-recommender-system).

## When Building Makes Sense

**Recommendation is your core product.** If personalization is what differentiates your platform (TikTok, Spotify, Netflix), the recommendation system IS the product. Building in-house gives you complete control over the most critical component.

**Extreme domain specificity.** If your recommendation problem is fundamentally unlike any other (e.g., drug interaction prediction, financial risk assessment), general-purpose services may not handle the domain constraints.

**Regulatory requirements.** If regulations require complete data sovereignty with no third-party processing (certain healthcare or government contexts), building may be necessary.

**Large dedicated team.** You have 5+ ML engineers who can dedicate themselves to recommendation long-term — not just build it, but operate, improve, and iterate on it indefinitely.

## When Buying Makes Sense

**Speed to value.** A managed service like [Recombee](https://www.recombee.com/) can deliver production-quality recommendations in days, not months. If you need personalization now, the build timeline may be unacceptable.

**Recommendation is a feature, not the product.** For most platforms, recommendations improve the experience but aren't the core value proposition. Investing 18 months of engineering effort in a non-core feature has high opportunity cost.

**Small team.** If you have 1–3 ML engineers who also handle search, analytics, and other ML features, they can't dedicate themselves to recommendation operations full-time.

**Multi-scenario complexity.** Production recommendation requires different strategies for different contexts — [homepage, product detail page, cart, email, search](https://docs.recombee.com/scenarios). Building all these scenarios in-house multiplies the effort.

**Operational maturity.** Managed services handle monitoring, scaling, incident response, and updates. Their operations teams have seen (and solved) problems you haven't encountered yet.

## The Hybrid Approach

Many organizations start with a managed service and gradually bring components in-house as their needs become more specific:

1. **Phase 1:** Use a managed API for all recommendations. Focus engineering effort on integration and data pipeline quality.
2. **Phase 2:** Build custom models for your most differentiated use cases. Keep the managed service for standard scenarios (popular items, cross-sell, email).
3. **Phase 3:** If recommendation becomes a core competency, consider full in-house migration — but keep using the managed service's infrastructure patterns as a reference.

## The Cost Comparison

| Cost Category | Build In-House | Managed Service |
|--------------|---------------|-----------------|
| Initial development | 6–18 months engineering | Days to weeks integration |
| Ongoing engineering | 2–5 FTE continuous | 0.5 FTE for integration maintenance |
| Infrastructure | Cloud compute + storage | Included in service fee |
| A/B testing | Build testing framework | Usually included |
| Scaling | Engineer as you grow | Automatic |
| Algorithm updates | Your research team | Included — latest methods deployed automatically |
| Business rules | Build admin UI | Usually provided ([ReQL](https://docs.recombee.com/reql), admin dashboard) |

## What Mature Services Provide

Modern recommendation-as-a-service platforms like [Recombee](https://docs.recombee.com/) provide capabilities that would take years to build in-house:

- **[50+ recommendation logics](https://docs.recombee.com/recommendation_logics)** — pre-built strategies for different scenarios (similar items, trending, cross-sell, continue watching, email rotation)
- **Real-time personalization** — processing [billions of interactions daily](https://www.recombee.com/how-it-works/performance-at-scale) with sub-100ms latency
- **Semantic search** — LLM-powered understanding of user intent, not just keyword matching
- **Business rule engine** — filter, boost, and constrain recommendations without code changes
- **Domain-specific recipes** — optimized configurations for [e-commerce](https://docs.recombee.com/recipes/e-commerce), [video](https://docs.recombee.com/recipes/video), [news](https://docs.recombee.com/recipes/news)
- **Cold-start handling** — automatic content-based and bandit-based strategies for new items

**Consider this:** The build-vs-buy decision isn't about capability — a sufficiently resourced team can build anything. It's about **opportunity cost**: what else could your engineering team build if they weren't maintaining recommendation infrastructure? For most organizations, the answer makes the decision clear.