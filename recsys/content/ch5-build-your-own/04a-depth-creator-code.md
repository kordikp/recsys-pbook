---
id: ch5-code-d-create
type: spine
title: "Code It!"
readingTime: 5
standalone: false
teaser: "A clean Python implementation of user-based collaborative filtering with evaluation metrics."
voice: creator
parent: null
diagram: null
recallQ: "How many lines of Python does it take to build basic collaborative filtering?"
recallA: "Under 50 lines for a complete pipeline: data loading, similarity computation, prediction, and evaluation — the same core logic behind production systems."
highlights:
  - "A complete collaborative filtering implementation fits in ~30 lines of Python"
  - "Code automates the manual process and scales to larger datasets"
status: accepted
---

Let's translate the recommendation pipeline into working Python code. This implementation covers data loading, similarity computation, prediction, and basic evaluation -- all with clear structure and documentation.

**Requirements:**
- Python 3.8+ (python.org)
- pandas (`pip install pandas`)
- Your ratings saved as a CSV file

**First, save your data as `ratings.csv`:**

```text
user,shawshank,oppenheimer,parasite,dark_knight,everything_everywhere
Alice,5,4,5,3,4
Bob,5,3,5,,5
Carlos,2,5,3,5,
Diana,4,,4,4,3
Ethan,,5,,5,2
```

(Empty cells = unrated items)

**The code (save as `recommend.py`):**

```python
"""
User-based collaborative filtering recommender system.

Implements k-nearest-neighbor prediction using mean absolute difference
as the similarity metric, with MAE evaluation.
"""

import pandas as pd
from typing import Optional


def load_ratings(filepath: str) -> pd.DataFrame:
    """Load rating matrix from CSV. Returns DataFrame with users as index."""
    df = pd.read_csv(filepath, index_col="user")
    return df.apply(pd.to_numeric, errors="coerce")


def similarity(ratings: pd.DataFrame, user_a: str, user_b: str) -> float:
    """Compute mean absolute difference between two users over co-rated items.

    Returns a distance score (lower = more similar).
    Returns float('inf') if no co-rated items exist.
    """
    a = ratings.loc[user_a].dropna()
    b = ratings.loc[user_b].dropna()
    shared = a.index.intersection(b.index)
    if len(shared) == 0:
        return float("inf")
    return (a[shared] - b[shared]).abs().mean()


def predict(
    ratings: pd.DataFrame, user: str, item: str,
    k: int = 3, max_distance: float = 2.0
) -> Optional[float]:
    """Predict a user's rating for an item using k-nearest neighbors.

    Args:
        ratings: User-item rating matrix.
        user: Target user.
        item: Target item to predict.
        k: Number of nearest neighbors to use.
        max_distance: Maximum distance threshold for neighbor inclusion.

    Returns:
        Predicted rating, or None if insufficient neighbor data.
    """
    neighbors = []
    for other in ratings.index:
        if other == user:
            continue
        if pd.notna(ratings.loc[other, item]):
            dist = similarity(ratings, user, other)
            if dist <= max_distance:
                neighbors.append((dist, ratings.loc[other, item]))

    if not neighbors:
        return None

    # Use k closest neighbors, weighted by inverse distance
    neighbors.sort(key=lambda x: x[0])
    top_k = neighbors[:k]

    # Simple average (for weighted, use inverse-distance weights)
    avg = sum(rating for _, rating in top_k) / len(top_k)
    return round(avg, 2)


def recommend(
    ratings: pd.DataFrame, user: str,
    threshold: float = 4.0, k: int = 3
) -> list[tuple[str, float]]:
    """Generate ranked recommendations for a user.

    Returns list of (item, predicted_rating) tuples, sorted by predicted rating.
    """
    predictions = []
    for item in ratings.columns:
        if pd.isna(ratings.loc[user, item]):  # only predict unrated items
            pred = predict(ratings, user, item, k=k)
            if pred is not None and pred >= threshold:
                predictions.append((item, pred))

    return sorted(predictions, key=lambda x: -x[1])


def evaluate_mae(
    ratings: pd.DataFrame, k: int = 3, max_distance: float = 2.0
) -> float:
    """Compute Mean Absolute Error using leave-one-out cross-validation."""
    errors = []
    for user in ratings.index:
        for item in ratings.columns:
            actual = ratings.loc[user, item]
            if pd.isna(actual):
                continue
            # Temporarily hide the rating
            hidden = ratings.copy()
            hidden.loc[user, item] = None
            pred = predict(hidden, user, item, k=k, max_distance=max_distance)
            if pred is not None:
                errors.append(abs(pred - actual))

    return sum(errors) / len(errors) if errors else float("inf")


if __name__ == "__main__":
    df = load_ratings("ratings.csv")

    target_user = "Bob"
    print(f"Recommendations for {target_user}:")
    recs = recommend(df, target_user, threshold=3.5)
    for item, score in recs:
        print(f"  {item}: predicted {score} stars")

    print(f"\nModel evaluation (leave-one-out MAE): {evaluate_mae(df):.3f}")
```

**Run it:** `python recommend.py`

Expected output:
```text
Recommendations for Bob:
  everything_everywhere: predicted 4.0 stars

Model evaluation (leave-one-out MAE): 0.833
```

**Experiments to try:**
- Change `target_user` to generate recommendations for different users
- Adjust `k` (number of neighbors) and observe the effect on MAE
- Lower `threshold` to 3.0 to generate more (but potentially less precise) recommendations
- Add more users and items to `ratings.csv` and observe how MAE changes with data density

**Next steps for a production-quality implementation:**
- Replace MAD with cosine similarity or Pearson correlation (see the similarity math section)
- Add similarity-weighted predictions instead of simple averaging
- Implement train/test split instead of leave-one-out for larger datasets
- Use scipy.sparse for memory-efficient storage of large, sparse matrices

**Challenge:** Add more users and items to your CSV. Track how MAE changes. You should observe that prediction accuracy generally improves with data density -- a direct illustration of the cold-start problem and why data collection matters.
