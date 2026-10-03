---
id: personalization-levels
type: spine
title: "How Personal Should It Be? Five Levels of Personalization"
readingTime: 3
standalone: true
core: false
teaser: "Not every slot on the screen needs to know who you are. Each surface gets the level of personalization it can earn."
parent: null
diagram: diagram-personalization-ladder
recallQ: "How do you decide how personalized a recommendation surface should be?"
recallA: "Treat personalization as a ladder of five levels: generic (same for everyone), segment (same for a group), contextual (depends on the current situation, such as the item on screen), individual (depends on the person's own history) and steerable (the person can adjust it). For each surface, climb only as far as the data available at that moment and the surface's purpose allow, and keep a higher level only if it beats the level below in a test."
highlights:
  - "Five levels: generic, segment, contextual, individual, steerable"
  - "Each level needs more data or engineering than the one below and gives something the one below cannot"
  - "Choose the level per surface, not once for the whole product"
  - "A level stays only if it beats the one below in an A/B test; popularity is the first yardstick"
status: draft
concept: personalization-levels
conceptTitle: "Levels of personalization"
parents: scenarios|context-awareness|user-cold-start
state: edited
lens: media
lang: en
depth: intro..standard
formalism: none
visuality: balanced
lengthBand: deep
genre: explainer
carriers: prose|diagram
---

Mira is the product owner of a city news app, and her boss wants "personalization everywhere" by spring. The app recommends stories in five places, and Mira suspects they don't all need the same thing.

Personalization is a **ladder, not a switch**. Each rung needs more data or engineering than the one below and gives something the one below can't.

**1. Generic: the same for everyone.** "Most read today", editors' picks. Needs only counts of what is popular, so it works on a reader's very first visit. Gives everyone a shared picture of the day and a [popularity](#c/popularity) yardstick that every fancier level must beat. Mira's **breaking-news banner** stays here on purpose: a flood warning should not be filtered by anyone's fondness for football.

**2. Segment: the same for each group.** "Popular in your district", a separate front page for the English edition. Needs one grouping attribute, a **segment**: readers who share a district, a language, or the fact that they are new. Gives relevance to people the app knows nothing else about. Mira's **logged-out front page** is grouped by district.

**3. Contextual: depends on the moment, not the person.** "Read next" under an article, short reads on the morning commute. Needs signals about the situation: the article on screen, the time of day, the device, the last few clicks in this visit (see [context](#c/context-awareness) and [sessions](#c/session-based)). Gives relevance right now, even to anonymous readers. Mira's **article page** lives here.

**4. Individual: depends on your history.** A "For you" tab built from what you have read over weeks. Needs a login and enough past reading per person; a newcomer has none (the [user cold start](#c/user-cold-start) problem). Gives a match to long-term taste, with the risk of narrowing what people see ([filter bubbles](#c/filter-bubbles)). Mira's **For-you tab** for subscribers goes here.

**5. Steerable: you hold the dials.** "More local politics, less sport", "show fewer stories like this". Needs everything from level 4, plus controls on screen and a system that actually obeys them ([steerability](#c/steerability)). Gives trust and a quick way to fix the system's mistakes. Instagram's "Your Algorithm" screen, launched in December 2025, does this for Reels: it shows the topics the app thinks you care about and lets you type in topics you want more or less of. Mira adds topic dials to the For-you tab.

**Picking a level, surface by surface.** Three questions:

1. **What does this surface know about the reader at this moment?** For an anonymous visitor, level 3 is the ceiling.
2. **Should different people see different things here at all?** Emergency banners, legal notices and shared moments like election night say no.
3. **Does the next rung beat the one below in an [A/B test](#c/ab-testing)** (half the readers get the old version, half the new one)? If not, stay put.

The third question carries the most weight, because complex is not automatically better. When researchers re-ran seven reproducible deep-learning recommenders from top conferences, six of them could often be beaten by simple methods such as "readers of this also read".

Mira's plan uses all five levels across five surfaces, and the banner needs no work at all. "Personalization everywhere" became **the right level on each surface**, and that one fits a spring deadline.

**Sources:**
- Instagram (10 December 2025). Control Your Instagram Reels Algorithm. https://about.instagram.com/blog/announcements/reels-algorithm-control
- Ferrari Dacrema, M., Cremonesi, P. & Jannach, D. (2019). Are We Really Making Much Progress? A Worrying Analysis of Recent Neural Recommendation Approaches. *ACM RecSys '19*. https://arxiv.org/abs/1907.06902
