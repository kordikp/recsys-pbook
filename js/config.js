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
      personal: 'personal',
      nextRead: 'next-read'
    }
  },

  features: {
    socialPreview: false,
    diagrams: true,
    keyboardNav: true,
    progressTracking: true,
    recommendations: true
  },

  tutor: {
    mode: 'mock',              // 'mock' or 'llm' (future)
    escalationThreshold: 0.3,  // confidence below this → suggest author
    authorName: 'Pavel'
  },

  // Voices adapted for kids (8-15 years old)
  voices: {
    explorer: { label: 'Explorer', icon: '\u{1F50D}', description: 'How does it work? Show me!' },
    creator: { label: 'Creator', icon: '\u{1F3A8}', description: 'I want to build something!' },
    thinker: { label: 'Thinker', icon: '\u{1F9E0}', description: 'Why does it work that way?' }
  }
};
