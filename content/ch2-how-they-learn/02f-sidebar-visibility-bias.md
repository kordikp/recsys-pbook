---
id: ch2-visibility-bias
type: spine
title: "Visibility Bias: You Can't Click What You Can't See"
readingTime: 2
standalone: true
core: false
teaser: "The system thinks you're not interested in item X. But you never even saw it — it was below the fold. Visibility bias is one of the most insidious data quality problems in recommendation."
voice: universal
parent: null
diagram: null
recallQ: "What is visibility bias and why is it problematic for recommender systems?"
recallA: "Users can only interact with items they actually see. Items placed below the fold or at the bottom of a list receive fewer interactions regardless of relevance. The system incorrectly interprets low interaction as low interest, creating a self-reinforcing cycle."
publishedAt: "2026-04-03"
status: accepted
---

You open a news app. The algorithm shows you 50 articles. You read 3 — the ones at the top of the page. The system logs 3 positive interactions and 47 "non-interactions."

But here's the problem: **you only saw about 10 of those articles.** The other 40 were below the fold — you never scrolled down to them. The system doesn't know this. It records all 47 unseen articles as "shown but not clicked," treating them as evidence of low interest.

This is **visibility bias** — one of the most insidious data quality problems in recommender systems, and a key challenge discussed in [modern recommendation data analysis](https://www.recombee.com/blog/modern-recommender-systems-part-2-data).

## Why It Matters

**False negative signals.** Every unseen item generates a false negative: "the user saw this and chose not to engage." If the system uses these false negatives for training (as most implicit feedback models do), it learns to deprioritize items that were never actually evaluated.

**Position reinforcement.** Items placed at position 1 get seen by everyone. Items at position 20 get seen by almost nobody. Over time, the system learns that position-1 items are "better" — but it's measuring position, not quality. This is the [position bias](ch4-bias-types) problem.

**The downward spiral.** An item placed low in the list → few interactions → system rates it as uninteresting → placed even lower next time → even fewer interactions. The item is trapped — not because it's bad, but because it was never given a fair chance.

## How Platforms Address It

**Scroll depth tracking.** Modern platforms track how far users scroll. If a user only scrolled to position 8, items at positions 9+ were never "seen" and shouldn't count as negatives.

**Impression logging.** Log which items actually appeared in the user's viewport (using IntersectionObserver in the browser), not just which items were in the response payload.

**Position-aware training.** Include position as a feature during training, then remove it during inference. This way the model learns quality-based preferences, not position-based ones.

**Exposure-aware loss functions.** Weight negative examples by their visibility probability: items at position 1 with no click are strong negatives (the user definitely saw and rejected them). Items at position 50 with no click are weak negatives (they probably weren't seen).

$$w_{\text{neg}}(i) = P(\text{seen} | \text{position}_i) \approx \frac{1}{\text{position}_i^\eta}$$

where η controls how quickly visibility decays with position (typically η ≈ 0.5–1.0).

## Practical Impact

Without visibility bias correction:
- **Popular items stay popular** (they're shown at top positions, get seen, get clicked)
- **New items are disadvantaged** (shown at lower positions, rarely seen, incorrectly rated as uninteresting)
- **A/B tests are confounded** (differences in position allocation between variants affect results)
- **Diversity suffers** (the system converges to a narrow set of "proven" items)

With correction:
- Models learn genuine quality signals, not position artifacts
- New items get fairer evaluation
- Diversity increases as position bias no longer dominates the signal

**Consider this:** Visibility bias is a reminder that **observed behavior ≠ true preference.** What users do is shaped not just by what they want, but by what they're given the opportunity to see. Confusing these two things — opportunity and preference — is a fundamental error that pervades recommendation evaluation.