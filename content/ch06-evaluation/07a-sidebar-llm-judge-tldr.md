---
id: llm-judge-evaluation-tldr
type: spine
title: "LLM Judges in 30 Seconds"
readingTime: 1
standalone: true
core: false
teaser: "Fast, cheap, biased: what an AI grader can and cannot tell you about your recommendations."
parent: llm-judge-evaluation
recallQ: "Why can't an LLM judge replace an A/B test, and how do you use one safely?"
recallA: "Judges are swayed by the order options appear in and favor longer answers, their own model's text and popular items, and simulated users act unlike real ones. So check the judge against human labels, swap the order and hide who wrote what, use it as a fast filter, and let a live A/B test decide."
status: accepted
concept: llm-judge-evaluation
state: edited
lens: generic
lang: en
depth: intro..standard
formalism: none
visuality: text-first
lengthBand: tldr
genre: explainer
carriers: prose
---

An **LLM judge** is an AI language model asked to grade recommendations or the text around them: "Which of these two explanations helps this person more?" It answers thousands of such questions in an hour, which helps when nothing has been clicked yet. **Simulated users** go further: AI personas that "use" your recommender.

Neither replaces an **A/B test**, a live experiment where real users are randomly split between versions. Researchers have measured judge biases: judges are swayed by the order options appear in, and they favor longer answers, text written by their own model, and popular items. Simulated users are too agreeable and too mainstream.

So treat the judge as a fast filter. Check it against a few hundred human labels, ask every question twice with the order swapped, hide which model wrote what, and let real users pick the winner.
