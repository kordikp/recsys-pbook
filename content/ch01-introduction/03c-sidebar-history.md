---
id: ch1-history
type: spine
title: "A Brief History of Recommender Systems"
readingTime: 3
standalone: true
core: false
teaser: "From GroupLens to LLM-powered recommendations -- three decades of evolution, swinging between simplicity and complexity."
voice: universal
parent: null
diagram: null
recallQ: "What major phases has recommender systems research gone through?"
recallA: "Collaborative filtering origins (1990s), industrial scale-up (2000s), deep learning revolution (2010s), and the current era blending LLMs with efficient linear models."
publishedAt: "2026-04-03"
status: accepted
---

Recommender systems have a surprisingly compact history. The entire field -- from first prototype to LLM-powered conversational recommendations -- spans roughly thirty years. Here's how it unfolded.

## The Origins: Collaborative Filtering (1992--1998)

**1992 -- Tapestry (Goldberg et al.)** Researchers at Xerox PARC built the first system that let users collaboratively filter email and newsgroup messages based on other users' reactions. The paper coined the term "collaborative filtering," giving the field its founding concept.

**1994 -- GroupLens** A team at the University of Minnesota automated the collaborative filtering process for Usenet news articles, removing the need for users to manually query each other's opinions. This was the first academic research project dedicated to recommender systems, and it established the research agenda that would define the next decade.

**1998 -- Amazon "Customers who bought..."** Amazon deployed item-to-item collaborative filtering at scale, turning recommendations into a core revenue driver. The familiar "Customers who bought this item also bought..." prompt would eventually be credited with driving approximately 35% of Amazon's total revenue -- a staggering demonstration that recommendations weren't just a nice feature, but a business engine.

## Industrial Scale and the Netflix Era (2003--2009)

**2003 -- Amazon's item-based CF paper (Linden et al.)** Amazon published its approach in IEEE Internet Computing, revealing how item-to-item collaborative filtering could scale to millions of products and users. The paper became one of the most-cited in the field and gave the broader community a blueprint for production-grade recommendation.

**2006--2009 -- The Netflix Prize** Netflix offered $1,000,000 to anyone who could improve their recommendation accuracy by 10%. The competition attracted over 40,000 teams from 186 countries and catalyzed an explosion of research into matrix factorization techniques -- SVD, ALS, and sophisticated ensemble methods. The winning solution was never deployed in production (it was too complex), but the competition permanently elevated recommender systems into a mainstream research discipline.

## Beyond Ratings: Context, Embeddings, and Deep Learning (2010--2018)

**2010 -- Contextual bandits for news recommendation (Li et al., LinUCB)** Researchers framed recommendation as an exploration-exploitation problem: how do you recommend articles when you need to balance showing what users probably like against discovering what they might like? LinUCB introduced contextual bandits to RecSys, adding a principled framework for handling uncertainty and cold-start.

**2013 -- Word2Vec enables item embeddings** Mikolov et al.'s Word2Vec showed that distributional representations could capture rich semantic relationships. The RecSys community quickly adapted this idea -- Prod2Vec, Item2Vec, and related methods learned dense vector representations of items from interaction sequences, enabling recommendations based on latent similarity rather than explicit co-occurrence counts.

**2016 -- YouTube's deep neural network paper (Covington et al.)** Google published its architecture for YouTube recommendations, revealing a two-tower deep learning system serving billions of users. This was the moment deep learning moved from academic curiosity to production reality in recommender systems, demonstrating that neural networks could handle the scale and latency demands of real-time serving.

**2017 -- Transformers (Vaswani et al.)** The "Attention Is All You Need" paper revolutionized NLP and, within a year, its attention mechanisms began infiltrating recommender systems. Self-attention offered a natural way to model sequential user behavior -- weighing which past interactions matter most for predicting the next one.

**2018 -- SASRec (Kang & McAuley)** Self-Attentive Sequential Recommendation applied the transformer architecture directly to the sequential recommendation problem, outperforming RNN-based approaches and establishing transformers as a first-class tool for modeling user interaction sequences.

## The Realism Turn: Simplicity Strikes Back (2019--2022)

**2019 -- EASE (Steck) and "Are We Really Making Much Progress?" (Dacrema et al.)** Two papers sent shockwaves through the community. Harald Steck's EASE -- Embarrassingly Shallow Autoencoders -- showed that a simple closed-form linear model could match or outperform deep neural networks on standard benchmarks. Simultaneously, Dacrema et al. demonstrated that many published deep learning RecSys papers failed to outperform properly tuned classical baselines. Together, these results forced a reckoning: complexity for its own sake was not progress.

**2020 -- LightGCN (He et al.)** Graph neural networks entered the recommendation mainstream. LightGCN stripped away the nonlinearities and feature transformations of earlier GCN approaches, showing that simple neighborhood aggregation on the user-item interaction graph was both more effective and more interpretable. The theme continued: simpler architectures, done right, win.

**2021 -- VASP and BMAB** Research explored combining the strengths of different paradigms. VASP (Variational Autoencoders with Shallow Parallel) fused variational and linear models, while BMAB (Burst-aware Multi-Armed Bandits) tackled the practical challenge of trending content, adapting bandit algorithms to detect and exploit temporal bursts in item popularity.

**2022 -- ELSA** Scalable linear shallow autoencoders pushed the efficient-model frontier further, demonstrating that carefully designed linear architectures could achieve state-of-the-art results with dramatically lower computational cost than deep alternatives. The message was becoming clear: the best production models often look nothing like the most complex research prototypes.

## The LLM Era and Beyond (2023--present)

**2023 -- LLM-based conversational recommendation** ChatGPT plugins and similar integrations enabled a fundamentally new interaction paradigm: users could describe what they wanted in natural language, and an LLM could reason over catalogs, user context, and constraints to produce recommendations conversationally. This blurred the line between search, recommendation, and dialogue.

**2024 -- beeFormer, generalization bounds, CompresSAE** Research accelerated across multiple fronts. beeFormer brought sentence transformer pre-training to collaborative filtering. Theoretical work on generalization bounds began providing formal guarantees for recommendation quality. CompresSAE explored aggressive compression of autoencoder-based recommenders without sacrificing accuracy.

**2025--26 -- Sparse ELSA, ReALM, SHIELD** The current frontier combines sparsity, retrieval-augmented generation, and privacy-preserving techniques. Sparse ELSA achieves near-dense performance with a fraction of the parameters. ReALM integrates retrieval with language model reasoning for recommendation. SHIELD addresses the growing demand for recommendation systems that protect user data by design. The field is moving simultaneously toward greater efficiency and greater responsibility.

## The Pendulum

Looking at this timeline, a pattern emerges. The field has swung like a pendulum:

**Simple** (1990s collaborative filtering) → **Complex** (2010s deep learning arms race) → **Simple-but-better** (2019+ linear models that outperform deep networks).

Each swing of the pendulum doesn't return to the starting point -- it returns to simplicity armed with hard-won knowledge about what actually matters. The EASE model of 2019 is "simple," but it's simple in a way that would have been impossible without the deep learning detour that revealed which inductive biases matter and which are dead weight.

This is perhaps the deepest lesson from thirty years of recommender systems research: progress isn't a straight line toward greater complexity. It's a spiral, where each revolution strips away unnecessary machinery and preserves only what genuinely improves the user's experience.
