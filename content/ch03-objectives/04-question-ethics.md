---
id: ch4-q1
type: question
title: "One Objective First: Which Would You Pick?"
readingTime: 1
standalone: false
teaser: "Accuracy, fairness to providers, diversity, or a blend. Which objective would you optimize first, and what does each choice cost?"
voice: universal
parent: null
diagram: null
status: accepted
feedbackA: "The usual first objective: relevance is what users notice first and it is the easiest to measure. The cost is a narrow, popularity-heavy feed, so add guardrail metrics for catalog coverage and diversity from day one."
feedbackB: "Essential when the platform depends on supply (creators, sellers, publishers): if newcomers never get exposure, they leave. Optimized alone it shows users items they do not want, so it usually works as a constraint on top of relevance."
feedbackC: "Protects long-term satisfaction and discovery, but on its own it lowers short-term relevance. Most teams add it as a re-ranking step on top of a relevance model rather than as the main objective."
feedbackD: "Where mature systems end up, but a blend needs weights and the weights need measurements. Start with one primary metric plus guardrails, then add objectives as you learn how they trade off."
concept: objectives
state: edited
lens: generic
visuality: text-first
depth: standard
formalism: none
lengthBand: standard
carriers: prose
---

You are designing recommendations for a new content platform. For the first release you can optimize one objective; the others can only be monitored. Which goes first?

**A) "Accuracy"**
Maximize relevance: every item shown should have a high chance of genuine engagement.

**B) "Fairness to providers"**
Give new and small providers exposure based on the quality of their content, not on how popular they already are.

**C) "Diversity"**
Widen what each user sees, so nobody ends up in an ever-narrower loop of the same content.

**D) "A weighted blend of all three"**
Build a multi-objective system from the start. More complex, but it addresses every stakeholder.

There is no single correct answer, and every option has a price. Each choice is a statement about whose interests the system serves first: users today, providers tomorrow, or the platform's long-term health. [Optimization objectives](#c/objectives) explains how teams make that trade-off explicit.
