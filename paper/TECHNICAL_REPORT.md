# p-book: Technical Report

**A Personalized Interactive Book Standard with Multi-Modal Navigation and Recommendation-Driven Adaptation**

**Author:** Pavel Kordík, Czech Technical University in Prague & Recombee
**Date:** March 2026
**Version:** 1.0
**Live demo:** [recsysbook-kids.vercel.app](https://recsysbook-kids.vercel.app)
**Repository:** GitHub (open-source, MIT/CC BY-NC-SA 4.0)

---

## 1. Executive Summary

p-book is an open-source standard and web application for creating personalized, interactive digital books. Unlike traditional e-books, p-book transforms linear educational content into an adaptive experience where the same content graph is navigable through multiple paradigms — missions, Netflix-style browsing, linear reading, and visual map exploration — personalized by a recommendation engine (Recombee) and augmented with gamification, spaced repetition, interactive mini-games, and an AI tutor.

The first instantiation is *"How Recommendations Work"*, a book teaching recommender system concepts to readers aged 8–15. It contains **83 content blocks** across **6 chapters**, **8 interactive mini-games**, **6 story-driven missions**, and a complete gamification layer with 16 achievements and a downloadable completion certificate. The system is zero-dependency (vanilla JavaScript, no framework), works without Recombee via local fallbacks, and deploys as a static site.

The primary research question is: **which content navigation paradigm do readers prefer, and how do navigation preferences relate to engagement depth, content coverage, and recommendation acceptance?**

---

## 2. Motivation and Problem Statement

### 2.1. The Gap in Adaptive Learning

Adaptive learning systems have demonstrated substantial effectiveness, with meta-analyses reporting effect sizes of g=0.70 on cognitive outcomes compared to non-adaptive instruction (Wang et al. 2024). However, the vast majority of these systems focus on **skill-based tutoring and drill exercises**:

- **Carnegie Learning** decomposes mathematics into skill atoms and uses ACT-R + Bayesian Knowledge Tracing (Ritter et al. 2007)
- **ALEKS** employs Knowledge Space Theory for assessment-driven math sequencing (Cosyn et al. 2021)
- **Duolingo** combines adaptive sequencing, spaced repetition (half-life regression), and gamification — but for vocabulary drill items (Settles & Meeder 2016)
- **Knewton Alta** adapts textbook exercises using probabilistic models (Chau et al. 2021)

**Book-length narrative educational content** — the dominant form of extended learning material worldwide — has received surprisingly little attention from the adaptive hypermedia community (Sosnovsky, Brusilovsky & Lan 2025). The intelligent textbook tradition (Brusilovsky & Millán 2007; Sosnovsky & Brusilovsky 2015) has explored concept extraction and adaptive navigation, but no system integrates recommendation engines, spaced repetition, gamification, and open learner models within a single textbook.

### 2.2. Unique Challenges of Books vs. Exercises

Books are structurally different from courses and exercise platforms in ways that demand different adaptive design patterns:

| Dimension | Exercise Platforms (ITS) | p-book |
|-----------|--------------------------|--------|
| Content structure | Independent skill atoms | Linear narrative with branching |
| User model | Mastery per skill | Engagement preferences + behavior |
| Adaptation mechanism | Assessment-driven (BKT, IRT, KST) | Recommendation engine (RecSys) |
| Reader agency | None — system controls path | First-class design principle (4 modes) |
| Motivational context | Obligation/assessment | Leisure/curiosity |
| Coverage guarantee | Mastery gating | Structural (spine completeness) |
| Content type | Exercises/drills | Narrative/conceptual text |

The key insight is that a book preserves **authorial narrative coherence** through a linear spine, while enabling personalized depth through optional branching. This **spine+depth** architecture decouples curriculum coverage from assessment — readers complete the core content structurally, not through mastery gates.

---

## 3. System Architecture

### 3.1. Technology Stack

The system is built as a **zero-dependency single-page application** (vanilla JavaScript, ~7,000 lines total):

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Main application | `js/app.js` | 3,172 | UI, navigation, views, missions, games |
| Recommendation client | `js/recombee.js` | 624 | Recombee API, user model, gamification, spaced repetition |
| AI tutor | `js/tutor.js` | 275 | Mock keyword-search tutor with Socratic follow-ups |
| Markdown renderer | `js/markdown.js` | 261 | MD→HTML with math (KaTeX), tables, diagrams |
| SVG diagrams | `js/diagrams.js` | 327 | Procedural SVG diagram rendering |
| Configuration | `js/config.js` | 48 | Feature flags, Recombee scenarios, voice definitions |
| Styles | `css/style.css` | 1,001 | All CSS, responsive, dark mode |
| Admin dashboard | `admin.html` | 837 | Content pipeline management |

**Deployment:** Vercel or Netlify (or any static host). Recombee API calls go through a serverless proxy (`netlify/functions/recombee.js` or `api/recombee.js`) that handles HMAC authentication. A local dev server (`serve-local.js`) provides the same proxy for development.

### 3.2. Content Model: Spine + Depth

Content is organized as **Markdown files with YAML frontmatter** in a directory structure:

```
content/
  book.json              ← Chapter index
  ch1-what-are-recommendations/
    01-spine-have-you-noticed.md      ← Spine (core narrative)
    02a-depth-explorer-spot-them.md   ← Depth (Explorer voice)
    03b-depth-thinker-patterns.md     ← Depth (Thinker voice)
    04a-depth-creator-your-first.md   ← Depth (Creator voice)
    03a-sidebar-wrong-recs.md         ← Sidebar (supplementary)
    01c-game-signal-sort.md           ← Interactive game
    05-question-what-type.md          ← Interactive quiz
games/
  signal-sort.json        ← Game data definitions
images/
  kids-collaborative-filtering.svg  ← SVG illustrations
```

**Content statistics for "How Recommendations Work":**

| Category | Count | Description |
|----------|-------|-------------|
| Total blocks | 83 | All content units |
| Spine blocks | 28 | Core narrative backbone |
| Depth blocks | 20 | Voice-specific elaboration |
| Sidebars | 22 | Supplementary content |
| Interactive games | 10 | Data-driven mini-games (8 unique game types) |
| Comprehension questions | 6 | Multiple-choice with feedback |
| Worksheets | 5 | Hands-on activities |
| Core blocks | 35 | Required for completion certificate |
| Chapters | 6 | Thematic groups |

**Content frontmatter schema:**

```yaml
---
id: ch1-noticed              # Unique identifier
type: spine                   # spine | question | game
title: "Have You Ever Noticed?"
readingTime: 2                # Estimated minutes
teaser: "YouTube knows..."    # Preview text
voice: universal              # universal | explorer | creator | thinker
core: true                    # Required for certificate
status: accepted              # draft | review | accepted
game: signal-sort             # Reference to games/*.json (if type=game)
diagram: kids-footprints      # Reference to images/*.svg
---
```

**Voice distribution:** 55 universal blocks, 15 thinker, 13 creator, 12 explorer.

### 3.3. Engagement Modes (Not Learning Styles)

p-book offers three engagement modes that influence which depth blocks are recommended:

| Mode | Label | Tagline | Elaboration Type |
|------|-------|---------|------------------|
| Explorer | 🔍 | "How does it work? Show me!" | Relational elaboration |
| Creator | 🎨 | "I want to build something!" | Procedural elaboration |
| Thinker | 🧠 | "Why does it work that way?" | Conceptual elaboration |

**Critical distinction:** These are **not learning styles**. The "meshing hypothesis" (matching instruction modality to a stable trait) has been decisively debunked (Pashler et al. 2008; Touloumakos et al. 2023). Engagement modes are **dynamic preference priors updated from behavioral signals** — a reader who selects Explorer during onboarding but consistently engages with Thinker-type content will see their recommendations adapt. This design is grounded in:

- **Self-Determination Theory** (Ryan & Deci 2000): Choice supports autonomy, a core driver of intrinsic motivation
- **Interest-driven learning** (Schraw, Flowerday & Lehman 2001): Reader choice increases engagement through perceived autonomy
- **Elaboration theory** (Reigeluth 1999): Explorer/Creator/Thinker map to relational/procedural/conceptual elaboration types
- **Flow theory** (Csikszentmihalyi 1990): Matching content demand type to preference maintains optimal challenge

### 3.4. Four Navigation Paradigms

The same content graph is accessible through four qualitatively different navigation modes:

#### 3.4.1. Missions

Story-driven quests with narrative framing. Each mission:
- Has a story premise (e.g., *"Your friend asks: How does YouTube know? Can you figure it out?"*)
- Sequences 5–8 core blocks into a coherent arc with per-block intro narration
- Offers **branching paths** by engagement mode (Explorer/Creator/Thinker side quests)
- Culminates in a **boss quiz** — an open-ended synthesis question with hint system
- Supports **prerequisites** (Capstone requires 2 completed missions)
- Awards XP and a named title (e.g., "Algorithm Explainer", "Data Detective")

**6 missions defined:**

| # | Mission | Difficulty | Core Blocks | Boss Challenge |
|---|---------|-----------|-------------|----------------|
| 1 | How Does YouTube Know? | Beginner | 6 | Explain recs to a friend |
| 2 | The Data Detective | Beginner | 5 | Fix bad Peppa Pig recs |
| 3 | Build a Recommender | Intermediate | 6 | Debug a broken system |
| 4 | Pop the Bubble | Intermediate | 5 | Design a fair system |
| 5 | Take Back Control | Advanced | 4 | Advise a younger cousin |
| 6 | Recommendation Master | Capstone | 6 | Explain the full pipeline |

#### 3.4.2. Browse (Netflix-style)

Horizontal carousel shelves organized by recommendation scenario:
- **Continue Reading** — Resume where you left off
- **Recommended for You** — Recombee `homepage-personal` scenario
- **Your Missions** — Active/next missions with progress dots
- **Voice-specific picks** — Recombee `homepage-voice` scenario (filtered by engagement mode)
- **Popular** — Most-read blocks across all users
- **Spaced repetition** — Due recall reviews
- **Games & Activities** — Interactive content

The most discovery-oriented mode, designed to surface content the reader might not find through linear navigation.

#### 3.4.3. Read (Infinite Scroll)

Traditional linear chapter-by-chapter progression. Content flows as a continuous vertical scroll within each chapter, with depth blocks appearing as expandable cards. At the end of each block, a **"Read Next"** recommendation draws from the Recombee `next-read` scenario, or falls back to the next sequential block. The most familiar book-like experience.

#### 3.4.4. Map

Visual overview showing all chapters, blocks, and reading progress. Two sub-modes:
- **Visual RPG Map** — Illustrated path with nodes representing blocks, connections showing reading paths
- **Detailed List** — Complete content listing with badges indicating core/game/voice status and completion state

The most exploratory and agency-maximizing mode, allowing readers to jump directly to any block.

### 3.5. Recommendation Engine Integration

Content personalization is powered by **Recombee** through a serverless API proxy. Five recommendation scenarios map to distinct pedagogical functions:

| Scenario ID | Pedagogical Function | Used In |
|-------------|---------------------|---------|
| `homepage-personal` | Personalized discovery | Browse shelves |
| `homepage-voice` | Engagement-mode-specific picks | Browse shelves |
| `next-read` | Curriculum sequencing / adaptive elaboration | Read view (infinite scroll) |
| `context-related` | Lateral connection (item-to-item) | Sidebar recommendations |
| `search` | Personalized search ranking | Search results |

**Interaction signals sent to Recombee:**
- Detail views with duration
- Ratings (thumbs up/down)
- Bookmarks
- User properties (voice preference, level, XP, read count, session count, completed missions)

**Local fallback:** When Recombee is unavailable (localhost, API errors), all recommendation functions fall back to local algorithms: random selection with chapter affinity, recency weighting, and keyword-based search.

### 3.6. Gamification

Deliberately conservative design — no anxiety-inducing elements:

| Element | Implementation | Rationale |
|---------|---------------|-----------|
| XP | 10/read, 5/depth expand, 8/recall correct, 3/rating, 2/save | Reward exploration, not speed |
| Levels | 50 XP/level, named titles ("Newbie" → "Recommendation Guru") | Visible progress indicator |
| Achievements | 16 badges (first read, bookworm, triple threat, etc.) | Milestone recognition |
| Certificate | SVG download after all 35 core blocks read | Tangible completion artifact |
| Knowledge cloud | Word cloud of concepts from read blocks | Metacognitive awareness |
| **No** streaks | — | Avoid guilt/anxiety for kids |
| **No** leaderboards | — | Avoid social pressure |
| **No** time pressure | Games have 60s auto-hide but no penalty | Reduce stress |

This design is informed by research showing that competitive and pressure-based gamification elements can cause negative effects in 87 documented cases (Almeida et al. 2022), and that novelty effects decline after approximately 4 weeks (Koivisto & Hamari 2022).

### 3.7. Spaced Repetition

Anki-style SM-2 algorithm adapted for young readers:

- **Scheduling:** After reading a block, a recall review is scheduled in 1 day (initial interval)
- **Response options:** Forgot (0), Hard (1), Good (2), Easy (3)
- **Interval growth:** Uses ease factor (initial 2.5) × quality multiplier
- **Interval cap:** 30 days maximum (vs. Anki's months-long intervals) — appropriate for episodic educational content vs. language vocabulary
- **Recall quiz format:** One key concept question per block (auto-generated from content keywords or manually authored)
- **Integration:** Due reviews surface in Browse shelves and as prompts in Read view

### 3.8. Interactive Mini-Games

8 data-driven games defined as small JSON files:

| Game | Type | Chapter | Concept |
|------|------|---------|---------|
| Signal Sort | sort (classify) | Ch 2 | Strong vs. weak user signals |
| Find Your Taste Twin | match | Ch 3 | Collaborative filtering intuition |
| Name That Method | sort (classify) | Ch 3 | CF vs. content-based vs. popularity |
| Build the Pipeline | order (sequence) | Ch 3 | Recommendation pipeline stages |
| Pop the Bubble | pop (click-collect) | Ch 4 | Filter bubble awareness |
| A/B Test Judge | sort (classify) | Ch 4 | Experiment design |
| Cold Start Challenge | sort (classify) | Ch 2 | Cold-start strategies |
| Privacy Spotter | pop (click-collect) | Ch 6 | Privacy awareness |

**Game engine:** Single generic engine in `app.js` (~190 lines) that renders any game type from JSON data. Games auto-hide after 60 seconds but without penalty. XP is awarded for completion regardless of score.

### 3.9. AI Tutor

Architecture-ready for LLM integration:

- **`MockTutorEngine`** (current): Keyword-based search over book content, context-aware scoring (boosting current chapter), Socratic follow-up questions, author escalation when confidence < 0.3
- **`LLMTutorEngine`** (planned): Drop-in replacement via serverless function → Claude API, maintaining the same interface
- **Conversation persistence:** Chat history stored in localStorage per block context, with 30-minute session windows
- **Author escalation:** "Message the real author" feature with conversation queue visible in admin dashboard

### 3.10. Research Analytics Instrumentation

All reader interactions are logged with **navigation mode attribution** — every event records the discovery context:

| Mode Tag | Source |
|----------|--------|
| `netflix` | Browse shelves |
| `read` | Linear read view |
| `mission` | Mission flow |
| `map` | Map view navigation |
| `search` | Search results |
| `tutor` | AI tutor links |
| `recall` | Spaced repetition prompt |
| `direct` | Direct link / jump |

**Tracked signals per interaction:**
- Block views with dwell time (milliseconds)
- Scroll depth (portion of content viewed, 0.0–1.0)
- Block completion (marked as read)
- Depth-block expansions by engagement mode
- Recommendation acceptance with scenario attribution
- Mode switches (logged as first-class events + sent to Recombee as purchase events for analytics)
- Ratings, bookmarks, notes
- Spaced-repetition responses (forgot/hard/good/easy)
- Game completions with score
- Mission progress and boss quiz attempts

This instrumentation enables comparison of navigation paradigms without requiring external measurement instruments.

### 3.11. Admin Dashboard

A separate `admin.html` page provides a content pipeline management interface:

- **Content overview:** Block counts by type, status, chapter, voice
- **Pipeline view:** Content status workflow (draft → review → accepted)
- **Marketing angle:** Content repurposing suggestions
- **Author message queue:** Escalated tutor questions from readers

### 3.12. LLM/Bot Interface

p-book is designed to be discoverable and contributable by AI systems:

- **`/.well-known/pbook.json`** — Discovery manifest for bots (title, description, content index URL, contribution guide)
- **`/pbook.json`** — Full project manifest with schema documentation, feature descriptions, integration details
- **Content as Markdown** — Machine-readable YAML frontmatter with structured fields
- **Status workflow** — `draft → review → accepted` for AI-contributed content
- **`CONTRIBUTING.md`** — Explicit guide for content format, style, and PR workflow

### 3.13. Feature Toggles

All major features can be independently disabled via `CONFIG.features`:

```javascript
features: {
  gamification: true,      // XP, levels, badges, certificate
  personalization: true,   // Recombee recs, voice paths
  spaceRepetition: true,   // Recall quizzes
  missions: true,          // Story-driven missions
  games: true,             // Mini-games
}
```

This supports **within-subject ablation studies** — toggling features on/off to measure their individual contribution to engagement.

---

## 4. Differentiation from Existing Systems

### 4.1. Comparison Matrix

| Dimension | Carnegie Learning | ALEKS | Duolingo | Knewton Alta | LECTOR | **p-book** |
|-----------|------------------|-------|----------|--------------|--------|------------|
| **Content model** | Skill atoms | Skill atoms | Drill items | Skill atoms | Linear text | **Spine + depth graph** |
| **User model** | Mastery (BKT) | Mastery (KST) | Mastery (HLR) | Mastery (prob.) | Behavior (observation) | **Engagement modes** |
| **Adaptation** | Rule-based | Assessment-driven | Half-life regression | Probabilistic | Observational | **Multi-scenario RecSys** |
| **Reader agency** | None | None | None | Low | None | **4 navigation modes** |
| **Spaced repetition** | No | No | Yes | No | No | **Yes (SM-2)** |
| **Gamification** | No | No | Yes (aggressive) | No | No | **Yes (safe design)** |
| **Open learner model** | No | Partial (pie chart) | Partial (skill tree) | No | No | **Yes (knowledge cloud, progress map)** |
| **Content type** | Math exercises | Math exercises | Vocabulary drills | Textbook exercises | Observed text | **Narrative + games + quizzes** |
| **Mini-games** | No | No | Yes (limited) | No | No | **8 types, data-driven** |
| **AI tutor** | Yes (within exercises) | No | No | No | No | **Yes (content-aware, Socratic)** |
| **Missions/quests** | No | No | Partial (path) | No | No | **6 story-driven, branching** |

### 4.2. Three Unique Properties

1. **Spine+depth content architecture for narrative text.** ITS systems decompose content into independent skill atoms assessed individually. p-book preserves the authorial narrative through a linear spine while enabling personalized depth through optional branching. Coverage is guaranteed structurally (all spine blocks), not through mastery gating.

2. **Multi-scenario recommendation mapped to pedagogical functions.** Most adaptive systems use a single adaptation mechanism (BKT, KST, HLR). p-book defines 5 named recommendation scenarios, each serving a distinct pedagogical purpose. This mapping is a generalizable design framework applicable to any content domain.

3. **Reader agency as a first-class design principle.** ITS systems are overwhelmingly system-controlled — the algorithm decides what the learner sees next. p-book gives readers 4 fundamentally different ways to navigate the same content, respecting SDT's autonomy principle. Research confirms that 3–5 options are optimal for supporting autonomy without decision paralysis (Evans & Boucher 2015).

### 4.3. Closest Precedents

**Duolingo** is the closest multi-component system (adaptive + SR + gamification), but differs in modality (drill vs. narrative), control (system-directed vs. reader-directed), and scope (vocabulary atoms vs. conceptual chapters).

**LECTOR** (Lopez Zapata et al. 2025) is the closest e-book system — it tracks reading behavior (dwell time, scroll patterns) to build learner models. But LECTOR is **observational**, not **interventional** — it does not recommend content or adapt the reading path.

**The intelligent textbook tradition** (Sosnovsky et al. 2025 survey) has explored concept extraction and adaptive navigation for textbooks, but without integrating recommendation engines, spaced repetition, or gamification.

---

## 5. Component-Level Evidence Review: Effects on Children's Learning

This section reviews the scientific evidence for each p-book component, with a focus on K-12 populations (ages 6–18). The full evidence file with all citations is available in `paper/COMPONENT_EVIDENCE.md`.

### 5.1. Evidence Summary

| P-Book Feature | Evidence Strength | Key Effect Size | Children-Specific? | Risk Level |
|---|---|---|---|---|
| **Adaptive learning** | Strong | d=0.30–0.60 (K-12 meta-analyses) | Yes | Low |
| **Gamification** | Strong (with caveats) | g=0.30–0.85 (K-12 meta-analyses) | Yes | Medium |
| **Spaced repetition** | Strong (mostly adults) | d=0.50–1.00+ | Limited K-12 evidence | Low |
| **Interactive mini-games** | Strong | g=0.30–0.67 | Yes | Low-Medium |
| **Missions / narrative quests** | Moderate | Positive (narrative-congruent) | Yes (storybooks) | Low-Medium |
| **Multiple navigation modes** | Moderate (SDT-aligned) | Positive for autonomy/motivation | Yes (elementary/middle) | Low |
| **Progress visualization (OLM)** | Moderate | Positive for self-regulation | Limited | Low |
| **Badges / XP / rewards** | Moderate | Short-term positive | Mixed | **Medium-High** |
| **Netflix-style discovery UI** | Weak (indirect) | Positive for engagement | **No direct evidence** | Medium |
| **Infinite scroll** | Moderate (negative) | Reduces comprehension, increases compulsion | Yes (concerning) | **High** |

### 5.2. Gamification (XP, Levels, Achievements)

K-12-specific meta-analyses confirm positive effects on motivation (g=0.52–0.85) and cognitive outcomes (g=0.49) (Sailer & Homner 2019; Kurnaz & Kocturk 2025; Dehghanzadeh et al. 2023). However, **the specific elements matter enormously**:

- **Narrative/fiction elements** (story framing, quests) are the most effective gamification component — more effective than simple points or badges (Sailer & Homner 2019)
- **Novelty effects** are documented: engagement declines after ~4 weeks but recovers through familiarization (Rodrigues et al. 2022)
- **87 papers report negative gamification effects**, particularly from leaderboards, competitions, and social comparison (Almeida et al. 2022)
- **Overjustification risk**: Extrinsic rewards can crowd out intrinsic motivation, particularly dangerous for reading — children rewarded for reading may read LESS when rewards are removed (Gneezy, Meier & Rey-Biel 2011)

**p-book design response:** Conservative gamification — XP for exploration not speed, achievement badges for milestones, no leaderboards, no streaks, no time pressure. Intangible rewards preferred over tangible (Xiao & Hew 2023).

### 5.3. Spaced Repetition

One of the most robust findings in learning science: distributed practice substantially improves long-term retention (d=0.50–1.00+) across 317 experiments (Cepeda et al. 2006; Weinstein, Madan & Sumeracki 2018; McDermott 2020).

**Children-specific gap:** Most evidence comes from college students/adults. Ophuis-Cox et al. (2023) is one of the few studies testing retrieval practice specifically with elementary children (for math facts — positive results). Working memory limitations in young children (under 8) may reduce effectiveness of certain SR formats.

**p-book design response:** Embed SR within gamified recall activities rather than raw flashcards. Cap intervals at 30 days (vs. Anki's months-long intervals). Award XP for recall responses to maintain motivation.

### 5.4. Interactive Mini-Games

Multiple meta-analyses support game-based learning for children: g=0.47 for science (Tsai & Tsai 2020), g=0.30–0.67 across domains (Yu 2019). Challenge calibration is critical — games matching student ability produce flow states and better learning (Hamari et al. 2015). Mayer (2018) emphasizes "value-added" games with pedagogical features (feedback, scaffolding) beyond simple mechanics.

**Critical finding from children's storybook research:** Interactive features in storybooks enhance comprehension **only when narrative-congruent** (d=0.17). Incongruent games (unrelated to the story) **harm comprehension** (d=-0.14) (Takacs, Swart & Bus 2015; Bus, Takacs & Kegel 2014).

**p-book design response:** All 8 mini-games are tightly integrated with learning content (e.g., "Signal Sort" teaches strong vs. weak user signals, "Build the Pipeline" teaches recommendation pipeline stages). Auto-hide after 60s without penalty. No competitive elements.

### 5.5. Missions / Narrative-Driven Quests

Narrative-based gamification is among the most effective approaches (Oliveira et al. 2022; Breien & Wasson 2020). Story framing enhances both engagement and learning outcomes compared to non-narrative approaches. Kory Westlund et al. (2017) found that expressive storytelling improved children's comprehension and retention.

**p-book design response:** 6 story-driven missions with relatable premises ("Your Peppa Pig recs are terrible — fix them!"), per-block narrative intros, engagement-mode branching paths, and boss quizzes requiring synthesis.

### 5.6. Multiple Navigation Modes (Learner Choice)

Self-Determination Theory (SDT) establishes that autonomy support improves intrinsic motivation (Ryan & Deci 2000; Vansteenkiste, Ryan & Soenens 2020). **Confirmed for children:** Conesa et al. (2022) reviewed SDT in elementary and middle school contexts and found that autonomy, competence, and relatedness needs predicted academic motivation.

**Critical nuance:** Children's self-regulation is still developing (Panadero 2017). Too much learner control can be counterproductive for younger/novice learners ("expertise reversal effect"). Optimal design provides **choice within a guided framework** (Drexler 2010). Evans & Boucher (2015) found 3–5 options optimal.

**p-book design response:** 4 navigation modes (within optimal range). Missions provide the most structured experience for younger/newer readers; Map provides maximum freedom for experienced readers. The system scaffolds toward more autonomy as competence grows.

### 5.7. Netflix-Style Discovery Interface

**No direct educational evidence for children exists.** This is a novel design space. Indirect evidence from RecSys UX (Konstan & Riedl 2012; Zanker, Rook & Jannach 2019) suggests personalized presentation increases engagement, but educational carousel interfaces are unstudied.

**Risks:** Choice overload may overwhelm children (Schwartz's paradox of choice). "Serendipitous browsing" may not translate to deep learning. Netflix-style UI is optimized for time-on-platform, not learning.

**p-book design response:** Browse mode serves as content discovery; once a block is opened, the reader transitions into a focused reading experience. Shelves are organized by pedagogical function (Continue Reading, Recommended, Games), not purely by engagement optimization.

### 5.8. Infinite Scroll (Read Mode)

**Contra-indicated for children.** Infinite scroll increases time-on-page but reduces comprehension and intentionality (Sera 2023). Users report losing control and feeling regret (Rixen et al. 2023). Screen reading already carries a comprehension penalty vs. paper (d=-0.21; Delgado et al. 2018), though this gap is reduced for children when interactive features are present (Furenes, Kucirkova & Bus 2021). The self-regulation demands of infinite scroll are poorly suited to children's developing executive function (Vedechkina & Borgonovi 2021).

**p-book design response:** While the Read mode uses a scroll-based interface, content is **chunked into discrete blocks** with clear visual boundaries, "Read Next" recommendations at block boundaries (creating natural stopping points), and embedded interactive elements (games, questions) that interrupt passive scrolling. This is paginated-in-spirit within a scroll container, rather than true infinite scroll.

### 5.9. Badges / Rewards / XP

**The highest-risk component.** Short-term motivation boost is documented (Leitao et al. 2021; Kim & Castelli 2021), but the **overjustification effect** is well-established: when extrinsic rewards are removed, motivation can drop below baseline (Gneezy et al. 2011). **Particularly dangerous for reading:** children paid to read subsequently read less. Intangible rewards (badges, status) are more effective than tangible rewards for maintaining intrinsic motivation (Xiao & Hew 2023).

**p-book design response:** XP rewards mastery and exploration (not reading itself), badges are tied to genuine achievement (not participation), the certificate requires completing all 35 core blocks (meaningful milestone). No competitive elements. Future work: study whether XP should be phased out as intrinsic engagement develops.

### 5.10. Reading Personalization

The **strongest evidence area for children.** Multiple children-specific meta-analyses:
- Interactive features in e-storybooks enhance comprehension (d=0.17; Takacs et al. 2015)
- Screen reading disadvantage eliminated with good interactive features (Furenes et al. 2021)
- Animated storybooks show higher comprehension than static (Takacs & Bus 2016)
- Adaptive display parameters help children with dyslexia (Schneps et al. 2013)
- Personalization of characters/settings increases identification and comprehension (Kucirkova 2019)

**p-book design response:** Personalized content recommendations, engagement-mode-based filtering, interactive elements (games, quizzes) embedded within reading flow, SVG illustrations, and multiple content difficulty levels within the same book.

### 5.11. Risks and Counter-Evidence for Children

Comprehensive reviews warn that digital learning for children carries real risks:
- **Fast-paced, highly stimulating content impairs sustained attention** (Vedechkina & Borgonovi 2021)
- **Passive consumption is harmful; interactive engagement is beneficial** — the TYPE of screen use matters more than total time (Straker et al. 2018; Radesky et al. 2014)
- **Media multitasking** is associated with poorer academic outcomes in youth (van der Schuur et al. 2015)
- **Bidirectional relationship:** screen time reduces effortful control, AND children with lower self-control use more screens (Fitzpatrick et al. 2022)

**p-book design response:** All content is interactive (not passive). No autoplay. Clear stopping points. Moderate pace. Gamification avoids overstimulation. Spaced repetition encourages breaks between sessions. Future: parent/teacher co-engagement features via Tiny platform.

### 5.12. Theoretical Integration: SDT as Unifying Framework

Self-Determination Theory unifies the component evidence:

| SDT Need | P-Book Component | Evidence Base |
|---|---|---|
| **Autonomy** | 4 navigation modes, engagement mode choice, Netflix discovery | Conesa et al. 2022 (children); Evans & Boucher 2015; Schneider et al. 2018 |
| **Competence** | Adaptive difficulty, progress visualization, mini-games, spaced repetition | Wang et al. 2024; Yi et al. 2024; Hamari et al. 2015 |
| **Relatedness** | Mission narratives, personalized content, AI tutor, author voice | Breien & Wasson 2020; Kucirkova 2019; Kory Westlund et al. 2017 |

---

## 6. The Book: "How Recommendations Work"

### 6.1. Content Overview

| Chapter | Title | Spine | Depth | Games | Key Concepts |
|---------|-------|-------|-------|-------|-------------|
| 1 | What Are Recommendations? | 4 | 3 | — | RecSys intro, 3 jobs of a recommender |
| 2 | How They Learn About You | 4 | 4 | 2 | Digital footprints, signals, privacy basics |
| 3 | Different Ways to Recommend | 5 | 6 | 3 | CF, content-based, popularity, pipeline |
| 4 | Making Them Better | 5 | 3 | 2 | Filter bubbles, fairness, A/B testing |
| 5 | Build Your Own! | 6 | 3 | — | Step-by-step recommender construction |
| 6 | Ethics and You | 5 | 5 | 1 | Privacy, addictive design, AI, EU law |

### 6.2. Target Audience

Ages 8–15. Content is written with:
- Short paragraphs (2–3 sentences)
- Real-world examples from apps kids use (YouTube, TikTok, Spotify, Netflix)
- Hands-on activities ("grab your phone and try this")
- Progressive complexity (chapters 1–2 beginner, 3–4 intermediate, 5–6 advanced)
- Inclusive language, no condescension

### 6.3. Pedagogical Design

Each chapter follows a pattern:
1. **Hook** — Relatable scenario from a kid's daily life
2. **Core concept** — Explained through analogy and examples
3. **Depth branches** — Explorer (see it), Creator (build it), Thinker (understand why)
4. **Interactive element** — Game, quiz, or worksheet
5. **Reflection prompt** — "Think about it!" metacognitive pause

---

## 7. Planned Research

### 8.1. Primary Research Questions

| RQ | Question | Data Source |
|----|----------|------------|
| **RQ1** | Which navigation paradigm do readers prefer? Are preferences stable across sessions? | Mode dwell time, mode switches, initial mode selection |
| **RQ2** | How do paradigms differ in content coverage and engagement depth? | Spine completion %, depth blocks explored, session duration |
| **RQ3** | Do multi-mode users achieve broader content coverage? | Cross-mode usage patterns vs. coverage metrics |
| **RQ4** | Does recommendation increase depth-block exploration? (within-subject) | Feature toggle: recommendations on vs. off |

### 8.2. Extended Research Questions (Future Work)

| RQ | Question | Method |
|----|----------|--------|
| **RQ5** | Do engagement modes predict voluntary time-on-task? | Behavioral: dwell time × mode-matched content |
| **RQ6** | Does spaced repetition increase return visits? | Longitudinal: SR scheduled vs. actual return |
| **RQ7** | Does gamification sustain engagement beyond novelty period? | Longitudinal: engagement curves over 4+ weeks |
| **RQ8** | Does personalized p-book reading improve comprehension vs. linear e-book? | Controlled study: p-book vs. static PDF, pre/post test |
| **RQ9** | Which gamification elements contribute most to engagement? | Feature-toggle ablation |
| **RQ10** | Can the p-book framework generalize to other content domains? | Second instantiation (different book topic) |

### 8.3. Study Design

**Phase 1 (Short-term, UMAP 2026):** Within-subjects deployment study. Participants use p-book freely over multiple sessions. All dependent variables computed from interaction logs. Feature-toggle A/B for RQ4.

**Phase 2 (Medium-term):** Controlled evaluation comparing personalized p-book vs. linear PDF baseline on comprehension (pre/post test) and retention (delayed post-test). Target: N=30+ children aged 8–15. Ethics approval required.

**Phase 3 (Long-term):** Longitudinal deployment (8+ weeks) to study spaced repetition effects, gamification novelty/habituation curves, and engagement mode stability.

### 8.4. Integration with Tiny Platform

Planned integration with [Tiny](https://tiny.cz) learning platform for:
- **Argumentative chatbots** during reading (beyond simple keyword search)
- **Progress reporting** to teacher/parent profiles
- **Cross-platform analytics** combining p-book data with classroom data
- **Controlled deployment** in school settings

---

## 8. Limitations and Risks

### 8.1. Known Limitations

1. **No empirical evaluation yet.** All component-level evidence comes from meta-analyses of other systems. The integrated p-book has not been tested with users beyond internal piloting (N=8, adults).

2. **Small content catalog.** 83 blocks is small for a recommendation engine — limited signal for collaborative filtering. Recombee's content-based features and voice-based filtering partially mitigate this.

3. **Author-as-evaluator conflict.** The system builder is also the primary evaluator. Planned mitigation: independent evaluation in school settings via Tiny platform.

4. **Gamification novelty effects.** Meta-analyses show engagement effects decline after ~4 weeks. Certificate completion as an intrinsic goal may partially offset this.

5. **Spaced repetition for conceptual content.** Evidence for SR is strongest for factual recall (vocabulary, dates), not for complex conceptual understanding. Effectiveness for book-length narrative content is untested.

6. **Child-safety considerations.** No personal data is collected server-side beyond Recombee interaction logs (anonymous user IDs). Ethics review needed for formal studies with minors.

### 8.2. Engagement Modes Risk

The Explorer/Creator/Thinker dimension could be misinterpreted as "learning styles" by reviewers or users. Mitigation: explicit framing as dynamic preference priors (not stable traits), behavioral updating, and theoretical grounding in SDT/interest/elaboration theory. The onboarding screen label will be changed from "Pick your learning style" to "Pick how you like to explore."

---

## 9. Open-Source Standard

p-book is designed as a **reusable standard**, not just a single book:

- **Content format:** Markdown + YAML frontmatter (any topic, any language)
- **Game engine:** Generic JSON-driven (add games by creating a JSON file)
- **Configuration:** Feature flags for every major component
- **Bot interface:** Machine-discoverable manifest for AI co-authoring
- **Deployment:** Zero-dependency, static hosting, works without backend
- **Contributing workflow:** GitHub-based with CI content validation

Creating a new p-book requires: (1) edit `book.json`, (2) write Markdown content files, (3) optionally configure Recombee. No code changes needed.

---

## 10. References

1. Wang et al. (2024). Effects of AI-enabled adaptive learning on cognitive outcomes: A meta-analysis. *J. Educ. Comput. Res.*
2. Sailer & Homner (2020). The gamification of learning: A meta-analysis. *Educ. Psychol. Rev.*, 32:77–112.
3. Cepeda et al. (2006). Distributed practice in verbal recall tasks. *Psychol. Bull.*, 132(3):354–380.
4. Pashler et al. (2008). Learning styles: Concepts and evidence. *Psychol. Sci. Public Interest*, 9(3):105–119.
5. Touloumakos et al. (2023). Bayesian evidence for the null: No benefit of learning-style matching. *Mind, Brain, Educ.*, 17(4):301–309.
6. Ryan & Deci (2000). Self-determination theory and intrinsic motivation. *Am. Psychol.*, 55(1):68–78.
7. Evans & Boucher (2015). Optimizing the power of choice. *Mind, Brain, Educ.*, 9(2):87–91.
8. Schneider et al. (2018). Autonomy-enhancing effects of choice. *Learn. Instr.*, 58:161–172.
9. Schraw, Flowerday & Lehman (2001). Increasing situational interest. *Educ. Psychol. Rev.*, 13(3):211–224.
10. Reigeluth (1999). *Instructional-Design Theories and Models*, vol. II. Erlbaum.
11. Brusilovsky & Millán (2007). User models for adaptive hypermedia. In *The Adaptive Web*, pp. 3–53. Springer.
12. Sosnovsky & Brusilovsky (2015). Evaluation of topic-based adaptation. *UMUAI*, 25(4):371–424.
13. Sosnovsky, Brusilovsky & Lan (2025). Intelligent textbooks: A survey. *Int. J. AIED.*
14. Lopez Zapata et al. (2025). LECTOR: E-book reading behavior for personalized student support. *Int. J. AIED.*
15. Ritter et al. (2007). Cognitive Tutor. *Psychon. Bull. Rev.*, 14(2):249–255.
16. Cosyn et al. (2021). ALEKS. In *AIED*.
17. Settles & Meeder (2016). A trainable spaced repetition model. In *ACL*, pp. 1848–1858.
18. Chau et al. (2021). Knewton Alta: Adaptive learning for higher education. In *AIED*.
19. Desmarais & Baker (2012). Learner and skill modeling. *UMUAI*, 22(1):9–38.
20. Bull & Kay (2007). SMILI open learner modelling framework. *Int. J. AIED*, 17(2):89–120.
21. Koivisto & Hamari (2022). The rise of motivational information systems. *IJETHE*.
22. Almeida et al. (2022). Gamification in education: Critical analysis. *IJETHE*.
23. Hamari, Koivisto & Sarsa (2014). Does gamification work? In *HICSS*.
24. da Silva et al. (2023). Educational RecSys: A systematic review. *Educ. Inf. Technol.*
