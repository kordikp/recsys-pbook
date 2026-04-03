---
id: ch7-roadmap
type: spine
title: "The Research Roadmap: What's Next"
readingTime: 3
standalone: true
core: true
teaser: "Open problems in recommender systems — from fairness guarantees to LLM-powered recommendations."
voice: universal
parent: null
diagram: null
recallQ: "What are the key open research challenges in recommender systems?"
recallA: "Fairness guarantees with mathematical foundations, LLM integration without hallucination, causal evaluation beyond correlation, multi-stakeholder optimization, and privacy-preserving personalization."
highlights:
  - "Formal fairness definitions often conflict -- satisfying one can violate another"
  - "LLMs can understand complex preferences but hallucinate nonexistent items"
  - "Optimal, fair, profitable, and private are four goals in permanent tension"
status: accepted
---

The research landscape in recommender systems is vibrant and rapidly evolving. Here are the frontiers where mathematical insight is needed most.

## 1. Fairness with Mathematical Foundations

Current fairness approaches are largely heuristic — boost underrepresented content, cap exposure for dominant items, diversify results. But **what does "fair" actually mean mathematically?**

Several formal definitions compete:
- **Demographic parity:** All groups receive equal recommendation probability
- **Equal opportunity:** All relevant items have equal chance of being recommended, regardless of creator demographics
- **Individual fairness:** Similar items receive similar exposure
- **Supplier fairness:** Content creators receive exposure proportional to their quality

These definitions often **conflict** — satisfying one can violate another. Recent work on [minimum exposure guarantees](https://www.recombee.com/blog/making-recommendations-fairer-a-new-way-to-guarantee-exposure-for-all) (Lopes, Alves et al., Expert Systems 2024) and SAGEA (RecSys 2025) provides mathematical frameworks for navigating these tensions.

## 2. LLM-Powered Recommendation

Large Language Models can understand natural language queries ("I want something uplifting but not cheesy, like a mix of Wes Anderson and Studio Ghibli") in ways traditional systems cannot. But integrating LLMs into recommendation raises unsolved problems:

- **Hallucination:** LLMs can confidently recommend items that don't exist
- **Popularity bias amplification:** LLMs trained on internet text inherit and amplify existing popularity biases
- **Evaluation difficulty:** How do you evaluate a conversational recommendation system? Standard metrics don't apply to open-ended dialogue
- **Latency:** LLM inference is orders of magnitude slower than embedding lookup

The [SHIELD framework](https://www.recombee.com/blog/shield-the-universal-framework-making-ai-search-safer-for-everyone) (UMAP 2025, [open-source on GitHub](https://github.com/flpspacek/SHIELD)) addresses one aspect — semantic search safety — but the broader integration challenge remains open.

## 3. Causal Evaluation

Current evaluation is fundamentally **correlational**: did users interact with what we recommended? But correlation doesn't distinguish between "the user liked it because we recommended it" and "the user would have found it anyway."

Causal inference methods — instrumental variables, regression discontinuity, difference-in-differences — are beginning to enter the RecSys toolkit, but adapting them to the high-dimensional, dynamic setting of recommendation is challenging.

## 4. Sequential and Context-Aware Models

Users don't exist in a static state — their preferences evolve over a session, a day, a year. The ReALM model (RecSys 2025) shows that even simple linear models can capture sequential patterns in grocery shopping. But richer sequential understanding — mood shifts during a listening session, evolving interests during a learning journey — requires models that balance sequence complexity with data efficiency.

## 5. Cross-Domain and Transfer Learning

beeFormer demonstrated that recommendation knowledge can transfer across domains via text. But most production systems still train separate models for each domain. Research questions remain:

- How much cross-domain transfer is beneficial vs. harmful?
- Can negative transfer (interference between domains) be detected and prevented?
- What makes some domains transferable and others not?

## 6. Privacy-Preserving Personalization

Can we build highly personalized recommendations without centralizing user data? Federated learning, differential privacy, and on-device processing offer partial solutions, but each introduces trade-offs (for an overview of practical approaches, see Recombee's post on [the building blocks of privacy-friendly personalization](https://www.recombee.com/blog/the-building-blocks-of-privacy-friendly-personalization)):

- Federated learning requires coordinating model updates across millions of devices
- Differential privacy adds noise that degrades recommendation quality
- On-device processing limits the scale of collaborative filtering

The GDPR and CCPA have made this not just a research question but a legal requirement.

## The Bigger Picture

The thread connecting all these challenges is **the tension between what's optimal and what's responsible**. A system that maximizes engagement might not be fair. A system that's fair might not be profitable. A system that's profitable might not respect privacy. A system that respects privacy might not be personalized enough to be useful.

Research doesn't just solve technical problems — it provides the **mathematical frameworks** for understanding and navigating these tensions. Without formal definitions of fairness, we argue about intuitions. Without causal evaluation, we optimize for the wrong metrics. Without privacy-preserving methods, we choose between personalization and rights.

The publications from the Recombee lab and collaborators across 2021–2026 — spanning RecSys, WWW, ICML, KDD, CIKM, and UMAP — represent a sustained effort to advance on multiple fronts simultaneously. Each paper addresses one piece of the puzzle, but the emerging picture is of a field where **mathematics, engineering, and societal responsibility are increasingly inseparable**.

> **Key venues:** RecSys (ACM Conference on Recommender Systems), WWW (The Web Conference), KDD (Knowledge Discovery and Data Mining), ICML (International Conference on Machine Learning), CIKM (Conference on Information and Knowledge Management)

**Consider this:** The recommender systems that will shape the next decade of digital experience haven't been built yet. They'll emerge from research happening right now — in universities, industry labs, and the intersection of both. Understanding the mathematical foundations isn't just academic; it's the prerequisite for building systems that are both effective and responsible.