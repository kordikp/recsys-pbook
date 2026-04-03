---
id: ch2-interactions
type: spine
title: "Explicit vs. Implicit: Two Kinds of Feedback"
readingTime: 3
standalone: false
teaser: "Star ratings vs. dwell time — why modern recommenders trust what you DO more than what you SAY."
voice: thinker
parent: null
diagram: null
recallQ: "Why do modern recommender systems prefer implicit feedback over explicit ratings?"
recallA: "Because users rarely rate things, ratings suffer from systematic biases (mood, social desirability, scale inconsistency), and implicit signals like dwell time, skips, and completions are collected automatically for every interaction."
status: accepted
---

When you give a product 4 stars, that's you **telling** the system what you think. But when you binge-watch a series until 3 AM on a work night, that's the system **observing** what you actually do. These two types of information are called **explicit** and **implicit** feedback -- and they behave very differently in practice.

## Explicit Feedback: What You Say

Explicit feedback is anything where you **actively** communicate your opinion to the system:

- **Star ratings** (1 to 5 stars on Amazon, Glassdoor, Yelp)
- **Thumbs up / thumbs down** (YouTube, Netflix, Spotify)
- **Written reviews** ("This tool transformed our workflow")
- **Wishlists and bookmarks** (saving items on e-commerce platforms, bookmarking articles)
- **Likes and endorsements** (LinkedIn reactions, Twitter/X likes)

This seems like the best data, right? The user is literally telling you what they think. But there's a significant catch...

## The Bias Problem

Ratings lie. Not intentionally -- but they're systematically noisy:

- **Mood effects**: You might rate a product higher on a Friday afternoon than a stressful Monday morning. Research in behavioral economics calls this "incidental affect."
- **Social desirability bias**: People rate popular or prestigious content higher because of perceived consensus. This is well-documented in the ratings of "important" films vs. guilty pleasures.
- **Selection bias (missing data)**: You only rate things you already chose to consume -- you never rate the content you skipped, which might be even more informative for the model.
- **Rating fatigue**: After the fifth "Please rate your experience!" prompt, most users simply stop engaging with the feedback mechanism entirely.
- **Scale inconsistency**: Your "3 stars" might be someone else's "4 stars." Without calibration, ratings across users are not directly comparable -- a fundamental challenge in collaborative filtering.

The biggest problem? **Most people don't rate things at all.** Netflix reported that only about 1% of views resulted in a rating. That means 99% of potentially useful preference information was invisible to the explicit feedback system.

## Implicit Feedback: What You Do

Implicit feedback is everything the system can observe **without requiring any deliberate action** from you:

- **Dwell time**: Did you spend 10 seconds on a page or read the entire article?
- **Completion rate**: Did you finish the video, report, or podcast episode?
- **Skip patterns**: Did you skip the introduction? Fast-forward through certain sections?
- **Scroll velocity**: Did you linger on a post or fly past it? Scroll depth on a page?
- **Repeat behavior**: Did you revisit the same content? Listen to that track on repeat?
- **Temporal patterns**: Industry analysis in the morning, entertainment at night?
- **Device and context**: Phone during commute, laptop at the office, tablet at home?
- **Downstream actions**: Did you search for related content afterward? Subscribe? Share?

None of this requires the user to click a rating button. It's captured passively and continuously.

## Why Implicit Wins

| | Explicit Feedback | Implicit Feedback |
|---|---|---|
| **Volume** | Rare (1% of interactions) | Every single interaction |
| **Effort** | User must actively rate | Collected automatically |
| **Bias** | Mood, social pressure, fatigue | Actions are harder to fabricate |
| **Coverage** | Only rated items | All items interacted with |
| **Negative signal** | "I rated this 1 star" | "I spent 5 seconds and left" |
| **Real-time** | Delayed (rate after consuming) | Instant (measured during consumption) |

The shift from explicit to implicit feedback transformed the industry:

- **Netflix** moved from a 5-star rating system to simple thumbs up/down in 2017 -- because the simpler mechanism actually generated more useful training data. Their VP of Product stated that the change increased feedback volume by over 200%.
- **YouTube** prioritizes **watch time** over likes -- a video you watch for 20 minutes is a stronger signal than one you liked but abandoned after 30 seconds. This shift, made around 2012, fundamentally reshaped what content gets promoted.
- **TikTok** is built almost entirely on implicit signals -- completion rate, replays, shares, and how long you pause on a video before scrolling. This is a key reason its recommendation engine achieved state-of-the-art performance so quickly.

## The Best of Both Worlds

Sophisticated recommender systems don't discard explicit feedback -- they combine both signal types, typically weighting them differently in the loss function. An explicit "thumbs down" remains a very strong signal. But when forced to choose which to rely on more heavily, implicit feedback wins because of its sheer volume and resistance to social desirability bias.

Consider this analogy: if you asked a colleague "What's your preferred management style?" they might say "collaborative and data-driven" (sounds professional, right?). But if you observed how they actually run meetings, make decisions, and respond to reports for six months, you'd get a very different -- and more accurate -- picture. That's the difference between explicit and implicit feedback, and it's the reason modern systems are architected to prioritize behavioral data.
