---
id: ch7-transparency
type: spine
title: "The Transparency Spectrum: From Black Box to Glass Box"
readingTime: 2
standalone: true
core: false
teaser: "Full algorithmic transparency is neither practical nor always desirable. What matters is finding the right level on the spectrum -- enough to build trust and satisfy regulators without exposing trade secrets or overwhelming users."
voice: universal
parent: null
diagram: null
recallQ: "What are the five levels of the transparency spectrum for recommendation systems?"
recallA: "No explanation → parameter disclosure (which factors) → mechanism disclosure (how factors interact) → full algorithm disclosure (complete model logic) → data disclosure (training data and features). Each level increases transparency but also increases cost, complexity, and potential for gaming."
highlights:
  - "Five levels: no explanation, parameter disclosure, mechanism disclosure, algorithm disclosure, data disclosure"
  - "The DSA requires at least parameter-level disclosure for very large platforms"
  - "More transparency is not always better -- it can enable gaming and overwhelm users"
publishedAt: "2026-04-03"
status: accepted
---

Transparency in recommendation systems is not binary. Between a fully opaque black box and a fully open glass box lies a spectrum with meaningful stops, each carrying distinct costs and benefits.

## Level 0: No Explanation

The system recommends items with no indication of why. The user sees "Recommended for you" or simply a list of items with no label at all. This was the norm for most recommendation systems before 2018.

**What it costs:** Nothing to implement. **What it delivers:** Nothing in trust or control. In jurisdictions governed by the DSA, this level is no longer compliant for Very Large Online Platforms.

## Level 1: Parameter Disclosure

The system tells users which factors influence recommendations, without revealing how. "Your recommendations are based on your viewing history, the preferences of similar users, and content popularity." This is the level most platforms currently operate at.

**What it costs:** A one-time documentation effort. Minimal engineering. **What it delivers:** Basic regulatory compliance. Users gain a high-level mental model of the system. The DSA's requirement to disclose "main parameters" can be satisfied at this level.

## Level 2: Mechanism Disclosure

The system explains how factors interact for a specific recommendation. "This item was recommended because your viewing history is similar to users who rated it highly, and it matches your preferred genre." The explanation is specific to the individual prediction, not a generic system description.

**What it costs:** An explanation pipeline that generates per-recommendation rationales. This requires either intrinsically interpretable models or post-hoc methods like LIME or SHAP. Computational cost is non-trivial at scale. **What it delivers:** Meaningful user trust and actionable feedback. Users can evaluate and correct the reasoning. Regulators see evidence of genuine algorithmic accountability.

## Level 3: Full Algorithm Disclosure

The complete model logic is disclosed -- architecture, training procedure, hyperparameters, optimization objective. Open-source recommendation models operate at this level. Some academic and government systems publish their full algorithms.

**What it costs:** Competitive advantage. Once the algorithm is public, competitors can replicate it. Gaming becomes easier: if users know exactly how the ranking function works, they can manipulate their inputs to produce desired outputs. For content platforms, this means SEO-style gaming of the recommendation algorithm. **What it delivers:** Maximum auditability. Independent researchers and regulators can verify claims about fairness, diversity, and bias.

## Level 4: Data Disclosure

Beyond the algorithm, the training data and feature values are disclosed. A user can see not only what the model is and how it works, but what data about them was used and what data from other users influenced their recommendations.

**What it costs:** Privacy concerns become acute. Disclosing that "users similar to you" drove a recommendation implicitly reveals information about those other users. Full data disclosure is in tension with data protection regulations -- the same GDPR that demands explainability also prohibits unauthorized disclosure of personal data. **What it delivers:** Complete transparency, but at a cost that is rarely justified outside research settings.

## Where Should You Operate?

Most production systems should target **Level 2** -- mechanism disclosure for individual recommendations. This satisfies current regulatory requirements, builds genuine user trust, and provides the explanation infrastructure that developers need for debugging.

Level 1 is the regulatory minimum and is already becoming insufficient as enforcement matures. Level 3 and above are appropriate for public-sector systems, open-source projects, and organizations that have made radical transparency a strategic choice.

The key insight is that each step up the spectrum incurs not just implementation cost but also **gaming risk** and **complexity cost**. More transparency is not unconditionally better. The right level is the one that serves your users, satisfies your regulators, and does not undermine the system's ability to function effectively.
