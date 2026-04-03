---
id: ch5-marketplace
type: spine
title: "Recommendations in Marketplaces: When Both Sides Matter"
readingTime: 3
standalone: true
core: false
voice: universal
publishedAt: "2026-04-03"
status: accepted
---

Most recommendation systems have one job: find the best items for a user. Marketplaces have two. An Airbnb search must satisfy the guest looking for a place to stay *and* the host deciding whether to accept the booking. An Uber dispatch must match a rider who wants a fast pickup *and* a driver who wants a profitable trip. A job platform must surface candidates that employers want to interview *and* jobs that candidates actually want to apply for. When both sides of the transaction have preferences, constraints, and economic incentives, the recommendation problem changes in fundamental ways.

## The Two-Sided Problem

In a one-sided system like Netflix, the catalog is passive. A movie does not reject a viewer. The system ranks items by predicted relevance, and the user chooses. In a two-sided marketplace, the "items" are active participants with their own preferences and constraints. This creates a matching problem rather than a pure ranking problem.

The canonical examples span nearly every industry:

- **Airbnb** -- guests search for listings; hosts decide whether to accept reservations. The system must predict both guest preference and host acceptance likelihood.
- **Uber and Lyft** -- riders request trips; drivers choose whether to accept. The system dispatches in real time, balancing rider wait time against driver utilization and earnings.
- **Amazon Marketplace** -- buyers browse products; third-party sellers compete for the Buy Box and manage inventory, pricing, and fulfillment. The system must balance buyer relevance with seller fairness and marketplace health.
- **Job platforms (LinkedIn, Indeed, Hired)** -- candidates search for positions; employers review applicants. Neither side is served well if the other side rejects the match.
- **Dating apps (Tinder, Hinge, Bumble)** -- both users must express mutual interest for a match to form. Recommending highly attractive profiles that never reciprocate interest degrades the experience for everyone.
- **Freelance marketplaces (Upwork, Fiverr)** -- clients post projects; freelancers bid or are recommended. Matching must consider skill fit, budget alignment, availability, and historical success rates.

## Key Differences from One-Sided Recommendation

### Supply Constraints

In a movie catalog, every title is available to every user simultaneously. In a marketplace, supply is finite and mutable. A booked Airbnb listing cannot be recommended to another guest for the same dates. A driver currently on a trip cannot accept another ride. An item that is out of stock cannot be sold. The recommendation system must integrate real-time inventory and availability data into every scoring decision. Recommending unavailable supply is worse than useless -- it wastes user attention and erodes trust.

### Matching vs. Ranking

One-sided systems produce a ranked list and let the user choose. Two-sided systems require mutual agreement. On a job platform, it is pointless to recommend a senior engineering role to a junior candidate if the employer will immediately reject the application. The system must predict bilateral compatibility: the probability that side A wants side B *and* side B wants side A. This transforms the problem from "rank items by user preference" to "find matches that maximize joint satisfaction."

### Fairness Across Sides

In a one-sided system, fairness concerns center on the user: are recommendations biased by demographics, geography, or protected characteristics? In a marketplace, fairness has a second dimension: exposure fairness for suppliers. If the system consistently directs all traffic to the top 5% of sellers, the remaining 95% cannot sustain their businesses, and the marketplace eventually loses supply diversity. Buyers benefit from a healthy, diverse supply ecosystem. Short-term optimization for buyer relevance can destroy long-term marketplace health by driving away suppliers.

### Dynamic Availability

One-sided catalogs change slowly -- a streaming service adds a few hundred titles per month. Marketplace inventory changes continuously. A restaurant on a food delivery platform may run out of a popular dish mid-shift. A rideshare driver's location changes by the second. A concert ticket sells and is gone forever. The recommendation system must operate on real-time state, which demands infrastructure fundamentally different from the batch pipelines that work well for static catalogs.

## Approaches and Techniques

### Two-Tower Models with Bilateral Features

The two-tower architecture -- one tower encoding the demand side (user/buyer/guest), the other encoding the supply side (item/seller/host) -- adapts naturally to marketplaces. The key difference is that the supply tower incorporates features that reflect the supplier's preferences and constraints: a host's acceptance rate, preferred guest demographics, response time, and pricing flexibility. The model learns embeddings in a shared space where proximity reflects bilateral compatibility, not just one-sided relevance.

### Auction-Based Mechanisms

Many marketplaces blend organic recommendations with paid placements. Amazon's search results interleave sponsored products with organic rankings. Food delivery apps feature promoted restaurants alongside algorithmic suggestions. The recommendation system must integrate an auction mechanism -- sellers bid for visibility -- with organic relevance scoring. This creates a complex optimization: maximize revenue from the auction while maintaining recommendation quality. If ads degrade the user experience, long-term engagement suffers. If the auction is too restrictive, seller participation declines.

### Fair Allocation Algorithms

To prevent winner-take-all dynamics on the supply side, marketplaces employ fair allocation strategies. These include round-robin exposure guarantees (every new listing gets a minimum number of impressions), position rotation (cycling which sellers appear in top positions), and constrained optimization that balances relevance with exposure equity. Airbnb, for example, has published research on ensuring that new hosts receive sufficient visibility to establish a review history, without which they cannot compete with established hosts.

### Real-Time Availability Filtering

The candidate generation stage must integrate real-time availability as a hard constraint, not a soft signal. This requires low-latency inventory systems -- often in-memory stores like Redis -- that the recommendation pipeline queries before or during scoring. The architectural pattern is typically: generate candidates from an embedding index, filter by real-time availability, then score and rank the remaining candidates. Filtering after ranking is insufficient because it creates gaps in recommendation lists and wastes computational resources scoring unavailable items.

## Case Study: Airbnb Search Ranking

Airbnb's search ranking system is one of the most thoroughly documented marketplace recommendation systems, thanks to a series of published papers and engineering blog posts. Their approach illustrates the two-sided challenge concretely.

**Embedding-based retrieval.** Airbnb learns listing embeddings and user embeddings from session data -- sequences of listings that users clicked and booked. Listings that appear in the same search sessions are trained to have similar embeddings. Crucially, the training objective accounts for both click behavior (what guests look at) and booking behavior (what guests actually reserve), with bookings weighted more heavily because they represent bilateral success -- the guest wanted the listing *and* the host accepted.

**Host response prediction.** A dedicated model predicts the probability that a host will accept a booking request. Listings with hosts who are likely to reject -- due to guest profile mismatch, date conflicts, or historical patterns -- are demoted in rankings. This directly addresses the two-sided matching problem: there is no point in showing a listing that the host will decline.

**Pricing suggestions.** Airbnb's Smart Pricing tool recommends prices to hosts based on demand forecasts, comparable listings, seasonality, and local events. This is a recommendation system for the supply side -- helping hosts set competitive prices that maximize their occupancy and revenue. It benefits both sides: hosts earn more through better pricing, and guests see listings priced closer to market value rather than arbitrarily high prices that drive them away.

**Experience quality.** Reviews and ratings flow in both directions -- guests review hosts, and hosts review guests. The ranking system incorporates both signals. A guest with consistently high host ratings is more likely to be accepted, and a listing with consistently high guest ratings is ranked higher. This bilateral reputation system creates virtuous feedback loops that reward quality on both sides.

## The Economic Incentive

Marketplace revenue depends on transactions occurring -- Airbnb earns when bookings happen, Uber earns when rides complete, Amazon earns when products sell. A recommendation system that optimizes only for buyer satisfaction might direct all traffic to a small number of premium suppliers. Those suppliers become overloaded, response quality drops, and the long tail of suppliers leaves the platform. As supply shrinks, buyer choice degrades, buyers leave, and the marketplace enters a death spiral.

Conversely, optimizing only for supplier satisfaction -- distributing traffic equally regardless of quality -- degrades the buyer experience. Buyers encounter mediocre or irrelevant options, conversion rates drop, and the demand side contracts.

The sustainable equilibrium requires joint optimization: recommendations must be relevant enough to satisfy buyers while distributing exposure broadly enough to sustain a healthy supplier ecosystem. This is not merely a fairness concern -- it is an existential business requirement. The most successful marketplace recommendation systems explicitly model this tension as a multi-objective optimization problem, with buyer relevance, supplier exposure, and marketplace liquidity as competing objectives balanced through careful calibration.

## The Central Challenge

Two-sided recommendation is harder than one-sided recommendation because the feedback signal is fundamentally different. In a one-sided system, a click or a rating tells you about user preference. In a marketplace, a completed transaction tells you that both sides were satisfied -- but a failed transaction is ambiguous. Did the buyer not like the option, or did the seller reject the buyer? Did the candidate not apply, or did the employer not respond? Disentangling supply-side and demand-side signals requires careful modeling, and getting it wrong means optimizing for one side at the expense of the other.

The field is moving toward unified frameworks that model both sides jointly -- learning representations of buyers and sellers in a shared space, predicting bilateral compatibility, and optimizing for marketplace-level objectives rather than individual-side metrics. But the fundamental tension remains: every recommendation is a resource allocation decision, and in a marketplace, that resource belongs to both sides.
