---
id: recommendation-presentation-tldr
type: spine
title: "Presenting Recommendations in 30 Seconds"
readingTime: 1
standalone: true
core: false
teaser: "Same model, same list: moving the row or changing its label still changes what people buy, and what the model learns next."
parent: recommendation-presentation
recallQ: "Name two presentation choices that change a recommender's results without changing the model, and explain why they also affect the training data."
recallA: "For example where the row is placed and how many items it shows, or its label and images. They change which items get seen and clicked; the model learns from those clicks, and top positions get clicked partly because they are on top, so the layout leaks into the next model unless the position of each shown item is logged and accounted for."
status: draft
concept: recommendation-presentation
state: edited
lens: ecommerce
lang: en
depth: intro..standard
formalism: none
visuality: text-first
lengthBand: tldr
genre: explainer
carriers: prose
---

An online shop moves its "Customers also bought" row from below the reviews to right under the price. Same model, same list, different sales.

**Presentation** is part of the recommender: where the row sits, how many items fit on screen, its label ("Because you viewed this tent"), the product images, and a "Not interested" button that must actually change the list.

It also shapes what the model learns. People click the first items partly because they come first (**position bias**). If the shop logs only "clicked or not", the next model learns that whatever stood on top was good. So log where each item was shown and let training account for it.

Test one layout change at a time, separately from model changes, so you know what worked.
