---
id: ch6-law-sidebar
type: spine
title: "The Regulatory Landscape: Laws Catching Up to Algorithms"
readingTime: 4
standalone: true
teaser: "The DSA, AI Act, GDPR, CCPA -- a growing regulatory framework is targeting recommendation algorithms. But enforcement remains the hard problem."
voice: universal
parent: null
diagram: null
recallQ: "What rights do the DSA and GDPR give users regarding algorithmic recommendations?"
recallA: "Under the DSA: on online platforms (except micro and small ones), a plain-language account of the main parameters and any options to change them, and no profiling-based ads for minors; on very large platforms, at least one recommendation option not based on profiling. Under the GDPR: access to and deletion of personal data, the right to object to profiling, and meaningful information about the logic of automated decisions."
highlights:
  - "The DSA mandates algorithmic transparency and non-profiling recommendation options"
  - "Technology evolves faster than regulation — enforcement perpetually lags"
status: accepted
concept: ai-future
state: edited
lens: generic
visuality: text-first
depth: standard
formalism: none
lengthBand: deep
genre: explainer
carriers: prose
---

Governments globally are building regulatory frameworks for recommendation algorithms. The legislative pace has accelerated significantly, but enforcement and practical impact remain uneven.

**The EU Digital Services Act (DSA)** has applied to everyone since 17 February 2024 (the largest platforms had to comply in 2023). Which recommender duties you have depends on three questions:

1. **Are you an online platform?** In DSA terms that is a hosting service that stores content *for its users* and shows it to the public: a marketplace, a social network, a video-sharing site. A shop recommending its own catalogue, or a publisher recommending its own articles, is usually not one. Its recommenders are still covered by the GDPR and consumer law.
2. **Are you a micro or small enterprise?** Then the platform duties below do not apply to you (unless you are designated very large).
3. **Do you have 45 million or more average monthly active users in the EU, and has the Commission designated you a very large online platform (VLOP) or search engine (VLOSE)?**

The duties at each level:
- **Online platforms that are not micro or small:** explain the **main parameters** of the recommender in the terms and conditions, in plain language, plus any options users have to change them, and let users switch between those options from the place where the feed is shown. No ads based on profiling when the platform is reasonably sure the user is a minor.
- **Very large platforms and search engines, in addition:** offer **at least one recommender option not based on profiling**, and assess and mitigate the systemic risks of their algorithmic systems every year.

The European Commission has already opened formal proceedings against several very large platforms, TikTok among them, over how they assess these risks. Article numbers and thresholds are in the sources below; for a real product decision, check with counsel.

**The EU AI Act**, which entered into force in 2024 with phased implementation through 2026, classifies certain AI systems by risk level. Recommendation systems that significantly influence public opinion or access to information may fall under "high-risk" or "limited-risk" categories, triggering transparency, documentation, and human oversight requirements. The interaction between the AI Act and the DSA creates a layered regulatory environment that platforms must navigate simultaneously.

**GDPR** (in effect since 2018) provides foundational rights relevant to recommendations: the right to access your data, the right to erasure, the right to object to profiling, and the requirement for a lawful basis for data processing. Article 22 specifically addresses automated decisions with legal or similarly significant effects, and Article 15 gives people the right to "meaningful information about the logic involved" in them.

**Outside the EU**, the regulatory landscape is fragmented:
- **CCPA/CPRA** (California): Right to know, delete, and opt out of sale/sharing of personal information. Increasingly emulated by other US states.
- **UK Online Safety Act**: Imposes duty of care on platforms regarding harmful content, with Ofcom as regulator.
- **Australia, South Korea, Japan, India**: Various approaches ranging from platform accountability bills to data protection frameworks.

**The structural challenges are real:**

- **Regulatory lag**: By the time a rule is finalized, the algorithm has been updated hundreds of times. Regulation struggles to keep pace with continuous deployment.
- **Malicious compliance**: Platforms can technically comply while minimizing practical impact. "Opt out of the algorithm" may mean a chronological feed that is deliberately degraded. "Transparency reports" may be 200-page documents written for legal review rather than user comprehension.
- **Jurisdictional arbitrage**: Platforms operate globally but laws are jurisdictional. What is prohibited in the EU may be standard practice in the US.
- **Enforcement capacity**: Regulators are often under-resourced relative to the technical complexity they must oversee. Proving that an algorithm violates a specific regulation requires access to proprietary systems and significant technical expertise.

**The emerging consensus** among researchers and policymakers is that effective governance requires a combination of regulatory mandates (top-down), market pressure from informed users and institutional buyers (bottom-up), technical standards and auditing frameworks (lateral), and platform self-regulation backed by credible enforcement threats.

No single mechanism is sufficient. The most effective protection remains an informed user base that understands both the technology and the regulatory tools available to them.

**Sources:**
- [Regulation (EU) 2022/2065 (Digital Services Act)](https://eur-lex.europa.eu/eli/reg/2022/2065/oj), Official Journal of the EU, 2022: Art. 3(i) (definition of an online platform), Art. 19 (micro and small enterprises exempt), Art. 27 (recommender transparency), Art. 28 (minors), Art. 33 (45 million threshold), Art. 34 (risk assessment), Art. 38 (non-profiling option), Art. 93 (application from 17 February 2024).
- [Regulation (EU) 2016/679 (GDPR)](https://eur-lex.europa.eu/eli/reg/2016/679/oj): Art. 15(1)(h) ("meaningful information about the logic involved"), Art. 21 (right to object), Art. 22 (automated decisions).
