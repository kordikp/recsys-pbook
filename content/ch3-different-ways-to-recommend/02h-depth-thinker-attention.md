---
id: ch3-attention
type: spine
title: "Self-Attention: Not All Clicks Matter Equally"
readingTime: 3
standalone: false
teaser: "Why the movie you watched yesterday matters more than the one from 3 months ago — and how transformers learn which history to focus on."
voice: thinker
parent: null
diagram: diagram-attention
core: false
recallQ: "Why doesn't a recommender treat all your past interactions equally?"
recallA: "Recent interactions and interactions that match your current mood/context are much more relevant. Self-attention lets the model learn which past items to focus on and which to ignore."
status: accepted
---

You've watched 500 videos this year. When YouTube picks what to show you next, should it care equally about all 500? Obviously not — the cooking show you watched 3 months ago is way less relevant than the sci-fi movie you watched yesterday.

## The Problem with Simple History

Basic recommenders treat your history like a shopping list — everything counts equally. Watched a horror movie once in October? You'll keep getting horror recommendations in March. Binge-watched cooking shows while sick? The algorithm thinks you've changed careers.

## Attention: Learning What to Focus On

**Self-attention** (the core idea behind transformers — the same tech behind ChatGPT!) solves this by asking: "For THIS moment, which past interactions actually matter?"

The model assigns an **attention weight** to each item in your history:

- 🟢 **High weight**: Recent items, items similar to what you're browsing now, items you spent a long time on
- 🔴 **Low weight**: Old items, random one-off clicks, items from a different context (like that cooking phase)

## How It Works (Simplified)

1. Each item in your history becomes a vector (an embedding — remember those?)
2. The current context (time, device, what you just watched) also becomes a vector
3. The model computes a **similarity score** between the context and each historical item
4. Items with high similarity get high attention weights
5. The final recommendation is based on the **weighted combination** — recent, relevant items matter most

## Why This Is Revolutionary

Before attention, systems used your ENTIRE history equally, or just your last 10 items. Attention lets the model be surgical — focus on the 5 items from your history that actually predict what you want RIGHT NOW, and ignore the other 495.

This is why recommendations feel smarter than they used to. The system isn't just looking at what you watched — it's learning WHICH things you watched are relevant for this exact moment.

## The Real-World Impact

- **YouTube**: Your weekend watch history (relaxing content) gets different attention weights than weekday history (educational)
- **Spotify**: Monday morning music preferences get less weight on Friday night
- **TikTok**: The app learns that your scrolling pattern at 8am is completely different from 11pm
