---
id: generative-recommendation-tldr
type: spine
title: "Generative Recommendation in 30 Seconds"
readingTime: 1
standalone: true
core: false
teaser: "Search versus spelling: the idea, its perk and its price, in one minute."
parent: generative-recommendation
recallQ: "What is a semantic ID, and what does a generative recommender do with it?"
recallA: "A short code learned from an item's content, where similar items share the start of the code. The recommender writes the next item's code piece by piece, several codes in parallel, and looks each one up in the catalog instead of searching for the nearest items."
status: accepted
concept: generative-recommendation
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

Classic recommenders **search**: they look through the catalog for the items closest to your taste. A **generative recommender writes** the answer instead.

First, every item gets a **semantic ID**, a short code like 7-1-4, learned from the item's description and pictures and often also from how people use it. Similar items share the start of their code, the way houses on one street share most of their address.

Then a model reads your recent items as codes and **writes the next item's code one piece at a time**, like autocomplete: 7… 1… 9. It writes several codes at once, looks each one up in the catalog, and throws away any code that matches nothing.

The perk: a brand-new item gets its code on day one. The price: more computing for every request, and codes that need rebuilding as tastes shift.
