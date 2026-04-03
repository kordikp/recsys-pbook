---
id: ch3-rl-recsys
type: spine
title: "Reinforcement Learning for Recommendations: Beyond Bandits"
readingTime: 4
standalone: false
core: false
voice: thinker
parent: ch3-bandits
diagram: null
recallQ: "How does reinforcement learning differ from bandit approaches in recommendation?"
recallA: "Bandits optimize single-step reward (1-step horizon). RL optimizes cumulative long-term reward over a sequence of recommendations, modeling how today's recommendation affects tomorrow's user behavior."
publishedAt: "2026-04-03"
status: accepted
---

Bandit algorithms solve one step at a time: given this user in this context, which item maximizes immediate reward? But recommendation is inherently sequential. The article you show now changes what the user wants next. A short-term click-maximizer that exhausts a user's patience with clickbait is optimizing the wrong objective.

Reinforcement learning extends bandits to multi-step decision-making. Instead of maximizing a single reward, the system learns a **policy** that maximizes **cumulative reward** across an entire session -- or even across the user's lifetime on the platform.

![Reinforcement learning MDP loop for recommendations](/images/anim-rl-mdp.svg)

## The MDP Formulation

A recommender system can be formalized as a **Markov Decision Process** (MDP):

- **State** $s_t$: The user's current context -- their interaction history, session behavior, time of day, device, and any other observable features
- **Action** $a_t$: The item (or slate of items) recommended at step $t$
- **Reward** $r_t$: The observed engagement signal -- click, dwell time, purchase, satisfaction rating
- **Transition** $P(s_{t+1} | s_t, a_t)$: How the user's state evolves after receiving recommendation $a_t$
- **Discount factor** $\gamma \in [0, 1)$: How much future rewards are worth relative to immediate ones

The objective is to learn a policy $\pi(a|s)$ that maximizes the expected discounted return:

$$J(\pi) = \mathbb{E}_\pi \left[ \sum_{t=0}^{T} \gamma^t r_t \right]$$

When $\gamma = 0$, this reduces to the bandit setting -- only the immediate reward matters. When $\gamma > 0$, the system considers how today's recommendation affects tomorrow's state.

## Why Long-Term Matters

Consider a music streaming service. A greedy policy might play a user's top 3 favorite songs on repeat -- high immediate satisfaction, but the user gets bored and churns next week. An RL-trained policy might intersperse familiar favorites with exploratory tracks that broaden the user's taste, leading to a more engaged listener over months.

The same logic applies across domains:

- **E-commerce:** Recommending only sale items maximizes short-term conversion but erodes price sensitivity and brand perception
- **News:** Optimizing for clicks leads to sensationalism; optimizing for long-term engagement favors trustworthy, substantive reporting
- **Video:** YouTube found that optimizing for watch time rather than clicks significantly improved user retention -- an early step toward long-horizon optimization

## Policy Gradient Methods

**REINFORCE** (Williams, 1992) directly optimizes the policy by estimating the gradient of expected return:

$$\nabla_\theta J(\pi_\theta) = \mathbb{E}_\pi \left[ \sum_{t=0}^{T} \nabla_\theta \log \pi_\theta(a_t | s_t) \cdot G_t \right]$$

where $G_t = \sum_{k=t}^{T} \gamma^{k-t} r_k$ is the return from step $t$ onward. The intuition: increase the probability of actions that led to high returns, decrease it for actions that led to low returns.

In practice, REINFORCE suffers from **high variance** -- the same policy can produce very different trajectories, making gradient estimates noisy. Variance reduction techniques (baselines, actor-critic methods) are essential for practical deployment.

## Q-Learning and DQN

An alternative approach estimates the **action-value function** $Q(s, a)$ -- the expected return of taking action $a$ in state $s$ and following the optimal policy thereafter:

$$Q^*(s, a) = \mathbb{E}\left[ r + \gamma \max_{a'} Q^*(s', a') \right]$$

**Deep Q-Networks (DQN)** approximate $Q^*$ with a neural network, trained via temporal difference learning. Given a transition $(s_t, a_t, r_t, s_{t+1})$:

$$\mathcal{L} = \left( r_t + \gamma \max_{a'} Q_{\bar{\theta}}(s_{t+1}, a') - Q_\theta(s_t, a_t) \right)^2$$

where $Q_{\bar{\theta}}$ is a target network (a delayed copy of $Q_\theta$) that stabilizes training.

DQN-based recommenders have been explored in several production-adjacent systems. The appeal is clear: once $Q(s, a)$ is learned, the policy is simply $\pi(s) = \arg\max_a Q(s, a)$.

## The Credit Assignment Problem

Recommendation RL faces a severe **credit assignment** challenge. If a user churns after a session of 50 recommendations, which of those 50 caused the churn? Was it the third item that started a negative spiral, or the accumulated effect of slightly suboptimal choices?

In games like chess or Go, credit assignment is difficult but tractable -- outcomes are clear and episodes are well-defined. In recommendation:

- **Rewards are delayed and sparse**: A user might not purchase for days after an initial recommendation
- **Episodes are ambiguous**: When does a "session" start and end? Is a user's lifetime one long episode?
- **Counterfactuals are unobservable**: You cannot know what would have happened had you recommended differently

These challenges make RL for recommendations significantly harder than RL for games or robotics.

## Offline RL: Learning from Logged Data

Online RL -- interacting with real users to collect training data -- is expensive and risky. Bad exploration policies degrade user experience. This has driven interest in **offline RL** (also called batch RL): learning a policy from pre-existing logged interaction data without further environment interaction.

The core difficulty is **distribution shift**. The logged data was collected under a historical policy $\pi_\beta$ (the "behavior policy"). If the learned policy $\pi$ takes actions that $\pi_\beta$ rarely took, the Q-value estimates for those actions are unreliable -- the model is extrapolating into regions with no data support.

Methods like **Conservative Q-Learning (CQL)** (Kumar et al., 2020) address this by adding a regularizer that penalizes Q-values for out-of-distribution actions:

$$\mathcal{L}_{\text{CQL}} = \alpha \cdot \mathbb{E}_{s} \left[ \log \sum_a \exp Q(s, a) - \mathbb{E}_{a \sim \pi_\beta} [Q(s, a)] \right] + \mathcal{L}_{\text{TD}}$$

This encourages the learned policy to stay close to the behavior policy while still improving upon it.

## Bandits vs. RL: When to Use Which

Bandits are RL with a **one-step horizon** ($\gamma = 0$). This distinction has practical implications:

| Aspect | Bandits | Full RL |
|---|---|---|
| Horizon | Single step | Multi-step |
| State transitions | Ignored | Modeled |
| Complexity | Low | High |
| Data requirements | Moderate | Very high |
| Interpretability | High | Low |
| Production maturity | Widely deployed | Mostly experimental |

**Use bandits when:**
- Actions have limited impact on future state (e.g., ad placement, homepage widget ordering)
- You need a tractable, well-understood approach with theoretical guarantees
- You have limited interaction data

**Use RL when:**
- Current actions meaningfully affect future user behavior (e.g., playlist sequencing, learning paths)
- You have massive interaction logs and can afford offline RL training
- Long-term metrics (retention, lifetime value) diverge significantly from short-term proxies (clicks)

## Real-World Deployments

Despite its theoretical appeal, full RL in production recommendation systems remains rare. Two notable examples:

**YouTube's SlateQ** (Ie et al., 2019) formulates slate recommendation as an RL problem, decomposing the combinatorial action space (choosing a set of items) into per-item Q-values. The key insight is that the value of a slate can be decomposed under certain user choice models, making the otherwise intractable action space manageable.

**Spotify's dynamic playlists** use RL-inspired approaches to sequence tracks within a listening session, balancing familiarity and discovery over time rather than greedily maximizing predicted skip rate for each individual track.

**Why RL remains mostly experimental:** The combination of massive action spaces (millions of items), partial observability (you don't see the user's true mental state), delayed and noisy rewards, and the impossibility of safe online exploration at scale means that simpler approaches -- contextual bandits augmented with heuristic long-term objectives -- often outperform full RL in practice. The theoretical elegance of RL is real, but so are the engineering challenges. Most production systems today approximate long-term optimization through surrogate objectives (e.g., predicting user retention directly) rather than through end-to-end RL.
