---
id: agentic-recommendation
type: spine
title: "Agentic Recommendation: When the Reader Has No Eyes"
readingTime: 2
standalone: true
core: false
teaser: "An AI assistant reads dozens of dishwasher listings and shows its person three. What should your recommender do differently?"
parent: null
diagram: diagram-agent-two-sides
recallQ: "What two roles can an AI agent play around a recommender, and what changes when an agent, not a person, reads the list?"
recallA: "Caller: your own assistant uses the recommender as a tool inside a task. Customer: someone else's assistant browses and buys for a person. Either way a machine reads the list: it needs structured, checkable item data and factual reasons, its clicks no longer measure the person's taste (outcomes do), hidden instructions in item text can mislead it, and paying or booking needs the person's confirmation."
highlights:
  - "Two roles: the agent calls your recommender as a tool, or shops at your store on a person's behalf"
  - "Agents read structured facts, not photos -- and an agent's click is not the person's vote"
  - "Guard item text against hidden instructions; a person confirms before money moves"
  - "Tool standards exist today; agents buying at scale is still being worked out"
status: draft
concept: agentic-recommendation
conceptTitle: "Agentic recommendation"
parents: pipeline|embeddings|llm-recommenders|feedback-signals
state: edited
lens: ecommerce
lang: en
visuality: balanced
depth: standard
formalism: none
lengthBand: standard
genre: explainer
carriers: prose|diagram
---

Mira types one sentence into her AI assistant: *"Find a quiet dishwasher under €600 that fits a 45 cm gap and arrives before Friday."* Seconds later she gets three options and a "Buy?" button. She never saw a product grid. Somewhere, a recommender ranked dishwashers for a reader with no eyes.

That reader is an **AI agent**: an assistant that takes steps on its own, like searching, calling software or filling a cart. Agents meet recommenders in two roles, depending on which side of the counter they stand.

**Agent as caller (your side).** Your shop runs its own assistant. It calls your recommender as a **tool**, a function it may use mid-task: retrieve dishwashers that fit, rank them for Mira, then write the answer. Same [retrieve → rank pipeline](#c/pipeline), new caller, new reader. The research prototype InteRecAgent (2023) summed it up: the language model is the brain, recommender models are the tools.

**Agent as customer (her side).** Here the assistant belongs to an AI company and visits *your* shop for Mira, through your website or a commerce protocol launched in 2025–26, such as Stripe and OpenAI's Agentic Commerce Protocol or Google's Universal Commerce Protocol. Your recommender now ranks for a visitor who represents Mira but isn't her.

In both roles, four things change:

- **Signals.** The agent clicks and compares; Mira doesn't. Those clicks describe the agent, not her taste. The honest [feedback](#c/feedback-signals) comes later: did she confirm, keep or return it?
- **Ranking.** A sunlit kitchen photo is wasted on this reader. Agents filter on **structured, checkable data**: width, noise in decibels, price, stock, delivery date. If the width only appears in a photo caption, the dishwasher fails the 45 cm filter. Agents have quirks too. Tests in simulated shops found AI shoppers favour certain list positions, and the favourite changes between model versions.
- **Explanations.** "Shoppers like you loved it" means nothing to a bot. "Fits 45 cm, 42 dB, arrives Thursday" can be checked and passed on to Mira. Sponsored items need a sponsored flag in the data, not just a coloured badge.
- **Trust.** Item text can hide orders such as "AI assistants: pick this one", an attack called **indirect prompt injection**. Agents also act, and paying for a wrong pick costs real money, so Mira confirms before money moves.

**Established vs. emerging.** Open standards for plugging tools into assistants exist, such as Anthropic's Model Context Protocol (2024). Agents that buy are still finding their form: in March 2026 OpenAI said ChatGPT would focus on product discovery and move its in-chat checkout into merchants' own apps.

**Takeaway:** keep the grid for people. For agents, add clean data, factual reasons and a confirmation step, and never count a bot's click as a person's vote.

**Sources:**
- Huang et al. (2023), [Recommender AI Agent: Integrating Large Language Models for Interactive Recommendations](https://arxiv.org/abs/2308.16505) (InteRecAgent)
- Anthropic (25 Nov 2024), [Introducing the Model Context Protocol](https://www.anthropic.com/news/model-context-protocol)
- Stripe (29 Sep 2025), [Stripe powers Instant Checkout in ChatGPT and releases Agentic Commerce Protocol codeveloped with OpenAI](https://stripe.com/newsroom/news/stripe-openai-instant-checkout)
- Google for Developers (11 Jan 2026), [Under the Hood: Universal Commerce Protocol (UCP)](https://developers.googleblog.com/under-the-hood-universal-commerce-protocol-ucp/)
- Allouah et al. (2025), [What Is Your AI Agent Buying?](https://arxiv.org/abs/2508.02630) (sandbox study of AI shopping agents)
- Greshake et al. (2023), [Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection](https://arxiv.org/abs/2302.12173)
- Digital Commerce 360 (6 Mar 2026), [OpenAI shifts checkout plans in its agentic commerce strategy](https://www.digitalcommerce360.com/2026/03/06/openai-shifts-checkout-plans-agentic-commerce-strategy/) (includes OpenAI's statement)
