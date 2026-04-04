---
id: ch4-what-scenarios
type: spine
title: "What Are Recommendation Scenarios?"
readingTime: 3
standalone: true
core: true
teaser: "A homepage recommendation and a cart cross-sell serve completely different purposes, face different constraints, and should use different algorithms. The scenario concept formalizes this: each placement gets its own strategy."
voice: universal
parent: null
diagram: null
recallQ: "What is a recommendation scenario and why does it matter?"
recallA: "A scenario is a specific placement where recommendations appear (homepage, product detail, cart, email, search results), with its own logic, constraints, latency budget, success metrics, and evaluation plan. Treating all placements identically leads to suboptimal results because each context has different user intent and different definitions of success."
highlights:
  - "A scenario = a specific placement + its own algorithm, constraints, metrics, and evaluation plan"
  - "Homepage ≠ product detail ≠ cart ≠ email ≠ search results -- each requires a different strategy"
  - "The scenario canvas defines 8 elements: entry point, user state, latency budget, candidate pool, constraints, exploration, metrics, evaluation"
publishedAt: "2026-04-03"
status: accepted
---

One of the most consequential mistakes in recommendation engineering is treating "recommendations" as a single feature. It is not. It is a family of features, each serving a different purpose in a different context with different constraints -- and each requiring its own strategy.

The concept of a **recommendation scenario** formalizes this insight: each placement where recommendations appear in a product is a distinct scenario with its own configuration, algorithm selection, business rules, and success metrics.

![Six recommendation scenario types](/images/anim-scenario-types.svg)

## Why Context Changes Everything

Consider two recommendation placements on the same e-commerce platform:

**The homepage.** The user has just arrived. Intent is vague -- they might be browsing, looking for inspiration, or checking whether anything new has arrived. The system's job is **discovery**: surface items the user did not know they wanted. Diversity matters enormously. Showing ten variations of the same product category is a failure even if each individual item is relevant. Latency budget is generous (the page is loading other elements anyway). Success is measured by engagement depth -- did the user click, explore, and eventually purchase something they discovered here?

**The cart page.** The user has committed to a purchase. Intent is specific -- they are about to check out. The system's job is **cross-sell**: suggest complementary items that increase order value without adding friction. Diversity is less important than relevance. Showing a phone case when the user has a phone in their cart is more valuable than showing a diverse set of unrelated items. Latency budget is tight (the user is in a transactional mindset and will not wait). Success is measured by add-to-cart rate and incremental revenue.

The same algorithm, the same parameters, and the same business rules cannot serve both contexts well. A system optimized for homepage discovery will suggest irrelevant novelties on the cart page. A system optimized for cart cross-sell will be too narrow and transactional on the homepage.

This is why production recommendation platforms like [Recombee](https://docs.recombee.com/scenarios) implement scenarios as a first-class concept: each scenario is independently configured, independently evaluated, and independently optimized.

## The Scenario Canvas

Every recommendation scenario can be defined by eight elements. Together, they form a design framework -- a canvas -- that ensures nothing important is overlooked when designing or evaluating a recommendation placement.

**1. Entry point.** Where in the product does this scenario appear? Homepage, product detail page, cart, checkout, email, push notification, search results, in-app banner, onboarding flow. The entry point determines the user's mindset and the visual real estate available.

**2. User state and intent.** What do we know about the user at this moment? Are they anonymous or logged in? New or returning? Browsing or transacting? The user state determines which signals are available (a new anonymous user has no history) and which algorithms are appropriate (collaborative filtering requires history; popularity or content-based methods do not).

**3. Latency budget.** How many milliseconds does the system have to generate recommendations? A homepage that loads asynchronously might tolerate 500ms. A search results page that must feel instant needs sub-100ms. An email batch job has minutes. The latency budget constrains the complexity of the algorithm -- you cannot run a multi-stage neural re-ranker in 50ms on commodity hardware.

**4. Candidate pool.** Which items are eligible for recommendation in this scenario? The full catalog? Only in-stock items? Only items in the same category as the currently viewed item? Only items within a price range? The candidate pool is often the most impactful constraint -- a bad candidate pool guarantees bad recommendations regardless of the ranking algorithm.

**5. Constraints and guardrails.** Business rules that override algorithmic judgment. Maximum two items per brand. No adult content for users under 18. Never recommend a product the user has already purchased (unless it is consumable). Exclude items with fewer than five reviews. Constraints protect the business and the user from algorithmic edge cases.

**6. Exploration policy.** How much should the system explore versus exploit? A homepage benefits from higher exploration (Thompson sampling, epsilon-greedy) to help users discover new interests and to gather data on new items. A cart page benefits from low exploration -- the user is about to spend money and does not want experiments. The exploration policy directly affects the tradeoff between short-term engagement and long-term system learning.

**7. Success metrics.** What does success look like for this specific scenario? CTR? Conversion rate? Revenue per impression? Session depth? Retention? Different scenarios should be measured by different primary metrics. A homepage measured by conversion rate will be optimized toward safe, transactional items rather than discovery. A cart page measured by session depth will suggest rabbit holes rather than quick add-ons.

**8. Evaluation plan.** How will you know whether this scenario is working? Online A/B testing, interleaving experiments, offline replay evaluation? What is the minimum detectable effect, and how long must the experiment run? The evaluation plan prevents the team from shipping a scenario and never measuring whether it actually improved outcomes.

## Common Scenarios in Practice

| Scenario | Primary goal | Key constraint | Typical metrics |
|----------|-------------|----------------|-----------------|
| Homepage | Discovery | Diversity, freshness | Session depth, CTR |
| Product detail | Similar/complementary | Relevance to viewed item | CTR, cross-sell rate |
| Cart/checkout | Cross-sell | Complement cart, low friction | Add-to-cart rate, AOV lift |
| Search results | Personalized re-ranking | Query relevance first | Click-through, conversion |
| Email/newsletter | Re-engagement | Rotation (no repeats), freshness | Open rate, click rate, return visits |
| Onboarding | Cold-start discovery | Limited user signal | Completion rate, first interaction |
| "Continue" row | Resume/completion | Recency, completion status | Resume rate, completion rate |

## The Anti-Pattern: One Algorithm for Everything

Teams new to recommendation systems often build a single recommendation pipeline and deploy it everywhere. The homepage shows the same ranked list as the product detail page. The email sends yesterday's homepage recommendations. The cart sidebar runs the same model with no constraints.

This produces a system that is mediocre everywhere and excellent nowhere. Each placement has different user intent, different latency requirements, different success criteria, and different failure modes. A single pipeline cannot accommodate all of these simultaneously.

The scenario concept is the antidote. It forces the team to think about each placement as a separate product problem with a separate solution -- while still allowing shared infrastructure (feature stores, embedding models, candidate retrieval) across scenarios.

For implementation patterns and configuration details, the [Recombee scenarios documentation](https://docs.recombee.com/scenarios) provides concrete examples across domains, and the [recommendation logics reference](https://docs.recombee.com/recommendation_logics) shows how different algorithmic strategies map to different scenario types.
