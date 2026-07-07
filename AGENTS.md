# AGENTS.md — Instructions for AI Collaborators

You are working on **p-book: How Recommendations Work** — a living, self-personalizing book about recommender systems. Humans own the *facts* (concept contracts, core content); **AI owns the metadata**. Facets are the load-bearing structure of the whole personalization system: they are simultaneously the recommender's item features, the generator's spec, and the coverage map's coordinates. A block with wrong facets is served to the wrong readers, generated against the wrong template, and invisible in the right map cell. **Tagging is not paperwork here — it is the product.**

This file tells you how to do that work correctly. Read it fully before touching `content/`. Design rationale: `_design-collective-pbook.md`. Implementation reference: `PERSONALIZATION.md`. Human counterpart (readers / contributors / editors): `HUMANS.md`. PR mechanics: `CONTRIBUTING.md`.

---

## 1. The data model in 60 seconds

- **Concept** = what must be learned. Lives in `content/concepts.json` (generated — never edit by hand; regenerate via `node scripts/migrate-facets.js`). Each concept has a human-owned **contract**: `objective`, `mustCover[]`, `recallQ/recallA`, `forbidden[]`.
- **Block** = one *telling* of a concept. A Markdown file in `content/chNN-*/` with flat YAML frontmatter. Every block carries a **facet vector** describing HOW it tells — never WHAT it teaches.
- **Subspace**: dimensions are not orthogonal, and one telling often serves several cells. A block therefore declares *coverage*, not a point: ranges on ordered scales (`depth: standard..technical`), sets on categorical ones (`lens: ecommerce|media`). A single value = a set of one.
- The frontmatter parser is **flat and line-based** (four independent parsers must agree: `js/markdown.js`, `admin.html`, `api/sync-recombee.js`, the validator). Never use nested YAML maps. Lists only with the existing `highlights:`/`- item` pattern.

## 2. The facet dimensions — semantics and decision procedures

For each dimension: the one-sentence semantic, then the **operational test** you must actually run. If you cannot answer the test from the block's text alone, the tag is a guess — stop and re-read.

### `lens` — the example world (categorical: `generic · ecommerce · media · social-feeds · education · jobs`)

*Semantic:* where the block's examples, scenarios, and metaphors LIVE. Never what the block teaches — the topic is always recommender systems.

**Test:** list every example/scenario in the block. If ≥80% live in one world → that lens. If two worlds each carry substantive examples (not passing mentions) → a set, e.g. `ecommerce|media`. If examples are deliberately drawn from many worlds, or abstract → `generic`.

**Trap:** a single sentence mentioning Spotify does NOT make a block `media`. Mentions are Tier-3 territory, not lens. Lens changes only when the *scenario the reader inhabits* changes.

### `lang` — language (categorical: `en · cs`)

*Semantic:* the language of the prose. **Test:** trivial — but remember `recallQ/recallA` and `title` must be in the same language as the body.

### `depth` — assumed background (ordered: `intro → standard → technical → research`)

*Semantic:* what the reader must already know for this telling to land.

**Test — find the strictest level that holds:**
- `intro`: NO term is used without being explained *through the example itself*. A smart 12-year-old or a non-technical adult loses nothing.
- `standard`: technical terms appear but each is introduced when first used ("collaborative filtering — finding people with similar taste"). Curious adult, no CS background.
- `technical`: practitioner vocabulary used *without* re-explanation (embedding, candidate generation, CTR, re-ranking). Code snippets allowed.
- `research`: engages notation, derivations, or the literature (papers, named methods with formal claims).

**Range rule:** declare `a..b` only if a reader at *each* end would feel the telling was written for them. A `standard..technical` block reads naturally to a curious adult AND doesn't bore a practitioner. If the intro reader would drown in §3 of the block, it is NOT `intro..standard` — it's `standard`.

### `formalism` — may formulas appear (ordered: `none · light · full`)

*Semantic:* the mathematical surface. **Test — count:** 0 formulas/LaTeX → `none`; 1–2 inline, each explained in words → `light`; formulas structure the argument → `full`.

**Hard validity rules** (validator enforces): `full` requires `depth` ≥ `technical`; `depth: intro` forces `none`. The Tier-2 lint cross-checks: a block claiming `none` that contains `$$`/`\frac` **fails validation**.

### `visuality` — what carries the point (ordered: `text-first · balanced · visual-first`)

**Test — the deletion test:** remove all visuals. Point completely lost → `visual-first`. Point survives but weakened → `balanced`. Nothing to remove / removal costs nothing → `text-first`.

### `lengthBand` — reading budget (ordered: `tldr · standard · deep`)

**Test — word count of the body:** ≤ ~150 → `tldr`; ≤ ~450 → `standard`; above → `deep`. (Same budgets the generator is validated against.) Set `readingTime` consistently: ≈ words/200, min 1.
**Range case — "deep with a tl;dr lead":** a deep telling that OPENS with a self-contained ≤150-word summary box genuinely serves both budgets → declare `lengthBand: tldr..deep`. The test for the range: could a reader stop after the lead and still answer the recallQ? If yes, the range is honest; if the lead is just a teaser, tag `deep` only.

### `voice` — RETIRED taxonomy (legacy key, ignore)

`voice: explorer|creator|thinker|universal` predates the facet system and is superseded by it (roughly: explorer → `genre: story`+`depth: intro..standard`, creator → `genre: worked-example|code-walkthrough`, thinker → `depth: technical..research`). Existing keys stay for mission-branch labels and old data; **never add `voice:` to new content, never base tagging decisions on it.**

### `carriers` — building blocks present (derived, set: `prose · table · diagram · image · animation · formula · code`)

`carriers` is a composition descriptor recomputed by `scripts/migrate-facets.js` on every run (the one exception to "existing keys are never overwritten" — hand edits get overwritten on the next run, so if a derived value looks wrong, fix the content or the derivation rule). It answers *what is in the block*; the ordered axes answer *how much it matters* (`visuality` for visuals, `formalism` for math). Readers can PIN a preferred carrier (Profile → Format preferences, or per-request in the tellings panel) — items' derived tags are what that preference matches against.

### `genre` — the narrative container (categorical: `explainer · story · worked-example · code-walkthrough · comic · animation`)

**Test:** what is the skeleton? Concept-first exposition → `explainer`. Characters/scenes/dialogue carry it → `story`. One concrete case stepped through end-to-end → `worked-example`. Code is the spine → `code-walkthrough`. `comic`/`animation` = the SVG carries it (these are **hand-crafted only** — the text generator must never claim them; see §6).

### `state` — lifecycle rung (single value, never a set: `core · edited · community · private · archived`)

Git content is `edited`; `core` if and only if `core: true` (certificate-bearing, human-verified — **you never set or change `core` yourself**). `community`/`private` never appear in git files — they live in the generation store.

### Cross-dimension sanity

After tagging, read the vector back as a sentence: *"An `{lang}` `{genre}` at `{depth}` depth with `{formalism}` formulas, `{visuality}`, `{lengthBand}` long, set in `{lens}`."* If that sentence sounds absurd ("an intro comic with full formulas"), you mis-tagged something.

## 3. Calibration examples (real blocks — match these)

| Block | Vector | Why |
|---|---|---|
| `05-spine-item-cold-start.md` | generic · en · **standard..technical** · none · balanced · standard · explainer | Terms introduced when used (standard) but beeFormer nod + exploration-budget framing lands for practitioners too; diagram is illustrative, not load-bearing → balanced |
| `05a-…-tldr.md` | generic · en · **intro..standard** · none · text-first · **tldr** · explainer | 5 sentences, every term explained inline — an intro reader loses nothing |
| `05b-…-formal.md` | generic · en · **technical..research** · **full** · text-first · standard · explainer | Notation structures the argument; readable by a practitioner, engages research framing |
| `05d-…-comic.md` | **education** · en · intro..standard · none · **visual-first** · tldr · **comic** | Classroom scenario = education world; delete the SVG and nothing remains |
| `05j-…-jobs.md` | **jobs** · en · standard..technical · none · text-first · standard · **worked-example** | One posting stepped through hour by hour; job-board scenario throughout |
| `05k-…-long.md` | **ecommerce** · en · standard · none · text-first · **deep** · **story** | Characters + dialogue carry it; bookshop scenario; >450 words |
| `05m-…-cs-shop.md` | ecommerce · **cs** · intro..standard · none · text-first · standard · story | Czech prose, Czech e-shop setting |

When in doubt, open these files and compare against your candidate block. They are the reference set.

## 4. Assignment procedure (new or edited block)

1. **Read the whole block.** Not the frontmatter — the body.
2. **Concept first.** Ask: *after reading this block, could the reader answer some existing concept's `recallQ`?* Search `content/concepts.json`. Yes → that's the concept. No → this block introduces a new must-learn objective → it needs a **new concept**: write it as an anchor (`NN-spine-*.md` filename), give it `recallQ/recallA` + 2–4 `highlights` (these bootstrap the contract), and flag the new contract for human review (it is human-owned).
   **AI-drafted concept proposals:** the inventory is demand-openable. You may draft new-concept *proposals* from reader evidence (concept wishes, honest misses, flags) — each a full contract draft (objective, mustCover, recallQ/A, suggested chapter via the stop-test, rationale citing the evidence). Deliver them to the editorial queue (admin → Coverage → 🌱, or a `status: draft` anchor file in a PR); **never register a new anchor in book.json yourself** — approval and placement are the arbiter's.
   **Interest testing (ghost items):** approved-for-testing proposals live in `content/concept-proposals.json` — readers see them as labeled "proposed" cards and vote. You may draft entries (same contract fields + `chapter` via the stop-test), but committing to that file is the arbiter's call, and you never fabricate or touch vote data. A proposal graduates to a real concept (anchor + `book.json`) only after the admin queue shows the interest threshold met.
   **Concept naming:** the slug is a short noun phrase for the *idea*, never the block title and never chapter-prefixed (`item-cold-start`, `collaborative-filtering`, `filter-bubbles` — not `ch2-cold-start` or `have-you-ever-noticed`). Chapters move; slugs must survive the move. Declare it as `concept:` on the anchor plus a concise human `conceptTitle:` ("Item cold start"); block `id`s stay untouched (reader progress is keyed by them).
   **Multi-concept membership** (`concept: a|b`) is allowed but expensive: it claims the reader can answer **every** listed concept's `recallQ` after this one block — run the test for each, and list the *primary* concept first (it decides the chapter, the tellings-panel grouping, and the generation contract). One extra membership is the realistic maximum; three is a sign the block should be split.
3. **Tag each dimension** using the §2 tests, in this order: `lang` → `lens` → `genre` → `depth` → `formalism` → `visuality` → `lengthBand`. (Language and world are cheapest to verify; depth benefits from having settled genre first.)
4. **Declare subspaces honestly.** Default to a single value. Widen to a range/set only when the §2 range rule passes. A subspace is a *promise to readers at every covered cell* — an over-wide declaration is worse than a narrow one, because it serves the block to readers it will disappoint (and pollutes the coverage map with fake coverage).
5. **Run the sanity sentence** (§2 end) and the calibration comparison (§3).
6. **Mechanics:** file into the right chapter dir; **register in `content/book.json` — order matters**: satellites must come *after* their anchor (concept grouping is reading-order-based); satellite filenames must NOT contain `-spine-` (`NNa-sidebar-*`, `NNb-depth-*`); unique `id`; `status: draft` unless a human asked for `accepted`.
7. **Validate:** `node scripts/migrate-facets.js && node .github/scripts/validate-content.js` — zero errors required. The migrate script is idempotent and only fills *missing* keys; it never overwrites your explicit tags.

### References and cross-links

Three kinds of links, three rules:

1. **Concept cross-links — the default.** Link the *idea*, not a file: `[collaborative filtering](#c/collaborative-filtering)`. The app resolves `#c/<slug>` to the concept's anchor (and may later resolve to the reader's best-fitting telling — one more thing personalization can serve). Never hardcode a chapter or filename into a link; both move.
2. **Block links** (`#<block-id>`) only when *that exact telling* is the point ("see [the comic](#item-cold-start-comic)"). Blocks get re-tagged, swapped and archived; concept links survive all of that.
3. **External sources.** Inline `[label](https://…)` for casual pointers. For load-bearing claims (a paper, a benchmark, a tool) add a `**Sources:**` bullet list at the end of the block — stable URLs or DOIs only. **Never invent a citation, URL, or paper title** — this is a forbidden-claims-level offense; the generator is bound by the same rule through every contract.

The validator checks that every `#c/<slug>` target exists in `concepts.json` and every `#<block-id>` target is a known block id. When you archive or split a block, grep for links pointing at it first.

### Chapters: which one, and when to create a new one

A chapter is a **position in the pedagogical arc**, not a topic bucket — the ordering encodes prerequisites, and `book.json` subtitles are the theme statements of record. Three rules:

1. **Blocks inherit their concept's chapter — always.** Every telling (any lens, genre, language, or origin — generated and community included) lives where its concept's *anchor* lives. Facets never move a block between chapters; if you feel a telling "belongs elsewhere", you are actually questioning its **concept assignment** (§4 step 2), not its chapter.
2. **Placing a NEW concept:** run the stop-test — *"could a reader who stopped at the end of chapter N−1 understand this anchor?"* Pick the earliest N where the answer is yes AND the chapter's subtitle covers the theme. Tie between two chapters → the one that *introduces* the vocabulary the contract's `mustCover` leans on. Record prerequisite concepts in the concept's `parents`. (Example: `item-cold-start` sits in ch02-data, not ch05-algorithms — it needs only "interactions exist" from ch02, and cold start is fundamentally a *data availability* problem; beeFormer, which *solves* it, lives with the algorithms.)
3. **A new chapter is an arbiter decision, never yours alone.** Propose one only when ≥3 anchored concepts share a theme no existing subtitle covers *and* they form a coherent arc with a clear prerequisite position. A new chapter touches the certificate path, missions, and the map — flag it, don't create it. (Mechanics when approved: `content/chNN-slug/` directory, `book.json` entry at the prerequisite-correct position, migrate + validate.)

## 5. Re-tagging on content change — the duty humans can't carry

Whenever a block's **body** changes (by you, another agent, or a human edit you're processing), re-run the §2 tests. Do not assume the old tags survive. Cheap triggers that MUST make you re-check:

| Change in body | Re-check |
|---|---|
| Examples moved to/from a platform world | `lens` |
| Formula added/removed | `formalism`, then `depth` (validity rule) |
| Terms newly explained / explanations cut | `depth` |
| Diagram/table added or removed | `visuality` |
| Text grew/shrank across a band boundary | `lengthBand` + `readingTime` |
| Rewritten as narrative / case / code | `genre` |
| The block's **concept** re-assigned | its **chapter** (blocks live where their concept's anchor lives — move the file + reorder `book.json`) |
| Meaning of the anchor changed | **the contract** — update `recallQ/recallA/highlights`, then **re-read every telling of that concept** (list: `concepts.json → blocks[]`) for consistency with the new contract; flag contract changes for human review |

Also re-check the block's `teaser` and `recallQ/recallA` still match the body. Facet drift is silent — nothing crashes, readers just quietly get wrong content. That is why this duty exists.

## 6. What you may and may not do

**You may,** autonomously: tag and re-tag facets; fix facet/validity errors; regenerate `concepts.json`; add satellites (`status: draft`); update `teaser`/`recallQ`/`recallA` to match an edited body; add Tier-3 emergent tags; fix broken references; run all tooling.

**You must ask a human** (or open a PR and stop): changing any **contract** field on an anchored concept; promoting `status` to `accepted`; touching anything with `core: true`; deleting or renaming blocks; changing the Tier-1 facet **vocabulary** itself (that is arbiter-only — new values change the recommender's feature space, the generator's whitelist in `api/generate.js`, the validator, `js/config.js`, and Recombee properties, all at once).

**You must never:** invent statistics, benchmarks, papers, or URLs in content; write nested YAML in frontmatter; put `community`/`private` states into git; claim `genre: comic|animation` for generated text; edit `concepts.json` by hand; weaken a contract to make a telling pass validation.

## 7. Content voice (when you also write, not just tag)

Follow `content/correction-rules.json` — it is the distilled list of what editors keep fixing; the top rules ride in every generation prompt and apply to you too. Summary: no hype adjectives; one concrete number beats "significantly"; ≤1 sentence of intro before substance; no rhetorical-question openers; bold the key phrases, not sentences; end with a hook or takeaway, not a recap. For SVG work: minimalist (≤3 colors + grays), computed layouts (no overlapping/dangling lines), no `<script>`/event handlers/external refs, XML-validate before committing, and animations as clean CSS-keyframe phases.

## 8. Tooling cheat-sheet

**Touching the Recombee integration?** Read [RECOMBEE.md](RECOMBEE.md) first — statuses are semantic (404 = "entity/property does not exist", read the BODY), properties must be defined before writing (items AND users), newer clusters are POST-only, sync uses /batch/. It exists because an AI assistant lost a day to exactly these.

```bash
node scripts/migrate-facets.js --dry      # preview concept grouping + facet fills
node scripts/migrate-facets.js            # regenerate concepts.json (idempotent)
node .github/scripts/validate-content.js  # facet enums, subspace syntax, validity rules, concept refs — must PASS
node serve-local.js 8777                  # local server (static + /api/* shims)
python3 -c "import xml.etree.ElementTree as ET; ET.parse('images/FILE.svg')"   # SVG XML check
```

Key files: `js/config.js` (`CONFIG.facets` — the vocabulary of record) · `api/generate.js` (generator whitelist mirror) · `content/concepts.json` (generated index) · `content/book.json` (ordering = concept grouping) · `admin.html → Coverage/Health` (where your tagging becomes visible to editors).

## 9. The invariant to protect

Every telling of a concept, at any point of its subspace, must leave the reader able to answer that concept's `recallQ` consistently with `recallA`. Facets may vary everything else — world, language, depth, form, length, genre — **but never that**. If you cannot tag a block without breaking this invariant, the block doesn't need better tags; it needs a different concept or a rewrite. Say so instead of forcing it.
