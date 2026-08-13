// p-book for Kids — How Recommendations Work

export const CONFIG = {
  book: {
    title: 'How Recommendations Work',
    author: 'Pavel Kordik',
    contentDir: 'content',
    bookIndex: 'content/book.json'
  },

  recombee: {
    enabled: true,
    database: 'cvachond-land-free-pbook-kids',
    scenarios: {
      homepagePersonal: 'homepage-personal',  // Home "Picked for you"
      homepageVoice: 'homepage-voice',        // Home voice-specific picks
      nextRead: 'next-read',                  // Infinite scroll next chapter
      contextRelated: 'context-related',      // Sidebar related items (item-to-item)
      search: 'search',                       // Search results
    }
  },

  features: {
    socialPreview: false,
    diagrams: true,
    keyboardNav: true,
    progressTracking: true,
    recommendations: true,
    gamification: true,       // XP, levels, badges, certificate — can be disabled
    personalization: true,    // Recombee recs, voice paths — can be disabled
    spaceRepetition: true,    // Recall quizzes
    missions: true,           // Story-driven missions
    games: true,              // Mini-games
    highlights: true,         // AI-generated key takeaways sidebar
    steering: true,           // Per-block knobs: simpler/deeper/more visual/lens switch
    generation: true,         // On-demand variant generation (needs /api/generate + key; probes at runtime)
    community: true,          // Reader-shared generated blocks (opt-in "open mode" per reader)
  },

  tutor: {
    mode: 'mock',              // 'mock' or 'llm' (future)
    escalationThreshold: 0.3,  // confidence below this → suggest author
    authorName: 'Pavel'
  },

  // Voices adapted for kids (8-15 years old)
  // LEGACY: voices are no longer a user-facing preference (replaced by the facet
  // taxonomy + Format preferences). Kept ONLY as display labels for mission branch
  // keys in existing mission data and old content `voice:` tags. Do not extend.
  voices: {
    explorer: { label: 'Explorer', icon: '\u{1F50D}', description: 'How does it work? Show me!' },
    creator: { label: 'Creator', icon: '\u{1F3A8}', description: 'I want to build something!' },
    thinker: { label: 'Thinker', icon: '\u{1F9E0}', description: 'Why does it work that way?' }
  },

  // Facet system (Tier 1) — see _design-collective-pbook.md §3
  // A facet describes HOW a concept is told, never WHAT is taught.
  // Values are ordered where the order is meaningful (depth, visuality, formalism, lengthBand).
  //
  // SUBSPACE COVERAGE: dimensions are not orthogonal and one telling often serves
  // several cells. A block may therefore declare, per dimension, a RANGE on ordered
  // scales ("depth: standard..technical") or a SET on categorical ones
  // ("lens: ecommerce|media"). Matching asks "does this block COVER the target?",
  // not "does it equal it". Single values remain valid (a set of one).
  facets: {
    lens:      { label: 'Example world', values: ['generic', 'ecommerce', 'media', 'social-feeds', 'education', 'jobs'],
                 icons: { generic: '\u{1F310}', ecommerce: '\u{1F6D2}', media: '\u{1F3B5}', 'social-feeds': '\u{1F4F1}', education: '\u{1F393}', jobs: '\u{1F4BC}' } },
    visuality: { label: 'Visual style', values: ['text-first', 'balanced', 'visual-first'], ordered: true },
    depth:     { label: 'Depth', values: ['intro', 'standard', 'technical', 'research'], ordered: true },
    formalism: { label: 'Formulas', values: ['none', 'light', 'full'], ordered: true },
    lengthBand:{ label: 'Length', values: ['tldr', 'standard', 'deep'], ordered: true },
    genre:     { label: 'Genre', values: ['explainer', 'story', 'worked-example', 'code-walkthrough', 'comic', 'animation'] },
    lang:      { label: 'Language', values: ['en', 'cs'], icons: { en: 'EN', cs: 'CZ' } },
    // Composition, not preference: WHICH building blocks the telling uses. Set-valued,
    // mechanically derived from content by migrate-facets (never hand-edited, cannot lie).
    // Intensity lives on the ordered axes: visuality (visuals), formalism (math).
    carriers:  { label: 'Building blocks', values: ['prose', 'table', 'diagram', 'image', 'animation', 'formula', 'code'], derived: true,
                 icons: { prose: '\u{1F4DD}', table: '\u{1F4CA}', diagram: '\u{1F4D0}', image: '\u{1F5BC}', animation: '\u{1F39E}', formula: '\u{2211}', code: '\u{1F4BB}' } },
  },

  // Steering & generation (P1) + community catalog economics (P2)
  // Thresholds per _design-collective-pbook.md §5-§7 — tunable defaults for the pilot.
  // Frugal AI: generation is paid with XP earned by reading,
  // quizzes, games, notes and manual edits. Levels and badges use lifetime
  // XP and never drop when spending.
  aiEconomy: {
    enabled: true,
    freeTrials: 1,                      // first basic-AI use is free
    prices: { basic: 10, advanced: 30 },// basic = text rewrite/insert; advanced = variant/diagram (strong model)
    earnManualEdit: 8,                  // reward for a manual edit (once per section)
  },

  steering: {
    serveThreshold: 0.75,     // facet match ≥ this → serve existing variant, no generate offer
    offerThreshold: 0.45,     // match ≥ this → serve nearest + offer exact generation
    generateEndpoint: '/api/generate',
  },
  community: {
    adoptionK: 5,             // distinct readers with positive signal → nomination queue
    explorationBudget: 50,    // impressions of fair exposure for a new community block
    maxPerConceptLens: 2,     // live community variants per (concept × lens)
    attribution: 'anonymous', // anonymous by default; reader may opt into a nick at share time
  }
};
