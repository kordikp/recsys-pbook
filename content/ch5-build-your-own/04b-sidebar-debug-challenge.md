---
id: ch5-debug
type: spine
title: "Debug Challenge!"
readingTime: 1
standalone: true
teaser: "Your prediction was wrong. Can you figure out why? Welcome to debugging a recommender."
voice: creator
parent: null
diagram: null
---

Your recommendation system just made a prediction: your friend **Sam** would rate the movie *Frozen* 4 out of 5 stars. Seems reasonable -- Sam's taste twin loved it, and Sam likes animated movies.

But then Sam actually watched it. The real rating? **2 stars.** Ouch.

Your system was wrong. But WHY? This is where debugging gets fun. Let's investigate.

## The Suspects

**Suspect A: The taste twin wasn't actually that similar.**
Maybe Sam and the taste twin agreed on 3 movies, but those were all action movies. For animated movies, they have totally different opinions. Similar in one area doesn't mean similar in all areas.

**Suspect B: Sam already watched it.**
Maybe Sam saw Frozen years ago and was bored rewatching it. The system didn't know about that older viewing. A repeat watch is very different from a first watch.

**Suspect C: Wrong movie, right franchise.**
What if your data said "Frozen" but Sam actually watched *Frozen 2*? Sequels are tricky -- loving the original doesn't guarantee loving the sequel. And a recommendation system that mixes up movies in a series has a data quality problem.

**Suspect D: Bad timing.**
Maybe Sam was in a terrible mood that day. Had a fight with a friend. Wasn't in the mindset for a cheerful animated movie. Recommendations can't predict how you FEEL right now.

## The Verdict

Here's the truth: **ALL of these are real problems in recommendation systems.** Engineers call the gap between predictions and reality **prediction error**. And every system has some.

The goal isn't to be perfect. It's to be right MOST of the time. Even Netflix's best algorithm is wrong about 20-30% of the time. That's totally normal.

## Your Turn

Think about the last time an app recommended something you didn't like. Which suspect do you think was responsible? Was it a bad taste match, old data, a mix-up, or just bad timing?

Being a good debugger means asking "why was I wrong?" instead of just saying "that was wrong." That's how real engineers make systems better -- one mistake at a time.
