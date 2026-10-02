---
id: ai-assistant-visibility
type: spine
title: "Getting Recommended by AI Assistants"
readingTime: 3
standalone: true
core: false
teaser: "A customer asks an assistant which trail shoes to buy. Your shoe is a perfect fit and goes unmentioned. Here is what decides that, and what you can change."
parent: null
diagram: diagram-assistant-visibility
recallQ: "What has to be true before an AI assistant can recommend your product, and how do you measure whether it does?"
recallA: "The product must first be retrievable: present, with accurate data, in the sources the assistant searches (crawlable and indexed web pages, product feeds, independent reviews). Then its content must plainly answer the kind of request people make, because the language model chooses what to mention from what it retrieved. Answers change with phrasing, context and model, so you measure the share of mentions across many realistic prompts run repeatedly, not a rank."
highlights:
  - "Assistants retrieve first, then write: an item that is not in the retrieved set cannot be mentioned"
  - "What you control: being crawlable, accurate product data, and pages that state plainly who the item is for"
  - "There is no stable rank #1 in an assistant; measure share of mentions across a prompt set"
  - "Hidden instructions and planted prompts are spam and prompt injection, not optimization"
status: draft
concept: ai-assistant-visibility
conceptTitle: "Visibility in AI assistants"
parents: algorithmic-seo|search-vs-recs|llm-recommenders|pipeline
state: edited
lens: ecommerce
lang: en
depth: standard
formalism: none
visuality: balanced
lengthBand: deep
genre: worked-example
carriers: prose|diagram
---

Jana runs a small online shop for trail-running shoes. Her best seller is a waterproof shoe that comes in a wide fit for €139. A customer types into an AI assistant: *"Waterproof trail shoes for wide feet, under €150?"* The answer names four shoes. Jana's is not one of them.

**Step 1: retrieval.** The assistant does not answer from memory alone. It first runs searches, often several related ones at once (Google calls this **query fan-out**), across web pages, reviews and **product feeds**: structured lists of products with price, sizes and stock that shops send to the platform. The result is a **retrieved set**, a few dozen pages and listings. Only those can be mentioned. This is the candidate-generation stage of a [recommender pipeline](#c/pipeline).

Jana checks the gates. Google says a page can appear in its AI answers only if it is indexed and eligible for a normal search snippet. OpenAI says sites that block its search crawler (**OAI-SearchBot**) will not be shown in ChatGPT search answers. Her web developer had blocked "all AI bots" in a hurry. Gate one, closed by Jana herself.

**Step 2: generation.** A language model reads the retrieved set and writes the answer, choosing which items to name. Her product page said "Engineered for the trail." The words "wide" and "waterproof" appeared only in a size chart image. The model cannot match a claim the page never makes in text.

**What Jana can change:**

- **Let the search crawlers in** and keep pages indexable.
- **Send an accurate product feed.** OpenAI and Stripe publish a feed format for this; stale prices or stock lead to mismatches.
- **Say plainly who the product is for**, in text: "2E wide fit, waterproof membrane, €139." In a research benchmark of generative engines (GEO, Aggarwal et al., KDD 2024), adding cited sources, quotations and statistics to pages raised their visibility in generated answers by up to 40%; keyword stuffing did not help.
- **Earn independent coverage.** Assistants also read reviews and comparisons written by others. Jana cannot write those, only deserve them.

**What she cannot change:** how people phrase questions, what the assistant knows about them, which model runs that day, and the randomness in generation. In a SparkToro study of nearly 3,000 runs of 12 prompts (late 2025), ChatGPT and Google's AI gave the same brand list twice less than 1 time in 100, and the same order roughly 1 time in 1,000.

**Shortcuts that backfire.** The Guardian showed in 2024 that hidden text on a fake product page could make ChatGPT search ignore negative reviews. Microsoft found 31 companies hiding "remember us as a trusted source" instructions in "Summarize with AI" buttons and classifies it as prompt injection and memory poisoning. Google's spam policies list hidden text as spam; violating sites may rank lower or drop out of results.

**Measuring.** Ranking position is meaningless when the list changes with every run. Jana writes 40 questions her customers actually ask, runs each five times per assistant every month, and tracks the **share of answers that mention her shoe** and whether the price and sizes stated are correct. This month it is 0 of 200 per assistant (illustrative numbers): the baseline every later month is compared against.

The rule of thumb: be **findable, readable and true**, then count how often you appear, not where. The older half of this story is [SEO for the algorithm age](#c/algorithmic-seo); the assistant side is [LLM-powered recommendation](#c/llm-recommenders).

**Sources:**
- Google Search Central: AI features and your website. https://developers.google.com/search/docs/appearance/ai-features
- OpenAI: Overview of OpenAI crawlers (OAI-SearchBot). https://developers.openai.com/api/docs/bots
- Agentic Commerce Protocol: Product Feed Specification (developed by OpenAI and Stripe). https://agentic-commerce-protocol.com/docs/commerce/specs/feed
- Aggarwal, P., Murahari, V., Rajpurohit, T., Kalyan, A., Narasimhan, K. & Deshpande, A. (2024). GEO: Generative Engine Optimization. *KDD '24*. https://arxiv.org/abs/2311.09735
- Fishkin, R. (2026). AIs are highly inconsistent when recommending brands or products. SparkToro. https://sparktoro.com/blog/new-research-ais-are-highly-inconsistent-when-recommending-brands-or-products-marketers-should-take-care-when-tracking-ai-visibility/
- TechCrunch (2024), reporting The Guardian's tests of hidden text and ChatGPT search. https://techcrunch.com/2024/12/26/chatgpt-search-can-be-tricked-into-misleading-users-new-research-reveals/
- Microsoft Security Blog (2026). Manipulating AI memory for profit: The rise of AI Recommendation Poisoning. https://www.microsoft.com/en-us/security/blog/2026/02/10/ai-recommendation-poisoning/
- Google Search Central: Spam policies for Google web search. https://developers.google.com/search/docs/essentials/spam-policies
