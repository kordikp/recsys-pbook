---
id: cf-jobs-example
type: spine
title: "Hiring Patterns: CF on a Job Board"
readingTime: 3
standalone: true
core: false
teaser: "No keywords in common, yet the right candidates surface — collaborative filtering on hiring behavior."
voice: creator
parent: collaborative-filtering
recallQ: "How does collaborative filtering work?"
recallA: "Find people with similar taste → recommend what THEY liked that you haven't tried yet."
status: accepted
concept: collaborative-filtering
state: edited
lens: jobs
lang: en
visuality: balanced
depth: standard..technical
formalism: none
lengthBand: standard
genre: worked-example
carriers: prose|table
---

A recruiter at a logistics company posts a job: *"Operations Analyst."* Watch what collaborative filtering does with it — using nothing but behavior.

**Step 1 — who engaged.** In the first two days, 40 candidates click the posting; 12 apply. The system doesn't read their CVs. It looks at what else those 12 applied to.

**Step 2 — find the pattern.** It turns out the same people also applied to:

| Also applied to | Overlap |
|---|---|
| Supply Chain Coordinator | 7 of 12 |
| Data Analyst (retail) | 6 of 12 |
| Warehouse Shift Planner | 4 of 12 |
| Graphic Designer | 0 of 12 |

No taxonomy said these jobs are related. The applicants' behavior did.

**Step 3 — recommend both ways.** Now two recommendations fall out for free. Candidates who applied to *Supply Chain Coordinator* but haven't seen this posting? Show it to them — their peers already voted with their applications. And the recruiter gets the mirror image: "candidates similar to your applicants."

The punchline is what's missing: nobody defined "operations" as a skill cluster, and the word *logistics* appears nowhere in half those postings. **Co-application is the signal.** People who choose alike, fit alike — the same principle that links movies on Netflix links careers on a job board.

One honest caveat: hiring has fairness constraints entertainment doesn't. Pure behavioral matching can inherit yesterday's biases (if one group never applied, they never enter the pattern), so production job boards blend CF with skills-based features and audited exposure rules.
