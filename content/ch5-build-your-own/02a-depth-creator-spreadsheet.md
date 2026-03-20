---
id: ch5-spread-d-create
type: depth
title: "Build It in a Spreadsheet"
readingTime: 3
standalone: false
teaser: "Google Sheets instructions to create your very own rating matrix."
voice: creator
parent: ch5-collect
diagram: null
---

# Build It in a Spreadsheet

Paper is great for starting out, but if you want to go bigger -- more people, more movies -- a spreadsheet is your best friend. Here's exactly how to set it up in Google Sheets (or Excel, or any spreadsheet app).

**Step 1: Create the sheet**

Open Google Sheets (sheets.google.com) and start a new blank spreadsheet. Name it "My Recommendation System."

**Step 2: Set up the columns**

- Cell A1: type "Name"
- Cell B1: type your first movie title (like "Frozen")
- Cell C1: second movie title
- Keep going across the top row for all 10 movies

**Step 3: Add the people**

- Cell A2: first person's name (like "Alex")
- Cell A3: second person's name
- Keep going down for all your survey responses

**Step 4: Fill in the ratings**

For each person, enter their rating (1-5) in the matching cell. If they haven't seen the movie, **leave the cell empty**. Don't put 0 -- that would mean something different. Empty means "unknown."

Your sheet should look something like this:

| Name | Frozen | Spider-Verse | Moana | Mario | Encanto |
|---|---|---|---|---|---|
| Alex | 5 | 4 | 5 | 3 | 4 |
| Sam | 5 | 3 | 5 | | 5 |
| Jordan | 2 | 5 | 3 | 5 | |
| Maya | 4 | | 4 | 4 | 3 |

**Step 5: Make it visual**

Here's a fun trick: select all the rating cells and use **conditional formatting** (Format > Conditional formatting) to color-code them:
- 5 stars: dark green
- 4 stars: light green
- 3 stars: yellow
- 2 stars: orange
- 1 star: red

Now you can literally SEE the patterns. Rows that have similar colors = people with similar taste!

**Pro tip:** Add a row at the bottom that calculates the **average rating** for each movie using `=AVERAGE(B2:B11)`. This tells you which movies are generally popular and which are divisive.

This spreadsheet IS your rating matrix. It's exactly what Netflix and Spotify use -- just way, way bigger. Netflix's matrix has over 200 million rows (users) and tens of thousands of columns (movies). Yours is a mini version of the same thing.
