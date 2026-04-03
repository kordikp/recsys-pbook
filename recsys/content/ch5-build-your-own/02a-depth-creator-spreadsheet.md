---
id: ch5-spread-d-create
type: spine
title: "Build It in a Spreadsheet"
readingTime: 3
standalone: false
teaser: "Google Sheets or Excel instructions to construct and visualize your rating matrix."
voice: creator
parent: null
diagram: null
recallQ: "Why can a spreadsheet help you build recommendations?"
recallA: "Color-coded ratings reveal preference patterns visually — you can identify user clusters before running any algorithm."
status: accepted
---

A notebook is fine for prototyping, but once you scale beyond a handful of users and items, a spreadsheet becomes an invaluable tool. Here's exactly how to set it up in Google Sheets (or Excel, or any spreadsheet application).

**Step 1: Create the sheet**

Open Google Sheets (sheets.google.com) and start a new blank spreadsheet. Name it "Recommendation System Prototype."

**Step 2: Set up the columns**

- Cell A1: type "User"
- Cell B1: type your first item title (e.g., "The Shawshank Redemption")
- Cell C1: second item title
- Continue across the top row for all items in your catalog

**Step 3: Add the users**

- Cell A2: first user identifier (e.g., "Alice")
- Cell A3: second user identifier
- Continue down for all survey responses

**Step 4: Fill in the ratings**

For each user, enter their rating (1-5) in the corresponding cell. If they haven't rated the item, **leave the cell empty**. Do not enter 0 -- that would carry a different semantic meaning. Empty cells represent missing data, not zero preference.

Your sheet should look something like this:

| User | Shawshank | Oppenheimer | Parasite | Dark Knight | Everything Everywhere |
|---|---|---|---|---|---|
| Alice | 5 | 4 | 5 | 3 | 4 |
| Bob | 5 | 3 | 5 | | 5 |
| Carlos | 2 | 5 | 3 | 5 | |
| Diana | 4 | | 4 | 4 | 3 |

**Step 5: Visualize the data**

Select all rating cells and apply **conditional formatting** (Format > Conditional formatting) to create a heatmap:
- 5 stars: dark green
- 4 stars: light green
- 3 stars: yellow
- 2 stars: orange
- 1 star: red

This heatmap makes preference patterns immediately visible. Rows with similar color distributions indicate users with correlated tastes -- you can often identify user clusters before running any formal similarity computation.

**Pro tip:** Add a summary row that calculates the **mean rating** for each item using `=AVERAGE(B2:B11)` and a **standard deviation** using `=STDEV(B2:B11)`. The mean tells you overall popularity; the standard deviation reveals which items are divisive (high variance) versus universally liked or disliked (low variance).

This spreadsheet is your rating matrix **R**. It is structurally identical to what Netflix and Spotify use -- just at a different scale. Netflix's matrix has over 200 million rows (users) and tens of thousands of columns (titles). Yours is a tractable version of the same data structure.
