# Security model of the p-book engine

Who may do what through the serverless functions in `api/`, and what each one trusts. Read this
before you add an endpoint or a new kind of row. Last reviewed 2026-10-31 (engine 7.11.0).

## Principles

- **The browser is not trusted.** Anything a client sends can be forged: user ids, book names,
  amounts, hosts. A server decision may rest only on a session token, the editor key or a secret.
- **One table, two kinds of rows.** Readers' events and server-owned records share the Supabase
  table `interactions`. A client writes events through `/api/log`. Server-owned rows are written
  only by their own endpoint, and other endpoints trust them. `/api/log` therefore refuses every
  server-owned type and event (`SERVER_TYPES`, `SERVER_EVENT` in `api/log.js`).
- **Public reads carry no personal data.** E-mails and account ids become pseudonyms. Readers'
  own words are hidden without the editor key, and wallet, failed-login and profile rows are not
  listed at all.
- **Errors do not leak.** Functions answer `server error` (or the model's HTTP status) and write
  details to the Vercel log.

## Rows in `interactions`

| Rows (type / event) | Written by | Trusted by |
|---|---|---|
| `wallet` / `wallet_init`, `wallet_earn`, `wallet_spend`, `wallet_trial` | `api/wallet.js`, `api/generate.js` | the ⚡ balance, gifts, trials |
| `deck` / `deck_saved`, `deck_deleted` | `api/decks.js` | class galleries (SlAIdy decks) |
| `draft` / `draft_shared`, `draft_comment`, `draft_vote`, `draft_react`, `draft_unshared` | `api/drafts.js` | class galleries, leaderboards |
| `proposal` / `proposal_saved`, `proposal_deleted` | `api/proposals.js` (editor key) | the "proposed" cards readers see |
| `auth` / `auth_login_failed` | `api/auth.js` | the login brake |
| `contact`, `author_message`, `teacher_survey` | `api/log.js`, normalised from a form | editors (`?contacts=1`, pilot report) |
| everything else: `event`, `detailview`, `rating`, `bookmark`, `content`, `reflection`, `profile`… | the reader's browser through `/api/log` | statistics only, never a decision |

## Endpoints

| Endpoint | Anyone | Needs |
|---|---|---|
| `POST /api/log` | writes reader events (≤ 256 kB, no server-owned rows) | — |
| `GET /api/log` | the latest 2,000 rows, pseudonymised, without free text, wallet or profile rows | the editor key for full rows |
| `GET /api/log?usage=1` | views and likes per item (counts only) | — |
| `GET /api/log?stats=1` | the last computed reader counts | the editor key to recompute (it scans the table) |
| `GET /api/log?contacts=1` | — | the editor key |
| `POST /api/auth` | register, log in (10 wrong passwords in 15 min lock that account for a while) | the session token for `load`, `save`, `update` |
| `POST /api/wallet` | — | the session token (balance, earn, gift, redeem, cancel) |
| `POST /api/generate` | — | ⚡ in the wallet; an anonymous device gets `WALLET_TRIALS` basic tries (3), and one network at most `WALLET_TRIALS_NET` a day (120) |
| `POST /api/boss` | grading (free; inputs are capped) | — |
| `GET/POST /api/decks`, `/api/drafts` | anyone who knows the class code or the random id (link sharing, like a shared document) | — |
| `POST /api/proposals` | — | the editor key |
| `POST /api/recombee` | only allowed calls from allowed origins (`PBOOK_ORIGINS`) | the editor key to promote a telling to `edited` or `core` |
| `POST /api/sync-recombee` | — when `SYNC_SECRET` or the editor key is configured | `SYNC_SECRET` or the editor key |
| `/api/mcp` | read-only access to public content | — |

The editor key is `PBOOK_ADMIN_KEY`, sent in the `X-Pbook-Admin` header. `/admin` asks for it once
(🔑 Editor key) and keeps it in that browser.

## The AI gateway

A book without its own model key forwards `/api/generate` and `/api/boss` to the gateway
(`PBOOK_GATEWAY_URL`, default `recsys-pbook.vercel.app`). The forwarding book has already charged
its reader, so the gateway skips the wallet for such a request. That claim must be proven:

- With `PBOOK_GATEWAY_SECRET` set to the same value on the gateway and on every forwarding book,
  the request carries it in `x-pbook-gateway`, and only such a request skips the wallet.
- Without the secret, only the gateway itself believes `sourceHost` (the old behaviour). A book
  with its own key never believes it. Before 7.11.0 any deployment did, so anyone could generate
  for free by adding `sourceHost` to a request.

**To close the gateway completely:** set the secret on `recsys-pbook` and on every book without a
key (2026-10-31: `pbook-internet`, `polirural-pbook`, `mvi-pbook`, `pbook-rozpocet`). Deploy those
books with engine 7.11.0 or newer first, then the gateway.

## Supabase

- The functions use only `interactions` and `user_profiles`. The schemas are
  `setup-interactions-table.sql` and `setup-profiles-table.sql`.
- Use the **service_role** key as `SUPABASE_KEY`, mark it **Sensitive** in Vercel, and keep RLS on
  with **no policies**. Then nobody but the functions can read the tables, even with the project
  URL and the public anon key. The old `setup-profiles-table.sql` created an "allow all" policy for
  the anon key; drop it (`DROP POLICY "Allow all via anon key" ON user_profiles;`) once the
  functions use the service_role key.
- Passwords are scrypt with a salt. Old unsalted hashes are re-hashed at the next login. Session
  tokens are random 32-byte values, compared in constant time.

## Known limits (accepted for now)

- **Rate limits.** There is none per IP apart from Vercel's own bot protection and the brakes
  above. `/api/boss` is free and unauthenticated; its inputs are capped and its output is a fixed
  grading schema.
- **Class sharing is link sharing.** Anyone with a class code can list its decks and drafts, and
  anyone with a deck id can save a new revision or delete it. That is deliberate for classes. Do
  not put anything private in a deck.
- **Earning ⚡ is claimed by the client** within a daily cap enforced on the server. Several
  accounts can pool their earnings as gifts, which are capped per day for the person receiving them.
- **Session tokens do not expire.** A new login replaces the token, which signs out the other devices.
- **Passwords:** the minimum is 4 characters (readers are children). The login brake slows down
  guessing.
