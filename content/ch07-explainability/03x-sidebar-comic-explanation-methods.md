---
id: comic-explanation-methods
type: spine
title: "Can I See How You Made That Choice?"
readingTime: 1
standalone: true
core: false
teaser: "A four-panel comic: Intrinsic logic is readable; post-hoc tools approximate black boxes and may lose fidelity."
voice: explorer
parent: explanation-methods
recallQ: "What is the difference between intrinsic and post-hoc explainability methods?"
recallA: "Intrinsic methods use models that are inherently interpretable (decision trees, linear models, k-NN). Post-hoc methods explain an already-trained black-box model after the fact (LIME, SHAP, counterfactual explanations). Intrinsic methods are faithful by construction; post-hoc methods are approximations."
status: accepted
concept: explanation-methods
state: edited
generator: gpt-5.6-sol
lens: generic
lang: en
visuality: visual-first
depth: intro..standard
formalism: none
lengthBand: tldr
genre: comic
carriers: prose|image
---

![Four-panel comic: a glass-box recommender shows the rules behind its ramen pick; a black box only says “It’s complicated”; an outside explainer such as LIME or SHAP changes one input at a time and concludes “mostly because you’re hungry” — probably right, but it never saw inside.](images/comic-explanation-methods.svg)

*Intrinsic logic is readable; post-hoc tools approximate black boxes and may lose fidelity.*