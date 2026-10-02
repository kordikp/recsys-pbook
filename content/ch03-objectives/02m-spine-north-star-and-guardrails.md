---
id: north-star-and-guardrails
type: spine
title: "North Star and Guardrails: Deciding What 'Better' Means"
readingTime: 3
standalone: true
core: false
teaser: "A bug made Bing's search results worse, and two of its headline metrics went up. Choosing what to measure is the first design decision."
parent: null
diagram: diagram-north-star-guardrails
recallQ: "What is the difference between a north-star metric and a guardrail metric, and why does a recommender need both?"
recallA: "The north-star metric is the one number the team tries to improve, chosen because it tracks long-term value (for example customers who stay or revenue left after returns), not because it is easy to move like clicks. Guardrails are metrics the team does not try to improve but that must not get worse beyond an agreed margin (returns, complaints, diversity, speed). Any single number can be pushed up through harmful shortcuts, so a change ships only if the north star improves and no guardrail breaks."
highlights:
  - "The north-star metric is the one number you try to improve, picked because it tracks long-term value, not because it moves easily"
  - "Guardrail metrics are not targets, but they must not get worse beyond an agreed margin"
  - "A quick proxy such as clicks counts only after you check that it moves together with the north star"
  - "In an A/B test the pair becomes the launch rule: ship only if the north star improves and every guardrail holds"
status: draft
concept: north-star-and-guardrails
conceptTitle: "North-star and guardrail metrics"
parents: objectives|satisfaction-vs-engagement
state: edited
lens: generic
lang: en
visuality: balanced
depth: standard
formalism: none
lengthBand: standard
genre: explainer
carriers: prose|table|diagram
---

Before anyone trains a recommender, someone has to finish the sentence *"the new version is better if…"*.

Microsoft's Bing learned why from a bug. An experiment accidentally showed users much worse search results, and the numbers the company measured progress by went up: **queries per user rose by more than 10 % and revenue per user by more than 30 %**. People had to search again and again, clicking ads along the way. If those numbers were the goal, the team noted, they should make search worse on purpose. Their conclusion: a key part of Bing's main metric is **sessions per user**, because satisfied users come back more often.

**The north star.** Pick one primary number, the **north-star metric**, and judge every change by it. A good one reflects value the user actually gets (clicks don't: a misleading headline earns them too), predicts the long-term health of the business, and moves within the length of a test. In 2015 Netflix described **member retention** as the main target for its recommendation tests. Retention barely moves within a single test, so the tests also track viewing time, which Netflix found strongly correlated with retention. That is the honest way to use a **proxy** (a fast stand-in for a slow number): check that it moves together with the north star before you trust it.

**The guardrails.** Any single number can be pushed up in harmful ways. **Guardrail metrics** are ones you don't try to improve but that must not get worse beyond a margin agreed in advance. In one Spotify experiment, switching podcast suggestions from "popular in your group" to personalized ones raised podcast streams by 28.9 %, while the variety of podcasts each listener played fell by 11.5 %. A diversity guardrail exists to put that trade-off on the table before launch.

| Product | A possible north star | Guardrails |
|---|---|---|
| Online shop | Revenue per visitor after returns | Return rate, page speed, out-of-stock suggestions |
| Streaming subscription | Members still subscribed next month | Variety watched, "not interested" clicks |
| News site | Readers who return each week | Instant bounces, variety of sources |
| Job board | Applications that get an employer reply | Spam reports, how evenly postings are shown |

*Illustrative choices, not any company's official metrics.*

**How the pieces connect.** The north star is the measurable form of a business's [objective](#c/objectives) and should lean toward [satisfaction over raw engagement](#c/satisfaction-vs-engagement). It meets reality in an [A/B test](#c/ab-testing): a random half of users gets the new recommender, the rest keep the old one. The launch rule follows: **ship only if the north star improves and no guardrail drops past its margin.**

Write both down before the first experiment starts. Once results arrive, every team can find some metric that went up.

**Sources:**

- Kohavi, Deng, Frasca, Longbotham, Walker, Xu (2012). Trustworthy Online Controlled Experiments: Five Puzzling Outcomes Explained. KDD. https://doi.org/10.1145/2339530.2339653
- Gomez-Uribe, Hunt (2015). The Netflix Recommender System: Algorithms, Business Value, and Innovation. ACM TMIS 6(4). https://doi.org/10.1145/2843948
- Holtz, Carterette, Chandar, Nazari, Cramer, Aral (2020). The Engagement-Diversity Connection: Evidence from a Field Experiment on Spotify. https://arxiv.org/abs/2003.08203
