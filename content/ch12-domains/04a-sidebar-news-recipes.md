---
id: ch12-news-recipes
type: spine
title: "News Recipes: Complete Scenario Reference"
readingTime: 5
standalone: false
core: false
teaser: "Every news recommendation scenario — from personalized feeds to cross-site recommendations — with exact configurations and ReQL examples."
voice: explorer
parent: ch13-news
diagram: null
recallQ: "What are the key news recommendation logics?"
recallA: "news:personal (feed), news:daily-news (top stories), news:editors-picks (curated), news:recent (latest), news:read-next (article continuation), news:emailing (newsletter). All support freshness filters and editorial boosts."
publishedAt: "2026-04-04"
status: accepted
---

A complete reference for implementing news recommendation scenarios with exact logic names, parameters, and ReQL examples from [production systems](https://docs.recombee.com/recipes/news).

## Homepage Scenarios

| Scenario | ID | Logic | Type | Key Parameters |
|----------|-----|-------|------|----------------|
| Personalized Feed | `personalized-feed` | `news:personal` | Items→User | Category filter, editor boost, diversity constraints |
| Top Stories | `top-stories` | `news:daily-news` | Items→User | `editorialPicks` (optional list), `publishedTimestamp` |
| Editors' Picks | `editors-picks` | `news:editors-picks` | Items→User | `picks`, `excludeAlreadyRead`, `personalizedReordering` (default: true) |
| Latest News | `latest-news` | `news:recent` | Items→User | `publishedTimestamp`, `excludeAlreadyRead` |
| Personalized Sections | `homepage-sections-and-articles` | `news:articles-from-top-category-for-you` | Composite | Category segmentation + `distinctRecomms` |
| Cross-Site | `cross-site-homepage` | `news:personal` | Items→User | Site filter + per-site constraints |

**Personalized Feed** — The core news personalization. Supports multiple configuration layers:

Category filter (single): `'category' == "sport"`
Category filter (multi): `"sport" in 'categories'`
Exclude specific articles: `'itemId' not in {"article-42", "article-77"}`

Editor boost: add a booster on the `editorsPick` boolean property with adjustable coefficient.

Diversity constraints — two types:
- **Absolute:** Max 3 articles per topic
- **Relative:** Max 50% from one topic

Infinite scroll: initial request returns `recommId`; subsequent pages use `Recommend Next Items` endpoint with that `recommId`.

**Top Stories** — Combines freshness with editorial curation. The `editorialPicks` parameter accepts an optional list of article IDs that get prepended before algorithmic results. The `publishedTimestamp` property enables the model to prioritize fresh content.

**Editors' Picks** — Editors select articles (via Admin UI or API), the algorithm personalizes the order per reader. Set `personalizedReordering: true` to let the algorithm reorder based on reading history. Set `excludeAlreadyRead: true` to filter out previously read articles.

**Latest News** — Pure chronological ranking by `publishedTimestamp`. The `excludeAlreadyRead` parameter (default: true) ensures readers see fresh content.

**Personalized Sections** — Composite pattern: returns both a topic (source) and articles within it (results). The system selects topics based on reader affinity. Requires a property-based segmentation on the category field.

**Cross-Site** — For media companies with multiple publications. All articles live in one Recombee database with a `siteId` property. Filter out current site: `'siteId' != "current-site-id"`. Apply per-site constraints (absolute or percentage) to ensure portfolio diversity.

## Article Page

| Scenario | ID | Logic | Type | Key Parameters |
|----------|-----|-------|------|----------------|
| Read Next | `read-next` | `news:read-next` | Items→Item | Recent filter, same-category filter |

**Read Next** — Article continuation recommendations. Uses Items→Item type — based on the currently read article. Alternative logic `news:related` if topic similarity is the primary criterion. Filter to recent articles (e.g., 30 days) and optionally restrict to the same category.

## Newsletter

| Scenario | ID | Logic | Type | Key Parameters |
|----------|-----|-------|------|----------------|
| Newsletter | `emailing` | `news:emailing` | Items→User | Freshness filter (1d daily / 7d weekly) |

**Newsletter** — Automatically combines personalized recommendations with key unread articles. The freshness filter should match the email frequency: 1 day for daily digests, 7 days for weekly newsletters. Optional category filter for topic-specific campaigns.

## Availability & Freshness

All news scenarios should apply a **recent items filter** — articles older than a threshold (e.g., 3 days for feeds, 30 days for read-next) are excluded. This is the most critical filter in news — without it, stale articles pollute recommendations.

For complete implementation details, see the [news recipe documentation](https://docs.recombee.com/recipes/news).