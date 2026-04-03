---
id: ch2-data-foundation
type: spine
title: "The Data Foundation: Three Pillars of Every Recommender"
readingTime: 3
standalone: true
core: true
teaser: "Every recommendation system rests on three data pillars: what items exist, who the users are, and how they interact. Get the foundation wrong and no algorithm can save you."
voice: universal
parent: null
diagram: null
recallQ: "What are the three data pillars of a recommender system?"
recallA: "The Item Catalog (what's available and its attributes), the User Catalog (who the users are), and User-Item Interactions (the behavioral signal connecting them). The interaction data is the most critical — without it, there's no personalization."
status: accepted
---

Before any algorithm can make a recommendation, it needs data. And not just any data — it needs three specific types, each serving a distinct purpose. This [three-pillar data model](https://www.recombee.com/blog/modern-recommender-systems-part-2-data) is the foundation of every production recommender system.

## Pillar 1: The Item Catalog

**What it contains:** Every item that can be recommended, along with its attributes.

For a video platform: title, description, genre, duration, release date, cast, language, thumbnail, content rating. For an e-commerce site: product name, category, price, brand, availability, images, size/color variants.

**Why it matters:** The item catalog enables content-based filtering. Without knowing that a movie is a "sci-fi thriller from 2024," the system can't find similar movies for a user who liked other sci-fi thrillers.

**Common problems:**
- **Incomplete metadata** — items with empty descriptions or missing categories make content-based approaches impossible
- **Stale catalog** — out-of-stock products or expired content still appearing in recommendations
- **Inconsistent taxonomy** — "Science Fiction" vs. "Sci-Fi" vs. "SF" as separate categories

**Best practice:** Treat the item catalog as a first-class data product. Monitor completeness, freshness, and consistency. Compute coverage metrics: what percentage of items have complete metadata?

## Pillar 2: The User Catalog

**What it contains:** Information about each user — demographics, preferences, account status, and context.

**Explicit attributes:** Age, gender, language, location, subscription tier, account creation date.

**Derived attributes:** Preferred genres (computed from history), activity level (sessions per week), exploration tendency (how diverse is their consumption?), lifecycle stage (new, growing, mature, declining).

**Why it matters:** User attributes enable segment-based personalization and cold-start handling. A new user with no interaction history but demographic information can receive segment-appropriate recommendations instead of generic popular items.

**The anonymous user challenge:** On ad-supported platforms, up to [70% of active users may be anonymous](https://www.recombee.com/blog/modern-recommender-systems-part-2-data) — they have no persistent profile. For these users, the system relies entirely on session-level signals and contextual features (device, time of day, referral source).

## Pillar 3: User-Item Interactions

**What it contains:** Every behavioral signal connecting users to items — clicks, views, purchases, ratings, saves, skips, searches.

**This is the most critical pillar.** Collaborative filtering is built entirely on interaction data. No interactions = no collaborative signal = generic recommendations.

**Interaction types and their signal strength:**

| Interaction | Signal Strength | Signal Quality |
|-------------|----------------|----------------|
| Purchase | Very strong | Clear positive intent |
| Rating (explicit) | Strong | Direct preference statement |
| Add to cart/wishlist | Strong | Purchase intent signal |
| Completion (watch/read 80%+) | Strong | Genuine engagement |
| Extended dwell time | Moderate | Interest but not conclusive |
| Click/view | Moderate | Interest but possibly noise |
| Search query | Strong | Explicit intent statement |
| Skip/dismiss | Moderate negative | Active rejection |
| Impression (saw but didn't click) | Weak negative | Possibly didn't notice |

**Temporal dimension:** Interactions have timestamps, and recency matters. A purchase from yesterday is more predictive than one from last year. Most systems apply exponential decay to older interactions.

## The Feedback Loop

These three pillars don't exist in isolation — they form a feedback loop:

1. The system uses **item catalog + user catalog + interactions** to generate recommendations
2. Users see the recommendations and interact (or don't)
3. New interactions flow back into the interaction database
4. The model retrains on updated data
5. Updated recommendations go out

**The loop is both the strength and the danger** of recommender systems. It enables continuous improvement (more data → better model), but it also creates biases: items that get recommended accumulate more interactions, making them look even more relevant — while items that don't get recommended remain invisible.

## Data Quality Trumps Data Quantity

A common misconception: "We need more data." Often, the real need is **better data.**

- Clean, consistent item metadata beats a catalog with missing fields
- High-quality interaction signals (explicit ratings, completions) beat raw click streams
- Fresh, de-duplicated data beats a historical dump with stale entries

The [data quality section](ch2-data-quality) covers specific quality issues and how to detect them.

**Consider this:** When a recommendation system fails, the first instinct is to blame the algorithm. But in most cases, the root cause is in the data foundation — missing metadata, noisy interactions, or stale catalogs. Before tuning your model, audit your data. It's less glamorous than algorithm research, but it's usually more impactful.