---
id: ch13-ecommerce
type: spine
title: "E-Commerce: Where Recommendations Drive Revenue"
readingTime: 4
standalone: true
core: true
teaser: "Amazon attributes 35% of revenue to recommendations. E-commerce is where RecSys has the most directly measurable business impact."
voice: universal
parent: null
diagram: null
recallQ: "What are the key e-commerce recommendation scenarios beyond 'similar products'?"
recallA: "Shopping cart (cross-sell), alternative products, upsell (higher-end versions), next basket prediction, personalized category browsing, top brands for you, and new arrivals personalized to taste."
highlights:
  - "Cross-sell and upsell are distinct scenarios with different algorithmic approaches"
  - "Next basket prediction uses sequential models to anticipate regular purchases"
  - "Return rate is a critical negative signal unique to e-commerce"
publishedAt: "2026-04-03"
status: accepted
---

E-commerce is the domain where recommendation quality translates most directly into revenue. Amazon's famous "Customers who bought this also bought" is one of the oldest and most profitable recommendation features in existence — [driving roughly 35% of total revenue](https://www.recombee.com/blog/modern-recommender-systems-part-1-introduction).

## What Makes E-Commerce Unique

**Transaction-driven signals.** Unlike media (where engagement is the goal), e-commerce has a clear conversion event: the purchase. This creates a well-defined optimization target — but also introduces complexity. A click means interest. An add-to-cart means intent. A purchase means conversion. A return means failure. Each signal requires different treatment.

**Inventory constraints.** You can't recommend an out-of-stock product. Unlike streaming (where every item is always "available"), e-commerce must filter by real-time inventory, shipping feasibility, and pricing. The recommendation pipeline must integrate with inventory systems at serving time.

**Product attributes matter.** Size, color, material, price range, brand — e-commerce items have rich structured attributes that users filter by explicitly. Recommendations must respect these constraints: don't recommend a size S shoe to someone who always buys size 10.

**Anonymous visitors.** A large fraction of e-commerce traffic is anonymous — first-time visitors with zero history. The system must provide useful recommendations from the very first page view, using contextual signals (referral source, device, geography) and popularity-based approaches. For strategies to handle anonymous users, see [e-commerce recipes](https://docs.recombee.com/recipes/e-commerce).

![lottie:utilize-instant-user-understanding](Instantly understanding new visitors through contextual signals and real-time behavior)

## The 12 Key Scenarios

**Personalized Homepage.** Multiple recommendation rows: "Recommended for You," "Based on Recent Browsing," "Top Brands For You," "New Arrivals." Each row uses different logic — collaborative filtering for personalization, trending for social proof, recency for freshness.

![Fully personalized e-commerce homepage with product recommendation rows tailored to the shopper](/images/domains/e-commerce/fully-personalized-homepage.png)

![lottie:optimize-product-discovery](Optimizing product discovery through personalized homepage rows and smart categorization)

**Product Detail Page — Similar Products.** "You might also like" — items similar to the one being viewed. Can use content-based (same category, similar features) or collaborative (users who viewed this also viewed).

**Product Detail Page — Alternative Products.** Subtly different from similar: alternatives are *substitutes* that compete for the same purchase intent. "Instead of this laptop, consider these." Useful when a product is out of stock or highly priced.

**Shopping Cart — Cross-Sell.** "Frequently bought together." Items that complement what's already in the cart: phone case for a phone, batteries for a toy, matching accessories. These should be low-consideration, easy add-ons.

![Shopping cart page with cross-sell recommendations showing complementary products](/images/domains/e-commerce/shopping-cart.png)

![Cross-sell suggestions displaying frequently bought together items alongside the current product](/images/domains/e-commerce/cross-sell.png)

**Upsell.** Higher-end versions of the item being viewed or in the cart. "Upgrade to the Pro model" or "Premium version with extended warranty." Must be subtle — overly aggressive upselling erodes trust.

**Personalized Category Browsing.** When a user browses "Running Shoes," the ranking within the category is personalized — their preferred brands and price ranges appear first.

**Next Basket Prediction.** For repeat-purchase categories (groceries, consumables, pet supplies): predict what the user will buy next based on purchase history and typical repurchase cycles. This is where [sequential models like ReALM](https://www.recombee.com/research-publications) excel.

![lottie:drive-sales-with-next-basket-prediction](Predicting the next purchase based on buying patterns and repurchase cycles)

**Personalized Search.** Search results re-ranked by user preferences. Two users searching "winter jacket" see different results based on their brand preferences, price sensitivity, and style history.

**Personalized Email.** Weekly or triggered emails with product recommendations. Must include rotation logic — never show the same items in consecutive emails. "New arrivals matching your taste" or "Price drop on items you viewed."

## Metrics That Matter

| Metric | What It Measures | Target |
|--------|-----------------|--------|
| Revenue per session | Direct business impact | Primary |
| Conversion rate | Browse-to-buy efficiency | 2-5% typical |
| Average order value | Cart size / upsell effectiveness | Track lift |
| Return rate | Recommendation quality (negative) | Minimize |
| Revenue per recommendation | Incremental value of recs | Causal attribution |

## Implementation Recipe

Concrete configurations for the highest-impact e-commerce scenarios. Each maps directly to an API call with specific scenario ID, logic, and parameters.

**"For You" Homepage.** The primary personalized homepage row. Use scenario `just-for-you` with logic `ecommerce:homepage`. Optionally filter to new arrivals (items added within a number of days) or to a specific category. Use a booster to promote items on sale. When building a multi-row homepage, set `distinctRecomms: true` across batch calls to deduplicate items across rows.

```
scenario: "just-for-you"
logic: "ecommerce:homepage"
filter: "'category' == \"Electronics\""                 # optional category filter
booster: "if 'on_sale' then 2 else 1"                   # promote sale items
cascadeCreate: true
distinctRecomms: true                                    # deduplicate across homepage rows
```

**Cart Cross-Sell.** When the user views their cart, show complementary products that other buyers purchased alongside the cart items. Use scenario `cart` with logic `ecommerce:cross-sell` and Items to User recommendation type. The system needs historical purchase data to learn co-purchase patterns. This is the classic "phone + case + screen protector" pattern.

```
scenario: "cart"
logic: "ecommerce:cross-sell"
# Type: Items to User (uses the user's current cart context)
# Requires: historical purchase interaction data
cascadeCreate: true
# Placement: shopping cart page, "Complete your order" row
```

**Bought Together (PDP).** On the product detail page, show products frequently purchased alongside the viewed item. Use scenario `pdp-bought-together` with logic `ecommerce:cross-sell` and Items to Item recommendation type. The source item is the currently viewed product. Requires purchase history for the collaborative signal.

```
scenario: "pdp-bought-together"
logic: "ecommerce:cross-sell"
# Type: Items to Item (source = currently viewed product ID)
# Requires: historical purchase interaction data
cascadeCreate: true
# Placement: product detail page, "Frequently bought together" section
```

**Alternative Products.** On the product detail page, show substitute products that compete for the same purchase intent. This uses an item-to-item similarity scenario with the currently viewed product as the source. Useful when a product is out of stock, overpriced, or the user is comparison shopping.

```
# Item-to-item similarity on PDP
# Source: currently viewed product ID
cascadeCreate: true
# Placement: product detail page, "You might also like" section
```

**Category Page Personalization.** When a user browses a category, personalize the item ranking within it. Use `recombee:personal` with a category filter so the user's preferred brands, price ranges, and styles appear first.

```
logic: "recombee:personal"
filter: "'category' == \"Running Shoes\""
cascadeCreate: true
```

**Bestsellers.** Show popular products within a category or across the store. Use `recombee:popular` with an optional category filter.

```
logic: "recombee:popular"
filter: "'category' == \"Headphones\""
cascadeCreate: true
```

**Diversity Constraints.** Prevent any single brand from dominating recommendation rows. Apply a diversity rule such as "at most 2 items per brand" with a sliding window across the result set. This ensures the user sees a varied selection even when one brand dominates their interaction history.

```
# Diversity setting: at most 2 items per segment (brand)
diversity: "at most 2 per 'brand'"
# Applied as a sliding window across the returned items
```

For the full recipe catalog including upsell, next basket prediction, and personalized email rotation, see the [e-commerce recommendation recipes](https://docs.recombee.com/recipes/e-commerce).

## Real-World Results

- **Slickdeals:** [+70% CTR](https://www.recombee.com/case-studies/slickdeals) to detail page views
- **Cooklist:** [+27% CTR](https://www.recombee.com/case-studies/cooklist) through personalization
- **Autohaus Kunzmann:** [+14% conversion rate](https://www.recombee.com/case-studies/autohaus-kunzmann)
- **Design Group:** [+52% purchases](https://www.recombee.com/case-studies/design-group) from recommended items

For implementation, see the [e-commerce recommendation recipes](https://docs.recombee.com/recipes/e-commerce) and the [e-commerce domain overview](https://www.recombee.com/domains/e-commerce).

**Consider this:** The most sophisticated e-commerce recommenders don't just predict what users will buy — they understand *where in the purchase journey* the user is. Someone researching (browsing many alternatives) needs different recommendations than someone ready to buy (focused, comparing two options) or someone who just purchased (needs accessories, not competitors).