---
id: comic-vasp
type: spine
title: "Two Doormen, One Very Selective Door"
readingTime: 1
standalone: true
core: false
teaser: "A four-panel comic: VASP multiplies path scores so agreement filters false positives; linear anchors sparse data."
voice: explorer
parent: vasp
recallQ: "Why does VASP use Hadamard product instead of addition to combine linear and deep paths?"
recallA: "Hadamard (element-wise multiply) acts as logical AND — both paths must agree, filtering false positives. Addition acts as OR — either path can contribute, amplifying false positives."
status: accepted
concept: vasp
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

![Two Doormen, One Very Selective Door — a four-panel comic: two doormen, Routine (the linear model) and Vibes (the deep model), score each guest; adding their scores lets a stranger in, multiplying keeps him out unless both agree](images/comic-vasp.svg)

*VASP multiplies the two models' scores instead of adding them, so an item gets through only when both agree. That filters out false positives. On sparse data, the simple linear model is the one you can't lose.*