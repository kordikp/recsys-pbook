---
id: ch12-video-recipes
type: spine
title: "Video Recipes: Complete Scenario Reference"
readingTime: 5
standalone: false
core: false
teaser: "Every video recommendation scenario with exact logic names, parameters, and configuration patterns from production systems."
voice: explorer
parent: ch13-video
diagram: null
recallQ: "What are the key video recommendation scenarios and their logic names?"
recallA: "video:personal (for-you), video:continue-watching (resume), video:because-you-watched (composite), video:watch-next (post-playback), video:popular (trending), video:editorial-picks (curated)."
publishedAt: "2026-04-04"
status: accepted
---

A complete reference for implementing video recommendation scenarios. Each entry includes the exact scenario ID, logic name, recommendation type, and key parameters as used in [production video systems](https://docs.recombee.com/recipes/video).

## Scenario Reference

| Scenario | Scenario ID | Logic | Type | Key Parameters |
|----------|------------|-------|------|----------------|
| Recommended For You | `top-picks-for-you` | `video:personal` | Items→User | `assetType`, `excludeAlreadyWatched` |
| Continue Watching | `continue-watching` | `video:continue-watching` | Items→User | `watchingStartedPercentage`, `watchingCompletedPercentage`, `assetType` |
| Because You Watched | `because-you-watched` | `video:because-you-watched` | Composite | source: `maxDaysAgo`, `minWatchedPercentage`; result: `assetType`, `excludeAlreadyWatched` |
| Watch Next | `watch-next` | `video:watch-next` | Items→Item | `assetType`, `excludeAlreadyWatched` |
| Popular & Trending | `popular-movies-and-series` | `video:popular` | Items→User | `timePeriod` (seconds), `userSegmentFilter`, `assetType` |
| Editors' Picks | `editors-picks` | `video:editorial-picks` | Items→User | `picks` (list), `personalizedReordering`, `excludeAlreadyWatched` |
| Actors For You | `actors-for-you` | `recombee:default` | Segments→User | Property-based actor segmentation |

## Scenario Details

**Recommended For You** — The core personalization row. Returns assets based on viewing history; falls back to popular content for new users. Filter by local content with ReQL: `context_user["country"] in 'countries'`. Boost editorial picks with a boolean property booster.

**Continue Watching** — Surfaces partially-watched content for resumption. The logic identifies items where watching started (≥10% by default) but didn't complete (<90%). The `assetType` parameter controls whether to show movies, episodes, or both.

**Because You Watched** — A composite recommendation that returns both a source (the recently watched item) and results (similar items) in a single API call. The source selection uses `maxDaysAgo` and `minWatchedPercentage` to pick an appropriate anchor item. This powers the "Because you watched Succession" row pattern.

**Watch Next** — Post-playback recommendations. Uses Items→Item type — recommendations are based on the item just finished, not the user profile. For episodic content, the system automatically suggests the next episode.

**Popular & Trending** — Popularity-based with configurable time windows. Set `timePeriod` to 604800 for weekly trending or 2592000 for monthly. Use `userSegmentFilter` with ReQL like `'country' == context_user["country"]` for regional charts.

**Editors' Picks** — Editorial teams select content via Admin UI or API; the algorithm personalizes the ordering per user. Set `personalizedReordering: true` (default) to let the algorithm reorder curated selections based on individual viewing history.

**Actors For You** — Uses item segments (not individual items) to recommend actors/directors the user would enjoy. Requires a property-based segmentation on the cast/director field.

## Availability Filters

All scenarios require a global availability filter. Choose based on your catalog structure:

- **Boolean property:** `'available' == true`
- **Publish timestamp:** Items published before now
- **Licensing window:** Items within start/end date range

## Batch Deduplication

When building a homepage with multiple rows, use a single batch request with `distinctRecomms: true` to ensure no item appears in more than one row.

For complete implementation details, see the [video recipe documentation](https://docs.recombee.com/recipes/video).
