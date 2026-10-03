---
id: ch5-q1
type: question
title: "What Would You Build Next?"
readingTime: 1
standalone: false
teaser: "You have built a recommender from scratch. Pick your next project and see what will make it hard."
voice: universal
parent: null
diagram: null
status: accepted
feedbackA: "Expect sparse data and slow feedback: career outcomes take months to show. Borrow from education recommenders (recommend what the learner needs, not only what they click) and lean on content features for cold start."
feedbackB: "You will need an objective beyond clicks: diversity, novelty or serendipity metrics, with guardrails so relevance does not collapse. Validate it online; offline accuracy on old logs tends to penalize exactly the discoveries you want."
feedbackC: "Text is your friend: embeddings of titles and abstracts handle new papers, and the citation network is a natural graph signal. The hard part is recency, because the newest papers have no citations yet."
feedbackD: "Start from the decision you want to improve and the signal you can log. Popularity plus item-item similarity is a credible first version almost anywhere; the domain's constraints decide what comes next."
concept: case-studies
state: edited
lens: generic
visuality: text-first
depth: standard
formalism: none
lengthBand: standard
carriers: prose
---

You understand how recommenders work and you have built one from scratch. What would you build next?

**A) "A learning and career recommender"**
Model skills, career goals and learning preferences to suggest courses, conferences, mentors and next roles, informed by the paths of people with similar profiles.

**B) "A discovery engine that widens taste"**
Instead of maximizing engagement with the familiar, deliberately introduce people to good content in adjacent genres, unfamiliar formats and under-represented creators.

**C) "A research-paper navigator"**
Use reading history, semantic similarity between papers and the citation network to surface the foundational and the newest work you would otherwise miss.

**D) "A domain nobody has tried yet"**
Team composition, clinical-trial matching, design patterns: the most useful applications often appear where someone understands both the algorithmic toolkit and the domain.

Whatever you pick, the method is the one you just used: collect data, compute similarity, predict, then evaluate and iterate.
