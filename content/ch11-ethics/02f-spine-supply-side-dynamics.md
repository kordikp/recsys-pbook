---
id: supply-side-dynamics
type: spine
title: "Recommenders Shape What Gets Made"
readingTime: 3
standalone: true
core: false
teaser: "A ranking objective is a job ad read by every creator on the platform. Change it, and six months later the catalog looks different."
parent: null
diagram: diagram-supply-loop
recallQ: "How can a recommender's objective change the catalog itself over time?"
recallA: "Creators and sellers learn what the ranking rewards and make more of it. An engagement-only objective breeds look-alike or bait content, starves newcomers of an audience and invites mass-produced AI uploads. Objectives and guardrails that include newcomer exposure, diversity and satisfaction, tracked with supply-health metrics such as creator retention and concentration, keep the supply varied and healthy."
highlights:
  - "Creators and sellers adapt to whatever the ranking rewards, so the objective shapes the future catalog"
  - "Engagement-only ranking homogenizes content and makes mass-produced AI uploads a cheap lottery ticket"
  - "Track supply health next to user metrics: newcomer exposure, creator retention, concentration"
  - "Levers: exposure budgets for newcomers, diversity re-ranking, rewarding satisfaction and originality, filtering or labelling mass uploads"
status: draft
concept: supply-side-dynamics
conceptTitle: "Recommenders shape supply"
parents: objectives|fairness|long-tail|item-cold-start
state: edited
lens: media
lang: en
depth: intro..standard
formalism: none
visuality: balanced
lengthBand: deep
genre: explainer
carriers: prose|diagram
---

A music app (call it Loop) ranks its "New for you" shelf by one number: how many listeners **don't skip** a track in its first 30 seconds. Sensible, since a skip means "not for me". Six months later the team notices that new songs have stopped having intros. Vocals start at second one, the chorus arrives by second ten, and many new releases sound alike.

Nobody ordered that. Artists noticed which of their songs got pushed, and made more songs like those.

Loop is invented; the drift is not. Across 303 top-10 hits from 1986 to 2015, the average intro shrank from over 20 seconds to about 5, a trend the researcher links partly to listening where skipping costs nothing.

**The loop.** A recommender doesn't only pick from the catalog; it pays the people who fill it. Creators, artists and sellers (together, the **supply side**) earn plays, followers and money from exposure, so they study what the ranking rewards and copy what wins. The catalog drifts toward the winning format, and the recommender then learns from that narrower catalog. The rule you write for listeners becomes a brief for everyone who makes things for your platform.

**The flood.** Generative AI made producing a track almost free, so an engagement-only ranking turns into a lottery: upload thousands of tracks, and a few will catch on. In April 2026, the streaming service Deezer reported that about **44% of its daily uploads**, almost 75,000 tracks a day, were fully AI-generated. Those tracks drew only 1–3% of all streams, and Deezer said up to 85% of their streams in 2025 were fraudulent. Deezer's response works through the recommender: detected AI tracks are tagged, removed from algorithmic recommendations and left out of editorial playlists. Spotify reported removing over 75 million "spammy" tracks in the twelve months before September 2025 and announced a spam filter that flags mass uploads and duplicates and stops recommending them.

**The newcomers.** A brand-new artist has no listening history, so the ranking has nothing to go on (the [item cold start](#c/item-cold-start) problem). If nobody hears their first releases, many give up, and next year's catalog has fewer fresh voices. Mladenov and colleagues modelled this in 2020: when creators need a minimum audience to keep going, a recommender that serves each user's best match in the moment can push viable creators off the platform and leave users worse off in the long run.

**Measure the supply, not just the users.** Next to clicks and listening time, track a few **supply-health metrics**:

- **Newcomer exposure**: the share of recommendation slots shown to listeners that goes to creators who joined in the last 90 days.
- **Creator retention**: the share of new creators still publishing three months later.
- **Concentration**: the share of all plays taken by the top 1% of creators. If it keeps rising, the [long tail](#c/long-tail) is starving.

**Levers platform teams use:**

- An **exposure budget** for newcomers: a small, guaranteed slice of slots for new creators, a deliberate bet on the unknown (the [explore–exploit](#c/explore-exploit) trade-off).
- **Diversity re-ranking**: after scoring, reshuffle the list so that one sound or one creator can't take every slot (see [diversity](#c/filter-bubbles)).
- **Reward satisfaction and originality**, not raw engagement: saves, return listens and "more like this" over the first-30-seconds count; near-duplicates get no extra reach.
- **Filter, label or down-rank mass uploads**, as Deezer and Spotify do, and say publicly what you reward.

Before you change a ranking objective, ask one more question besides "will users click more?": **what will creators make more of once they notice?**

**Sources:**
- Deezer Newsroom (20 April 2026). AI-generated tracks now represent 44% of all new uploaded music. https://newsroom-deezer.com/2026/04/ai-generated-tracks-represent-44-of-new-uploaded-music/
- Spotify Newsroom (25 September 2025). Announcement of AI protections: spam filter, impersonation policy, AI disclosures. https://newsroom.spotify.com/2025-09-25/spotify-strengthens-ai-protections/
- Mladenov, M., Creager, E., Ben-Porat, O., Swersky, K., Zemel, R. & Boutilier, C. (2020). Optimizing Long-term Social Welfare in Recommender Systems: A Constrained Matching Approach. https://arxiv.org/abs/2008.00104
- Léveillé Gauvin, H. (2018). Drawing listener attention in popular music: Testing five musical features arising from the theory of attention economy. *Musicae Scientiae* 22(3). https://doi.org/10.1177/1029864917698010 (summary: https://news.osu.edu/has-music-streaming-killed-the-instrumental-intro/)
