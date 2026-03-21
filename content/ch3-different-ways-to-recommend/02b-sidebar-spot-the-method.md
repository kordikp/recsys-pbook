---
id: ch3-spot-method
type: spine
title: "Spot the Method!"
readingTime: 1
standalone: true
teaser: "Collaborative filtering, content-based, or popularity? Can you tell them apart in the wild?"
voice: explorer
parent: null
diagram: null
---

Now that you know the three main recommendation methods, let's see if you can spot them out in the wild. Match each real-world example to the right method:

- **CF** = Collaborative Filtering (based on what similar people liked)
- **CB** = Content-Based (based on the features of the item itself)
- **POP** = Popularity (based on what's trending or most-viewed)

Write down your guesses, then check!

## The Examples

**1.** YouTube's "Trending" page

**2.** Netflix says: "Because you watched Stranger Things..."

**3.** Spotify says: "Fans of Taylor Swift also listen to..."

**4.** The App Store's "Top Free Games" chart

**5.** Amazon shows "Similar items" with matching features

---

## Answers

**1. POP!** The trending page is pure popularity. It shows what the MOST people are watching right now. It doesn't care what YOU like.

**2. CB!** "Because you watched Stranger Things" means the system looked at what Stranger Things IS -- sci-fi, mystery, teens, 1980s setting -- and found other shows with similar features. It's matching the content, not the people.

**3. CF!** "Fans of Taylor Swift ALSO listen to..." is textbook collaborative filtering. It found people who like the same artist as you and checked what else they listen to. People-to-people matching.

**4. POP!** "Top Free Games" is a straight-up popularity chart. Most downloads wins. No personalization at all.

**5. CB!** "Similar items" looks at the features of the product -- category, specs, description, price range -- and finds other items that match. It's comparing things to things.

## How Did You Do?

- 5/5: You have X-ray vision for recommendation methods
- 3-4/5: Solid! The tricky ones are 2 and 3 -- they sound similar but work totally differently
- 0-2/5: Go back and re-read the three methods, then try again. You'll nail it the second time

## Your Turn

Open any app right now and look for a recommendation. Can you figure out which method is behind it? Some might be a mix of two or even all three!
