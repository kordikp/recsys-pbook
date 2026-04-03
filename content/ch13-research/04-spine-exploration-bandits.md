---
id: ch7-bandits
type: spine
title: "The Exploration Problem: Bandit Algorithms in Practice"
readingTime: 4
standalone: true
core: true
teaser: "Should you recommend what you know works, or take a risk on something new? Bandit algorithms solve this fundamental dilemma."
voice: universal
parent: null
diagram: null
recallQ: "What is the exploration-exploitation trade-off and how does Thompson Sampling address it?"
recallA: "Exploitation serves known-good items; exploration tries uncertain ones to learn. Thompson Sampling balances this by sampling from posterior distributions — uncertain items naturally get explored more."
highlights:
  - "Thompson Sampling auto-balances explore vs. exploit -- no manual tuning needed"
  - "BMAB resets priors at change points so trending content surfaces in minutes"
  - "Bandit regret is provably near-optimal: O(sqrt(KT log T))"
publishedAt: "2026-04-03"
status: accepted
---

Every recommender system faces a fundamental dilemma: **should it recommend items it's confident about (exploitation) or try items it's uncertain about (exploration)?**

Pure exploitation converges to a narrow content diet — you see the same types of content forever. Pure exploration wastes user attention on random items. The optimal strategy balances both, and the mathematical framework for this balance comes from **multi-armed bandit** theory.

## The Multi-Armed Bandit Problem

Imagine a row of slot machines (one-armed bandits), each with a different — unknown — payout rate. You have a limited number of pulls. How do you maximize your total reward?

If you only pull the machine that paid best so far (exploitation), you might miss one that's actually better but had a few bad early outcomes. If you keep trying new machines (exploration), you waste pulls on bad ones you've already identified.

This directly maps to recommendation: each item is a "machine," the payout is whether the user engages, and each recommendation is a "pull." For a practical perspective on how bandits drive content discovery, see Recombee's post on [exploiting popularity and curiosity to recommend trending content](https://www.recombee.com/blog/bandit-models-exploiting-popularity-and-curiosity-to-recommend-trending-content).

## Thompson Sampling: The Bayesian Solution

Thompson Sampling provides an elegant Bayesian approach. For each item, maintain a **probability distribution** over its true quality:

**Setup:** Each item i has parameters (α_i, β_i), starting at (1, 1). These define a Beta distribution representing our belief about the item's true engagement rate.

**Algorithm:**
1. For each candidate item i, sample θ_i ~ Beta(α_i, β_i)
2. Recommend the item with the highest sampled θ
3. If the user engages: α_i ← α_i + 1 (success)
4. If not: β_i ← β_i + 1 (failure)

**Why it works:** Items with uncertain quality (wide distribution) naturally get explored — their samples occasionally land high. Items with known quality (narrow distribution) are exploited — their samples are tightly clustered around the true mean.

The balance is **automatic**: as evidence accumulates, variance decreases, and the system naturally transitions from exploration to exploitation. No manual tuning required.

**Regret bound:** Thompson Sampling achieves O(√(KT log T)) regret, matching the Lai-Robbins theoretical lower bound up to logarithmic factors. It's provably near-optimal.

## The Non-Stationary Challenge: BMAB

Standard bandit theory assumes item quality is constant. In reality, content quality changes: videos go viral, news breaks, seasonal trends emerge.

[BMAB](https://www.recombee.com/blog/are-you-here-to-stay-unraveling-the-dynamics-of-stable-and-curious-audiences-in-web-systems) (Burst-aware Multi-Armed Bandits) addresses this by modeling each item's engagement as a mixture of two Poisson processes:

- **Loyal process:** Stable baseline interest (people who always like this type of content)
- **Curious process:** Bursty, event-driven interest (people drawn by a trending topic)

When the system detects a change point (sudden spike or drop in engagement), it **resets the Thompson priors** to Beta(1,1), forcing rapid re-exploration to identify the new best items.

This is critical for real-world recommendation: a breaking news story changes what users want to see *right now*, and the system needs to adapt within minutes, not days.

## Active Recommendation: Beyond Passive Observation

A fascinating extension is **active recommendation** — where the system strategically chooses *what to recommend* not just to satisfy the current user, but to maximize its learning rate.

In email outreach systems, this becomes particularly important: you can't spam users with recommendations just to learn their preferences. Each recommendation has a cost (user attention, potential unsubscribe). Thompson Sampling naturally balances this by concentrating recommendations where uncertainty is highest — getting maximum information per interaction.

Recent work at Recombee applied this to outreach platforms processing 15 million interactions, reducing spam-like behavior while accelerating preference learning.

> **Research publications:** See the [full list of Recombee research publications](https://www.recombee.com/research-publications).
> - Alves, Ledent, Kloft — "[Burst-aware Multi-Armed Bandits](https://www.recombee.com/research-publications)," RecSys 2021.
> - Alves et al. — "[BPoP: Unraveling Dynamics](https://doi.org/10.1145/3589334.3645473)," WWW 2024.
> - Zid, Alves, Kordík — "[Active Recommendation for Email Outreach](https://www.recombee.com/research-publications)," CIKM 2025.

**Consider this:** The exploration-exploitation trade-off appears everywhere in life: trying a new restaurant vs. going to your favorite, reading a new author vs. re-reading a classic, exploring a new career path vs. deepening your current expertise. Bandit algorithms formalize the optimal strategy — and the answer is always a carefully calibrated mix of both.