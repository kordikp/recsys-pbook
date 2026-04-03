---
id: ch3-embeddings-intuition
type: spine
title: "Embeddings: Giving Items an Address in Similarity Space"
readingTime: 2
standalone: true
core: false
teaser: "How do you teach a computer that 'Inception' is more similar to 'Interstellar' than to 'The Notebook'? You give each movie an address."
voice: universal
parent: ch3-deep-similarity
diagram: null
recallQ: "What is an embedding and why is it useful for recommendation?"
recallA: "An embedding is a vector (list of numbers) representing an item in a space where distance = dissimilarity. Nearby items are similar, distant items are different. This enables fast similarity search."
status: accepted
---

Imagine you want to explain to a computer which movies are similar. You could write rules: "action movies are similar to action movies." But that misses nuance. *The Dark Knight* is an action movie, but it shares more DNA with *Se7en* (dark tone, complex villain) than with *Fast & Furious* (action, but pure spectacle).

## The Address Analogy

Think of a city map. Every building has an address — two numbers (latitude, longitude) that tell you where it is. Buildings that are close together have similar addresses.

An **embedding** does the same thing for items, but instead of 2 dimensions (latitude, longitude), it uses dozens or hundreds of dimensions. Each movie gets a "vector" — a list of numbers like [0.8, -0.3, 0.5, 0.1, ...].

These numbers don't directly correspond to "action" or "comedy" — they represent **latent factors** that the algorithm discovered from user behavior. But items with similar vectors tend to be similar in ways that users actually care about.

## Why Position Matters More Than Labels

Here's the key insight: you don't need to tell the algorithm what makes movies similar. **It learns from behavior.**

If users who love *Inception* also love *Interstellar* but not *The Notebook*, the algorithm places *Inception* and *Interstellar* close together in the embedding space and *The Notebook* far away.

This is fundamentally different from using tags or genres:
- **Tags say:** "These are both sci-fi"
- **Embeddings say:** "Users who interact with one tend to interact with the other"

The behavioral signal is richer. It captures mood, tone, complexity, cultural context — things that genre tags miss entirely.

## The Word2Vec Revolution

The idea that started this revolution came from natural language processing. In 2013, Mikolov et al. showed that if you train a neural network to predict words from their neighbors, the learned representations capture meaning:

- vector("king") - vector("man") + vector("woman") ≈ vector("queen")

The same principle applies to recommendation:
- vector("Inception") - vector("Nolan") + vector("Villeneuve") ≈ vector("Arrival")

This analogy between words and items (called **Prod2Vec**, Item2Vec) showed that you could learn meaningful item representations by treating user interaction sequences as "sentences" and items as "words."

## From Embeddings to Recommendations

Once every item has an embedding vector, recommendation becomes **nearest neighbor search**: find the items closest to what the user has interacted with.

With millions of items, you can't compare every pair. That's where **Approximate Nearest Neighbor (ANN)** algorithms come in — methods like HNSW and FAISS that find the closest items in milliseconds, even among billions of vectors.

**Consider this:** When Spotify's Discover Weekly nails a recommendation, it's because the recommended song has an embedding vector close to songs you've already enjoyed — not because someone labeled it with the right tags, but because millions of other users' behavior revealed the similarity.