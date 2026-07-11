# Editorial Log

Records of content decisions, quality checks, and open issues.

---

## 2026-07-05: Living Book v2 — facets, steering, generation, community

**Status:** Implemented (P0–P2 of `_design-collective-pbook.md`)
**By:** Pavel + Claude (Opus 4.8)

### What changed
- All 215 blocks migrated to the facet schema (flat keys: `concept/state/lens/visuality/depth/formalism/lengthBand/genre`); `voice` kept for back-compat. Migration: `scripts/migrate-facets.js` (idempotent).
- 70 concepts extracted with contracts bootstrapped from human-reviewed frontmatter → `content/concepts.json`. Contract gaps (3 without recallQ, 2 without mustCover) are flagged in Admin → Coverage.
- Reader profile v1 (facet affinities + onboarding lens/goal + transparent profile with corrections + safe/open mode).
- Steering knobs on spine blocks with retrieve-before-generate cascade; unmet demand logged as `steer_miss`.
- `/api/generate`: segment-scoped variant generation, anchored concepts only, contract + correction-ledger prompt, validation gate. Correction ledger seeded: `content/correction-rules.json` (arbiter-owned).
- Share gate (anonymous default) → community layer as Recombee items (`state="community"`); home shelf "From fellow readers"; nomination queue in Admin → Coverage (adoption K=5 distinct readers).
- Tiered certificate: Foundations (54 standard core) / Practitioner (+12 technical, +2 missions) / Guru (+8 research, +1 Advanced boss, +10 recalls).
- Validator extended: facet enums, validity rules, concept refs, contract gaps.

### New editorial duties
1. **Coverage tab** (admin) is the cockpit: fill ⚠ contract gaps, watch steering-demand misses (the to-write list), review the nomination queue.
2. **Adoption flow:** nomination queue → download .md → review against the concept contract → place into `content/chNN-*/`, add to book.json, `status: accepted` → run validation → Sync Items.
3. **Correction ledger:** when a promotion diff shows a recurring fix, add a distilled rule to `content/correction-rules.json` — the generator stops making that mistake.

### Open
- [ ] Write contracts for the 3 concepts without recallQ (see Coverage ⚠)
- [ ] First lens variants for the highest-demand concepts once steering data accrues
- [ ] Netlify mirror of /api/generate + /api/boss (currently Vercel-only)

### 2026-07-05 (iteration 2, after first hands-on test)
- Steering moved to the **end** of each block ("How was this telling?"); top shows only a slim tellings indicator.
- **Tellings panel**: readers see existing variants (with state badges) before generating; generate CTA lives inside it.
- Fixed the silent-swap bug: an explicit steer (world/depth/visual) now requires the candidate to actually move on that facet — otherwise honest miss + panel + demand log. (Previously "ecommerce" served another generic block at 0.86 match and generation never surfaced.)
- **AI examiner** for mission bosses (`/api/boss`): grades substance, quotes the student's phrasing, probing follow-up on "almost"; keyword check remains the offline fallback. Verified prompt-injection-resistant.
- **🌱 Living book map** (reader-facing, Map view): concepts × worlds grid, gaps as clickable ＋ invitations; reader's world highlighted.

### 2026-07-05 (iteration 3 — remix)
- **✨ Remix**: select any passage (core/edited/generated) → selection popup or right-click → describe the change → improved version as a **private copy** with the changed span highlighted amber + "✨ your remix" badge. Original untouched. Re-remix edits in place; wish history kept (`remixLog`).
- **Wish before generating**: optional free-text input in the tellings panel refines the generated telling within the contract; wished variants get separate cache cells.
- Both scoped hard server-side (style/examples/focus only, injection-tested) and shareable through the standard ladder with remix provenance (`remixOf`, `remixLog` → visible in nomination queue).
- Editorial note: remixed community blocks carry the reader's wishes — useful review context (what readers actually wanted changed).

### 2026-07-06 (iteration 4 — overnight)
- **✨ Diagram/animation remix**: hover ✨ on any diagram → wish → modified inline SVG (animations included), double-sanitized, marked with a dashed amber outline; shares through the same ladder (`diagramSvg`).
- **Onboarding**: two-tap world+goal with live preview line, and a **🌱 Living book opt-in** on the welcome screen (open mode from the first minute).
- **Profile → Reading DNA**: visual facet-affinity bars (📌 = explicit pin) + living-book contribution summary.
- **Admin → Health**: per-block reader-signal table → transparent problem score → **⏸ Park** (clipboard `sed` for the file change) and **✨ AI rewrite from signals** (→ `.md` with `status: review`). "Most read right now" strip shows what readers actually read.
- **Paper** (`../paper-umap/pbook-recsys26.tex`): added contribution (4) living-book layer, §2.5 *A Living Book: Steerable Tellings and Community Co-Creation*, a demo-loop item (steer → miss → generate → remix → share → nomination queue), extended Outlook research questions. Compiles clean, 3 pages.

### 2026-07-06 (iteration 5 — breadth showcase + subspace model)
- **Subspace coverage**: blocks now declare ranges (`depth: standard..technical`) and sets (`lens: ecommerce|media`) — matching, steering, coverage map, admin matrix and validator are all subspace-aware. Dimensions acknowledged as non-orthogonal by design.
- **New dimensions/values**: `lang` (en/cs), `lens: jobs`, `genre: comic`, `genre: animation` (comic/animation are hand-crafted only — excluded from the generator's vocabulary).
- **Tellings panel → dimension picker**: readers explore World/Depth/Form/Genre/Language/Length; per-value coverage counts, ＋ = invitation. Steering to any value via `steerDim` (honest miss preserved).
- **`item-cold-start` showcase** (ch02, 14 tellings): anchor, TL;DR, long-form story, formal (blend equation), visual, comic (4 panels), 3 animations (shop/media/jobs), 3 domain texts, 2 Czech variants. 5 new hand-crafted minimalist SVGs (`cold-start-bridge`, `comic-cold-start`, `anim-cold-start-{shop,media,jobs}`) — checked XML-valid, no scripts, computed layouts (no overlaps).
- Corpus: 229 blocks, 71 concepts. Validation clean.

### 2026-07-06 (iteration 6 — AI collaborator instructions + comic/story rewrite + coverage map v2)
- **AGENTS.md**: binding instructions for AI collaborators. Facet metadata is AI-owned by design (humans can't be asked to maintain it); the file gives operational decision tests per dimension (not descriptions), a subspace declaration rule ("a promise to readers at every covered cell"), 7 calibration examples from the real corpus, a re-tagging duty table (what body change triggers which re-check), autonomy boundaries (may / must-ask / never), and the one invariant (every telling answers its concept's recallQ). Linked from llms.txt, CONTRIBUTING.md, pbook.json.
- **Self-test of the instructions**: applied the §2 procedure to two heuristic-tagged blocks → two defensible subspace corrections (`ch4-multi-objective`: research → technical..research; `ch1-patterns-d-think`: technical → standard..technical). The procedure produces different (better) results than the migration heuristics — as intended.
- **Comic rewritten** (idea + execution): "The New Kid" — teacher-as-recommender classroom metaphor with a real punchline (the next new kid at the door: cold start never ends); clean vector style, no emoji. Lens: education.
- **Story rewritten** (execution): "The Case of the Invisible Bestseller" — detective frame, dialogue, concrete numbers, no pathos. Lens: ecommerce.
- **Coverage map v2**: dimension switcher (one dimension at a time), per-value coverage summaries, collapsible chapters, "only gaps" filter, and a **cell inspector** — click any cell to see exactly which tellings are assigned there with their full subspaces (the transparent answer to "kam item patří").

### 2026-07-06 (iteration 7 — click-test fixes)
- **Quiz crash fixed**: recall cards may reference reader-generated variants; all recall paths now resolve via `_findAnyBlock` (covers private/community) + null guards; orphaned git-id cards self-prune on quiz open. (The 401s on `/.netlify/functions/recombee` are a separate, harmless dev issue: RECOMBEE_TOKEN in `.env` is being rejected — client disables itself and falls back locally.)
- **Feedback bar** ("How was this telling?"): ✕ dismiss + auto-fades 25 s after becoming visible if untouched; any interaction pins it.
- **Visuality audit** (per AGENTS.md deletion test): full-corpus recompute → git corpus already clean (clear gap: visual blocks ≤76 words vs balanced ≥216). The mislabels came from **generated** blocks tagged with the *requested* visuality → server now applies an **honest-visuality clamp**: generated text is never `visual-first` — `balanced` only with a real markdown table, else `text-first` (verified E2E); cache id keeps the requested cell, tags never lie. Tellings panel explains the ceiling and points to diagram remix.
- **Coverage map v2.1**: chapters collapsed by default with a per-value **heat strip** in each summary; dot clusters replaced by a single count badge tinted by strongest state (breakdown in tooltip + inspector) — the map no longer reads as "supplementary content dots".
- **AGENTS.md**: new *Chapters* section — blocks inherit their concept anchor's chapter (facets never move blocks); stop-test for placing new concepts ("could a reader who stopped at ch N−1 understand this?"); new chapter = arbiter decision with ≥3-concept threshold. Re-tagging duty table extended with the concept-reassignment row.
- **Comic v3 — "Find the Tribe"**: previous classroom version told the metadata-bridge story and confused the exploration point. New arc per Pavel's framing: *no idea who'll like it → offer to a small varied sample → the triangle tribe lights up (2/2 vs 0/2 tally) → serve everyone similar (circles left alone)*. Two visual tribes (badge shapes), drawn hearts, results board; block retagged lens: generic, recallQ now about audience discovery.
- **HUMANS.md**: the human mirror of AGENTS.md — one file, three nested roles. Readers: steering, generation/remix, sharing, certificates, data transparency. Contributors: three contribution paths (flag → share tellings → author PRs), the craft rules (serve a concept's contract, write for a segment, honest facets via the AGENTS.md tests, style distillate), licensing. Editors: the four admin boards, a 7-step adoption checklist (contract check → facet honesty → voice pass → provenance → placement → sync; adoption ≠ core), arbiter-only boundaries, `_editorial.md` as the log of record. Linked from README, CONTRIBUTING, pbook.json (`human_guide`).

### 2026-07-06 (iteration 8 — remix fix, article-row map, multi-concept, paper figure)
- **Remix "no content in response" fixed**: gpt-5-family are reasoning models — hidden reasoning tokens count against `max_completion_tokens`, so the 1600-token remix budget returned `finish_reason: length` with EMPTY content. Budgets raised (remix 6000, boss 4000) + an automatic once-retry at 4x budget on empty-content-with-length in `api/generate.js`. Verified E2E (running-shoe-shop remix, 384 chars).
- **Forms no longer hide under the bottom nav**: `scroll-margin-bottom: 110px` on share-consent/remix-form/tellings-panel/gen-offer + `scrollIntoView block: 'center'`.
- **Living-book map = article rows**: every telling (git + yours + shared, placed via its concept's chapter) is one row; dots mark the values its subspace covers under the selected dimension; dot color = trust state; chapter heat strips; per-value totals in the header. Concept-level aggregation moved to admin.
- **Multi-concept membership** (`concept: a|b`): parser/indexing (`_conceptIds`, block appears in every pool), validator (each ref must exist), migrate (block listed under every named concept in concepts.json), AGENTS.md §4 rule (recallQ test must pass for EVERY listed concept; primary first; >2 memberships = split the block). Admin Coverage got a "Concepts → articles" aggregated section (articles repeat under each concept, `multi` badge).
- **Deep link `#coverage`** (map → living book, first two chapters opened) — used to capture `figures/pbook-coverage.png` via headless Chrome for the paper; paper got the figure, a multi-concept-subspace sentence, and a style pass matching Pavel's co-authored papers (declarative openings, "we argue/propose", citations attached to claims, aphorisms toned down).

### 2026-07-08 (iteration 42 — profile latency)
- "Otevřít profil trvá věky": profile stats iterated the whole interaction history calling findBlock() — a linear scan of the 307-block catalog — per row, and Recently-viewed re-scanned unresolvable ids on every occurrence. findBlock now rides a Map index (rebuilt only when catalog size changes), _findAnyBlock uses it, history memoizes misses. Every findBlock call site in the app benefits.

### 2026-07-08 (iteration 41 — remix draws real diagrams)
- Pavel asked a remix for a "schema diagram" and got ASCII arrows — the remix path was text-only. Now a diagram/schema/animation wish makes the server draw a real supporting SVG (design system, from the rewritten passage; best-effort — its failure never sinks the text), the client attaches it via diagramSvg, and the remix prompt forbids ASCII art. Note: Mermaid is NOT supported in the renderer (code blocks are plain <pre>); the generated-SVG path covers the need with on-palette output.

### 2026-07-08 (iteration 40 — admin load time)
- The content archive made GET /api/log heavy (425 kB, growing ~60 kB per saved block) and admin pulled it from six call-sites behind a serial waterfall. Server now slims archive rows in list responses (body→240 chars + bodyLen, svg stripped + hasSvg; ?full=1&blockId= returns one full row), admin shares a single cached log fetch and boots concepts+Recombee+log in parallel, previews lazy-load full content on expand. Admin endpoints moved off the legacy /.netlify path.

### 2026-07-08 (iteration 39 — reading history + one-click adoption)
- Profile "🕘 Recently viewed" (last 12 unique blocks from the interaction log, ✏️ marks blocks with your edits, click returns) — born from Pavel arrow-hopping a chapter away from a block he was editing and not finding it again.
- Admin adoption stopped being a .md-download ritual: Community cards flip the trust state directly (✓ Adopt → edited · ★ Promote → core · ↩ back to community) via the Recombee proxy + archive log; serving honors the ladder immediately — the shared-layer fetch pulls community+edited+core (runtime gen--/remix-- ids) in open mode and edited+core FOR EVERYONE, so adopted tellings reach all readers without waiting for git. The .md download stays as the canonical-git path (core content should still be committed).

### 2026-07-08 (iteration 38 — durable creations: Supabase archive, sticky telling choice, admin private-layer view)
- Pavel: "kam se to ukládá? po reloadu všechno zmizí; admin komunita je divná." Diagnosis: private blocks DO persist (localStorage) but the reader's telling CHOICE didn't — after reload the original renders and the variant hides in the panel; admin Community listed via personalized recomms (nondeterministic) and the private layer was invisible.
- Fixes: (1) per-concept telling choice persisted and re-applied after each chapter render (unswap clears it); (2) every block save (generated/remixed/manual-edit/accepted/shared) archives to Supabase via /api/log as a block_saved content event — device-loss-proof, and the full body/svg/wishes travel; (3) admin ⚡ Community merges Recombee with the archive (deterministic), cards get content previews incl. visuals, and a new "✏️ What readers are editing" section shows recent private-layer activity with action badges.

### 2026-07-08 (iteration 37 — tellings strip + attached diagrams for text tellings)
- The full-config rows from v4 made the panel a wall — replaced by a one-line coverage strip (state-colored chips with genre icons, tooltip carries title + full configuration, click to read, ring = reading now).
- Visual carriers finally bind the TEXT path too: requesting diagram/image/animation with a text genre makes the generator attach a supporting SVG (design system; animated variant when the animation carrier is asked), validated + sanitized, rendered via the diagramSvg pipeline; honest carriers/visuality; markdown image links in generated bodies are now rejected (they used to render as nothing — Pavel's "model maybe drew it but the article didn't show it").

### 2026-07-08 (iteration 36 — tellings panel v4 + real comic/animation generation)
- Pavel's field test caught two panel sins: the selected-chip CSS rule targeted the wrong container (selection had no visible state), and requesting genre animation silently clamped to explainer — exactly the "silent substitution" the book forswears. Fixed both: filled-accent selection, ◉ + green ring marks what the CURRENT telling covers, legend line, and telling rows now show their full compact configuration.
- The generator grew a visual path: genre comic → four-panel SVG, genre animation → 800×420 animated SVG (visible at rest, one subtle loop), both in the design system, validated (XML shape, size cap, no image links, forbidden-claims scan), sanitized server-side, honestly tagged visual-first with carriers animation|prose / image|prose, delivered through the existing diagramSvg inline pipeline. E2E: long-tail × media × animation from the runtime model produced an on-system three-panel animated explainer.

### 2026-07-08 (iteration 35 — Browse tiles get artwork)
- Netflix-style tiles were text-only even when the item IS a comic. cardHtml resolves each block's visual (first in-body image → comics/kids/photos; else the section's diagram via DIAGRAM_FILES) and layers it translucently behind the tile text: cover-fit, right-anchored, gradient-masked so the text column stays clean, lazy-loaded. 52 home tiles pick up art at once; comic tellings finally look like comics on the shelf.

### 2026-07-08 (iteration 34 — image audit ×42, community-share funnel fixed)
- **Pavel's "shared but admin Community is empty"** decoded from the logs: remix_accepted(share:true) events existed with NO community_share ever following — the consent box (nickname + Share button) rendered after the block footer, below the fold; readers believed they had shared. Consent is now the same floating bottom sheet as the accept bar (+ share_consent_shown event for funnel debugging). Recombee prod DB had 0 community items, confirming no share ever landed; the write path itself replays clean.
- **Image audit**: all 99 non-comic SVGs reviewed on contact sheets (Claude session limit killed the verify-agent workflow mid-morning — audit done inline instead). 42 sent to gpt-5.6-sol via new scripts/improve-images.js: 38 restyles (teal→system, black panels→light cards with purple borders, micro-text ≥11px, seven concrete collision fixes) and 4 rebuilds of opacity-gated broken files (feedback-loop, pipeline-animated, both heroes). Verified on re-rendered sheets; two micro-collisions fixed in a follow-up pass. kids-* kept their intentional children's style.
- Also this morning: content freshness fix (SW network-first /content/* + must-revalidate edge headers) after the comics "nowhere to be seen" hour-stale book.json.

### 2026-07-08 (iteration 33 — one-button editing + 70 GPT-5.6 comics)
- **Editing friction audit → one entry point.** Manual editing did not exist (AI remix only) and remixing required a text selection (painful on mobile). Now every section footer has a visible "✏️ Improve" button and the selection popup's ✨ became ✏️ — both open ONE combined form: an editable source-markdown box ("Save my edit" — instant, no AI, works even without generation configured) plus an AI wish field ("AI rewrite"). Manual edits ride the exact same pipeline as AI remixes: prefix/suffix diff marks only the changed span, floating Accept / Accept & share / Discard, persistent override, provenance (remixLog notes "(manual edit)"). Sharing to the community and editor review therefore work identically for both paths.
- **Comics for every concept (70 new, gpt-5.6-sol).** Offline generator with a locked minimalist design system (fixed 2×2 panel grid, palette, char budgets, text zones) so the model's quality shows in the writing: dry double-meaning stories where the everyday scenario IS the mechanism ("Your Usual Has Been Expecting You" — digital twins; "Mine searched me back." — search-vs-recs; "The clone is extremely agreeable."). Three QA rounds with a 12-agent visual-verification workflow over full-size renders: 70 → 27 flagged (px-level text overflows, two blank panels) → regenerate with per-comic feedback → 7 → 0. Registered as tellings (genre comic, visual-first, tl;dr) after each concept's anchor; catalog 237 → 307 blocks; validation PASSED.
- Runtime generator default switched to gpt-5.6-terra (Vercel env OPENAI_MODEL still pins gpt-5-mini and overrides — Pavel to update). Lesson recorded: never hand-type an id list into a workflow — the first QA run checked 58 nonexistent files because ids were typed from memory instead of read from concepts.json.

### 2026-07-07 (iteration 32 — Accept&share pipeline fixed for real, open mode default)
- Pavel's "title undefined + original content + no nickname choice + admin empty" after Accept&share = two stacked bugs: (1) _rerenderBlockInPlace fed findBlock's {meta, body} shape to renderSpine which expects flat blocks → undefined id/title and the override lookup missed (original body shown); (2) acceptRemix didn't await the re-render, so the share-consent box attached to an element that the in-flight outerHTML replacement then destroyed — the nickname/anonymous dialog never survived to be seen, so nothing was shared. Fixed: flatten + await + consent after settle; remixes of generated/community tellings skip the override (git-only) but still share.
- "Second Generate press did nothing": swap replaces b-<original> with b-<variant>, and every subsequent swap/serve looked up the original element only. New slot map (_slotDom) tracks the CURRENT DOM id per logical block; swap chains, unswap and rerender maintain it.
- Living book (open mode) defaults ON — new profiles start open, existing 'safe' profiles migrate once unless the reader explicitly chose (setReaderMode marks the choice), onboarding checkbox pre-checked. app 5.5.3 / SW v15.

### 2026-07-07 (iteration 31 — reversible "show original" + RECOMBEE.md field manual)
- Pavel caught a one-way door: "show original" silently dropped the accepted edit. Now it's a reversible TOGGLE (your version stays saved; the original view shows "📄 Original — your edited version is saved · ✨ show your version"); the only irreversible action is a separate "🗑 discard your edits (permanent)" with a confirm dialog. Accepting again re-enables the view.
- **RECOMBEE.md** field manual for AI assistants distilled from the 404 saga (statuses are semantic — read the body; define item AND user properties; server-side HMAC proxy with passthrough; POST-only clusters; /batch/ sync; retry policy; 7 anti-patterns with price tags; bootstrap checklist) — linked from AGENTS.md. Public AEO twin published to the Recombee wiki (content/recombee/integrating-recombee-with-ai-coding-assistants.md, llms.txt indexed, pushed to marketing main).

### 2026-07-07 (iteration 30 — 404 SOLVED: undefined Recombee user properties)
- The x-vercel-id instrument did its job in one round: Pavel's 404 carried `fra1::iad1::…` → genuinely from Vercel → replayed his exact call → `{"message": "user property \"prefLens\" does not exist!"}` HTTP 404. **Recombee 404s writes to undefined USER properties and the proxy passes the status through** — the console's "POST /api/recs 404" pointed at routing while the body named the culprit all along. My curls always hit endpoints that don't touch user properties, hence unreproducible.
- Fix: sync-recombee now defines all user properties (pref* for every taxonomy dimension, goal, readerMode, voice, level, xp) — run against prod; the failing calls now return 200/ok. Client api-warn includes the response BODY so the next mystery names itself. Module v=8.
- Lesson for the log: when a proxied status confuses, read the proxied BODY first.

### 2026-07-07 (iteration 29 — remix UX hardened after field test; 404 forensics instrumented)
- Pavel's live test exposed two real remix bugs: (1) a replacement containing paragraph breaks broke the highlight at the first </p> — only a fragment looked marked → paragraphs are now marked one-by-one; (2) the located span could cut **bold** in half leaving stray ** in the text → span snaps outward over markdown punctuation. (3) The Accept UI was missable → replaced by a floating bottom sheet fixed to the viewport (with − old / + new diff), removed on decision.
- The 404 (now also on the neutral /api/recs → the "recombee-string blocklist" theory is DEAD) is unreproducible from here in any browser/UA combination; instrumented the truth: every non-OK proxy response logs its x-vercel-id header — a 404 WITHOUT it can only come from something between his browser and Vercel. Offline queue settles entries on any HTTP response (retry only 5xx, ≤3 tries) — ends the console spam loop.

### 2026-07-07 (iteration 28 — the 404 mystery solved: blocklists eat "recombee" paths)
- Pavel's persistent /api/recombee 404 (even incognito, while curl returns 200 and generate/log work) = **path-based ad/privacy blocklist** matching the substring "recombee" in first-party URLs. Fix: neutral alias **/api/recs** (same handler via require re-export), client switched, legacy path kept. serve-local route added; versions bumped (app 5.5.0, module v=7, SW v12).
- Remix preview: decision bar now includes an explicit **− old / + new diff** so subtle edits are unmissable; community share failure remains a visible toast. (His "community 0" traces to the blocked share POST — unblocked by the alias.)

### 2026-07-07 (iteration 27 — remix accept flow: preview → accept → organic override)
- **Per Pavel's morning feedback**: remix output is no longer a fire-and-forget swap. Text and diagram remixes open as a PREVIEW with a sticky decision bar (✓ Accept · ✓ Accept & share · ✗ Discard). Accept persists an override (originalId → reader's version) so the accepted copy becomes an organic part of THEIR book: rendered under the original block id (progress/recall intact), highlights visible, ↩ revert and 📣 share links in a slim bar. Accept & share opens the existing consent flow — the reader's PROMPTS travel via remixLog and admin Community cards now show "🎯 what the reader asked for" + remix-of provenance; Health cards list recent remix wishes per block.
- Fixes: renderReadNext crash (generated/remixed blocks have no chapter entry — guarded); rc.api quiet single retry on transient 404/5xx (Vercel deploy windows) + timeout 2.5 s; SW caches only same-origin GETs (browser-extension chrome-extension:// requests were throwing in console), cache v11; share-consent resolves overridden articles via remixOf.

### 2026-07-07 (overnight — iteration 26: visual QA program, remix fix, content fill)
- **Critical editor-flow fixes shipped first** (prod verified): remix "could not locate the selected passage" — selections come from rendered text, source is markdown; new alphanumeric-stream locator with offset map splices the mark and sends the exact SOURCE slice to the model (E2E on the exact failing pattern from Pavel's report: ok). Client endpoints /.netlify/* → /api/* — Vercel 404s dot-paths, which had silently disabled Recombee AND logging for all production readers; after the fix both scenarios serve and interactions write (548 rows history in Supabase).
- **Visual QA of all 99 SVGs** (headless render at t≈5s → contact sheets → eyes on every one): diagram-*/comic-*/kids-*/hero-* healthy; the whole anim-* family (32) was sick — elements resting at opacity:0 with long dead gaps (blank for reduced-motion/static), teal-navy palette, black ► glyphs, invisible curves. **All 32 rebuilt** on one design system: light card (#FAFAF7), ink #1E1B4B, purple/green/amber accents, EVERYTHING readable at rest, one subtle loop (dash-flow/pulse/slide), no text overlaps. New pedagogy in several (A/B causal gap, correlation-vs-causation seesaw, funnel economics, MF with real numbers, SAE knobs before/after, rabbit-hole adjacent-exit, media cold-start hand-off).
- **8 new tellings** filling measured gaps (social-feeds & education had ZERO): filter-bubbles×social-feeds story, CF×jobs worked-example + Czech tl;dr, feedback-signals×social-feeds tl;dr, explore-exploit×media story, ab-testing×ecommerce worked-example with a returns-spike lesson, long-tail×media tl;dr, embeddings×education explainer. All contract-consistent, registered after anchors, validation PASSED.
- Admin + app headless smoke: zero console errors. Pushed in 6 commits; production serves the new client, animations and content.

### 2026-07-06 (iteration 25 — production integrations live)
- **OPENAI_* env added by Pavel** → after redeploy /api/generate reports available (openai-compatible, gpt-5-mini): generation, examiner, remix and concept drafting now work IN PRODUCTION.
- **Supabase woken from pause** (the real cause of dead logging) → /api/log inserts OK; GET returns 548 historical interactions — Demand/Reach/Health/Analytics have real data. log.js hardened (always-array GET; POST errors distinguish key/RLS vs unreachable/paused).
- **Recombee prod verified working** (recomms returns items) BUT the newer cluster rejects ALL GET requests (405) → community listing rewritten to POST /recomms with filter + returnProperties (client + admin). Community filter initially failed with "Property 'state' not found" — the prod DB had never been synced.
- **Sync Items 404 root cause**: api/sync-recombee.js was in .gitignore since April (once held a secret; env-only now — verified) so it NEVER deployed. Force-added, stale ignore rule dropped, catalog sync run against prod DB.
- Security note: RECOMBEE_TOKEN + SUPABASE publishable key were pasted into chat — recommend rotating the Recombee token after setup; suggest setting SYNC_SECRET (sync endpoint is currently open).

### 2026-07-06 (iteration 24 — admin actions, honest read metrics, prod env audit)
- **Proposals: editor-seeded drafts** — describe the concept in your own words, pick a chapter or FOUND A NEW ONE (chNN-slug input; stop-test reminder), AI completes the full contract (server propose-concepts got `count`; E2E: "delegated-recommendations → ch15-agents"). Results merge into the proposals.json export.
- **Catalog v2**: dimension switcher (lens/depth/visuality/genre/lang/carriers — no longer domains-only), articles MERGED into expandable concept rows (one view, as asked) with ↗ in-book preview links and the contract's recallQ, gap cells = ＋ button that downloads a prefilled telling skeleton (concept, facets, contract bullets). "＋ Propose new concept" links to Proposals.
- **Health/Analytics**: every block now shows served → finished / skipped (threshold = min(12 s, 15 % reading time)) in Most Read and in problem cards; timeline "Invalid Date" guarded (rows without ts show —).
- Concept renames (question-titles violated the naming rule): platform-models → distribution-models, data-detective → algorithm-training.
- **Prod audit**: /api/generate → available:false (no key), /api/log → [] (Supabase env missing). api/log.js already speaks Supabase (table `interactions`, service key envs SUPABASE_URL/SUPABASE_KEY). Prepared no-echo env upload script (scratchpad/vercel-env.sh) pending Pavel's `vercel login` device-code confirmation.

### 2026-07-06 (iteration 23 — panel v3 (compose form) + SHIPPED to production)
- **Tellings panel v3** per Pavel's mental model: no accordion — ALL dimensions visible at once as a form PRE-FILLED FROM THE PROFILE; clicking only changes the request (compose-only, no silent swaps mid-composition; carriers stay multi-select; deselect returns to the profile default). Below the form the honest outcome: target covered → "✓ Covered: <best telling> (N% match) [Read it]"; real gap → optional note + "✨ Generate exactly this". Legacy pickDim aliased.
- **Deployed**: asset versions bumped (app.js 5.4.0, css 3.6.0, SW cache pbook-v10) and pushed to github.com/kordikp/recsys-pbook (3 commits: content+schema / platform / docs) → Vercel auto-deploy to recsys-pbook.vercel.app. Paper Source URL fixed to the actual repo.

### 2026-07-06 (iteration 22 — deployment prep: viral loops, invites, admin pipeline)
- **Invite system**: `?invite=R-…` friend referral (+25 XP welcome toast, invite_accepted logged with code → conversions per code in admin) and `?invite=E-…` **editor invites for seniors** — sets the 🛠 editor role on arrival (pbook-role), editor console + duties linked from Profile, editor_invite_accepted logged. Editor invite links are generated in admin → 📈 Reach. Personal invite link + copy/native-share buttons in every Profile.
- **Share moments** (pochlubit se rozšířením): shareThing helper (native share sheet → clipboard fallback, logged); per-telling 🔗 share on the reader's community-shared blocks; "📣 Brag about your adoption" when a telling makes it into the book; personal-mission-complete share. All deep links use #blockId.
- **Admin refactored to the content-lifecycle narrative**: tabs now read 📥 Demand (steering misses + concept wishes + learning goals) → 🌱 Proposals (interest-tested ghost items + AI drafting) → ⚡ Community (nomination queue) → 🩺 Health → 📚 Catalog (matrix + concepts→articles; "editors go first" note) → 📈 Reach (growth stats, top-contributor board, editor-invite generator, analytics) → ✍️ Studio (the old editor) → ⚙️ More (legacy tools + how-it-works). renderCoverage split into four focused renderers over the shared data loader.
- **Deploy polish**: og-cover.png (1200×630 — scrapers don't render SVG), og:title fixed, twitter:image → png; paper demo URL → recsys-pbook.vercel.app; README deployment section (env vars, first-run Sync, growth loops, editorial rhythm).

### 2026-07-06 (iteration 21 — panel UX: concept-keyed target, multi-select blocks, honest toggles)
- **Composed target now keyed by CONCEPT, not by displayed block** — it survives swaps, the "Original" button, and opening the panel from any other telling of the same concept (this was the "click back → resets to default" bug: every swap minted a fresh panel state). gen-wish text keyed the same way.
- **🧩 Blocks are multi-select**: clicking carriers values toggles them in/out of a set (`diagram|table`); matching gives fractional credit (share of selected blocks present); the target chip shows "diagram + table". No serve round-trip on toggle — the panel just updates.
- **Deselect is explicit and predictable**: clicking an already-selected value removes the override (falls back to the profile default, which stays visible as a dimmed chip); reset ↺ clears the whole request. Generation hint updated: text can deliver prose/tables/formulas/code, not new diagrams or images — for those, remix an existing diagram.

### 2026-07-06 (iteration 20 — Fig 1 v2 + personal mission in the paper)
- **Fig 1 v2**: home screen recaptured at 560px viewport (pickers on one row, 2×2 paradigm tiles, the personal-mission goal field visible), badges rebuilt as pre-rendered composites with gravity-centered letters (C/D centering fixed), C placed right of the Missions title, D right of the Quiz header. Composite 2248×1106 (2.03:1), teaser at 0.78\textwidth.
- **Paper**: §3.3 instrument paragraph now includes personal missions ("The reader can also state a learning goal in one sentence; the book then composes a personal mission from the concepts that match the goal, ordered the way the book teaches them."); compensating trims kept the body on p4.

### 2026-07-06 (iteration 19 — Fig 1 regenerated, plain-English pass, personal missions)
- **Fig 1 rebuilt from CURRENT screenshots**: 3 phone shots @2x via headless Chrome (home with world/goal pickers + Living book + paradigm tiles; Missions list; seeded Quiz with due cards & confidence map), composed with red A/B/C/D badges like the original. Infrastructure added: generic `#view-<name>` deep links and `?seed=demo` booth/screenshot seeding (12 real read blocks, 8 recall cards, XP — real ids, or the stale-ID sanity check wipes it; guarded by its own flag because UserModel saves before init). Old asset kept as pbook-annotated-old.png. Teaser at 0.78\textwidth (new 1.86:1 ratio at same height as before).
- **Plain-English pass** (Pavel: no lofty words, readable for non-natives): genuine(ly)→real/actually, lattice→grid, exogenous→"given from outside", instantiates→implements, "right of first refusal"→"existing content is served first", consent-gated→"requires explicit consent", gates→controls, distilled→short/become rules, "rides in"→"is included in", "book proper"→"the book itself", zero-result analogue phrased simply. Terminology (mint, honest miss, carriers, provenance) kept — defined at first use.
- **🎯 Personal missions** (Pavel's idea): the reader states a learning goal (optional onboarding text field, or Missions view anytime); the book composes a mission from matching concepts — keyword scoring over contracts (id/title hits ×3, light stemming, threshold ≥2), top 6 ordered by book order, anchors as steps; completing all steps = +50 XP. Works offline; LLM re-ranking is the natural upgrade. Persisted (personalMission in UserModel), logged (personal_mission), editable/clearable. HUMANS.md documents it.

### 2026-07-06 (iteration 18 — composed generate target + carriers as preference)
- **Tellings panel = request builder** (Pavel: "genre story + language cs ... vsechny hodnoty se aplikuji"): the panel target is now COMPOSED and STICKY — the profile seeds it once, every dimension the reader picks (steerDim) writes into it, and serving + generation use the full vector. The target row shows ALL dimensions as chips (profile defaults dimmed, reader picks highlighted, each clickable to change, ↺ reset), CTA reads "Generate exactly this"; the gen-wish text survives re-renders. steerDim no longer rebuilds the target from the current block. Paper §3.2: "Requests compose: the profile seeds a default target vector, any number of dimensions can be overridden per request (genre story + language Czech + world e-commerce), and the composed target stays visible and editable before anything is served or minted."
- **Carriers as a preference too** (Pavel): added `image` value (69 blocks re-derived — markdown images now distinct from SVG diagrams); "never hand-tagged" dropped from the paper row and AGENTS softened (derivation is the default; hand edits just get overwritten next run). Readers can now PIN a preferred building block: Profile → Format preferences 🧩 row, panel dimension picker 🧩 Blocks, match weight 1.5, preference-only (no default = no constraint).
- Page budget held by real deduplication (§4 metadata-first sentence now defers to Table 2, editorial remedies tightened): body p1–4, refs p5, 0 overfull.

### 2026-07-06 (iteration 17 — carriers dimension + voices retired for real)
- **`carriers` — building blocks as first-class values** (Pavel: "nechceme prose, tables, diagrams... dostat do values?"): new set-valued dimension `prose|table|diagram|animation|formula|code`, **mechanically DERIVED from content** by migrate-facets on every run (the one exception to never-overwrite; hand-edits are pointless and AGENTS forbids them). Composition lives in carriers; intensity stays on the two ordered axes (visuality = how much visuals bear the point, formalism = math). Wired: config (derived flag), migrate derivation, validator enum, 🌱 map "🧩 Blocks" view, Recombee item property, paper taxonomy row. All 229 blocks tagged.
- **Voices → facets, the real refactor** (Pavel: "poradny refaktor... vsude i na backendu, v konfiguraci, v clanku"):
  - `getTopVoice()` reimplemented as a DERIVED VIEW over facetAffinity (creator←worked-example/code, thinker←technical/research/formalism, explorer←story/intro) — legacy call sites keep working, source of truth is the facet model;
  - `reqlBoost` now boosts by facet profile (lens exact 2.0 / generic 1.2 / other 0.8, × depth 1.5) instead of voice — the ranking backend runs on the taxonomy;
  - home shelf "«Mode» picks" → **"🎛 Told your way"**: local subspace scoring (_facetMatch ≥ 0.7) against target facets, no scenario dependency;
  - onboarding "Your learning style" picker REMOVED (index.html + startWithVoiceAndGo); quiz voice answers now seed facet affinities via a voice→facet mapping; certificate "Specialization" line derives from target facets (depth · world · language);
  - CONFIG.voices marked LEGACY (mission-branch display labels only — branches remain the reader's explicit narrative choice); content `voice:` keys stay inert, AGENTS.md documents the retirement + mapping;
  - paper: mode row dropped from the taxonomy (carriers row added), RW notes the retirement explicitly, Fig 1 caption "onboarding picker", demo bullet steers a format preference (Czech · visual) instead of a mode switch.

### 2026-07-06 (iteration 16 — profile de-trivialized, visuality honesty everywhere)
- **"Your Style" (Explorer/Creator/Thinker %) removed from Profile** — trivial and duplicating onboarding; voice still feeds ranking silently. Replaced by **🎛 Format preferences**: one-tap chips over the taxonomy's consequential dimensions (Language en/česky, Length short/standard/long-form, Form, Depth, World) with "auto = learned model"; explicit picks always win; the correction dropdowns merged into this (no more duplicate controls). Reading DNA stays as the transparent learned model.
- **Visuality honesty closed end-to-end**: the mislabeled "⚡ yours … visual-first" block was a generated block STORED before the server clamp. Now: (1) client sweep in _loadPrivateBlocks re-derives visuality of stored private blocks from actual content (deletion test; persists fixes), (2) community items normalized the same way at fetch (recombee.js), (3) validator ERROR on visual-first without a visual + warn on balanced without visual/table, (4) full-corpus re-audit: 5 visual-first / 85 balanced / 139 text-first, **0 violations**.

### 2026-07-06 (iteration 15 — taxonomy v3 + link convention)
- **Table 1 v3** per Pavel: "plain = possible extensions" (no arbiter jargon), both footnotes dropped (the hand-crafted claim was confusing — the comic WAS AI-authored, just not runtime-generated), more traditional extensions: lens += news · travel · real estate · fashion (Recombee industries), genre += quiz · cheat sheet · slides · FAQ (dialogue/interactive-sim dropped as too far out), language += German · Spanish · French · Chinese, length += "deep with tl;dr lead"; visuality's description now names the building blocks (prose, tables, diagrams, animation).
- **"Deep with tl;dr lead" formalized** in AGENTS.md: it's the existing range mechanism — `lengthBand: tldr..deep` is honest iff the reader can stop after the ≤150-word lead and still answer the recallQ.
- **References & cross-links convention** (the missing piece — corpus had exactly ONE internal link): AGENTS.md new section — (1) concept links `[text](#c/<slug>)` are the default (link the idea, not the file), (2) block links `#<block-id>` only when that exact telling is the point, (3) external sources inline for casual pointers + `**Sources:**` list for load-bearing claims, stable URLs/DOIs, never invented (added to FORBIDDEN_DEFAULT → all contracts). Validator now errors on unknown `#c/` targets and warns on unknown block links; the app resolves `#c/<slug>` clicks through the concept index to the anchor (logged as concept_link).

### 2026-07-06 (iteration 14 — taxonomy table proper, captions de-blabbered)
- **Table 1 redesigned** per Pavel: three columns (Dimension / What it captures / Values), **bold = implemented in the demo**, plain = example extensions of the arbiter-owned vocabulary (finance, gaming, dialogue, interactive sim), footnotes for ordered dims (ranges a..b) and hand-crafted-only genres; mode row added. Caption reduced to a label + bold/plain legend — the subspace-syntax explanation lives in §3.1 text where it belongs.
- Fig 2 caption tightened for the same reason. Fig 1 at 0.92\textwidth (0.95 overflowed). Conclusion's closing flourish sentence dropped — ends factually on the open-source invitation. Body p1–4, references p5, 0 overfull.

### 2026-07-06 (iteration 13 — paper: taxonomy table, concrete prompt, general→p-book pattern)
- **Table 1 replaced**: instead of the volatile one-concept showcase, the COMPLETE content taxonomy — 7 facet dimensions with all supported values + trust-state ladder, ordered dimensions starred, subspace syntax (a..b / a|b) and the "comics/animations are hand-crafted, never generated" rule in the caption. Figure 2 now carries the one-concept-across-the-space illustration alone.
- **Generator made concrete** (§3.2): the prompt's exact six ingredients spelled out — (i) contract verbatim, (ii) facet vector expanded into instructions (lens vocabulary, depth audience rule, length word budget, genre skeleton), (iii) anchor as voice exemplar, (iv) correction ledger with an example rule, (v) existing-telling titles for dedup, (vi) capped reader wish — plus the exact mechanical gate (must-cover, formalism/length lints, honest visuality re-tag).
- **General principle → p-book realization** pattern applied to §3.2 (retrieve-before-generate stated as policy, then instantiated) and §3.3 (trust-in-stages principle, then the ladder); §4 quality paragraph deduplicated against the new §3.2 detail.
- Fig 1 enlarged to 0.85\textwidth; corpus counts confirmed absent (only the 42/177 deployment observations remain); body ends p4, references p5, 0 overfull.

### 2026-07-06 (iteration 12 — interest testing: recommending items that don't exist yet)
- **Ghost items**: concept proposals are now RECOMMENDED to readers before being written — "🌱 PROPOSED · not written yet" cards (title, objective, sample recallQ) in a Browse shelf ("Should we write this?") and as one interstitial per chapter in the read view. Votes: 👍 I'd read this (+2 XP, `ghost_want`) / Not for me (`ghost_skip`); impressions logged (`ghost_view`); voted cards never return (localStorage). Demand is measured BEFORE writing effort — the pre-mint stage of the elastic catalog.
- **Pipeline**: `content/concept-proposals.json` (arbiter-curated; seeded with 4 AI-drafted proposals: spam-and-manipulation, group-recommendation, gdpr-and-recommenders, in-game-recommendation) → readers vote → admin Coverage shows per-proposal *want/skip/seen* (distinct users) with **READY TO WRITE** at ≥5 wants. Admin drafting flow now exports ⬇ concept-proposals.json for commit. AGENTS.md: agents may draft entries, never commit the file or touch vote data; graduation to a real concept requires the threshold + arbiter.
- Paper §3.3: proposals "are recommended to readers as clearly labeled proposed cards; their votes measure demand before any writing effort is spent."

### 2026-07-06 (iteration 11 — earned editorship, concept proposals, sync fix, paper de-philosophized)
- **Editor track (earned, not appointed)**: Profile card + progress bars over three client-verifiable signals — 🚩 issues reported (+5 XP each, now also logged as events), ⚡ tellings shared, 📖 tellings ADOPTED into the book (detected automatically: shared id appears in the git corpus → +100 XP toast, once). Tiers: reader → contributor (1 shared or 3 flags) → editor (1 adopted, or 5 shared + 5 flags). Editor gets the 🛠 badge by the level indicator + link to the editor console; HUMANS.md editors section opens with the promotion rules.
- **Concept inventory opened (the big gap)**: readers could only demand VARIANTS of existing concepts — what no human added simply didn't exist. Now: 🌱 "propose a concept" (tellings panel + map, +10 XP, concept_wish events + local flag), admin Coverage → Concept proposals queue (wishes ranked by distinct readers) + "✨ Draft proposals from demand signals" → api/generate mode `propose-concepts` (existing-concepts dedup, chapters via stop-test, untrusted-evidence rule) → contract drafts with ⬇ anchor-draft .md download. E2E verified (4 valid proposals incl. group-recommendation, gdpr-and-recommenders from mixed CZ/EN evidence). AI drafts, arbiter approves — never auto-registered. AGENTS.md + HUMANS.md updated.
- **Sync Items fixed**: serve-local had no /api/sync-recombee route (404 HTML → JSON parse crash). Routed + admin now surfaces real per-item errors and hints at rejected RECOMBEE_TOKEN.
- **Paper (Kordík style pass 2)**: Fig 1 teaser enlarged to 0.72\textwidth; Fig 2 back to single column (same physical size, less layout cost); the "AI slop / fluent averageness / we argue quality is enforceable" passage replaced by a factual list of the four quality layers + the three measurements; minting-authority paragraph stripped of rhetoric; §3.1 contracts explained mechanically (public index, editors write and approve, everything checked against them); §3.3 + outlook now name the concept-inventory gap and its governed opening. Body ends on p4.

### 2026-07-06 (iteration 10 — concept renaming + paper page-1 teaser & conclusion)
- **All 71 concepts renamed** to short, chapter-free noun-phrase slugs (`ch3-friends` → `collaborative-filtering`, `ch4-bubbles` → `filter-bubbles`, `ch7-cold-start-language` → `beeformer`, ...), each anchor now carries `concept:` + concise `conceptTitle:`; 216 files updated. Concept ids are DECOUPLED from block ids: block ids (and thus reader progress, recall cards, deep links) are untouched. migrate-facets now honors explicit `concept:`/`conceptTitle:` on anchors incl. spine-less chapters (ch10 orphan branch). AGENTS.md got the naming rule. Note: steering-demand logs recorded before this date reference old concept ids.
- **Where things live** (the answer to "kde najdu"): `content/concepts.json` = source of truth (id, title, `chapter`, `anchor`, `blocks[]` = articles developing the concept, `contract`); admin → Coverage → "Concepts → articles" = browsable aggregation; reader-facing list = 🌱 map rows + 🎛 tellings panel per section.
- **Paper**: Fig 1 moved to page 1 as an ACM `teaserfigure` (readable at 0.63\textwidth), Fig 2 shrunk to 0.48; new merged **Conclusion and Outlook**; explicit contributions list (1)-(4) at the end of §1; a crisper model sentence ("contract fixes WHAT every telling must teach; facets describe HOW..."); §4 de-duplicated against Table 2; both tables scriptsize. Body ends on p4, references on p5, 0 overfull.

### 2026-07-06 (iteration 9 — co-author, style from mystyle.pdf, readable figure)
- **Co-author added**: Eva Necasova (AI detem, Prague) — second author block with eva.necasova@aidetem.cz; running head now "Pavel Kordik and Eva Necasova".
- **Style calibrated on mystyle.pdf** (Kordik et al., Neural Networks 2010): plain declarative claims, "we demonstrate/argue/discuss" enumerations, flourishes removed ("not on the menu" -> "not among the offered controls", "quietly rewrite" -> "rewrite several assumptions", abstract's last contribution now a "we discuss ..." sentence).
- **Figure 2 readable**: recaptured at 800px viewport @2x DPI, slimmed to 4 strips (dimension chips / legend / world header / item-cold-start band incl. anchor row), switched to a two-column figure* at 0.7\textwidth — print font ~7pt vs the original ~3.5pt. Fig 1 rebalanced to 0.72\columnwidth.
- Page budget restored after the figure* push: demo bullets and outlook tightened (5 targeted substitutions); body ends on p4, references spill to p5, 0 overfull.

### 2026-07-06 (paper rewrite — narrative version)
- `../paper-umap/pbook-recsys26.tex` rewritten as flowing scientific prose: new **Related Work** (three themes over all 17 bib refs: user control/transparency, learning & retention, generative content × RS as the under-studied *supply channel* direction); item counts removed from the text (only the 42/177 switch evidence kept); design choices explicitly defended (controlled vocabulary vs folksonomy, subspaces from non-orthogonality, honest miss economics, reuse threshold as THE tunable, minting-authority spectrum reader→editor→system); **§4 elastic catalog** now carries the infinite-catalog thought experiment (finite users + unbounded generator → exploration collapse, popularity starvation) with p-book mechanisms as proposed knobs, and the AI-slop quality bet as a measurable policy-layer claim; **§6 An Open Instrument, and an Invitation** frames the deployment as community-joinable validation (interface personalization ✓ data, LLM quality measurability, serve-or-mint threshold study). 4 pages, 0 overfull, all refs used.
- Suggested additions for camera-ready (deliberately NOT fabricated): 3–5 citations for the generative-RS paragraph (LLM4Rec survey, generative retrieval, model-collapse/synthetic-data, UGC moderation).

---

## 2026-04-03: Initial Health Check

**Status:** Complete
**Checked by:** Claude Opus 4.6 (automated)

### Issues Found & Resolved
- [x] 3 broken parent references in ch3 depth files (two-tower-math, als-deep, attention-deep)
- [x] Hardcoded highlights moved from JS to frontmatter (90 files)
- [x] Auto-generated low-quality excerpts disabled

### Issues Found & Open
- [ ] 3 question files have malformed YAML in `options:` field (ch3/05, ch4/04, ch5/06) — works in practice because the parser is lenient, but not valid YAML
- [ ] 123 files use `type: spine` regardless of actual type (sidebar/depth) — intentional simplification, may want to restore proper types later
- [ ] 97 files lack highlights — mostly sidebars and depth sections, acceptable for now
- [ ] 30 files lack recallQ/recallA — mostly games and newer additions
- [ ] No depth-thinker companion for Graph Neural Networks (ch3)

### Quality Assessment
- **Tone:** PASS — zero kid-specific language remnants
- **Facts:** PASS — all statistics consistent across files
- **Links:** PASS — 129 URLs, all well-formed, Recombee links consistent
- **Cross-refs:** PASS (after fix) — all parent references valid

### Content Stats
- 190 files, ~163K words, ~9.2 hours reading time
- 7 chapters, 12 missions
- 90 files with highlights, 157 with recallQ/recallA, 163 with teasers
- ~67 Recombee backlinks (blog, docs, research, case studies, GitHub)

---

## Maintenance Workflow

### Regular Health Check (monthly)
1. Run content validation: `node .github/scripts/validate-content.js`
2. Run this health check procedure (tone, cross-refs, metadata, facts, links)
3. Update this editorial log with findings

### Content Addition Workflow
1. Create new .md file with complete frontmatter (id, type, title, readingTime, teaser, recallQ/A, highlights, status)
2. Add to book.json in correct chapter and position
3. Run validation
4. If new section covers a topic mentioned in existing content, add cross-references
5. Check for Recombee backlink opportunities

### Quality Gates
- No file without: id, type, title, readingTime, status
- Spine files should have: teaser, recallQ/A, highlights
- All Recombee research citations should link to research-publications page
- No bare URLs without markdown link formatting in body text
