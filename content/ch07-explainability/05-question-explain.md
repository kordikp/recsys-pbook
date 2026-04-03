---
id: ch7-explain-q1
type: question
title: "How Much Should Users Know?"
readingTime: 1
standalone: false
teaser: "A recommendation system can explain itself at many levels. Where do you draw the line between transparency and simplicity?"
voice: universal
parent: null
diagram: null
publishedAt: "2026-04-03"
status: accepted
options:
  - letter: A, text: Keep it simple -- one sentence per recommendation is enough, voice: explorer
  - letter: B, text: Let users drill down -- summary first with details on demand, voice: thinker
  - letter: C, text: Full transparency -- show every factor and its weight, voice: creator
  - letter: D, text: It depends on the stakes -- low-risk recommendations need less explanation than high-risk ones, voice: universal
---

Your team is designing the explanation interface for a recommendation system. The algorithm uses collaborative filtering, content features, popularity signals, and business rules. You need to decide how much of this to expose to users. There is no wrong answer -- each choice reflects a different philosophy about the relationship between a system and its users.

**A) Keep it simple.** Show users a single, clear reason: "Because you watched Stranger Things" or "Popular in your area." Most users do not want a technical breakdown. They want a quick sanity check. One sentence is enough to build trust without creating cognitive overload. Over-explaining makes the interface cluttered and the system feel less confident.

**B) Let users drill down.** Show a brief summary by default, but let curious users tap for more detail. The summary might say "Based on your viewing history." Tapping reveals: "Specifically, your recent interest in sci-fi thrillers and your high rating of Arrival." This respects both casual users and power users. The challenge is building and maintaining two levels of explanation.

**C) Full transparency.** Show every factor and its contribution: "Genre match: 40%, similar user preferences: 30%, trending score: 20%, editorial boost: 10%." Users deserve to know exactly how the system works. Anything less is paternalistic. If the system cannot justify its decisions in full detail, perhaps it should not be making those decisions.

**D) It depends on the stakes.** A movie recommendation needs minimal explanation -- the cost of a bad suggestion is 90 wasted minutes. A job recommendation, a loan product recommendation, or a news feed that shapes political views demands much more transparency. Match the depth of explanation to the consequence of getting it wrong.
