---
id: ch6-q1
type: question
title: "The Design Choice"
readingTime: 1
standalone: true
teaser: "What should recommendation algorithms optimize for? There is no consensus, but your answer reveals which values you would build in."
voice: universal
parent: null
diagram: null
status: accepted
feedbackA: "This is roughly what most feeds do today, and it works well for entertainment. The catch: a feed tuned only to your past behaviour tends to narrow over time, and 'satisfaction' is usually measured through engagement proxies that can drift away from what you value."
feedbackB: "Control matters, and some platforms already offer non-personalized or chronological feeds. In practice few people change defaults, so control works best when the default is also good."
feedbackC: "This puts societal goals into the objective function. The hard part is legitimacy and measurement: who decides what counts as diverse or balanced, and how is that audited?"
feedbackD: "The most defensible position, and the hardest to build: the system must know, or let you say, which mode you are in (unwinding, researching, following a public debate) and switch transparently."
concept: ai-future
state: edited
lens: generic
visuality: text-first
depth: standard
formalism: none
lengthBand: standard
carriers: prose
---

You have seen how recommenders work, what they optimize, and the trade-offs they embody. Now take a position: **what should recommendation algorithms optimize for?**

**A) "My stated preferences and satisfaction"**
It is my feed. Relevance to me comes first, even if I mostly see content that confirms what I already like.

**B) "Maximum control for me"**
Let me switch algorithmic ranking off, use chronological feeds, or rely only on search.

**C) "Diverse perspectives, by design or by regulation"**
Recommenders shape what millions of people see, so they carry a responsibility to support informed citizens, not just satisfied users.

**D) "It depends on the context"**
The platform, my current intent and the stakes decide. No single objective works everywhere.

No answer is definitively correct, and the positions are not permanent. You might want A after a long day, B while researching for work, and C when trying to understand a public issue you know little about.

That suggests a design principle: **users should be able to choose their recommendation mode deliberately and switch between modes transparently.** A configurable system that serves different goals in different contexts, with the user in control of which mode is active, is a concrete engineering target.
