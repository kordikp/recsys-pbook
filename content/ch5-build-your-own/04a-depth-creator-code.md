---
id: ch5-code-d-create
type: spine
title: "Code It!"
readingTime: 4
standalone: false
teaser: "A simple Python script that does everything you just learned -- in 20 lines."
voice: creator
parent: null
diagram: null
---

Ready to turn your recommendation system into actual code? Here's a Python script that does everything from Steps 1-3. Every single line has a comment explaining what it does.

**You'll need:**
- Python installed on your computer (free at python.org)
- Your ratings saved as a CSV file

**First, save your data as `ratings.csv`:**

```text
Name,Frozen,Spider-Verse,Moana,Mario,Encanto
Alex,5,4,5,3,4
Sam,5,3,5,,5
Jordan,2,5,3,5,
Maya,4,,4,4,3
Leo,,5,,5,2
```

(Empty cells = movies they haven't seen)

**The code (save as `recommend.py`):**

```python
import csv                           # reads CSV files

ratings = {}                         # empty dictionary to hold all ratings
with open('ratings.csv') as f:       # open our data file
    reader = csv.DictReader(f)       # read it as a table with headers
    for row in reader:               # go through each person
        name = row['Name']           # get their name
        ratings[name] = {}           # start their rating list
        for movie, score in row.items():  # go through each movie
            if movie != 'Name' and score: # skip name column and blanks
                ratings[name][movie] = int(score)  # store as number

def similarity(person1, person2):
    shared = []                      # movies both people rated
    for movie in ratings[person1]:   # check person1's movies
        if movie in ratings[person2]:  # did person2 also rate it?
            diff = abs(ratings[person1][movie] - ratings[person2][movie])
            shared.append(diff)      # save the difference
    if not shared:                   # no movies in common?
        return 99                    # not similar at all
    return sum(shared) / len(shared) # average difference (lower = more similar)

def predict(person, movie):
    scores = []                      # collect ratings from similar people
    for other in ratings:            # check every other person
        if other == person:          # skip yourself
            continue
        if movie in ratings[other]:  # did they rate this movie?
            sim = similarity(person, other)  # how similar are they?
            if sim < 2:              # only use similar people
                scores.append(ratings[other][movie])
    if scores:                       # if we found similar people
        return round(sum(scores) / len(scores), 1)  # return average
    return None                      # not enough data to predict

person = 'Sam'                       # who to recommend for
print(f'Recommendations for {person}:')
all_movies = set()                   # find every movie in our data
for p in ratings:
    all_movies.update(ratings[p].keys())
for movie in sorted(all_movies):     # check each movie
    if movie not in ratings[person]: # only predict unseen movies
        pred = predict(person, movie)
        if pred and pred >= 4:       # only recommend 4+ stars
            print(f'  {movie}: predicted {pred} stars')
```

**Run it:** Open a terminal and type `python recommend.py`

You should see output like:
```text
Recommendations for Sam:
  Encanto: predicted 4.0 stars
```

**Try changing things:**
- Change `person = 'Sam'` to another name from your data
- Change `if sim < 2` to `if sim < 1` (stricter similarity)
- Change `if pred and pred >= 4` to `>= 3` (more recommendations)

**Too young for Python?** Check out Scratch (scratch.mit.edu)! You can build a simpler version using lists and loops. The logic is the same -- you're comparing lists of numbers and finding averages. Scratch makes it visual and fun.

**Challenge:** Add more people and movies to your CSV. Does the system get better with more data? (Spoiler: yes, it usually does!)
