---
id: ch5-rec-scenarios
type: spine
title: "Recommendation Scenarios: Different Context, Different Strategy"
readingTime: 3
standalone: true
core: false
teaser: "A homepage recommendation and a product detail recommendation serve completely different purposes. Here's how to design for each context."
voice: explorer
parent: null
diagram: null
recallQ: "What are the main recommendation scenarios and how do they differ?"
recallA: "Homepage (personalized discovery), item detail (similar/complementary items), cart/checkout (cross-sell), search results (personalized ranking), email/newsletter (re-engagement with rotation), and continue-watching (resume). Each requires different algorithms and constraints."
publishedAt: "2026-04-03"
status: accepted
---

One of the most common mistakes in recommendation engineering is treating all recommendation contexts the same. A homepage recommendation and a "you might also like" suggestion on a product page serve fundamentally different purposes — and should use different strategies.

The concept of **recommendation scenarios** formalizes this: each placement where recommendations appear gets its own configuration, algorithm selection, and business rules. This is a [well-established design pattern](https://docs.recombee.com/scenarios) in production recommendation systems.

## The Main Scenarios

### Homepage: Personalized Discovery

**Purpose:** Help the user discover content they didn't know they wanted.
**Algorithm emphasis:** Strong personalization, diversity, serendipity.
**Key constraint:** Must show variety — not 10 items from the same category.

The homepage is often built from **composite recommendations** — multiple recommendation calls combined into a personalized layout:
- "Because you watched X" (item-based CF)
- "Trending in your interests" (popularity + personalization)
- "New for you" (cold-start items matched to your profile)
- "Top picks" (highest-confidence personalized recommendations)

Each section uses a different logic, and the system personalizes not just the items but the **order of sections** — which category row appears first depends on the user's preferences.

### Item Detail: Similar and Complementary

**Purpose:** Help the user explore related options or complete a purchase.
**Algorithm emphasis:** Item-to-item similarity, cross-sell.

Two distinct sub-scenarios:
- **Similar items** ("You might also like"): Items similar to the one being viewed — same category, similar features, used by similar users.
- **Complementary items** ("Frequently bought together"): Items that complement the current one — a phone case for a phone, batteries for a toy, a sequel to a book.

These require different algorithms: similarity-based retrieval for the first, co-purchase association rules for the second.

### Cart/Checkout: Cross-sell

**Purpose:** Increase order value with relevant add-ons.
**Algorithm emphasis:** Complementary items, impulse purchases, bundles.
**Key constraint:** Low friction — items should be easy to add, low consideration.

The items shown should complement what's already in the cart, not compete with it. If the user has a camera in their cart, recommend memory cards and bags, not a different camera.

### Search Results: Personalized Ranking

**Purpose:** Re-rank search results based on user preferences.
**Algorithm emphasis:** Query relevance + personal preference signals.

Two users searching for "running shoes" should see different results based on their purchase history, brand preferences, and price sensitivity. This is where [search and recommendation converge](https://docs.recombee.com/scenarios).

### Email/Newsletter: Re-engagement

**Purpose:** Bring users back to the platform with personalized content.
**Algorithm emphasis:** High-confidence recommendations, novelty, rotation.
**Key constraint:** **Rotation** — never show the same items in consecutive emails. Smart rotation ensures each email feels fresh.

Email recommendations must account for the time gap — what was relevant when the user was last active may be stale now. Freshness weighting becomes critical.

### Continue Watching/Reading

**Purpose:** Help users resume where they left off.
**Algorithm emphasis:** Recency, completion status, minimal friction.

For video platforms, this means showing items the user started but didn't finish (e.g., watched 10–90%). For e-commerce, items viewed but not purchased. The logic is simple but the UX impact is significant — Netflix reports that "continue watching" is one of their highest-engagement placements.

## Designing Your Scenario Map

For each scenario, define:

| Parameter | Example: Homepage | Example: Cart |
|-----------|------------------|---------------|
| Goal | Discovery | Cross-sell |
| Primary algorithm | Personalized CF | Co-purchase rules |
| Diversity constraint | Max 2 per category | No duplicates of cart items |
| Freshness | Mix new and familiar | Focus on consumables |
| Business rules | Exclude out-of-stock | Price < average cart item |
| Fallback | Trending items | Popular add-ons |

For implementation patterns across domains, see the scenario recipes for [e-commerce](https://docs.recombee.com/recipes/e-commerce), [video](https://docs.recombee.com/recipes/video), and [news](https://docs.recombee.com/recipes/news).

**Consider this:** The scenario concept reveals that "recommendation" isn't a single feature — it's a family of features, each requiring its own strategy. The best recommendation systems aren't those with the best algorithm; they're those that apply the right algorithm in the right context.