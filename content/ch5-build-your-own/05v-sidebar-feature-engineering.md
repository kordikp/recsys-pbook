---
id: ch5-feature-eng
type: spine
title: "Feature Engineering for RecSys: What to Feed Your Model"
readingTime: 3
standalone: true
core: false
teaser: "The right features matter more than the right algorithm. Here's what experienced practitioners extract from raw data."
voice: explorer
parent: null
diagram: null
recallQ: "What are the four categories of features used in recommender systems?"
recallA: "User features (demographics, history aggregations), item features (content attributes, popularity stats), interaction features (context, sequence), and cross features (user×item interactions, historical engagement)."
status: accepted
---

A well-featured simple model consistently outperforms a poorly-featured complex model. Feature engineering — the art of extracting informative signals from raw data — remains one of the highest-leverage activities in recommendation engineering.

## User Features

**Demographic:** Age, gender, location, language, device type. Useful for cold-start but limited for personalization.

**Behavioral aggregations:**
- Number of interactions in last 1/7/30 days (activity level)
- Average session length (engagement depth)
- Category distribution of interactions (preference profile)
- Time-of-day activity pattern (circadian preference)
- Diversity of items consumed (exploration tendency)

**Preference signals:**
- Average rating given (calibration offset)
- Genre/category distribution of positive interactions
- Recency-weighted interest vector (recent preferences weighted higher)

## Item Features

**Content attributes:**
- Category, genre, tags (structured metadata)
- Text embeddings of title/description (unstructured)
- Image features (visual embeddings)
- Audio features (for music/podcasts)
- Duration, complexity, reading level

**Popularity statistics:**
- Total interactions (lifetime popularity)
- Recent interactions (trending signal)
- Interaction velocity (rate of change)
- Return/re-engagement rate (quality signal)

**Temporal:**
- Age since publication
- Seasonal relevance scores
- Content freshness decay

## Interaction Features

**Context at interaction time:**
- Time of day, day of week
- Device type and screen size
- Referral source (search, browse, social)
- Session position (first item vs. tenth item)

**Sequential:**
- Last N items interacted with (session context)
- Time since last interaction
- Category sequence (browsing pattern)

## Cross Features

**User×Item historical:**
- Has user seen this item before?
- Has user interacted with items from the same creator/brand?
- User's average rating for this item's category

**Collaborative signals:**
- Number of user's taste neighbors who interacted with this item
- Predicted rating from CF model (as a feature for a downstream ranker)

## Feature Engineering Anti-Patterns

**Too many features.** More features ≠ better model. Each feature adds noise and computational cost. Start with 20–50 features and add only when validated.

**Leaky features.** Features that contain information about the outcome (e.g., "this item was recommended" as a feature for predicting clicks). These inflate offline metrics but don't generalize.

**Stale features.** Features computed from historical data that no longer reflect current state. Always log when features were computed and monitor staleness.

**Missing value handling.** Different strategies for "user has no history" vs "feature computation failed." The former is informative (cold-start); the latter is noise.

## The Feature Store Pattern

Production systems use a **feature store** to ensure consistency between training and serving:

1. Features are defined once as transformation functions
2. The same functions are used for batch (training) and online (serving) computation
3. Feature values are versioned and auditable
4. Point-in-time correctness ensures training data uses features available at prediction time (preventing look-ahead bias)

**Consider this:** Feature engineering is where domain knowledge meets machine learning. An expert who understands both the business domain and ML constraints can extract more value from simple features than an ML researcher can from a complex model with poor features. Invest in features first, model complexity second.