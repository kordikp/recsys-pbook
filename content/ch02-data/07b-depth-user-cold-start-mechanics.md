---
id: user-cold-start-mechanics
type: spine
title: "User Cold Start, Under the Hood"
readingTime: 4
standalone: true
core: false
teaser: "Priors that hand over to evidence, models with no user parameters, interviews that adapt, bandits, and the places it all breaks."
parent: user-cold-start
recallQ: "How does a recommender blend defaults with personal evidence for a new user, and why do the first interactions matter so much?"
recallA: "It scores with a weighted blend of a context/segment prior and a personal estimate, where the personal weight grows with the user's interaction count (for example n/(n+k)). The first interactions move that weight the most, and item-based models can use them on the next request because the items were already learned from everyone else."
status: accepted
concept: user-cold-start
state: edited
lens: generic
lang: en
visuality: text-first
depth: technical
formalism: light
lengthBand: deep
genre: explainer
carriers: prose|formula
---

Mechanically, user cold start comes down to two questions: how fast to move a person from a prior to their own evidence, and how to collect that evidence cheaply.

## A prior, then evidence

Let *n* be the user's interaction count and *c* the context of the visit: referrer, device, locale, time, and the session so far. A common pattern blends a context prior with the personal estimate:

$s(u,i) = w_u \, s_{\text{personal}}(u,i) + (1 - w_u) \, s_{\text{prior}}(c,i)$, with $w_u = \frac{n}{n+k}$.

The prior is segment popularity or a contextual model. The constant *k* says how many interactions it takes before personal evidence counts as much as the prior (at *n* = *k* the split is half and half). The arithmetic explains the folk wisdom that first clicks matter most: the first interaction moves the personal weight from 0 to 1/(1+*k*), while the 101st barely moves it. It is the [item cold start](#c/item-cold-start) handoff, mirrored onto the person.

## Models with no user parameters

The prior fades fastest in models that never learn a per-user vector and instead compute the user from the items they touched. Item-to-item collaborative filtering is the classic case: Amazon's 2003 paper reports high-quality recommendations "based on as few as two or three items". [EASE](#c/ease-elsa) scores a user as their interaction row multiplied by a learned item-item matrix, so a first click changes the scores on the very next request, with no retraining. Session models such as GRU4Rec go one step further and read the click sequence of the current visit; the paper's problem statement is recommending from "short session-based data … instead of long user histories" (see [session-based recommendation](#c/session-based)).

Contrast a factorization model with a learned embedding per user: a newcomer has no vector until a retrain, or a fold-in step that solves for one from their few interactions. Whether "personal" arrives on the next request or after the nightly job is an engineering decision worth making on purpose.

## Asking well

Onboarding is active learning: choose the questions that buy the most information per unit of user effort. Rashid et al. (2002) tested strategies on MovieLens sign-up, where newcomers rated pages of ten movies until they had rated ten. Popular movies are easy to rate but say little: "If everyone likes Titanic, and I say I like it too, what can the system learn from that?" Picking the most informative (highest-entropy) movies failed the other way. In a pilot, two users had to view several hundred movies each before finding ten they could rate. The strategies that worked balanced "can this person answer?" against "does the answer split people?".

Later work made the interview smarter. Golbandi, Koren and Lempel (2011) adapt it with decision trees, so each next question depends on the previous answers. MeLU (Lee et al., 2019) combines meta-learning (MAML), which trains across many users so the model adapts to a new one from a few consumed items, with choosing "evidence candidates" that distinguish users, instead of showing popular items.

The newest option is letting people say it in words. Sanner et al. (2023) found that LLMs, zero- or few-shot, give recommendations competitive with item-based collaborative filtering in the near cold-start case when users state preferences in plain language, and that such preferences are more explainable and scrutable (see [LLM-powered recommendation](#c/llm-recommenders)).

## Exploring on purpose

Between the questions and a solid history, the recommender still chooses what to show under uncertainty. Contextual bandits score items from user and context features and add an uncertainty bonus, so uncertain items get tried while they might still be good. Li et al. (2010) applied this to Yahoo!'s front-page news module; the advantage of their contextual algorithm over a context-free bandit "becomes even greater when data gets more scarce", which describes the cold-start regime (more in [bandits in practice](#c/bandits-in-practice)).

## Where it breaks

- **Priors favour the majority.** Segment popularity feeds a rich-get-richer loop; Rashid et al. already warned that asking newcomers about popular items can widen it (see [the long tail](#c/long-tail)).
- **Stated is not revealed.** An onboarding answer is a statement of intent. Let its weight decay as behaviour arrives, and let people edit it.
- **Demographic guesses stereotype.** A segment built from inferred age or gender treats a group average as a fact about one person, and feels intrusive even when it is right.
- **Averages hide newcomers.** Heavy users dominate interaction-weighted metrics, so a model can win on average and lose new users. Slice offline metrics and [A/B tests](#c/ab-testing) by tenure.
- **Privacy is a design input.** The GDPR's data-minimisation principle asks for data "adequate, relevant and limited to what is necessary"; session context and declared preferences usually suffice to start. When someone opts out, an empty shelf can be the honest answer: YouTube removes homepage recommendations for people who have watch history off and no significant prior history.

**The number to own** is time-to-personal: how many interactions until a newcomer's lists beat the segment default, tracked per tenure bucket. Every technique above is a way to shrink it.

**Sources:**
- Linden, Smith, York (2003), "Amazon.com Recommendations: Item-to-Item Collaborative Filtering", IEEE Internet Computing 7(1). https://doi.org/10.1109/MIC.2003.1167344
- Steck (2019), "Embarrassingly Shallow Autoencoders for Sparse Data", WWW 2019. https://doi.org/10.1145/3308558.3313710
- Hidasi et al. (2016), "Session-based Recommendations with Recurrent Neural Networks", ICLR 2016. https://arxiv.org/abs/1511.06939
- Rashid et al. (2002), "Getting to Know You: Learning New User Preferences in Recommender Systems", IUI 2002. https://doi.org/10.1145/502716.502737
- Golbandi, Koren, Lempel (2011), "Adaptive Bootstrapping of Recommender Systems Using Decision Trees", WSDM 2011. https://doi.org/10.1145/1935826.1935910
- Lee et al. (2019), "MeLU: Meta-Learned User Preference Estimator for Cold-Start Recommendation", KDD 2019. https://doi.org/10.1145/3292500.3330859
- Sanner et al. (2023), "Large Language Models are Competitive Near Cold-start Recommenders for Language- and Item-based Preferences", RecSys 2023. https://doi.org/10.1145/3604915.3608845
- Li, Chu, Langford, Schapire (2010), "A Contextual-Bandit Approach to Personalized News Article Recommendation", WWW 2010. https://doi.org/10.1145/1772690.1772758
- Regulation (EU) 2016/679 (GDPR), Art. 5(1)(c). https://eur-lex.europa.eu/eli/reg/2016/679/oj
- YouTube Help, "View, delete, or turn on or off watch history": https://support.google.com/youtube/answer/95725
