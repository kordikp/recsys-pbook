---
id: ch13-domains-intro
type: spine
title: "Why Domains Matter: One Algorithm Doesn't Fit All"
readingTime: 3
standalone: true
core: true
teaser: "The same algorithm that works for Netflix will fail for a job board. Domain-specific constraints shape every design decision."
voice: universal
parent: null
diagram: null
recallQ: "Why can't you use the same recommendation approach across all domains?"
recallA: "Domains differ in: consumption patterns (repeat vs. one-time), item lifecycle (minutes for news vs. years for movies), feedback signals (watch time vs. purchase vs. application), and constraints (availability, geography, fairness)."
highlights:
  - "Domain constraints shape every layer: data, algorithms, evaluation, and UX"
  - "The same metric (CTR) means fundamentally different things in news vs. e-commerce"
  - "Understanding your domain's unique dynamics is more important than choosing the right algorithm"
publishedAt: "2026-04-03"
status: accepted
---

A recommendation algorithm that excels for movie suggestions will fail spectacularly for job listings. One that drives podcast discovery will be useless for real estate. The reason isn't algorithmic quality — it's **domain structure**.

Every recommendation domain has unique characteristics that constrain and shape the entire system design:

## Four Axes of Domain Variation

**Consumption pattern.** Do users consume the same item repeatedly (music), once (news articles), or once with high stakes (real estate)? Repeat consumption means familiar items are positive signals. One-time consumption means recommending something already seen is a failure.

**Item lifecycle.** A news article is stale in hours. A movie is relevant for years. A job posting expires in weeks. A deal might last 24 hours. The lifecycle determines how aggressively the system must discover and promote new content.

**Feedback signal.** What constitutes "engagement" varies dramatically. In video, it's watch completion. In e-commerce, it's purchase (but also returns as negative signal). In job boards, it's application — but did the candidate get hired? The further the meaningful outcome from the recommendation moment, the harder evaluation becomes.

**Constraints.** E-commerce has inventory availability. Travel has dates and geography. Marketplaces have one-time items. Sports has live event timing. Job boards have two-sided matching. These constraints aren't add-ons — they fundamentally shape the pipeline architecture.

## The Domain Map

| Domain | Repeat | Lifecycle | Key Signal | Key Constraint |
|--------|--------|-----------|------------|----------------|
| Video/Streaming | Moderate | Years | Watch time, completion | Content licensing |
| Music | Very high | Years | Listens, skips | Mood, context |
| News/Media | Never | Hours–days | Read-through, return | Freshness, diversity |
| E-commerce | Low | Months | Purchase, cart | Inventory, price |
| Sports/Live | Low | Hours | Watch, alerts | Real-time, scheduling |
| Marketplaces (P2P) | Never | Days–weeks | Bids, contact | One-time items, geography |
| Job Boards | Never | Weeks | Application | Two-sided matching |
| Real Estate | Never | Weeks–months | Inquiry, viewing | Geography, price |
| Travel | Low | Weeks–months | Booking | Dates, availability |
| Education | Moderate | Permanent | Completion, mastery | Prerequisite ordering |
| Deal Aggregators | Low | Hours–days | Click-out | Expiration, commission |

## What This Chapter Covers

In the following sections, we examine each major domain in detail — the unique challenges, the recommendation scenarios that matter, the metrics that drive decisions, and real-world case studies demonstrating what works.

For each domain, the practical implementation patterns are available as [domain-specific recipes](https://docs.recombee.com/) in production recommendation platforms.

**Consider this:** Before choosing an algorithm, choose your domain's priorities. The best algorithm for your domain might not be the most sophisticated — it might be the one that best respects your domain's constraints. A job board that perfectly optimizes click-through rate but ignores match quality is solving the wrong problem.