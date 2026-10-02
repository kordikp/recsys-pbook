---
id: ch7-explain-q1
type: question
title: "How Much Should Users Know?"
readingTime: 1
standalone: false
teaser: "A recommender can explain itself at many levels. Where do you draw the line between transparency and simplicity?"
voice: universal
parent: null
diagram: null
publishedAt: "2026-04-03"
status: accepted
feedbackA: "Right for low-stakes, high-volume recommendations: one honest reason builds trust at almost no cost. The reason has to be true, though; a generic line that does not reflect what the model used erodes trust once users notice."
feedbackB: "A common pattern: casual users get one line, curious users can drill down. The cost is keeping two levels of explanation that both stay faithful to what the model actually did."
feedbackC: "Appealing in principle, but feature weights from a complex model are rarely faithful or understandable to users, and they make the system easier to game. Full detail serves auditors and internal reviews better than everyday users."
feedbackD: "A sound principle: match the depth of explanation to the cost of a wrong recommendation. A film needs one line; a job, a financial product or a news feed that shapes opinions deserves much more."
concept: steerability
state: edited
lens: generic
visuality: text-first
depth: standard
formalism: none
lengthBand: standard
carriers: prose
---

Your team is designing the explanation interface for a recommender that combines collaborative filtering, content features, popularity signals and business rules. How much of this do you show users?

**A) "Keep it simple: one reason per item"**
A single clear reason, such as "Because you watched Stranger Things" or "Popular in your area". Most users want a quick sanity check, not a technical breakdown.

**B) "Summary first, details on demand"**
A short reason by default ("Based on your viewing history"); a tap reveals more ("your recent interest in sci-fi thrillers and your high rating of Arrival").

**C) "Full transparency: every factor and its weight"**
For example "Genre match 40%, similar users 30%, trending 20%, editorial boost 10%". If the system cannot justify a decision in detail, perhaps it should not make it.

**D) "It depends on the stakes"**
A bad film suggestion costs an evening; a bad job, loan or news recommendation costs much more. Match the explanation to the consequence of getting it wrong.

Each option reflects a view of the relationship between a system and its users. The feedback after your choice says where it works and where it breaks.
