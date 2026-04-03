---
id: ch3-friends
type: spine
title: "Ask Your Friends"
readingTime: 3
standalone: true
core: true
teaser: "What if a million users with your exact preferences could recommend items to you?"
voice: universal
parent: null
diagram: kids-collaborative-filtering
recallQ: "How does collaborative filtering work?"
recallA: "Find users with similar preferences → recommend what THEY engaged with that you haven't tried yet. Can be user-user (find similar users) or item-item (find items co-consumed by the same users)."
highlights:
  - "Collaborative filtering: find users with similar preferences, recommend what they liked"
  - "No need to describe preferences — similar users' behavior does it implicitly"
  - "Item-item CF scales better than user-user; Amazon proved this in 2003"
status: accepted
---

Here's a fundamental question: how do you usually discover new content to consume?

If you're like most people, you rely on trusted sources. A colleague mentions a compelling documentary. A friend recommends a restaurant. And if that person's taste consistently aligns with yours, you weight their recommendations more heavily over time.

![Collaborative Filtering Story](/images/comic-cf.svg)

Now imagine you could do that with a MILLION people. Not just your immediate social circle, but a million strangers who happen to share your exact preferences.

That's **collaborative filtering** (CF). It's one of the oldest and most powerful techniques in the recommendation playbook, first formalized in the early 1990s by researchers at Xerox PARC and the GroupLens project at the University of Minnesota. For a broader introduction to how CF fits into modern recommender systems, see Recombee's [introduction to modern recommender systems](https://www.recombee.com/blog/modern-recommender-systems-part-1-introduction).

## How It Works

Here's the basic idea. Consider two users -- you and a colleague named Maya -- who have both consumed a number of items:

- You both rated *The Shawshank Redemption* highly
- You both enjoyed *Breaking Bad*
- You both gave top marks to *Dark*
- You both found *Succession* compelling
- You both recommended *Severance* to others

That's five items you agree on. Five out of five. You and Maya have nearly identical taste profiles.

Now Maya watches something new -- *Silo* -- and rates it highly. You haven't seen it yet.

What does the system do? It says: "You and Maya agreed on EVERYTHING so far. Maya loved *Silo*. You'll probably love it too."

And it recommends *Silo* to you.

## User-User vs. Item-Item Collaborative Filtering

The example above illustrates **user-user CF**: find similar users, then recommend what they liked. But there's an equally important variant.

**Item-item CF** flips the perspective: instead of finding users similar to you, it finds items similar to what you've already consumed. If users who watched *Breaking Bad* also tend to watch *Better Call Saul*, the system recommends *Better Call Saul* to anyone who watched *Breaking Bad* -- regardless of overall user similarity.

Amazon famously popularized item-item CF in their 2003 paper "Amazon.com Recommendations: Item-to-Item Collaborative Filtering" (Linden et al.). Item-item tends to be more scalable and stable than user-user, because item similarity changes less frequently than user profiles.

## Memory-Based vs. Model-Based Approaches

CF methods fall into two broad categories:

- **Memory-based**: Directly compute similarities from the raw user-item interaction matrix at query time. Simple and interpretable, but computationally expensive at scale. Classic examples include k-nearest neighbors (kNN) on users or items.
- **Model-based**: Learn a compressed representation of the interaction data (e.g., matrix factorization, neural embeddings). More scalable and often more accurate, but less transparent.

Modern production systems almost universally use model-based approaches, but memory-based methods remain valuable for prototyping and for domains with smaller datasets.

## The Real Scale

On YouTube, this isn't just you and Maya. It's **billions** of users. The system finds patterns across all of them:

- 50,000 users who consumed the same tech review channels as you also engaged with this product comparison video
- 200,000 Spotify listeners who share your top 10 tracks also gravitate toward this emerging artist
- 10 million Netflix viewers with similar taste profiles gave this series 5 stars

The more users on the platform, the better CF performs. That's why large-scale platforms like YouTube and TikTok have such strong recommendations -- they have massive interaction graphs to mine.

> **Did you know?** The Netflix Prize (2009) offered $1 million to anyone who could improve their recommendation algorithm by 10%. Over 40,000 teams from 186 countries competed, and the winning solution was built on collaborative filtering techniques -- specifically matrix factorization.

**Consider this:** Every time you recommend a product, article, or show to a colleague because you know their taste, you're performing collaborative filtering in your head. The algorithmic version simply scales this intuition to millions of users and items simultaneously.
