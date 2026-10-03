# Contributing to "How Recommendations Work"

Thanks for helping make this book better! This guide explains how to contribute content.

> **Start with [HUMANS.md](HUMANS.md)** — the guide to working with the living book as a reader, contributor, or editor (steering, generating, remixing, sharing, adoption). This file covers the low-level mechanics of content files and PRs.
>
> **AI collaborators:** read [AGENTS.md](AGENTS.md) — the facet metadata system is maintained by AI, and that file contains the binding decision procedures, calibration examples and autonomy boundaries. Humans own facts (contracts, core); AI owns metadata.

## Content types

| Type | Description | Frontmatter `type` |
|------|-------------|-------------------|
| Section | Educational content (the book's main text) — one *telling* of a concept | `spine` |
| Question | Interactive question with choices | `question` |
| Game | Click-based mini-game | `game` |

## How to contribute

### 1. Open an issue first
Use the [New Content Proposal](../../issues/new?template=new-content.md) template to describe what you want to add. This helps avoid duplicate work.

### 2. Create a branch
```
git checkout -b content/ch2-my-new-section
```

### 3. Write your content

Every section is a **telling of a concept**. Before you write, find the concept in `content/concepts.json` and read its contract: your telling must let a reader answer the concept's `recallQ` consistently with its `recallA`, cover its `mustCover` points, and avoid its `forbidden` claims.

Create a markdown file in the directory of the chapter where the concept's anchor lives (`content/chNN-*/`).

**File naming**: `{order}{letter}-{kind}-{slug}.md`
- A new telling of an existing concept is a *satellite*: `05h-sidebar-cold-start-ecommerce.md`. Satellite filenames never contain `-spine-`.
- Only the *anchor* of a new concept is named `NN-spine-*.md` — and new concepts are an editors' decision (see below).
- The prefix sets the position in the chapter: the reader app currently sorts each chapter by it, so pick one that places your file right after the concept's other tellings.

**Frontmatter template** (flat keys only — no nested YAML):
```yaml
---
id: cold-start-ecommerce-story
type: spine
title: "My Section Title"
readingTime: 3
standalone: true
teaser: "One sentence preview shown on cards"
recallQ: "The concept's recall question, or your own version of it"
recallA: "The answer, consistent with the concept's recallA"
status: draft
concept: item-cold-start
lang: en
lens: ecommerce
depth: standard
formalism: none
visuality: text-first
lengthBand: standard
genre: story
---

Your markdown content here...
```

**Required fields**: `id`, `type`, `title`. Facet keys (`lens`, `depth`, `formalism`, `visuality`, `lengthBand`, `genre`, `lang`) describe *how* your telling tells the concept; the tests for each are in [AGENTS.md §2](AGENTS.md) and apply to humans too. `carriers` and missing facets are filled in by `scripts/migrate-facets.js`. Do not add the retired `voice:` key.

**Status**: Always set `status: draft` for new content. The authors change it to `accepted` after review.

**New concepts**: if your text teaches something no existing concept covers, say so in the issue. New concepts (and their contracts) are approved and placed by the authors; reader demand for them is tested first in `content/concept-proposals.json`.

### 4. Add to book.json
Add your filename to the `files` array of the right chapter in `content/book.json`, **after** the concept's anchor and its other tellings (concepts are grouped by this order). Then run:

```bash
node scripts/migrate-facets.js            # regroups concepts, derives carriers
node .github/scripts/validate-content.js  # must pass
node scripts/build-llms-index.js          # refreshes the concept index in llms.txt
```

### 5. Open a Pull Request
CI will automatically validate your content (frontmatter, facets, unique IDs, references). Fix any errors before requesting review.

## Adding a game

A game is a **vetted template plus data**: the engine (`js/games.js`) is reviewed code, and a new game is only a JSON file in `games/` plus a content block. Never put code or HTML in game data.

**Data rules.** Every item must be unambiguous to an expert in the field and carry a one-line `why` (shown after every answer). No invented statistics: a number in a `why` is either computed (say how) or sourced in the concept's tellings. Simulated games label their numbers as toy numbers (`toyNote`). Games are untimed unless the JSON sets `"timer": <seconds>`.

Common fields: `type`, `title`, `instruction`, `debrief` (the takeaway on the end screen), optional `minutes` (shown as "~N min").

| `type` | What the player does | Fields |
|---|---|---|
| `sort` | Puts each card in one of 2–4 buckets | `buckets[]`, `items[]` of `{text, answer (bucket index), why}` |
| `pairs` | Picks the term for a description from 4 options | `pairs[]` of `{a (term), b (description), why, options?[]}`; `a` values unique |
| `order` | Taps the steps in sequence | `steps[]` (in the correct order), `why[]` (one per step) |
| `match` | Finds a taste twin in a rating matrix, then predicts a blank cell | `items[]` (column titles), `matrix{name: [ratings or null]}`, `you`, `predict{item, k}` |
| `pop` | Marks every item that matches the instruction, then checks | `items[]` of `{text, hit, why}`, `hitLabel`, `missLabel` |
| `bandit` | Spends impressions on options with hidden click rates, then races Thompson sampling, greedy and uniform | `arms[]` of `{label, text?, p}`, `pulls`, `shuffleArms`, `compare[]`, `armWord`, `toyNote` |
| `mixer` | Moves ranking-weight sliders and rule toggles to meet goals | `weights[]`, `toggles[]` (`kind`: `maxPer`, `reserve`, `hide`, `pin`), `kpis[]`, `items[]`, `goals[]` of `{text, check{kpi: ">=0.6"}, why}` |
| `abstop` | Runs A/B tests day by day and decides when to ship | `usersPerDay`, `plannedDays`, `rounds[]` of `{label, pA, pB, trap?, novelty?{boost, halfLifeDays}}`, `scoring{}` |
| `loop` | `mode: "creator"`: replays 30 days of a rich-get-richer ranking with fixes. `mode: "user"`: watches a feed narrow, then bursts the bubble | creator: `items[]` of `{name, appeal, seedClicks, gem?}`, `interventions[]`, `goals[]` (a goal with `andPrev: true` only counts when the one before it is met); user: `topics[]` of `{name, items[]}`, `goalTopics`, `exploreSlots` |

Every number on a simulation's end screen is computed live by the engine; never type a result into the data.

Check the data before committing (CI runs it too, through `validate-content.js`):

```bash
node scripts/check-games.mjs   # answer keys, a single clear twin, reachable goals, why coverage
```

Then add a content block next to the concept's tellings, register it in `content/book.json` right after that concept's last telling, and run `node scripts/migrate-facets.js && node .github/scripts/validate-content.js`:

Every item must have exactly one answer an expert would accept. If a fair expert could argue for another bucket, rewrite or drop the item. In the PR, give a one-line reason for each answer so the reviewer can check it.


```yaml
---
id: item-cold-start-game
type: game
game: item-cold-start-order
title: "Life of a New Item"
readingTime: 2
teaser: "One line that says what the player will try."
concept: item-cold-start
status: draft
state: edited
lang: en
lens: generic
depth: intro..standard
formalism: none
visuality: text-first
lengthBand: tldr
---
```

Games show up in the chapter flow, on the Browse and Quiz shelves and in the Playground (`#play`, or `#play/<block id>`). The engine logs `game_start`, `game_answer` (with the item index and whether it was right) and `game_end` events, so an item that most players get wrong can be found and fixed.

## Adding an image

Place SVG files in `images/`. Reference from content via `diagram: my-diagram` in frontmatter, or with a markdown image in the body.

## Style guide

### Who we write for

Adults: **product owners and managers, engineers, students, and curious readers without a technical background**. A product owner should be able to follow the standard-depth telling of every concept; deeper tellings may assume more, and say so with their `depth` facet (`intro` → `standard` → `technical` → `research`). Respect the reader: explain, never talk down.

### Voice

These rules come from [AGENTS.md §7](AGENTS.md) and `content/correction-rules.json`, the list of what editors keep fixing. The generator follows the same list.

- **No hype adjectives** (powerful, amazing, revolutionary, game-changing). Make plain statements instead.
- **One concrete number or named example** beats "many platforms" or "significantly better".
- **At most one sentence of introduction** before the substance begins.
- **No rhetorical-question openers.**
- **Define terms on first use** at intro and standard depth ("collaborative filtering — finding people with similar taste"). Never re-define basics at research depth.
- **Bold the key concept phrases**, not whole sentences.
- **End with a forward hook or a concrete takeaway**, not a summary that repeats the text.

Humour is welcome where there is room — stories, comics, intro tellings — when it is dry and specific and the joke *is* the mechanism. It never replaces the explanation and never comes at someone's expense.

### Facts and sources

- **Never invent** statistics, benchmarks, papers, quotes or URLs.
- A number needs a source, or it must be clearly a toy example ("say a shop has 1,000 products…").
- For load-bearing claims (a paper, a benchmark, a tool), add a `**Sources:**` list at the end of the block with stable URLs or DOIs.
- Recall questions should test a mechanism or a decision ("Why does a new item get no collaborative-filtering recommendations?"), not a memorised figure.

### Length

Count the words of the body: up to ~150 is `tldr`, up to ~450 is `standard`, more is `deep`. Set `readingTime` to about words/200 (minimum 1). A long telling that opens with a self-contained summary of 150 words or fewer may declare `lengthBand: tldr..deep`, but only if a reader who stops after the summary can answer the recall question.

### Links

- Link ideas, not files: `[collaborative filtering](#c/collaborative-filtering)` links a concept and survives renames and re-tagging.
- Link a block (`#block-id`) only when that exact telling is the point.

### Language

English by default. A Czech telling sets `lang: cs`, and its `title`, `recallQ` and `recallA` are in Czech as well.

### Figures

- Minimalist SVG: at most three accent colours plus greys, computed layouts (nothing overlapping or dangling), labels large enough to read on a phone.
- No `<script>`, event handlers or external references (they are stripped anyway). Check that the file is valid XML: `python3 -c "import xml.etree.ElementTree as ET; ET.parse('images/FILE.svg')"`.
- Animations use CSS keyframes, and the figure must make sense when it is not moving.
- Write alt text that states the figure's point, not just its title.

## Review process

1. Submit PR with `status: draft`
2. CI validates content structure
3. The authors review content quality and accuracy
4. The authors set `status: accepted` and merge
5. Content appears in the book on next deploy

By contributing you license your content under CC BY-NC-SA 4.0 (code under MIT) — see [LICENSE](LICENSE).
