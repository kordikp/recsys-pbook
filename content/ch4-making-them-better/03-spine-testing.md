---
id: ch4-testing
type: spine
title: "Testing, Testing, 1-2-3"
readingTime: 3
standalone: true
core: true
teaser: "How do you know if a recommendation system actually works? Rigorous experimentation -- not intuition."
voice: universal
parent: null
diagram: diagram-eval-stack
recallQ: "What is an A/B test?"
recallA: "A controlled online experiment: randomly assign users to variant A or B, measure behavioral outcomes, and use statistical tests to determine which variant performs better. Data decides -- not opinion."
status: accepted
---

You have built a recommendation system. You believe it performs well. But how do you actually know?

You cannot rely on stakeholder opinion. "The VP of Product thinks it looks great" is not evidence. Neither is "our engineers feel confident about it."

You need **rigorous experimentation**. Specifically, you need an **A/B test** -- the gold standard for causal inference in product development.

**Here is how it works:**

Suppose you are on the recommendation team at Spotify and you have two candidate strategies:
- **Version A:** Recommend the most popular tracks in each genre (a popularity-based baseline)
- **Version B:** Recommend tracks based on each user's individual listening history using collaborative filtering

Which performs better? You could debate it in meetings. But opinion-driven decisions are how you end up recommending jazz standards to death metal enthusiasts.

Instead, you randomly assign users to two groups -- using a hash-based randomization to ensure balanced, independent assignment:
- **Group A** (50% of users) receives Version A recommendations
- **Group B** (50% of users) receives Version B recommendations

Users are unaware of their assignment. They use the platform normally. But behind the scenes, you are measuring a comprehensive set of metrics:

- Sessions per day and tracks played per session
- Skip rate (tracks abandoned within 10 seconds)
- Playlist additions and saves
- Next-day retention (did the user return?)
- Artist diversity (number of distinct artists engaged with)

After a pre-determined experimental period (typically 1-4 weeks, depending on the required **statistical power**), you analyze the results. The analysis is not simply comparing averages -- you apply **statistical hypothesis testing** (typically a two-sample t-test or Mann-Whitney U test) to determine whether observed differences are statistically significant or could have arisen by chance.

Key statistical considerations include:
- **Confidence level**: Typically 95% (alpha = 0.05), meaning you accept a 5% probability of a false positive
- **Statistical power**: Typically 80%, meaning you want an 80% probability of detecting a real effect if one exists
- **Multiple testing correction**: When measuring multiple metrics simultaneously, you must adjust for the increased probability of false positives (using Bonferroni correction, Benjamini-Hochberg, or similar methods)
- **Confidence intervals**: Report not just "B is better" but "B increases retention by 3.2% with a 95% CI of [1.8%, 4.6%]"

**This is how every major platform iterates.** Netflix, YouTube, TikTok, Amazon -- they all run A/B tests continuously. At any given moment, Netflix is running hundreds of concurrent experiments. UI elements, thumbnail selection strategies, ranking algorithms, personalization models -- all under active experimentation.

**Why A/B tests are so powerful:**

They provide **causal evidence** rather than correlational observations. Instead of debating what "should" work, you let user behavior under controlled conditions reveal what actually does. The randomized controlled trial -- borrowed from clinical research methodology -- is the most reliable method for isolating the effect of a single change.

**The nuances practitioners must navigate:** Sometimes Version A generates more short-term clicks but Version B produces better long-term retention. Short-term proxy metrics can diverge from long-term business outcomes. The best experimentation teams carefully select **primary metrics** that align with genuine user value and long-term business health -- not just metrics that are easy to move. They also watch for **novelty effects** (initial excitement about a new feature that fades) and **primacy effects** (resistance to change that dissipates over time).

**Consider this:** If you could run an A/B test on any aspect of your organization -- onboarding process, internal communication tools, meeting formats, hiring pipeline -- what would you test? What would your primary metric be, and how would you distinguish a genuine improvement from noise?
