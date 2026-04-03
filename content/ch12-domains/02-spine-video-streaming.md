---
id: ch13-video
type: spine
title: "Video & Streaming: Keeping Viewers Engaged"
readingTime: 4
standalone: true
core: true
teaser: "Video recommendation is the most visible application of RecSys — and one of the most complex, with content hierarchies, watch progress tracking, and multi-platform delivery."
voice: universal
parent: null
diagram: null
recallQ: "What are the key recommendation scenarios for a video streaming platform?"
recallA: "Personalized homepage, Because You Watched, Continue Watching (resume unfinished), Watch Next (post-playback), Top Genres For You, New Releases, Trending, and Last Chance (expiring titles)."
highlights:
  - "Continue Watching and Watch Next are the highest-engagement placements on most platforms"
  - "Watch progress events (10%, 50%, 90% completion) are richer signals than binary views"
  - "Content hierarchy (series→season→episode) requires special handling in the pipeline"
publishedAt: "2026-04-03"
status: accepted
---

Video streaming is where recommendation systems are most visible — and most consequential. Netflix attributes 80% of content discovery to its recommendation engine. YouTube's algorithm drives 70% of all watch time. The quality of video recommendations directly determines platform retention and content ROI.

## What Makes Video Unique

**Content hierarchy.** A movie is a single item. A TV series is a complex structure: series → seasons → episodes. Recommending "Stranger Things" means the system must also determine *which season and episode* to suggest — the next unwatched one, the first of a new season, or a rewatch prompt.

![lottie:recommendations-of-series-seasons-and-episodes](Navigating the series-season-episode hierarchy to surface the right content at the right level)

**Watch progress as rich signal.** Unlike binary interactions (click/no-click), video generates granular signals: the user watched 10% (sampled and left), 50% (lost interest), 90% (engaged but didn't finish), or 100% (completed). Each threshold conveys different intent. Production systems track [watch milestones](https://docs.recombee.com/recipes/video) at configurable percentages.

**Multi-platform delivery.** The same user watches on mobile during commute, smart TV at home, and laptop at work. Recommendations must be consistent across devices but context-aware — a 2-hour movie suggestion makes sense on the TV but not on mobile during a 15-minute break.

![lottie:recommend-video-content-in-real-time](Adapting video recommendations in real time as viewer context and behavior change)

**Content licensing.** Unlike music (available indefinitely), video content has licensing windows. A movie available today might expire next month. Recommending expiring content requires "Last Chance" scenarios — and never recommending content that's already gone.

![The recommendation pipeline: retrieve, score, re-rank, serve](/images/diagram-pipeline-animated.svg)

## The 12 Key Scenarios

**Homepage Personalization**
The fully personalized homepage is the crown jewel — multiple rows, each with a different recommendation logic, all personalized per user. "Because You Watched Succession," "Top Thrillers For You," "Trending Now," "New Releases." Each row is a separate recommendation call with distinct parameters.

![Fully personalized video streaming homepage with multiple recommendation rows tailored to the viewer](/images/domains/video/fully-personalized-homepage.png)

![lottie:set-up-your-homepage-with-netflix-like-rows](Building a Netflix-style homepage with multiple personalized recommendation rows)

**Continue Watching**
Resume unfinished content or advance to the next episode. Deceptively simple but critical — this is often the highest-engagement placement. A user who started a series and sees it prominently on return is far more likely to continue than one who has to search for it. Typical threshold: [started > 10%, completed < 90%](https://docs.recombee.com/recipes/video).

![Continue Watching row showing unfinished movies and series with progress indicators](/images/domains/video/continue-watching.png)

**Watch Next (Post-Playback)**
What to show when the credits roll. For episodic content: the next episode (obvious). For movies and standalone content: similar items or items from the same director/actor/genre. The few seconds of the post-playback screen are a high-stakes recommendation moment.

**Because You Watched**
Item-based recommendations using a specific recently-watched title as the anchor. "Because you watched Breaking Bad: Better Call Saul, Ozark, Fargo." Typically filtered to items watched > 75% to ensure genuine engagement.

![Because You Watched row showing recommendations anchored to a specific title the viewer recently finished](/images/domains/video/because-you-watched.png)

**Top Genres For You**
Composite recommendation: first determine which genres the user prefers (personalized), then recommend top items within each genre. The genre selection itself is personalized — a thriller fan sees "Mind-Bending Thrillers" while a comedy fan sees "Stand-Up Specials."

**Trending / Popular**
Regional popularity-based recommendations. Important for cultural relevance and social proof ("everyone's talking about this show"). Usually filtered by country or language.

**New Releases**
Recently added content, personalized to user preferences. A pure chronological list wastes attention on irrelevant new content; a personalized ranking surfaces new items the user will actually want.

**Last Chance**
Content expiring soon from the platform. Creates urgency and ensures users don't miss titles before licensing windows close.

## Metrics That Matter

| Metric | What It Measures | Video-Specific Nuance |
|--------|-----------------|----------------------|
| Watch completion rate | Content quality match | >70% = strong signal |
| Series retention | Multi-episode engagement | Did they start S2 after finishing S1? |
| Session depth | Content discovery | How many titles sampled before settling? |
| Churn rate | Platform retention | The ultimate metric — did they cancel? |
| Content coverage | Catalog utilization | Are long-tail titles getting discovered? |

## Implementation Recipe

Here is a concrete configuration for the most important video scenarios. Each one maps to a single API call with specific logic, scenario ID, and parameters — ready to wire into your front end.

**Continue Watching.** Surfaces titles the viewer started but did not finish. Use scenario `continue-watching` with logic `video:continue-watching`. Set `watchingStartedPercentage=10` (the user must have passed the 10% mark to count as "started") and `watchingCompletedPercentage=90` (anything above 90% counts as finished and drops off the row). The `assetType` parameter controls which content types appear (movies and episodes). Apply a global filter for content availability — either a boolean `available` property, a timestamp, or a licensing-window check. This is typically the highest-engagement placement on the homepage.

```
scenario: "continue-watching"
logic: "video:continue-watching"
watchingStartedPercentage: 10
watchingCompletedPercentage: 90
assetType: ["movies", "episodes"]
filter: "'available' == true"          # or timestamp / licensing window filter
cascadeCreate: true
```

**Because You Watched.** A Composite Recommendation anchored to a specific title the viewer recently finished. Use scenario `because-you-watched` with template `video:because-you-watched`. The composite has two sides: *source parameters* control which recently watched title anchors the row (`maxDaysAgo`, `minWatchedPercentage=75`), and *result parameters* control what comes back (`assetType`, `excludeAlreadyWatched`). The row title becomes "Because You Watched [Title]," giving the user a clear explanation for why these items appear.

```
scenario: "because-you-watched"
template: "video:because-you-watched"   # Composite Recommendation type
# Source params (select the anchor title):
sourceParams:
  maxDaysAgo: 30
  minWatchedPercentage: 75
# Result params (what to return):
resultParams:
  assetType: ["movies", "episodes"]
  excludeAlreadyWatched: true
```

**Recommended For You.** The general personalization row. Use `recombee:personal` logic for a user-level recommendation that draws on the full viewing history.

```
logic: "recombee:personal"
cascadeCreate: true
```

**Popular & Trending.** Regional popularity over a rolling window. Use `recombee:popular` with a `timePeriod` of 1209600 seconds (14 days). Add a country filter for regional relevance.

```
logic: "recombee:popular"
timePeriod: 1209600   # 14 days in seconds
filter: "'country' == \"US\""
```

**Homepage Assembly.** A fully personalized homepage is built from 5-6 parallel recommendation calls — one per row. Use the `distinctRecomms` parameter across batch calls to deduplicate items so the same title does not appear in multiple rows. A typical layout:

1. Continue Watching (scenario `continue-watching`, logic `video:continue-watching`)
2. Because You Watched (scenario `because-you-watched`, template `video:because-you-watched`)
3. Top Genres For You (composite: personalized genre segments, then items per genre)
4. Recommended For You (`recombee:personal`)
5. Popular & Trending (`recombee:popular`)
6. New Releases (filter by publish date, personalized ranking)

Fire all calls in parallel with `distinctRecomms: true` and assemble the rows on the client. Each call returns 10-20 items; the front end renders them as horizontally scrollable carousels.

For the full recipe catalog including Editors' Picks For You and Last Chance scenarios, see the [video recommendation recipes](https://docs.recombee.com/recipes/video).

## Real-World Results

- **FTV Prima:** [+34% video views](https://www.recombee.com/case-studies/ftv-prima) on their VOD platform after implementing personalized recommendations
- **Showmax:** Serving personalized recommendations across [70 countries](https://www.recombee.com/case-studies/showmax) with multiple languages
- **Diagnal:** [+35% playbacks](https://www.recombee.com/case-studies/diagnal) through personalized content surfacing

For implementation details, see the [video recommendation recipes](https://docs.recombee.com/recipes/video) and [video domain overview](https://www.recombee.com/domains/video).

**Consider this:** Video recommendation isn't just about finding the right content — it's about finding the right content *at the right moment in the viewing journey*. A user who just finished a heavy drama needs a different recommendation than one who just logged in fresh on a Saturday morning. Context-awareness separates good video recommenders from great ones.