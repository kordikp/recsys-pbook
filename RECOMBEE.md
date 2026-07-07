# Integrating Recombee — a field manual for AI assistants

Written by an AI assistant after integrating Recombee into this repo — including every
mistake. Follow this and you skip a day of ghost-chasing. The API reference is at
[docs.recombee.com](https://docs.recombee.com); this file is the *operational* knowledge
that sits between the docs and reality.

## The one rule that would have saved us a day

**Recombee uses HTTP status codes semantically, and your proxy will pass them through.
Always read the response BODY before theorizing about a status.**

A `404` from Recombee usually does **not** mean "wrong URL". It means *"the entity you
referenced does not exist"* — and the body tells you exactly which one:

```json
{"message": "user property \"prefLens\" does not exist!"}   ← HTTP 404
```

We saw `POST /api/recs 404` in the browser console and investigated, in order: service
worker caches, Vercel deploy windows, path-based ad blocklists (we even renamed the
endpoint), edge regions — while the response body named the culprit from the first
minute. If your debugging surface only shows `status + URL`, you are debugging blind.
**Log `res.status` AND a snippet of `res.text()` at every Recombee call site.**

## Status → meaning cheat sheet

| Status | Body says | Actual meaning | Fix |
|---|---|---|---|
| 401 | invalid token/db | wrong `RECOMBEE_TOKEN`, wrong DB name, or token↔db mismatch | check env pair together — a valid token for the *wrong* DB is still 401 |
| 404 | `... property "X" does not exist` | you wrote to an **undefined property** | define it first (see below) |
| 404 | `item/user "X" does not exist` | referenced entity missing and you didn't allow creation | add `cascadeCreate: true` (or `!cascadeCreate` in set-values bodies) |
| 405 | `Method not allowed` | **newer clusters reject ALL GET requests** | use POST equivalents (see below) |
| 409 | duplicate | the write already happened | treat as success, don't retry |
| 400 | `Error in expression ... single quotes ... double quotes` | ReQL quoting: `'x'` = property access, `"x"` = string constant | fix the filter; also: filtering on an undefined property errors the same way |

## Define ALL properties before writing — items AND users

Recombee will not lazily create properties. Writing a value to an undefined property is
a 404 per request, forever, until someone defines it. There are **two separate property
namespaces** and it is easy to remember only one:

```
PUT /{db}/items/properties/{name}?type={string|int|double|boolean|timestamp|set|image}
PUT /{db}/users/properties/{name}?type=...
```

Make property definition an **idempotent part of your catalog sync** (re-PUT on every
sync run — it's cheap). Our bug: we defined 20+ item properties and zero user
properties; every profile write (`POST /users/{id}` with preference fields) then 404'd
in production while all our smoke tests — which only exercised recomms and item
endpoints — passed. **Test the call sites that actually fail, with their exact
payloads**, not the endpoints you find convenient.

## Sign server-side; browsers talk to YOUR proxy

The private token signs requests (HMAC-SHA1 over the full path **including** the
`/{db}` prefix and the query string, with `hmac_timestamp` appended; then
`&hmac_sign=<hex>`). Two consequences:

1. The token must never reach the browser → run a small server proxy
   (`api/recombee.js` here) that signs and forwards `{ endpoint, method, body }`.
2. If the endpoint carries query parameters, they must be in the signed string —
   sign the *final* path, then append the signature.

Proxy hygiene: pass through Recombee's status **and body** unchanged; add CORS; treat
`OPTIONS` yourself. Don't invent your own error envelope that hides the upstream
message (see the one rule above).

## Newer clusters reject GET — plan for POST-only

`GET /items/`, `GET /items/properties/` etc. return `405 Method not allowed` on newer
Recombee clusters. Don't build features on GET listing. To list/filter items with
properties, use a recomms call as the workhorse:

```
POST /{db}/recomms/users/{anyUserId}/items/
{ "filter": "'state' == \"community\"", "count": 200,
  "returnProperties": true, "cascadeCreate": true }
```

You get `{ recomms: [{ id, values: {...} }], recommId }` — map `values` to your shape.
Personalized order is a free bonus; for admin listings just ignore it.

## Catalog sync: use /batch/, or serverless will eat you

Serverless functions have execution limits (~10 s on Vercel Hobby). Syncing N items as
N sequential calls times out somewhere around lunch. Use the batch endpoint:

```
POST /{db}/batch/
{ "requests": [ { "method": "PUT", "path": "/items/item-1", "params": {...} }, ... ] }
```

One signed request, hundreds of operations. Our 200+ item catalog syncs in seconds.

## Interactions: small print that matters

- **`cascadeCreate: true` on every interaction** (detail views, ratings, bookmarks) —
  otherwise interactions for not-yet-known users/items 404.
- **Send `recommId` back** with interactions that resulted from a recommendation —
  that's how Recombee attributes success to the model and how your A/B numbers make sense.
- **Scenario names** (`scenario: "homepage-personal"`) auto-register on first use and
  become configurable in the Admin UI — use stable names from day one.
- Client-side retry policy: **any HTTP response settles the request** (only network
  errors and 5xx are worth retrying, with a small cap). We had an offline queue re-POSTing
  a 404 forever — console spam that masked the real signal.

## Anti-patterns (each one cost us something)

1. **Testing the wrong endpoint.** Smoke tests hit recomms; production failed on user
   property writes. Replay the *failing call site's exact payload* server-side first.
2. **Hardcoded DB fallbacks.** `process.env.RECOMBEE_DB || 'some-db-name'` masks env
   mismatches — in one place we defaulted to a *different database* than production used.
   Fail loudly when env is missing.
3. **Error envelopes that discard the upstream body.** `{"error": "request failed"}`
   is where debugging goes to die.
4. **Assuming 404 = routing.** In Recombee-land, 404 = "entity doesn't exist" far more
   often than "wrong path".
5. **GET-based features.** They work on older clusters and die on newer ones — POST-only
   from the start.
6. **Infinite client retries on 4xx.** A 4xx is an answer, not an outage.
7. **Blaming the network before printing the body.** (Yes, we renamed an endpoint to
   dodge a hypothetical blocklist. The body knew better.)

## Bootstrap checklist for a new integration

```
[ ] env: RECOMBEE_DB + RECOMBEE_TOKEN (+ region host, e.g. rapi-eu-west) — no code defaults
[ ] server proxy with HMAC signing; body+status passthrough; private token server-side only
[ ] property definitions (items AND users) as idempotent part of sync
[ ] catalog sync via /batch/
[ ] interactions with cascadeCreate + recommId attribution
[ ] listing/filtering via POST recomms with returnProperties (no GETs)
[ ] every call site logs status + body snippet on non-OK
[ ] retry: network errors & 5xx only, capped; 409 = success
[ ] smoke test = replay of every distinct call-site payload, not just recomms
```
