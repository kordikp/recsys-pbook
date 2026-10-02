---
id: generative-recommendation-mechanism
type: spine
title: "Inside Generative Retrieval: Codebooks, Beams and the Bill"
readingTime: 8
standalone: true
core: false
teaser: "How residual quantization builds semantic IDs, how beam search turns a sequence model into a retriever, and what the production reports say it costs."
parent: generative-recommendation
diagram: diagram-residual-quantization
recallQ: "How are semantic IDs built, and how does beam search turn a sequence model into a retriever?"
recallA: "An item's content embedding is quantized level by level. At each level the quantizer picks the codebook vector nearest to what the earlier levels left unexplained (the residual), which gives a coarse-to-fine tuple of tokens where similar items share prefixes; items that collide get an extra token. A sequence model trained on users' time-ordered histories, flattened into these tokens, generates the next item's tokens. Beam search keeps the B most probable partial codes at each step, and the B finished codes go through a lookup table to become items. Invalid codes are filtered out and the rest go on to ranking."
status: draft
concept: generative-recommendation
state: edited
lens: generic
lang: en
visuality: balanced
depth: technical
formalism: light
lengthBand: deep
genre: explainer
carriers: prose|table|diagram|formula
---

A semantic-ID recommender is two models joined by a lookup table: a **tokenizer** that gives every item a code, and a **generator** that writes codes. We use the TIGER configuration (Rajput et al., NeurIPS 2023) as the reference point, then compare it with what production systems changed.

## 1. Tokenizer: residual quantization

Start from a content embedding. For each Amazon product, TIGER builds a sentence from the title, price, brand and category and encodes it with a pre-trained Sentence-T5 model into a 768-dimensional vector. An **RQ-VAE** (residual-quantized variational autoencoder) compresses this vector to a 32-dimensional latent and quantizes it in *m* levels. Each level has its own codebook of *K* learned vectors.

At level *d* the quantizer picks the codebook vector nearest to the current residual, $c_d = \arg\min_k \lVert r_d - e^{(d)}_k \rVert$. It then hands what that vector failed to explain to the next level, $r_{d+1} = r_d - e^{(d)}_{c_d}$. The first residual is the latent itself. Each level describes what the earlier levels missed, so the first token marks a coarse region and later tokens refine it. TIGER uses m = 3 levels with K = 256. It initializes the codebooks with k-means on the first training batch, so that most items don't collapse onto a few vectors, and it trains the encoder, decoder and codebooks jointly on a reconstruction loss plus a quantization loss.

The hierarchy is learned, not designed. In a qualitative study on the Beauty data, one value of the first token held most hair products, and the second token split categories further. The category name was part of the input text, but nobody told the quantizer to organize by it, and the tokens carry no names. The authors also tried a flat VQ-VAE: it retrieved about as well but lost the hierarchy.

**Collisions.** Three tokens of 256 values address 256³ ≈ 16.8 million codes, but near-identical items can still share one. TIGER appends a fourth token to make every code unique, so two items at (7, 1, 4) become (7, 1, 4, 0) and (7, 1, 4, 1). Spotify's GLIDE settles collisions at serving time instead, by picking the most popular eligible episode behind a shared code.

A small piece of trivia: for RQ-VAE, TIGER cites SoundStream, a neural audio codec. A technique built to compress audio now files products.

**What production changed.** Some systems replace the learned autoencoder with **residual k-means**. On GLIDE's podcast data it beat RQ-VAE by 9.5% relative Hit-Rate@30, and OneRec uses RQ-Kmeans as well. Others also bring in behaviour. OneRec aligns multimodal item representations with collaborative similarity before it quantizes. YouTube's PLUM adds co-occurrence as a contrastive training signal for the quantizer, while the codes themselves stay derived from content.

## 2. Generator: next-token prediction over codes

Sort each user's interactions by time, replace each item with its code, and flatten the result: item 1's four tokens, then item 2's, and so on. The training target is the next item's four tokens. The item vocabulary is tiny: 4 × 256 = 1,024 tokens. TIGER adds 2,000 hashed user-ID tokens to that and trains an encoder–decoder transformer of about 13 million parameters. Production generators are much larger and often start from a language model. PLUM is warm-started from Gemini and then pre-trained further on YouTube data. GLIDE starts from a Llama 3.2 1B backbone. OneRec uses an encoder–decoder with mixture-of-experts layers.

Codes matter because **parameters are shared along prefixes**. Whatever the model learns about prefix 7-1 carries over to every item under it, including items it rarely or never saw. With random IDs, each item's [embedding](#c/embeddings) has to be learned from that item's own interactions. Singh et al. (RecSys 2024) measured this trade-off in a YouTube ranking model. When they replaced video-ID features with semantic IDs, generalization on new and long-tail videos improved without a loss in overall quality.

## 3. Decoding: beam search is the retriever

Greedy decoding commits to the single most likely token at each level, so one wrong first token sends the whole recommendation to the wrong region. **Beam search** keeps the *B* most probable partial codes after each step and expands each of them. After the last level it has *B* complete codes ordered by sequence probability, and those are the candidates. GLIDE runs 30 beams for 30 candidates per request, and OneRec reports a beam size of 128. GLIDE also measured the alternative: switching to greedy decoding cut Recall@30 by 27% relative. Sampling usually found the right neighbourhood but picked the wrong item inside it.

**Invalid codes.** The generator can write a code that no item owns. With four tokens of 256 values there are 256⁴ ≈ 4.3 billion possible codes for TIGER's 10–20 thousand items, yet the model almost always wrote valid ones: 0.1–1.6% of its top-10 codes were invalid. PLUM reports under 5% after fine-tuning. The pragmatic fix is a wider beam plus a filter. TIGER also suggests prefix matching, which reads a near-miss code as "an item from this region".

**Diversity has a dial.** In TIGER, sampling at a higher temperature on the first token moves across categories, and on deeper tokens it stays within one. PLUM found that beam search beat random decoding, "although at the cost of some diversity".

## 4. Serving, and the bill

At serving time, B generated codes go through the lookup table to become item IDs, then pass eligibility filters (stock, region, already seen), and then go to [ranking](#c/pipeline). Autoregressive decoding dominates the cost: m sequential decoder steps across B beams, for every request. TIGER's authors write that their model can cost more at inference than nearest-neighbour retrieval. GLIDE's engineers needed serving changes that raised throughput up to 8× before they could widen the beam from 14 to 30 within latency targets.

The economics can also flip. OneRec replaces Kuaishou's retrieval, pre-ranking and ranking cascade with a single model. Kuaishou reports that it runs at 10.6% of the old pipeline's operating expense and serves about 25% of requests in its main apps. Those figures are self-reported, measured against Kuaishou's own cascade, and the report says the model does not yet serve all traffic. PLUM is cheaper to *train* than the model it competes with: it learns from about 250M examples a day, against several billion for the embedding-table model, and uses under 0.55× the training FLOPs.

| System | Where | Role in the pipeline | Reported online result (self-reported) |
|---|---|---|---|
| PLUM (2025) | YouTube, long-form / Shorts | Adds candidates to the retrieval pool | vs. an equal-quota baseline: views +0.80% / +0.39%, panel CTR +0.76% / +4.96% |
| GLIDE (2026) | Spotify Home, podcasts | Candidates go to downstream ranking | up to +5.4% non-habitual podcast streaming, up to +14.3% new-show discovery |
| OneRec (2025) | Kuaishou and Kuaishou Lite | Replaces retrieval and ranking for ~25% of requests | App Stay Time +0.54% / +1.24% |

## 5. Cold start and staleness

**New items.** The tokenizer can assign a code from content alone, so a new item is reachable on day one, which is one of the bridges over [item cold start](#c/item-cold-start). In TIGER's cold-start test, unseen items that shared the first three tokens of a generated code joined the candidate list, with a cap ε on their share. For every ε ≥ 0.1 this beat a nearest-neighbour baseline over the same content space. GLIDE keeps its codes content-only for this reason, so that new episodes can be recommended immediately. There is a catch. The generator never saw the new item and reaches it only through its neighbours' prefix, so an item with misleading metadata lands in the wrong region.

**Staleness.** Codes that include behaviour drift out of date as interaction patterns change (Baikalov et al., 2026). Refreshing them changes the vocabulary under a trained generator, so the team must either retrain the generator or align the new codes to the old ones. PLUM avoids frequent quantizer retraining by using behaviour only as a training signal. GLIDE notes that content-only codes stay stable unless the item's own metadata changes.

## 6. What is still open

- **Benchmarks are small and fragile.** TIGER's public results come from Amazon categories of 10–20 thousand items. The GRID handbook (Ju et al., 2025) found that many overlooked architectural choices change the results substantially, so comparisons across papers are shaky.
- **Scaling is contested.** PLUM reports retrieval still improving at over 900M activated parameters. A KDD 2026 study (Liu et al.) finds the opposite pattern: semantic-ID models saturate quickly as the encoder, the tokenizer or the model grows, and the authors blame the limited capacity of the codes.
- **Two towers push back.** Xu et al. (2026) argue that generative retrievers are held back by compute and grounding. In their study, an LLM-backbone two-tower retriever reaches comparable quality and keeps two-tower serving efficiency.
- **Two things share the name.** Meta's HSTU "Generative Recommenders" (Zhai et al., ICML 2024) also model user actions as a sequence, and report a 12.4% topline A/B gain at 1.5 trillion parameters. They work with ordinary item IDs from a billion-scale, constantly changing vocabulary, not with semantic IDs. When someone says "generative recommender", ask which kind they mean.

**Pilot it the way PLUM did:** add the generator as one more candidate source, and give your best existing retriever the same extra quota as the baseline. That way the test measures the generator and not just a bigger shortlist. Track the invalid-code rate, latency at your target beam width, new-item coverage, and how often you rebuild the codes.

**Sources:**
- Rajput et al., "Recommender Systems with Generative Retrieval" (TIGER), NeurIPS 2023 — https://arxiv.org/abs/2305.05065
- Singh et al., "Better Generalization with Semantic IDs: A Case Study in Ranking for Recommendations", RecSys 2024 — https://doi.org/10.1145/3640457.3688190
- He et al., "PLUM: Adapting Pre-trained Language Models for Industrial-scale Generative Recommendations", 2025 — https://arxiv.org/abs/2510.07784
- D'Amico et al., "Deploying Semantic ID-based Generative Retrieval for Large-Scale Podcast Discovery at Spotify", 2026 — https://arxiv.org/abs/2603.17540
- Deng et al., "OneRec: Unifying Retrieve and Rank with Generative Recommender and Iterative Preference Alignment", 2025 — https://arxiv.org/abs/2502.18965
- Zhou et al., "OneRec Technical Report", 2025 — https://arxiv.org/abs/2506.13695
- Baikalov et al., "Mitigating Collaborative Semantic ID Staleness in Generative Retrieval", 2026 — https://arxiv.org/abs/2604.13273
- Ju et al., "Generative Recommendation with Semantic IDs: A Practitioner's Handbook", 2025 — https://arxiv.org/abs/2507.22224
- Liu et al., "Understanding Generative Recommendation with Semantic IDs from a Model-scaling View", KDD 2026 — https://arxiv.org/abs/2509.25522
- Xu et al., "The Case Against Generation for Retrieval: Discriminative Language Models as Effective Retrievers", 2026 — https://arxiv.org/abs/2607.25346
- Zhai et al., "Actions Speak Louder than Words: Trillion-Parameter Sequential Transducers for Generative Recommendations" (HSTU), ICML 2024 — https://arxiv.org/abs/2402.17152
- Zeghidour et al., "SoundStream: An End-to-End Neural Audio Codec", 2021 — https://arxiv.org/abs/2107.03312
