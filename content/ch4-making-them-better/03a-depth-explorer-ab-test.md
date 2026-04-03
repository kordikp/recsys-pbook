---
id: ch4-ab-d-exp
type: spine
title: "Anatomy of an A/B Test"
readingTime: 3
standalone: false
teaser: "A detailed walkthrough of a music streaming experiment: which recommendation strategy wins, and how do you know the result is real?"
voice: explorer
parent: null
diagram: kids-ab-test
recallQ: "Do personalized recommendations actually outperform popularity-based baselines?"
recallA: "Typically yes. In this example: 37% more tracks played, 4x more artist discovery, and significantly higher retention with personalization -- with all differences statistically significant."
status: accepted
---

Let us walk through a realistic A/B test, step by step. You are the lead recommendation engineer at a music streaming service called "TuneUp." Your objective: determine which recommendation strategy drives better user outcomes.

**The Experiment Design:**

You have two candidate strategies:

**Strategy A -- "Popular Picks" (Baseline)**
Surface the same 30 most-played tracks of the week to all users. Simple, low-cost, no personalization. Everyone sees the same hit parade.

**Strategy B -- "Personal Mix" (Treatment)**
Analyze each user's listening history. Identify users with similar taste profiles using collaborative filtering. Recommend tracks that similar users engaged with but this user has not yet encountered.

**Sample and Randomization:**

You randomly assign 10,000 users into two equal groups using a hash-based assignment (e.g., user_id mod 2) to ensure stable, balanced assignment. You run a pre-experiment check (an A/A test) to confirm the two groups are statistically equivalent on baseline metrics before introducing the treatment. The experiment runs for two weeks -- a duration chosen based on a power analysis indicating you need approximately 5,000 users per group to detect a 10% difference in daily tracks played at 80% power and 95% confidence.

**The Results:**

| Metric | Strategy A (Popular) | Strategy B (Personal) | Relative Change | p-value |
|---|---|---|---|---|
| Tracks played per day | 8.0 | 11.0 | +37.5% | < 0.001 |
| Skip rate (within 10 seconds) | 35% | 15% | -57.1% | < 0.001 |
| New artists discovered per week | 1.0 | 4.0 | +300% | < 0.001 |
| Daily active user retention | 60% | 78% | +30.0% | < 0.001 |
| User satisfaction (survey: "I value this app") | 45% | 72% | +60.0% | < 0.001 |

**Analyzing the results:**

Strategy B (Personal Mix) outperforms on every measured metric, and all differences are statistically significant (p < 0.001 after Bonferroni correction for 5 simultaneous comparisons):
- Users played **37.5% more tracks** (11 vs 8 per day)
- Skip rate dropped dramatically (**15% vs 35%**) -- indicating substantially better recommendation accuracy
- Users discovered **4x more new artists** -- the system successfully introduced content beyond their existing knowledge
- Daily retention increased from **60% to 78%** -- a meaningful engagement improvement
- Self-reported satisfaction nearly doubled (**72% vs 45%**)

**But there is an important tradeoff:**

Strategy A has one significant operational advantage: it is far cheaper to serve. It requires only a single precomputed popularity list. Strategy B requires per-user model inference -- compute-intensive processing for each of the 10,000 users individually, with associated infrastructure and latency costs.

**The real decision:** Is Strategy B worth the additional infrastructure investment? In this case, the answer is clearly yes -- the magnitude of improvement justifies the cost. But in practice, many A/B tests produce results where the treatment wins by a much smaller margin (e.g., +2% on the primary metric), and the cost-benefit analysis becomes genuinely difficult. Teams must weigh the statistical significance and practical significance of the improvement against the engineering complexity and operational cost of the more sophisticated approach.

**Further considerations:** What additional metrics would you want to track? Consider outcomes that take longer to manifest -- 30-day retention, subscription conversion rate, organic referrals (users recommending the app to colleagues), or long-term listening diversity trends. The best experimentation programs measure not just what happens during the test window but also the **downstream and long-term effects** of the change. They also monitor for unintended consequences: does the personalization strategy inadvertently create deeper filter bubbles? Does it disadvantage new artists relative to the popularity baseline? These second-order effects matter.
