---
id: ch4-user-fatigue
type: spine
title: "User Fatigue: When Good Recommendations Go Stale"
readingTime: 2
standalone: true
core: false
voice: universal
publishedAt: "2026-04-03"
status: accepted
---

A recommendation system can be doing everything right -- surfacing relevant items, matching user preferences, optimizing for engagement -- and still lose users over time. The culprit is often not inaccuracy but monotony. When the system keeps delivering the same *type* of content, even if each individual recommendation is technically relevant, users gradually disengage. This is user fatigue, and it is one of the most insidious failure modes in production recommender systems because it does not show up as a sudden drop. It manifests as a slow, steady erosion of engagement that is easy to mistake for seasonal variation or external factors.

## The Four Faces of Fatigue

User fatigue is not a single phenomenon. It takes distinct forms, each with different causes and different interventions:

**Category fatigue.** The system identifies that a user enjoys science fiction and responds by filling every recommendation slot with science fiction. Each individual suggestion is defensible -- the user's history supports it. But by the twentieth consecutive sci-fi recommendation, the user feels trapped. The system has confused a preference for a constraint. Category fatigue is the most common form and the easiest to detect: the user likes a genre but does not want it to be the *only* genre they see.

**Creator fatigue.** A user watches three videos from the same YouTube creator and suddenly that creator dominates their feed. The system has learned a strong signal (repeated engagement with the same source) and is exploiting it. But users often engage with a creator in bursts -- they discover someone new, watch several videos in one session, then move on. The system interprets this as a durable preference when it was actually a momentary binge. Creator fatigue is particularly damaging because it can make users feel that the platform is being "taken over" by a single voice.

**Format fatigue.** A user clicks on several long-form articles and the system concludes they prefer text over video. Or a user watches three 90-minute documentaries and the system stops showing short clips. Format preferences are often context-dependent -- a commuter might prefer short videos in the morning and long reads in the evening -- but the system treats them as stable traits. The result is a feed that feels monotonous not because of *what* is recommended but because of *how* it is presented.

**Recommendation fatigue.** This is the terminal stage. The user has experienced enough category, creator, or format fatigue that they stop engaging with the recommendation interface entirely. They bypass the "For You" feed. They search manually. They rely on external sources for discovery. At this point, the recommendation system has not just failed to help -- it has trained the user to ignore it. Recovery from recommendation fatigue is significantly harder than preventing it.

## How to Detect Fatigue Before Users Leave

Fatigue leaves measurable traces in behavioral data, often well before users consciously recognize it:

**Declining category CTR.** If a user clicked on 40% of recommended thrillers last month but only 15% this month -- while their overall click rate has remained steady or shifted to other categories -- the system is over-indexing on a category whose appeal is waning. Tracking per-category click-through rate over time is the most direct fatigue signal.

**Session length compression.** Users experiencing fatigue tend to spend less time per session. They scroll faster, skim more, and exit sooner. A gradual decline in session duration, particularly when it correlates with increasing homogeneity in the recommendation feed, is a reliable early warning.

**Rising skip rate.** On platforms with sequential consumption (music, video playlists), the skip rate for a given category or creator increases as fatigue sets in. A user who used to listen to every recommended jazz track now skips one in three, then one in two. The system is still predicting relevance correctly in a narrow sense (the user likes jazz), but it is failing to account for saturation.

## Solutions That Work

The research literature and industry practice have converged on several effective countermeasures:

**Diversity injection.** Methods like Maximal Marginal Relevance (MMR) and Determinantal Point Processes (DPPs) -- discussed in detail in the diversity metrics section of this chapter -- explicitly penalize redundancy within a recommendation list. They ensure that even when the top relevance-scored items are all from the same category, the final list presented to the user contains deliberate variety.

**Frequency capping.** Set explicit limits on how many items from the same category, creator, or format can appear in a single recommendation session or within a given time window. This is a blunt instrument compared to diversity-aware re-ranking, but it is simple to implement, easy to explain, and surprisingly effective. Most major platforms use some form of frequency capping as a baseline defense against fatigue.

**Novelty boosting over time.** As a user's engagement with a particular category accumulates, gradually increase the novelty weight for that category in the ranking function. The more thrillers a user has watched recently, the higher the bar a new thriller must clear to appear in their feed. This creates a natural decay effect: categories that have been heavily consumed must earn their way back with genuinely exceptional items.

**Strategy rotation.** Rather than relying on a single recommendation algorithm, alternate between strategies across sessions. One session might emphasize collaborative filtering (what similar users liked), the next might emphasize content-based discovery (items with features the user has not explored), and the next might emphasize trending or editorial content. The user experiences variety not just in items but in the *logic* behind the recommendations.

## The Familiarity Paradox

Here is the uncomfortable truth that makes fatigue management genuinely difficult: users say they want variety, but they engage more with familiar content. This is not hypocrisy -- it is psychology.

The **mere exposure effect**, first documented by Zajonc (1968), demonstrates that repeated exposure to a stimulus increases preference for it. People rate familiar melodies, faces, and even nonsense syllables as more pleasant than unfamiliar ones. Applied to recommendations, this means that showing a user more of what they already know and like *will* generate higher short-term engagement metrics. The user clicks more, watches longer, and rates higher -- for a while.

But **adaptation theory** tells the other half of the story. Psychological research on hedonic adaptation (Frederick & Loewenstein, 1999) shows that the pleasure derived from any repeated stimulus diminishes over time. The tenth time you eat your favorite meal, it is not as satisfying as the first. The hundredth recommended jazz album does not produce the same response as the tenth. The engagement curve bends downward eventually -- the only question is when.

This creates a direct conflict between short-term and long-term optimization:

**Short-term engagement benefits from repetition.** If you are optimizing for this week's click-through rate, showing users more of what they already like is the rational choice. The mere exposure effect is working in your favor. The engagement numbers look strong.

**Long-term retention requires novelty.** If you are optimizing for whether this user is still active six months from now, you must introduce variety even at the cost of lower immediate engagement. The adaptation curve guarantees that a repetition-only strategy will eventually exhaust the user's interest.

The practical guideline that emerges from this tension: treat immediate engagement and long-term retention as separate objectives with separate metrics, and accept that they will sometimes conflict. A system that sacrifices 5% of this week's CTR to introduce category variety that keeps users engaged over the next quarter is making a sound trade. The challenge is that most recommendation systems are evaluated on short-term metrics, which structurally biases them toward the repetition strategy that causes fatigue in the first place.

> **Key references:**
> - Zajonc, R. B. (1968). [Attitudinal Effects of Mere Exposure](https://doi.org/10.1037/h0025848). *Journal of Personality and Social Psychology*, 9(2).
> - Frederick, S. & Loewenstein, G. (1999). Hedonic Adaptation. In *Well-Being: The Foundations of Hedonic Psychology*, Russell Sage Foundation.
> - Carbonell, J. & Goldstein, J. (1998). [The Use of MMR, Diversity-Based Reranking for Reordering Documents and Producing Summaries](https://doi.org/10.1145/290941.291025). *SIGIR 1998*.
> - Kulesza, A. & Taskar, B. (2012). [Determinantal Point Processes for Machine Learning](https://doi.org/10.1561/2200000044). *Foundations and Trends in Machine Learning*, 5(2-3).
