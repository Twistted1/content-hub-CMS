## Goal

Make the workflow actually run end-to-end, every day, with no manual babysitting:

```text
src/data/platforms/*.json (weekly schedule)
        │
        ▼  every 15 min, pg_cron
[schedule-from-templates edge fn]
        │  finds upcoming slots in next 24h that don't have a post yet
        ▼
[content-pipeline edge fn] (Gemini text + image)
        │
        ▼
posts.status = 'awaiting_review'  ──►  Review Inbox (UI)
        │  user approves
        ▼
posts.status = 'scheduled'
        │  at scheduled_at, pg_cron
[publish-post edge fn]
        │
        ├── LinkedIn API (token in platform_oauth_tokens)
        ├── X API         (token in platform_oauth_tokens)
        └── webhook_configs (Zapier/Make) for IG, FB, TikTok, YouTube, Rumble, Podcast, Website
```

## What's broken right now (verified)

1. `project_settings` has no `supabase_url`/`supabase_anon_key` columns, so all 3 pg_cron jobs hit `IF ... IS NOT NULL` and exit silently — **nothing has ever run**.
2. `execute-automation-1min` cron points to a function that doesn't exist.
3. Even if cron fired, `run-scheduled-automations` and `scheduled-pipeline` require a `service_role` Bearer that cron can't safely store in plaintext.
4. No `platform_oauth_tokens` rows — LinkedIn/X re-auth didn't persist (likely a callback bug, separate fix).
5. There is no code that reads the per-platform JSON schedules; the existing pipeline only fires when an `automations` row exists, and there are zero.

## Fix — 4 steps

### Step 1 — Cron plumbing (migration + insert)

- Drop the broken `execute-automation-1min` job.
- Store the service-role key in Supabase Vault: `vault.create_secret('<SR>', 'service_role_key')`.
- Rewrite the two remaining cron jobs to read the secret from Vault and POST with `Authorization: Bearer <service_role>`. Hard-code the project URL `https://jvbucspwcjahqpoxskvr.supabase.co`.
- Add a 3rd job: `publish-due-posts` every minute — calls a new edge function that publishes any `posts.status='scheduled'` with `scheduled_at <= now()`.

### Step 2 — New edge function: `schedule-from-templates`

- Imports the 7 platform JSONs (`youtube`, `twitter`, `instagram`, `facebook`, `linkedin`, `tiktok`, `rumble`, `website`) — bundled at deploy time.
- For each user with `automations.status='active' AND trigger='scheduled'`, walks the next 24 h of weekly slots.
- For each slot with no existing post (`posts` lookup by `user_id + platform + scheduled_at`), calls `content-pipeline` with `scheduleMode='awaiting_review'` so it lands in the Review Inbox.
- Replaces `run-scheduled-automations` (kept for legacy until verified).

### Step 3 — New edge function: `publish-due-posts`

- Selects `posts` where `status='scheduled' AND scheduled_at <= now() AND publish_attempted_at IS NULL` (lock with `UPDATE ... RETURNING`).
- For each `post_platforms` row: invokes existing `publish-post` for LinkedIn/X; for others, POSTs to matching `webhook_configs` rows.
- Updates `posts.status` to `published` (or `failed` with `publish_error`).

### Step 4 — UI: one-click "Activate weekly schedule"

- On the Automation page, a new top card: **"Run my weekly schedule"** — creates one `automations` row per user with `trigger='scheduled'`, `status='active'`, `platforms=['youtube','twitter','instagram','facebook','linkedin','tiktok','rumble','website']`. That single row is what `schedule-from-templates` keys on.
- Surface the next 10 upcoming slots (read from JSON + posts table) so the user can see what's coming.

## Out of scope (do next, not this turn)

- Fixing the LinkedIn / X OAuth callback so `platform_oauth_tokens` actually gets rows. Without those, publishing falls back to webhook only.
- Podcast/Rumble direct integrations (webhook is the path for now).
- Backlog cleanup of the 101 `awaiting_review` posts (separate review action).

## Technical notes

- All edge functions keep `verify_jwt=false`, validate `Authorization: Bearer <service_role>` from cron, and validate JWT for user-initiated calls.
- Idempotency: `schedule-from-templates` keys on `(user_id, platform, scheduled_at)` so re-runs in the same 15 min window create nothing new.
- `publish-due-posts` uses a `publish_attempted_at IS NULL` filter so a row never gets double-published.
- All cron commands stored via the supabase **insert** tool (not migration) because they contain a secret pointer.
