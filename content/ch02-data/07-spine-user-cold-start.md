---
id: user-cold-start
type: spine
title: "User Cold Start: The First Minute of a New Visitor"
readingTime: 3
standalone: true
core: false
teaser: "A first-time visitor has no history. What can a recommender show in the first minute, and how fast can it get personal?"
parent: null
diagram: diagram-user-cold-start-handoff
recallQ: "A brand-new visitor has no history. What can a recommender use instead, and how does it move from generic to personal?"
recallA: "The context of the visit (where they came from, device, time, what they click in this session), what is popular among similar visits, and optionally a few skippable onboarding questions. It treats the first clicks as exploration and shifts weight from these defaults to the person's own history as interactions accumulate."
highlights:
  - "User cold start mirrors item cold start: the person is unknown, but the catalog is well known"
  - "Before any history: the context of the visit plus what is popular in the right segment"
  - "Onboarding questions buy signal at the price of friction, so ask few and make them skippable"
  - "Early clicks count the most: show some variety, then shift weight to the person's own history"
status: draft
concept: user-cold-start
conceptTitle: "User cold start"
parents: digital-footprints|feedback-signals|item-cold-start
state: edited
lens: ecommerce
lang: en
visuality: balanced
depth: standard
formalism: none
lengthBand: standard
genre: explainer
carriers: prose|table|diagram
---

A new visitor is the mirror image of a new item, and the fix is different too.

In [item cold start](#c/item-cold-start), a product nobody has touched meets customers the shop knows well. In **user cold start**, a stranger meets a catalog full of history. [Collaborative filtering](#c/collaborative-filtering), which finds people with similar taste, has no taste to compare yet.

| | Item cold start | User cold start |
|---|---|---|
| Unknown | the item | the person |
| Well known | the customers | the catalog |
| First bridge | what the item *is* | what the visit *says* |

**Second zero.** It is 9 pm. Someone taps an ad for trail-running shoes on their phone and lands in an outdoor shop they have never visited. No account, no purchases, no name. The visit still says a lot: **where they came from** (that ad), **the device**, **the time and season**. None of it requires knowing *who* they are or tracking them across other sites: these are **privacy-friendly signals**.

So the first screen shows **popularity within a segment**: not the shop's overall bestsellers (this week, say, a kayak and a gift card) but what sells best in trail running to phone visitors this season. [Popularity](#c/popularity) is a safe default; popularity in the right [context](#c/context-awareness) is a much better one.

**The one-tap question.** The shop can buy more signal by asking: *Shopping for: road · trail · hiking*. Every question costs patience, and every extra screen is a chance to leave: ask few, make them skippable, and visibly use the answer. Netflix lets a new profile pick a few titles it likes; skip that step and you start with "a diverse and popular set of titles". A good question is easy to answer *and* splits people apart. As MovieLens researchers put it: "If everyone likes Titanic, and I say I like it too, what can the system learn from that?"

**The first click.** The visitor taps a waterproof trail shoe, and the asymmetry pays off: the *products* have plenty of history, so one click links a stranger to everything other shoppers did around that shoe, and "people who viewed this also viewed" works at once. Amazon's engineers reported in 2003 that this item-to-item approach works from as few as two or three items.

An early click also counts more than a regular's, because it moves an empty profile. So the next row mixes things up (a trail shoe, a running vest, a hiking boot) to learn fast which way this person leans: [explore–exploit](#c/explore-exploit) on a small scale. As interactions add up, weight shifts from the defaults to the person's own history.

**Watch for it:** next time you install an app, count the taps before its home screen stops looking like everyone else's. That number is the app's user cold start, and someone on the team is trying to shrink it.

**Sources:**
- Netflix Help Center, "How Netflix's Recommendations System Works": https://help.netflix.com/en/node/100639
- Rashid et al. (2002), "Getting to Know You: Learning New User Preferences in Recommender Systems", IUI 2002. https://doi.org/10.1145/502716.502737
- Linden, Smith, York (2003), "Amazon.com Recommendations: Item-to-Item Collaborative Filtering", IEEE Internet Computing 7(1). https://doi.org/10.1109/MIC.2003.1167344
