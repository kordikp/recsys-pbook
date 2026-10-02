---
id: ch3-q1
type: question
title: "Which Method Would You Deploy First?"
readingTime: 1
standalone: false
teaser: "A new platform, little interaction data, one engineering sprint. Which approach goes live first, and why?"
voice: universal
parent: null
diagram: null
status: accepted
feedbackA: "Strong later, weak first. Collaborative filtering learns from overlapping behaviour, and a new platform has little of it; brand-new items have none at all. Plan it as step two, once you log enough interactions to beat a baseline."
feedbackB: "Defensible if your catalog has rich, reliable metadata (text, categories, attributes): it works from day one and handles new items. Its limits are more-of-the-same results and dependence on metadata quality; it cannot learn taste that the attributes do not describe."
feedbackC: "Where most mature systems end up, but rarely the right first step. Every component needs data, monitoring and evaluation, and without a simple baseline you cannot tell which part helps. Grow into a hybrid."
feedbackD: "The sound default. Popularity is cheap, robust and the baseline every personalized model must beat. Ship it, log interactions, then add item-item collaborative filtering and measure the lift against the baseline."
concept: pipeline
state: edited
lens: generic
visuality: text-first
depth: standard
formalism: none
lengthBand: tldr
carriers: prose
---

You are launching recommendations on a new platform. There is a catalog, a few weeks of traffic, and one sprint. Which approach goes live first?

**A) "Collaborative filtering"**
Learn from behaviour: people who interacted with the same items probably share taste.

**B) "Content-based filtering"**
Learn from the items: recommend things whose descriptions, categories or attributes resemble what the user liked.

**C) "A hybrid from day one"**
Combine several retrieval sources and a ranking model right away.

**D) "A popularity baseline first"**
Show what is trending or best-selling, log every interaction, and personalize once the data supports it.

Most platforms have a defensible answer here. Choose one, then read why it works or where it breaks.
