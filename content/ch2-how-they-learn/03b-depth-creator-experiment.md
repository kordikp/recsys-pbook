---
id: ch2-privacy-d-create
type: spine
title: "The Algorithm Experiment"
readingTime: 2
standalone: false
teaser: "Clear your history, train the algorithm from scratch, and measure how fast it converges on your preferences."
voice: creator
parent: null
diagram: null
recallQ: "How fast does an algorithm start personalizing for you?"
recallA: "Roughly 5-10 deliberate interactions. Engage with a specific topic and your feed begins reflecting it within minutes."
highlights:
  - "The algorithm reshapes quickly -- clear history plus 5-10 new interactions changes the feed"
  - "Systems overreact to new topics: 2 articles on a new subject can flood recommendations"
  - "Running controlled experiments reveals how responsive the system really is"
status: accepted
---

Here's a practical experiment you can run yourself. You're going to empirically test how quickly a recommendation system converges on your preferences. It takes about 15 minutes of active effort spread over three days.

**What You'll Need:**
- A YouTube account (or any platform with visible recommendations)
- A note-taking app or spreadsheet to track results
- 3 days of observation

**Note:** You can either clear your watch history on an existing account or create a fresh browser profile to avoid disrupting your current recommendations.

## Day 1: Reset and Train

**Step 1: Clear the slate.**
Go to YouTube > Settings > History & Privacy > Clear watch history. Also clear your search history. The algorithm now has minimal behavioral data about you.

**Step 2: Capture the baseline.**
What does YouTube show on your homepage? Record the first 10 recommended videos. These are "cold start" recommendations -- popularity-based suggestions because the system has no personalization signal.

**Step 3: Deliberately train it.**
Pick ONE topic. For example, data visualization. Search for "data visualization techniques" and watch 5 related videos ALL the way through. Don't skip. Don't consume anything else.

## Day 2: Measure the Shift

Open YouTube. DON'T search for anything. Just examine your homepage.

Record the first 10 recommended videos. How many relate to data visualization? How many are unrelated?

Now watch 5 MORE videos on your chosen topic. But this time, also watch 2 videos on a completely different subject -- say, architecture or travel photography.

## Day 3: Final Assessment

Open YouTube again. Check your homepage. Record the top 10 recommendations.

**Questions to analyze:**
- How many topic-relevant videos are recommended now compared to Day 1?
- Did the 2 off-topic videos create visible contamination in your feed?
- How many interactions did the system need to "converge" on your interest?

## What You'll Likely Observe

Most people discover that it only takes about **5-10 interactions** for YouTube to begin personalizing aggressively. That's remarkably fast convergence. You'll also notice that the system tends to overreact to novel signals -- those 2 off-topic videos may generate disproportionate representation in your feed, a phenomenon known as **exploration-exploitation imbalance**.

**Bonus experiment:** Run the same protocol in parallel with a colleague, using the same topic and same videos. Do you both get the same recommendations? Almost certainly not -- because the system also incorporates HOW you consume (dwell time, what you click next, scroll behavior), not just WHAT you consume. This demonstrates that personalization is multi-dimensional, not simply topic-based.

**Extended observation:** Keep a log for a week. Each day, record your top 3 recommendations. Track how they evolve as your behavior changes. You're observing the algorithm's learning curve in real time -- and developing an intuitive understanding of concepts like recency bias and temporal decay that underpin production recommender systems.
