---
id: ch3-cf-d-create
type: spine
title: "Build Your Own Taste-Matching System"
readingTime: 4
standalone: false
teaser: "Survey your colleagues, build an interaction matrix, and discover hidden preference clusters."
voice: creator
parent: null
diagram: null
recallQ: "Can you build collaborative filtering without a computer?"
recallA: "Yes. Survey a group, create a rating matrix on paper, compute similarity scores, and predict preferences for unseen items."
highlights:
  - "CF can be prototyped with a spreadsheet — the logic is simple"
  - "More users and items improve predictions through denser co-occurrence data"
  - "Production systems use the exact same logic, just with millions of data points"
status: accepted
---

You don't need a production system to try collaborative filtering. You can do it right now with a spreadsheet and about 10 willing participants.

## What You'll Need

- A spreadsheet application (or pen and paper)
- 10 colleagues or friends willing to answer a quick survey
- 5 minutes

## Step 1: Select Your Items

Choose 8 widely-known items that most people in your group have experienced. For example:

1. Breaking Bad
2. Succession
3. The Bear
4. Oppenheimer
5. Dune: Part Two
6. Shogun
7. The Last of Us
8. Andor

## Step 2: Collect Ratings

Ask each participant: "Did you enjoy this? Yes or No?" (Skip items they haven't experienced.)

Create a matrix. Names down the rows, items across the columns. Write Y for yes, N for no, and leave blanks for "haven't seen."

## Step 3: Compute Pairwise Similarity

Now comes the interesting part. For each pair of participants, count how many items they agreed on (both said Y or both said N).

Example:
- Participant A and Participant B agreed on 6 out of 7 shared items. Strong similarity!
- Participant A and Participant C agreed on 2 out of 6. Weak similarity.

For a more rigorous approach, compute cosine similarity or Pearson correlation between their rating vectors.

## Step 4: Generate Predictions

Find a participant who HASN'T experienced one of the items. Look at their most similar neighbor -- someone who agreed with them on nearly everything. Did the neighbor enjoy that item? If yes, predict the participant will too.

## Step 5: Validate Your Predictions

Here's the empirical test. Ask: "Would you be interested in trying this?" See if your prediction aligns.

Try 10 predictions. How many were accurate?

- **7-10 correct**: Your system has solid predictive power. The similarity signal is strong.
- **4-6 correct**: Reasonable baseline. Production systems improve with more data and better similarity metrics.
- **0-3 correct**: The dataset may be too sparse, or the item set doesn't capture enough preference variance.

## What You Just Built

This is EXACTLY what Netflix, Spotify, and YouTube do. They operate at the scale of millions of users and millions of items, using distributed computing to process those similarity computations in milliseconds.

The more participants you survey and the more items you include, the better your predictions become. This is the **data network effect** -- the fundamental reason large platforms have such a competitive advantage in recommendation quality.

**Extension**: Try the same exercise with music, podcasts, or restaurants. Do different domains produce different similarity structures? You'll likely find that preference correlation varies significantly by domain -- a key insight that motivates domain-specific recommendation strategies.
