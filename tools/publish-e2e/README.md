# publish-e2e — proving the webhook publishing path

This directory exists because of the single most important fact about this
project's go-live readiness:

> Only **LinkedIn** and **X/Twitter** publish directly
> (`supabase/functions/publish-due-posts/index.ts:15`,
> `DIRECT_PLATFORMS = {linkedin, twitter}`). Every other platform is delivered by
> POSTing to a URL from the `webhook_configs` table. With no matching **active**
> row there, the post fails with
> `No active webhook configured for {platform}` — the calendar still looks full,
> so the failure is invisible until you go looking.

`run.mjs` proves that path actually works, by running the **real, unmodified**
edge function and pointing its delivery at a receiver you control. Nothing in
the delivery path is reimplemented: the function's own claim loop, SSRF guard,
payload builder, 8s timeout and database bookkeeping are what get exercised.
Only the database is faked (a local PostgREST stand-in).

## What it proves

| # | Scenario | Assertion |
|---|---|---|
| 1 | A webhook-only platform (`website`) is delivered | The receiver gets a `post.publish` envelope; the post and its `post_platforms` row are marked `published`; retry bookkeeping is cleared |
| 2 | No active webhook for the platform | Fails *loudly* with the exact platform named; the post stays `scheduled` for retry rather than being dropped; `publish_error` records the attempt |
| 3 | Retries exhausted | Post parks as `failed` at the attempt cap instead of retrying forever |
| 4 | SSRF guard | A loopback webhook target is filtered out and never dialled |
| 5 | Cron auth | `x-cron-secret` is read from the database (not compared to a literal); a wrong secret is rejected with 401 |
| 6 | Unauthenticated | 401, and no claim is attempted before the auth check |

## What it does NOT prove

It cannot tell you whether **production** has an active `webhook_configs` row,
because that is data, not code. That is the operational half of the gap, and it
needs either the Supabase dashboard or the runbook below. A green run here means
"the mechanism is sound"; it does not mean "your calendar is deliverable".

## Running it

Needs [Deno](https://deno.com) (the same runtime Supabase Edge Functions use)
and Node 18+.

```bash
# A receiver whose delivery log the harness can read back.
# webhook.site works with no credential: create one at https://webhook.site
# and copy the UUID out of the URL it gives you.
deno --version
node tools/publish-e2e/run.mjs --receiver https://webhook.site/<uuid>
```

Environment overrides: `DENO_BIN` (path to `deno`), `STUB_PORT` (default
54321), `EDGE_PORT` (default 8000, see below), `RECEIVER_URL` (instead of the
flag).

`std@0.168.0`'s `serve` ignores the `PORT` environment variable and binds
**8000**, so the harness uses 8000 unless you override `EDGE_PORT`.

Exits non-zero if any assertion fails, and prints the edge function's own
stdout/stderr on failure.

If `--receiver` is a webhook.site URL the harness reads the delivery log back
through the public token API and asserts the payload shape and that custom
headers were forwarded. For any other receiver URL the read-back is skipped
(reported as `SKIP`) and only the local assertions run.

## The production runbook (operator action)

This is the part the harness cannot do for you. To make a webhook-only platform
genuinely deliverable in production:

1. **Create the receiving endpoint.** It must be `https` and publicly
   reachable — the delivery path rejects loopback, link-local, RFC1918 and
   CGNAT hosts (`publish-due-posts/index.ts:20-30`).
2. **Add the webhook row.** Content Pipeline (`/pipeline`) → **Webhooks** →
   *Add Webhook*. Note that this is authored on `/pipeline`; Settings →
   Integrations only *lists* what you created here.
   - **Website** is selectable there; use the platform badges to scope the row.
   - Leaving every badge unselected means **platforms: []**, which matches
     *every* platform — one row then covers the whole calendar, but only if your
     endpoint handles all of them.
   - The row must be **Active**, and its `user_id` must match the post owner, or
     `publish-due-posts` will not see it (`index.ts:122-123`).
3. **Queue a post for that platform.** Calendar → new event → set **Platform** to
   the one you configured → Save. This writes a `scheduled` post plus a
   `post_platforms` row (`Calendar.tsx:879-890`).
4. **Wait up to a minute.** `publish-due-posts` runs on a one-minute `pg_cron`
   schedule; it only ever selects `status = 'scheduled'` rows.
5. **Confirm it arrived** at your endpoint, then confirm in the UI that the post
   shows as published — and if it does not, read `publish_error` /
   `publish_attempts`, which the UI surfaces as a retry/failure badge
   (`PublishStatusBadge`).

Steps 1–2 are the whole gap. Steps 3–5 exist because "configured" is not
"verified".
