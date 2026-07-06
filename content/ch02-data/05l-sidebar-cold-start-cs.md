---
id: item-cold-start-cs
type: spine
title: "Studený start položky: první den nové položky"
readingTime: 2
standalone: true
core: false
teaser: "Úplně nová položka nemá žádné interakce. Jak jí doporučovací systém dá férový první den?"
voice: universal
parent: item-cold-start
recallQ: "Proč kolaborativní filtrování nedokáže doporučit úplně novou položku a jaké dva mosty to řeší?"
recallA: "Kolaborativní filtrování potřebuje vzory společných interakcí, které nová položka nemá; obsahová podobnost (metadata) ji umístí vedle známých položek a malý průzkumný rozpočet jí koupí první skutečné interakce."
status: accepted
concept: item-cold-start
state: edited
lens: generic
lang: cs
visuality: text-first
depth: standard
formalism: none
lengthBand: standard
genre: explainer
carriers: prose
---

Každá položka v katalogu byla někdy nová. A první den jí nejoblíbenější trik doporučovacích systémů vůbec nepomůže.

**Kolaborativní filtrování žije ze vzorů společného chování** — „lidem, kterým se líbilo tohle, se líbilo i tamto." Jenže úplně nová položka žádné interakce nemá, takže v ní nejsou žádné vzory k nalezení. Pro algoritmus je neviditelná. Tomu se říká **studený start položky** (item cold start) — a není to okrajový případ: v rychle se měnících katalozích (zprávy, pracovní inzeráty, móda) je studená *pořád* podstatná část nabídky.

Přes první dny ji přenesou dva mosty:

**Most 1 — obsahová podobnost.** Nová položka sice nemá historii chování, ale není prázdná: má název, popis, štítky, obrázek. Z těchto atributů systém spočítá, kam položka *patří* — vedle kterých známých položek by seděla. Nováček pak může „jet na pověst svých sousedů": ukáže se lidem, kteří milují to, čemu se podobá. Podobnost podle toho, **co položka JE**, ne podle toho, kdo na ni klikl.

**Most 2 — řízený průzkum.** Obsahová podobnost je jen odhad; potvrdit ho můžou jedině skutečné interakce. Systém proto novince věnuje malý **průzkumný rozpočet**: omezený počet férových zobrazení — dost na poctivý signál, ne tolik, aby slabá položka kazila doporučení všem. Každý klik nebo nákup v tomhle okně má mimořádnou cenu: mění odhad v důkaz.

Jakmile se prvních pár interakcí nasbírá, převezme řízení kolaborativní signál. Umění je v předávce: opírat se o obsah, dokud chování neexistuje, a plynule přepnout, jakmile přiteče.
