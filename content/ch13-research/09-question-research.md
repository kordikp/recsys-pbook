---
id: ch7-q1
type: question
title: "Which Research Direction Interests You Most?"
readingTime: 1
standalone: true
teaser: "Choose the research frontier that matches your perspective, and see where to go next."
voice: universal
parent: null
diagram: null
publishedAt: "2026-04-03"
status: accepted
hintA: depth=research,formalism=full
hintB: depth=technical
feedbackA: "Go deep on the derivations: EASE's closed-form solution and the precision matrix, how ELSA makes it scale, and the Thompson Sampling analysis. They show why simple linear models stay competitive on sparse data."
feedbackB: "Follow what makes research deployable: how ELSA scales, how CompresSAE compresses embeddings, and how bandits run in production. The recurring question is what a model costs to serve, not only how accurate it is."
feedbackC: "Offline evaluation bias, fairness definitions and the gap between engagement and well-being decide whether measured progress is real. Start with evaluation metrics and fairness, then the research roadmap."
feedbackD: "Read the chapter in order: each result addresses a limitation of the previous one, from EASE to ELSA, from linear models to VASP, and from beeFormer to steerable knobs."
concept: research-roadmap
state: edited
lens: generic
visuality: text-first
depth: standard
formalism: none
lengthBand: standard
carriers: prose
---

You have seen the research behind modern recommenders, from mathematical foundations to production systems. Which direction do you find most compelling?

**A) "The mathematical elegance"**
EASE's closed-form solution, the Eckart-Young theorem behind ELSA, the Bayesian logic of Thompson Sampling. Recommendation as applied mathematics waiting to be formalized. Derivations: [EASE to ELSA](#c/ease-elsa) and [bandits in practice](#c/bandits-in-practice).

**B) "Building these systems"**
Making ELSA scale to very large catalogs, compressing embeddings with CompresSAE, deploying bandits in production. Research counts when it runs. Start with [production at scale](#c/production-scale).

**C) "The evaluation and fairness problems"**
Offline evaluation bias, defining fairness mathematically, the gap between engagement and well-being. These questions decide whether the field is heading in the right direction. See [evaluation metrics](#c/evaluation-metrics), [fairness](#c/fairness) and [who decides what you see](#c/who-decides).

**D) "The full picture"**
From EASE to beeFormer, from Thompson Sampling to CompresSAE: the connections between results are as interesting as the results. Read this chapter in order.

The research frontier in recommender systems is unusually open. Fundamental problems remain unsolved, and important contributions still come from small teams as well as large corporate labs.
