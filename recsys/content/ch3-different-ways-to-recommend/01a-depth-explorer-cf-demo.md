---
id: ch3-cf-d-exp
type: spine
title: "See Collaborative Filtering in Action"
readingTime: 3
standalone: false
teaser: "A visual interaction matrix that shows exactly how the system identifies similar users."
voice: explorer
parent: null
diagram: diagram-cf-matrix
recallQ: "What are \"taste twins\" in collaborative filtering?"
recallA: "Users whose interaction patterns closely overlap with yours. If they also engaged with something new, the system predicts you will too."
highlights:
  - "Taste twins: users who rated the same items similarly form the basis of CF"
  - "Items your twins liked but you haven't seen are the recommendation candidates"
  - "The same logic runs at Netflix, Spotify, and YouTube — just at million-user scale"
status: accepted
---

Let's build a concrete example. Imagine six users and five items. A checkmark means they rated the item positively:

|  | Breaking Bad | Succession | Dark | Severance | Silo |
|---|---|---|---|---|---|
| **You** | YES | YES | YES | YES | ??? |
| **Maya** | YES | YES | YES | YES | YES |
| **Jake** | YES |  | YES |  | YES |
| **Priya** |  | YES |  | YES |  |
| **Leo** | YES | YES | YES | YES | YES |
| **Sam** |  |  | YES |  | YES |

## Step 1: Compute User Similarity

Look at the matrix. Who has the most overlap with your interaction history?

- **Maya**: matches you on ALL four items. Cosine similarity approaches 1.0 -- a near-perfect match.
- **Leo**: also matches on all four. Another high-similarity user.
- **Jake**: matches on two out of four. Moderate overlap.
- **Priya**: matches on two out of four. Moderate overlap, but on different items than Jake.
- **Sam**: matches on only one. Low similarity score.

The system ranks all users by their similarity to you. Maya and Leo are your nearest neighbors.

## Step 2: Aggregate Neighbor Preferences

Now look at the "Silo" column for your top-k nearest neighbors:

- Maya engaged with Silo -- YES
- Leo engaged with Silo -- YES

Both of your nearest neighbors rated it positively.

## Step 3: Generate the Recommendation

The system is now confident: **you'll likely engage with Silo**.

It's not deterministic. Preferences are noisy. But based on the co-occurrence pattern, it's a statistically strong prediction.

## Try It Yourself

Look at the matrix again. What would you recommend to **Priya**? She liked Succession and Severance. Who else liked those two items? You, Maya, and Leo. What else did all three of you like? Breaking Bad and Dark. So the system would recommend those to Priya.

That's the core mechanism. Identify similar users, aggregate their preferences on unseen items, recommend accordingly. Elegant in its simplicity -- and remarkably powerful when applied across millions of users and items.
