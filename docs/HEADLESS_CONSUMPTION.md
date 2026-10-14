# Headless content consumption — current state

**Question this answers:** can `novusexchange.com` consume content from this CMS
without a human clicking in the UI?

**Revision:** `77d1f3b`. Method: source/migration inspection plus **read-only**
live probes against the project's PostgREST and Storage APIs using the
publishable key already public in `.env`. No writes were attempted.

**Provenance:** **[V]** = independently re-verified by the author of this
document. **[A]** = reported by the automated audit pass, not separately
re-verified.

---

## Verdict

**The publishing direction is wired. The consumption direction is not — with one
large exception that is easy to miss.**

There is **no anonymous read path to the CMS-managed `posts` table**, and the
only outward pipe is a generic outbound webhook whose receiver the site owner
must build. **However, production already exposes an anonymously readable
`articles` table containing 4 real Novus Exchange articles — and this repository
neither creates, reads, nor writes it.** So "the website can read articles
today" is true, but for a table the CMS does not manage.

That gap matters more than the missing API, because it means the content the
live site shows and the content the CMS edits are **two disconnected systems**.

---

## 🔴 The discovery: an untracked public `articles` API

**[V] Confirmed live:**

```
GET /rest/v1/articles?select=id,title,category,publish_date,read_time  -> 200, 4 rows
GET /rest/v1/authors?select=id,name,bio                                -> 200
```

| id | title | category | publish_date | read_time |
|---|---|---|---|---|
| 7 | The 4% Isn't the Story: What October's Price Cap Actually Does to Your Bill | Economics | SEPTEMBER 28, 2026 | 6 |
| 10 | From Hormuz to Your Bills: How the Oil Shock Reaches UK Households | Economics | OCTOBER 4, 2026 | 22 |
| 9 | The Bet That Stopped a Nation | Geopolitics | OCTOBER 4, 2026 | 19 |
| 11 | Sixteen Days to the Budget: What Is Locked In, What Is Still Open | Economics | OCTOBER 11, 2026 | 26 |

`authors` returns `{"id":"marcio-novus","name":"Marcio Novus","bio":
"Investigative journalist and founder of Novus Exchange."}`.

**These are real, current Novus Exchange articles, not fixtures.**

What is *not* true of them:

- **[V] No migration creates or alters `articles` or `authors`.** Zero matches
  across all 41 migrations. They were created outside change control (dashboard).
- **[V] No code in `src/` or `supabase/functions/` reads or writes either
  table.** Zero references to `from("articles")` or `from("authors")`.
- They nonetheless appear in the generated types
  (`src/integrations/supabase/types.ts:17-87`), which is how a table with no
  migration ends up looking first-class to the app.
- Their `category` values (Economics, Geopolitics) overlap the CMS's own
  `WEBSITE_CATEGORY_BY_DAY` map (`src/utils/scheduling.ts:138-146`) — consistent
  with this being the *intended* public store for the website, but populated by
  some process outside this repository.

**Corroborating evidence that migrations are not a faithful mirror of
production:** `invitations` **404s** on the live API even though a migration
creates it (`20260222000002:19`). So the repo's migrations are neither necessary
nor sufficient to describe production. This is the same class of drift as the
`project_settings`/`subscribers` finding in
[READINESS_GAP_ANALYSIS.md](./READINESS_GAP_ANALYSIS.md).

**Decision required (yours, not mine):** is `articles`/`authors`
**(a)** the real public store, to be brought under migrations and written by the
CMS, or **(b)** a leftover to be dropped?

### ✅ RESOLVED 2026-10-14 — it is (a), the real public store

The owner confirmed it, and the site's own source confirms it. Reading the
**separate** site repository (`D:\01_Workspaces\apps\content_hub\novus-exchange-v4`,
package name `novus-exchange` — not this repo, and not modified):

- **`services/articleService.ts:116`** is the only content reader:
  `fetch(`${url}/rest/v1/${config.tableName}?select=*&order=id.asc`)` with
  `tableName: "articles"` (`:39`). Consumed by
  `components/ArticlesSection.tsx:49`.
- **[V] The site never touches the CMS tables.** A repo-wide search for
  `post_platforms`, `from('posts')` and `/rest/v1/posts` returns **zero matches**.
  The two systems are unconnected at code level, exactly as the owner described.
- The site's Supabase URL and anon key are **hardcoded fallbacks** in its source
  (`articleService.ts:33-34`), which is why the anon key is by design public.

So the target for "the CMS feeds my website" is a bridge into `public.articles`,
not a read API over `posts`. **Option E** below is the answer; A/B/C are moot
until that bridge exists.

### Two traps the site's own documentation sets

1. 🔴 **The handoff doc's RLS SQL would make the public content table
   world-writable.** `HANDOFF_DOCUMENTATION.md:248-253` tells the reader to run:
   ```sql
   CREATE POLICY "Enable insert for authenticated users or API keys"
   ON public.articles FOR ALL USING (true) WITH CHECK (true);
   ```
   Combined with the anon key hardcoded in the site's source, that policy would
   let **anyone** insert, update and delete articles on novusexchange.com. The
   live database does **not** have it — an `INSERT` probe returns
   `42501 new row violates row-level security policy` (see below) — so the
   database is currently safe and **the document is the hazard**. Do not run that
   block. It appears only in markdown, not in any `.sql` file, so nothing will
   apply it automatically.
2. 🔴 **The in-browser editor cannot actually persist.** "Method 1: Direct
   In-Browser Live Feed" promises the site updates for everyone, but
   `articleService.ts:211-230` (`syncAllArticlesToSupabase`) POSTs with the **anon
   key**, and `saveLocalArticles:167` swallows the failure
   (`.catch(() => {})`). With no anon write policy, **"Save Article & Update
   Feed" only writes that one browser's `localStorage`.** It looks like it worked
   and is invisible to every other visitor and device.

### Integration mismatches to resolve before a CMS → `articles` bridge

The two schemas are not compatible as-is. Concretely, from the live table and the
site's reader:

| Need | Site requires | CMS `posts` has | Gap |
|---|---|---|---|
| `category` | Free text, filtered against a fixed list: `All, Illustrated Features, Brazil, Geopolitics, Economics, Tech-AI, Green-Tech, CSR` (`ArticlesSection.tsx:90-99`) | `WEBSITE_CATEGORY_BY_DAY` emits Geopolitics, Economics, Media, Technology, Security, Climate, Corporate Social Responsibility | **Only Geopolitics and Economics overlap.** 5 of 7 CMS categories would be unfilterable (visible only under "All"), and the site's Brazil/Tech-AI/Green-Tech/CSR would never be produced. |
| `read_time` (int) | Rendered as "14 MIN READ" | Nothing | Must be computed |
| `publish_date` **and** `date`, both TEXT | e.g. `"OCTOBER 11, 2026"` | Only `scheduled_at`/`published_at` (timestamptz) | Must be formatted, and the duplicated pair populated |
| `author_id` (text → `authors.id`) | `sanitizeArticle` (`articleService.ts:51-58`) does **substring** matching: contains `marcio` → Marcio, else contains `novus` → Novus AI, else the *bundled seed article's* author | `user_id` (uuid) | Needs an explicit mapping. **Note the `authors` table is never queried** — display uses a hardcoded `AUTHORS` map, so a NEW author row would silently display as the wrong person. |
| `image_url` | Cloudflare R2: `pub-a4ca64677c824a50bcedcd900f35087c.r2.dev/<dd-mm-yyyy>/<file>`; inline figures are Markdown `![](url)` inside `content` | Supabase Storage `post-images` (public) | Both are public URLs so either works, but R2 uploads need the owner's explicit OK per upload |
| `content` | 29k–34k characters, Markdown, "Editor's note" opening line, `### CHAPTER N:` headings | Free text | Editorial convention, not a schema problem |
| **live-ness** | **No status column — any inserted row is live immediately** | Full draft → review → scheduled flow | 🔴 **A bridge must be an explicit human action, never automatic.** A direct insert makes a draft or an AI draft publicly live on the site. |

### Ordering trap

Display order is **`id` ascending** and nothing re-sorts it:
`articleService.ts:141` is the only `sort(` in the site repo, and
`ArticlesSection.tsx` renders the list as given. `order=id.asc` (`:116`) agrees.
So a newly inserted row with a high `id` renders **last**, and the current newest
Supabase article (id 11) already renders *after* older bundled items. The 6
bundled dossiers from `data/articlesData.ts` occupy ids 1–6 and are **not in the
database at all**, so they always lead the feed. "Insert a row and it goes live"
is true; "…and appears at the top" is not. Sorting by `publish_date` (or by a
numeric date) on the site side is the small fix.


---

## The CMS-managed path is closed to the public — definitively

- **[V]** `GET /rest/v1/posts?select=id&limit=1` → **401**
  `{"code":"42501","message":"permission denied for function has_role"}`. It
  fails *closed*, not with an empty result. The cause is that `has_role` EXECUTE
  was revoked from `anon` (`20260503142554:41`), so anon cannot even evaluate
  the policy.
- **[A]** RLS is enabled on `posts` (`20260126144110:51`); the original policies
  require `auth.uid() = user_id` with `user_id NOT NULL` (`:13`, `:56-70`), and
  all four commands were deliberately re-created `TO authenticated`
  (`20260503150231:8-23`) after dropping the public-role "Admin Master Access"
  policy (`:6`).
- **[A] Zero `USING (true)` across all 41 migrations.** The only `TO anon`
  policy in the repository is the newsletter *insert* (`20260509172628:40-42`).
- No edge function serves content outward. All 15 are enumerated in
  `supabase/config.toml:1-61` and every one is generation, publishing, OAuth,
  billing or telemetry. The closest to a read API, `publish-due-posts`, requires
  the cron secret or a service-role bearer and returns only
  `{ok, published, results}`.

## `src/data/platforms/api.json` is dead config

**[V]** It declares `"platform": "REST API"`, `"icon": "webhook"`,
`"description": "Headless API Distribution Channel"` and a full 4-period posting
schedule — the *intent* to have a headless channel existed. But
`src/utils/scheduling.ts:10-17` statically imports the **8** real platform files
and not this one; `PlatformKey` (`:19`) has no `api`; `normalizePlatform`
(`:92-95`) returns `null`; the builder skips nulls (`:109`). A repo-wide search
for `api.json` / `REST API` matches only the file itself. It is not a publishing
target, not in `platform_type`, and referenced by nothing.

## Website delivery today = a generic outbound webhook

`publish-due-posts` runs every minute via `pg_cron`
(`20260601130235:61-74`) and claims work atomically through `claim_due_posts`
(`20260918000200:31-72`). `DIRECT_PLATFORMS = {linkedin, twitter}`
(`index.ts:15`); **every other platform, including `website`, takes the webhook
branch** (`:144-179`):

- loads `webhook_configs` by `user_id` + `is_active` (`:122-123`)
- matches `!w.platforms?.length || w.platforms.includes(platform)` (`:146-147`) —
  **an empty `platforms` array means every platform**
- https-only SSRF guard, 8 s abort, `redirect:"error"`
- operator-supplied headers from the `headers` JSONB
- body: the shared envelope below

**The delivery contract is now defined once, in
`supabase/functions/_shared/publishDelivery.ts`**, and imported by *both*
`publish-due-posts` and `content-pipeline`. This was fixed on 2026-10-14: the two
paths previously sent **different** envelopes — `post.publish` with a top-level
`platform` in one, `post.published` with a nested `platforms` array in the other —
so a receiver written against one silently mishandled the other. Verified on the
wire, not just in source:

```json
{
  "event": "post.publish",
  "delivery_id": "<post-id>:<platform>",
  "platform": "website",
  "post": {
    "id": "…",
    "title": "…",
    "content": "… (already truncated to this platform's caption limit)",
    "excerpt": null,
    "tags": [],
    "type": "text",
    "coverImageUrl": null,
    "scheduledAt": null
  },
  "timestamp": "2026-10-14T13:04:54.306Z"
}
```

Three parts of that are new and matter for a receiver:

- **`delivery_id` is a stable idempotency key** (`postId:platform`), deliberately
  *not* random, so a retry carries the same key and the receiver can de-duplicate
  instead of double-publishing.
- **`type`** is included because Instagram cannot publish text-only and needs to
  know whether a delivery is a feed post, a Reel or a story.
- **`content` is truncated per platform** before sending. Nothing used to
  truncate: a long article hard-failed LinkedIn (3000) and Instagram (2200) while
  X was silently cut to 280. A cut caption now ends in `…` so it is visibly cut.

The envelope and the truncation behaviour are pinned by
`src/utils/publishPayloadParity.test.ts` (which imports the shared module
directly) and asserted end-to-end against a live receiver by
`npm run e2e:publish` — 23 checks.

**So "publish to Website" is a push, not a pull:** the site owner must host the
receiver that accepts this envelope and writes it into the site. There is no
back-query, so the site can never re-sync history.

**[V] The `/pipeline` webhook form collects only name, URL and platform badges**
(`ContentPipeline.tsx:339-393`) — so **custom auth headers, which the schema
supports, cannot be set from the UI** and require a direct DB write. Worth fixing
before building a Meta/website receiver that needs a shared secret.

## Articles are not first-class in the CMS

**[A]** `src/pages/Articles.tsx` CRUDs `posts` rows with `type: "article"`
(`:81-87`, `:118`, `:134`) via `usePosts`. "Publish Now" only sets
`status='scheduled'`, `scheduled_at=now()` (`:151-153` →
`src/hooks/usePosts.ts:186-211`). Two consequences worth knowing:

- **Creation always passes `platforms: []`** (`:114-121`) → zero
  `post_platforms` rows → the delivery loop never executes → the post retries to
  the attempt cap and **parks as `failed` with an empty error string**
  (`publish-due-posts/index.ts:208-217`). An article created in the Articles
  page with no platform can therefore never deliver, and reports a blank reason.
- File import (`.md`/`.txt`/`.html`, `:326-351`) is inbound only — there is no
  export.

**Exports: essentially none.** The only one is `src/pages/Analytics.tsx:183-202`,
a client-side CSV of *aggregate counts* with no article bodies. No
RSS/Atom/sitemap/JSON/GraphQL anywhere. All content routes are `ProtectedRoute`
(`src/App.tsx:135-154`); `vercel.json` rewrites everything to the SPA shell, so
nothing is server-rendered for crawlers.

## Storage buckets are public-read

**[V]/[A]** All three buckets (`media`, `post-images`, `avatars`) are served on
the public route, and anonymous **listing** works
(`POST /storage/v1/object/list/<bucket>` → 200). `media` and `avatars` are
created `public=true` in migrations (`20260127204449:2-9`,
`20260731180000:6-11`); **`post-images` has public SELECT policies
(`20260501003435:30-33`, `20260503142554:11-13`) but no bucket INSERT in any
migration** — its flag was set in the dashboard, exactly like `articles`.

Practical read: a website can hotlink images directly, and the buckets are
currently empty, so nothing is exposed today. Anonymous *listing* being enabled
is worth tightening regardless.

---

## Options to wire consumption, with tradeoffs

| # | Option | Tradeoff | Effort |
|---|---|---|---|
| **A** | **`public_published_posts` view + `TO anon` SELECT grant** (PostgREST) | Fewest moving parts, instant reads from `/rest/v1/…`. Must expose only allow-listed columns via a view — never `posts` raw, which would leak `user_id` — and must bypass `has_role` (anon can't evaluate it). New DB object must be applied to prod. | **~2–4 h** |
| **B** | **Dedicated read-only edge function** (`verify_jwt=false`, service role, allow-listed fields, optional `x-api-key`, ETag) | Best control: a real contract with versioning, pagination and rate limiting, no schema exposure. Cost: a new function plus a **manual `supabase functions deploy`** (merged ≠ deployed) and secret handling. | **~4–8 h** |
| **C** | **Static export builder** in `tools/` + a GitHub Action writing JSON/Markdown/RSS into the website repo | Ideal for a static/SEO site; no anon key exposure and no public write surface. Adds a build dependency and a publish lag. | **~1 day** |
| **D** | **Formalize the webhook path** — add auth-header UI on `/pipeline`, document the envelope, add a shared secret + idempotency key; owner builds one receiver | Smallest CMS-side change. Still no back-query and no history re-sync; the site must be reachable and trusted. | CMS **~2–4 h** + receiver **~½ day** |
| **E** | **Adopt the existing public `articles` table** as the site's store | Zero code today — it already works. But it delivers content the CMS never writes, so the CMS would need to start writing it (a migration + writers in `Articles.tsx` or the pipeline), creating a second content model unless `posts` is retired for articles. | **~1–2 days** |

**Recommendation, and it depends on the decision above:**

- If `articles` **is** the intended public store → do **E** and make the CMS
  write it (or make `Articles.tsx` operate on it directly). That is the shortest
  path to "the CMS feeds my website", and it removes the two-content-model
  ambiguity instead of adding a third.
- If `articles` **is** a leftover → do **A** for CMS-managed `posts`, and drop or
  archive the table deliberately.
- Do **D** regardless: whatever else you build, the webhook path is what serves
  the non-website platforms (Meta, etc.). Its **envelope is now unified and it
  carries a stable `delivery_id`, so the idempotency half of D is done** (see
  "Website delivery today" above). Still outstanding on that path: **no shared
  secret or signature**, no update/unpublish events (only `post.publish`), and no
  way to set auth headers from the UI.

---

## Write exposure on `articles` — RESOLVED, and it is safe

**[V] `anon` cannot write to `articles`.** Probed with an `INSERT` that
deliberately reuses an existing primary key (`id: 11`), so it **provably could
not create a row** whatever the permissions turned out to be:

```
POST /rest/v1/articles  {"id": 11, "title": "permission-probe-do-not-store"}
-> 401 {"code":"42501","message":"new row violates row-level security policy for table \"articles\""}
-> row count unchanged afterwards (Content-Range: 0-3/*  = 4 rows)
```

That error is an **RLS policy violation, not a missing GRANT** — so:
- RLS **is enabled** on `articles` (the earlier ambiguity is gone),
- there is a permissive **SELECT** policy for `anon` (hence the public read), and
- there is **no INSERT policy for `anon`** (hence the refusal).

A publicly-readable, non-writable content table is a defensible design. The
anonymous read exposure flagged by the secret audit is therefore **read-only and
consistent with the website consuming it** — it is not the serious exposure it
could have been.

**One honest limit:** `UPDATE`/`DELETE` cannot be probed the same way. Under RLS
those filter rows rather than deny the statement, so a zero-row-targeting probe
returns success either way and would prove nothing. The `INSERT` result — RLS
enabled with only a read policy for `anon` — is strong evidence the table is
read-only for anonymous callers, but if you want certainty, confirm the policy
list in the dashboard.

## Not verified

- **Live `webhook_configs` state.** RLS hides it from anon. The "no active row"
  claim in `docs/MASTER_CHECKLIST.md` comes from the owner, not from these probes.
- **`pg_cron` hygiene** **[A]**: two jobs still target functions that no longer
  exist (`20260323170000:36` → `scheduled-pipeline`,
  `20260429071001:13` → `run-scheduled-automations`), so those ticks 404.
