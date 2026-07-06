---
id: cf-cs-tldr
type: spine
title: "Kolaborativní filtrování za minutu"
readingTime: 1
standalone: true
core: false
teaser: "Žádná magie: lidé s podobným vkusem už za tebe vybrali."
voice: explorer
parent: collaborative-filtering
recallQ: "How does collaborative filtering work?"
recallA: "Find people with similar taste → recommend what THEY liked that you haven't tried yet."
status: accepted
concept: collaborative-filtering
state: edited
lens: generic
lang: cs
visuality: text-first
depth: intro..standard
formalism: none
lengthBand: tldr
genre: explainer
carriers: prose
---

Představ si, že si v knihovně vždycky půjčuješ podobné knihy jako paní od vedle. Jednou má na stole něco, cos nikdy neviděl. Půjčíš si to? Nejspíš ano — **její vkus se zatím trefoval.**

Kolaborativní filtrování dělá přesně tohle, jen s miliony lidí najednou:

1. Najdi uživatele, kteří klikali, poslouchali a hodnotili **podobně jako ty**.
2. Podívej se, co se **jim** líbilo a **ty** jsi to ještě neviděl.
3. Doporuč to.

Systém přitom vůbec nemusí rozumět obsahu — nečte knihy, nezná žánry, nevidí obálky. Stačí mu **stopy chování**. Proto umí propojit věci, které by žádný katalog nespojil: třeba že fanoušci jednoho seriálu masově kupují určitou deskovku.

Slabina? Nová položka bez historie je pro CF neviditelná — tomu se říká studený start a řeší se to jinými signály.
