---
id: ch4-reward-design
type: spine
title: "Reward Design: You Get What You Optimize For"
readingTime: 3
standalone: true
core: false
teaser: "The reward function is the most consequential design decision in a recommender system. Get it wrong and you'll efficiently optimize for the wrong thing."
voice: universal
parent: null
diagram: null
recallQ: "Why is reward design so critical and what can go wrong?"
recallA: "The reward function defines what 'success' means for the algorithm. Poorly designed rewards create perverse incentives: optimizing for clicks produces clickbait, optimizing for watch time produces addictive loops. The reward must align with actual user value."
publishedAt: "2026-04-03"
status: accepted
---

Every recommender system optimizes for something — a **reward signal** that tells the algorithm what "good" looks like. The choice of reward function is arguably the most consequential design decision you'll make, because **you get exactly what you optimize for** — including all the unintended consequences.

## The Reward Hierarchy

Different rewards encode different definitions of "value":

| Reward Signal | What It Optimizes | Failure Mode |
|--------------|------------------|--------------|
| Click-through rate | User clicks on recommendation | Clickbait — provocative titles with empty content |
| Watch time | Total time spent consuming | Addictive loops — autoplay into increasingly extreme content |
| Completion rate | Finishing the content | Short, shallow content wins over long, substantive content |
| Explicit rating | User's stated quality judgment | Rating bias — users rate what they already like, not what they discover |
| Purchase | Transaction completion | Price-insensitive overbuying, buyer's remorse |
| Return visit | User comes back tomorrow | Not directly optimizable in the current session |

## The Goodhart Trap

Goodhart's Law: **"When a measure becomes a target, it ceases to be a good measure."**

**Example 1: YouTube's watch time optimization.** When YouTube switched from optimizing clicks to optimizing watch time, content creators adapted by making longer videos. Some added genuine depth; others added padding, recaps, and filler. The metric improved, but content quality was ambiguous.

**Example 2: Engagement optimization in news.** Optimizing for engagement (clicks, comments, shares) systematically favors outrage, controversy, and emotional manipulation — because these generate more engagement than balanced, informative reporting.

**Example 3: Spotify's 30-second threshold.** Because Spotify counts a "stream" only after 30 seconds of play, songs have evolved to front-load their hooks. The metric shapes the art.

## Composite Rewards

One solution: combine multiple signals into a composite reward that's harder to game:

$$R = w_1 \cdot \text{click} + w_2 \cdot \text{dwell\_time} + w_3 \cdot \text{completion} + w_4 \cdot \text{return\_visit} - w_5 \cdot \text{dismissal}$$

**The challenge:** How do you set the weights? They encode value judgments that are ultimately subjective. Is a 5-minute watch worth more than 3 clicks? Is a return visit worth more than a purchase?

**Practical approach:** Use A/B tests to find weights that maximize a long-term business metric (retention, customer lifetime value) rather than a short-term engagement metric.

## Delayed Rewards

The most meaningful outcomes — did the user come back? did they maintain their subscription? did they recommend the platform to a friend? — are **delayed by days or weeks**. But the algorithm needs reward signals in real-time.

**Proxy rewards:** Use immediately observable signals (click, dwell time, rating) as proxies for the delayed outcome you actually care about (retention, satisfaction). The quality of this proxy relationship is critical — and it should be validated regularly.

**Temporal credit assignment:** If a user returns tomorrow, which of today's 50 recommendations deserves credit? This is the credit assignment problem from reinforcement learning, and it's largely unsolved for recommendation.

## Negative Rewards

Incorporating negative signals is at least as important as positive ones:

- **Dismissal ("Not interested"):** Strong negative signal — user actively rejected the recommendation
- **Short dwell + back button:** Implicit negative — content didn't match expectations
- **Unfollow/unsubscribe:** Very strong negative — the recommendation eroded trust
- **Report/block:** Extreme negative — the recommendation was harmful

Negative rewards should typically be weighted 2–5× stronger than absence of positive signal, because they represent active user dissatisfaction rather than passive non-engagement.

## The Satisfaction Question

Netflix's insight deserves emphasis: the best reward signal they found for long-term retention was the answer to **"Would you watch this again?"** — not completion rate, not rating, not watch time.

This suggests that the ideal reward isn't about what users *do* but about what they *value*. The challenge is measuring value — which currently requires surveys, a scalable but imperfect approach.

**Consider this:** When you define a reward function, you're making a statement about what your platform values. Optimizing for clicks says "we value attention capture." Optimizing for satisfaction says "we value user well-being." The algorithm doesn't care which you choose — it will optimize ruthlessly for whatever you tell it to. The responsibility lies with the designers.