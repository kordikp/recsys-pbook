---
id: ch3-graph-methods
type: spine
title: "Graph-Based Methods: Recommendations as Network Science"
readingTime: 4
standalone: true
core: true
teaser: "What if the best way to recommend isn't to decompose a matrix, but to traverse a network? Graph methods reveal structural patterns that linear algebra alone cannot see."
voice: universal
parent: null
diagram: null
recallQ: "What advantage do Graph Neural Networks (like LightGCN) have over matrix factorization for recommendation?"
recallA: "GNNs capture multi-hop neighborhood structure in the user-item graph. By aggregating information across multiple layers, they encode higher-order collaborative signals -- e.g., 'users who share neighbors of neighbors' -- that matrix factorization compresses into a single latent space and cannot explicitly represent."
highlights:
  - "Graphs preserve multi-hop paths that matrix factorization flattens away"
  - "LightGCN with one layer approximates EASE; deeper layers go beyond it"
  - "PinSage proved graph methods work at 3 billion nodes and 18 billion edges"
publishedAt: "2026-04-03"
status: accepted
---

A recommendation dataset is, at its core, a network. Users and items are entities; interactions are connections between them. Matrix factorization collapses this network into vectors. But what if we worked with the graph directly?

## The User-Item Bipartite Graph

Every recommendation dataset can be represented as a **bipartite graph** -- a network with two types of nodes (users and items) where edges only connect nodes of different types:

- **User nodes**: each representing a person
- **Item nodes**: each representing a product, song, article, or video
- **Edges**: representing interactions (clicks, purchases, ratings, streams)

A user who watched 50 movies has 50 edges connecting them to 50 item nodes. Two users who watched many of the same movies share many neighbors in this graph -- they are structurally similar even without computing any embeddings.

## What Graphs Capture That Matrices Miss

Matrix factorization compresses the entire interaction matrix into a fixed-dimensional latent space. This is powerful, but it loses structural information:

- **Path structure**: In a graph, you can trace paths like User A -> Movie X -> User B -> Movie Y. This two-hop path suggests Movie Y for User A -- not because of latent similarity, but because of explicit structural connectivity.
- **Local topology**: Some users are hubs (connected to hundreds of items); others are peripheral. Some items bridge otherwise disconnected communities. This topological information is flattened in a matrix decomposition.
- **Higher-order patterns**: Triangles, cliques, and community structures encode group behavior that a dot product between two vectors cannot represent.

Graph-based methods operate on this structure directly, preserving information that would otherwise be discarded.

## Random Walk Approaches: Learning from Graph Traversals

Before Graph Neural Networks, researchers adapted techniques from network science to learn node representations from graph structure.

**DeepWalk** (Perozzi et al., 2014) performs random walks on the graph -- starting from a node and repeatedly jumping to a random neighbor -- then treats the resulting sequences of nodes exactly like sentences of words. Feeding these "sentences" into Word2Vec produces embeddings where structurally similar nodes end up close together. The intuition: nodes that appear in similar random walk contexts play similar roles in the graph.

**Node2Vec** (Grover & Leskovec, 2016) extends DeepWalk with biased random walks controlled by two parameters: one governing the tendency to revisit the previous node (breadth-first exploration) and another governing the tendency to move further away (depth-first exploration). This allows the embeddings to capture both local community structure and global positional roles.

For recommendation, random walks on the user-item bipartite graph naturally alternate between user and item nodes. A walk like User A -> Item 1 -> User B -> Item 2 -> User C captures the collaborative filtering intuition: items consumed by similar users get embedded nearby.

## Graph Neural Networks: Message Passing on the Interaction Graph

**Graph Neural Networks** (GNNs) take a fundamentally different approach. Instead of learning from random walk sequences, they learn embeddings by iteratively aggregating information from a node's neighbors -- a process called **message passing**.

At each layer, every node collects (aggregates) the embeddings of its neighbors, combines them with its own embedding, and produces an updated representation. After $L$ layers, each node's embedding encodes information from its $L$-hop neighborhood.

### LightGCN: Elegant Simplicity

**LightGCN** (He et al., 2020) stripped graph convolution down to its essential ingredient for recommendation: neighborhood aggregation. It removes the feature transformation matrices and nonlinear activation functions used in standard GCNs, keeping only the normalized sum over neighbors:

$$e_u^{(l+1)} = \sum_{i \in N_u} \frac{1}{\sqrt{|N_u| \cdot |N_i|}} \; e_i^{(l)}$$

where $N_u$ is the set of items user $u$ has interacted with, and $N_i$ is the set of users who interacted with item $i$. The normalization factor $\frac{1}{\sqrt{|N_u| \cdot |N_i|}}$ prevents nodes with many connections from dominating the aggregation (symmetric normalization from spectral graph theory).

The final embedding for each node is a **weighted average across all layers**:

$$e_u = \sum_{l=0}^{L} \alpha_l \; e_u^{(l)}$$

where $\alpha_l$ can be uniform ($\alpha_l = \frac{1}{L+1}$) or learned. This multi-scale combination is crucial: $e_u^{(0)}$ captures the node's own identity, $e_u^{(1)}$ captures direct neighbors, $e_u^{(2)}$ captures two-hop neighborhoods (users who liked the same items as users who share your taste), and so on.

**Why LightGCN works**: Each additional layer implements one more hop of collaborative filtering. Layer 1 says "recommend items liked by similar users." Layer 2 says "recommend items liked by users who are similar to your similar users." This multi-hop aggregation is a form of **higher-order collaborative filtering** that matrix factorization can only approximate.

### Connection to EASE

An intriguing theoretical connection: LightGCN with $L=1$ (a single aggregation layer) approximates a form closely related to **EASE** (Steck, 2019). Both methods effectively compute predictions as a weighted combination of a user's interaction history, where the weights are derived from the item-item co-occurrence structure normalized by popularity. The key difference is that EASE solves for these weights in closed form via the precision matrix, while LightGCN learns them through gradient descent on the graph. Deeper LightGCN ($L > 1$) goes beyond what EASE can capture by incorporating multi-hop neighborhood information.

## PinSage: Graph Methods at Pinterest Scale

Theoretical elegance means nothing if it doesn't scale. **PinSage** (Ying et al., 2018), developed at Pinterest, demonstrated that graph-based recommendations could work on a graph with **3 billion nodes** and **18 billion edges**.

The key engineering innovations:

- **Random walk sampling for neighborhoods**: Instead of aggregating all neighbors (computationally prohibitive for popular items with millions of connections), PinSage uses short random walks to sample a fixed-size neighborhood. This provides importance-weighted sampling -- frequently visited neighbors in random walks contribute more.
- **Mini-batch training**: Rather than processing the entire graph, PinSage constructs localized subgraphs (computational graphs) around sampled nodes, enabling GPU-efficient mini-batch training.
- **Producer-consumer architecture**: A CPU-based map-reduce pipeline extracts features and constructs mini-batches while GPUs train the model, maximizing hardware utilization.
- **Curriculum training**: Training begins with easy negative examples and progressively introduces harder negatives (items that are similar but not interacted with), improving discrimination ability.

The production deployment generates **pin-to-pin recommendations** -- "related pins" that appear when you click on any pin. At the time of publication, this system powered recommendations across Pinterest's entire catalog.

## Knowledge Graphs: Adding Semantic Structure

The user-item bipartite graph captures behavioral signals. **Knowledge graphs** enrich this with semantic structure by adding new node types and relationship edges:

- A movie node connects to its director, actors, and genre nodes
- A director node connects to all their films
- Genre nodes link to related genres

Now the graph encodes that Christopher Nolan directed both *Inception* and *Interstellar*, that both are sci-fi, and that Matthew McConaughey appeared in *Interstellar*. A user who loved *Inception* is connected through multiple semantic paths to *Interstellar* -- paths that carry meaning beyond co-occurrence statistics.

Knowledge graph embeddings (e.g., TransE, TransR) and GNNs operating on heterogeneous graphs can leverage these semantic paths. Systems like KGAT (Wang et al., 2019) apply attention-based aggregation over knowledge graph neighbors, learning which semantic relationships matter most for recommendation.

## Social Graphs: Your Friends' Taste Matters

When the graph includes social connections -- friendships, follows, trust relationships -- the recommendation system can propagate preference signals through the social network:

- If your close friends all watched a documentary, it might appeal to you
- Trust-weighted propagation: recommendations from friends you trust more carry greater weight
- Social influence modeling: some users are taste leaders whose preferences predict their followers' future behavior

Social recommendation models like GraphRec (Fan et al., 2019) and DiffNet (Wu et al., 2019) jointly model the user-item interaction graph and the user-user social graph, learning when social signals are informative and when they're noise.

## Practical Considerations

**When to use graph methods**:
- When the interaction graph has rich structural patterns (communities, bridges, hubs)
- When multi-hop relationships carry signal (friend-of-friend, item-of-similar-user)
- When side information can be naturally encoded as graph edges (knowledge graphs, social networks)
- When you need to incorporate heterogeneous relationships

**When simpler methods may suffice**:
- Sparse graphs with few interactions per user (insufficient structure for multi-hop aggregation)
- When computational budget is constrained -- GNNs require more training infrastructure than matrix factorization
- When the interaction pattern is well-captured by direct co-occurrence (where EASE or ALS already perform strongly)

**Scalability**: The primary engineering challenge. Full-graph GNN training is infeasible for billion-node graphs. Production systems rely on sampling strategies (PinSage), graph partitioning, or mini-batch approaches. Libraries like PyTorch Geometric and DGL have made this more accessible, but deploying graph methods at scale still requires significant infrastructure investment compared to matrix factorization or two-tower models.

**The trajectory of the field**: GraphSAGE (Hamilton et al., 2017) introduced inductive learning on graphs -- the ability to generalize to unseen nodes without retraining. PinSage adapted this for recommendation at industrial scale. LightGCN showed that simpler architectures often outperform complex ones for collaborative filtering. The current frontier combines graph structure with language model embeddings, using GNNs to propagate semantic representations through the interaction network.
