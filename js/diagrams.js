// SVG diagram loader and inline generator for p-book
// Loads external SVG files from images/ directory
// Falls back to inline-generated diagrams if files not found

const DIAGRAM_FILES = {
  // Kids diagrams
  'kids-recommendations-everywhere': 'images/kids-recommendations-everywhere.svg',
  'kids-pattern-detective': 'images/kids-pattern-detective.svg',
  'kids-three-jobs': 'images/kids-three-jobs.svg',
  'kids-digital-footprints': 'images/kids-digital-footprints.svg',
  'kids-cold-start': 'images/kids-cold-start.svg',
  'kids-collaborative-filtering': 'images/kids-collaborative-filtering.svg',
  'kids-content-based': 'images/kids-content-based.svg',
  'kids-pipeline': 'images/kids-pipeline.svg',
  'kids-filter-bubble': 'images/kids-filter-bubble.svg',
  'kids-ab-test': 'images/kids-ab-test.svg',
  // Original diagrams (kept as fallback)
  pipeline: 'images/diagram-pipeline.svg',
  'data-sources': 'images/diagram-data-sources.svg',
  stakeholders: 'images/diagram-stakeholders.svg',
  'algorithm-taxonomy': 'images/diagram-algorithm-taxonomy.svg',
  'eval-stack': 'images/diagram-eval-stack.svg',
  objectives: 'images/diagram-objectives.svg',
  // Algorithm-specific diagrams
  'cf-matrix': 'images/diagram-cf-matrix.svg',
  'mf-decomposition': 'images/diagram-mf-decomposition.svg',
  'embedding-space': 'images/diagram-embedding-space.svg',
  'two-tower': 'images/diagram-two-tower.svg',
  attention: 'images/diagram-attention.svg',
  'ann-search': 'images/diagram-ann-search.svg',
  'bandit-exploration': 'images/diagram-bandit-exploration.svg',
  // Comics
  'comic-cf': 'images/comic-cf.svg',
  'comic-mf': 'images/comic-mf.svg',
  'comic-bandits': 'images/comic-bandits.svg',
  // Blog images from recombee.com/blog (Ch1 Introduction, Ch2 Data, Ch3 Objectives)
  'blog-ch1-adtech': 'images/blog/ch1-01.png',           // Targeted advertising illustration
  'blog-ch1-history-svg': 'images/blog/ch1-02.svg',      // YouTube revenue graph
  'blog-ch1-ad-revenue': 'images/blog/ch1-03.png',       // Ad revenue model diagram
  'blog-ch1-ir-history': 'images/blog/ch1-04.png',       // Historical IR systems
  'blog-ch1-conflicts': 'images/blog/ch1-05.png',        // Stakeholder conflicts
  'blog-ch1-product-owner': 'images/blog/ch1-06.png',    // Product owner perspective
  'blog-ch1-content-producer': 'images/blog/ch1-07.png', // Content producer perspective
  'blog-ch1-user': 'images/blog/ch1-08.png',             // User perspective
  'blog-ch2-overview': 'images/blog/ch2-01.png',         // Data structure (catalogs + interactions)
  'blog-ch2-interactions': 'images/blog/ch2-02.png',     // Interaction timeline & flow
  'blog-ch2-feedback': 'images/blog/ch2-03.png',         // Recommendation scenarios
  'blog-ch3-objectives': 'images/blog/ch3-01.png',       // 4-perspective taxonomy (user/content/biz/product)
  'blog-ch3-starplot': 'images/blog/ch3-02.png',         // Recombee Logics & Scenarios
  // Alias mappings (content references → available files)
  'sasrec-architecture': 'images/diagram-attention.svg',
  'two-tower-training': 'images/diagram-two-tower.svg',
  'bandit-regret-bounds': 'images/diagram-bandit-exploration.svg',
  'lightgcn-propagation': 'images/diagram-algorithm-taxonomy.svg',
  'mf-optimization-landscape': 'images/diagram-mf-decomposition.svg',
  'similarity-metrics': 'images/diagram-cf-matrix.svg',
};

const diagramCache = {};

export async function getDiagram(name) {
  if (diagramCache[name]) return diagramCache[name];

  const file = DIAGRAM_FILES[name];
  if (file) {
    // For raster images (PNG, JPG, WEBP), return <img> tag
    if (/\.(png|jpg|jpeg|webp|gif)$/i.test(file)) {
      const img = `<img src="${file}" alt="${name}" style="max-width:100%;border-radius:8px;">`;
      diagramCache[name] = img;
      return img;
    }
    // For SVG, fetch and inline
    try {
      const res = await fetch(file);
      if (res.ok) {
        const svg = await res.text();
        diagramCache[name] = svg;
        return svg;
      }
    } catch (e) {
      // File not found, use inline fallback
    }
  }

  // Inline fallback
  const svg = generateFallback(name);
  diagramCache[name] = svg;
  return svg;
}

function generateFallback(name) {
  const generators = {
    pipeline: fallbackPipeline,
    'data-sources': fallbackDataSources,
    stakeholders: fallbackStakeholders,
    'algorithm-taxonomy': fallbackAlgorithmTaxonomy,
    'eval-stack': fallbackEvalStack,
    objectives: fallbackObjectives
  };

  const gen = generators[name];
  return gen ? gen() : `<div class="diagram-placeholder">Diagram: ${name}</div>`;
}

function fallbackPipeline() {
  return `<svg viewBox="0 0 680 180" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#78716C"/>
    </marker>
  </defs>
  <!-- Stage 1: Retrieve -->
  <rect x="10" y="40" width="170" height="100" rx="10" fill="#EFF6FF" stroke="#2563EB" stroke-width="1.5"/>
  <text x="95" y="68" text-anchor="middle" font-family="system-ui" font-size="13" font-weight="700" fill="#2563EB">RETRIEVE</text>
  <text x="95" y="88" text-anchor="middle" font-family="system-ui" font-size="10" fill="#57534E">Candidate generation</text>
  <text x="95" y="104" text-anchor="middle" font-family="system-ui" font-size="10" fill="#57534E">Fast, high recall</text>
  <text x="95" y="125" text-anchor="middle" font-family="system-ui" font-size="9" fill="#A8A29E">millions → hundreds</text>
  <!-- Arrow 1 -->
  <line x1="185" y1="90" x2="235" y2="90" stroke="#78716C" stroke-width="1.5" marker-end="url(#arrow)"/>
  <!-- Stage 2: Rank -->
  <rect x="240" y="40" width="170" height="100" rx="10" fill="#ECFDF5" stroke="#059669" stroke-width="1.5"/>
  <text x="325" y="68" text-anchor="middle" font-family="system-ui" font-size="13" font-weight="700" fill="#059669">RANK</text>
  <text x="325" y="88" text-anchor="middle" font-family="system-ui" font-size="10" fill="#57534E">Scoring &amp; ordering</text>
  <text x="325" y="104" text-anchor="middle" font-family="system-ui" font-size="10" fill="#57534E">Precise, ML models</text>
  <text x="325" y="125" text-anchor="middle" font-family="system-ui" font-size="9" fill="#A8A29E">hundreds → tens</text>
  <!-- Arrow 2 -->
  <line x1="415" y1="90" x2="465" y2="90" stroke="#78716C" stroke-width="1.5" marker-end="url(#arrow)"/>
  <!-- Stage 3: Re-rank -->
  <rect x="470" y="40" width="200" height="100" rx="10" fill="#FFFBEB" stroke="#D97706" stroke-width="1.5"/>
  <text x="570" y="68" text-anchor="middle" font-family="system-ui" font-size="13" font-weight="700" fill="#D97706">RE-RANK</text>
  <text x="570" y="88" text-anchor="middle" font-family="system-ui" font-size="10" fill="#57534E">Diversity, rules, constraints</text>
  <text x="570" y="104" text-anchor="middle" font-family="system-ui" font-size="10" fill="#57534E">Business logic, fairness</text>
  <text x="570" y="125" text-anchor="middle" font-family="system-ui" font-size="9" fill="#A8A29E">tens → final list</text>
  <!-- Title -->
  <text x="340" y="20" text-anchor="middle" font-family="system-ui" font-size="12" font-weight="600" fill="#1C1917">The Recommendation Pipeline</text>
  <!-- Bottom label -->
  <text x="340" y="170" text-anchor="middle" font-family="system-ui" font-size="10" fill="#A8A29E">Different algorithms at each stage — simple retrieval, complex ranking, rule-based constraints</text>
</svg>`;
}

function fallbackDataSources() {
  return `<svg viewBox="0 0 680 220" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">
  <text x="340" y="20" text-anchor="middle" font-family="system-ui" font-size="12" font-weight="600" fill="#1C1917">Three Pillars of Recommendation Data</text>
  <!-- Pillar 1: Items -->
  <rect x="30" y="40" width="180" height="90" rx="10" fill="#EFF6FF" stroke="#2563EB" stroke-width="1.5"/>
  <text x="120" y="65" text-anchor="middle" font-family="system-ui" font-size="13" font-weight="700" fill="#2563EB">Item Catalog</text>
  <text x="120" y="85" text-anchor="middle" font-family="system-ui" font-size="10" fill="#57534E">Titles, descriptions, images</text>
  <text x="120" y="100" text-anchor="middle" font-family="system-ui" font-size="10" fill="#57534E">Categories, attributes</text>
  <text x="120" y="118" text-anchor="middle" font-family="system-ui" font-size="9" fill="#A8A29E">What can be recommended</text>
  <!-- Pillar 2: Interactions (larger) -->
  <rect x="230" y="30" width="220" height="110" rx="10" fill="#FEF3C7" stroke="#D97706" stroke-width="2"/>
  <text x="340" y="58" text-anchor="middle" font-family="system-ui" font-size="14" font-weight="700" fill="#D97706">Interactions</text>
  <text x="340" y="78" text-anchor="middle" font-family="system-ui" font-size="10" fill="#57534E">Clicks, views, purchases</text>
  <text x="340" y="93" text-anchor="middle" font-family="system-ui" font-size="10" fill="#57534E">Ratings, time spent, skips</text>
  <text x="340" y="125" text-anchor="middle" font-family="system-ui" font-size="9" fill="#92400E">Most important data source</text>
  <!-- Pillar 3: Users -->
  <rect x="470" y="40" width="180" height="90" rx="10" fill="#ECFDF5" stroke="#059669" stroke-width="1.5"/>
  <text x="560" y="65" text-anchor="middle" font-family="system-ui" font-size="13" font-weight="700" fill="#059669">User Catalog</text>
  <text x="560" y="85" text-anchor="middle" font-family="system-ui" font-size="10" fill="#57534E">Location, preferences</text>
  <text x="560" y="100" text-anchor="middle" font-family="system-ui" font-size="10" fill="#57534E">History, device, session</text>
  <text x="560" y="118" text-anchor="middle" font-family="system-ui" font-size="9" fill="#A8A29E">Who is being recommended to</text>
  <!-- Arrows down -->
  <line x1="120" y1="132" x2="300" y2="185" stroke="#2563EB" stroke-width="1.5" stroke-dasharray="4 3"/>
  <line x1="340" y1="142" x2="340" y2="180" stroke="#D97706" stroke-width="2"/>
  <line x1="560" y1="132" x2="380" y2="185" stroke="#059669" stroke-width="1.5" stroke-dasharray="4 3"/>
  <!-- Recommender box -->
  <rect x="250" y="180" width="180" height="35" rx="8" fill="#1C1917"/>
  <text x="340" y="202" text-anchor="middle" font-family="system-ui" font-size="12" font-weight="600" fill="white">Recommender System</text>
</svg>`;
}

function fallbackStakeholders() {
  return `<svg viewBox="0 0 680 260" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">
  <text x="340" y="20" text-anchor="middle" font-family="system-ui" font-size="12" font-weight="600" fill="#1C1917">Stakeholder Balance</text>
  <!-- Users (top) -->
  <rect x="265" y="35" width="150" height="60" rx="10" fill="#EFF6FF" stroke="#2563EB" stroke-width="1.5"/>
  <text x="340" y="60" text-anchor="middle" font-family="system-ui" font-size="12" font-weight="700" fill="#2563EB">Users</text>
  <text x="340" y="78" text-anchor="middle" font-family="system-ui" font-size="9" fill="#57534E">Relevance, discovery, trust</text>
  <!-- Producers (bottom-left) -->
  <rect x="80" y="160" width="170" height="60" rx="10" fill="#ECFDF5" stroke="#059669" stroke-width="1.5"/>
  <text x="165" y="185" text-anchor="middle" font-family="system-ui" font-size="12" font-weight="700" fill="#059669">Content Producers</text>
  <text x="165" y="203" text-anchor="middle" font-family="system-ui" font-size="9" fill="#57534E">Audience, fair exposure</text>
  <!-- Platform (bottom-right) -->
  <rect x="430" y="160" width="170" height="60" rx="10" fill="#FFFBEB" stroke="#D97706" stroke-width="1.5"/>
  <text x="515" y="185" text-anchor="middle" font-family="system-ui" font-size="12" font-weight="700" fill="#D97706">Platform Owners</text>
  <text x="515" y="203" text-anchor="middle" font-family="system-ui" font-size="9" fill="#57534E">Engagement, revenue, growth</text>
  <!-- Lines -->
  <line x1="290" y1="95" x2="200" y2="160" stroke="#E7E5E4" stroke-width="1.5"/>
  <line x1="390" y1="95" x2="480" y2="160" stroke="#E7E5E4" stroke-width="1.5"/>
  <line x1="250" y1="190" x2="430" y2="190" stroke="#E7E5E4" stroke-width="1.5"/>
  <!-- Center -->
  <circle cx="340" cy="140" r="28" fill="#1C1917"/>
  <text x="340" y="136" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="600" fill="white">Recommender</text>
  <text x="340" y="148" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="600" fill="white">System</text>
  <!-- Tension labels -->
  <text x="240" y="125" text-anchor="middle" font-family="system-ui" font-size="8" fill="#DC2626" transform="rotate(-30 240 125)">tension</text>
  <text x="440" y="125" text-anchor="middle" font-family="system-ui" font-size="8" fill="#DC2626" transform="rotate(30 440 125)">tension</text>
  <text x="340" y="245" text-anchor="middle" font-family="system-ui" font-size="10" fill="#A8A29E">The recommender system must balance competing stakeholder interests</text>
</svg>`;
}

function fallbackAlgorithmTaxonomy() {
  return `<svg viewBox="0 0 680 320" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">
  <text x="340" y="20" text-anchor="middle" font-family="system-ui" font-size="12" font-weight="600" fill="#1C1917">Algorithm Taxonomy</text>
  <!-- Root -->
  <rect x="260" y="30" width="160" height="28" rx="6" fill="#1C1917"/>
  <text x="340" y="49" text-anchor="middle" font-family="system-ui" font-size="10" font-weight="600" fill="white">Recommender Algorithms</text>
  <!-- Branches -->
  ${taxonomyBranch(30, 80, '#78716C', '#F5F5F4', 'Baselines', ['Popularity', 'Recency', 'Association Rules'])}
  ${taxonomyBranch(170, 80, '#2563EB', '#EFF6FF', 'Collaborative Filtering', ['User/Item kNN', 'Matrix Factorization', 'Autoencoders'])}
  ${taxonomyBranch(330, 80, '#059669', '#ECFDF5', 'Content-Based', ['Text Embeddings', 'Image Embeddings', 'Feature Eng.'])}
  ${taxonomyBranch(480, 80, '#7C3AED', '#F5F3FF', 'Deep Learning', ['Neural CF', 'Transformers', 'Two-Tower', 'GNNs'])}
  <!-- Lines from root to branches -->
  <line x1="300" y1="58" x2="95" y2="80" stroke="#E7E5E4" stroke-width="1"/>
  <line x1="320" y1="58" x2="240" y2="80" stroke="#E7E5E4" stroke-width="1"/>
  <line x1="360" y1="58" x2="395" y2="80" stroke="#E7E5E4" stroke-width="1"/>
  <line x1="380" y1="58" x2="545" y2="80" stroke="#E7E5E4" stroke-width="1"/>
  <!-- Hybrid note -->
  <rect x="220" y="280" width="240" height="28" rx="6" fill="#FFFBEB" stroke="#D97706" stroke-width="1.5"/>
  <text x="340" y="299" text-anchor="middle" font-family="system-ui" font-size="10" font-weight="600" fill="#D97706">Hybrid &amp; Ensemble (production standard)</text>
  <line x1="340" y1="268" x2="340" y2="280" stroke="#D97706" stroke-width="1.5" stroke-dasharray="4 3"/>
</svg>`;
}

function taxonomyBranch(x, y, color, bg, title, items) {
  const w = 120;
  let html = `<rect x="${x}" y="${y}" width="${w}" height="${28 + items.length * 18}" rx="6" fill="${bg}" stroke="${color}" stroke-width="1"/>`;
  html += `<text x="${x + w/2}" y="${y + 17}" text-anchor="middle" font-family="system-ui" font-size="10" font-weight="600" fill="${color}">${title}</text>`;
  items.forEach((item, i) => {
    html += `<text x="${x + w/2}" y="${y + 35 + i * 18}" text-anchor="middle" font-family="system-ui" font-size="9" fill="#57534E">${item}</text>`;
  });
  return html;
}

function fallbackEvalStack() {
  return `<svg viewBox="0 0 680 280" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">
  <text x="340" y="20" text-anchor="middle" font-family="system-ui" font-size="12" font-weight="600" fill="#1C1917">The Evaluation Stack</text>
  <!-- Layers (bottom to top) -->
  <rect x="120" y="220" width="440" height="40" rx="6" fill="#EFF6FF" stroke="#2563EB" stroke-width="1.5"/>
  <text x="340" y="244" text-anchor="middle" font-family="system-ui" font-size="11" font-weight="600" fill="#2563EB">Offline Evaluation</text>
  <text x="568" y="244" text-anchor="start" font-family="system-ui" font-size="8" fill="#57534E">Fast, cheap</text>

  <rect x="150" y="172" width="380" height="40" rx="6" fill="#F5F3FF" stroke="#7C3AED" stroke-width="1.5"/>
  <text x="340" y="196" text-anchor="middle" font-family="system-ui" font-size="11" font-weight="600" fill="#7C3AED">Counterfactual Evaluation</text>
  <text x="538" y="196" text-anchor="start" font-family="system-ui" font-size="8" fill="#57534E">Bias-corrected</text>

  <rect x="180" y="124" width="320" height="40" rx="6" fill="#ECFDF5" stroke="#059669" stroke-width="1.5"/>
  <text x="340" y="148" text-anchor="middle" font-family="system-ui" font-size="11" font-weight="600" fill="#059669">A/B Testing</text>
  <text x="508" y="148" text-anchor="start" font-family="system-ui" font-size="8" fill="#57534E">Gold standard</text>

  <rect x="210" y="76" width="260" height="40" rx="6" fill="#FEF2F2" stroke="#DC2626" stroke-width="1.5"/>
  <text x="340" y="100" text-anchor="middle" font-family="system-ui" font-size="11" font-weight="600" fill="#DC2626">Segment Analysis</text>
  <text x="478" y="100" text-anchor="start" font-family="system-ui" font-size="8" fill="#57534E">Find failures</text>

  <rect x="240" y="32" width="200" height="36" rx="6" fill="#FFFBEB" stroke="#D97706" stroke-width="1.5"/>
  <text x="340" y="54" text-anchor="middle" font-family="system-ui" font-size="11" font-weight="600" fill="#D97706">Monitoring</text>
  <text x="448" y="54" text-anchor="start" font-family="system-ui" font-size="8" fill="#57534E">Continuous</text>

  <!-- Side labels -->
  <text x="100" y="140" text-anchor="middle" font-family="system-ui" font-size="9" fill="#A8A29E" transform="rotate(-90 100 140)">Reliability →</text>
  <text x="600" y="140" text-anchor="middle" font-family="system-ui" font-size="9" fill="#A8A29E" transform="rotate(90 600 140)">Cost →</text>
</svg>`;
}

function fallbackObjectives() {
  return `<svg viewBox="0 0 680 300" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">
  <text x="340" y="20" text-anchor="middle" font-family="system-ui" font-size="12" font-weight="600" fill="#1C1917">Objective Profiles by Domain</text>
  ${radarChart(340, 165, 110, [
    { label: 'Engagement', angle: -90 },
    { label: 'Relevance', angle: -30 },
    { label: 'Diversity', angle: 30 },
    { label: 'Revenue', angle: 90 },
    { label: 'Fairness', angle: 150 },
    { label: 'Freshness', angle: 210 }
  ], [
    { name: 'E-commerce', color: '#2563EB', values: [0.7, 0.9, 0.4, 0.9, 0.5, 0.3] },
    { name: 'News', color: '#D97706', values: [0.9, 0.7, 0.8, 0.4, 0.6, 0.95] }
  ])}
  <!-- Legend -->
  <rect x="240" y="280" width="10" height="10" rx="2" fill="#2563EB" opacity="0.3" stroke="#2563EB"/>
  <text x="255" y="289" font-family="system-ui" font-size="10" fill="#2563EB">E-commerce</text>
  <rect x="350" y="280" width="10" height="10" rx="2" fill="#D97706" opacity="0.3" stroke="#D97706"/>
  <text x="365" y="289" font-family="system-ui" font-size="10" fill="#D97706">News</text>
</svg>`;
}

function radarChart(cx, cy, r, axes, profiles) {
  let html = '';
  const n = axes.length;

  // Grid circles
  for (let i = 1; i <= 4; i++) {
    const gr = r * i / 4;
    html += `<circle cx="${cx}" cy="${cy}" r="${gr}" fill="none" stroke="#E7E5E4" stroke-width="0.5"/>`;
  }

  // Axis lines and labels
  axes.forEach((axis, i) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    const x2 = cx + Math.cos(angle) * r;
    const y2 = cy + Math.sin(angle) * r;
    html += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#E7E5E4" stroke-width="0.5"/>`;
    const lx = cx + Math.cos(angle) * (r + 20);
    const ly = cy + Math.sin(angle) * (r + 20);
    html += `<text x="${lx}" y="${ly + 3}" text-anchor="middle" font-family="system-ui" font-size="9" fill="#57534E">${axis.label}</text>`;
  });

  // Profile polygons
  profiles.forEach(profile => {
    const points = profile.values.map((v, i) => {
      const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
      const x = cx + Math.cos(angle) * r * v;
      const y = cy + Math.sin(angle) * r * v;
      return `${x},${y}`;
    }).join(' ');
    html += `<polygon points="${points}" fill="${profile.color}" fill-opacity="0.15" stroke="${profile.color}" stroke-width="1.5"/>`;
    // Dots
    profile.values.forEach((v, i) => {
      const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
      const x = cx + Math.cos(angle) * r * v;
      const y = cy + Math.sin(angle) * r * v;
      html += `<circle cx="${x}" cy="${y}" r="3" fill="${profile.color}"/>`;
    });
  });

  return html;
}
