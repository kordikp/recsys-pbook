---
id: ch13-knobs
type: spine
title: "From Knots to Knobs: Steerable Recommendations"
readingTime: 4
standalone: true
core: true
teaser: "What if users could turn knobs to steer their recommendations — boosting 'date night movies' or promoting a favorite director? Sparse autoencoders make this possible."
voice: universal
parent: null
diagram: null
recallQ: "How do sparse autoencoders enable steerable recommendations?"
recallA: "SAEs disentangle dense CFAE embeddings into sparse, interpretable neurons. Each neuron corresponds to a concept (genre, director, mood). Boosting a neuron's activation steers recommendations toward that concept without retraining."
highlights:
  - "SAE neurons map to interpretable concepts — genres, directors, moods — without using any metadata"
  - "Steering = boosting a neuron activation to shift recommendations toward a concept"
  - "Enables user control panels, editorial campaigns, and rabbit hole exits"
publishedAt: "2026-04-07"
status: accepted
---

Traditional recommender systems are black boxes: they take your interaction history and produce a ranked list. You can't tell the system "more like this, less like that" in any meaningful way. The system decides; you consume.

**What if recommendations had knobs?**

Research from [Recombee and Charles University](https://www.recombee.com/research-publications) proposes exactly this: a technique that transforms the opaque internal representations of collaborative filtering models into a structured "control panel" of interpretable knobs that users and editors can manipulate.

## The Core Idea

Collaborative filtering autoencoders (CFAEs) — including [EASE, ELSA](https://www.recombee.com/blog/linear-methods-and-autoencoders-in-recommender-systems), and MultVAE — compress user interaction histories into dense embedding vectors. These embeddings are powerful but entangled: each dimension encodes a mix of preferences with no clear semantic meaning.

The insight: **insert a sparse autoencoder (SAE) between the encoder and decoder.** The SAE takes the dense embedding and re-encodes it into a much wider but sparse representation — thousands of dimensions, but only a few dozen active per user.

$$\mathbf{z}_{\text{dense}} = \text{CFAE-Encode}(\mathbf{x}_u) \quad \rightarrow \quad \mathbf{z}_{\text{sparse}} = \text{SAE-Encode}(\mathbf{z}_{\text{dense}})$$

The key discovery: **these sparse neurons spontaneously correspond to interpretable concepts.** Without any metadata, without any labels, individual neurons activate for specific genres, directors, moods, and themes. One neuron fires for "Quentin Tarantino." Another for "Studio Ghibli." Another for "romantic comedies."

## Why Sparsity Creates Interpretability

Dense embeddings are like mixed paint — every dimension contains a bit of everything. You can't separate "likes action" from "likes Nolan" because both are blended across all 256 dimensions.

Sparse embeddings are like a palette with individual color wells. Each active neuron represents one distinct concept. A user who likes Tarantino, sci-fi, and indie music has exactly those three neurons active — not a murky blend across hundreds of dimensions.

This mirrors findings from [mechanistic interpretability research in LLMs](https://www.recombee.com/blog/linear-methods-and-autoencoders-in-recommender-systems) (Anthropic's work on sparse autoencoders for understanding Claude), but applied to recommendation: the SAE discovers the "atoms of preference" that the CFAE has learned to represent.

## The Control Panel

Once neurons are labeled (via metadata correlation — which tags co-occur with which neuron activations), they become knobs:

**User-facing steering:**
- "I'm in the mood for a date night" → boost the "romantic" neuron
- "Show me more like David Lynch" → activate the Lynch neuron
- "I've been watching too much true crime" → dampen the true-crime neuron

**Editorial campaigns:**
- "Essential Directors" campaign → boost director-specific neurons for each user, creating personalized promotions
- "Summer blockbusters" → boost the action/spectacle neurons seasonally

**Algorithmic steering:**
- Diversity injection → detect when a user's active neurons are too concentrated and automatically diversify
- Rabbit hole exit → when the system detects narrowing consumption patterns, gently widen the activated neuron set

## Exiting the Rabbit Hole

This is perhaps the most compelling application. Filter bubbles and rabbit holes form because the recommendation system reinforces existing patterns. Each interaction deepens the groove.

With steerable neurons, the system can **detect and counteract** this process:

1. **Monitor neuron concentration:** Track how many neurons are active for each user over time. If the count is declining (fewer active interests), the user may be entering a rabbit hole.

2. **Gentle diversification:** Instead of random exploration (which feels jarring), boost neurons that are *adjacent* to the user's active interests. A user deep in true crime might have latent interest in investigative journalism or legal thrillers — neurons that are close in the activation space but currently suppressed.

3. **User agency:** Expose the control panel to users. Let them see which "knobs" the system thinks they care about, and let them adjust. "The system thinks I'm into horror — I actually want psychological thrillers." This transforms the black box into a dialogue.

## Technical Results

The paper evaluates TopK SAEs and Basic SAEs on ELSA and MultVAE embeddings across MovieLens-25M and Million Song Dataset:

- **TopK SAE preserves 95-99% of CFAE accuracy** while producing sparse, interpretable representations
- **Concept-neuron mapping** using TF-IDF over tag-activation matrices reveals clear semantic structure
- **Steering effectiveness:** Boosting a single neuron shifts recommendations measurably toward the target concept
- Cosine-similarity-based CFAE embeddings (like ELSA) work better with SAE reconstruction than variational embeddings (MultVAE)

## Implications for Recommendation Design

This research challenges a fundamental assumption: that recommendation systems must be opaque. The SAE approach shows that **interpretability and steerability can be added to existing systems** without retraining the base model — the SAE is a lightweight addition, not a replacement.

For users, it means moving from "the algorithm decides" to "I guide the algorithm." For editors and product teams, it means fine-grained control over recommendation behavior without engineering intervention. For the field, it suggests that the dense representations our models learn contain far more structure than we typically access.

> **Research publication:** Spišák, Peška, Škoda, Vančura & Alves, "From Knots to Knobs: Towards Steerable Collaborative Filtering Using Sparse Autoencoders." Joint work between [Recombee](https://www.recombee.com/research-publications) and Faculty of Mathematics and Physics, Charles University.

**Consider this:** The knobs metaphor reframes the entire relationship between users and recommendation algorithms. Instead of a system that acts on you, it becomes a system you act through. The algorithm isn't replaced — it's augmented with a human-readable interface to its own internal knowledge. This is what responsible AI looks like in practice: not removing the algorithm, but making it transparent and controllable.