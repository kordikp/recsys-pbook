---
id: ch7-glossary
type: spine
title: "RecSys Glossary: Key Terms and Concepts"
readingTime: 5
standalone: true
core: true
voice: universal
status: accepted
---

A comprehensive reference of essential recommender systems terminology, organized alphabetically.

---

**A/B Testing** — A controlled experiment in which users are randomly assigned to two (or more) variants — typically a current system (A) and a modified system (B) — to measure the causal impact of a change on metrics such as click-through rate, engagement, or revenue. It is the gold standard for evaluating recommender system changes in production.

**ALS (Alternating Least Squares)** — An optimization algorithm for matrix factorization that alternates between fixing user factors and solving for item factors, then fixing item factors and solving for user factors. Each step reduces to a convex least-squares problem, making ALS efficient, parallelizable, and well-suited to implicit feedback datasets.

**ANN (Approximate Nearest Neighbor)** — A family of algorithms that find vectors close to a query vector in high-dimensional space without exhaustively comparing every candidate. By trading a small amount of accuracy for dramatic speed gains, ANN methods like HNSW and product quantization make real-time retrieval from millions of embeddings practical.

**Attention Mechanism** — A neural network component that learns to assign different weights to different parts of an input sequence, allowing the model to focus on the most relevant items or features when making a prediction. Attention is the core building block of Transformer architectures and has become central to session-based and sequential recommendation.

**Autoencoder** — A neural network trained to reconstruct its input through a bottleneck layer, forcing it to learn a compressed latent representation. In recommender systems, autoencoders can learn user or item embeddings from interaction data; shallow variants like EASE demonstrate that even a single-layer linear autoencoder can be highly competitive.

**Bandit Algorithm** — See *Multi-Armed Bandit*.

**BPR (Bayesian Personalized Ranking)** — A pairwise learning-to-rank framework for implicit feedback that optimizes the posterior probability that a user prefers an observed item over an unobserved one. BPR provides a principled objective function that can be combined with various model architectures, from matrix factorization to neural networks.

**Candidate Generation** — The first stage of a multi-stage recommendation pipeline, responsible for quickly narrowing millions of items down to a manageable set of hundreds or thousands of plausible candidates. Speed is prioritized over precision, with techniques like ANN search, inverted indices, or lightweight models commonly used.

**Clickstream** — The sequence of user interactions (clicks, page views, searches, scrolls) recorded as a time-ordered log. Clickstream data is a primary source of implicit feedback and forms the foundation for session-based recommendation and behavioral analysis.

**Cold Start** — The challenge of generating recommendations when there is insufficient interaction data — either for a new user who has no history (user cold start) or for a new item that no one has interacted with yet (item cold start). Common mitigation strategies include content-based features, knowledge graphs, and LLM-derived representations.

**Collaborative Filtering** — A recommendation approach that predicts a user's preferences based on the preferences of similar users or the co-occurrence patterns of items. It requires no knowledge of item content; instead, it exploits the collective wisdom of user-item interactions, making it powerful but vulnerable to cold start and popularity bias.

**Content-Based Filtering** — A recommendation approach that suggests items similar to those a user has previously liked, based on item attributes such as genre, text description, or visual features. It works well for cold-start items (as long as metadata exists) but tends to produce narrow, less serendipitous recommendations.

**Context-Aware Recommendation** — A recommendation approach that incorporates contextual signals — such as time of day, location, device, weather, or social setting — into the prediction model. Context awareness helps systems distinguish, for example, that a user's music preferences differ between a morning commute and a weekend party.

**Cosine Similarity** — A measure of similarity between two vectors computed as the cosine of the angle between them, ranging from -1 (opposite) to 1 (identical direction). It is widely used to compare user or item embeddings because it is invariant to vector magnitude, focusing purely on directional alignment.

**CTR (Click-Through Rate)** — The ratio of users who click on a recommended item to the total number of users who were shown it. CTR is one of the most common online evaluation metrics, though optimizing for clicks alone can lead to clickbait and does not necessarily reflect long-term user satisfaction.

**DCG / nDCG (Discounted Cumulative Gain / normalized DCG)** — A ranking metric that measures recommendation quality by summing the relevance scores of recommended items, with a logarithmic discount applied to items appearing lower in the list. nDCG normalizes by the ideal ranking, producing a score between 0 and 1 that accounts for both relevance and position.

**Deep Learning** — A family of machine learning methods based on neural networks with multiple layers, capable of learning complex nonlinear patterns from large datasets. In recommender systems, deep learning powers architectures such as autoencoders, Transformers, two-tower models, and graph neural networks, often achieving state-of-the-art results when sufficient training data is available.

**Diversity** — A property of a recommendation list measuring how different the recommended items are from one another. High diversity exposes users to a broader range of content, counteracting filter bubbles, though it can conflict with pure relevance optimization.

**DPP (Determinantal Point Process)** — A probabilistic model that naturally captures both quality and diversity by assigning higher probability to sets of items that are individually relevant and mutually dissimilar. DPPs provide an elegant mathematical framework for diverse subset selection in re-ranking.

**EASE (Embarrassingly Shallow Autoencoder)** — A linear model proposed by Harald Steck (2019) that learns item-item similarities via a closed-form solution involving a single matrix inverse with a diagonal constraint. Despite its simplicity, EASE matches or outperforms many deep learning models on standard collaborative filtering benchmarks.

**Embedding** — A dense, low-dimensional vector representation of a user, item, or feature learned from data. Embeddings capture latent semantic relationships — items with similar embeddings tend to be similar in meaning or preference patterns — and are the lingua franca of modern recommendation architectures.

**ELSA (Embedding-based Linear Scalable Autoencoder)** — A scalable extension of EASE developed at FIT CTU Prague that factorizes the dense weight matrix into low-rank embeddings, enabling the model to scale to catalogs with millions of items while retaining the simplicity and effectiveness of the linear autoencoder approach.

**Evaluation Bias (MNAR)** — The systematic distortion in offline evaluation caused by the fact that interaction data is Missing Not At Random: users only rate or click items they were shown, creating a feedback loop where the recommender's past choices skew the data used to evaluate its future performance. Ignoring MNAR bias leads to overestimating the quality of systems that reinforce existing exposure patterns.

**Exploration-Exploitation** — The fundamental trade-off between recommending items the system is confident the user will like (exploitation) and recommending uncertain items to gather new information (exploration). Effective recommender systems must balance both to avoid converging on a narrow, suboptimal set of recommendations.

**Factorization Machines** — A model class that generalizes matrix factorization by modeling all pairwise feature interactions through factorized parameters, allowing the model to handle sparse, high-dimensional feature vectors efficiently. Factorization machines unify collaborative filtering with feature-rich prediction and are effective for both rating prediction and click-through rate estimation.

**Feature Store** — An infrastructure component that manages the computation, storage, and serving of machine learning features, ensuring consistency between training and inference. In production recommender systems, feature stores provide low-latency access to precomputed user profiles, item attributes, and contextual signals.

**Federated Learning** — A machine learning paradigm in which a model is trained across multiple decentralized devices or servers holding local data, without exchanging raw data. In recommender systems, federated learning enables personalization while preserving user privacy, as interaction histories never leave the user's device.

**Filter Bubble** — The phenomenon in which a recommender system progressively narrows the range of content a user is exposed to, reinforcing existing preferences and limiting discovery of diverse viewpoints or novel items. Filter bubbles are a key concern in news and social media recommendation.

**HNSW (Hierarchical Navigable Small World)** — An approximate nearest neighbor algorithm that constructs a multi-layer graph of data points, enabling logarithmic-time search in high-dimensional embedding spaces. HNSW is one of the most widely used ANN methods in production recommender systems due to its high recall and low query latency.

**Hybrid Recommender** — A system that combines multiple recommendation strategies — typically collaborative filtering and content-based filtering — to leverage the strengths of each. Hybrid approaches mitigate individual weaknesses such as cold start (collaborative) or limited diversity (content-based) and generally outperform any single method alone.

**Implicit Feedback** — User preference signals inferred from behavior (clicks, views, purchases, play counts, dwell time) rather than explicit ratings. Implicit feedback is far more abundant than explicit ratings but is inherently noisy and one-class: the system observes positive signals but must infer the meaning of non-interaction.

**Item-to-Item** — A recommendation strategy that computes similarities between items (rather than between users) and recommends items similar to those the user has previously interacted with. Item-to-item methods are computationally efficient, stable over time, and form the basis of Amazon's classic "customers who bought this also bought" system.

**Knowledge Graph** — A structured representation of entities and their relationships (e.g., actors, directors, genres, studios connected to movies) used to enrich recommendations with semantic reasoning. Knowledge graphs help address cold start by providing rich item descriptions and enable explainable recommendations through relationship paths.

**Latent Factor** — A hidden, learned dimension in a factorization model that captures an abstract aspect of user preference or item characteristics — such as "preference for dark humor" or "degree of experimentalism." Latent factors emerge from the data without explicit labels and form the basis of matrix factorization and embedding-based methods.

**LLM-based Recommendation** — An emerging paradigm that uses large language models to generate, rank, or explain recommendations by leveraging their broad world knowledge and natural language understanding. Approaches range from using LLMs as feature extractors for item representations to prompting them directly as conversational recommenders, though challenges include hallucination, latency, and cost.

**Matrix Factorization** — A technique that decomposes a sparse user-item interaction matrix into the product of two lower-rank matrices, representing users and items as vectors in a shared latent space. Matrix factorization is a foundational collaborative filtering method, popularized by the Netflix Prize, and underpins many modern recommendation algorithms.

**MMR (Maximal Marginal Relevance)** — A re-ranking criterion that iteratively selects items by balancing relevance to the user query with dissimilarity to already-selected items. MMR provides a simple, tunable mechanism for injecting diversity into a recommendation list.

**Multi-Armed Bandit** — A sequential decision-making framework that models the exploration-exploitation trade-off: each "arm" is a recommendation option with an unknown reward distribution, and the algorithm must learn which arms yield the highest rewards while minimizing cumulative regret. Bandit algorithms like Thompson Sampling and Upper Confidence Bound are used for adaptive recommendation and online learning.

**Position Bias** — The tendency of users to interact more with items shown at the top of a recommendation list, regardless of their true relevance. Position bias inflates the apparent quality of highly-ranked items in logged data and must be corrected during model training and offline evaluation to avoid reinforcing a self-fulfilling prophecy.

**Precision / Recall** — Two complementary classification metrics adapted for recommendation evaluation. Precision measures the fraction of recommended items that are relevant; recall measures the fraction of all relevant items that appear in the recommendation list. The two are in tension — improving one typically reduces the other.

**Re-ranking** — The final stage of a recommendation pipeline that reorders a candidate list produced by earlier stages to incorporate business rules, diversity objectives, fairness constraints, or contextual factors that are too expensive to apply at the candidate generation stage.

**Recommendation Pipeline** — The end-to-end system architecture for producing recommendations, typically consisting of candidate generation (fast, broad retrieval), scoring or ranking (more precise relevance estimation), re-ranking (applying diversity, fairness, and business logic), and serving (low-latency delivery to the user).

**Serendipity** — A quality of recommendations that are both relevant and surprising — items the user would not have discovered on their own but genuinely enjoys. Serendipity goes beyond diversity by requiring both novelty and positive user reaction, and it is one of the hardest recommendation qualities to measure and optimize.

**Session-Based Recommendation** — A recommendation approach that models the user's intent from a short, anonymous sequence of interactions within a single session, without relying on long-term user profiles. Techniques include recurrent neural networks, Transformers, and graph-based models that capture sequential patterns in clickstreams.

**SVD (Singular Value Decomposition)** — A matrix factorization technique from linear algebra that decomposes any matrix into three component matrices, revealing its underlying rank structure. In recommender systems, truncated SVD is used to extract latent factors from user-item matrices, forming the mathematical foundation for many collaborative filtering algorithms.

**Thompson Sampling** — A Bayesian approach to the multi-armed bandit problem that selects actions by sampling from the posterior distribution of each arm's reward, naturally balancing exploration and exploitation. Arms with uncertain reward estimates are explored more frequently, while arms with high estimated rewards are exploited.

**Transfer Learning** — A technique that leverages knowledge learned from one task or domain to improve performance on a different but related task. In recommender systems, transfer learning can warm-start models for new domains, mitigate cold start by transferring user representations across platforms, or adapt pretrained language models for item understanding.

**Transformer** — A neural network architecture based entirely on self-attention mechanisms, originally developed for natural language processing. In recommender systems, Transformers model sequential user behavior by attending to all previous interactions, capturing long-range dependencies without the vanishing gradient problems of recurrent architectures.

**Two-Tower Architecture** — A neural network design in which separate "towers" (sub-networks) independently encode users and items into a shared embedding space, with relevance estimated by the similarity (e.g., dot product) of their embeddings. This architecture enables precomputation of item embeddings and fast ANN retrieval, making it a workhorse of large-scale candidate generation.

**User-to-User** — A collaborative filtering strategy that identifies users with similar interaction histories and recommends items liked by those neighbors. While intuitive, user-to-user methods scale poorly as the user base grows and are less stable than item-to-item approaches, since user profiles change more rapidly than item characteristics.
