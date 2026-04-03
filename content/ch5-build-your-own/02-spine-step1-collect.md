---
id: ch5-collect
type: spine
title: "Step 1: Collect the Data"
readingTime: 3
standalone: true
core: true
teaser: "Survey your team, build a rating matrix, and watch the patterns emerge."
voice: universal
parent: null
diagram: null
recallQ: "What is a rating matrix?"
recallA: "Users as rows, items as columns, ratings in cells. Most cells are empty — that's what you predict."
status: accepted
---

Every recommendation system starts with data. Your data will come from real people -- colleagues, team members, or anyone willing to participate in a quick survey.

**The Survey:**

Pick **10 items** that most participants are likely to have experience with. For a movie recommender, choose a mix of genres, eras, and styles. Here's an example list:

1. The Shawshank Redemption
2. Oppenheimer
3. Parasite
4. The Dark Knight
5. Everything Everywhere All at Once
6. Pulp Fiction
7. Dune: Part Two
8. The Grand Budapest Hotel
9. Interstellar
10. No Country for Old Men

Now recruit **at least 10 participants** and ask each one:

"Rate each movie from 1 to 5 stars. If you haven't seen it, leave it blank."

- 1 star = strongly disliked
- 2 stars = disliked
- 3 stars = neutral
- 4 stars = liked
- 5 stars = strongly liked

**Build Your Rating Matrix:**

Construct a grid with users as rows and items as columns. Fill in the ratings.

| | Shawshank | Oppenheimer | Parasite | Dark Knight | Everything Everywhere |
|---|---|---|---|---|---|
| Alice | 5 | 4 | 5 | 3 | 4 |
| Bob | 5 | 3 | 5 | | 5 |
| Carlos | 2 | 5 | 3 | 5 | |
| Diana | 4 | | 4 | 4 | 3 |
| Ethan | | 5 | | 5 | 2 |

The empty cells represent items the user hasn't rated. These missing values are exactly what your recommendation system will **predict**.

This structure is called a **rating matrix** (or user-item matrix), denoted as **R** with dimensions *m x n* where *m* is the number of users and *n* is the number of items. It is the foundation of your entire recommendation system.

**Notice the sparsity.** Most of the matrix will be empty -- users haven't interacted with every item. This is expected and is in fact the core challenge. If the matrix were fully populated, there would be nothing left to recommend.

**Consider this:** Examine your matrix. Can you already identify users with correlated preferences? The patterns you spot visually are exactly what the algorithm will quantify mathematically.
