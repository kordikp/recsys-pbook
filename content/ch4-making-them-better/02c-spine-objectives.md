---
id: ch4-objectives
type: spine
title: "What Is the Algorithm Actually Trying to Do?"
readingTime: 4
standalone: true
core: true
teaser: "Every recommender optimizes a specific objective function. The critical question is: whose goals does that function serve?"
voice: universal
parent: null
diagram: diagram-objectives
recallQ: "What is the algorithm actually trying to do?"
recallA: "It depends on the objective function. Subscription services tend to optimize for user satisfaction (retention-driven). Ad-supported services optimize for engagement that maximizes advertising revenue."
status: accepted
---

Here is a fundamental truth that many users overlook: every recommendation algorithm optimizes a **goal** -- a quantity it is trying to maximize (or minimize). This is called the **objective function**, and it determines virtually everything about what the system surfaces.

## Different Objectives, Different Recommendations

Consider the same streaming platform with three different objective functions:

**Objective: Maximize Watch Time** -- The algorithm surfaces content that keeps users engaged as long as possible. This may sound user-aligned, but it can lead to prioritizing addictive formats -- cliffhanger series, autoplay chains, sensationalized content -- over material users would rate as genuinely satisfying in retrospect.

**Objective: Maximize Revenue per User** -- Now the system prioritizes premium rentals, promoted content, and high-margin products, even when a free or lower-cost option would better serve the user. The algorithm is optimizing for the company's bottom line, not user satisfaction.

**Objective: Maximize User Satisfaction** -- This one aims to surface content users will genuinely value. But "satisfaction" is notoriously difficult to measure directly -- the algorithm must infer it from behavioral proxies (completion rates, repeat visits, explicit ratings), each of which is an imperfect signal.

## The Four Stakeholder Perspectives

As researchers at [Recombee](https://www.recombee.com/blog/modern-recommender-systems-part-3-objectives) have articulated, effective recommender systems must balance four distinct stakeholder perspectives:

| Perspective | Priorities | Example |
|---|---|---|
| **User** | Relevant, diverse, trustworthy recommendations | "Surface content I will genuinely value" |
| **Content provider** | Fair exposure, access to the right audience | "Give my new offering meaningful visibility" |
| **Business** | Revenue, retention, growth, unit economics | "Reduce churn and increase lifetime value" |
| **Platform/Product** | Performance, fairness, legal compliance, scalability | "Treat all users and providers equitably within regulatory constraints" |

## When Objectives Conflict

The critical challenge is that these objectives frequently **conflict**. A well-documented Spotify experiment found that personalized podcast recommendations increased streams by 29% -- but reduced listening diversity by 11%. Higher engagement came at the cost of narrower discovery.

The longer-term danger is even more concerning: when a company optimizes purely for short-term revenue (pushing high-margin products, maximizing ad impressions), users eventually recognize the misalignment and disengage. Short-term metric gains erode long-term trust and retention. This dynamic is well-documented in what researchers call **Goodhart's Law**: when a measure becomes a target, it ceases to be a good measure.

## The Business Model Shapes the Objective

A critical lens for evaluating any recommendation system is understanding **who is paying**:

- **Subscription services** (Netflix, Spotify Premium) -- The user is the paying customer. The algorithm is primarily incentivized to optimize the user's experience, because dissatisfaction leads directly to churn and revenue loss.

- **Ad-supported services** (YouTube, TikTok, Instagram, most news aggregators) -- The user is not the primary customer; advertisers are. The algorithm must keep users engaged long enough to generate ad impressions. User attention is the product being monetized. As the saying goes: if you are not paying for the product, you are the product.

This does not mean ad-supported services are inherently adversarial -- but it does mean their recommendation objectives face a structural tension. They must balance user satisfaction with advertiser value. When those goals align, the system works well. When they diverge, the objective function determines which stakeholder wins.

**The key question to ask about any recommendation system**: *What is this algorithm's objective function? Who defined it? And does it align with what I, as a user, actually want?*
