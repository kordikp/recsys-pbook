---
id: ch3-speed
type: spine
title: "Mind-Blowing Math!"
readingTime: 1
standalone: true
teaser: "800 million videos. 0.2 seconds. The numbers behind YouTube recommendations are absolutely wild."
voice: thinker
parent: null
diagram: null
recallQ: "How long would it take a human to do what YouTube does in 1 second?"
recallA: "25 YEARS! That's why we need algorithms — the scale is impossibly large for humans."
status: accepted
---

Let's talk about just how INSANE the numbers are behind a real recommendation system. We'll use YouTube as our example.

## The Setup

YouTube has about **800 million videos**. When you open the app, the recommendation system needs to:

1. Look through ALL 800 million videos
2. Pick the best ~500 candidates for YOU specifically
3. Rank those 500 by how likely you are to watch each one
4. Remove videos you've already seen
5. Mix in some variety so you don't get bored
6. Arrange everything into a nice feed

**Total time allowed:** less than **200 milliseconds**. That's 0.2 seconds. That's faster than you can blink. (A blink takes about 300-400 milliseconds. Seriously.)

## Let's Put That In Perspective

In the time it took you to read this sentence, YouTube could have generated personalized recommendations for about **10,000 different people**. All unique. All tailored.

If a human librarian tried to do what YouTube does for ONE person -- flipping through 800 million videos and picking the best 20 -- and they could review one video per second without any breaks, it would take them **25 YEARS**.

YouTube does it in the time it takes you to not-quite-blink.

## How Is This Possible?

The pipeline! Remember the three stages? The system doesn't actually look carefully at all 800 million videos. It uses quick, rough filters first (Stage 1: retrieval) to chop the list down from millions to thousands. Then smarter, slower methods (Stage 2: scoring) examine those thousands. Finally, the very smartest -- and slowest -- logic (Stage 3: re-ranking) only has to handle a few hundred.

It's like finding a needle in a haystack by first getting rid of 99% of the hay.

## One More Number

YouTube serves over **1 billion hours** of recommended video every single day. One billion hours. That's more than 100,000 years of video -- served up fresh every 24 hours. Most of it chosen by an algorithm, not searched for by humans.

The next time your app takes a second to load recommendations, don't be annoyed. Be amazed it works at all.
