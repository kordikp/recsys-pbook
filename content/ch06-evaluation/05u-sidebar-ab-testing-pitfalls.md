---
id: ch5-ab-pitfalls
type: spine
title: "A/B Testing Pitfalls: How to Get Reliable Results"
readingTime: 3
standalone: true
core: false
teaser: "Most A/B tests in recommendation systems produce unreliable results. Here's what goes wrong and how to fix it."
voice: explorer
parent: null
diagram: null
recallQ: "What is the most common A/B testing mistake in recommender systems?"
recallA: "Peeking — checking results before the test reaches statistical significance, then stopping when results look favorable. This inflates false positive rates from 5% to 20-30%."
publishedAt: "2026-04-03"
status: accepted
---

A/B testing is the gold standard for evaluating recommendation changes. In theory, it provides causal evidence that a new algorithm is better. In practice, most A/B tests are run incorrectly — producing results that look convincing but are unreliable.

![A/B test flow: randomization, groups, and metric comparison](/images/anim-ab-test-flow.svg)

## Pitfall 1: Peeking

**The problem:** You launch an A/B test. After 2 days, you check results: "Variant B has +3% CTR, p=0.04!" You declare victory and ship it.

**Why it's wrong:** Statistical tests assume a fixed sample size. Checking results repeatedly and stopping when you see significance inflates the false positive rate from the nominal 5% to 20–30%. The more you peek, the more likely you are to see a significant result by chance.

**The fix:** Pre-register the test duration and sample size. Don't look at results until the planned end date. Or use sequential testing methods (Bayesian testing, alpha-spending) designed for continuous monitoring.

## Pitfall 2: Insufficient Power

**The problem:** Your test runs for a week with 10,000 users per variant. You see no significant difference and conclude the variants are equivalent.

**Why it's wrong:** A non-significant result doesn't mean no effect — it might mean the test was too small to detect the effect. With 10K users, you can typically only detect effect sizes > 2%. If the true effect is 0.5%, you'd need 100K+ users to find it.

**The fix:** Run a power analysis *before* starting the test. Determine: What's the minimum detectable effect (MDE) you care about? How many users do you need to detect it with 80% power? If you can't achieve that sample size, don't run the test — you'll just get a noisy non-result.

## Pitfall 3: Network Effects (Interference)

**The problem:** In social platforms, users in the treatment group interact with users in the control group. If the new algorithm changes what content is created or shared, control group users are affected too.

**Why it's wrong:** Standard A/B tests assume independence between groups (SUTVA — Stable Unit Treatment Value Assumption). Network effects violate this assumption, biasing results (typically toward zero — the effect looks smaller than it is).

**The fix:** Cluster randomization (randomize by geographic region or social cluster rather than individual user). Or use switchback experiments (alternate treatment/control over time periods).

## Pitfall 4: Novelty and Primacy Effects

**The problem:** You ship a new recommendation layout. CTR jumps 8% in the first week, then slowly drops back to baseline over a month.

**Why it's wrong:** Users initially engage more with anything new (novelty effect) or initially resist any change (primacy effect). Short-term results don't predict long-term performance.

**The fix:** Run tests for at least 2–4 weeks. Analyze time trends within the test — is the effect growing, stable, or decaying? Plot daily metrics, not just overall averages.

## Pitfall 5: Multiple Testing

**The problem:** You test 5 metrics (CTR, watch time, sessions, revenue, retention). One shows p=0.03. You report this as significant.

**Why it's wrong:** With 5 independent tests at α=0.05, the probability of at least one false positive is 1-(1-0.05)⁵ = 23%. You likely found noise.

**The fix:** Apply multiple testing correction — Bonferroni (divide α by number of tests) or Benjamini-Hochberg (controls false discovery rate). Or pre-register a single primary metric.

## Pitfall 6: Survivorship Bias

**The problem:** You analyze "users who completed at least one session" — but the treatment group might have more drop-outs before completing a session. Your analysis misses them.

**Why it's wrong:** By conditioning on post-treatment behavior, you introduce selection bias. The users who remain may not be comparable between groups.

**The fix:** Intent-to-treat analysis — analyze all randomized users, including those who dropped out.

## A/B Testing Checklist

- [ ] Power analysis completed before launch
- [ ] Single primary metric pre-registered
- [ ] Randomization validated (A/A test or covariate balance check)
- [ ] Test duration pre-determined (no peeking or early stopping without sequential correction)
- [ ] Multiple testing correction applied
- [ ] Novelty effects assessed (time-trend analysis)
- [ ] Intent-to-treat analysis (no survivorship bias)
- [ ] Practical significance assessed (is a 0.1% improvement worth the complexity?)

**Consider this:** A well-run A/B test is one of the most valuable tools in recommendation engineering — and a poorly-run one is one of the most dangerous, because it provides false confidence in bad decisions. The statistical methodology matters as much as the algorithm being tested.