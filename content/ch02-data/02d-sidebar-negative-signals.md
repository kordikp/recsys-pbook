---
id: ch2-negative-signals
type: spine
title: "Negative Signals: What Skips and Exits Tell You"
readingTime: 2
standalone: true
core: false
voice: universal
parent: ch2-interactions
diagram: null
recallQ: "Why are negative signals often more informative than positive ones?"
recallA: "Negative actions (skip, hide, downvote) are conscious rejections, making them more reliable indicators of true preference than positive signals, which can result from accidental engagement or curiosity clicks."
publishedAt: "2026-04-03"
status: accepted
---

Recommendation systems are built primarily on positive signals -- clicks, watches, purchases. But some of the most informative data comes from what users **reject**.

## Types of Negative Signals

Negative signals span a spectrum from passive to active:

**Explicit negatives** are deliberate user actions:
- **Downvote / dislike**: Direct expression of displeasure
- **"Not interested"**: Platform-specific dismissal (YouTube, Netflix, LinkedIn)
- **Hide / mute**: Removing content from view
- **Unfollow / unsubscribe**: Breaking a content relationship
- **Report**: Flagging content as inappropriate or irrelevant

**Implicit negatives** are behavioral patterns that suggest disinterest without a deliberate action:
- **Short dwell time**: Opening an article and bouncing within seconds
- **Skip**: Passing over an item without engaging (common in music and video)
- **Scroll past**: Item was rendered on screen but received no interaction
- **Back button**: Navigating away quickly after clicking
- **Session exit**: The recommendation was the last thing the user saw before leaving

## Why Negatives Are More Reliable

Here is a counterintuitive finding from production systems: **negative signals are often more trustworthy than positive ones**.

A click can be accidental. A purchase can be a gift for someone else. A view might be background noise. Positive engagement is noisy -- it conflates genuine interest with curiosity, habit, and inattention.

But a skip is almost never accidental. When a user actively hides a recommendation, downvotes a video, or unfollows a creator, they are making a conscious, effortful decision. The signal-to-noise ratio is high.

This is why most production systems weight negative signals **2 to 5 times stronger** than the absence of a positive signal. The asymmetry reflects the asymmetry in user intent: doing nothing might mean "didn't see it," but actively rejecting something means "don't want it."

## The Dislike Button Problem

Despite their value, explicit negative signals are scarce. Most users never touch the dislike button. Studies consistently find that fewer than 5% of users ever provide explicit negative feedback. The reasons are predictable:

- **Effort**: It takes more effort to dislike than to simply scroll past
- **Social norms**: Users feel uncomfortable explicitly rejecting content
- **Lack of trust**: Many users doubt that disliking actually changes their recommendations
- **Asymmetric UI design**: Platforms often make the like button prominent and the dislike mechanism buried in a menu

This scarcity means systems cannot rely solely on explicit negatives. They must learn to read the implicit ones.

## Incorporating Negative Signals into Models

Several technical approaches handle negative signals:

**Bayesian Personalized Ranking (BPR)** learns from **pairwise comparisons**: an item the user interacted with should be ranked higher than an item they did not. For each user, sample a positive item (interacted) and a negative item (not interacted), and optimize:

$$\text{maximize} \sum_{(u, i, j)} \ln \sigma(\hat{r}_{ui} - \hat{r}_{uj})$$

where $i$ is the positive item, $j$ is the negative sample, and $\sigma$ is the sigmoid function. Items with explicit negative signals can be used as "hard negatives" that provide stronger training signal than random unobserved items.

**Confidence weighting** (Hu et al., 2008) assigns different confidence levels to different signal types. An explicit dislike might receive confidence weight 10, a short dwell time confidence weight 3, and an unobserved item confidence weight 1. The model learns to distinguish "definitely not interested" from "probably not interested" from "unknown."

**Negative sampling strategies** determine which unobserved items serve as negatives during training. Popularity-biased sampling (drawing negatives proportional to item popularity) produces harder, more informative negatives than uniform random sampling. Items with explicit negative signals provide the hardest negatives of all.

## The Hardest Distinction: "Not Interested" vs. "Didn't See"

The fundamental challenge of implicit negative signals is separating two very different situations:

1. The user **saw the item and chose not to engage** (true negative)
2. The user **never noticed the item** (missing data)

An item at position 47 in a scrollable feed that the user never scrolled to is not a negative signal -- it is an absence of signal. Treating it as negative introduces systematic bias: items shown in low-visibility positions accumulate false negative labels, making them even less likely to be recommended, creating a self-reinforcing cycle.

Production systems address this through **exposure modeling**: tracking which items were actually rendered on the user's screen (entered the viewport) versus merely present in the response. Only items with confirmed exposure can contribute negative signal. This requires client-side instrumentation -- the recommendation backend alone cannot determine what the user actually saw.
