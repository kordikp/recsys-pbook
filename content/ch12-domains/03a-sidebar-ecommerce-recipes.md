---
id: ch12-ecommerce-recipes
type: spine
title: "E-Commerce Recipes: Complete Scenario Reference"
readingTime: 5
standalone: false
core: false
teaser: "Every e-commerce recommendation scenario — from homepage personalization to faceted search — with exact configurations."
voice: explorer
parent: ch13-ecommerce
diagram: null
recallQ: "What are the key e-commerce recommendation logics?"
recallA: "ecommerce:homepage (for-you), ecommerce:bestseller (popular), ecommerce:cross-sell (cart + bought-together), ecommerce:similar-products (PDP alternatives), search:personalized (search), recombee:personal (category pages)."
publishedAt: "2026-04-04"
status: accepted
---

A complete reference for implementing e-commerce recommendation scenarios with exact logic names, parameters, and ReQL examples from [production systems](https://docs.recombee.com/recipes/e-commerce).

## Homepage Scenarios

| Scenario | ID | Logic | Type | Key Parameters |
|----------|-----|-------|------|----------------|
| For You | `just-for-you` | `ecommerce:homepage` | Items→User | New arrivals filter (days), category filter |
| Bestsellers | `bestsellers` | `ecommerce:bestseller` | Items→User | Global popularity-based |
| Recently Viewed | `recently-viewed` | `recombee:recently-viewed` | Items→User | `maxAge` (604800 = 7 days), `recencyOrdering` |
| Brands For You | `brands-for-you` | `recombee:default` | Segments→User | Property-based brand segmentation |
| Personalized Sections | `homepage-sections-and-products` | `ecommerce:products-from-top-category-for-you` | Composite | Category segmentation + `distinctRecomms` |

**For You** — The primary homepage personalization. Supports boosters for promotional items:

```
if 'on_sale' then 2 else 1
```

With adjustable coefficient: `if 'on_sale' then $coefficient$ else 1`

**Personalized Sections** — Composite recommendations that return both a category (source) and products within it (results). The system selects categories based on user affinity and fills each with personalized product rankings. Use `distinctRecomms: true` in batch requests to deduplicate products across sections.

## Product Detail Scenarios

| Scenario | ID | Logic | Type | Key Parameters |
|----------|-----|-------|------|----------------|
| Alternative Products | `pdp-similar-products` | `ecommerce:similar-products` | Items→Item | Upsell booster (price property + coefficient) |
| Bought Together | `pdp-bought-together` | `ecommerce:cross-sell` | Items→Item | Requires historical purchase data |

**Alternative Products** — Shows similar items on the product detail page. The optional upsell booster biases toward higher-priced items — configure the boost coefficient via Preview to find the right balance.

**Bought Together** — Co-purchase recommendations ("Frequently bought together"). Uses Items→Item type — the input is the currently viewed product. Requires historical purchase data for accuracy.

## Cart & Category

| Scenario | ID | Logic | Type | Key Parameters |
|----------|-----|-------|------|----------------|
| Cart Cross-Sell | `cart` | `ecommerce:cross-sell` | Items→User | Requires purchase history |
| Category Page | `category-listing` | `recombee:personal` | Items→User | Dynamic category filter |

**Category Page** — Personalizes product ordering within a category. Filter dynamically:

```
'category' == "shoes"
```

For multi-category products: `"shoes" in 'categories'`

## Search

| Scenario | ID | Logic | Type | Key Parameters |
|----------|-----|-------|------|----------------|
| Quick Search | `search-products` | `search:personalized` | Search | `personalizationImpact` |
| Faceted Search | `faceted-product-search` | `search:personalized` | Search | ReQL facet filters |

**Faceted Search** — Combine user-selected facets into a ReQL filter:

```
'category' == "shoes" and 'manufacturer' == "Nike" and 'color' == "red" 
and "42" in 'available_sizes' and 100 <= 'price' <= 140
```

The `personalizationImpact` parameter controls how much results are biased toward user preferences versus strict text matching.

## Availability Filters

Apply globally to all scenarios — choose one:
- `'available' == true` (boolean property)
- `'deleted' != true` (soft-delete pattern)
- `'available' == "in stock"` (Google Merchant format)

For complete implementation details, see the [e-commerce recipe documentation](https://docs.recombee.com/recipes/e-commerce).