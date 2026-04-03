---
id: ch5-cold-start
type: spine
title: "Cold Start Solutions: A Systematic Comparison"
readingTime: 3
standalone: true
core: false
voice: universal
publishedAt: "2026-04-03"
status: accepted
---

The cold-start problem splits into two distinct challenges, each with its own set of solutions. A new user arrives with no interaction history -- the system knows nothing about their preferences. A new item enters the catalog with zero interactions -- collaborative filtering has no signal to work with. The solutions for each case overlap in philosophy but differ substantially in mechanism.

## New User Cold Start

When a user first arrives, the system must make reasonable recommendations with zero behavioral data. Five approaches have emerged in practice, each trading off different costs and benefits.

### Popularity-Based Recommendation

The simplest baseline: show every new user the same list of globally popular items. This works because popular items are popular for a reason -- they tend to have broad appeal. Netflix's trending list, Spotify's top charts, and Amazon's bestsellers all serve this function.

The advantage is immediate deployment with no additional data or infrastructure. The disadvantage is equally immediate: every new user sees the same recommendations regardless of who they are. There is no personalization, and the approach reinforces the popularity feedback loop -- already-popular items accumulate even more interactions while niche content remains invisible.

### Demographic-Based Filtering

Use whatever is known at registration time -- age, location, language, device type, signup source -- to segment users and apply group-level preferences. A 25-year-old signing up from Tokyo on a mobile device likely has different tastes than a 55-year-old signing up from rural France on a desktop.

This approach delivers mild personalization from the first interaction. However, it requires collecting demographic data (which raises privacy concerns and adds registration friction), and it relies on the assumption that demographics predict preferences -- an assumption that is often weak and sometimes harmful. The segments must be large enough to have statistical significance, which limits their granularity.

### Onboarding Survey

Ask the user to express preferences directly: "Pick 3 genres you enjoy," "Rate these 10 items," "Choose artists you like." Spotify's onboarding flow, which asks new users to select a handful of artists, is the canonical example.

This produces the highest-quality initial signal because it captures explicit preference data. The cost is friction: every additional screen in the onboarding flow increases the probability that the user abandons registration entirely. The survey items must be carefully curated -- they should cover diverse taste clusters and include items that most users have an opinion about. A poorly designed survey (obscure items, too many questions, ambiguous categories) can produce worse results than no survey at all.

### Bandit Exploration

Deploy a multi-armed bandit algorithm -- typically Thompson Sampling or Upper Confidence Bound (UCB) -- that treats each recommendation slot as an experiment. The bandit maintains uncertainty estimates over user preferences and selects items that balance exploitation (recommending what seems best given current evidence) with exploration (recommending items that would reduce uncertainty most quickly).

Thompson Sampling is particularly effective because it naturally reduces exploration as confidence grows. In the first few interactions, recommendations are diverse and exploratory. After 10--20 interactions, the bandit has typically narrowed in on the user's core preferences. The system learns fastest when it shows items that are maximally informative -- items where the user's reaction (positive or negative) tells the system the most about their taste profile.

The complexity cost is meaningful: bandit algorithms require real-time inference, online model updates, and careful tuning of exploration parameters. But for systems with high user volume, the faster warm-up time directly translates to improved retention of new users.

### Transfer Learning

If the user has an account on a related platform, or if the system operates across multiple products, behavioral data from the source domain can bootstrap preferences in the target domain. A user's music listening history on one service can inform podcast recommendations on another. A user's purchase history in electronics can provide priors for book recommendations.

This produces strong initial personalization when cross-domain data is available. The requirements are substantial: the user must be identifiable across platforms (shared login, device fingerprinting, or explicit account linking), and the source domain must have predictive value for the target domain -- which is not always the case. Privacy regulations (GDPR, CCPA) impose additional constraints on cross-platform data sharing.

## New Item Cold Start

When a new item enters the catalog -- a newly published book, a freshly uploaded video, a just-listed product -- collaborative filtering has no interaction data to work with. The item's column in the interaction matrix is entirely empty.

### Content-Based Features

Use the item's intrinsic attributes -- genre, description, price, creator, technical specifications, visual features -- to compute similarity with existing items that already have interaction data. If the new item's features closely match items that a user has enjoyed, recommend it.

This is the most straightforward approach and works well when item features are rich and descriptive. The limitation is that content features capture what an item *is*, not how users *experience* it. Two books with identical genre tags, similar word counts, and overlapping themes can produce vastly different reader responses. Content-based similarity is a useful approximation, but it systematically misses the behavioral nuances that collaborative filtering captures.

### beeFormer: Text-to-Embedding Alignment

beeFormer (covered in depth in [Chapter 7](/chapters/ch7-research-and-progress#ch7-cold-start-language)) addresses the content-based approach's core limitation by training a Transformer to produce embeddings aligned with collaborative filtering space. Instead of learning what an item is about semantically, it learns what kind of user would interact with it -- using ELSA's recommendation loss as the training objective.

The result is that a new item's text description can be mapped directly into the same embedding space used for behavioral recommendations. Zero-shot transfer experiments show dramatic improvements: +131% Recall@20 on cross-domain benchmarks compared to standard text embeddings. This is the current state of the art for bridging the gap between content features and behavioral signal.

### Expert Curation

Human editors manually place new items in prominent positions, featured collections, or editorial picks. This is common in news, publishing, and entertainment platforms where editorial teams already exist.

Curation produces high-quality placements for a small number of items but does not scale. A human editor can review dozens of new items per day; a platform receiving thousands of new items per hour needs automated solutions. Curation works best as a complement to algorithmic approaches -- surfacing editorially important items that algorithms might miss.

### Exploration Slots

Reserve a fixed percentage of recommendation positions (typically 5--15%) for items with insufficient interaction data. Every recommendation list includes a few new or underexposed items alongside the standard personalized results.

This guarantees that new items receive exposure and begin accumulating the interaction data needed for collaborative filtering to take over. The trade-off is a small reduction in average recommendation quality -- the exploration slots will, by definition, contain less-proven items. The percentage must be calibrated: too low and new items take weeks to warm up; too high and users notice a degradation in recommendation quality.

### Warm-Start via Metadata Similarity

Use the new item's metadata to find its nearest neighbors among established items, then inherit a blended version of those neighbors' collaborative filtering representations. If a new jazz album has similar artist, instrumentation, and era tags to three well-established albums, initialize its embedding as the weighted average of those neighbors' embeddings.

This provides a reasonable starting point that is immediately usable by collaborative filtering models. The quality depends entirely on the metadata's predictive power and the similarity metric used. As real interactions accumulate, the inherited embedding is gradually replaced by the item's own learned representation.

## Comparison

| Solution | Speed to Warm Up | Data Needed | Initial Quality | Implementation Complexity |
|---|---|---|---|---|
| **New User: Popularity** | Instant (no warm-up) | None | Low (no personalization) | Minimal |
| **New User: Demographic** | Instant | Registration data | Low--Medium | Low |
| **New User: Onboarding Survey** | Instant | User responses | Medium--High | Medium (survey design) |
| **New User: Bandit Exploration** | 10--20 interactions | Real-time feedback | Medium, improving rapidly | High (online learning) |
| **New User: Transfer Learning** | Instant | Cross-platform identity | High (if data exists) | High (data pipelines, privacy) |
| **New Item: Content Features** | Instant | Item metadata | Low--Medium | Low |
| **New Item: beeFormer** | Instant | Item text/images | High | Medium (model training) |
| **New Item: Expert Curation** | Instant | Editorial judgment | High (small scale) | Low (but does not scale) |
| **New Item: Exploration Slots** | Days to weeks | Accumulating interactions | Low initially | Low--Medium |
| **New Item: Warm-Start Metadata** | Instant | Item metadata + neighbor embeddings | Medium | Medium |

## Practical Recommendation: Combine, Don't Choose

No single cold-start solution is sufficient on its own. Production systems that handle cold start well invariably use a layered approach.

For new users, a practical stack looks like this: start with popularity-based recommendations as the universal fallback. If demographic data is available, use it to refine the popular items toward the user's likely segment. If the platform can afford the friction, add a lightweight onboarding survey (3--5 selections, not 20). Wrap everything in a bandit framework that accelerates learning from the user's first real interactions.

For new items, the layered approach is similar: generate an initial embedding from content features or beeFormer. Place the item in exploration slots to begin accumulating real interaction data. Use warm-start metadata similarity to give collaborative filtering a reasonable initial estimate. If editorial resources are available, use curation to boost high-priority new items.

The key insight is that these solutions are not competing alternatives -- they are complementary layers that address different facets of the same problem. Popularity handles the moment of zero information. Content features and demographics provide coarse personalization. Bandits and exploration slots accelerate the transition from coarse to fine-grained. And collaborative filtering takes over once sufficient interaction data has accumulated. The cold-start problem is never "solved" in a permanent sense -- it is managed through a graceful transition from low-information to high-information recommendation strategies.
