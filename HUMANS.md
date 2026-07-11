# HUMANS.md — How to Work with the Living Book

This is the human counterpart to [AGENTS.md](AGENTS.md) (which instructs AI collaborators). It covers three roles — **reader**, **contributor**, **editor** — each one a superset of the previous. Find your section; the two-minute foundation below is shared.

---

## The book in two minutes

Most books are frozen text. This one separates **what must be learned** from **how it is told**:

- A **concept** (e.g. *item cold start*) is a unit of understanding with a human-written **contract**: a learning objective, the points every telling must cover, a canonical recall question and answer, and claims that are forbidden. There are ~71 of them.
- A **telling** is one way to tell a concept: a long story, a 30-second summary, a comic, an animation, a formal treatment with equations, in English or Czech, with examples from e-shops or job boards. Every telling is tagged with **facets** (world, depth, visual form, length, genre, language) — and the recommender learns which facets work for *you*.
- Tellings live on a **ladder of trust**: `core` (human-verified, counts toward your certificate) → `edited` (editor-approved) → `community` (shared by a reader, clearly labelled) → `private` (yours alone). Content moves *up* the ladder only through human review; the verified core never gets diluted.
- The one invariant everyone protects: **every telling of a concept must leave you able to answer that concept's recall question.** Form varies freely; the learning outcome doesn't.

Roles: **readers steer** (and may create for themselves), **contributors share**, **editors verify**, and the **arbiter** (the author) decides disputes, contracts, and structure.

---

## 📖 For readers

### Getting started
Onboarding is two taps: *where you meet recommendations* (your example world) and *what you're here for*. Everything else the book learns as you read. The **🌱 Living book** checkbox turns on *open mode* — reader-shared tellings, generation, and remixing. Leave it off and you get only verified content (`safe mode`); you can flip it anytime in **Profile**.

### Steering any section
- Top of a section: **🎛 N other tellings** — opens the panel showing every way this concept is told (with badges: CORE / edited / ⚡ reader-shared / ✨ your remix). The dimension row (🌐 World · 📏 Depth · 🖼 Form · ✒️ Genre · 🌍 Language · ⏱ Length) lets you jump anywhere in the telling space; counts show what exists, **＋ means nobody wrote that one yet**.
- Bottom of a section: **"How was this telling?"** — 👍 Great · 🔽 Simpler · 🔼 Deeper · 🖼 More visual · 🌐 my world. It fades away if you ignore it; every tap teaches the book your taste (weight 3 — stronger than just reading, weight 1).
- The book is honest about misses: if you ask for a job-board telling and none exists, **nothing is silently swapped in** — you see what exists, plus a generate offer.

### Generating and remixing (open mode)
- **Generate**: when a telling you want doesn't exist, the ✨ button writes one — for your *settings*, not for you personally (no "as you asked earlier…"). It is constrained by the concept's contract, validated, cached, and clearly labelled *generated, not editor-verified*. Optional wish field: "use a running-shop example, focus on returns". Honest limit: generated *text* maxes out at `balanced` visuality (tables) — for truly visual, remix a diagram instead.
- **Improve any section — two ways, one button**: press **✏️ Improve** in a section's footer (whole section) or select a passage and hit ✏️ in the popup (just that part). One form opens with both paths: **edit the text directly** in the box (no AI involved, instant), or **describe the change** and let AI rewrite it. Either way a **preview** appears with the changed span highlighted amber and a floating bar: **✓ Accept** makes it your version of that section (it replaces the original *in your book* — highlights stay, one-click revert anytime), **✓ Accept & share** also sends it to other readers and the editors (your prompt or your manual diff travels with it), **✗ Discard** throws it away. The book's original is never touched.
- **Remix diagrams & animations**: hover any diagram → ✨ → "make the products running shoes", "slow the animation down". Same rules: private copy, visibly marked.
- Your creations live in **Profile → Reading DNA** (with your learned preferences, which you can correct — corrections always win) and on the **Map → 🌱 Living book** (◐ = yours).

### Beyond tellings: propose a concept
Steering covers *how* existing concepts are told. If the book is missing a whole **concept**, say so: 🌱 *propose it* (in the tellings panel or the living-book map, +10 XP). Proposals are logged and ranked by how many readers ask; the drafting AI turns the strongest ones into contract drafts for the editors. What today isn't in the book only because nobody wrote it — that's a gap you can name.

You'll also *meet* proposals: **🌱 PROPOSED · not written yet** cards appear among recommendations (a Browse shelf and an occasional card while reading). Voting 👍 *I'd read this* (+2 XP) or *Not for me* is real work — demand is measured **before** anyone writes, and only proposals readers actually want get written. A card you voted on never comes back.

### Sharing back
Like ❤ your own generated/remixed telling → you'll be asked whether to **share it into the book** (anonymous by default, optional nickname). Shared tellings appear to similar readers, labelled; if enough distinct readers engage, editors review it for adoption — your telling can end up in the book proper. You earn XP either way; nothing is shared without your explicit consent.

### Your personal mission
Tell the book what you want to learn — one sentence at onboarding (or anytime: Missions → *Tell the book what you want to learn*). It composes a 🎯 personal mission from the concepts that match your goal, ordered the way the book teaches them; read them all and the mission completes (+50 XP). Change or clear the goal anytime.

### Learning machinery
- **Recall cards** (spaced repetition) generate automatically from what you read; the Quiz tab shows your confidence map.
- **Missions** end with a boss question graded by an **AI examiner** on substance, not keywords — "almost" gets a probing follow-up, pass ≥70 completes the mission.
- **Certificate** has three tiers — 🥉 Foundations · 🥈 Practitioner · 🥇 Recommendation Guru — computed **only from verified core content** plus missions and recall practice. Community content broadens the book; it never inflates certification.

### Your data
Reading interactions (views, likes, steering, generation requests) are logged — they power your personalization and the public research analytics; your profile view shows you the model transparently and lets you correct or reset it. Private tellings stay in your browser until you share them.

---

## ✍️ For contributors

Everything above, plus you create for others. Three paths, from lightest to heaviest:

1. **Flag** (🚩 on any section): typo, unclear passage, factual issue. Costs a minute; feeds the editors' Health board directly.
2. **Share your generated/remixed tellings** (see above) — the lowest-friction way to fill coverage gaps. The 🌱 map's ＋ cells and the "only gaps" filter show exactly where the book is thin. A wish + generate + a light personal edit + share is a legitimate contribution.
3. **Author a telling yourself** (PR): the strongest form. Rules of the craft:

- **Serve an existing concept** unless you genuinely bring a new unit of understanding. Read the concept's contract in `content/concepts.json` first; your telling must let a reader answer its `recallQ` consistently with `recallA`, and must not contradict any `mustCover` point or touch a `forbidden` claim.
- **Write for a segment, not for yourself**: pick a cell (or honest subspace) of the telling space — e.g. *Czech · e-commerce · intro · story* — and write for everyone in it. Declare facets truthfully; the operational tests live in [AGENTS.md §2](AGENTS.md) and apply to humans identically (the *deletion test* for visuality, the *"who'd feel this was written for them"* test for ranges). If unsure, tag narrow.
- **Style**: `content/correction-rules.json` is the distilled list of what editors keep fixing. Short version: no hype adjectives; one concrete number beats "significantly"; at most one sentence of intro; **bold the key phrases**; end with a hook or takeaway, not a recap. Long forms may breathe (see `05k` — a story with dialogue is welcome); short forms must be tight.
- **Visuals**: minimalist SVG (≤3 colors + grays), computed layouts, no glitches — no scripts or external references (they get stripped). Comics and animations are welcome but reviewed strictly; they must carry one clear idea (see `comic-cold-start.svg` — one arc, one punchline).
- **Mechanics**: file into the concept anchor's chapter directory, name satellites `NNx-sidebar-*` (never `-spine-` unless you're anchoring a new concept), register in `content/book.json` *after* the anchor, `status: draft`, then `node scripts/migrate-facets.js && node .github/scripts/validate-content.js` must pass.
- **License**: content is CC BY-NC-SA 4.0; by sharing or submitting you license your contribution under the same terms. Attribution: your nickname (or anonymity) travels with the telling, including through adoption.

What gets adopted? Editors look for: contract fidelity, honest facets, breadth of appeal (did *distinct readers* engage, not just your friends clicking twice), and voice fit. The showcase set (`content/ch02-data/05*` — 14 tellings of one concept) is the calibration standard.

---

## 🧑‍⚖️ For editors

**Editorship is earned, not appointed.** Every reader is on the 🛠 Editor track (Profile shows your progress): report issues that hold up (🚩, +5 XP each), share tellings, and when **one of your tellings is adopted into the book** — or you reach 5 shared + 5 reported — you're promoted: the 🛠 badge appears by your level, and the editor console below opens up to you. Adoption is detected automatically the moment your shared telling ships in the book itself.

Everything above, plus you run the **lazy redakce**: reader demand allocates your attention; you spend it where the signals point. Your cockpit is `/admin.html`.

### The four boards
- **Coverage** — the concept × facet matrix. ⚠ marks contract debt (concepts missing `recallQ`/`mustCover`): fixing those unblocks generation for that concept. The steering-demand table is your **to-write list**, ranked by distinct readers who asked and didn't get.
- **Nomination queue** (in Coverage) — community tellings with traction. Threshold: ≥5 distinct readers with positive signal → *READY TO ADOPT*.
- **Concept proposals** (in Coverage, 🌱) — reader concept wishes ranked by distinct readers, plus *✨ Draft proposals from demand signals*: the AI mines wishes/misses/flags and drafts full contract proposals (objective, mustCover, recallQ/A, chapter). Export them to `content/concept-proposals.json` and commit — that starts **interest testing**: readers see the proposals as labeled ghost cards and vote; the queue shows *want / skip / seen* per proposal and marks **READY TO WRITE** at ≥5 distinct wants. Write (or AI-draft) only what passed the test — nothing enters the book without you.
- **Health** — what readers actually read, and what fails them: transparent problem score (flags ×3, dislikes ×2, steer-aways, remix requests, shallow reading; likes and praise subtract). Two actions per problem block: **⏸ Park** (hides locally + copies the one-line `status: review` file change — run it and deploy to affect readers) and **✨ AI rewrite from signals** (regenerates the telling from its contract with the recorded complaints as instructions → you review the `.md`).
- **Feedback** — raw reader flags and notes.

### Adoption checklist (community → edited)
1. Download the `.md` from the nomination queue.
2. **Contract check**: recallQ answerable? mustCover points present? Nothing forbidden? (The validation gate checked mechanically at generation time — you check *meaning*.)
3. **Facet honesty**: run the AGENTS.md §2 tests yourself; fix tags, don't trust them. Especially visuality (deletion test) and subspace width.
4. **Voice pass**: edit freely — and if you correct the *same kind of thing* for the third time, add a distilled rule to `content/correction-rules.json`; the generator stops making that mistake.
5. Keep provenance (`sharedAs`, `remixOf`, `remixLog` — the remix log tells you *what readers wanted changed*, which is review gold).
6. Place the file, `status: review` → after your pass `accepted`, register in `book.json` after its anchor, run migrate + validator, deploy, **Sync Items** (pushes facets to the recommender).
7. Adoption ≠ core. `core: true` is a separate, stricter decision — it changes the certificate. When in doubt, adopted-but-not-core is a perfectly good resting place.

### What stays above your pay grade (arbiter-only)
Contracts' meaning on anchored concepts · the facet **vocabulary** (new values/dimensions) · new **chapters** (see AGENTS.md — stop-test + ≥3-concept threshold) · `core` designation · disputes between editors. Escalate with a short written case; the arbiter's call is final and gets logged in `_editorial.md`.

### Your paper trail
`_editorial.md` is the log of record: every adoption, parking, rewrite, and rule added — one line each, dated. Future-you (and the research paper) will thank present-you.

---

*Readers steer · contributors share · editors verify · the arbiter decides — and every telling, whatever its shape, teaches the same thing.*
