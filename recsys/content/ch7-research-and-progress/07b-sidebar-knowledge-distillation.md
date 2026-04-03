---
id: ch7-distillation
type: spine
title: "Knowledge Distillation: Making Big Models Small"
readingTime: 3
standalone: true
core: false
teaser: "Production systems can't afford the latency of a 10-billion-parameter model. Distillation transfers knowledge into something fast enough to serve."
voice: thinker
parent: ch7-production-scale
diagram: null
recallQ: "Why do soft labels from a teacher model contain more information than hard labels?"
recallA: "Soft labels encode the teacher's uncertainty — a movie rated 0.8 action and 0.3 romance carries more information than just 'action'. This inter-class similarity information helps the student generalize better."
status: accepted
---

You've trained a massive ensemble model. It's state-of-the-art on every metric. But it takes 500ms to score candidates — five times your latency budget. You can't serve it.

**Knowledge distillation** solves this by training a small, fast "student" model to mimic a large, accurate "teacher" model. The student learns not just the correct answers, but the *reasoning patterns* encoded in the teacher's predictions.

## The Teacher-Student Paradigm

The core idea (Hinton et al., 2015): instead of training the student on hard labels (click/no-click), train it on the teacher's **soft predictions** — the probability distribution over all items.

**Why soft labels work better than hard labels:**

A hard label says: "The user clicked item A." This is one bit of information.

A soft prediction says: "The user would engage with item A at 0.92, item B at 0.73, item C at 0.15, item D at 0.03." This contains rich information about inter-item similarities that the student can learn from.

The training objective uses a **temperature-scaled softmax:**

$$q_i = \frac{\exp(z_i / T)}{\sum_j \exp(z_j / T)}$$

Higher temperature T → softer distributions → more information in each training example. Typical T values: 2–20.

## RecSys Applications

**1. Distill ensemble into single model.** Production systems often train multiple models (CF, content-based, deep) and ensemble them. Distillation compresses this ensemble into a single model that's fast enough to serve:

- Teacher: ensemble of 5 models (offline, 500ms)
- Student: single two-tower model (online, 50ms)
- Result: 90–95% of ensemble quality at 10× the speed

**2. Distill complex ranker into fast retriever.** The ranking model sees rich cross-features between user and item, but can only score hundreds of candidates. Distilling its knowledge into a two-tower model enables fast retrieval over millions of items:

- Teacher: cross-attention ranker (scores 500 candidates in 100ms)
- Student: two-tower retriever (retrieves top 1000 from millions in 10ms)

**3. Distill for edge deployment.** Mobile and IoT devices need tiny models. A server-side teacher can produce a model small enough to run on-device for privacy-preserving recommendation.

## The CompresSAE Connection

CompresSAE can be viewed as a form of distillation — compressing 768-dimensional dense embeddings into sparse representations that preserve the essential information for retrieval. The sparse autoencoder acts as a student that learns to reconstruct the teacher's embeddings with minimal loss.

The key insight: distillation doesn't just reduce size — it can **improve generalization** by filtering out noise that the large model captured. A student trained on soft labels from a denoised teacher can outperform the teacher on unseen data.

## Practical Recipe

1. **Train the teacher:** Use all available compute and data. No latency constraints.
2. **Generate soft labels:** Run the teacher over the training set to produce probability distributions.
3. **Train the student:** Minimize KL-divergence between student and teacher distributions, plus a smaller weight on the original hard labels.
4. **Tune temperature:** Start with T=5, sweep [2, 20]. Higher T for larger label spaces.
5. **Evaluate gap:** If the student-teacher quality gap exceeds 5%, consider a larger student architecture.

## When Distillation Helps Most

- **Large label space:** Thousands or millions of items → soft labels are extremely informative
- **Latency-constrained serving:** The teacher can be arbitrarily slow; the student must be fast
- **Ensemble compression:** Multiple models → one deployable model
- **Cross-architecture transfer:** Teacher is a transformer, student is a shallow network

**Consider this:** Distillation reveals something profound about model complexity — most of the parameters in a large model encode redundant information. The essential knowledge often fits in a fraction of the original capacity. This observation connects to EASE outperforming deep networks: sometimes the "knowledge" is inherently low-dimensional.