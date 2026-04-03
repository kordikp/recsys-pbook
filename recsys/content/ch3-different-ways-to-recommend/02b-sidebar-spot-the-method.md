---
id: ch3-spot-method
type: spine
title: "Spot the Method"
readingTime: 1
standalone: true
teaser: "Collaborative filtering, content-based, or popularity? Can you identify them in production systems?"
voice: explorer
parent: null
diagram: null
recallQ: "\"Because you watched X\" uses which method?"
recallA: "\"Fans also listen to\" is collaborative filtering. \"Because you watched\" is content-based!"
highlights:
  - "'Trending' = popularity-based. 'Because you watched' = content-based"
  - "'Fans also listen to' = collaborative filtering"
  - "Production systems layer multiple methods in a single recommendation"
status: accepted
---

Now that you understand the three primary recommendation paradigms, let's see if you can identify them in real-world systems. Match each example to the correct method:

- **CF** = Collaborative Filtering (based on similar users' behavior)
- **CB** = Content-Based (based on item features and attributes)
- **POP** = Popularity (based on aggregate engagement metrics)

Write down your answers, then check.

## The Examples

**1.** YouTube's "Trending" page

**2.** Netflix says: "Because you watched Stranger Things..."

**3.** Spotify says: "Fans of Radiohead also listen to..."

**4.** The App Store's "Top Free Apps" chart

**5.** Amazon shows "Similar items" with matching specifications

---

## Answers

**1. POP.** The trending page is pure popularity ranking. It surfaces what the MOST users are engaging with right now. It doesn't consider your individual preferences.

**2. CB.** "Because you watched Stranger Things" means the system analyzed what Stranger Things IS -- sci-fi, mystery, ensemble cast, 1980s setting -- and found other shows with similar feature profiles. It's matching content attributes, not user behavior.

**3. CF.** "Fans of Radiohead ALSO listen to..." is textbook collaborative filtering. The system identified users who share your artist preferences and checked what else they consume. User-to-user behavioral matching.

**4. POP.** "Top Free Apps" is a straightforward popularity ranking. Most downloads wins. No personalization whatsoever.

**5. CB.** "Similar items" analyzes the product's features -- category, specifications, description, price range -- and finds other items with similar attribute vectors. Item-to-item feature matching.

## How Did You Do?

- 5/5: You have a clear mental model of recommendation paradigms
- 3-4/5: Solid. The distinction between 2 and 3 is the trickiest -- they sound similar but operate on fundamentally different signals
- 0-2/5: Revisit the three methods and try again. The key discriminator is the signal source: item features vs. user behavior vs. aggregate metrics

## Your Turn

Open any application and examine a recommendation surface. Can you identify which method is driving it? In practice, many are hybrid systems blending two or all three approaches simultaneously.
