---
id: ch4-ab-d-exp
type: spine
title: "Run Your Own A/B Test"
readingTime: 3
standalone: false
teaser: "A music app experiment: which recommendation strategy wins?"
voice: explorer
parent: null
diagram: null
---

Let's walk through a real A/B test, step by step. You're the lead engineer at a music streaming app called "TuneUp." Your mission: figure out the best way to recommend songs.

**The Experiment:**

You have two recommendation strategies:

**Strategy A -- "Popular Picks"**
Show everyone the same 30 most-played songs of the week. Simple. Everyone gets the hit parade.

**Strategy B -- "Personal Mix"**
Analyze each person's listening history. Find users with similar taste. Recommend songs those similar users loved but this person hasn't heard yet.

**Your Users:**

You randomly split 10,000 users into two equal groups. For two weeks, Group A gets Popular Picks and Group B gets Personal Mix.

**The Results:**

| What you measured | Strategy A (Popular) | Strategy B (Personal) |
|---|---|---|
| Songs played per day | 8 | 11 |
| Songs skipped (within 10 seconds) | 35% | 15% |
| New artists discovered per week | 1 | 4 |
| Users who came back every day | 60% | 78% |
| Users who said "I love this app" in survey | 45% | 72% |

**Analyzing the results:**

Strategy B (Personal Mix) wins on EVERY metric:
- People listened to **37% more songs** (11 vs 8)
- They skipped way less (**15% vs 35%**) -- meaning the recommendations were more accurate
- They discovered **4x more new artists** -- the system introduced them to music they wouldn't have found
- More people came back daily (**78% vs 60%**) -- they were more engaged
- Way more people loved the app (**72% vs 45%**)

**But wait -- there's a catch!**

Look more carefully. Strategy A has one hidden advantage: it's MUCH cheaper to run. You just need a list of popular songs. Strategy B requires powerful computers crunching data for each of the 10,000 users individually.

**The real question:** Is Strategy B worth the extra cost? In this case, absolutely yes. The difference is huge. But sometimes the results are closer, and you have to decide whether a small improvement is worth the extra complexity.

**Your turn:** What ELSE would you want to measure? Think about things that might take longer to show up -- like whether people keep using the app after a month, or whether they tell their friends about it. The best A/B tests don't just measure what happens THIS week. They think about the long game.
