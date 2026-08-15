# Recombee scénáře p-booku

Deliverable dle Recombee AI-assistant guide: každý povrch má pojmenovaný scénář.
Scénáře **nelze založit přes API** — zakládají se v [Recombee Admin UI](https://admin.recombee.com)
(databáze sdílená s dospělou recsys knihou; env `RECOMBEE_DB` na Vercelu).
Klient má u každého požadavku fallback bez scénáře, takže chybějící scénář nic
nerozbije — jen se nevyužije jeho vyladěná logika.

| Scénář | Typ (Admin UI) | Povrch v knize | Stav | Doporučená konfigurace |
|---|---|---|---|---|
| `homepage-personal` | Items to User | Procházet → „Vybráno pro tebe" | ✅ existuje | personalizace (recombee:personal), filter `'type' == "spine"` |
| `next-read` | Items to User | Infinite feed (Číst) — první dávka; další stránky přes **Recommend Next Items** | ✅ existuje | personalizace + rotace VYPNUTÁ (rotationRate nepoužívat), filter `'type' == "spine"` |
| `search` | Search Items | Hledání | ✅ existuje (search-items) | fulltext + personalizovaný rerank |
| `related-item` | Items to Item | Procházet → „Protože sis přečetl/a X" | ❌ **založit** | podobnost obsahu (beeformer/ReQL), filter `'type' == "spine"`, vyloučit sám sebe |
| `concept-tellings` | Items to Item | „Další podání" konceptu (budoucí) | ❌ volitelné | filter `'concept' == context_item.'concept'` |
| `map-suggest` | Items to User | Cesta/mapa — co číst dál (budoucí) | ❌ volitelné | boost nepřečtených core |

Poznámky k datům:
- Pseudo-itemy `_event:*` (research log přes purchases) filtrovat všude: `'type' != null` nebo filter na `"spine"`.
- Interakce: detailviews (s `recommId` atribucí per-item), ratings, bookmarks; anonymní → účet přes **Merge Users** (`switchUser`).
- Stránkování feedu: `POST /recomms/next/items/<recommId>` — řetězí se, ~30 min platnost, každá dávka = nové (dosud nedoporučené) itemy.
- Sync katalogu: GitHub Actions → produkční `/api/sync-recombee` (autoritativní env), spouští se změnou `content/**`.
