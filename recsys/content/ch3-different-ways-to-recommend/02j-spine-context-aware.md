---
id: ch3-context-aware
type: spine
title: "Context-Aware Recommendation: It's Not Just What You Like"
readingTime: 3
standalone: true
core: true
teaser: "The same person wants different things at different times. Context-aware systems recognize that preferences aren't fixed -- they shift with time, place, device, and intent."
voice: universal
parent: null
diagram: null
recallQ: "What are the three main architectural approaches to incorporating context into a recommender system?"
recallA: "Pre-filtering (narrow candidates by context before scoring), post-filtering (score all candidates then re-rank by context), and contextual modeling (include context features directly in the scoring model so the model learns context-dependent preferences)."
highlights:
  - "Your preferences are real but context decides which ones are active right now"
  - "Three approaches: pre-filter, post-filter, or model context directly"
  - "Context shifts in seconds -- batch-only systems cannot keep up"
status: accepted
---

You love death metal. But not at a funeral. You devour long-form investigative journalism. But not while sprinting to catch a train. Your preferences are real -- but they are not the whole story. **Context** determines which preferences are active right now.

Traditional recommender systems model a user as a single, static preference profile: "User 427 likes action movies, Italian food, and jazz." Context-aware systems recognize that User 427 likes action movies on Friday nights, Italian food when dining with friends, and jazz while working from home on rainy afternoons. The recommendation changes not because the user changed, but because the situation changed.

## What Is Context?

Context is any information beyond the user and the item that influences whether a recommendation is appropriate. The most important dimensions:

- **Time**: Hour of day, day of week, season, holidays. Breakfast recommendations at 7 AM differ from dinner suggestions at 8 PM. Weekend browsing patterns diverge sharply from weekday patterns.
- **Location**: Where the user is physically located. A restaurant recommendation in Tokyo is useless to someone in Prague. Local events, weather, and regional culture all matter.
- **Device**: Mobile phones favor short-form content, quick interactions, and vertical layouts. Desktop sessions tend toward longer engagement, detailed comparisons, and multi-tab browsing.
- **Session intent**: Is the user browsing casually, researching a purchase, or ready to buy? The same user on the same platform can shift between these modes within minutes.
- **Social situation**: Watching a movie alone vs. with children vs. on a date with a partner. Shopping for yourself vs. buying a gift. The audience around the user reshapes what is appropriate.

## Three Architectural Approaches

There are three fundamental ways to incorporate context into a recommendation pipeline. Each represents a different engineering trade-off.

### Pre-Filtering

**Filter candidates by context before the scoring model ever sees them.** If it is Tuesday morning and the user is on mobile, remove all items that historically perform poorly in that context. The scoring model then operates on a reduced, context-appropriate candidate set.

Advantages: simple to implement, easy to explain, works with any existing scoring model. The model itself doesn't need to understand context -- the filter handles it upstream.

Disadvantages: hard boundaries can be too aggressive. A candidate removed by the pre-filter never gets a chance, even if the model would have scored it highly. Context categories must be defined manually, and edge cases (is 11:30 AM "morning" or "lunch"?) require arbitrary cutoffs.

### Post-Filtering

**Score all candidates with a context-agnostic model, then re-rank or filter the results by context.** The scoring model produces its standard ranked list. A downstream component then adjusts: suppress items inappropriate for the current context, boost items that match it, or re-order based on contextual relevance.

Advantages: the base model is simpler and can be trained on all data without context segmentation. Context logic is modular -- you can swap re-ranking strategies without retraining the model. Post-filters are also useful for applying business rules (don't recommend alcohol to minors, don't surface horror movies in a children's session).

Disadvantages: the model may waste capacity scoring candidates that will be filtered out. The re-ranking step can be crude if it operates on simple rules rather than learned contextual preferences.

### Contextual Modeling

**Include context features directly in the scoring model.** The model takes user features, item features, *and* context features as input, learning how context modulates preference. A factorization machine, for example, can learn interactions between user, item, and time-of-day features jointly. A deep model can encode context through dedicated embedding layers.

This is the most expressive approach. The model can learn nuanced patterns: "User 427 prefers action movies on Friday nights *unless* the session started with a documentary, in which case she tends to continue with documentaries." These interaction effects are impossible to capture with pre- or post-filtering.

The cost: more complex training, larger feature spaces, and the need for sufficient data in each context condition. If a user has only interacted during weekday mornings, the model has little signal for weekend evening preferences.

## Temporal Patterns

Time is the richest and most universal context signal. Effective systems model it at multiple granularities:

- **Time of day**: Morning news digests, afternoon productivity tools, evening entertainment. Spotify's algorithmic playlists shift tone across the day -- upbeat in the morning, focused during work hours, relaxed in the evening.
- **Day of week**: Weekend consumption patterns differ from weekday patterns. E-commerce sees different product categories surge on Saturdays vs. Tuesdays.
- **Seasonality**: Winter clothing, summer travel, holiday gift guides. Seasonal patterns are strong and predictable, making them easy wins for context-aware systems.
- **Trending and recency**: Breaking news, viral content, newly released products. Temporal freshness signals interact with personal preference -- a user who never reads sports may still want to see their national team's World Cup result.

## Device-Aware Recommendations

The device a user is on constrains what content works well:

- **Mobile**: Shorter articles, vertical video, single-item focus, swipe-based interaction. Users tend to have shorter sessions with higher frequency. Recommendations should favor content that delivers value quickly.
- **Desktop**: Longer reads, comparison shopping, detailed product pages, multi-item exploration. Users are often in deeper engagement modes. Recommendations can be more complex and information-dense.
- **Smart speakers and voice assistants**: No visual interface at all. Recommendations must be auditory and sequential -- you can't present a grid of 20 options through a speaker.

Netflix adapts not just which titles it recommends but which **artwork** it shows based on device. A phone screen demands a different visual hierarchy than a 65-inch television.

## Location-Aware Recommendations

When location is available, recommendations become dramatically more relevant for certain domains:

- **Restaurants and food delivery**: Google Maps suggests restaurants based on proximity, time of day, cuisine preference, and price range. A lunch recommendation at noon near your office is fundamentally different from a dinner suggestion on a Saturday in a neighborhood you're visiting.
- **Events and activities**: Local concerts, exhibitions, meetups. Recommendation quality depends on knowing not just what the user likes, but what is physically accessible.
- **Local news**: Regional stories, local weather, community events. News apps like Google News blend global and local stories based on the user's location.
- **Retail**: In-store recommendations on a retailer's app can leverage the user's physical location within the store, surfacing deals in nearby aisles.

Location-aware systems must handle privacy carefully. Many users are uncomfortable with continuous location tracking, and regulations like GDPR impose strict requirements on location data processing.

## Session Intent

The same user on the same platform can have radically different intents across sessions:

- **Browse mode**: No specific goal. The user is open to discovery. Recommendations should emphasize diversity, novelty, and serendipity.
- **Purchase mode**: The user has decided to buy and is comparing options. Recommendations should focus on relevant alternatives, reviews, and complementary items.
- **Research mode**: The user is gathering information. Recommendations should surface comprehensive, authoritative content rather than quick consumables.

Detecting intent is challenging because users rarely declare it explicitly. Systems infer intent from behavioral signals: rapid scrolling suggests browsing, adding items to a cart signals purchase intent, reading multiple articles on the same topic indicates research mode. Session-level sequential models -- which analyze the sequence of actions within a single session -- are the primary tool for intent detection.

## Real-World Examples

**Spotify** is perhaps the most visible practitioner of context-aware recommendation. Its "Daylist" feature generates playlists that shift throughout the day, reflecting the observation that the same listener wants different music at 7 AM, 2 PM, and 10 PM. The system combines time-of-day features with listening history patterns to identify contextual clusters: "Monday morning focus," "Friday evening energy," "Sunday afternoon chill."

**Google Maps** restaurant suggestions are a masterclass in multi-contextual recommendation. They combine location (where you are), time (meal period), personal history (cuisines you've rated or visited), social signal (popular places nearby), and even real-time data (current wait times, open/closed status).

**News applications** like Apple News and Google News construct morning digests that differ from evening editions -- not just in recency, but in tone and depth. Morning editions tend toward briefings and summaries; evening editions lean toward analysis and long-form features.

## The Core Challenge: Context Changes Fast

Unlike user preferences, which evolve over weeks or months, context can shift in seconds. A user steps from a quiet office into a noisy gym. A commuter switches from mobile to desktop upon arriving at work. A casual browser suddenly spots a product they need urgently.

Context-aware models must be **responsive** -- able to adapt recommendations immediately when context signals change. This rules out batch-only systems that recompute recommendations once per day. Production context-aware systems typically use a combination of pre-computed preference scores (updated periodically) and real-time context adjustments (applied at serving time), balancing computational cost with responsiveness.

The payoff is substantial. When a system gets context right, recommendations feel less like algorithmic output and more like genuine understanding. Not just "we know what you like," but "we know what you need right now."
