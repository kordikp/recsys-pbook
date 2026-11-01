# Recombee scénáře p-booku

Deliverable dle Recombee AI-assistant guide: každý povrch má pojmenovaný scénář.
Scénář se v Recombee zaregistruje sám při prvním požadavku, ale jeho logiku (a u segmentových
scénářů **segmentaci**) nastavuje [Recombee Admin UI](https://admin.recombee.com) — ne API.
Každá kniha má vlastní jména v `CONFIG.recombee.scenarios` (js/config.js); níže jsou výchozí.
Klient má u každého požadavku fallback, takže chybějící nebo nenastavený scénář nic
nerozbije — povrch jen zůstane prázdný nebo se ukáže lokální doporučení.

## Položky (items)

| Scénář | Klíč v configu | Typ (Admin UI) | Povrch v knize | Doporučená konfigurace |
|---|---|---|---|---|
| `homepage-personal` | homepagePersonal | Items to User | Domů → „Vybráno pro tebe" | personalizace, filter `'type' == "spine"` |
| `next-read` | nextRead | Items to User | Infinite feed (Číst) — první dávka; další přes **Recommend Next Items** | personalizace, rotace vypnutá |
| `search` | search | Search Items | Hledání (větev rc) | fulltext + personalizovaný rerank |
| `context-related` | contextRelated | Items to Item | Domů → „Protože tě zaujalo X", Číst → další | filter `'type' == "spine"` posílá klient |

## Segmenty (engine 7.13)

Segmentace zakládá `/api/sync-recombee` (property-based, zdroj items): **concept**, **chapter**, **lens**.

| Scénář | Klíč v configu | Typ (Admin UI) | Segmentace | Povrch v knize |
|---|---|---|---|---|
| `next-concept` | nextConcept | Item Segments to User | concept | „Další pro tebe": pořadí pojmů (0,5 váhy skóre), cache 10 min |
| `concept-tellings` | conceptTellings | Items to Item Segment | concept | podání prvního připraveného pojmu („Tohle podání ti vybralo Recombee") |
| `theme-for-you` | themeForYou | Composite: Item Segment → Items | chapter | Domů → „Téma pro tebe: kapitola" |
| `world-for-you` | worldForYou | Item Segments to User | lens | Domů → „Jiný svět" (bere první svět kromě `generic`) |
| `world-tellings` | worldTellings | Items to Item Segment | lens | sekce toho světa + odkaz na misi světa |
| `search-concepts` | searchConcepts | Search Item Segments | concept | karta „💡 Pojem · kapitola" nad výsledky hledání |

Klient posílá filtry sám: rozsah knihy (`'chapter' in {…} OR 'concept' in {…}`) jen u položkových
endpointů a v `resultSettings` composite; jazyk přes `rc.langFilter()` (kniha s
`languageFilter: 'strict'` dostává jen svůj jazyk).

## A/B (engine 7.13)

`CONFIG.recombee.abShare` (výchozí 1) = podíl zařízení, kterým doporučení a hledání servíruje Recombee
(větev `rc`); zbytek dostává lokální doporučování beze změny (větev `local`, kontrola). Interakce do
Recombee posílají obě větve. Větev je v `localStorage pbook-ab`, `?rc=1` / `?rc=0` ji připne.
Každý řádek logu nese `ab`; `/admin → Insights` porovnává větve (vracející se, hluboká čtení, mise)
a povrchy (zobrazení → kliky → dočtení přes `rec_shown` + `surface`).

## Interakce

- detailviews s `recommId` (atribuce) a `surface`; **view portions** (`/viewportions/`, jak daleko se blok
  dočetl, se `sessionId` a `recommId`); ratings, bookmarks.
- **purchases = úspěch**: recall s kvalitou ≥ 3, výzva bez řešení, hra s ≥ 70 % bez vypršení času.
  Pseudo-itemy `_event:*` se od 7.13 nezakládají (staré v DB filtruje `'type' != null` / `"spine"`).
- anonymní → účet přes **Merge Users** (`switchUser`).
- Stránkování feedu: `POST /recomms/next/items/<recommId>` — ~30 min platnost.
- Sync katalogu: po produkčním deployi `/api/sync-recombee` se `SYNC_SECRET` (GitHub Actions).

Poznámka: `homepage-voice` je legacy (voice systém nahradily facety).
