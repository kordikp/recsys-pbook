---
id: ch6-attention-economy
type: spine
title: "The Attention Economy: You Are the Product"
readingTime: 3
standalone: true
core: false
teaser: "In the attention economy, recommendation algorithms are the machinery that extracts and monetizes human attention at industrial scale."
voice: universal
parent: null
diagram: null
recallQ: "What is the attention economy and how do recommender systems fit into it?"
recallA: "The attention economy treats human attention as a scarce resource to be captured and monetized. Recommender systems are the primary tool for maximizing attention capture — making them both economically essential and ethically fraught."
publishedAt: "2026-04-03"
status: accepted
---

In 1971, Herbert Simon wrote: "A wealth of information creates a poverty of attention." Half a century later, this observation has become the defining economic principle of the digital age.

## The Economic Framework

**The basic model:** Human attention is finite (~16 waking hours per day). Digital platforms compete for shares of this fixed resource. The platform that captures more attention generates more revenue — through advertising, subscriptions, or data monetization.

**The role of recommender systems:** Recommendation algorithms are the primary tool for attention capture. Their job, from the platform's economic perspective, is to maximize the time users spend on the platform — or more precisely, to maximize the revenue extracted per unit of attention.

**Tim Wu's framing:** In "The Attention Merchants" (2016), Wu traces how attention became a commodity — from newspaper advertising to radio to television to the internet. Each generation of media developed more sophisticated tools for capturing and holding attention. Recommender systems are the latest and most powerful iteration.

## Why Engagement ≠ Value

The attention economy creates a structural misalignment between platform incentives and user well-being:

**For the platform:** More time spent = more value captured. An autoplay loop that keeps a user watching for 4 hours is a success.

**For the user:** Time spent is only valuable if the experience was worthwhile. The same 4 hours might represent genuine enjoyment — or a regrettable rabbit hole.

**The measurement gap:** Platforms can easily measure attention (time, clicks, scrolls). They cannot easily measure value delivered (satisfaction, learning, well-being). So they optimize for what they can measure — creating a systematic bias toward attention capture over value delivery.

## The Attention Tax

Every recommendation carries an implicit cost: the user's attention. Even a brief evaluation — "Is this relevant to me?" — takes cognitive resources. Poor recommendations don't just fail to help; they impose an **attention tax** on the user.

Well-designed recommender systems minimize this tax by:
- Surfacing genuinely relevant items early (reducing scanning time)
- Providing sufficient context for quick evaluation (thumbnails, descriptions, match scores)
- Respecting the user's stated boundaries (topic filters, time limits)

Poorly designed systems maximize the tax by:
- Mixing ads with recommendations (forcing users to distinguish)
- Using clickbait to capture attention for low-value content
- Removing friction that would help users make deliberate choices

## The Tristan Harris Critique

Former Google design ethicist Tristan Harris popularized the concept of "the race to the bottom of the brain stem" — platforms competing to exploit ever-more-primitive psychological responses (outrage, fear, social validation) to capture attention.

**The recommender system's role:** The algorithm doesn't create the outrage or fear — but by learning that emotional content generates more engagement, it amplifies it. The recommendation loop acts as an accelerant: emotional content → engagement → more emotional content → more engagement.

**The counterargument:** Platforms argue they're serving user preferences. Users *choose* to engage with emotional content. The algorithm is just efficient at surfacing what users respond to. Whether this is "serving preferences" or "exploiting vulnerabilities" depends on your model of human agency.

## Platform Responses

Some platforms have begun acknowledging the attention economy's externalities:

- **Apple Screen Time / Google Digital Wellbeing:** Tools that help users monitor and limit their platform usage — a remarkable admission that unlimited engagement may not be desirable
- **YouTube's responsibility efforts:** Reducing borderline content recommendations, adding information panels, limiting autoplay
- **Instagram's chronological option:** Allowing users to switch from algorithmic to chronological feeds
- **Subscription models:** Platforms funded by subscriptions (Netflix, Spotify) have less incentive to maximize raw attention, since revenue is fixed per month

## Regulatory Response

The EU's Digital Services Act (DSA) explicitly addresses the attention economy:
- Requires platforms to assess "systemic risks" including negative effects on mental health
- Mandates that recommender parameters be transparent
- Gives users the right to a non-profiling-based recommendation option

**Consider this:** The attention economy isn't inherently bad — it funds free services used by billions. But when recommendation algorithms optimize for attention capture without regard for user well-being, the cost is borne by individuals and society. The question is whether the current balance is acceptable, or whether it needs regulatory correction.