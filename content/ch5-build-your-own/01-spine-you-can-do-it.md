---
id: ch5-start
type: spine
title: "You Can Actually Do This"
readingTime: 2
standalone: true
core: true
teaser: "You understand how recommender systems work. Now it's time to build one from scratch."
voice: universal
parent: null
diagram: null
recallQ: "What are the 4 steps to build a recommendation system?"
recallA: "Collect data → find similar users → make predictions → test and improve."
status: accepted
---

At this point, you have a solid understanding of how recommendation systems work. You know about collaborative filtering, content-based filtering, filter bubbles, fairness, and A/B testing. That puts you ahead of the vast majority of professionals who interact with these systems daily without understanding their mechanics.

Now for the most rewarding part: **you're going to build one yourself.**

Not a toy example. Not a thought experiment. A real, working recommendation system that predicts preferences from actual data -- and you'll evaluate its performance against ground truth.

**"But I'm not a machine learning engineer!"**

That's fine. The first version requires nothing but a notebook, a pen, and basic arithmetic. The core idea behind collaborative filtering is simple enough to execute by hand. From there, you can scale it up with a spreadsheet or a short Python script.

**Here's the plan:**

1. **Collect data** -- Survey your team or colleagues for product ratings
2. **Find similar people** -- Identify users with correlated preferences
3. **Make predictions** -- Estimate ratings for unseen items using nearest neighbors
4. **Test it** -- Validate predictions against held-out ratings

Four steps. That's it. By the end, you'll have implemented the same foundational approach that powered Netflix's early recommendation engine.

> **Did you know?** The Netflix Prize, a $1 million competition to improve their recommendation algorithm by 10%, attracted over 40,000 teams from 186 countries. The winning solution was an ensemble of collaborative filtering methods -- the same family of techniques you're about to implement.

Ready to become a recommendation engineer? Let's get started.
