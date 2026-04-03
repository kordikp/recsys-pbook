---
id: ch5-embedding-viz
type: spine
title: "Visualizing Embeddings: Seeing What Algorithms Learn"
readingTime: 3
standalone: true
core: false
voice: explorer
parent: null
diagram: null
recallQ: "What is the key difference between t-SNE and UMAP for embedding visualization?"
recallA: "t-SNE preserves local neighborhood structure but distorts global distances. UMAP preserves both local and global structure more faithfully, making it better for understanding the overall layout of the embedding space."
publishedAt: "2026-04-03"
status: accepted
---

You have trained a recommendation model and produced embeddings -- 128-dimensional vectors for every item in your catalog. The model works. Metrics look good. But what has it actually *learned*? Which items does it consider similar? Are there natural clusters? Are there surprising neighborhoods?

You cannot inspect 128 dimensions directly. But you can project them down to 2 or 3 dimensions and look at the result. This is embedding visualization, and it is one of the most powerful tools for understanding, debugging, and communicating what recommendation models do.

## PCA: The Fast First Look

**Principal Component Analysis** projects high-dimensional data onto the directions of maximum variance. It is linear, deterministic, and fast -- you can run it on a million embeddings in seconds.

PCA is the right first step because it answers a basic structural question: how much of the information is concentrated in the top few dimensions? If the first two principal components capture 60% of the variance, a 2D PCA plot gives you a reasonable overview. If they capture 5%, the data lives in a genuinely high-dimensional space and a 2D linear projection will miss most of the structure.

PCA's limitation is that it can only capture linear relationships. Clusters that are separable via curved manifolds in high-dimensional space may overlap in PCA projections.

## t-SNE: Revealing Local Structure

**t-distributed Stochastic Neighbor Embedding** (van der Maaten & Hinton, 2008) is the most widely used nonlinear dimensionality reduction technique for visualization. It converts high-dimensional distances into probabilities -- nearby points get high probability, distant points get low probability -- and then finds a low-dimensional layout that preserves these probabilities.

The algorithm minimizes the KL divergence between the high-dimensional probability distribution $P$ and the low-dimensional distribution $Q$:

$$\text{KL}(P \| Q) = \sum_{i \neq j} p_{ij} \log \frac{p_{ij}}{q_{ij}}$$

The use of a Student-t distribution in the low-dimensional space (hence the "t" in t-SNE) allows the algorithm to model the "crowding problem" -- the geometric fact that high-dimensional space has much more room than low-dimensional space.

**What t-SNE excels at:** Revealing clusters and local neighborhood structure. If your item embeddings form natural clusters (by genre, by price range, by user demographic), t-SNE will make them visually obvious as tight, well-separated groups.

**What t-SNE distorts:** Global distances. Two clusters that appear far apart in a t-SNE plot might actually be close in the original space, and vice versa. The size of clusters is also unreliable -- t-SNE tends to produce clusters of roughly equal visual size regardless of their actual density.

**The perplexity parameter** controls the balance between local and global structure. Low perplexity (5-10) emphasizes tight local neighborhoods. High perplexity (50-100) captures broader structure. Always try multiple perplexity values before drawing conclusions.

## UMAP: The Modern Default

**Uniform Manifold Approximation and Projection** (McInnes et al., 2018) has largely supplanted t-SNE as the go-to visualization method. It offers several practical advantages:

- **Preserves global structure** better than t-SNE -- the relative positions of clusters are more meaningful
- **Faster** -- UMAP scales better to large datasets (millions of points)
- **More parameters** but better defaults -- the `n_neighbors` parameter plays a similar role to perplexity, and `min_dist` controls how tightly points cluster

UMAP is grounded in topological data analysis (specifically, fuzzy simplicial sets), which gives it a stronger theoretical foundation for preserving both local and global manifold structure. In practice, this means that when you see two clusters near each other in a UMAP plot, they are likely near each other in the original embedding space too.

For recommendation embeddings, UMAP typically produces the most informative visualizations: clear clusters where they exist, meaningful inter-cluster distances, and faithful representation of outliers.

## What to Look For

When you visualize your item embeddings, here is what to examine:

**Clusters by category.** If your model has learned meaningful representations, items from the same genre, category, or content type should cluster together. A movie recommender's embeddings should show action films grouping separately from romantic comedies. If categories are scattered randomly, the model has not captured categorical structure -- which might be fine (if it's learning more nuanced patterns) or might indicate a problem.

**Semantic neighborhoods.** Zoom into specific regions. Are the nearest neighbors of a given item semantically sensible? The closest items to a particular jazz album should be other jazz albums, or at least adjacent genres. Surprising neighbors can reveal interesting learned associations or embedding defects.

**Outliers.** Points far from all clusters are worth investigating. They might be items with very few interactions (poorly learned embeddings), items with unusual metadata, or genuine outliers in your catalog. A cluster of outliers often indicates a data quality issue.

**Transition zones.** The boundaries between clusters are informative. A smooth gradient from "rock" to "electronic" suggests the model has learned genre similarity. A sharp boundary suggests the model treats them as categorically distinct.

## Practical Tools

**TensorBoard Projector** (built into TensorFlow's TensorBoard) provides an interactive 3D visualization with built-in PCA, t-SNE, and UMAP. You can hover over points to see labels, search for specific items, and explore neighborhoods interactively. It handles up to roughly 100,000 points comfortably.

**plotly** enables interactive 2D and 3D scatter plots in Python with hover labels, zoom, and pan. Combined with scikit-learn's t-SNE or the `umap-learn` package, it provides a flexible notebook-based workflow. Particularly useful for creating shareable HTML visualizations.

**matplotlib** is the simplest option for static plots. Use `plt.scatter` with color-coding by category. Less interactive but integrates seamlessly into automated reporting pipelines.

**Embedding Projector** (projector.tensorflow.org) is a standalone web tool that accepts TSV files of embeddings and metadata. No code required -- useful for quick exploration or sharing with non-technical stakeholders.

## Cautionary Notes

Embedding visualizations are powerful but easy to over-interpret:

- **Distances in 2D are not distances in the original space.** Both t-SNE and UMAP are nonlinear projections that distort distances. A pair of points that appear close in 2D might be far apart in the original 128 dimensions. Use visualization for qualitative understanding, not quantitative measurement.
- **Cluster sizes are unreliable in t-SNE.** Dense clusters and sparse clusters may appear the same size. Do not conclude that two genres have equal representation based on visual cluster area.
- **Run multiple times.** t-SNE and UMAP are stochastic -- different random seeds produce different layouts. If a pattern appears consistently across runs, it is likely real. If it appears only once, it might be an artifact.
- **Projection loss is inevitable.** Projecting from 128 dimensions to 2 necessarily discards information. Some structure will be lost. The question is whether the preserved structure is informative, not whether it is complete.

## An Alternative: Interpretable Sparse Factors

Visualization is a workaround for the opacity of dense embeddings. If the embeddings themselves are interpretable, visualization becomes less necessary.

Sparse ELSA (discussed in the research chapter) learns embeddings where each active dimension corresponds to a semantic category -- "children's classics," "detective fiction," "science fiction romance." Instead of projecting 128 opaque dimensions to 2, you can directly inspect the 10 active dimensions of an item's sparse representation and immediately understand what the model has learned about it.

This does not replace visualization entirely -- you still want to see global structure, clusters, and outliers. But interpretable factors reduce the burden on visualization as the primary tool for understanding model behavior.
