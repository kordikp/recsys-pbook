---
id: item-cold-start-jobs
type: spine
title: "Worked Example: A Job Posting's Cold Start"
readingTime: 3
standalone: true
core: false
teaser: "Step through one real-ish posting: from publish to first application, decision by decision."
voice: creator
parent: item-cold-start
recallQ: "Why is exploration budget especially critical on a job board?"
recallA: "Postings expire in weeks, so there is no time to wait for organic clicks; a large share of the catalog is always cold, and every posting needs fair early exposure to matching candidates before it dies."
status: accepted
concept: item-cold-start
state: edited
lens: jobs
lang: en
visuality: text-first
depth: standard..technical
formalism: none
lengthBand: standard
genre: worked-example
carriers: prose
---

Let's walk one posting through its first day, decision by decision. Job boards are the extreme case of item cold start: **postings expire in weeks**, so the newest items are always the ones that matter most — and always the ones with zero behavioral data.

**09:00 — publish.** *Data Engineer, Brno, hybrid. Requirements: SQL, Python, ETL.* Interactions so far: none. Click-based ranking would bury it on page nine.

**09:01 — content matching.** The board parses requirements into a skill vector and compares it against candidate profiles (their listed skills, past applications, viewed postings). Candidate A (*SQL, Python*) scores high; candidate B (*ETL, Python*) scores high; candidate C (*graphic design*) scores near zero. No clicks were needed — this is matching by **what the posting is**, mirrored against **what the candidates are**.

**09:30 — exploration slice.** The posting enters the "new for you" strip of candidates A and B and a few hundred lookalikes. The budget is deliberately bounded: a mis-parsed posting shouldn't spam half the user base. Early **views and saves** are watched as a live health check.

**11:00 — first application.** Candidate B applies. One application is worth hundreds of impressions: it confirms the skill-match hypothesis *and* creates the first co-behavior ("candidates who applied here also applied to…").

**Day 3 — behavioral lift-off.** Applications and views now let collaborative signals refine the audience — surfacing candidates whose skills never mentioned ETL but whose behavior matches those who did apply.

**The takeaway for builders:** on short-lived catalogs, cold-start handling *is* the recommender. Get the content matching and the exploration budget right, or most of your catalog dies unseen.
