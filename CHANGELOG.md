# Changelog

## v2.0.0 (unreleased)

The v2 brief: a coherent, accessible publication about modern recommender systems in which it is a joy to spend time — understandable for product owners and non-technical readers, with deep tellings for practitioners, one visual style, and humour where there is room.

_v2 is assembled from several parallel workstreams. Each adds its entry here when its branch merges; the reader-facing summary lives in the "New in version 2" section of the About block (`content/ch01-introduction/99-sidebar-about-this-book.md`)._

### Engine 7.11.0 (2026-10-31)
- **Topbar theme toggle**: light/dark is a moon/sun icon in the top bar. Picking what the device shows anyway goes back to following the device. The accessibility modes stay in Settings.
- **"Tell it differently" is compact**: a "Ways to read it" row of tellings, quick asks (simpler, deeper, more visual, my world) and the full compose matrix only on request.
- **Author studio**: paragraphs are edited in place (bold, italic, heading, lists, link, move, delete; Enter splits a paragraph). The header shows the ⚡ the studio has earned and the next milestone.
- **Gift ⚡ to a friend**: `/api/wallet` actions `gift`, `redeem`, `cancel` and `gifts`. A code or a `?dar=CODE` link, cancellable until redeemed, with daily caps for giving and receiving. A double redeem is settled by a nonce and a reversal row.
- **Profile for Tiny**: `js/tiny-profile.js` builds `metadata.pbook` v1 from a fixed schema, tested by `scripts/check-tiny-profile.mjs`.
  - It appears in Profile when `CONFIG.tiny` is set, and in "Download all data".
  - It is also stored as `profile_summary` log rows and in the account's synced data.
  - Missions keep `passedAt` and the best boss score.
  - A login merges passed missions, mission results and recall cards.
- **Security review** ([SECURITY.md](SECURITY.md)):
  - `/api/log` refuses server-owned rows (before this, anyone could mint ⚡ through it).
  - The public log list hides wallet rows (open gift codes), readers' free text and profiles. `?usage=1` gives the leaderboard counts only.
  - `/api/generate` no longer trusts `sourceHost` unless the request comes with `PBOOK_GATEWAY_SECRET` or reaches the gateway itself.
  - Anonymous AI trials are capped per network and day.
  - Logins brake after 10 wrong passwords.
  - Proposals, stats recompute and the Recombee sync need the editor key.
  - Provider error text stays in the server log.
  - `setup-interactions-table.sql` is new. Both SQL files keep RLS on with no policy (service_role key).

### Docs, prompts and front matter
- **About this book** (ch01, draft): authors and the Recombee disclosure, how the book is made (human-owned concept contracts, AI-maintained facets and drafting, AI-drawn figures reviewed blind and then by the editors, labelled reader-made tellings), how the book personalizes itself, how to cite it, licence, how to collaborate, and "New in version 2". It belongs to no concept (`concept: null`); `scripts/migrate-facets.js` keeps such front matter out of every concept's block list.
- **Generator prompts** (`api/generate.js`): the coach, seed, transform, map-analysis and games-review prompts no longer address Czech pupils aged 11-15. They read audience, title and language from the source book's `pbook.json`, so this book's reader-authors (product people, engineers, students) get an English coach by default or one in the language of their draft, while sister books that use this deployment as their gateway keep their own audience. Anti-ghostwriting rules are unchanged; the forbidden-claims rule now covers every one of these modes.
- **How to cite**: `CITATION.cff` (GitHub's "Cite this repository"), the same reference in the About block and in `llms.txt`.
- **`llms.txt`**: a generated chapter and concept index (`scripts/build-llms-index.js`) — each concept with its anchor's raw markdown, the question it answers and its `#c/<slug>` link; the unsourced customer count is gone.
- **CONTRIBUTING.md**: style guide for adult readers, distilled from AGENTS.md §7 and `content/correction-rules.json`; frontmatter template with concept and facet keys instead of the retired `voice`; the new-content issue template asks for the concept.
- Kids-era labels removed from `js/config.js` and the page keywords in `index.html`.

### Since v1.0 (spring–autumn 2026)
- **Concepts and tellings:** 14 chapters, 71 concepts with human-owned contracts (objective, must-cover points, recall question and answer, forbidden claims), 307 blocks, each a telling tagged with facets (example world, depth, formalism, visuality, length, genre, language, carriers) and allowed to cover ranges and sets.
- **Steering:** a tellings strip on every section, "simpler / deeper / more visual / my world" after reading, Format preferences that override the learned facet profile, and honest misses instead of silent near-matches.
- **Living book:** contract-constrained generation behind a validation gate, remix and insert of passages and diagrams, a community layer with a trust ladder (private → community → edited → core), earned and invited editorship, and concept proposals shown to readers as "proposed" cards to measure demand before writing.
- **Authoring:** the author studio with a writing coach that never writes for you, deliberately unfinished skeletons, form transforms and WYSIWYG figure editing; a server-side XP wallet pays for AI use.
- **Learning:** 12 missions with an AI examiner, a journey board with a mini-map, personal missions from a stated goal, spaced-repetition recall cards.
- **Editors:** the `/admin` console (demand, proposals, community, health, catalog, reach, studio, contacts).
- **Interop:** chapters and studio drafts export to SlAIdy decks and come back.
- Eva Nečasová joined as co-author; a "collaborate with us" contact form reaches the authors.

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
