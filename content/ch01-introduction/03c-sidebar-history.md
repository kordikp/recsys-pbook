---
id: ch1-history
type: spine
title: "A Brief History of Recommender Systems"
readingTime: 3
standalone: true
core: false
teaser: "From GroupLens to LLM-powered recommendations -- three decades of evolution that transformed how we discover content."
voice: universal
parent: null
diagram: null
recallQ: "What major phases has recommender systems research gone through?"
recallA: "Collaborative filtering origins (1990s), industrial scale-up (2000s), deep learning (2010s), a realism turn where simple, well-tuned models proved hard to beat (2019-2022), and the current generative and LLM era (2023-), where recommenders are trained like language models and LLMs act as rankers and shopping or music assistants."
publishedAt: "2026-04-03"
status: accepted
concept: patterns-not-magic
state: edited
lens: generic
visuality: balanced
depth: standard
formalism: none
lengthBand: standard
genre: explainer
carriers: prose|image
---

Recommender systems have a surprisingly compact history. The entire field -- from first prototype to LLM-powered conversational recommendations -- spans roughly thirty years. Here's how it unfolded.

![Recommender systems timeline from 1992 to 2024](/images/anim-history-timeline.svg)

## The Origins: Collaborative Filtering (1992--1998)

**1992 -- Tapestry (Goldberg et al.)** Researchers at Xerox PARC built the first system that let users collaboratively filter email and newsgroup messages based on other users' reactions. The paper coined the term "collaborative filtering," giving the field its founding concept.

**1994 -- GroupLens** A team at the University of Minnesota automated the collaborative filtering process for Usenet news articles, removing the need for users to manually query each other's opinions. This was the first academic research project dedicated to recommender systems, and it established the research agenda that would define the next decade.

**Late 1990s -- Amazon "Customers who bought..."** Amazon deployed item-to-item collaborative filtering at scale and turned recommendations into a core part of the store. A much-quoted 2013 McKinsey estimate later put 35% of Amazon purchases downstream of recommendations. That counts sales that *passed through* a recommendation, not sales it *caused*, but the point stood: recommendations were a business engine, not a nice extra.

## Industrial Scale and the Netflix Era (2003--2009)

**2003 -- Amazon's item-based CF paper (Linden et al.)** Amazon published its approach in IEEE Internet Computing, revealing how item-to-item collaborative filtering could scale to millions of products and users. The paper became one of the most-cited in the field and gave the broader community a blueprint for production-grade recommendation.

**2006--2009 -- The Netflix Prize** Netflix offered $1,000,000 to anyone who could improve their recommendation accuracy by 10%. The competition attracted over 41,000 teams from 186 countries and catalyzed an explosion of research into matrix factorization techniques -- SVD, ALS, and sophisticated ensemble methods. Netflix put two building blocks from an early progress prize (matrix factorization and RBMs) into production, but not the final winning blend of hundreds of models: the extra accuracy did not justify the engineering effort. The competition still permanently elevated recommender systems into a mainstream research discipline.

## Beyond Ratings: Context, Embeddings, and Deep Learning (2010--2018)

**2010 -- Contextual bandits for news recommendation (Li et al., LinUCB)** Researchers framed recommendation as an exploration-exploitation problem: how do you recommend articles when you need to balance showing what users probably like against discovering what they might like? LinUCB introduced contextual bandits to RecSys, adding a principled framework for handling uncertainty and cold-start.

**2013 -- Word2Vec enables item embeddings** Mikolov et al.'s Word2Vec showed that distributional representations could capture rich semantic relationships. The RecSys community quickly adapted this idea -- Prod2Vec, Item2Vec, and related methods learned dense vector representations of items from interaction sequences, enabling recommendations based on latent similarity rather than explicit co-occurrence counts.

**2016 -- YouTube's deep neural network paper (Covington et al.)** Google published its architecture for YouTube recommendations, revealing a two-tower deep learning system serving billions of users. This was the moment deep learning moved from academic curiosity to production reality in recommender systems, demonstrating that neural networks could handle the scale and latency demands of real-time serving.

**2017 -- Transformers (Vaswani et al.)** The "Attention Is All You Need" paper revolutionized NLP and, within a year, its attention mechanisms began infiltrating recommender systems. Self-attention offered a natural way to model sequential user behavior -- weighing which past interactions matter most for predicting the next one.

**2018 -- SASRec (Kang & McAuley)** Self-Attentive Sequential Recommendation applied the transformer architecture directly to the sequential recommendation problem, outperforming RNN-based approaches and establishing transformers as a first-class tool for modeling user interaction sequences.

## The Realism Turn: Simplicity Strikes Back (2019--2022)

**2019 -- EASE (Steck) and "Are We Really Making Much Progress?" (Dacrema et al.)** Two papers sent shockwaves through the community. Harald Steck's EASE -- Embarrassingly Shallow Autoencoders -- showed that a simple closed-form linear model could match or outperform deep neural networks on standard benchmarks. Simultaneously, Dacrema et al. demonstrated that many published deep learning RecSys papers failed to outperform properly tuned classical baselines. Together, these results forced a reckoning: complexity for its own sake was not progress.

**2020 -- LightGCN (He et al.)** Graph neural networks entered the recommendation mainstream. LightGCN stripped away the nonlinearities and feature transformations of earlier GCN approaches, showing that simple neighborhood aggregation on the user-item interaction graph was both more effective and more interpretable. The theme continued: simpler architectures, done right, win.

**Our lab's contributions in this period** are told in [the research chapter](#c/why-research): [ELSA](#c/ease-elsa) (RecSys 2022) scaled the EASE idea to large catalogs with a low-rank linear model, and VASP (2021) combined a linear model with a deep variational autoencoder.

## The Generative and LLM Era (2023--present)

**2023 -- Generative retrieval and semantic IDs (TIGER, Rajput et al.)** Instead of scoring every candidate, a sequence model *writes out* the identifier of the next item, token by token. Each item gets a short code learned from its content, so similar items share code prefixes. Recommendation started to borrow the machinery of language models directly.

**2023--2024 -- LLMs as rankers and assistants** Researchers showed that a large language model can re-rank candidates zero-shot, with no recommendation training, though it struggles with the order of a user's history and is biased by popularity and position in the prompt (Hou et al., ECIR 2024). Products followed: Spotify's AI DJ (February 2023) pairs Spotify's personalization with OpenAI technology and a synthetic voice, and Amazon's Rufus shopping assistant (February 2024, renamed Alexa for Shopping in 2026) answers product questions and recommends from the catalog. See [LLM recommenders](#c/llm-recommenders).

**2024 -- Generative recommenders that scale (HSTU, Zhai et al., ICML 2024)** Meta reframed ranking and retrieval as sequence transduction over a user's actions. The model's quality grew as a power law of training compute over three orders of magnitude, the behavior that made large language models worth scaling, and a 1.5-trillion-parameter version improved online A/B metrics by 12.4% on surfaces with billions of users.

**2024 -- Regulation catches up** The EU Digital Services Act has applied to all online platforms since 17 February 2024. The largest platforms must offer at least one recommender option not based on profiling and assess the risks of their algorithms (see [the EU law sidebar](#ch6-law-sidebar)).

**2025 -- Foundation models in production** Netflix described a single foundation model, trained on hundreds of billions of interactions much like an LLM is trained on tokens, that feeds many recommendation tasks instead of many specialized models.

**Our lab's contributions in this period:** [beeFormer](#c/beeformer) (RecSys 2024) trains sentence transformers on interaction data so that cold-start items get useful embeddings from their text; CompresSAE (RecSys 2025) compresses dense item embeddings into sparse codes; ReALM (RecSys 2025) shows a linear autoregressive model beating transformers on next-basket grocery recommendation; SHIELD (UMAP 2025) keeps semantic search from surfacing harmful content; Sparse ELSA (WWW 2026) learns sparse, interpretable embeddings during training. The thread running through them is the one from 2019: simple models, done right, are hard to beat.

## What This History Teaches

Three decades of recommender systems reveal a field driven by practical impact, not just algorithmic novelty. The systems that transformed industries — Amazon's item-based CF, Netflix's matrix factorization, YouTube's deep retrieval — succeeded because they solved real problems at real scale, not because they were the most mathematically sophisticated.

For a deeper exploration of how modern recommender systems have evolved and how they differ from advertising technology, see Recombee's [introduction to modern recommender systems](https://www.recombee.com/blog/modern-recommender-systems-part-1-introduction).

**Sources:**
- Netflix Technology Blog, "[Netflix Recommendations: Beyond the 5 stars (Part 1)](https://netflixtechblog.com/netflix-recommendations-beyond-the-5-stars-part-1-55838468f429)," 6 April 2012 (what Netflix deployed from the Prize).
- [Netflix Prize leaderboard](https://web.archive.org/web/2019/https://www.netflixprize.com/leaderboard.html) (archived; 41,305 teams from 186 countries).
- Steck, "Embarrassingly Shallow Autoencoders for Sparse Data," WWW 2019. [arXiv:1905.03375](https://arxiv.org/abs/1905.03375)
- Ferrari Dacrema, Cremonesi & Jannach, "Are We Really Making Much Progress? A Worrying Analysis of Recent Neural Recommendation Approaches," RecSys 2019. [arXiv:1907.06902](https://arxiv.org/abs/1907.06902)
- He et al., "LightGCN: Simplifying and Powering Graph Convolution Network for Recommendation," SIGIR 2020. [arXiv:2002.02126](https://arxiv.org/abs/2002.02126)
- Rajput et al., "Recommender Systems with Generative Retrieval," NeurIPS 2023. [arXiv:2305.05065](https://arxiv.org/abs/2305.05065)
- Hou et al., "Large Language Models are Zero-Shot Rankers for Recommender Systems," ECIR 2024. [arXiv:2305.08845](https://arxiv.org/abs/2305.08845)
- Zhai et al., "Actions Speak Louder than Words: Trillion-Parameter Sequential Transducers for Generative Recommendations," ICML 2024. [arXiv:2402.17152](https://arxiv.org/abs/2402.17152)
- Spotify, "[Spotify Debuts a New AI DJ, Right in Your Pocket](https://newsroom.spotify.com/2023-02-22/spotify-debuts-a-new-ai-dj-right-in-your-pocket/)," 22 February 2023.
- Amazon, "[Amazon announces Rufus, a new generative AI-powered conversational shopping experience](https://www.aboutamazon.com/news/retail/amazon-rufus)," 1 February 2024.
- Netflix Technology Blog, "[Foundation Model for Personalized Recommendation](https://netflixtechblog.com/foundation-model-for-personalized-recommendation-1a0bd8e02d39)," 21 March 2025.
- [Regulation (EU) 2022/2065 (Digital Services Act)](https://eur-lex.europa.eu/eli/reg/2022/2065/oj), Art. 38 and Art. 93.
- MacKenzie, Meyer & Noble, "[How retailers can keep up with consumers](https://www.mckinsey.com/industries/retail/our-insights/how-retailers-can-keep-up-with-consumers)," McKinsey & Company, October 2013.
