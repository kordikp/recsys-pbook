---
id: recommender-regulation
type: spine
title: "Does the EU Regulate Your Recommender? Three Questions"
readingTime: 3
standalone: true
core: false
teaser: "Platform, small, very large: three questions decide whether the Digital Services Act's recommender duties are yours. GDPR applies either way."
parent: null
diagram: diagram-recommender-regulation-tree
recallQ: "How does a product team find out which EU rules apply to its recommender, and what does the Digital Services Act require at each level?"
recallA: "Ask three questions in order. Is the service an online platform, where users publish content to the public through it? If not, or if it is a micro or small enterprise, the DSA's recommender duties do not apply. Other platforms must explain the main parameters of their recommenders in plain language in their terms and conditions, including any options users have to change them (Art. 27). Only very large platforms (at least 45 million monthly EU users, designated by the Commission) must also offer at least one option not based on profiling (Art. 38). GDPR and consumer law apply to every personalized recommender regardless."
highlights:
  - "Online platform = hosting service that stores and shows users' content to the public (DSA Art. 3(i)); own-catalogue shops and publishers are typically not one; minor ancillary features such as newspaper comments don't count (recital 13)"
  - "Micro and small enterprises (<50 staff and ≤€10M turnover or balance sheet) are exempt from the platform section, which includes Art. 27, unless designated very large (Art. 19)"
  - "Non-exempt platforms: main parameters of each recommender in plain language in the T&C, including the most significant criteria, why they matter, and any user options to change them; if there are several options, a selector directly accessible where the list is ranked (Art. 27). The DSA's recommender definition includes ordering search results (Art. 3(s))"
  - "VLOP/VLOSE only (≥45M average monthly active EU users AND designated): at least one option per recommender not based on profiling (Art. 38); yearly systemic-risk assessment covering algorithmic systems (Art. 34)"
  - "Everyone: GDPR (personalization is profiling, Art. 4(4); needs a lawful basis; right to object to direct-marketing profiling, Art. 21) and consumer law (marketplace search ranking parameters, disclosure of paid placement in search results)"
  - "Orientation, not legal advice: check with counsel"
status: accepted
concept: recommender-regulation
conceptTitle: "Recommender rules in the EU"
parents: explanations|steerability|privacy-reality|who-decides
state: edited
lens: ecommerce
lang: en
depth: standard
formalism: none
visuality: balanced
lengthBand: deep
genre: explainer
carriers: prose|diagram
objective: "A product owner can work out which EU rules apply to their recommender by asking three questions in order (online platform? micro/small? very large?), and knows what the DSA requires at each level and what applies regardless (GDPR, consumer law)."
forbidden: "Claiming Art. 27 applies to every online service or every online platform regardless of size | Claiming the non-profiling option (Art. 38) is required of all platforms | Claiming recommender systems are high-risk under the AI Act per se | Presenting the content as legal advice or omitting the 'check with counsel' caveat | Invented fines, case outcomes, or article numbers not verified against the official text"
---

Jana owns the product at an online bookshop with 120 employees and a "For you" row. Legal asks whether the EU **Digital Services Act (DSA)** applies to it. Three questions, in order, decide it.

**1. Do users publish through you?** The DSA's recommender rules apply to **online platforms**: services that store content *for their users* and show it to the public, such as marketplaces and social networks. A shop recommending its own catalogue, or a publisher recommending its own articles, is typically not one. A minor ancillary feature, like the comments under a newspaper article, doesn't count. Jana's bookshop today: **no**. Next spring it opens a marketplace for second-hand sellers. Then: **yes**.

**2. Are you micro or small?** In EU terms, small means fewer than 50 staff and at most €10 million in annual turnover or balance sheet. Such platforms are exempt from the recommender duties unless designated very large (Art. 19). Jana's 120 people: **not exempt**.

**3. Are you very large?** A **very large online platform (VLOP)** has at least 45 million average monthly active users in the EU and has been designated by the European Commission; search engines of that size are **VLOSEs**. Jana: **no**.

**What lands on Jana's desk (Art. 27).** The terms and conditions must state, in plain language, each recommender's **main parameters**: the criteria that matter most and why. ("Mostly what you've browsed and bought, then what similar readers buy.") The DSA's definition of a recommender includes ordering search results, so marketplace search is in scope too. If users can pick an ordering ("for you" or "newest"), the switch must sit where the list is shown. That one text is half of her [explanation](#c/explanations) and [steering](#c/steerability) design.

**What only the giants owe.** VLOPs and VLOSEs must also offer, for each recommender, at least one option **not based on profiling**, meaning not built from the user's personal profile (Art. 38). They must assess the systemic risks of their algorithmic systems at least once a year (Art. 34). For Jana, a "chronological feed" toggle is a design choice, not a duty.

**What applies to everyone.** Predicting a person's preferences and interests from their data is **profiling** under the **GDPR**, so every personalized recommender needs a lawful basis (Art. 6), such as consent or legitimate interest. If you profile for direct marketing (a "picked for you" email), people can object at any time and you must stop (Art. 21). **Consumer law** adds that marketplace search must explain its main ranking parameters and disclose paid placement. Jana's shop owed GDPR all along; the marketplace adds the DSA.

**Takeaway:** answer the three questions (platform? small? very large?) before designing a "Why am I seeing this?" panel, then take them to counsel. This is a map, not legal advice; the article numbers are where your lawyer starts reading.

**Sources:**
- Regulation (EU) 2022/2065 (Digital Services Act): Art. 3(i) and 3(s) definitions, recitals 13, 57 and 70, Arts. 19, 27, 33, 34, 38. https://eur-lex.europa.eu/eli/reg/2022/2065/oj
- Regulation (EU) 2016/679 (GDPR): Art. 4(4) profiling, Art. 6(1) lawful bases, Art. 21(2)-(3) right to object to direct marketing. https://eur-lex.europa.eu/eli/reg/2016/679/oj
- Directive (EU) 2019/2161 (consumer-law "Omnibus" directive), amending Directive 2005/29/EC: ranking parameters (Art. 7(4a)) and paid placement in search results (Annex I, point 11a). https://eur-lex.europa.eu/eli/dir/2019/2161/oj
- European Commission, SME definition (Recommendation 2003/361/EC thresholds). https://single-market-economy.ec.europa.eu/smes/sme-fundamentals/sme-definition_en
