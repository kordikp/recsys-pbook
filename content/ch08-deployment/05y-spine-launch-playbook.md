---
id: launch-playbook
type: spine
title: "The First 90 Days: Launching Recommendations"
readingTime: 3
standalone: true
core: false
teaser: "The model is the last thing you need on day one. A month-by-month checklist for the product owner who just got the green light."
parent: null
diagram: diagram-launch-90-days
recallQ: "What three things should be in place before the first personalized model goes live?"
recallA: "One chosen surface with a non-personalized baseline (such as bestsellers) that the model has to beat; event tracking that logs impressions with their position as well as clicks and purchases, under stable user and item IDs; and an A/B test with a random holdout and a primary metric plus guardrail metrics agreed before the start."
highlights:
  - "Start with one high-traffic surface and a popularity baseline the model must beat"
  - "Log impressions with their position, not just clicks and purchases, before training anything"
  - "Launch as an A/B test with a long-running holdout and guardrails written down in advance"
  - "Run a weekly ship-or-kill review and a monthly one-page update with lift in money"
status: draft
concept: launch-playbook
conceptTitle: "Launching recommendations in a product"
parents: build-vs-buy|scenarios|feedback-signals|popularity|ab-testing|incrementality|north-star-and-guardrails|monitoring
state: edited
lens: ecommerce
lang: en
depth: standard
formalism: none
visuality: balanced
lengthBand: deep
genre: worked-example
carriers: prose|diagram
---

Klara is the product owner at an online outdoor-gear shop. The board has approved "personalization" and the [build-or-buy](#c/build-vs-buy) question is settled. Here is how her first 90 days go, and what she ticks off before moving on.

**Days 1–30: measure before you model.**

- **Pick one surface.** Not "personalize the site", but one [scenario](#c/scenarios) with traffic and a clear job: the "You might also need" strip on product pages, where a tent buyer is one click away from a sleeping bag.
- **Write a tracking plan.** A one-page list of the events the shop logs and the fields each carries. Clicks and purchases are not enough. Log every **impression** (an item actually shown to someone) with its **position** in the strip, under stable user and item IDs. Without impressions the system cannot tell "ignored" from "never seen"; without positions it mistakes slot 1 for quality (more in [feedback signals](#c/feedback-signals)).
- **Ship a popularity baseline.** Fill the strip with the category's bestsellers ([popularity](#c/popularity)). It is cheap, it starts the event logs flowing, and it gives the model something honest to beat. Google's *Rules of Machine Learning* opens the same way: rule 1 is "don't be afraid to launch a product without machine learning", rule 2 is "first, design and implement metrics". Simple baselines are tougher than they look: a 2019 replication study found that 6 of the 7 reproducible neural recommenders it examined could often be beaten by simple nearest-neighbour or graph-based methods.

**Days 31–60: launch as an experiment.**

- **A/B test against the baseline.** Shoppers are split at random: half get the personalized strip, half keep the bestsellers ([A/B testing](#c/ab-testing)).
- **Keep a holdout.** A small random slice, a few percent, sees no recommendations at all, for months. It is the only way to learn what the strip *causes* rather than what merely passes through it ([incrementality](#c/incrementality)).
- **Agree on metrics before the start.** One primary metric (revenue per visitor) and a few **guardrails**: numbers that must not get worse, such as return rate, page load time and the share of the catalogue that ever gets shown ([north star and guardrails](#c/north-star-and-guardrails)). Written down in advance, nobody can pick the flattering number afterwards.

**Days 61–90: find the rhythm.**

- **One change per experiment, a fixed review day.** Each week the team looks at running tests and decides: ship, kill or keep running. Expect most ideas to fail: of well-run experiments at Microsoft designed to improve a key metric, only about a third did. A kill is a result, not an embarrassment.
- **A monthly one-pager for stakeholders.** Lift against the holdout in money, with a range; guardrails green or red; the next bet. Leave out clicks and model accuracy: the board cannot spend them.
- **Then the second surface.** The homepage gets its turn only after the first strip shows a measured lift. From then on, [monitoring](#c/monitoring) keeps an eye on the strip.

On day 90 Klara can say something like (illustrative numbers): "The strip adds €0.80 per visitor, plausibly between €0.30 and €1.30, with returns flat." That sentence carries more weight with the board than any architecture slide.

**Takeaway:** tracking, a baseline and a holdout come before the model, because without them even a great model cannot prove it is great.

**Sources:**
- Zinkevich, M. *Rules of Machine Learning: Best Practices for ML Engineering*. Google for Developers. https://developers.google.com/machine-learning/guides/rules-of-ml
- Ferrari Dacrema, M., Cremonesi, P. & Jannach, D. (2019). Are We Really Making Much Progress? A Worrying Analysis of Recent Neural Recommendation Approaches. *RecSys '19*. https://arxiv.org/abs/1907.06902
- Kohavi, R. et al. (2009). *Online Experimentation at Microsoft* (public version of a Microsoft ThinkWeek paper). http://ai.stanford.edu/~ronnyk/ExPThinkWeek2009Public.pdf
