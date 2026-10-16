# Deploying the receiver — step by step

Goal: get from "the CMS has no active webhook row, so nothing delivers" to
"a real post reaches a real receiver and I have watched it arrive", in about
fifteen minutes, without publishing anything to your live website.

This is the last operationally-blocking step for go-live. Everything else is
polish or packaging.

---

## Before you start

Two facts that decide the shape of everything below:

1. **The receiver must be on a public HTTPS URL.** The CMS's SSRF guard refuses
   private, loopback, link-local, CGNAT and IPv6-private hosts
   (`publish-due-posts/index.ts` → `isPrivateOrLocalHost`), so `localhost` and a
   bare-Railway-internal hostname will both be silently filtered out and you will
   see `No active webhook configured for {platform}` with no clue why.
2. **Anything you deploy is a public endpoint.** It verifies an HMAC signature
   before doing anything, which is what stops a stranger posting content through
   it — so the signing secret is not optional in practice.

Run the self-test locally **first**. It proves the logic before you spend time on
infrastructure:

```bash
node tools/webhook-receiver/selftest.mjs      # expect 10/10
```

---

## Step 1 — deploy

Pick whichever you already have an account for. All of them inject `PORT`, which
the code reads.

### Option A: Docker (works on Railway, Render, Fly, Cloud Run, any VPS)

The `Dockerfile` in this directory bakes in `HOST=0.0.0.0`, which is the one
setting that is easy to miss and produces a confusing failure (see
Troubleshooting).

```bash
docker build -t webhook-receiver tools/webhook-receiver
docker run -p 8787:8787 -e WEBHOOK_SIGNING_SECRET=<secret> webhook-receiver
```

On a platform: point it at this repository, set the build context to
`tools/webhook-receiver`, and let it use the Dockerfile. Railway and Render both
detect it.

### Option B: bare Node (Railway, Render, Fly, a VPS with a reverse proxy)

Start command `node tools/webhook-receiver/server.mjs`, and **set `HOST=0.0.0.0`
yourself** — this is exactly the failure that was hit on Railway and fixed by
adding the variable. Leave it unset and the process binds loopback, starts
cleanly, logs `webhook receiver on http://127.0.0.1:8787`, and the platform
reports "Application failed to respond".

### Step 1b — confirm it is actually reachable

From your own machine, not the platform's console:

```bash
curl -s https://<your-host>/health
# expect: {"ok":true,"commit":false}
```

`commit:false` is the dry-run default and is what you want right now. If this
hangs or 502s, it is the bind address — go to Troubleshooting.

---

## Step 2 — match the signing secret

The CMS signs every delivery with HMAC-SHA256 over the raw body, keyed by
`WEBHOOK_SIGNING_SECRET`. The receiver must hold **the same value**.

Supabase → Project Settings → Edge Functions → Secrets →
`WEBHOOK_SIGNING_SECRET`. (This is already set — a production delivery was
verified carrying `X-Novus-Signature`.) Copy that value to your host's
environment as `WEBHOOK_SIGNING_SECRET`.

If the receiver starts with no secret and `ALLOW_UNSIGNED` unset, it **refuses to
start** — deliberately, because an unsigned receiver accepts content from anyone
who finds the URL.

---

## Step 3 — add the webhook row

`/pipeline` → **Webhooks** tab → **Add Webhook**.

| Field | Value |
|---|---|
| Name | something you'll recognise later, e.g. `website-receiver-dryrun` |
| URL | `https://<your-host>/` |
| Platforms | click **Website** (or whichever platform you're proving) |
| Custom headers | leave empty for now |

Save, and confirm it shows as **Active**.

Three things worth knowing:

- **Leaving every platform badge unselected does not mean "no platforms"** — it
  stores `platforms: []`, which matches **every** platform.
- The row's `user_id` must be yours. It is set automatically from your session.
- The row is immediately live. `publish-due-posts` runs every minute.

---

## Step 4 — watch a delivery arrive, without publishing anything

With `ARTICLES_COMMIT` unset (the default), the receiver verifies and **logs the
row it would insert**, then writes nothing. This is the proof you want.

1. In the Calendar (or `/pipeline`), create a post with **Platform = Website** and
   set the time to **one or two minutes ahead**. Saving a Calendar event writes a
   `scheduled` post plus its `post_platforms` row.
2. Wait up to a minute for the cron tick.
3. Check your host's logs. You should see a block like:

```
[receiver] DRY-RUN <post-id>:website platform=website — would insert:
{
  "title": "...",
  "excerpt": "...",
  "content": "...",
  "image_url": null,
  "category": "Geopolitics",
  "author_id": "novus-ai",
  "read_time": 4,
  "publish_date": "OCTOBER 16, 2026",
  "date": "OCTOBER 16, 2026",
  "tags": []
}
```

**If you see that, the original go-live gap is closed.** A non-direct platform
delivered, end to end, in production, and the receiver verified it.

Also confirm in the UI that the post flipped to **published** with no retry
badge. If instead it shows a retry count, the delivery failed — see below.

---

## Step 5 — only when you're ready: let it write

This is the step to be deliberate about.

**`public.articles` has no status column.** An inserted row is live on
novusexchange.com immediately — no draft state, no review, no undo. That is why
the receiver defaults to dry-run, and why a CMS→site write should be an explicit
publishing action rather than a side effect of approving something in the CMS.

When you want it:

```bash
ARTICLES_COMMIT=1
SUPABASE_URL=https://jvbucspwcjahqpoxskvr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

Three notes:

- The **service-role key** is required. The anon key cannot write to `articles`
  (there is no anon write policy — correct, and one of the site's own documents
  suggests a policy that would make the table world-writable. Do not apply that).
- The receiver is now holding an admin credential. Treat that host as
  production, and never put this key in the CMS or a browser.
- Before the first real write, read the field-mapping section of
  `README.md` — `author_id` in particular, because the site matches it by
  **substring** and an unmapped value displays the *wrong author* rather than
  failing.

---

## Troubleshooting — the failures actually seen

| Symptom | Cause | Fix |
|---|---|---|
| "Application failed to respond", process logs healthy | bound `127.0.0.1` instead of `0.0.0.0` | `HOST=0.0.0.0`, or use the Dockerfile |
| `401 invalid signature` in receiver logs | secret mismatch between the receiver and the Supabase edge-function secret | re-copy the exact value; check for a trailing newline |
| `401 stale or missing timestamp` | clock skew, or a delivery replayed from a log beyond `REPLAY_WINDOW_SECONDS` (default 300) | check host time; raise the window only if you understand why |
| receiver refuses to start | no `WEBHOOK_SIGNING_SECRET` and no `ALLOW_UNSIGNED=1` | set the secret. Do not set `ALLOW_UNSIGNED` in production |
| Post in the UI shows `No active webhook configured for X` | row missing, **inactive**, wrong `user_id`, or its URL was rejected by the SSRF guard | check Active; check the URL is public HTTPS |
| Nothing arrives at all | post not `scheduled`, or `scheduled_at` in the future, or no `post_platforms` row | `claim_due_posts` only takes `status='scheduled'` with `scheduled_at <= now()` |
| Post shows "Retry n/5" | the delivery failed; the reason is in `publish_error` | fix, then it retries on backoff (2m doubling to 60m, 5 attempts) |
| Post parked as `failed` | attempts exhausted | it will not retry; reschedule it |
| Two identical deliveries | the CMS retries with backoff after a timeout it did not see succeed | expected — the receiver de-duplicates on `delivery_id`. Do not remove that |
| `500` from the receiver after a successful verify | insert rejected by the database | almost always a column mismatch, e.g. a NOT NULL the DDL omits. Check the receiver's logged error, and see `tools/sql-options/` |

**Rollback is one click:** deactivate the webhook row on `/pipeline`. Deliveries
then fail with `No active webhook configured`, the posts retry, and nothing else
changes.
