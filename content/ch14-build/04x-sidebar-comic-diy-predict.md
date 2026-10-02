---
id: comic-diy-predict
type: spine
title: "Let the Neighbors Pick Dinner"
readingTime: 1
standalone: true
core: false
teaser: "A four-panel comic: Predict an unseen rating by averaging nearest neighbors' ratings; test on held-out ratings."
voice: explorer
parent: diy-predict
recallQ: "How do you predict a rating for an unseen item?"
recallA: "Find 2-3 most similar users who rated it → compute weighted average of their ratings. Above threshold = recommend."
status: accepted
concept: diy-predict
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

![Let the Neighbors Pick Dinner — a four-panel comic](images/comic-diy-predict.svg)

*Predict an unseen rating by averaging the ratings of the nearest (taste) neighbors; recommend it if it clears the bar (here 4★), and test predictions on held-out real ratings: within 1 star is good.*