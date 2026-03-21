# Contributing to "How Recommendations Work"

Thanks for helping make this book better! This guide explains how to contribute content.

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

Game types: `sort` (classify), `match` (find twin), `pop` (click to collect), `order` (sequence)

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
