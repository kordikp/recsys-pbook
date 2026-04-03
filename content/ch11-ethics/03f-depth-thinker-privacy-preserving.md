---
id: ch6-privacy-preserving
type: spine
title: "Privacy-Preserving Recommendation: Technical Approaches"
readingTime: 4
standalone: false
core: false
teaser: "Can you build personalized recommendations without centralizing user data? These techniques try."
voice: thinker
parent: ch6-privacy-real
diagram: null
recallQ: "What is differential privacy and how does it apply to recommender systems?"
recallA: "Differential privacy adds calibrated noise to data or model outputs so that no individual's data can be identified. The privacy parameter ε controls the noise-privacy tradeoff. In RecSys, it protects user interaction histories but degrades recommendation quality."
publishedAt: "2026-04-03"
status: accepted
---

The fundamental tension in recommender systems: **better personalization requires more data, but more data means more privacy risk.** Every interaction you have with a platform reveals something about you — your interests, your schedule, your social connections, your vulnerabilities.

Traditional recommender systems solve this by centralizing all user data on servers. This works well for recommendation quality but creates enormous privacy risks: data breaches, government surveillance, corporate profiling, and the simple discomfort of a corporation knowing what you read at 2 AM.

Several technical approaches attempt to thread this needle.

![Privacy vs personalization balance](/images/anim-privacy-spectrum.svg)

## Federated Learning

**Concept:** Train the model locally on each user's device. Only share model updates (gradients), never raw data. A central server aggregates updates from millions of devices to improve the global model.

**How it works for RecSys:**
1. Each device has the user's local interaction history
2. The device downloads the current global model
3. It trains on local data, producing gradient updates
4. Gradients are sent to the server (optionally with noise added)
5. The server averages gradients across users and updates the global model

**Advantages:** Raw data never leaves the device. The server sees only aggregated gradients.

**Challenges:**
- Communication overhead (millions of devices × model size)
- Non-IID data distribution (each user has very different behavior)
- System heterogeneity (phones have varying compute/storage)
- Gradient aggregation can still leak information (gradient attacks)

Google's Gboard keyboard uses federated learning for next-word prediction — a form of recommendation. Apple uses on-device ML for photo suggestions and app recommendations.

## Differential Privacy (DP)

**Concept:** Add carefully calibrated noise to data or computations so that the output is approximately the same whether or not any individual's data was included.

**Formal definition:** A mechanism M is ε-differentially private if for any two datasets D and D' differing in one record, and any output S:

$$P(M(D) \in S) \leq e^\varepsilon \cdot P(M(D') \in S)$$

The privacy parameter ε controls the tradeoff:
- ε = 0: perfect privacy (pure noise, useless recommendations)
- ε = ∞: no privacy (raw data exposed)
- Practical range: ε ∈ [1, 10]

**RecSys applications:**
- **DP-SGD:** Add Gaussian noise to gradients during training. Protects training data but increases model noise.
- **Local DP:** Each user perturbs their own data before sending. Strongest privacy guarantee but highest noise.
- **Central DP:** The server holds raw data but adds noise to outputs. Weaker guarantee but better utility.

**The cost:** Differential privacy always degrades recommendation quality. The question is whether the degradation is acceptable. For binary interactions (click/no-click), DP noise has larger relative impact than for continuous signals.

## Secure Multi-Party Computation (MPC)

**Concept:** Multiple parties jointly compute a function without revealing their individual inputs. The computation happens on encrypted data.

**RecSys application:** Two platforms want to jointly train a cross-domain recommender without sharing their user data. MPC protocols enable this by splitting the computation so that neither party sees the other's data.

**Practical limitations:** MPC is computationally expensive — orders of magnitude slower than plaintext computation. Useful for aggregated computations (average ratings, co-occurrence counts) but impractical for full model training at scale.

## On-Device Inference

**Concept:** Run the recommendation model entirely on the user's device. No data leaves the phone.

**Apple's approach:** Core ML models for on-device app suggestions, photo memories, and Siri recommendations. The model sees all local data; Apple's servers see nothing.

**Limitations:**
- Limited compute on mobile devices constrains model complexity
- No collaborative filtering (the device only sees one user's data)
- Model updates require downloading the new model to all devices
- Loses the power of cross-user patterns

**Hybrid approach:** Run a global collaborative model on the server (using aggregated, privacy-protected data) and a local model on the device (using detailed personal data). Combine their recommendations on-device.

## Homomorphic Encryption (HE)

**Concept:** Perform computations on encrypted data without decrypting it. The server processes encrypted user embeddings and returns encrypted recommendations.

**Current state:** Fully homomorphic encryption is still too slow for real-time recommendation (10,000× overhead). Partially homomorphic schemes (supporting only addition OR multiplication) are faster but limit the computations possible.

**Future potential:** As HE accelerates (specialized hardware, improved algorithms), it could enable a model where the server runs the full recommendation pipeline without ever seeing plaintext user data.

## What Works in Practice Today

| Approach | Privacy Level | Performance Impact | Deployment Difficulty |
|----------|-------------|-------------------|----------------------|
| Federated Learning | High | Moderate (5-15%) | Very High |
| Central DP (ε=5) | Moderate | Low (2-5%) | Moderate |
| Local DP (ε=1) | Very High | High (15-30%) | Moderate |
| On-Device | Highest | High (no CF) | High |
| MPC | High | Moderate | Very High |
| Homomorphic | Highest | Impractical | Experimental |

**The honest assessment:** No current technique provides strong privacy guarantees without meaningful quality loss. The field is actively researching better trade-offs, but today, privacy-preserving recommendation requires accepting some degradation in personalization quality.

**Consider this:** The regulatory landscape (GDPR, CCPA, AI Act) is pushing the industry toward privacy-preserving approaches regardless of the quality cost. The organizations that invest in these techniques now will have a competitive advantage when privacy requirements tighten — and they will tighten.