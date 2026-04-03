---
id: ch5-benchmarks
type: spine
title: "RecSys Benchmarks: Standard Datasets and Their Limitations"
readingTime: 3
standalone: true
core: false
voice: explorer
publishedAt: "2026-04-03"
status: accepted
---

Recommender systems research depends on shared benchmarks. Without common datasets, results from different papers cannot be compared, and progress cannot be measured. Over the past two decades, a small number of datasets have become the de facto standard -- each with distinct strengths and, critically, distinct blind spots that every practitioner should understand before drawing conclusions from experimental results.

## MovieLens

The most cited benchmark in recommender systems history, maintained by the GroupLens research lab at the University of Minnesota since 1998.

MovieLens comes in several sizes: **100K** (100,000 ratings from 600 users on 9,000 movies), **1M** (1 million ratings, 6,000 users, 4,000 movies), **10M**, **20M**, and the current flagship **25M** (25 million ratings from 162,000 users on 62,000 movies). All versions contain explicit ratings on a 1--5 star scale, along with timestamps and basic movie metadata (genres, tags).

MovieLens is popular for good reasons: it is clean, well-documented, freely available, and small enough for rapid prototyping. Thousands of papers have reported results on MovieLens, creating an unmatched basis for comparison.

**Limitations.** MovieLens captures *explicit* ratings -- users deliberately assigned star values. Most modern recommender systems operate on *implicit* feedback: clicks, views, dwell time, purchases. The behavioral dynamics are fundamentally different. A user who rates a movie 3 stars is providing a qualitatively different signal than a user who watched 40% of a movie and then stopped. Results that look strong on MovieLens explicit ratings frequently do not transfer to implicit-feedback production systems. Additionally, MovieLens users are self-selected movie enthusiasts, skewing toward engaged, English-speaking, Western audiences. The rating distribution is heavily left-skewed (users preferentially rate movies they liked), which inflates accuracy metrics relative to what a system would achieve on unfiltered interaction data.

## Amazon Reviews

Amazon has periodically released large-scale review datasets spanning dozens of product categories -- books, electronics, clothing, home goods, movies, music, and more. The most widely used version (curated by Julian McAuley's group at UCSD) contains over 230 million reviews across 29 categories, with both star ratings and full review text.

The dataset's primary value is **multi-domain coverage**. Researchers can study cross-domain recommendation (does knowing a user's book preferences help predict their electronics preferences?), domain-specific modeling (fashion recommendation requires visual features; electronics recommendation requires specification matching), and transfer learning across categories. The sheer scale also enables experiments on long-tail distributions and cold-start scenarios that smaller datasets cannot support.

**Limitations.** Amazon reviews suffer from strong selection bias -- users overwhelmingly review products they feel strongly about, producing a bimodal distribution heavily weighted toward 5-star and 1-star ratings. The dataset lacks negative implicit signals (products viewed but not purchased, search queries that led nowhere). Product catalogs change rapidly, and the static dataset snapshots do not capture the temporal dynamics of product availability, pricing, or seasonal demand.

## Netflix Prize Dataset

The dataset that launched a thousand algorithms. In 2006, Netflix released 100 million ratings from 480,000 users across 17,770 movies and offered a $1 million prize to any team that could improve their recommendation accuracy by 10%. The competition ran for three years and attracted over 40,000 teams, producing foundational advances in matrix factorization, ensemble methods, and temporal modeling.

The Netflix Prize dataset holds enormous **historical significance**. Simon Funk's incremental SVD blog posts during the competition popularized matrix factorization as the dominant paradigm for collaborative filtering -- a position it held for over a decade. The winning solution, a blend of hundreds of models, demonstrated that ensemble methods could squeeze meaningful gains from well-explored datasets.

**Limitations.** Netflix withdrew the dataset from public distribution in 2010 following privacy concerns (researchers demonstrated that anonymized ratings could be de-anonymized by cross-referencing with public IMDb reviews). The dataset is no longer officially available, though copies circulate informally. Beyond availability, the dataset reflects a DVD-rental era when users actively rated movies to improve their queue -- a behavioral context that no longer exists in the streaming age.

## Yelp Dataset

Yelp's open dataset contains approximately 7 million reviews of 150,000 businesses across 11 metropolitan areas, along with business metadata (categories, hours, location), user profiles, check-ins, tips, and -- crucially -- a social network graph of 1.5 million friendship edges.

Yelp is uniquely valuable for **location-based** and **social recommendation** research. The presence of geographic coordinates enables spatial models (recommend restaurants near the user's current location that match their taste profile). The friendship graph supports social-aware recommendation (leverage the preferences of a user's friends as a signal). The rich business metadata enables hybrid approaches combining collaborative and content-based signals.

**Limitations.** Yelp reviews are geographically concentrated in a handful of US and Canadian cities, limiting generalizability. The social graph is sparse -- most users have few connections -- and friendship on Yelp may not reflect meaningful social influence. The business domain (restaurants, services) constrains the types of recommendation problems that can be studied.

## KuaiRand and KuaiRec

These datasets, released by the KuaiShou research team, address one of the deepest methodological problems in offline recommendation evaluation: **exposure bias**.

Standard interaction datasets only record what happened when the system's existing policy chose what to show. We never observe what *would* have happened if a different item had been recommended. This makes offline evaluation fundamentally biased toward the logging policy.

**KuaiRec** contains a fully observed user-item interaction matrix for a subset of users and items -- every user was shown every item, and all responses were recorded. **KuaiRand** provides a larger dataset where a subset of recommendations were made using a *randomized* logging policy (items were shown regardless of predicted relevance).

These datasets are **rare and scientifically invaluable** because randomized exposure data is expensive to collect. It requires deliberately degrading the user experience for a fraction of users by showing them random instead of optimized recommendations. Few companies are willing to pay this cost. When they do, the resulting data enables unbiased evaluation -- researchers can estimate how a new algorithm would perform without the confounding effect of the existing system's selection bias.

**Limitations.** The datasets are drawn from a short-video platform (KuaiShou) with specific interaction dynamics that may not generalize to other domains. The fully observed subset in KuaiRec is small by necessity (the cost of showing every item to every user scales quadratically). The randomized subset in KuaiRand covers a limited time window.

## Spotify Million Playlist Dataset

Released for the 2018 RecSys Challenge, this dataset contains 1 million user-created playlists with over 2 million unique tracks and 287,000 unique artists. Each playlist is an ordered sequence of tracks, often with a descriptive title.

The dataset is particularly well-suited for **sequential** and **session-based recommendation** -- predicting what song should come next given the songs already in a playlist. The ordered structure captures transitions between tracks, enabling models that learn musical flow and stylistic coherence. Playlist titles provide weak supervision for understanding user intent ("Chill Sunday Morning," "Workout Hits," "Road Trip 2018").

**Limitations.** Playlists are curated artifacts, not listening sessions. A user who builds a playlist is making deliberate, reflective choices -- different from the spontaneous, context-dependent behavior of live listening. The dataset contains no playback data (skip rates, repeat listens, shuffle behavior), no temporal information about when playlists were created or modified, and no user-level linking across playlists.

## Dataset Comparison

| Dataset | Size | Domain | Signal Type | Special Features |
|---|---|---|---|---|
| MovieLens 25M | 25M ratings, 162K users, 62K items | Movies | Explicit (1--5 stars) | Clean, well-documented, extensive baselines |
| Amazon Reviews | 230M+ reviews, 29 categories | E-commerce (multi-domain) | Explicit + review text | Cross-domain experiments, scale |
| Netflix Prize | 100M ratings, 480K users, 17K items | Movies | Explicit (1--5 stars) | Historical significance; no longer officially available |
| Yelp | 7M reviews, 150K businesses | Local businesses | Explicit + text + social | Location, social graph, rich metadata |
| KuaiRand / KuaiRec | Varies (KuaiRec: ~1K users, ~3K items fully observed) | Short video | Implicit (watch, like, follow) | Randomized exposure -- unbiased evaluation |
| Spotify Million Playlist | 1M playlists, 2M tracks | Music | Implicit (playlist inclusion) | Sequential structure, playlist titles |

## The Benchmark Trap

Strong benchmark performance is necessary for publication but insufficient for production. The gap between offline results and real-world impact is one of the most persistent problems in applied recommender systems research, and it stems from several structural mismatches.

**Distribution shift.** Benchmark datasets are static snapshots of a specific population at a specific time. Production systems serve evolving user populations whose preferences shift continuously. A model that achieves state-of-the-art nDCG on MovieLens may have learned patterns specific to the demographics and temporal context of that dataset -- patterns that do not generalize to a different user base or a different decade.

**Temporal dynamics.** Most benchmark evaluations use random train/test splits, which allows the model to "peek" at future behavior during training. Production systems must predict the future from the past. Temporal train/test splits (train on interactions before time T, test on interactions after T) are more realistic but consistently produce lower scores, and many papers still do not use them.

**Scale differences.** Academic experiments typically run on thousands to millions of interactions. Production systems process billions. Algorithms that are computationally feasible at benchmark scale may be intractable at production scale, and algorithms that shine at scale (such as approximate methods and distributed training approaches) may show no advantage on small datasets.

**Missing signals.** Benchmarks capture a thin slice of the information available in production: no real-time context, no visual features, no pricing data, no inventory constraints, no business rules, no multi-stakeholder objectives. A benchmark-winning algorithm that ignores these signals will underperform a simpler production model that incorporates them.

**Evaluation metric mismatch.** Benchmarks report accuracy-oriented metrics (precision, recall, nDCG). Production systems care about a portfolio of objectives: engagement, diversity, fairness, revenue, user retention, and content creator satisfaction. Optimizing for one often comes at the expense of others.

## Best Practices for Benchmarking

**Use multiple datasets.** A result that holds on MovieLens, Amazon, and Yelp is far more credible than one reported on MovieLens alone. Cross-dataset consistency is the closest proxy for generalizability that offline evaluation can offer.

**Report confidence intervals.** A single number (e.g., "nDCG@10 = 0.412") conveys false precision. Report means and standard deviations across multiple random seeds, data splits, or bootstrap samples. If the improvement over a baseline falls within the confidence interval, it is not a meaningful improvement.

**Include strong baselines.** Compare against well-tuned versions of established methods, not strawman implementations. A poorly tuned matrix factorization baseline makes any neural method look good. The RecBole, Surprise, and LensKit libraries provide standardized implementations that reduce the risk of baseline misconfiguration.

**Use temporal splits.** Random splits overestimate performance. Split by time: train on the first 80% of interactions chronologically, validate on the next 10%, test on the final 10%. This evaluates the system's ability to predict future behavior from historical data, which is the actual production task.

**Measure beyond accuracy.** Report diversity (intra-list distance), novelty (inverse popularity of recommended items), coverage (fraction of the catalog that appears in any recommendation list), and fairness metrics alongside precision and recall. A system that is accurate but homogeneous is not a good recommender.

**Document preprocessing.** Filtering decisions (minimum number of ratings per user, minimum interactions per item, time window restrictions) can dramatically affect results. Two papers reporting results on "MovieLens 20M" may be evaluating on materially different subsets. State every preprocessing step explicitly and, where possible, release the exact train/test splits used.
