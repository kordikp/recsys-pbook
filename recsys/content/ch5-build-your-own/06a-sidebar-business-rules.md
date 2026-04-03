---
id: ch5-business-rules
type: spine
title: "Business Rules: When Product Managers Override Algorithms"
readingTime: 3
standalone: true
core: false
teaser: "The algorithm says 'recommend item X.' The product manager says 'but X is out of stock.' Business rules bridge the gap between algorithmic optimization and real-world constraints."
voice: universal
parent: null
diagram: null
recallQ: "Why are business rules essential in production recommender systems?"
recallA: "Algorithms optimize for relevance, but real-world constraints (inventory, licensing, legal requirements, business strategy) must be enforced separately. Business rules act as a constraint layer that filters and adjusts algorithmic output."
status: accepted
---

A perfectly trained recommendation algorithm is useless if it recommends out-of-stock products, age-restricted content to minors, or items that violate contractual obligations.

**Business rules** are the constraint layer between the algorithm's output and what actually gets shown to users. They encode real-world requirements that no amount of training data can capture.

## Types of Business Rules

### Hard Filters (Must/Must Not)

**Must not show:**
- Out-of-stock items
- Items restricted by user's age/region
- Items the user has already purchased (for non-consumables)
- Competitor products on a brand-exclusive page
- Content under legal dispute or takedown

**Must show:**
- Promoted items (paid placement, campaign items)
- Items from contractual obligations (partnership agreements)
- Required disclosures (sponsored content labels)

### Soft Boosters (Prefer/Deprioritize)

**Boost:**
- New arrivals (freshness bonus)
- High-margin items (business optimization)
- Items with seasonal relevance
- Content from preferred partners

**Deprioritize:**
- Items with high return rates
- Content nearing license expiration
- Low-quality items (below a rating threshold)

### Diversity Constraints

- "At most 2 items from the same brand"
- "No more than 50% from a single category"
- "At least 1 item from each of these 3 genres"
- "Sliding window of 4: max 2 items from same segment"

These diversity rules use concepts like [item segmentations](https://docs.recombee.com/segmentations) to define what "same category" means, often with sophisticated multi-label groupings.

## The Rule Language

Production systems need a way to express business rules that non-engineers can understand and modify. Some systems use a dedicated rule language — for example, [ReQL](https://docs.recombee.com/reql) allows expressions like:

```
'price' < 100 AND 'category' != "electronics"
```

or more complex rules:

```
if context_user["is_premium"] then 'availability' == "premium" else 'availability' == "free"
```

Modern systems even offer **AI-powered rule assistants** that translate natural language into filter expressions: "Recommend only English-language movies shorter than 2 hours" → the system generates the appropriate filter.

## The Rule Ordering Problem

Business rules interact — and the order matters:

1. **Algorithm scores** all candidates
2. **Hard filters** remove ineligible items
3. **Soft boosters** adjust scores
4. **Diversity constraints** ensure variety
5. **Slot constraints** enforce minimum/maximum per category

If hard filters remove too many items, the algorithm may not have enough candidates to fill diversity requirements. If boosters are too aggressive, they override personalization. Finding the right balance requires iteration.

## Common Pitfalls

**Over-constraining.** Too many rules can reduce the candidate pool so severely that the algorithm has no room to personalize. If business rules filter out 90% of items, the remaining 10% may not be diverse or relevant enough.

**Stale rules.** Business rules created for a specific campaign or season can outlive their usefulness. Regular rule audits (quarterly at minimum) prevent accumulated constraints from degrading recommendation quality.

**Rule conflicts.** "Boost high-margin items" + "Ensure diversity" can conflict when high-margin items cluster in one category. Explicit priority ordering resolves this — but someone needs to make that prioritization decision.

**Invisible degradation.** Unlike algorithm changes (which can be A/B tested), business rule changes often bypass experimentation. A product manager adds a rule, quality drops, but nobody connects the two events. **Always measure the impact of rule changes on recommendation metrics.**

## The Balance

The best production systems maintain a clear separation of concerns:

- **The algorithm** optimizes for user relevance (what the user would value)
- **Business rules** enforce real-world constraints (what the business requires)
- **Neither overrides the other** — they work in sequence, each respecting the other's domain

For implementation, managed services like [Recombee provide business rule engines](https://docs.recombee.com/reql) that product teams can use directly — no engineering sprint required for each rule change.

**Consider this:** Business rules are where recommendation systems meet organizational reality. The algorithm doesn't know about your inventory system, your legal department, or your partnership agreements. Business rules are the translation layer — and getting them right is as important as getting the algorithm right.