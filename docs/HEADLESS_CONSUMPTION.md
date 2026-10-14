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
CMS, or **(b)** a leftover to be dropped? Everything below branches on this.

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
- https-only SSRF guard (`:28-30`), 8 s abort (`:153-154`), `redirect:"error"`
- operator-supplied headers from the `headers` JSONB (`:159`)
- body: `{event: "post.publish", platform, post: {id, title, content, coverImageUrl}, timestamp}` (`:160-170`)

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
  the non-website platforms (Meta, etc.), and it currently has no shared secret,
  no idempotency key, and no way to set auth headers from the UI.

---

## Not verified

- **Whether `articles`/`authors` have RLS enabled with a permissive policy, or
  RLS disabled entirely.** Both produce the observed `200`. Confirm in the
  dashboard.
- **Whether `anon` can INSERT/UPDATE `articles`.** No write was attempted — this
  is a deliberate gap, and it is the single most important thing to check if the
  table is under a permissive policy. A publicly writable content table would be
  a serious exposure.
- **Live `webhook_configs` state.** RLS hides it from anon. The "no active row"
  claim in `docs/MASTER_CHECKLIST.md` comes from the owner, not from these probes.
- **`pg_cron` hygiene** **[A]**: two jobs still target functions that no longer
  exist (`20260323170000:36` → `scheduled-pipeline`,
  `20260429071001:13` → `run-scheduled-automations`), so those ticks 404.
