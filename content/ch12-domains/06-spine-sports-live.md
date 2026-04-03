---
id: ch13-sports
type: spine
title: "Sports & Live Events: Real-Time Personalization at Scale"
readingTime: 3
standalone: true
core: true
teaser: "When the final whistle blows, millions of fans need their next recommendation in seconds — not minutes. Sports recommendation operates at the speed of live events."
voice: universal
parent: null
diagram: null
recallQ: "What makes sports recommendation uniquely challenging?"
recallA: "Real-time play-by-play personalization during live events, massive traffic spikes on match days, blending live + VOD + archive content, and multi-format delivery (highlights, replays, stats, analysis)."
highlights:
  - "Play-by-play ML engines process live interactions during matches"
  - "Matchday traffic spikes demand elastic infrastructure"
  - "Semantic search handles complex queries like 'UFC finishes in round 1'"
publishedAt: "2026-04-03"
status: accepted
---

Sports recommendation operates at a pace no other domain matches. During a Premier League match day, a Champions League final, or the Super Bowl, millions of fans simultaneously need personalized content — live streams, highlights, replays, stats, analysis — and the system must adapt in real-time as the event unfolds.

## What Makes Sports Unique

**Real-time adaptation.** During a live match, user behavior changes minute by minute. A goal, a red card, or a controversial decision triggers a spike in interest that the recommendation system must detect and respond to immediately. [Real-time play-by-play ML engines](https://www.recombee.com/domains/sports-and-live-events) process these signals during the event.

![lottie:real-time-play-by-play-personalization](Personalizing content play by play as live match events unfold in real time)

**Massive traffic spikes.** A regular Tuesday might see baseline traffic. A World Cup final sees 100× that volume. The infrastructure must scale elastically — and the recommendation quality must hold under load.

![lottie:handle-massive-matchday-traffic-global-tournaments](Scaling infrastructure to handle massive traffic spikes during global tournaments and matchdays)

**Content format diversity.** Sports content spans: live streams, full match replays, curated highlights, post-match analysis, press conferences, statistics pages, transfer news, and preview articles. Each format serves a different user intent at a different moment.

**Editorial blending.** Sports editorial teams need to feature premium matches and promoted events. The system must blend algorithmic personalization with editorial priorities — surfacing the match the league wants promoted while still personalizing the surrounding content.

## Key Scenarios

**Personalized Homepage.** Upcoming matches for teams the user follows, live streams relevant to their preferences, recommended replays, and trending content — all personalized and updating in real-time.

![Fully personalized sports homepage showing upcoming matches, live streams, and replays tailored to fan preferences](/images/domains/sports-and-live-events/fully-personalized-homepage.png)

**Live Game Alerts.** Push notifications when matches the user would care about are starting, or when key events (goals, upsets) happen in matches they're not watching.

![Live game alerts showing real-time push notifications for match starts and key events](/images/domains/sports-and-live-events/live-game-alerts-and-recommendations.png)

**Highlight Reels.** Personalized compilations — "Your weekend highlights" featuring goals, saves, and key moments from matches the user cares about.

**Semantic Sports Search.** Users search with complex queries: "goals this weekend," "UFC finishes in round 1," "Messi free kicks 2024." This requires semantic understanding beyond keyword matching.

**Post-Match Deep Dives.** After a match ends, recommend related content: post-match interviews, tactical analysis, historical comparisons, and upcoming fixtures for the same teams.

## Implementation Recipe

Concrete configurations for sports and live event scenarios. Sports recommendation operates under the tightest latency constraints and highest traffic volatility of any domain.

**Real-Time Event Handling (Burst Detection).** During a live match, user behavior changes second by second. A goal or controversial decision triggers an engagement burst that the system must detect and react to immediately. Use a BMAB-style (Bayesian Multi-Armed Bandit) approach: continuously monitor interaction velocity on content items and dynamically boost items experiencing sudden engagement spikes. When a highlight clip or replay gains rapid traction, the system surfaces it immediately rather than waiting for batch model updates.

```
# Real-time event pipeline:
# 1. Monitor interaction velocity per content item (sliding 60-second window)
# 2. Detect burst: velocity > 3x baseline for that content type
# 3. Boost burst items in recommendation calls:
booster: "if 'interactionVelocity' > 3.0 then 2.5 else 1.0"
# 4. Decay boost as velocity normalizes
cascadeCreate: true
```

**Semantic Search for Complex Sports Queries.** Sports fans search with natural-language queries that keyword matching cannot handle: "best UFC knockouts in round 1," "Messi free kicks from outside the box," or "Premier League goals this weekend." Use semantic search that understands entities (players, teams, events), temporal references ("this weekend," "2024 season"), and action types (goals, saves, knockouts, finishes).

```
# Semantic search configuration:
# - Index content with structured metadata: sport, league, team, player,
#   event_type (goal, save, knockout), round, date, match_id
# - Enable natural language query parsing
# - Apply user preference boosting to personalize results:
booster: "if 'team' in user.'followedTeams' then 1.5 else 1.0"
cascadeCreate: true
```

**Multi-Format Content Mixing.** Sports content spans live streams, full match replays, curated highlight reels, post-match analysis, press conferences, statistical breakdowns, and preview articles. A single homepage or post-match screen must intelligently mix these formats based on user intent and timing. Use format-aware recommendation with diversity constraints to prevent any single format from dominating.

```
logic: "recombee:personal"
# Diversity across content formats:
diversity: "at most 3 per 'contentFormat'"
# contentFormat values: live, replay, highlights, analysis, stats, preview
# Time-aware filtering:
filter: "if 'contentFormat' == \"live\" then 'startTime' < now() + 3600 else true"
# Only show live content starting within the next hour
cascadeCreate: true
```

**Personalized Match Alerts.** Push notifications for matches and events the user would care about. Combine explicit signals (followed teams, favorited leagues) with implicit signals (viewing history of specific sports and competitions) to rank which alerts to send.

```
# Alert priority scoring:
# - Followed team playing: priority = 1.0 (always notify)
# - Frequently watched league: priority = 0.7
# - Inferred interest from viewing history: priority = 0.4
# - Threshold: only send alerts with priority > 0.5 to avoid fatigue
```

**Post-Match Deep Dives.** After a match ends, recommend related content: post-match interviews, tactical analysis, historical comparisons, and upcoming fixtures for the same teams. Use the match ID as context and filter by content tagged to that match or its participants.

```
logic: "recombee:personal"
filter: "'relatedMatchId' == \"match_12345\" or 'team' in {\"TeamA\", \"TeamB\"}"
booster: "if 'contentFormat' == \"highlights\" then 1.5 else 1.0"
cascadeCreate: true
```

For the full domain overview including editorial blending and multi-sport personalization, see the [sports & live events domain overview](https://docs.recombee.com/domains/sports-and-live-events).

## Real-World Results

- **DAZN:** Serving personalized recommendations across [200+ markets](https://www.recombee.com/case-studies) globally
- Quote from Christoph Haas (DAZN EVP): "Their tech enables us to connect each viewer on any device with the right game or clip in real time"

**Consider this:** Sports recommendation is where the emotional stakes are highest. Fans don't just want content — they want to feel connected to their teams and the broader fan community. The algorithm must understand not just preferences but *fandom* — a deeply emotional relationship that transcends standard preference modeling.