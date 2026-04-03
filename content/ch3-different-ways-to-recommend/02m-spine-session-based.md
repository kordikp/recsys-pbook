---
id: ch3-session-based
type: spine
title: "Session-Based Recommendation: When You Don't Know the User"
readingTime: 3
standalone: true
core: true
teaser: "Most visitors never log in. Session-based systems must recommend using only the handful of clicks from the current visit -- no history, no profile, just a fleeting trail of intent."
voice: universal
parent: null
diagram: null
recallQ: "Why do simple baselines like item-KNN often outperform deep learning models in session-based recommendation?"
recallA: "Sessions are typically very short (3-10 items), providing minimal sequential signal for complex models to exploit. Simple co-occurrence patterns -- 'users who clicked X in this session also clicked Y' -- capture most of the useful information. Deep models need longer sequences to learn meaningful temporal dependencies that justify their added complexity."
highlights:
  - "60-80% of e-commerce visits are anonymous -- session-based is the norm"
  - "Simple item-KNN often matches or beats deep models on short sessions"
  - "Dwell time and scroll depth reveal intent that click sequences alone miss"
publishedAt: "2026-04-03"
status: accepted
---

A customer lands on your e-commerce site. They haven't logged in. They have no account. You have never seen them before. They click on a winter jacket, then a pair of hiking boots, then a fleece pullover. Within these three clicks, you must figure out what to show them next.

This is the **session-based recommendation** problem, and it is not a niche edge case. It is the dominant scenario for most consumer-facing platforms.

## The Scale of Anonymity

Industry estimates consistently place anonymous traffic at **60-80% of all e-commerce visits**. Users browse without logging in, use incognito mode, switch devices, clear cookies, or visit for the first time. Even platforms with large registered user bases -- Amazon, eBay, Zalando -- see the majority of their page views from sessions with no authenticated identity.

Traditional collaborative filtering assumes you know who the user is and can look up their interaction history. Strip that away, and you are left with a single session: a short, ordered sequence of item interactions from an unknown visitor. Everything you can learn about this person must come from those few clicks.

## GRU4Rec: Deep Learning Enters the Session

The foundational work in deep session-based recommendation is **GRU4Rec** (Hidasi et al., 2016), which applied recurrent neural networks to the problem. The architecture is straightforward:

1. Each item in the session is represented as an embedding vector
2. A **Gated Recurrent Unit** (GRU) processes the sequence of embeddings one by one, maintaining a hidden state that summarizes "what has happened so far in this session"
3. The hidden state after the last click is used to predict the next item

The GRU learns to compress the session history into a single vector that captures the user's evolving intent. If the first two clicks were outdoor gear and the third was a running shoe, the hidden state shifts toward athletic products. The model was trained on session-parallel mini-batches -- a practical innovation that allowed efficient GPU utilization by processing multiple sessions simultaneously, aligning them by time step rather than session boundary.

GRU4Rec demonstrated that sequential models could outperform item-KNN baselines on several benchmarks, sparking a wave of neural session-based methods.

## Attention and Graphs: NARM and SR-GNN

Subsequent work argued that compressing an entire session into a single RNN hidden state loses information. Different items in the session may be relevant to different aspects of the user's intent.

**NARM** (Neural Attentive Recommendation Machine, Li et al., 2017) addressed this by adding an **attention mechanism** over the RNN hidden states. Instead of using only the final hidden state, NARM computes a weighted combination of all hidden states, letting the model "look back" at earlier clicks when making predictions. If the user clicked a jacket, then three unrelated items, then a scarf, the attention mechanism can amplify the jacket signal when predicting the next click -- recognizing a latent "winter outerwear" intent that the recency-biased RNN might have forgotten.

**SR-GNN** (Session-based Recommendation with Graph Neural Networks, Wu et al., 2019) took a different structural approach. Instead of treating the session as a flat sequence, SR-GNN constructs a **directed graph** from the session's click transitions. Each item is a node; an edge from item A to item B means the user clicked B immediately after A. A gated graph neural network then propagates information across this graph, and an attention-based readout produces the session representation.

The graph structure captures transition patterns that a linear sequence cannot: if a user clicks A -> B -> C -> A -> D, the graph encodes that item A was a "hub" in this session, visited twice, with outgoing transitions to B and D. This structural signal helps when sessions contain loops, revisits, or non-linear browsing patterns.

## The Uncomfortable Truth: Simple Baselines Are Hard to Beat

Here is the part that many papers understate. In 2019, Ludewig and Jannach published a systematic evaluation showing that simple, well-tuned baselines often match or exceed the performance of GRU4Rec, NARM, and other neural models on standard benchmarks. The most effective simple methods:

- **Session-based item-KNN**: For each item the user has clicked in the current session, find items that frequently co-occur in other sessions. Rank candidates by their aggregate co-occurrence scores. No neural network, no training -- just counting.
- **Most recent item similarity**: Take only the last clicked item, find its nearest neighbors by co-occurrence. Ignore the rest of the session.
- **Association rules**: Simple "if item A was clicked, item B is likely next" rules derived from transition frequencies.

Why do these work so well? The answer lies in the data. Sessions are **short** -- typically 3 to 10 interactions. With so few data points, there is minimal sequential structure for a deep model to exploit. The last one or two clicks dominate the prediction, and co-occurrence statistics capture the relevant signal efficiently. A GRU processing a 4-item sequence has barely enough steps to warm up its hidden state.

This finding has been replicated repeatedly. The RecBole benchmarking framework and subsequent studies confirmed that the gap between neural and non-neural methods is often smaller than the gap between a well-tuned and a poorly-tuned baseline of any kind.

## Session Context: Beyond the Click Sequence

Clicks are not the only signal available within a session. Sophisticated systems extract additional contextual features:

- **Dwell time**: How long did the user spend on each page? A 30-second glance at a product page signals casual interest; three minutes of scrolling through reviews signals serious consideration.
- **Time between clicks**: Rapid-fire clicking (every 2-3 seconds) suggests browsing or scanning. Long gaps (30+ seconds) suggest deep engagement with the current page.
- **Page type**: Did the user visit a category page, a search results page, or a product detail page? The navigation path reveals intent structure.
- **Scroll depth**: On a product page, did they scroll to the reviews section? To the specifications? This granular engagement signal is increasingly captured by modern analytics.
- **Add-to-cart and wishlist actions**: Explicit positive signals that carry far more weight than mere page views.

These features transform the session from a sequence of item IDs into a rich behavioral trace. Models that incorporate them -- treating the session as a sequence of (item, dwell_time, page_type, action) tuples rather than just item IDs -- can distinguish a user seriously researching hiking boots from one idly scrolling through trending products.

## Connection to Sequential Recommendation

Session-based recommendation is a **special case** of sequential recommendation. The broader sequential paradigm -- exemplified by models like **SASRec** (Self-Attentive Sequential Recommendation, Kang & McAuley, 2018) -- models the full ordered history of a known user's interactions over time, using self-attention (Transformer architecture) to weigh which past interactions are most relevant for predicting the next one.

The key distinction:

- **Sequential recommendation**: Long history (tens to hundreds of interactions), known user identity, can model long-term preference evolution
- **Session-based recommendation**: Short history (3-10 interactions), unknown user, must capture immediate intent from minimal signal

In practice, when a user is logged in, the system can leverage their full history -- making it a sequential recommendation problem. When the user is anonymous, the system falls back to session-based methods operating only on the current visit. Many production systems run both: a sequential model for authenticated users and a session-based model for anonymous ones, switching seamlessly at the serving layer.

## Linear Models and Short Sequences

Recent work on **ReaLM** (Recurrent Linear Models) and related linear recurrent architectures has highlighted an important insight: for very short sequences, the modeling capacity of the architecture matters less than you might think. Linear recurrence models -- which replace the nonlinear gating mechanisms of GRUs and LSTMs with simple linear state updates -- can match the performance of more complex models on short sessions.

The intuition is that nonlinear dynamics need sequence length to differentiate themselves from linear approximations. Over 3-5 steps, the difference between a linear transformation of the hidden state and a gated nonlinear one is minimal. This suggests that for session-based recommendation specifically, engineering effort is often better spent on feature engineering (incorporating dwell time, page type, and other context signals) than on architectural sophistication.

## When to Use Session-Based Methods

Session-based recommendation is the right approach when:

- **E-commerce**: The canonical use case. Most visitors are anonymous, sessions are short, and the business impact of recommending the right product during a single visit is enormous. A well-placed "you might also like" suggestion during an anonymous session can mean the difference between a bounce and a conversion.
- **News and media**: Readers often arrive via social media links or search engines with no prior relationship to the publisher. The session -- which articles they read, in what order -- is the only signal available.
- **Anonymous browsing**: Any platform where users interact without authentication -- job boards, real estate listings, travel search engines.

## Session-Based vs. User-Level Collaborative Filtering

The trade-off between these approaches reveals a fundamental tension in recommendation:

| Dimension | User-Level CF | Session-Based |
|-----------|--------------|---------------|
| **Personalization depth** | Deep -- leverages months or years of history | Shallow -- only current session |
| **Responsiveness to current intent** | Slow -- dominated by long-term preferences | Immediate -- reflects what the user is doing right now |
| **Cold start** | Severe for new users | Not applicable -- every session starts cold by design |
| **Identity requirement** | Must know who the user is | Works for anyone |
| **Model complexity** | Can justify complex models (long histories) | Simple models often suffice (short sequences) |

The ideal system combines both. For a logged-in user returning to a site, the system blends their long-term preference profile (collaborative filtering) with their current session behavior (session-based signals). The long-term model knows they generally prefer literary fiction; the session model notices they are currently browsing cookbooks. The blended recommendation surfaces cookbooks by authors whose writing style matches the user's literary taste -- a synthesis neither approach could achieve alone.

For anonymous visitors, session-based methods are all you have. And given that these visitors represent the majority of traffic on most platforms, getting session-based recommendation right is not optional -- it is where most of the unrealized recommendation value lies.
