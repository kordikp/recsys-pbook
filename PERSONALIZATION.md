# Personalization: the Living Book

How this p-book personalizes itself using the techniques it teaches. Design rationale lives in [`_design-collective-pbook.md`](_design-collective-pbook.md); this is the implementation reference.

## The model in one paragraph

Content decomposes into **concepts** (what must be learned — human-anchored contracts in `content/concepts.json`) and **blocks** (how it's told — each block carries a **facet-vector** in its frontmatter). A recommender learns each reader's facet affinities and *selects* tellings; readers *steer* the telling per block (simpler / deeper / more visual / a different example world) and — when the catalog genuinely lacks that variant — trigger generation of a new one. Generated blocks start **private**; only blocks their creator liked and consented to share enter the **community** catalog; only community blocks with proven multi-reader appeal earn editor time; only verified content is **core** (and feeds the certificate).

## Five hard rules

1. **Personalization selects; generation extends the catalog.** Generated text is written for a *segment* (everyone with those knob settings), never addressed to an individual.
2. **Existing content has right of first refusal.** Steering first searches the catalog; generation fires only on a genuine gap **and** an explicit reader click.
3. **The reader pulls the trigger.** The system nudges and records demand; it never publishes on its own.
4. **The shared catalog grows only through human approval.** private → community needs the creator's like + consent; community → edited needs an editor; edited → core needs the arbiter.
5. **Core stays small, verified, contract-anchored.** The certificate reads only verified core content.

## Facets (Tier 1 — controlled vocabulary)

Flat frontmatter keys on every block (flat because all four YAML parsers in this repo are line-based):

| Key | Values | Meaning |
|---|---|---|
| `concept` | concept id | Which concept this block is a telling of |
| `state` | `core` `edited` `community` `private` `archived` | Lifecycle rung |
| `lens` | `generic` `ecommerce` `media` `social-feeds` `education` | The **example world** all scenarios live in |
| `visuality` | `text-first` `balanced` `visual-first` | How much of the point pictures/structure carry |
| `depth` | `intro` `standard` `technical` `research` | Assumed background |
| `formalism` | `none` `light` `full` | May formulas appear (validity: `full` ⇒ depth ≥ technical) |
| `lengthBand` | `tldr` `standard` `deep` | Reading budget |
| `genre` | `explainer` `story` `worked-example` `code-walkthrough` | Narrative container |

The same vector is simultaneously: recommender item-features (synced to Recombee), the generation spec, and the cache/dedup key (`gen--<concept>--<lens>-<visuality>-<depth>-<formalism>-<lengthBand>[-<lang>]`). `voice` stays for back-compat. Vocabulary lives in `js/config.js` (`CONFIG.facets`), mirrored in `api/generate.js` and the validator.

Additional dimensions: **`lang`** (`en` · `cs`) and extended vocabularies — `lens` includes `jobs` (job boards), `genre` includes `comic` and `animation` (both hand-crafted only; the generator never free-draws them).

### Subspace coverage (dimensions are not orthogonal)

One telling often serves several cells, so a block declares a **covered subspace**, not a point:
- ranges on ordered scales — `depth: standard..technical`
- sets on categorical ones — `lens: ecommerce|media`, `genre: explainer|story`

Matching asks *"does this block cover the target?"* (`_covers`, `_facetValues` in app.js) — full credit inside the subspace, partial credit by distance to its nearest edge; `lens: generic` keeps its "serves any world imperfectly" partial. The coverage map, admin matrix, steering candidates and community grouping are all subspace-aware. Validator accepts and checks both syntaxes.

### Breadth showcase: `item-cold-start` (14 tellings of one concept)

`content/ch02-data/05*` demonstrates the full telling space on one concept: anchor explainer (EN, `depth: standard..technical`), 30-second TL;DR, long-form story ("The Silent Orbit"), formal treatment (blend equation, handoff schedule, `formalism: full`), one-picture visual, **4-panel comic**, **three animations** (e-shop / streaming / job board — hand-crafted minimalist SVG, CSS-keyframe phases), three domain texts (ecommerce, media, jobs worked-example) and **two Czech variants** (`lang: cs`, one situated in a Czech outdoor e-shop). The tellings panel's **dimension picker** (🌐 World · 📏 Depth · 🖼 Form · ✒️ Genre · 🌍 Language · ⏱ Length) lets readers explore any dimension — counts show coverage, ＋ marks invitations.

## Reader profile

- **Onboarding** (skippable, two taps): world + goal chips with a live preview line ("→ Examples will come from shops and carts…"), plus a **🌱 Living book opt-in** right at the door (sets open mode — community + generation + remix — without hunting through the profile). Deep-link arrivals seed affinity from the landing block's facets.
- **Reading DNA** (profile): visual affinity bars per facet (📌 marks explicit pins), a living-book contribution summary (generated / remixed / shared counts, link to the 🌱 map), correction dropdowns, open-mode toggle.
- **Learned affinities**: reading a block adds weight 1 to its facet values; explicit steering adds weight 3 (`UserModel.facetAffinity`, `steerPrefs`).
- **Transparent**: the profile view shows the learned model in plain words with correction dropdowns — a correction is itself the strongest signal. Synced to Recombee as user properties (`prefLens`, `prefDepth`, `prefVisuality`, `goal`, `readerMode`).
- **Reader modes**: `safe` (default) = core + edited only. `open` = + community layer + generation knobs (opt-in toggle in Profile).

## Steering & the generation trigger

Two surfaces per spine block:
- **Top**: a slim `🎛 N other tellings ▾` indicator → expands the **tellings panel**: every existing variant of the concept with state badges (CORE / edited / ⚡ reader-shared / ⚡ yours) and facet chips, a "Read" swap button each, plus the generate CTA for the reader's target cell (open mode + endpoint) — you always *see what exists before generating*.
- **Bottom** (after reading): "How was this telling?" — 👍 Great · 🔽 Simpler · 🔼 Deeper · 🖼 More visual · 🌐 my world. Feedback belongs at the end of the story.

`app.steerBlock()` uses an **honest-miss rule**: a candidate must actually *move* on the steered facet (lens = exact world match; depth/visuality = at least one step in the asked direction). If nothing qualifies, there is **no silent swap** — the tellings panel opens with "No ecommerce telling of this concept yet", the demand is logged (`steer_miss`), and the generate CTA is right there. 👍 adds positive affinity (weight 2) for the current telling's facets; explicit steers weigh 3.

## Generation (`api/generate.js`)

`POST /api/generate {concept, facets}` — anchored concepts only, facet values whitelisted server-side. The prompt assembles: concept **contract** (objective, mustCover, recallA, forbidden) + facet style rules + **segment-scoping rule** + voice exemplar (the concept's anchor block) + **correction ledger** (`content/correction-rules.json`) + existing-variant summaries. Output is schema-validated (structured outputs), then passes a **validation gate** (mustCover coverage, formalism lint, length band) with one corrective retry. Configure with `ANTHROPIC_API_KEY` (model override: `GEN_MODEL`, default `claude-opus-4-8`). Without the key the endpoint reports `available: false` and the UI degrades to catalog-only steering + demand logging.

Rich media is deliberately excluded from free generation: visual-first variants use markdown structure; animations/games only ever come from vetted templates (the existing `games/*.json` pattern).

## Remix: reader-tuned passages (any content)

Select any passage in any block (core, edited, or generated) → the selection popup (or **right-click**) offers **✨ Remix** → describe the change ("use a running-shop example", "simpler words", "add a concrete number") → **Generate improved version**. The original is never touched: the reader gets a **private copy** of the block with the changed span visibly marked (`⟦rx⟧…⟦/rx⟧` markers rendered as amber `remix-mark` highlights) and a **✨ your remix** badge. Remixing your own remix edits it in place; the full wish history travels as `remixLog`.

Server side: `POST /api/generate {mode:'remix', selection, instruction, context, concept?, facets}` → `{replacement}`. The reader's instruction is scoped hard: *style/examples/focus of the passage only — never facts, never the contract, never individual addressing* (verified injection-resistant). Validation gate: length ≤ 2.5× selection, formalism lint, reserved-marker check, one corrective retry.

The **variant generator** accepts the same kind of wish: an optional free-text input next to the generate button in the tellings panel (`instructions`, ≤300 chars) — wished variants get their own cache cell (`--w<hash>` id suffix). Remixes and wished variants follow the standard ladder: like → share consent → community (with `remixOf` + `remixLog` provenance) → editorial adoption.

**Diagrams & animations remix too**: every diagram gets a hover ✨ button → wish → `POST /api/generate {mode:'svg-remix', svg, instruction}` rewrites the inline SVG (SMIL/CSS animations included — "slow it down", "change the products to running shoes"). Double sanitization (server *and* client): no scripts, no event handlers, no external refs, no foreignObject, size caps. The remixed copy renders with a dashed amber outline (`diagram-remixed`) and travels as `diagramSvg` through the same share ladder. SVGs >60 KB are refused honestly.

## Community layer & lazy redakce

```
private ──(creator like + share consent)──► community ──(≥5 distinct readers positive → nomination queue → editor commits to git)──► edited ──(arbiter)──► core
```

- Share consent is anonymous by default (optional nickname). Shared blocks become **Recombee items** (`state="community"`, body as item property) — instantly recommendable, zero extra infrastructure.
- Community blocks appear in the home shelf "From fellow readers 🌱" (open mode only), clearly labelled, and in steering pools.
- **Admin → Coverage** is the redakce cockpit: concept × lens matrix (core/edited/community/gap + contract-debt flags ⚠), unmet steering demand ranked by distinct readers, and the nomination queue with one-click "download .md for adoption" (review → place into `content/` → `status: accepted` → Sync Items).
- **Admin → Health** is the continuous-revision loop: per-block reader signals (distinct readers, likes/dislikes, flags with their texts, steer-away, remix requests, shallow-reading detection) roll into a transparent problem score; ranked problem blocks offer **⏸ Park** (local override + the exact `sed` one-liner for the file, copied to clipboard) and **✨ AI rewrite from signals** (regenerates the telling from its contract with the recorded reader complaints as instructions → preview → download `.md` with `status: review`). Content that doesn't work for readers gets parked or reshaped — not left to rot.
- Tunable defaults (spec §6, in `CONFIG.community`): adoption K=5 distinct readers, exploration budget 50 impressions, ≤2 live community variants per concept×lens.

## Living book coverage map (reader-facing)

**Map → 🌱 Living book**: a concepts × example-worlds grid. Filled cells show existing tellings (● core purple / ● edited green / ● reader-shared amber / ◐ yours); empty cells render as **＋ invitations** — clicking one opens the concept and steers toward that world, landing on the generate CTA if the cell is truly empty. The reader's own world column is highlighted. Clicks log `coverage_click` (another demand signal). The admin Coverage tab remains the editorial view of the same matrix.

## AI examiner (mission final boss)

`api/boss.js` grades boss-quiz answers **on substance, not keywords**: `POST /api/boss {question, hints, answer, missionTitle}` → `{score 0-100, verdict pass|almost|fail, feedback, missing[], followUp}`. Pass ≥ 70 completes the mission; almost gets one probing follow-up question and an "Improve my answer" loop. The student's answer is treated as untrusted text (prompt-injection-resistant by instruction, verified). Falls back to the original keyword check when the endpoint isn't configured. Same provider logic as generation (`ANTHROPIC_API_KEY` primary, `OPENAI_API_KEY` dev fallback). Grades are logged as `boss_graded` events.

## Tiered certificate

Computed in `app.getCertTiers()` from **verified core content only**, cumulative:

| Tier | Requirements |
|---|---|
| 🥉 **Foundations** — Understands Recommendations | all core `intro`/`standard` blocks read |
| 🥈 **Practitioner** — Can Build Recommenders | + all core `technical` read + ≥2 missions completed |
| 🥇 **Recommendation Guru** — Masters the Algorithms | + all core `research` read + ≥1 Advanced mission boss + ≥10 recall reviews |

The profile shows the ladder with live requirements; the certificate SVG carries the tier name, subtitle and color. Community/private content never counts toward certification.

## Operations

```bash
node scripts/migrate-facets.js          # (re)generate facets + concepts.json — idempotent, additive
node .github/scripts/validate-content.js # validates facet enums, validity rules, concept refs, contracts
# POST /api/sync-recombee {secret}       # ensures facet item-properties exist + syncs git content
```

**Enabling generation on Vercel:** set `ANTHROPIC_API_KEY` (and optionally `GEN_MODEL`). **Kill switches:** `CONFIG.features.steering/generation/community` in `js/config.js`; readers control open/safe mode themselves. Netlify note: `api/generate.js` has no Netlify mirror yet — generation is Vercel-only for now.

## What is NOT implemented yet (from the spec)

- Durable server-side generation cache (currently: warm-lambda memory + reader localStorage + community dedup by deterministic id)
- Automated correction-ledger distillation from adoption diffs (the ledger file is hand-curated)
- Derived/provisional contracts (deep yolo beyond anchored concepts) — endpoint enforces anchored-only
- Exploration-budget/cap enforcement in serving (defaults documented in config; enforcement is editorial via the Coverage tab)
- Contributor agent PRs (batch); mission steps rendered per-concept (steering inside mission reading already works via the knobs)
