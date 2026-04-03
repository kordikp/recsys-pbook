---
id: ch5-ecommerce
type: spine
title: "Recommendations for E-commerce: Where Money Meets Algorithms"
readingTime: 3
standalone: true
core: false
teaser: "E-commerce recommendation is where RecSys has the most directly measurable business impact — Amazon attributes 35% of revenue to recommendations."
voice: universal
parent: null
diagram: null
recallQ: "What makes e-commerce recommendation different from media recommendation?"
recallA: "Transactions are infrequent and high-stakes, the purchase funnel has distinct stages (browse → consider → purchase), product availability changes in real-time, and recommendations directly drive measurable revenue."
status: accepted
---

E-commerce is where recommendation systems have the most directly measurable impact. Amazon famously attributes 35% of its revenue to recommendations. The reason is straightforward: in a catalog of millions of products, helping users find what they need translates directly into sales.

## What Makes E-commerce Different

**Sparse, high-value interactions.** A user might buy 5 items per month on Amazon, compared to watching 50 videos on YouTube. Each purchase carries more signal but there's much less data per user.

**The purchase funnel.** Users move through distinct stages: browsing → considering → purchasing. Each stage requires different recommendations:
- **Browsing:** Inspire with diverse, relevant items ("You might like...")
- **Considering:** Show alternatives and comparisons ("Similar items," "Compare with...")
- **Purchasing:** Suggest complements ("Frequently bought together," "Complete the look")

**Real-time availability.** You can't recommend an out-of-stock product. Unlike media (where every item is always available), e-commerce must filter by inventory, shipping feasibility, and pricing in real-time.

**Price sensitivity.** A perfect movie recommendation is good regardless of cost (subscription model). A perfect product recommendation at the wrong price point is useless. Price must be a first-class feature.

## Key Recommendation Types

### "Customers who bought this also bought..."

The classic **item-to-item collaborative filtering**. First implemented at Amazon (Linden et al., 2003), it remains one of the most effective e-commerce recommendation techniques.

**Why it works:** Purchase co-occurrence captures complementary relationships (phone case after phone) and substitute relationships (similar shoes) naturally.

### "Recommended for you" (Homepage)

Personalized homepage recommendations use the full user profile — browsing history, purchase history, wishlist, search queries — to surface items the user is likely to be interested in.

**Challenge:** Balancing exploitation (items similar to past purchases) with exploration (introducing new categories). A user who bought running shoes three times doesn't want only running shoes — they might need running socks, a fitness tracker, or a training plan.

### "Frequently bought together"

**Bundle recommendations** predict which items are typically purchased together. This uses association rules (market basket analysis) or more sophisticated models that capture complementary relationships.

**Business impact:** Bundle recommendations drive incremental revenue by increasing cart size. The items being suggested are often low-consideration (batteries, accessories, consumables) that the user would have needed but might not have thought to add.

### "Customers who viewed this ultimately bought..."

A powerful signal: tracking which items users compared before making a final decision. This reveals substitution relationships — products that compete for the same purchase intent.

## Session-Based Intent Detection

E-commerce sessions have strong intent signals:

| Behavior Pattern | Likely Intent | Recommendation Strategy |
|-----------------|--------------|------------------------|
| Browsing many categories | Exploratory | Show diverse, popular items |
| Viewing similar items repeatedly | Comparing | Show comparison features, reviews |
| Adding to cart | Purchase-ready | Show complements, bundles |
| Returning to same item | High interest, undecided | Show price drops, reviews, urgency |
| Search → browse → search | Refining needs | Improve search suggestions |

## The Return Signal

E-commerce has a unique signal that media lacks: **product returns**. A returned item is a strong negative signal — stronger than a bad rating because the user invested money and effort.

Returns should be incorporated as negative training examples, weighted heavily. A model that recommends items with high return rates is actively harmful to the business.

## Pricing and Recommendations

Price creates unique challenges:

- **Price anchoring:** Showing a $200 item next to a $50 item makes the $50 item feel like a bargain
- **Price sensitivity segmentation:** Some users are price-sensitive (show deals), others are quality-focused (show premium items)
- **Dynamic pricing interaction:** If the recommender and the pricing system don't coordinate, you might recommend an item and then change its price — undermining trust

## Metrics That Matter

| Metric | What It Measures | E-commerce Relevance |
|--------|-----------------|---------------------|
| Revenue per session | Direct business impact | Primary metric |
| Conversion rate | Browse-to-buy ratio | Measures recommendation relevance |
| Average order value | Cart size | Bundle recommendation effectiveness |
| Return rate | Post-purchase satisfaction | Quality of recommendations |
| Revenue per recommendation | Incremental value | Measures true causal impact |

For practical implementation guidance, see the [e-commerce recommendation recipes](https://docs.recombee.com/recipes/e-commerce) and an overview of [e-commerce domain solutions](https://www.recombee.com/domains/e-commerce).

**Consider this:** E-commerce recommendation is the domain where the ROI of a better algorithm is most directly measurable. A 1% improvement in recommendation relevance can translate to millions in incremental revenue for a large retailer. This direct feedback loop makes e-commerce both the most rewarding and the most competitive domain for RecSys.