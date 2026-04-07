---
id: ch7-steerable
type: spine
title: "Steerable Recommendations: Giving Users the Controls"
readingTime: 3
standalone: true
core: true
teaser: "What if you could tell the algorithm 'more of this, less of that' — not by fighting it, but by turning its own knobs?"
voice: universal
parent: null
diagram: null
recallQ: "What is a steerable recommendation system and how does it differ from a traditional one?"
recallA: "A steerable system exposes interpretable controls (knobs) that let users and editors adjust recommendation behavior without retraining. Traditional systems are black boxes where only the algorithm decides."
highlights:
  - "Steerability transforms the user-algorithm relationship from passive to collaborative"
  - "SAE-based knobs work because sparse neurons naturally align with semantic concepts"
  - "Rabbit holes can be detected by monitoring neuron concentration and gently diversified"
publishedAt: "2026-04-07"
status: accepted
---

The dominant paradigm in recommendation is **opaque optimization**: the algorithm observes your behavior, builds a model, and serves results. You can like, dislike, or "not interested" — but these are blunt instruments. You can't say "I liked this movie for the cinematography, not the genre" or "I'm in a different mood today."

**Steerable recommendations** change this dynamic. Instead of a black box, the system exposes interpretable controls — knobs, sliders, toggles — that let you adjust what the algorithm emphasizes.

## From Black Box to Control Panel

Recent [research from Recombee and Charles University](https://www.recombee.com/research-publications) demonstrates that sparse autoencoders (SAEs) can disentangle the dense internal representations of collaborative filtering models into interpretable "knobs." Each knob corresponds to a concept the model has learned: a genre, a director, a mood, a style.

The breakthrough: **these concepts emerge without labels.** The model discovers that "Quentin Tarantino" is a meaningful concept purely from user behavior patterns — not because anyone told it about Tarantino. When you add a sparse layer, these latent concepts separate into individual, controllable neurons.

## Three Levels of Steering

**Level 1: User control.** The system shows users which concepts it thinks they care about and lets them adjust. "The algorithm detected you're interested in: sci-fi (high), documentaries (medium), horror (low). Adjust?" This is more nuanced than a genre filter — it's adjusting the algorithm's internal weighting.

**Level 2: Contextual steering.** The user can temporarily shift the knobs without permanently changing their profile. "Date night mode" boosts romantic and critically-acclaimed neurons for one session. "Focus mode" boosts educational content and suppresses entertainment. The permanent profile remains unchanged.

**Level 3: Editorial steering.** Editors and product teams can boost specific neurons for campaigns — "Essential Directors Month" activates director-specific neurons differently for each user, creating personalized editorial promotions rather than one-size-fits-all featured lists.

## Exiting the Rabbit Hole

The most impactful application of steerability is **rabbit hole detection and exit.** Filter bubbles form because recommendation algorithms reinforce existing patterns. Steerable systems can break this cycle:

**Detection:** Monitor how concentrated a user's active neurons are. If a user who previously had 15 active concept neurons has narrowed to 5, they're entering a rabbit hole. The concentration is measurable — no subjective judgment needed.

**Gentle exit:** Instead of injecting random diverse content (which feels jarring and gets dismissed), boost neurons that are *adjacent* to the user's active interests. The system knows which concepts are semantically related — a true crime enthusiast might respond to investigative journalism, legal thrillers, or psychology. These feel like natural expansions, not algorithmic interventions.

**User agency:** Crucially, show users what's happening. "We noticed your recommendations have been narrowing. Here are some related areas you might enjoy." Give them the choice — don't force diversification, offer it.

## Why This Matters for Regulation

The EU's [Digital Services Act](https://www.recombee.com/blog/shield-the-universal-framework-making-ai-search-safer-for-everyone) mandates that platforms offer recommendation options not based on profiling. Steerable recommendations provide a better solution than the binary "personalized vs. chronological" switch: they give users **granular control** over how personalization works, rather than an all-or-nothing choice.

A recommendation system with visible, adjustable knobs is inherently more transparent than one that simply says "personalized for you." Users can see *how* it's personalized and change what they don't like.

## Connection to Explainability

Steerability and explainability are deeply connected. A system with interpretable knobs is automatically explainable: "We recommended this because your 'psychological thriller' knob is active and this item strongly activates that concept." The explanation isn't a post-hoc justification — it's a direct reading of the system's internal state.

For the full technical details of SAE-based steering, see the [research chapter on knobs](ch13-knobs).

**Consider this:** Most debates about recommendation algorithms frame the choice as "more algorithmic vs. less algorithmic." Steerable recommendations suggest a third option: **better algorithmic** — systems where the algorithm's power is preserved but its direction is shared between the system and the user. The algorithm knows patterns across millions of users; you know what you want right now. Combining both should produce better results than either alone.