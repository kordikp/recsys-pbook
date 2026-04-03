---
id: ch2-guess-signal
type: spine
title: "Exercise: Strong Signal or Weak Signal?"
readingTime: 1
standalone: true
teaser: "Not all interactions carry equal weight. Can you rank them the way the algorithm does?"
voice: explorer
parent: null
diagram: null
recallQ: "What is the strongest signal you can send to an algorithm?"
recallA: "Sharing content with someone. It requires deliberate effort, which tells the system you genuinely value that content."
status: accepted
---

Every action you take online sends a signal to the recommendation system. But not all signals are equal. Some clearly indicate strong preference, while others are ambiguous noise.

**The exercise:** For each action below, determine whether it sends a **STRONG signal** (the system can make a confident inference) or a **WEAK signal** (the action is ambiguous and could mean many things).

Form your answers, then check below.

1. You read an article all the way to the end
2. You click a headline but bounce after 2 seconds
3. You search for "best CRM tools for small business"
4. You scroll past a post without engaging
5. You revisit the same report 3 times over a week
6. You forward an article to a colleague

---

## Answers

1. **STRONG.** Reading to the end is a clear indicator of engagement. The system treats completion as a high-confidence positive signal.

2. **WEAK.** You clicked (that registers), but left almost instantly. Was the headline misleading? Was the content poor quality? Were you interrupted by a meeting? The system genuinely cannot differentiate between these scenarios.

3. **VERY STRONG.** A search query is one of the highest-fidelity signals you can generate. You explicitly articulated what you want in your own words. This is why search data is among the most valuable behavioral data in the industry.

4. **VERY WEAK.** Did you skip it because it was irrelevant? Or did you simply not notice it amid the feed? The system cannot reliably distinguish between these cases -- which is why impression-only data is notoriously noisy.

5. **VERY STRONG.** Viewing something once might be casual interest. Returning to it three times signals genuine utility or deep engagement. The system assigns high confidence here.

6. **STRONGEST.** Sharing requires deliberate effort and social risk -- you're attaching your reputation to this content by recommending it to someone else. This is the ultimate signal of endorsement.

## The Pattern

Notice the theme? Actions that require **more deliberate effort** and **higher personal investment** tend to be stronger signals. Scrolling is passive. Searching, revisiting, sharing -- those are intentional behaviors. Recommender systems are engineered to weight signals accordingly, which is why engagement metrics in industry always prioritize depth over breadth of interaction.
