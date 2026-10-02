---
id: harm-aware-ranking
type: spine
title: "Safety in Ranking: Remove, Reduce, Inform"
readingTime: 3
standalone: true
core: false
teaser: "Every video in the feed passed moderation. The feed as a whole still wasn't safe. Why the ranker needs its own safety layer, and how to measure whether it works."
parent: null
diagram: diagram-harm-aware-ranking
recallQ: "What does 'reduce' mean in content safety for recommenders, and why isn't removal enough?"
recallA: "'Reduce' means borderline content stays on the platform but is not amplified: it is ranked lower or kept out of recommendations, while followers or search can still reach it. Removal only handles clear rule violations; the recommender's own choices about what to push, to whom and in what sequence can still cause harm, and engagement tends to rise as content nears the policy line. So safety signals must enter ranking, and success is measured by prevalence: the share of views that land on harmful content."
highlights:
  - "Remove what breaks the rules, reduce the reach of borderline content, inform with labels and context"
  - "Harm can come from the sequence and the audience, not only from a single item"
  - "Integrity signals act inside ranking as eligibility filters, score penalties and sequence limits"
  - "Measure prevalence (the share of views that were harmful) and the legitimate content you demoted by mistake"
status: draft
concept: harm-aware-ranking
conceptTitle: "Safety in ranking"
parents: pipeline|filter-bubbles|who-decides|satisfaction-vs-engagement
state: edited
lens: social-feeds
lang: en
depth: standard
formalism: none
visuality: balanced
lengthBand: standard
genre: explainer
carriers: prose|diagram
---

A 15-year-old opens a short-video app to find workout ideas. Ten swipes later, the clips have drifted from home workouts to "what I eat in a day" to skipping meals. Moderators had reviewed every one of those videos, and none broke a rule. The problem is the **sequence**, and the recommender built it.

Removing content is necessary and not enough. Moderation asks *"may this exist?"* A recommender answers a different question: *"should we push this, to this person, right now?"* In 2018 Mark Zuckerberg described a pattern Facebook had found: the closer content gets to the policy line, the more people engage with it, *even when they say afterwards they don't like it*. A ranker trained only on engagement therefore leans toward the line (see [satisfaction vs engagement](#c/satisfaction-vs-engagement)).

**Three levers.** Facebook summed up its strategy in three verbs in 2019, and YouTube uses much the same terms:

- **Remove** content that violates the rules.
- **Reduce** the spread of **borderline content**: allowed, but close to the line. It stays up and followers can still see it; the recommender stops amplifying it. Instagram, for example, began keeping such posts out of Explore and hashtag pages.
- **Inform**: add labels and context so people can decide for themselves.

**Integrity signals inside ranking.** "Reduce" lives in the ranking [pipeline](#c/pipeline), driven by **integrity signals**: a classifier's estimate that an item is borderline, the creator's track record, user reports. They act in three ways:

- **Eligibility filters** decide what may be recommended at all. For example, borderline items reach only people who follow the creator, with a stricter bar for teenage accounts.
- **Score penalties** push borderline items down. In a [multi-task ranker](#c/multi-task-ranking), the harm estimate becomes one more term with a negative weight.
- **Sequence limits** cap how many items on a sensitive topic can follow each other, which is what would have broken the teenager's spiral.

YouTube reported that more than 30 such changes in 2019 cut US watch time of borderline content arriving via recommendations from unsubscribed channels by 70% on average.

**Measure what people saw.** Counting takedowns says how busy the team was, not how safe the feed is. Meta reports **prevalence**: the share of all content views that were of violating content, estimated by sampling views and having human reviewers label them. Views, not posts, because one post may reach nobody and another millions. A feed team should track the same number for recommended views, split by age group.

Then measure the cost. Demotion also hits legitimate topics: recovery stories, health education, news about violence. Sample demoted items to count the wrongly flagged ones, tell creators when their reach is limited, and let them appeal.

A feed built from individually allowed items can still harm. Judge it by what the recommender put in front of people.

**Sources:**
- Meta (2019). Remove, Reduce, Inform: New Steps to Manage Problematic Content. https://about.fb.com/news/2019/04/remove-reduce-inform-new-steps/
- TechCrunch (2018). Facebook will change algorithm to demote "borderline content" that almost violates policies. https://techcrunch.com/2018/11/15/facebook-borderline-content
- YouTube (2019). The Four Rs of Responsibility, Part 2: Raising authoritative content and reducing borderline content and harmful misinformation. https://blog.youtube/inside-youtube/the-four-rs-of-responsibility-raise-and-reduce/
- Meta Transparency Center. Prevalence. https://transparency.meta.com/policies/improving/prevalence-metric/
