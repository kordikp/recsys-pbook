---
id: ch3-ws-build
type: spine
title: "Worksheet: Build a Movie Recommender by Hand!"
readingTime: 15
standalone: true
teaser: "Build a real recommendation system with just paper and pencil!"
voice: universal
parent: null
diagram: null
---

# Worksheet: Build a Movie Recommender by Hand!

Did you know you can build a real recommendation system without writing a single line of code? All you need is a pencil, this worksheet, and 5 friends (or family members). Let's go!

---

## Step 1: Collect Ratings

Ask 5 people to rate these movies from 1 to 5 stars. If someone hasn't seen a movie, write an X.

**Rating scale:**
- 1 = Hated it
- 2 = Didn't like it
- 3 = It was okay
- 4 = Liked it!
- 5 = Loved it!!
- X = Haven't seen it

Write each person's name at the top of their column, then fill in their ratings:

| Movie | Friend 1: _____ | Friend 2: _____ | Friend 3: _____ | Friend 4: _____ | Friend 5: _____ | YOU |
|-------|:-:|:-:|:-:|:-:|:-:|:-:|
| Frozen | | | | | | |
| Spider-Man: Across the Spider-Verse | | | | | | |
| Encanto | | | | | | |
| Moana | | | | | | |
| Inside Out 2 | | | | | | |
| Wonka | | | | | | |

**Feel free to swap in other movies everyone might know!** The important thing is that everyone rates the same list.

---

## Step 2: Find Your Taste Twin

Now the magic begins. Compare YOUR ratings to each friend's ratings. For every movie you BOTH rated (ignore the X's), check if your scores are within 1 star of each other. That counts as a match!

**Example:** If you gave Frozen a 4 and your friend gave it a 5, that's a match (difference = 1). If you gave it a 4 and they gave it a 2, that's NOT a match (difference = 2).

| Friend | Movies you both rated | Matching ratings (within 1 star) | Match score |
|--------|:---------------------:|:--------------------------------:|:-----------:|
| Friend 1: _____ | ___ out of 6 | ___ matches | ___% |
| Friend 2: _____ | ___ out of 6 | ___ matches | ___% |
| Friend 3: _____ | ___ out of 6 | ___ matches | ___% |
| Friend 4: _____ | ___ out of 6 | ___ matches | ___% |
| Friend 5: _____ | ___ out of 6 | ___ matches | ___% |

**To calculate the match score:** matches divided by movies you both rated, times 100.

Example: 4 matches out of 5 movies = 4/5 = 0.8 = **80%**

**Your taste twin is:** _______________  (the friend with the highest match score!)

---

## Step 3: Get Your Recommendations!

Look at your taste twin's ratings. Find movies that:
- Your taste twin **rated** (not X)
- **YOU** haven't seen yet (you wrote X)

Those are your recommendations! Write them below, along with your taste twin's rating:

| # | Recommended movie | Taste twin's rating |
|---|-------------------|:-------------------:|
| 1 | _______________ | ___/5 |
| 2 | _______________ | ___/5 |
| 3 | _______________ | ___/5 |

**No recommendations?** If you and your taste twin have seen all the same movies, look at your second-closest friend instead!

---

## Step 4: Test It!

This is the big moment. Watch one of the recommended movies and see if your "paper recommender" actually works!

| Question | Your answer |
|----------|-------------|
| Movie you watched | _______________ |
| Your taste twin's rating | ___/5 |
| YOUR rating after watching | ___/5 |
| Difference | ___ stars |
| Was it a good recommendation? | Great / Okay / Not really |

---

## Step 5: Reflect

Answer these questions. There are no wrong answers — this is about thinking like a recommendation engineer!

**What worked well about this method?**

> _______________________________________________________________

**What's one problem you noticed?**
(Hint: What happens when nobody has seen a brand-new movie? What if you only have 5 friends — is that enough?)

> _______________________________________________________________

**How would you improve this system?**

> _______________________________________________________________

---

## What You Just Built

Congratulations! You just did **collaborative filtering** by hand. This is the same basic idea that Netflix, Spotify, and YouTube use — just with millions of users instead of 5 friends, and computers doing the math instead of pencils.

Here's how your paper version maps to the real thing:

| Your paper version | Real recommendation system |
|-------------------|---------------------------|
| Asking 5 friends for ratings | Millions of users rate or watch content |
| Finding your taste twin | Algorithm finds users with similar patterns |
| Recommending their favorites | System suggests items similar users enjoyed |
| Testing with 1 movie | A/B testing with thousands of users |

The difference? Scale and speed. But the core idea is exactly the same.

---

*Fun fact: The Netflix Prize (2006-2009) offered $1,000,000 to anyone who could improve their recommendation algorithm by just 10%. The winning team used a much fancier version of what you just did!*
