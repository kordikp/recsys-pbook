---
id: ch4-canvas
type: spine
title: "The Scenario Canvas: A Design Framework"
readingTime: 3
standalone: true
core: false
teaser: "Before writing a single line of code, fill out the scenario canvas. Eight questions that prevent the most common recommendation design mistakes."
voice: explorer
parent: null
diagram: null
recallQ: "What are the eight elements of the scenario canvas?"
recallA: "Entry point, user state and intent, latency budget, candidate pool, constraints and guardrails, exploration policy, success metrics, and evaluation plan. Filling out all eight for each recommendation placement prevents under-specified designs."
highlights:
  - "The canvas turns vague requirements ('add recommendations') into concrete, testable specifications"
  - "Two worked examples show how the same framework produces very different designs for homepage vs. cart"
  - "The most commonly skipped element is the evaluation plan -- and it is the most important"
publishedAt: "2026-04-03"
status: accepted
---

"Add recommendations to the product page" is not a specification. It is a wish. A specification answers eight questions, and the scenario canvas is a structured way to answer all of them before writing code.

The canvas works for any recommendation placement in any domain. Below is the framework, followed by two worked examples that show how the same eight questions produce radically different designs for different contexts.

![The Scenario Canvas: 8 design elements](/images/diagram-scenario-canvas.svg)

## The Eight Elements

### 1. Entry Point

**Question:** Where in the product does this recommendation appear?

Be specific. "The homepage" is better than "the app." "The homepage, below the hero banner, in a horizontally scrollable carousel of 10 items" is better still. The entry point determines the visual format (carousel, grid, list, inline), the number of items needed, and the user's attention state (active browsing vs. passing glance).

### 2. User State and Intent

**Question:** What do we know about the user, and what are they trying to do?

Map the possible user states for this entry point:
- **Anonymous, first visit.** No history, no profile. Only contextual signals (device, location, time, referrer) are available.
- **Anonymous, returning.** Cookie-based session history but no account. Some behavioral signal, but it resets if cookies are cleared.
- **Logged in, sparse history.** An account exists but with fewer than 10 interactions. Collaborative filtering has weak signal.
- **Logged in, rich history.** Hundreds of interactions. Full personalization is possible.

For each state, define which algorithms are appropriate and what the fallback is when personalization signal is insufficient.

### 3. Latency Budget

**Question:** How many milliseconds does the system have to return recommendations?

Latency budgets are not aspirational targets -- they are hard constraints that determine what is architecturally possible.

| Budget | What it allows |
|--------|---------------|
| < 50ms | Pre-computed recommendations, cache lookups, simple scoring |
| 50--200ms | Real-time feature lookup + lightweight model scoring |
| 200--500ms | Multi-stage retrieval + neural re-ranking |
| > 500ms | Complex pipelines, but only if the UI loads asynchronously |
| Batch (minutes) | Email, push notifications -- full pipeline with no latency pressure |

### 4. Candidate Pool

**Question:** Which items are eligible for recommendation?

Define inclusions and exclusions explicitly:
- **Include:** All active, in-stock items? Only items in the same category? Only items within a price range? Only items available in the user's region?
- **Exclude:** Items the user has already purchased? Items the user has explicitly dismissed? Items below a quality threshold (reviews, ratings)? Items that violate content policies for this user segment?

The candidate pool is often the highest-leverage design decision. A perfect ranking algorithm applied to a bad candidate pool produces bad recommendations.

### 5. Constraints and Guardrails

**Question:** What business rules must the algorithm respect?

Constraints override algorithmic judgment. They protect the business and the user:
- Maximum N items per brand/creator/category (prevents monopolization)
- Minimum price or margin thresholds (protects economics)
- Content restrictions by audience segment (protects users)
- Promotional slot reservations (business needs)
- Freshness requirements (at least K% of items should be from the last N days)

Document each constraint and its rationale. Constraints without rationale tend to accumulate and calcify, eventually strangling recommendation quality.

### 6. Exploration Policy

**Question:** How much should the system explore vs. exploit?

Define the exploration strategy and its parameters:
- **Pure exploitation (epsilon = 0).** Always show the highest-scoring items. Maximizes short-term engagement but risks filter bubbles and prevents learning about new items.
- **Epsilon-greedy (epsilon = 0.05--0.20).** Show a random item in N% of slots. Simple and effective for moderate exploration.
- **Thompson sampling.** Sample from the posterior distribution of item quality. Automatically balances exploration and exploitation based on uncertainty.
- **Deterministic rotation.** Reserve specific slots for new items, trending items, or underexplored categories. Less sophisticated but more predictable.

Higher exploration is appropriate for discovery contexts (homepage, browse). Lower exploration is appropriate for transactional contexts (cart, checkout).

### 7. Success Metrics

**Question:** What does success look like for this specific scenario?

Choose a primary metric and up to two secondary metrics. The primary metric is what you optimize for. The secondary metrics are guardrails -- they must not degrade beyond acceptable thresholds.

- **Primary:** The single metric that best captures the scenario's purpose (e.g., add-to-cart rate for cross-sell, session depth for discovery).
- **Guardrails:** Metrics that must not degrade (e.g., recommendation diversity must stay above X, catalog coverage must stay above Y).

Avoid measuring every scenario by the same metric. A homepage measured by conversion rate will converge on safe, transactional items. A cart page measured by session depth will suggest rabbit holes. Match the metric to the scenario's purpose.

### 8. Evaluation Plan

**Question:** How will you know whether this scenario is working?

Define before launch:
- **Experiment type.** A/B test, interleaved ranking, or offline replay?
- **Control.** What is the baseline? No recommendations? Random items? The previous algorithm version?
- **Minimum detectable effect.** What improvement is large enough to be worth deploying?
- **Sample size and duration.** How many users and how many days to reach statistical significance?
- **Decision criteria.** What must be true for you to ship the new algorithm permanently?

The evaluation plan is the most commonly skipped element -- and it is the most important. Without it, the team ships recommendations and never learns whether they helped.

---

## Worked Example 1: Homepage Discovery

| Element | Design decision |
|---------|----------------|
| **Entry point** | Homepage, below hero banner, horizontal carousel, 12 items |
| **User state** | All states; anonymous users get popularity-based recs, logged-in users get personalized recs |
| **Latency budget** | 300ms (loaded asynchronously) |
| **Candidate pool** | All active, in-stock items; exclude items viewed in the last 7 days |
| **Constraints** | Max 2 per category; at least 3 items added in the last 14 days; no items with < 3 reviews |
| **Exploration** | Thompson sampling with 15% exploration budget; reserved slot for one new/cold-start item |
| **Success metrics** | Primary: session depth (pages per visit). Guardrails: CTR > 3%, category coverage > 60% |
| **Evaluation** | A/B test vs. popularity baseline, 2-week run, 50K users per arm, ship if session depth +5% |

This canvas produces a system optimized for discovery: diverse, fresh, exploratory, measured by engagement depth rather than immediate conversion.

## Worked Example 2: Cart Cross-Sell

| Element | Design decision |
|---------|----------------|
| **Entry point** | Cart page, below item list, compact grid, 4 items |
| **User state** | Logged-in users only (anonymous carts are rare and have minimal signal) |
| **Latency budget** | 100ms (synchronous, user is waiting to check out) |
| **Candidate pool** | Items frequently co-purchased with cart items; exclude items already in cart; price < average cart item price |
| **Constraints** | Max 1 per category; only items with > 4.0 average rating; no items requiring separate shipping |
| **Exploration** | Minimal (epsilon = 0.02); this is a transactional context, not a discovery context |
| **Success metrics** | Primary: add-to-cart rate. Guardrails: checkout completion rate must not drop (adding items should not create friction) |
| **Evaluation** | A/B test vs. "no cross-sell" baseline, 1-week run, 30K users per arm, ship if add-to-cart rate > 8% |

This canvas produces a system optimized for incremental revenue: narrow, relevant, low-friction, measured by add-to-cart rate with a guardrail against checkout abandonment.

---

## Using the Canvas

The canvas is most valuable as a **design artifact shared between product, engineering, and data science**. Product defines the entry point, user states, and success metrics. Engineering defines the latency budget and constraints. Data science defines the candidate pool, exploration policy, and evaluation plan.

When the canvas is filled out collaboratively, misalignment surfaces immediately. "We want diverse discovery recommendations on the cart page" is a contradiction that the canvas makes visible before anyone writes code. "We want sub-50ms latency with a multi-stage neural pipeline" is an impossibility that the latency budget element forces the team to confront.

For scenario configuration details and algorithm-to-scenario mapping, see the [Recombee scenarios documentation](https://docs.recombee.com/scenarios) and the [recommendation logics reference](https://docs.recombee.com/recommendation_logics).
