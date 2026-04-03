---
id: ch5-similar
type: spine
title: "Step 2: Find Similar Users"
readingTime: 3
standalone: true
core: true
teaser: "Who has correlated preferences? Identify your nearest neighbors."
voice: universal
parent: null
diagram: null
recallQ: "How do you find \"taste neighbors\"?"
recallA: "Compare ratings on co-rated items — lower mean absolute difference = more similar preferences."
highlights:
  - "Compare ratings on shared items — lower average difference = more similar"
  - "Taste neighbors form the foundation of collaborative filtering"
status: accepted
---

Now comes the analytical core. You have your rating matrix. Time to determine: **which users have correlated preferences?**

Consider three users' ratings:

| | Shawshank | Parasite | Everything Everywhere | Oppenheimer |
|---|---|---|---|---|
| Alice | 5 | 4 | 5 | 3 |
| Bob | 5 | 5 | 4 | 3 |
| Carlos | 2 | 2 | 1 | 5 |

Look at Alice and Bob. They both gave Shawshank 5 stars and Oppenheimer 3 stars. Their Parasite and Everything Everywhere ratings are close too. Alice and Bob have **correlated preferences**.

Now look at Alice and Carlos. Alice rates Shawshank highly (5), Carlos rates it low (2). Alice likes Parasite (4), Carlos doesn't (2). Their preferences are essentially anticorrelated.

**This is the foundation of collaborative filtering.**

Suppose Bob hasn't seen Dune: Part Two, but Alice rated it 5 stars. Since Alice and Bob have similar taste, we can predict: **Bob will likely enjoy Dune: Part Two as well.**

Conversely, if Carlos rated a movie 5 stars that Alice hasn't seen, we should probably not recommend it to Alice, since their preferences are anticorrelated.

**Computing similarity (the simple way):**

For each pair of users, identify the items they both rated (the co-rated set). Then compute the mean absolute difference (MAD).

Alice vs Bob (co-rated items):
- Shawshank: Alice 5, Bob 5 (difference = 0)
- Parasite: Alice 4, Bob 5 (difference = 1)
- Everything Everywhere: Alice 5, Bob 4 (difference = 1)
- Oppenheimer: Alice 3, Bob 3 (difference = 0)
- **MAD: 0.5** (highly similar)

Alice vs Carlos (co-rated items):
- Shawshank: Alice 5, Carlos 2 (difference = 3)
- Parasite: Alice 4, Carlos 2 (difference = 2)
- Oppenheimer: Alice 3, Carlos 5 (difference = 2)
- **MAD: 2.3** (dissimilar)

Lower mean absolute difference = more similar preferences. This is the simplest form of a distance-based similarity measure.

**Compute this for every user pair in your matrix.** The result is a ranked list of nearest neighbors for each user -- and these neighbors are the key to generating predictions.

**Consider this:** In your own data, which user pair turned out to be the most similar? The results can be surprising -- demographics or surface-level attributes often fail to predict preference alignment. That's precisely why data-driven approaches outperform intuition.
