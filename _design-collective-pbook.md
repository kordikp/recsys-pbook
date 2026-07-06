# Design Spec — Collective, Self-Personalizing p-book (v3)

> Status: **DRAFT for discussion.** Author: Pavel + Claude.
> v3 changes vs v2: `domain` facet redefined as **lens** (example world); generation is **segment-scoped, never per-individual**; a crisp **retrieve-before-generate trigger** (reader pulls, system nudges); **share-gate catalog economics** ("infinite content ⇒ nothing is popular"); 4-rung lifecycle ladder (private → community → edited → core); progressive reader profiling.

## 0. The shift in one paragraph

We stop shipping a fixed book with modes and start shipping a **living, collectively-enriched knowledge base that personalizes itself with the very techniques it teaches.** Content decomposes into **concepts** (what must be learned — human-anchored contracts) and **renderings** (how it's told — a point in a small facet space). A recommender learns each reader's facet affinities and *selects* renderings; readers can *steer* the telling (more visual, through e-commerce examples, deeper) and — when the catalog genuinely lacks that variant — trigger generation of a new one. Generated content starts **private**; only content its creator liked and chose to share enters the community catalog; only community content with proven multi-reader appeal earns editor time; only verified, contract-anchored content enters **core** (and the certificate). Editorial labor follows demand ("lazy redakce"), git stays the source of truth, Pavel is the global arbiter.

## 1. First principles (the five hard rules)

1. **Personalization selects; generation extends the catalog.** A generated block is written for a *segment* (everyone who steered to that facet combination), never addressed to one individual. No "since you liked X…" in content — that lives in the recommender, not in the text.
2. **Existing content has right of first refusal.** Before generating, the system always tries to satisfy the steering request from the catalog. Generation fires only on a genuine gap.
3. **The reader pulls the trigger.** The system may nudge ("want this more visual?"), but new content is created only on an explicit reader action. No autonomous speculative publishing.
4. **The shared catalog grows only through human approval.** Private → community requires the creator's like + consent. Community → edited requires an editor. Edited → core requires the arbiter. Every rung has a human gate.
5. **Core stays small, verified, contract-anchored.** The certificate reads only core. Quality content can live outside core forever — core admission is a pedagogical decision, not a quality reward.

## 2. Core data model

### 2.1 Concept — the invariant (human-anchored)

What must be understood, independent of how it's told. Owns the **contract** — the factual/pedagogical guardrail every rendering must satisfy.

```yaml
concept: cold-start
title: "Cold Start"
provenance: anchored        # anchored | derived | provisional   (see §9)
parents: [recommendation-basics]      # concept graph for prerequisite ordering
contract:
  objective: "Reader can explain why a system with no history struggles, and name two mitigations."
  mustCover:
    - { point: "No interactions → no collaborative signal", modality: prose }
    - { point: "Content/metadata bridges new items", modality: prose }
    - { point: "Onboarding/exploration bridges new users", modality: diagram }
  recallQ: "Why can't collaborative filtering help a brand-new user, and what can?"
  recallA: "No interactions means no co-occurrence patterns; content features and onboarding/exploration bridge the gap until behavioural signal accrues."
  forbidden: ["invented benchmark numbers", "claiming one method 'solves' cold start"]
```

### 2.2 Block (rendering) — concept × facet-vector, materialized

```yaml
id: cold-start__lens-ecommerce__vis-visual__depth-standard
concept: cold-start
facets: { lens: ecommerce, visuality: visual-first, depth: standard, formalism: none, length: standard }
state: community            # private | community | edited | core | archived   (§7)
provenance: { generatedFor: <facet-vector>, triggeredBy: reader-xyz, sharedAs: "Anna K." | anonymous,
              adoptedBy: null, commit: null }
signals: { distinctReaders: 14, completion: 0.72, likes: 9, flags: 0, explorationLeft: 12 }
```

A concept has a **pool** of blocks, never a full cross-product. The facet-vector is simultaneously the recommender's feature vector, the generator's spec, and the **cache key** (same request by two readers = same block — this is what makes generation segment-scoped and cheap).

### 2.3 Storage split (keep git clean)

- `content/` — `edited` + `core`. Git-tracked, human-gated, attributed via commits.
- **generation store** (Blob/KV, outside git) — `private` and `community` blocks + their signals. **Adoption = editor commits the block into `content/`.** Popular content graduates into the repo; the long tail never pollutes history.

## 3. Facet system v3

Facets describe **how a recsys concept is told — never what is taught.** Every facet must pass this test: *"Can I state in one sentence what changes in the text when this value changes?"* (v2's `domain: shopping` failed it; fixed below.)

### Tier 1 — Authored facets (controlled vocabulary; schema changes are arbiter-only)

**Primary knobs (the steering UI leads with these three):**

| Facet | One-sentence semantics | Values (launch) |
|---|---|---|
| `lens` | **The example world** — which platform-reality all examples, scenarios and metaphors are drawn from; the concept stays the same, the reader meets it where they live | generic · ecommerce · media (streaming) · social-feeds · education |
| `visuality` | **How much of the point is carried by pictures vs prose** — drives the modality budget (§8) | text-first · balanced · visual-first |
| `depth` | **Assumed background** — vocabulary, prerequisites, and how far past the intuition we go | intro · standard · technical · research |

**Secondary knobs (advanced panel, defaults derived from profile):**

| Facet | Semantics | Values |
|---|---|---|
| `formalism` | May formulas appear, and do they lead or follow | none · light · full |
| `length` | Reading budget | tldr · standard · deep |
| `genre` | Narrative container | explainer · story · worked-example · code-walkthrough |

**Validity rules** (prune illegal vectors from steering UI, generation and recommendation): `formalism: full ⇒ depth ≥ technical` · `genre: code-walkthrough ⇒ depth ≥ technical` · `depth: intro ⇒ formalism: none`.

**The same concept under different vectors** (cold start) — the sanity check that semantics are crisp:

| Vector | What the reader gets |
|---|---|
| ecommerce · visual-first · standard | Diagram: new e-shop customer, empty history, "customers also bought" has nothing to chew on; caption walks through onboarding picks |
| media · text-first · intro · story | Short story: first login to a music app, why it plays it safe with global hits, how three thumb-ups change everything |
| generic · balanced · research · formalism-full | Zero-shot framing, content-based bridging, beeFormer-style approaches; formulas lead |
| education · balanced · standard · worked-example | A teacher assigning exercises to a brand-new student — worked through step by step |

### Tier 2 — Derived tags (measured, never authored)

`has-formula` · `has-image` · `word-count-band` · `readability-band` · `est-reading-seconds`. Cheap, objective, and they **audit** Tier 1: a block claiming `formalism: none` measuring `has-formula: true` fails lint.

### Tier 3 — Emergent tags (long-tail, no schema gate)

`mentions-spotify`, `about-privacy`, `example-netflix-prize`… Added automatically or by contributors; the recommender exploits them only where signal exists. This is the safety valve that keeps Tier 1 small — a candidate value (e.g. `lens: dating`) lives here until demand proves it deserves promotion to Tier 1 (arbiter decision).

## 4. Reader profile — progressive, transparent, never a prerequisite

We know almost nothing about a new reader, and that's fine: defaults are `lens: generic, visuality: balanced, depth: standard`. The profile is built in three ways, in increasing strength:

1. **Onboarding (2–3 light questions, skippable):** "Where do you meet recommendations most — shopping, music/video, social feeds, school?" (→ seeds `lens`) · "What do you want from the book — understand / build / decide / protect myself?" (→ goal, drives defaults and mission suggestions) · persona/age band (→ **hard constraint**, see below).
2. **Interaction-derived affinities:** dwell, completion, skips, math-expands, which lens variants they choose from shelves. Continuous, reversible drift over facet affinities (stored as Recombee user properties + local UserModel).
3. **Explicit steering (strongest signal):** every use of the knobs is a labelled preference statement. A reader who twice asked for `visual-first` gets visual-first defaults everywhere.

**Profile anatomy:** *hard constraints* (persona/age, language, accessibility — filters, never recommended across) vs *learned affinities* (facet distribution — boosters) vs *stated goals* (onboarding — defaults + mission ranking).

**Transparency as pedagogy:** the profile view shows the learned affinities in plain words ("We think you like visual explanations through e-commerce examples — right?") and lets the reader correct them; a correction is itself a strong signal. A book about recommenders showing you your own preference model *is* a chapter of the book.

## 5. Steering UI & the generation trigger

The reader-facing control is a small **knobs panel** on every block — deliberately the same paradigm as the steerable-recommendations ("knobs") paper already featured in the book: the book about steerable recommenders is itself steered. Primary knobs: lens, visuality, depth (+ "different angle" shuffle). One-tap chips for the common moves: **🔽 simpler · 🔼 deeper · 🖼 more visual · 🛒 my world**.

**The trigger cascade (the "clear trigger" — generation is user-initiated AND catalog-miss-gated):**

```
onSteer(concept C, requested vector R, reader U):
  pool  = blocks(C) visible to U            # core + edited + community (+ U's own private)
  pool  = filter(pool, hardConstraints(U))  # persona, language, accessibility
  best  = argmax facetMatch(pool, R)

  if match(best) ≥ HIGH:    serve(best)                       # catalog wins — always first
  elif match(best) ≥ SOME:  serve(best)
                            + offer button "✨ Generate the exact variant (~30 s)"
  else:                     offer generate                     # genuine gap

  # generation NEVER fires without the explicit click
  # generated block lands PRIVATE to U (cache-keyed by (C, R) so the next
  # reader asking for the same thing gets the cached block, still as private-to-them)
```

**What the system may do on its own:** *nudge* (show a chip "Try this more visually?" when profile suggests it), *queue* (record unmet steering demand for editorial), and *cache-warm* (batch pre-generate cells with proven repeated demand so the button returns instantly). It may **not** publish anything into anyone's shared feed on its own.

## 6. Catalog economics — "infinite content ⇒ nothing is popular"

A recommender needs concentrated attention to learn; an unbounded catalog dilutes every signal. Discipline mechanisms:

1. **Private by default.** A generated block is visible only to its creator. It costs the shared catalog nothing.
2. **Share gate.** After reading, if the creator rates it positively, they're asked: *"Share this into the book for other readers?"* Only then does it become `community` — labelled, attributed ("enriched by Anna K." / anonymous). **This is how every reader can enrich the p-book** — and why the community catalog grows only with content at least one human valued.
3. **Exploration budget (bandits, dogfooded).** Each new community block gets a bounded exploration boost (~first N impressions to similar readers) to gather fair signal — then competes on merit.
4. **Per-cell caps.** Per (concept × lens) keep at most ~2 live community variants, per concept ~6; a new entrant must beat the weakest incumbent, which gets **archived** (creator keeps their copy; nothing is deleted). Leaderboard dynamics keep popularity signal dense.
5. **Retirement.** Community blocks that underperform after their exploration budget → archived. Flags demote immediately and raise review priority.
6. **Kid-safety gate.** Kid personas are locked to safe mode: they see only `edited`/`core`. Community content becomes visible to them only after human review.

**Reader modes** follow directly: **safe mode** = core + edited only; **open mode (yolo)** = + community layer + generation knobs. The recommender serves one blended, clearly-labelled feed in open mode — so readers discover not only verified content but also *what other readers had generated and shared*.

## 7. Lifecycle ladder & lazy redakce

```
private ──(creator like + share consent)──► community ──(traction: ≥K distinct readers positive
   │                                            │         → nomination queue → editor adopts,
   │                                            │           commits to git)──► edited ──(arbiter:
   │        (weak after exploration │ flags)    │             contract fit + certificate need)──► core
   └── stays creator-only            └──► archived (creator keeps a copy)
```

- **"Is it worth editing?" is answered by data, not taste:** editor time goes only to blocks with proven **breadth** — ≥K *distinct* readers with positive signal (breadth, not depth: one enthusiastic reader ≠ segment appeal). The nomination queue is ranked by distinct-reader traction × quality signals ÷ flags.
- **Adoption ≠ core.** An editor may adopt a community block into git as `edited` supplementary content — good content living happily outside core. Core admission is a separate, stricter, arbiter-gated step: contract-anchored, fills a pedagogical need in the certificate path, non-duplicative.
- **The recommender allocates editorial labor:** unmet steering demand (cache misses, "generate" clicks) and community traction both feed the same queue. This is collaborative filtering applied to *where redakce should go next* — the cross-product is never authored, only the proven cells.

## 8. Modality budget — what becomes text, image, animation, formula

Driven by the `visuality` facet + per-`mustCover` modality hints in the contract (§2.1):

- `visual-first` → lead with a diagram; prose is captions (≤150 words per point).
- `balanced` → prose leads; 1 diagram for the structural point.
- `text-first` → prose; formulas only if `formalism ≠ none`.

**Decision rule given to the generator:** *express a point as a formula if it's a precise relationship and formalism allows; as a diagram if it's structural/spatial; as animation/game only via an approved template; otherwise prose — always the cheapest modality that carries the point.*

**Rich-media ladder (risk-gated):** prose < formula < static SVG — all generatable on demand (validated). Animated SVG and games are **never free-generated**: the generator only fills data into vetted templates (exactly the existing `games/*.json` pattern — agent generates *data* for an approved game *type*).

## 9. Contract provenance (bounded yolo depth)

Deep dives may outrun anchored concepts; then the contract itself must be generated — so contracts carry provenance:

| Provenance | Contract origin | Served | Certificate |
|---|---|---|---|
| **anchored** | human-written/reviewed | safe + open | yes (core path) |
| **derived** | agent-decomposed from an *anchored parent's* edited material + cited source | open only, labelled | no (until promoted) |
| **provisional** | net-new, generated free | open only, "experimental", auto-creates an editorial debt | no |

Yolo never means "no contract" — it means **a contract that owes the editorial system a review.** Reader flags/likes on provisional content are the Wikipedia-style collective verification that prioritizes that review.

## 10. Prompt assembly — the leash

Never "write about cold start". Every call is assembled:

```
PROMPT(C, V) =
  1. CONTRACT of C           — objective, mustCover+modalities, recallA, forbidden
  2. FACET SPEC from V       — lens/visuality/depth/formalism/length/genre → concrete style rules
  3. SEGMENT SCOPING RULE    — "write for every reader who chose these knobs, not for one person;
                                no reader-specific references; examples live entirely in <lens>"
  4. MODALITY BUDGET         — §8 output plan (what becomes prose/diagram/formula)
  5. STYLE EXEMPLARS         — K most-loved `edited` blocks at adjacent facets (few-shot;
                                anchors voice to the book, not generic-LLM voice) ← biggest lever
  6. CORRECTION RULES        — top-N distilled rules from the correction ledger (below)
  7. EXISTING VARIANTS of C  — summaries; either reuse or deliberately differentiate (no near-dupes)
  8. POPULARITY CONTEXT      — which adjacent blocks readers love / abandon, and why we think so
  9. GUARDRAILS + SELF-CHECK — forbidden list; output recallQ mapping to C; list which mustCover
                                points were covered and by which modality
```

**Correction ledger (RLHF-lite, no fine-tuning):** every `community → edited` adoption produces a diff; diffs are distilled into short reusable rules ("editors cut hype adjectives", "editors add one concrete number to vague claims", "editors shorten intros to ≤1 sentence"). Arbiter-curated, top-N ride in every prompt — what editors most often fix is what the generator stops doing.

**Post-generation gate** (before anything is served, even privately): mustCover coverage · facet compliance via Tier-2 tags (`formalism: none` ⇒ no LaTeX; length band) · cheap LLM-judge consistency vs contract · persona safety · novelty vs existing variants. Fail → one regenerate → else fall back to nearest edited block.

## 11. Governance, git, attribution

| Role | Can | Gate |
|---|---|---|
| **reader** | read, rate, flag, steer, trigger generation, **share** their generated blocks | share gate (§6) |
| **contributor** | propose edits, add Tier-3 tags, submit drafts | lands as suggestion/PR |
| **editor** (power user) | adopt community → edited (git commit), edit blocks & contracts, resolve minor disputes | trusted, logged |
| **arbiter** (Pavel) | facet schema, core admission, direction, contract-level factual calls, dispute resolution | final say |

- **Git = source of truth** for `edited`/`core`: adoption is a commit, attribution and history for free; contributor agents work via PRs (extend the existing `admin.html` PR pipeline + an `AGENTS.md` as in recombee-wiki). Community/private blocks live in the generation store until adopted (§2.3).
- **Attribution & gamification:** shared blocks carry "enriched by <nick|anonymous>"; adoption earns the sharer XP + a **Contributor badge**; adopted blocks are listed in their profile. The book stops being one author's voice and becomes an arbitrated collective work — trust comes from provenance labels + the human gates, not from a single name.
- **Agents:** (a) *runtime generation agent* — the §5 trigger path (Vercel function via AI Gateway; validate → cache → serve private); (b) *batch contributor agent* — consumes the editorial queue, improves existing content, drafts PRs. Both coordinate through the same queue; neither can publish to readers on its own.

## 12. Admin console — evolve `admin.html`, don't rewrite

| Existing | Action |
|---|---|
| Editorial (drafts/review) | Extend to the ladder (§7): **nomination queue** ranked by distinct-reader traction; one-click **adopt** (= commit via existing PR pipeline) |
| Content Dashboard | Add the **coverage matrix**: concept × lens heatmap, layered core / edited / community / demand-without-content — the redakce cockpit |
| Reader Feedback (flags/notes) | Wire flags into demotion + review priority (§6/§9) |
| Analytics | Add **knob analytics**: most-requested steering vectors, cache misses, "generate" clicks — the demand signal feeding the queue |
| `generatePost` / `suggestFormats` / `tagSection` | Seed of the **Generation console**: trigger, preview, validate, diff vs exemplars |
| — new | Contract editor per concept · Correction-ledger view · Facet-schema editor (arbiter-only) · Dispute view |

## 13. Risk register

| Risk | Mitigation |
|---|---|
| Catalog dilution (infinite content) | §6: private-by-default, share gate, caps, retirement, exploration budgets |
| One-reader content polluting the catalog | segment scoping (§1.1, §10.3) + breadth-based adoption (≥K distinct readers) |
| Factual drift in generated content | contract tether + validation gate + provenance labels + flags |
| Kids exposed to unreviewed community content | persona hard constraint: safe mode forced until human review (§6.6) |
| Reputational (AI text near author's name) | provenance labels; author/arbiter name only on core; attribution on community |
| Popularity gaming (self-likes, sock puppets) | distinct-reader thresholds, rate limits, editor gate before any git entry |
| Runtime cost/latency | facet-vector cache; cache-warming of proven-demand cells; cheap draft models |
| Prompt bloat | distilled correction rules (not raw diffs); cap exemplars K |
| Facet vocabulary rot | Tier 1 arbiter-gated; Tier 3 as pressure valve; Tier 2 audits Tier 1 |
| Editorial queue starvation or flood | one queue, demand-ranked; caps bound the flood; nudges create steady demand signal |

## 14. Phased rollout

- **P0 — structure & profile, no generation.** Facet schema on existing 215 blocks (additive migration: `voice` → genre/depth hints, everything `edited`); contracts for core concepts; onboarding questions + profile v1 + transparent profile view; coverage matrix in admin. Invite power users/editors to tune the core.
- **P1 — steering & private generation.** Knobs panel + trigger cascade (§5) on **anchored concepts only**; validation gate; facet-vector cache; blocks stay private. Measure steering demand.
- **P2 — the community flywheel.** Share gate + community layer + exploration/caps/retirement; nomination queue + adoption flow (git commits) + attribution/XP; knob analytics in admin.
- **P3 — depth & collective maturity.** Correction ledger automation; derived/provisional contracts (deep yolo); batch cache-warming; contributor-agent PRs; dispute tooling; tiered certificate (Foundations / Practitioner / Guru) computed from core.

## 15. Open questions

1. **Facet freeze for P0:** ship 3 primary knobs (lens, visuality, depth) + 3 secondary (formalism, length, genre), or cut secondary to keep the first coverage matrix legible?
2. **Community moderation:** is the automated gate (§10) enough before first exposure, or a human quick-look for the first ~50 impressions? (Kid personas are locked regardless.)
3. **Attribution & licensing:** shared reader-triggered content — anonymous by default with opt-in nick? License folded into the book's CC BY-NC-SA via share-consent text?
4. **Thresholds to start with:** adoption K (distinct readers), per-cell caps, exploration budget size — gut values for P2?
5. **Private blocks:** persist for their creator forever? Explicitly excluded from certificate (proposal: yes — certificate reads core only)?
6. **Naming:** reader-facing names for safe/open — "Ověřený obsah" vs "Živá kniha"? (yolo stays internal slang)
