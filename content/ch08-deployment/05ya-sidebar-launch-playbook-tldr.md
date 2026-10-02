---
id: launch-playbook-tldr
type: spine
title: "Launching Recommendations in 30 Seconds"
readingTime: 1
standalone: true
core: false
teaser: "Three months, three steps, and why the model comes last."
parent: launch-playbook
recallQ: "What three things should be in place before the first personalized model goes live?"
recallA: "One chosen surface with a non-personalized baseline (such as bestsellers) that the model has to beat; event tracking that logs impressions with their position as well as clicks and purchases, under stable user and item IDs; and an A/B test with a random holdout and a primary metric plus guardrail metrics agreed before the start."
status: draft
concept: launch-playbook
state: edited
lens: ecommerce
lang: en
depth: intro..standard
formalism: none
visuality: text-first
lengthBand: tldr
genre: explainer
carriers: prose
---

Launching personalization takes three steps of about a month each.

**Measure first.** Pick one surface, say "You might also need" on product pages. Write a **tracking plan**: log every **impression** (an item actually shown) with its position, plus clicks and purchases, under stable user and item IDs. Fill the surface with bestsellers: a **popularity baseline** the model must beat.

**Launch as an experiment.** Test the model against the baseline on randomly split shoppers (an **A/B test**). Keep a small random **holdout** that sees no recommendations. Before the start, fix one main metric and a few **guardrails**, numbers that must not get worse (returns, page speed).

**Find a rhythm.** One change per test, a weekly ship-or-kill review, a monthly one-pager with the lift in money. Expect most ideas to fail.

Without tracking, a baseline and a holdout, even a great model cannot prove it works.
