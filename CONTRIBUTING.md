# Contributing to "How Recommendations Work"

Thanks for helping make this book better! This guide explains how to contribute content.

> **Start with [HUMANS.md](HUMANS.md)** — the guide to working with the living book as a reader, contributor, or editor (steering, generating, remixing, sharing, adoption). This file covers the low-level mechanics of content files and PRs.
>
> **AI collaborators:** read [AGENTS.md](AGENTS.md) — the facet metadata system is maintained by AI, and that file contains the binding decision procedures, calibration examples and autonomy boundaries. Humans own facts (contracts, core); AI owns metadata.

## Content types

| Type | Description | Frontmatter `type` |
|------|-------------|-------------------|
| Section | Educational content (the book's main text) | `spine` |
| Question | Interactive quiz with choices | `question` |
| Game | Click-based mini-game | `game` |

## How to contribute

### 1. Open an issue first
Use the [New Content Proposal](../../issues/new?template=new-content.md) template to describe what you want to add. This helps avoid duplicate work.

### 2. Create a branch
```
git checkout -b content/ch2-my-new-section
```

### 3. Write your content

Create a markdown file in the appropriate `content/chN-*/` directory.

**File naming**: `{order}{letter}-{type}-{slug}.md`
- Examples: `03a-spine-filter-bubbles.md`, `01c-game-signal-sort.md`

**Frontmatter template**:
```yaml
---
id: ch2-my-unique-id
type: spine
title: "My Section Title"
readingTime: 3
standalone: true
teaser: "One sentence preview shown on cards"
voice: universal
parent: null
diagram: null
status: draft
---

Your markdown content here...
```

**Required fields**: `id`, `type`, `title`
**Status**: Always set `status: draft` for new content. The main author will change it to `accepted` after review.

### 4. Add to book.json
Add your filename to the `files` array in the appropriate chapter in `content/book.json`.

### 5. Open a Pull Request
CI will automatically validate your content (frontmatter, unique IDs, references). Fix any errors before requesting review.

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

Place SVG files in `images/`. Reference from content via `diagram: my-diagram` in frontmatter.

## Style guide

- **Audience**: Kids ages 8-15
- **Tone**: Friendly, encouraging, never condescending
- **Reading time**: 2-5 minutes per section
- **Examples**: Use YouTube, TikTok, Spotify, Netflix — apps kids actually use
- **Avoid**: Jargon without explanation, long paragraphs, passive voice
- **Include**: Real examples, analogies, "try this" prompts

## Review process

1. Submit PR with `status: draft`
2. CI validates content structure
3. Main author reviews content quality and accuracy
4. Main author sets `status: accepted` and merges
5. Content appears in the book on next deploy
