---
id: ch2-data-quality
type: spine
title: "Data Quality: Garbage In, Garbage Out"
readingTime: 3
standalone: true
core: false
teaser: "The best algorithm in the world can't compensate for bad data. Here's what goes wrong and how to fix it."
voice: explorer
parent: null
diagram: null
recallQ: "What are the three most common data quality issues in recommender systems?"
recallA: "Bot traffic (fake interactions), duplicate items (fragmenting signals), and stale data (outdated items still in the catalog). Each requires specific detection and mitigation strategies."
status: accepted
---

Every recommendation system operates on the principle: **better data → better recommendations.** But the reverse is equally true: corrupted, noisy, or fraudulent data produces systematically wrong recommendations — and the damage compounds over time through feedback loops.

## Common Data Quality Issues

### Bot and Fraud Traffic

Automated bots, click farms, and fraudulent accounts generate fake interactions that pollute the collaborative filtering signal. If 10% of your "users" are bots clicking randomly, your co-occurrence matrix is corrupted with noise.

**Detection signals:**
- Inhuman interaction speed (clicking 50 items in 10 seconds)
- Uniform behavior patterns (rating everything 5 stars, clicking every item in sequence)
- Session anomalies (no dwell time variation, no scroll behavior)
- Network patterns (many accounts from same IP, device fingerprint clusters)

**Impact:** Bots inflate popularity of specific items (often paid promotion), dilute collaborative filtering signal, and waste recommendation slots on fake preference patterns.

### Duplicate Items

Large catalogs frequently contain duplicate or near-duplicate items — the same product listed by different sellers, the same article republished on multiple pages, the same song appearing on different albums.

**Problem:** User interactions split across duplicates. An item that would have 10,000 interactions as a single entry has 5 entries with 2,000 interactions each — making it look less popular and fragmenting the collaborative filtering signal.

**Detection:** Near-duplicate detection using text similarity (MinHash, SimHash), image fingerprinting (perceptual hashing), or embedding-based clustering.

### Stale Catalog Data

Items that are no longer available — sold out products, expired articles, discontinued services — remain in the catalog and receive recommendations. Users click, find nothing, and the system records an apparent engagement that's actually frustration.

**Solution:** Real-time catalog synchronization with availability checks at recommendation time, plus periodic catalog audits to remove or flag inactive items.

### Missing or Incorrect Metadata

Items with empty descriptions, wrong categories, or missing images hamper content-based filtering and cold-start handling. beeFormer can't generate useful embeddings from empty text fields.

**Systematic check:** Compute coverage metrics — what percentage of items have complete metadata? Set minimum thresholds and alert on degradation.

## The Feedback Loop Problem

Data quality issues compound through recommendation feedback loops:

1. Bot traffic inflates item A's popularity
2. The system recommends item A more frequently
3. Real users interact with item A (it's being shown everywhere)
4. The system interprets this as genuine popularity
5. Item A becomes even more dominant

Breaking this loop requires **upstream data cleaning** — catching problems before they enter the training pipeline, not after.

## A Data Quality Checklist

| Check | Frequency | Tool |
|-------|-----------|------|
| Bot detection (speed, pattern analysis) | Real-time | Rule engine + ML classifier |
| Duplicate detection | Weekly | MinHash / SimHash |
| Catalog freshness audit | Daily | Availability API checks |
| Metadata completeness | Per ingestion | Schema validation |
| Interaction distribution analysis | Daily | Gini coefficient, anomaly detection |
| Feature drift monitoring | Hourly | Statistical tests (KS, PSI) |

**Consider this:** Most teams invest 80% of their effort on model architecture and 20% on data quality. The most impactful improvement often comes from flipping that ratio. A simple model on clean data consistently outperforms a sophisticated model on noisy data.