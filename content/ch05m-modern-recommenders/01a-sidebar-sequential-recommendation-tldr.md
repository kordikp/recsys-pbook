---
id: sequential-recommendation-tldr
type: spine
title: "Sequential Recommendation in 30 Seconds"
readingTime: 1
standalone: true
core: false
teaser: "Why the order of what you did matters, and when it is worth paying for."
parent: sequential-recommendation
recallQ: "What does a sequential recommender use that an unordered profile ignores, and when is the extra cost worth it?"
recallA: "The order and recency of actions: it predicts the next item from the sequence, like autocomplete predicts the next word, which reveals current intent. It is worth it for long, varied histories; on short visits or repetitive habits, simple 'what usually comes next' counts often do as well for less."
status: accepted
concept: sequential-recommendation
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

**Sequential recommendation** reads what you did as an ordered story, not a pile. Its question is **next-item prediction**: what will this person do next? Autocomplete asks the same about your next word.

Order reveals **current intent**. Someone halfway through a series wants episode 5. Someone who has just bought a phone needs a case, not a second phone. A profile that only counts what you liked averages that away.

The models range from simple "what usually comes next" counts, through recurrent networks that read actions one by one, to transformers such as SASRec that learn which past actions matter right now.

The catch is cost: new actions must reach the model within seconds, and long histories need heavy computing. It pays off on long, varied histories. On short visits or repetitive habits, like a weekly grocery run, the simple counts often do just as well, so test against them first.
