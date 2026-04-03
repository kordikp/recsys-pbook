---
id: ch9-drift
type: spine
title: "Drift Detection: When Your Model Goes Stale"
readingTime: 3
standalone: true
core: false
teaser: "Every deployed model is drifting from reality. The question is not whether drift is happening -- it is whether you can detect it before your users do."
voice: thinker
parent: null
diagram: null
recallQ: "What are the four types of drift in recommendation systems?"
recallA: "Feature drift (covariate shift -- input distributions change), prediction drift (output score distributions change), concept drift (the relationship between inputs and outcomes changes), and label drift (the distribution of user feedback changes). Each requires different detection methods and responses."
highlights:
  - "Feature drift (covariate shift) is the most detectable: compare today's input distributions against training distributions using PSI or KS tests"
  - "Concept drift is the hardest to detect because it requires comparing predictions against delayed outcomes"
  - "Not all drift requires retraining -- moderate feature drift is normal; concept drift almost always demands action"
publishedAt: "2026-04-03"
status: accepted
---

A model trained on last month's data is making predictions in today's world. The gap between these two realities is drift -- and in recommender systems, drift is not an occasional anomaly but a continuous process.

## The Four Types of Drift

### Feature Drift (Covariate Shift)

The distribution of input features at inference time diverges from the distribution the model saw during training. This is the most common and most detectable form of drift.

**Causes:** User demographics evolve as the platform grows (younger users join, geographic expansion brings new regions). Catalog composition changes as products are added and removed. Seasonal patterns shift engagement (holiday shopping, summer viewing). An upstream data pipeline starts encoding a field differently.

**Detection methods:**

- **Population Stability Index (PSI).** Compares the distribution of a feature between a reference period (training data) and the current period. PSI values below 0.1 indicate negligible drift. Values between 0.1 and 0.25 indicate moderate drift that warrants investigation. Values above 0.25 indicate significant drift that likely requires action. PSI is simple, fast, and works well for both continuous and categorical features.

- **Kolmogorov-Smirnov (KS) test.** A non-parametric test that measures the maximum distance between two cumulative distribution functions. More sensitive than PSI to changes in the tails of distributions. Useful for features where extreme values matter (e.g., price, session length).

- **Wasserstein distance (Earth Mover's Distance).** Measures the minimum "work" required to transform one distribution into another. More informative than KS for understanding the magnitude of drift, not just its presence.

**How often to check:** For high-traffic systems, compute drift statistics hourly and compare against daily and weekly baselines. For lower-traffic systems, daily checks against weekly baselines are sufficient. Alert when any critical feature exceeds its drift threshold for more than two consecutive check periods -- this filters out transient spikes.

### Prediction Drift

The distribution of model output scores changes, even if you cannot pinpoint which input features are responsible. The model is producing systematically different scores than it did during its validation period.

**Causes:** Feature drift that aggregates across many features. A model artifact that was accidentally replaced with an older version. A change in the feature computation pipeline that alters values subtly. A shift in the candidate pool that presents the model with items it has not seen before.

**Detection:** Monitor the histogram of predicted scores over rolling windows. Track the mean, variance, and key percentiles (p10, p50, p90) of scores. A sudden compression of scores (all items receiving similar scores) often indicates a feature failure that is causing the model to fall back on its bias terms. A sudden expansion may indicate a data leak or a feature that has started carrying disproportionate signal.

### Concept Drift

The true relationship between features and outcomes changes. This is the most dangerous and hardest to detect form of drift because the inputs may look normal and the predictions may look normal, but the mapping between them is no longer correct.

**Causes:** Genuine changes in user preferences. Short-form video displaces long-form content. A cultural moment makes a previously niche genre mainstream. Economic conditions change purchasing patterns. These are not data errors -- they are real changes in how the world works.

**Detection:** Concept drift can only be detected by comparing model predictions against actual outcomes -- and since outcomes in recommender systems are delayed, detection is inherently slower than for feature or prediction drift.

Track the gap between predicted relevance scores and observed engagement over rolling windows. If the model predicts high relevance but users consistently do not engage (or vice versa), the model's concept of "relevance" has drifted from reality. A widening calibration error that persists beyond normal variance is the clearest signal.

**ADWIN (Adaptive Windowing)** is an algorithm designed for concept drift detection in streaming data. It maintains a variable-length window of recent observations and detects changes by comparing sub-windows. When a statistically significant change is detected, the window is shortened to discard outdated data. ADWIN is particularly useful for recommender systems because it adapts its sensitivity to the rate of change.

### Label Drift

The distribution of user feedback itself changes. Users click differently, rate differently, or purchase differently -- not because the recommendations changed, but because user behavior patterns shifted.

**Causes:** A UI redesign changes click patterns (larger buttons get more clicks regardless of recommendation quality). A pricing change affects purchase rates. A new user cohort has different engagement norms than existing users. Seasonal effects shift baseline engagement rates.

**Detection:** Monitor the base rates of key feedback signals (click-through rate, add-to-cart rate, conversion rate) independent of model performance. If the overall CTR drops from 5% to 3%, is the model performing worse, or are users simply clicking less? Decomposing metric changes into "model contribution" and "baseline shift" is essential for avoiding false alarms.

## When to Retrain vs. When to Patch

Not all drift demands a full model retraining. The response should be proportional to the type and severity of drift.

**Moderate feature drift (PSI 0.1--0.25).** Monitor closely. If model metrics (nDCG, precision) remain stable, the model is generalizing well despite the distribution shift. No action required beyond continued observation.

**Severe feature drift (PSI > 0.25) on critical features.** Investigate the root cause first. If the drift is due to a data pipeline error, fix the pipeline -- retraining on corrupted data will make things worse. If the drift is genuine (seasonal shift, new user demographics), schedule retraining on recent data.

**Concept drift.** Almost always requires retraining. The model's learned relationships are no longer valid. If the drift is gradual, incremental learning (updating the model with recent data) may suffice. If the drift is sudden (a platform change, a viral event), a full retrain on a recent data window is safer.

**Label drift.** Do not retrain on shifted labels without understanding why the shift occurred. If a UI change inflated clicks, retraining will teach the model to optimize for the new click patterns rather than genuine relevance. Correct the labeling strategy first (e.g., weight clicks differently post-redesign), then retrain if needed.

The worst response to drift is automated retraining without diagnosis. A pipeline that automatically retrains when drift is detected will dutifully learn from corrupted data, broken features, and artificial label shifts -- compounding the problem instead of fixing it.
