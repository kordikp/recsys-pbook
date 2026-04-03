---
id: ch6-privacy-real
type: spine
title: "Your Data: What They Actually Know"
readingTime: 4
standalone: true
core: true
teaser: "Skip the vague privacy warnings. Here is exactly what platforms collect, how they model you, and why re-identification is easier than you think."
voice: universal
parent: null
diagram: null
recallQ: "What is a \"digital twin\" in the context of recommender systems?"
recallA: "A mathematical model of your behavioral patterns — platforms construct one from your interaction data without necessarily needing your real identity."
status: accepted
---

Privacy advice often amounts to vague warnings: "be careful with your data online." That is well-intentioned but unhelpful without specifics. So let's be precise about what platforms actually collect.

**What YouTube/Google knows about you:**
Every video you have ever watched. Watch duration for each one. Every search query. Every click and every skip. Time-of-day activity patterns. Device type and operating system. Approximate location (via IP and, if permitted, GPS). Ad interactions. Scroll velocity and pause patterns. Cross-service data from Gmail, Maps, Search, and Android if you use a Google account.

**What TikTok knows about you:**
Every video you watched. Every video you *skipped* (and the latency before skipping). Videos you rewatched. Dwell time on each video before scrolling past. Audio and music preferences. Visual style preferences. Typing cadence when commenting. Biometric data (face and voice) if you have posted videos. Device identifiers, keystroke dynamics, and clipboard contents (documented in their privacy policy).

**What Spotify knows about you:**
Every track you have played. Skip latency in seconds. Listening patterns correlated with time of day and inferred mood (yes, their models distinguish these). Workout timing. Sleep patterns. Podcast consumption including which segments you rewind or skip.

All of this data feeds a **behavioral model** -- essentially a digital twin. It is a mathematical representation of your preferences, habits, and predicted future actions. It does not necessarily know your legal name. But here is the critical point about **re-identification risk**: researchers have demonstrated that as few as four spatio-temporal data points can uniquely identify 95% of individuals in a dataset of 1.5 million people (de Montjoye et al., 2013). Your behavioral fingerprint -- the combination of when you are active, what you consume, and how you interact -- is often more uniquely identifying than your name.

**Cross-device tracking** compounds this further. Data brokers like Acxiom, Oracle Data Cloud, and LiveRamp specialize in linking your phone activity, laptop browsing, smart TV viewing, and in-store purchases into a unified profile. Even if you use different accounts or devices, probabilistic matching techniques (based on IP addresses, location patterns, and behavioral similarity) can reconnect these fragments.

Is this "surveillance"? The legal answer depends on jurisdiction. Under GDPR, much of this data constitutes personal data and requires explicit consent and a lawful basis for processing. Under CCPA, consumers have the right to know what is collected and to opt out of its sale. In practice, consent is obtained through terms-of-service agreements that fewer than 1% of users actually read (McDonald & Cranor, 2008).

**The real question is not whether platforms collect data** -- of course they do; that is how recommendation systems function. The question is: **are you aware of the scope of what is collected? Do you understand how it can be aggregated and re-identified? And have you made an informed decision about whether the value you receive justifies the data you provide?**

If you could not answer those questions before reading this page, that is a systemic problem -- not a personal failing, but a failure of transparency and informed consent design.
