---
id: ch4-unfair-game
type: spine
title: "The Unfair Marketplace"
readingTime: 1
standalone: true
core: true
teaser: "What happens when only established players get visibility? The same dynamic that governs popular content on every platform."
voice: thinker
parent: null
diagram: null
recallQ: "How can platforms make recommendations fairer?"
recallA: "Random sampling for new items, guaranteed minimum exposure for new providers, small-audience testing before scaling to broader distribution."
highlights:
  - "Preferential attachment: items recommended more get more data, reinforcing their advantage"
  - "Fair systems guarantee initial exposure before judging quality"
status: accepted
---

Consider the following scenario in a professional setting:

## The Setup

It is Q1. A company solicits proposals from consulting firms. Five established firms submit. The procurement team selects one -- call it Apex Consulting. Apex delivers strong results. The procurement team remembers Apex.

Q2. Another project opens. This time, the procurement team reaches out to Apex first. Apex submits a proposal (they have the relationship now), and they win again. Strong delivery once more.

By Q4, Apex is the default vendor. They receive every RFP. Their pipeline is full. Their brand equity compounds.

Meanwhile, there is Nova Partners. Nova is equally capable. But in Q1, they were new to the market. Did not have existing relationships. The procurement team did not know them. In Q2, Nova submitted a proposal, but Apex already had the inside track. By Q4, Nova has stopped bidding on that client's work.

**Apex gets selected because they were selected before. Nova stays invisible because they were invisible before.**

## Recognize the Pattern?

This is precisely what happens with algorithmic recommendations:

- Content gains initial traction and gets recommended to more users
- More users engage with it, generating even stronger engagement signal
- It gets recommended even more aggressively
- Meanwhile, excellent new content from an unknown provider is never surfaced
- No one engages with it, so it never enters the recommendation pipeline
- No one engages with it, so it remains invisible indefinitely

Researchers call this the **"rich get richer" problem**, or the **Matthew Effect** (named after a passage in the Gospel of Matthew: "For to everyone who has, more will be given"). In network science, it is formalized as **preferential attachment** -- the probability of receiving a new connection is proportional to the number of connections you already have.

## What Are the Solutions?

If you were redesigning the system, how would you address this? Here are strategies that real platforms and well-designed recommendation systems employ:

- **Random exploration:** Periodically surface content from unknown providers to a random sample of users, decoupling recommendation from existing popularity signal. This is the algorithmic analog of a procurement process that requires evaluation of at least one new vendor per cycle.
- **Guaranteed minimum exposure:** Ensure every new item or provider receives a baseline level of visibility before the algorithm makes a judgment about its quality. Some platforms guarantee new content a minimum number of impressions.
- **Small-audience testing:** Test new content with a small, representative audience before deciding whether to scale distribution. TikTok's approach is a well-known example: every video, regardless of the creator's following, is initially shown to a small cohort, and scaling decisions are based on that cohort's engagement.

Well-designed recommendation systems function like well-designed markets -- they do not simply reward incumbents with the most established signal. They build in mechanisms to ensure that quality can be discovered regardless of starting position.
