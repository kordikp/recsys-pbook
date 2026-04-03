---
id: ch5-realtime
type: spine
title: "Real-Time Personalization: Reacting in Milliseconds"
readingTime: 3
standalone: true
core: false
teaser: "The user just clicked three items in 30 seconds. Can your system react before the fourth click?"
voice: explorer
parent: null
diagram: null
recallQ: "What are the key challenges of real-time personalization?"
recallA: "Feature freshness (using the latest interaction immediately), latency constraints (computing within the request cycle), and model consistency (ensuring the model reflects current state without full retrain)."
status: accepted
---

A user opens your platform and clicks on a machine learning tutorial. Then a data engineering article. Then a cloud architecture guide. In 30 seconds, you have three strong signals about their current intent. Can your system adjust recommendations before they scroll past the fourth item?

**Real-time personalization** means incorporating the user's most recent behavior into recommendations within the same session — ideally within milliseconds of each interaction.

## The Latency Stack

Real-time personalization requires every component to operate within tight latency budgets:

**Event ingestion (< 10ms):** Each user action must be captured and made available to the scoring pipeline immediately. Technologies: Kafka, Redis Streams, in-memory event buffers.

**Feature update (< 20ms):** The user's feature vector must reflect the new interaction. This might mean updating a running average, appending to a session history, or recomputing a user embedding.

**Model scoring (< 50ms):** The recommendation model must score candidates using the updated features. Pre-computed candidate sets help — you're re-ranking 1,000 items, not scoring millions.

**Total budget: < 100ms** from interaction to updated recommendations. Users perceive delays above 200ms; above 1 second, they assume the page is broken.

## Three Approaches

### 1. Feature-Level Real-Time

The simplest approach: update user features in real-time, but use a batch-trained model.

- User clicks item A → update "last clicked category" feature to "ML"
- Next recommendation request reads the updated feature
- The batch-trained model uses this feature for scoring

**Advantages:** Simple to implement, model doesn't change, just inputs.
**Limitations:** The model was trained on historical patterns; it may not optimally use real-time features.

### 2. Session-Aware Models

Train models that explicitly take session context as input:

- Input: user's long-term profile + current session sequence [item1, item2, item3]
- Model: attention-based (SASRec-style) or GRU-based (GRU4Rec-style)
- Output: re-ranked candidates based on session context

**Advantages:** Model learns how to interpret session signals.
**Limitations:** Requires models trained on session data; higher serving complexity.

### 3. Online Model Updates

Update the model itself in real-time:

- User clicks item A → immediately update user embedding via single ALS step
- $\mathbf{u}_i^{\text{new}} = (\mathbf{V}_i^T \mathbf{V}_i + \lambda\mathbf{I})^{-1} \mathbf{V}_i^T \mathbf{x}_i$
- This takes microseconds for a single user

**Advantages:** Strongest adaptation; model directly reflects current behavior.
**Limitations:** Only works for models with closed-form user updates (ALS, ELSA). Deep models can't be updated this efficiently.

## Real-Time Signals Worth Tracking

Not all signals are equally useful in real-time:

| Signal | Latency Value | Why |
|--------|--------------|-----|
| Click sequence | Very High | Reveals current intent within seconds |
| Dwell time | High | Distinguishes engagement from bounce |
| Search queries | Very High | Explicit statement of intent |
| Scroll depth | Medium | Indicates interest level |
| Add to cart/save | Very High | Strong purchase/interest signal |
| Time since last visit | Medium | Context for session freshness |

## The Consistency Challenge

Real-time systems face a consistency problem: the recommendation model was trained on batch data, but is being fed real-time features. This can cause **train-serve skew** — the model's predictions are unreliable because it's seeing feature distributions it wasn't trained on.

**Mitigation:**
- Log real-time features during serving and use them during training (close the loop)
- Use the same feature computation code for training and serving
- Monitor feature distribution drift between training and serving

## Architecture Pattern

```
User Action
    ↓
Event Stream (Kafka/Redis) → Feature Store (update)
    ↓                              ↓
Session Buffer              User Features (fresh)
    ↓                              ↓
         Scoring Service
              ↓
     Re-ranked Candidates
              ↓
         Response (< 100ms)
```

For a production perspective on these techniques, see this discussion of [real-time personalization of content with AI-powered recommendations](https://www.recombee.com/blog/real-time-personalization-of-content-with-ai-powered-recommendations) and the [platform features](https://www.recombee.com/features) that make sub-200ms serving possible at scale.

**Consider this:** Real-time personalization is the difference between a system that knows who you are and a system that knows who you are *right now*. The technical challenge is significant, but the user experience difference is dramatic — recommendations that adapt to your current mood and intent feel qualitatively different from static profile-based suggestions.