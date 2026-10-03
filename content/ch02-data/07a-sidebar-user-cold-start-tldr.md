---
id: user-cold-start-tldr
type: spine
title: "User Cold Start in 30 Seconds"
readingTime: 1
standalone: true
core: false
teaser: "A total stranger arrives. Here is what the recommender does first, and how it gets personal."
parent: user-cold-start
recallQ: "A brand-new visitor has no history. What can a recommender use instead, and how does it get personal?"
recallA: "The visit's context (where they came from, device, time, clicks right now), what is popular among similar visits, and maybe a short skippable question; then it learns from the first clicks and shifts weight to the person's own history."
status: accepted
concept: user-cold-start
state: edited
lens: generic
lang: en
visuality: text-first
depth: intro..standard
formalism: none
lengthBand: tldr
genre: explainer
carriers: prose
---

A **new user** has no history, so "people like you also liked" has nobody to compare them with. It is the mirror image of a [new item](#c/item-cold-start): here the person is unknown, but the catalog is well known.

So the system starts with what the visit itself reveals: **where the person came from, their device, the time, and what they click right now**. It adds what is **popular among similar visits**. It may ask one short, skippable **onboarding question** ("trail or road?"), because every question buys information but costs patience.

Then it **learns fast**. Early clicks tell it the most, so it shows a little variety at first, and with every interaction it moves weight from these defaults to the person's own history. None of this needs to know the person's name.
