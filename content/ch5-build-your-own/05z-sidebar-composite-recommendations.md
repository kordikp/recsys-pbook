---
id: ch5-composite-recs
type: spine
title: "Composite Recommendations: Building Personalized Homepages"
readingTime: 3
standalone: true
core: false
teaser: "A modern personalized homepage isn't one recommendation — it's five or more, each with a different purpose, combined into a coherent experience."
voice: explorer
parent: null
diagram: null
recallQ: "What are composite recommendations and why do they matter?"
recallA: "A composite recommendation returns both a 'source' (e.g., a category or previously consumed item) and a set of related items in a single request. This enables personalized homepage rows like 'Because you watched X' or 'Top picks from your favorite genre.'"
publishedAt: "2026-04-03"
status: accepted
---

When you open Netflix, you don't see a single list of recommendations. You see a **page of recommendation rows**, each telling a different story:

- "Because You Watched Stranger Things" → 10 similar sci-fi thrillers
- "Trending Now" → 10 currently popular titles
- "Top Picks for You" → 10 highest-confidence personalized suggestions
- "Critically Acclaimed Dramas" → 10 items from a genre the system knows you like
- "New Releases" → 10 recent additions matched to your taste

Each row is a separate recommendation with its own algorithm, its own logic, and its own constraints. Together, they create a **composite homepage** — a personalized content experience far richer than any single recommendation list.

## The Design Pattern

A composite recommendation has two parts:

1. **Source selection:** Choose the row's theme — a category, a previously consumed item, or a personalized concept
2. **Item retrieval:** Find items that match the source, filtered and ranked for this specific user

The source itself is personalized. The system doesn't show "Comedy" to everyone — it selects the genre row most relevant to each user. A thriller fan sees "Mind-Bending Thrillers." A documentary fan sees "Award-Winning Documentaries."

This two-stage approach is implemented as a [composite recommendation pattern](https://docs.recombee.com/scenarios) in production systems — a single API request returns both the source and the items, enabling efficient page construction.

## Building the Page

A fully personalized homepage might issue 5–8 composite recommendation requests:

```
1. "Top Picks" → personalized high-confidence items (generic CF)
2. "Because you watched [auto-selected item]" → item-based similarity
3. "[Auto-selected genre] for You" → genre-filtered personalized
4. "Trending" → popularity-weighted, lightly personalized
5. "New Releases" → recency-filtered, personalized ranking
```

**Key design decisions:**

- **Deduplication:** An item should appear in at most one row. If "Inception" qualifies for both "Top Picks" and "Mind-Bending Sci-Fi," show it in whichever row appears first.
- **Row ordering:** The order of rows is itself personalized. A user who primarily browses by genre should see genre rows first. A user who follows specific creators should see creator rows first.
- **Diversity across rows:** The overall page should cover multiple content types. Don't show 5 rows that are all variations of the same genre.

## Practical Benefits

**Better engagement.** Each row provides a different entry point. If the user isn't interested in "Top Picks," maybe "Trending" catches their eye. Multiple recommendation strategies multiply the chances of a hit.

**Natural explanation.** Row titles like "Because You Watched X" serve as built-in explanations — the user understands why each recommendation appears.

**Business flexibility.** Product teams can add, remove, or reorder rows without changing the underlying algorithm. Want to promote a new category? Add a row. Running a seasonal campaign? Insert a themed row.

**Measurable per-row performance.** Each row can be independently A/B tested and optimized. If "New Releases" consistently underperforms, replace it with "Hidden Gems" and measure the impact.

## The Engineering Challenge

Composite homepages multiply the recommendation workload. Instead of one recommendation per page load, you need 5–8 — each within the same latency budget (typically < 200ms total).

**Solutions:**
- **Parallel execution:** Fire all recommendation requests simultaneously
- **Pre-computation:** Cache row results and update periodically (see [recommendation caching](ch5-caching))
- **Budget allocation:** Give more computation time to rows the user is likely to see first (above the fold)
- **Lazy loading:** Only compute below-the-fold rows when the user scrolls

For implementation patterns, see the [Recombee scenario recipes](https://docs.recombee.com/scenarios) which provide complete composite homepage configurations for different domains.

**Consider this:** The shift from "one recommendation list" to "a page of personalized rows" is one of the most impactful UX decisions in recommendation design. It transforms the experience from "here are items you might like" to "here are several reasons you might find something interesting" — and each reason is individually tuned and measurable.