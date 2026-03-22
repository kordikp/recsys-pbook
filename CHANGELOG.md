# Changelog

## v1.0.0 (2026-03-22)

First public release of the p-book standard and "How Recommendations Work" book.

### Content
- 83 content blocks across 6 chapters
- 35 core blocks (required for certificate), 48 detailed blocks
- 8 interactive mini-games (signal sort, taste match, bubble pop, pipeline builder, cold start, method match, A/B test judge, privacy spotter)
- 5 interactive questions with personalized feedback

### Reading Modes
- **Missions** — 6 story-driven learning paths with branching, guided wizard, boss quiz
- **Browse** — Netflix-style home with personalized shelves
- **Feed** — Infinite scroll chapter-by-chapter reading
- **Map** — Visual overview + detailed list with core/game badges
- **Tutor** — AI assistant (mock engine, ready for LLM integration)

### Features
- Gamification: XP, levels, 16 badges, completion certificate (SVG download)
- Spaced repetition: Anki-style recall with SM-2 algorithm
- Personalization: Recombee-powered recommendations with 5 scenarios
- 3 learning voices: Explorer, Creator, Thinker
- Knowledge cloud on profile
- Research analytics: per-interaction mode tracking

### Infrastructure
- Collaborative content workflow via GitHub (CI validation, status field, issue templates)
- Vercel + Netlify deployment with serverless Recombee proxy
- Local dev server with built-in proxy (serve-local.js)
- Bot/LLM interface: .well-known/pbook.json manifest
- Feature toggles: gamification, personalization, recall, missions, games — all optional

### Technical
- Zero dependencies (vanilla JS, no framework)
- Works without Recombee (local fallbacks)
- Content as markdown with YAML frontmatter
- Games as small JSON data files
- SVG diagrams
