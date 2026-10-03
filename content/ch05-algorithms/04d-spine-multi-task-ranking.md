---
id: multi-task-ranking
type: spine
title: "Multi-Task Ranking: Predict Many Behaviours, Then Decide What They're Worth"
readingTime: 2
standalone: true
core: false
teaser: "A ranker that only predicts clicks fills the page with clickbait. Modern rankers predict clicks, purchases, returns and hides, and a product team decides what each one is worth."
parent: null
diagram: diagram-multi-task-value-model
recallQ: "Why does a modern ranking model predict several behaviours for each item instead of one score, and how do those predictions become a single ranking?"
recallA: "Because no single behaviour captures value: optimizing clicks alone rewards clickbait, and a purchase that gets returned or an item the user hides is a loss. One shared model predicts several behaviours per item (click, purchase, return, hide), and a value model multiplies each prediction by a weight, negative for unwanted behaviours, and adds them up into one score. The weights encode the product's goals and are tuned with experiments."
highlights:
  - "The ranker predicts several behaviours per item with one shared model and one output (head) per behaviour, including negative behaviours such as returns and hides"
  - "A value model combines the predictions into one sortable score: each predicted chance times a weight, with negative weights for unwanted behaviours"
  - "Optimizing a single behaviour (clicks) rewards clickbait, which is why several are predicted"
  - "The weights encode product goals (this is where objectives become code), are tuned with A/B tests, and can change without retraining"
  - "Predictions must be calibrated for the weighted combination to be meaningful"
status: accepted
concept: multi-task-ranking
conceptTitle: "Multi-task ranking and the value model"
parents: pipeline|objectives|feedback-signals
state: edited
lens: ecommerce
lang: en
depth: standard
formalism: none
visuality: balanced
lengthBand: standard
genre: explainer
carriers: prose|table|diagram
objective: "Understand that a modern ranking model predicts several user behaviours per candidate (click, purchase, return, hide) and that a value model combines them into one score whose weights are product decisions."
forbidden: "Claiming the weights are learned automatically or are objective facts about users | Presenting the illustrative Wardrobe numbers as real data | Claiming any specific platform's current weights (X's published weights are a 2023 snapshot) | Implying a single-objective click model is how modern production rankers work"
---

Wardrobe, an online fashion shop, has 300 candidate items for Anna's home page, and its **ranker** (the model that orders candidates; see [the pipeline](#c/pipeline)) has to sort them. The first version predicted one thing: will she click? The top of the page filled with neon dresses: things people click, sometimes buy, and often send back.

A modern ranker predicts several behaviours at once: will Anna click, buy, **return** the item, or tap "not interested" (**hide**)? This is **multi-task ranking**: one model trained on what shoppers did ([feedback signals](#c/feedback-signals)), with a separate output, a **head**, per behaviour. The heads share most of the model, so millions of clicks also teach the rarer purchase and return heads. (YouTube's ranker lets each head mix its own shared sub-networks, "experts", so conflicting behaviours interfere less.)

Each head outputs a chance, but sorting needs one number per item. A **value model** produces it: multiply each predicted chance by a weight and add them up. Wanted behaviours get positive weights, unwanted ones negative.

Two candidates, weights set by Wardrobe's product team (illustrative numbers):

| Behaviour | Weight | Neon dress | Points | Dark jeans | Points |
|---|---|---|---|---|---|
| Click | +1 | 20% | +0.20 | 8% | +0.08 |
| Buy | +20 | 4% | +0.80 | 3% | +0.60 |
| Buy, then return | −30 | 2% | −0.60 | 0.3% | −0.09 |
| Hide | −10 | 3% | −0.30 | 0.5% | −0.05 |
| **Value** | | | **+0.10** | | **+0.54** |

A click-only ranker puts the dress first. The value model puts the jeans first: half the dresses come back, and a returned sale (+20 − 30) is worth less than no sale.

**The weights are product decisions.** "A purchase is worth twenty clicks" and "a return is worse than no sale" are statements about the business, not facts about Anna. This is where [objectives](#c/objectives) turn into code. Teams start with a guess, test alternatives in [A/B tests](#c/ab-testing), and change weights without retraining the model. X (formerly Twitter) published its 2023 home-timeline weights: a like 0.5, a reply the author engages with 75, a report −369. YouTube's ranker combines predicted clicks, watch time, likes and dismissals with weights tuned by hand.

**One catch: the predictions must be honest.** The arithmetic works only if a 20% from the click head means about 20 clicks per 100 similar shoppers (**calibration**). A head that overstates its chances quietly takes over the ranking. Labels need care too: people click top slots partly because they are on top (**position bias**), so a naive click head learns "was shown first" instead of "Anna wants it". YouTube's ranker models position separately for this reason.

When a feed feels wrong, "is the model accurate?" is only half the question. Ask also: **what does it predict, and what is each behaviour worth to us?** People write the second answer.

**Sources:**
- X (Twitter) the-algorithm-ml, Heavy Ranker README (weights as of April 5, 2023). https://github.com/twitter/the-algorithm-ml/blob/main/projects/home/recap/README.md
- Zhao, Z., Hong, L., Wei, L., Chen, J., Nath, A., Andrews, S., Kumthekar, A., Sathiamoorthy, M., Yi, X. & Chi, E. (2019). Recommending What Video to Watch Next: A Multitask Ranking System. *RecSys '19*. https://research.google/pubs/recommending-what-video-to-watch-next-a-multitask-ranking-system/
