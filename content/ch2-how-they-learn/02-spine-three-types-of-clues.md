---
id: ch2-clues
type: spine
title: "Three Types of Clues"
readingTime: 2
standalone: true
core: true
teaser: "Item features, user profiles, and behavioral signals -- the three pillars of every recommendation."
voice: universal
parent: null
diagram: diagram-data-sources
recallQ: "Name the 3 types of data recommenders use."
recallA: "Item metadata (what it IS), user attributes (who YOU are), interaction data (what you DO)."
highlights:
  - "Three signal types: item attributes, user demographics, and behavioral interactions"
  - "Behavioral signals reveal preferences more reliably than stated preferences"
  - "Missing any one signal type significantly degrades recommendation quality"
status: accepted
---

A recommender system draws on three fundamental types of data to determine what to present to you. Think of them as three pillars -- you need all three for robust recommendations, and each compensates for the others' blind spots.

## Data Type 1: Item Metadata (What's Available)

Before any recommendation can happen, the system needs a comprehensive understanding of its inventory. An e-commerce platform must know every product's attributes; a content platform must understand every piece of content in its catalog.

Recommender systems maintain rich metadata about every item:
- A YouTube video has a title, description, category, duration, upload date, creator history, and auto-generated tags
- A Spotify track has an artist, genre, tempo, energy level, key, danceability, and acoustic fingerprint
- An Amazon product has a category taxonomy, price point, brand, customer segments, and related items

This metadata forms the system's knowledge base -- a structured representation of every item that enables content-based filtering and feature engineering.

## Data Type 2: User Attributes (Who You Are)

The system also maintains a profile with basic attributes about YOU. Not necessarily personal details, but contextual information such as:
- Your language, locale, and timezone
- Your age bracket or demographic segment (based on account information or inferred)
- Your tenure on the platform and engagement history
- Your device type, operating system, and connection context

These attributes matter because a software engineer in Berlin likely has different content preferences than a marketing director in Sao Paulo -- even if both are browsing the same platform. Under GDPR and similar regulations, the collection and use of these attributes is subject to strict consent and transparency requirements.

## Data Type 3: Interaction Data (What You DO)

This is the most powerful data source by far. Your actions. Your digital footprints. Everything covered in the previous section -- clicks, consumption patterns, skips, searches, saves, purchases, and shares.

Why is this the most important? Because behavior reveals actual preferences far more reliably than stated preferences. You might list "industry analysis" as an interest in your profile, but if you actually spend three hours a day consuming product design content... the system trusts your behavior, not your self-reported preferences. This is a well-established finding in behavioral psychology known as the attitude-behavior gap.

**Consider this:** Which data type do you think is most valuable for generating high-quality recommendations? What would happen if a system had access to only one of the three? (Hint: this is not a hypothetical -- early recommender systems often operated with just one, and their limitations directly motivated the multi-signal architectures used today.)
