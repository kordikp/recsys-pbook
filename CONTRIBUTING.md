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

1. Create a JSON file in `games/my-game.json`:
```json
{
  "type": "sort",
  "title": "My Game",
  "instruction": "What the player should do",
  "buckets": ["Option A", "Option B"],
  "items": [
    { "text": "Item text", "answer": 0 }
  ]
}
```

Game types: `sort` (classify), `pairs` (match term and definition), `match` (find your taste twin), `pop` (click to collect), `order` (sequence)

Every item must have exactly one answer an expert would accept. If a fair expert could argue for another bucket, rewrite or drop the item. In the PR, give a one-line reason for each answer so the reviewer can check it.

2. Create a content file referencing it:
```yaml
---
id: ch2-game-my
type: game
game: my-game
title: "My Game Title"
status: draft
---
```

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
