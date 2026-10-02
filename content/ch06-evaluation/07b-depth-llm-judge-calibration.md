---
id: llm-judge-calibration
type: spine
title: "Calibrating an LLM Judge: Mechanisms, Limits, Protocol"
readingTime: 6
standalone: true
core: false
teaser: "Why judges are noisy item by item yet can rank whole systems well, where simulated users break, and six steps before you trust a verdict."
parent: llm-judge-evaluation
recallQ: "Why can an LLM judge rank whole systems well while disagreeing with humans on many single items, and what does that imply for how you use it?"
recallA: "Item-level errors are frequent, but when they do not favor any particular system they average out over many user-item pairs, so system-level rankings stay stable. Biases that do favor a system (its own model family, verbose outputs, popular items, answer order) do not average out, and simulated users miss how real users behave. So debias order, length and authorship, measure chance-corrected agreement with human labels, use the judge for aggregate triage and regression checks, and confirm launches with an online A/B test."
status: draft
concept: llm-judge-evaluation
state: edited
lens: generic
lang: en
depth: technical
formalism: light
visuality: balanced
lengthBand: deep
genre: explainer
carriers: prose|table|formula
---

An LLM judge is a measurement instrument: it has a bias profile, a noise level and a range in which it can be trusted.

## Three jobs a judge is given

Zheng et al. distinguish **pairwise comparison** (A or B?), **single-answer grading** (score against a rubric) and **reference-guided grading** (compare to a known-good answer). Recommender teams add a fourth: **relevance labeling** of user–item pairs, which turns the judge into the source of ground truth for ordinary ranking metrics such as nDCG. Spotify researchers did this on a Cranfield-style movie collection (candidates pooled from many systems, each judged against a user profile). Pinterest uses fine-tuned LLM relevance labels inside its search A/B experiments, which let it cover more queries and lowered the minimum detectable effect. There the judge works as an instrument inside the online test rather than as a replacement for it.

## The bias inventory

| Bias | Evidence | Counter-measure |
|---|---|---|
| **Position** | GPT-4 favored the first answer and ChatGPT the second; reordering alone let Vicuna-13B beat ChatGPT on 66 of 80 queries with ChatGPT judging (Wang et al.) | Judge both orders; count a win only if it holds in both, otherwise a tie (Zheng et al.) |
| **Verbosity** | Judges favor longer responses even when they are not better (Zheng et al.). Controlling for length raised AlpacaEval's correlation with Chatbot Arena from 0.94 to 0.98 (Dubois et al.) | Set length limits in the rubric, report length next to win rate, or regress length out |
| **Self-preference** | LLMs recognize their own text, and stronger self-recognition goes with stronger self-preference (Panickssery et al.) | Judge with a different model family than the generator; ensemble heterogeneous judges, which improved accuracy and stability for explanation grading (Zhang et al., RecSys 2024) |
| **Popularity and list order** | LLM rankers are biased by item popularity and by candidate position in the prompt (Hou et al.) | Shuffle candidate lists; stratify the gold set by popularity; report long-tail results separately |
| **Prompt wording** | At Bing, LLM labels beat third-party human labelers against searcher-derived gold labels, yet accuracy shifted with simple paraphrases of the prompt (Thomas et al.) | Version the rubric like code and re-validate after every change |

## Item-level noise, system-level signal

Penha et al. (Spotify) found that **item-level agreement** with human labels was moderate. Richer item metadata and longer user histories improved it. Yet system rankings computed from the judge's labels matched human-based rankings at **Kendall's τ up to 0.92** (nDCG@100, 52 system configurations). Those labels also corrected rankings that sparse held-out interactions had distorted, a close relative of the [offline evaluation bias](#c/evaluation-metrics). The mechanism is aggregation: over many user–item pairs, errors that do not favor any system cancel out.

The condition carries the weight. Averaging cancels only errors that are **uncorrelated with the systems being compared**. A system that writes longer text, leans toward popular items or runs on the judge's own model family gets a bias that compounds instead of cancelling. Soboroff states the deeper limit: whatever serves as the answer key caps measurable performance, so a system better than the judge cannot score as better. Use judges to rank whole systems on average, not to decide whether one recommendation suits one user.

Representation matters too. Fabbri et al. (Spotify) gave the judge natural-language profiles distilled from 90 days of listening history. In a 47-participant study, this matched human judgments and equalled or beat feeding it raw history.

## Where simulated users break

- **Too positive.** Agent4Rec's 1,000 agents, built from MovieLens-1M, Steam and Amazon-Book profiles, both aligned with and deviated from real users. One deviation: they gave very few 1–2 ratings, and they occasionally invented items (Agent4Rec; Zhang et al., SIGIR 2024).
- **Too mainstream, too generic.** In conversational movie recommendation, LLM simulators named far less diverse, popularity-skewed titles, gave consistently optimistic feedback and phrased requests generically (Yoon et al.).
- **Leaky.** In conversational recommender benchmarks, information leaking through dialogue history and simulator replies inflated results. Success depended more on that history than on what the simulator said (Zhu et al.).
- **Miscalibrated by group.** Outside recommendation, in agentic tasks, simulated users underestimated success on hard tasks, overestimated it on moderate ones, and were especially poor proxies for speakers of African American Vernacular English and Indian English (Seshadri et al.).

Simulators are good for smoke tests: dead ends, loops, refusals and prompt regressions. They are not good for estimating launch effect sizes.

## A protocol before you trust a verdict

1. **Name the decision.** Triage, regression gate or monitoring, yes. Launch, no.
2. **Build a gold set from the people you serve.** Use a few hundred items labeled by users or editors, or derived from behavior, as Bing did. Measure human–human agreement first, because it is your ceiling. On MT-Bench, GPT-4 agreed with experts 85% of the time (ties excluded), above the experts' 81% with each other (Zheng et al.).
3. **Use chance-corrected agreement.** Cohen's $\kappa = \frac{p_o - p_e}{1 - p_e}$, where $p_o$ is the observed agreement and $p_e$ the agreement expected by chance from each rater's label frequencies. Raw agreement flatters a judge when one label dominates, for example when most explanations pass.
4. **Debias by design.** Judge both orders, hide authorship, use a different model family or an ensemble, control length, shuffle candidates and stratify by popularity.
5. **Close the loop online.** Log whether judge-preferred variants win their A/B tests. Netflix runs judges, aligned to human reviewers, on show explanations. A five-week test across tens of millions of members showed relative gains of +0.2% in viewing of not-yet-watched titles and +0.3% in sessions with a successful play (Kong et al.). Real effects are that small, and a judge's win rate cannot tell you their size.
6. **Recalibrate on drift.** A new catalog, generator model or rubric means you repeat step 3. The Netflix team monitors with humans in the loop because catalog, algorithms and users all shift.

The judge tells you where to look; [A/B tests](#c/ab-testing) tell you what you found. What makes an explanation worth grading in the first place is the subject of [explanations](#c/explanations).

**Sources:**
- Zheng et al. 2023, [Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685), NeurIPS Datasets & Benchmarks
- Wang et al. 2023, [Large Language Models are not Fair Evaluators](https://arxiv.org/abs/2305.17926)
- Dubois et al. 2024, [Length-Controlled AlpacaEval: A Simple Way to Debias Automatic Evaluators](https://arxiv.org/abs/2404.04475)
- Panickssery, Bowman & Feng 2024, [LLM Evaluators Recognize and Favor Their Own Generations](https://arxiv.org/abs/2404.13076), NeurIPS
- Hou et al. 2024, [Large Language Models are Zero-Shot Rankers for Recommender Systems](https://arxiv.org/abs/2305.08845), ECIR
- Thomas et al. 2024, [Large Language Models can Accurately Predict Searcher Preferences](https://doi.org/10.1145/3626772.3657707), SIGIR
- Zhang et al. 2024, [Large Language Models as Evaluators for Recommendation Explanations](https://doi.org/10.1145/3640457.3688075), RecSys
- Soboroff 2025, [Don't Use LLMs to Make Relevance Judgments](https://arxiv.org/abs/2409.15133), Information Retrieval Research
- Penha et al. 2026, [From IR to RecSys: Evaluating LLM-based Judges in Cranfield-style Recommendation Collections](https://arxiv.org/abs/2511.23312), RecSys USR Workshop
- Fabbri et al. 2025, [Evaluating Podcast Recommendations with Profile-Aware LLM-as-a-Judge](https://doi.org/10.1145/3705328.3759305), RecSys
- Wang et al. 2025, [LLM-based Relevance Assessment for Web-Scale Search Evaluation at Pinterest](https://arxiv.org/abs/2509.03764), RecSys EARL Workshop
- Zhang et al. 2024, [On Generative Agents in Recommendation](https://arxiv.org/abs/2310.10108), SIGIR
- Yoon et al. 2024, [Evaluating Large Language Models as Generative User Simulators for Conversational Recommendation](https://arxiv.org/abs/2403.09738), NAACL
- Zhu, Huang & Sang 2024, [How Reliable is Your Simulator? Analysis on the Limitations of Current LLM-based User Simulators for Conversational Recommendation](https://arxiv.org/abs/2403.16416)
- Seshadri et al. 2026, [Lost in Simulation: LLM-Simulated Users are Unreliable Proxies for Human Users in Agentic Evaluations](https://arxiv.org/abs/2601.17087)
- Kong et al. 2026 (Netflix), [The Lifecycle of LLM-as-a-Judge for Large-Scale Recommendation Explanations](https://arxiv.org/abs/2608.18300)
- Cohen 1960, [A Coefficient of Agreement for Nominal Scales](https://doi.org/10.1177/001316446002000104), Educational and Psychological Measurement
