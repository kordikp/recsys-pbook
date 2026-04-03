---
id: ch13-marketplaces
type: spine
title: "P2P Marketplaces: When Every Item Is Unique"
readingTime: 3
standalone: true
core: true
teaser: "In a marketplace, each listing can only be sold once. This changes everything about how recommendations work."
voice: universal
parent: null
diagram: null
recallQ: "What is the fundamental constraint of marketplace recommendation?"
recallA: "Items are unique and one-time — once sold, they're gone. This creates extreme sparsity, requires instant cold-start handling for new listings, and demands fair visibility distribution across sellers."
highlights:
  - "Each item sells once — recommending a sold item is a failure"
  - "Seller fairness matters: every listing needs initial visibility"
  - "User-generated content (photos, descriptions) requires NLP and vision processing"
publishedAt: "2026-04-03"
status: accepted
---

P2P marketplaces (eBay, Craigslist, Vinted, OLX) face a recommendation challenge that no other domain shares: **most items can only be purchased once.** A used bicycle, a vintage dress, or a second-hand phone — once it's sold, it's gone forever.

## What Makes Marketplaces Unique

**One-time items.** Every listing is effectively unique and temporary. Standard collaborative filtering struggles because there's no accumulation of interaction data per item — by the time enough users have viewed a listing, it may already be sold. The system must recommend items with zero or near-zero interaction history.

**Extreme sparsity.** With catalogs of [hundreds of millions of items](https://www.recombee.com/domains/p2p-marketplaces) and high turnover, the interaction matrix is extraordinarily sparse. Traditional matrix factorization needs creative adaptation.

**User-generated content.** Unlike e-commerce (professional product photos, structured descriptions), marketplace listings have variable-quality photos taken on smartphones and free-text descriptions of varying length and accuracy. The system must extract meaningful signals from this unstructured content using [deep learning for images and NLP for text](https://www.recombee.com/domains/p2p-marketplaces).

**Three-sided value.** The marketplace must serve three stakeholders simultaneously: buyers (find relevant items), sellers (get visibility for their listings), and the platform (drive transactions and ad revenue). Over-optimizing for any one side harms the others.

**Geographic relevance.** Many marketplace transactions require physical proximity (furniture pickup, car viewing). Geographic functions are essential for filtering and ranking.

## Key Scenarios

**Personalized Homepage.** A blended feed of listings matching the user's browsing patterns, favorite categories, and geographic preferences.

**Similar Offers.** When viewing a listing, show alternatives — similar items from different sellers. Crucial when the viewed item is already sold or out of the user's budget.

**More From This Seller.** If a user engages with one listing from a seller, show the seller's other active listings. Drives seller loyalty and buyer basket size.

**Geographic Search.** "Bicycles within 20 km" with personalized ranking within the results.

## Real-World Results

- **Segundamano:** [3× more conversions](https://www.recombee.com/case-studies/segundamano) from users who engage with recommendations
- **Pet Media Group:** [+17% conversion rate](https://www.recombee.com/case-studies/pet-media-group) from visitor to active buyer
- **Reliving:** [+37% bids placed](https://www.recombee.com/case-studies/reliving) through personalization

**Consider this:** Marketplace recommendation is fundamentally about fairness at scale. If the algorithm only surfaces popular sellers' items, new sellers get no visibility, list fewer items, and the marketplace's catalog shrinks. A healthy marketplace needs an algorithm that balances relevance for buyers with opportunity for sellers — a multi-stakeholder optimization problem that mirrors the broader challenges of algorithmic fairness.