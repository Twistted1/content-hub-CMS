## Goal
Wire up the existing automation primitives (`useAutomations` hook, `AutomationDialog`, `AutomationCard`, `AutomationHistoryDialog`) into the Automation page so users get a real, end-to-end automation workflow — not just the one-shot "Master Pipeline" button.

## What's already there
- `automations` table + `automation_runs` table with RLS
- `useAutomations` hook with full CRUD, toggle, duplicate, run, complete-run mutations
- `AutomationDialog` (create/edit form), `AutomationCard`, `AutomationHistoryDialog`
- `Automation.tsx` "Master Pipeline" generator (works) + dead "New Automation" / "Configure" buttons
- Stats are hardcoded ("8 / 124 / 48h / 8")

## What's missing
1. No list of user's saved automations on the page
2. "New Automation" button does nothing
3. "Configure" buttons on stream cards do nothing — streams are presets, not real automations
4. No way to run a single automation, view its history, pause/resume, edit, delete
5. Stats are hardcoded
6. No actual execution backend — `runAutomation` just creates a `running` row that never completes

## Plan

### 1. Wire the Automation page to real data
- Replace hardcoded stats with live counts from `useAutomations` + `automation_runs`:
  - Active Automations = `automations.filter(status==='active').length`
  - Total Runs = sum of `runs`
  - Time Saved = `totalRuns * 0.4h` rough estimate
  - Connected Apps = unique platforms across automations
- Hook "New Automation" button → opens `AutomationDialog` (create mode) → `addAutomation`
- Add a new "My Automations" section above Streams listing `AutomationCard`s with: toggle pause/active, run-now, edit, duplicate, delete, view history

### 2. Convert Streams into automation templates
- Make each stream's "Configure" button open `AutomationDialog` pre-filled from the stream preset (name, description, platforms, scheduled trigger). Saving creates a real automation row.
- Status badge on each stream card changes to "Active" if a matching automation exists, else "Strategy Ready".

### 3. Single-automation execution
- Add `executeAutomation(id)` flow in the page:
  - Calls `runAutomation` to create a `running` row
  - Invokes existing `generate-strategy` edge function scoped to the automation's platforms (filter the items array by `automation.platforms`)
  - Inserts generated posts as `awaiting_review` (same path as Master Pipeline, but only for this automation's platforms)
  - Calls `completeAutomationRun` with success/failure
- Run-now button on each `AutomationCard` triggers this flow with a toast + progress.

### 4. Scheduled execution (cron)
- New edge function `run-scheduled-automations` (verify_jwt=false):
  - Fetches all `automations` where `status='active'` and `next_run <= now()`
  - For each: invokes generate-strategy, inserts posts (awaiting_review), updates `last_run`, computes new `next_run` from `schedule`, inserts `automation_runs` row with success/failure
- pg_cron job every 15 minutes calling this function (using `supabase--read_query` + insert tool to set up).
- When user creates/updates an automation with a `scheduled` trigger, compute initial `next_run` client-side and persist it.

### 5. History dialog
- "View History" button on `AutomationCard` opens `AutomationHistoryDialog` filtered to that automation's runs from `automationRuns`.

### 6. Keep Master Pipeline + Master Review Hub as-is
The "Run Master Pipeline" button and "Master Review Hub" awaiting_review queue stay unchanged — they remain the bulk weekly workflow. Per-automation flow is additive.

## Technical notes
- File edits: `src/pages/Automation.tsx` (main rewrite of right-hand sections + button wiring); minor tweaks to `AutomationCard` if needed for the new actions menu.
- New edge function: `supabase/functions/run-scheduled-automations/index.ts`.
- Migration: none for tables (schema is sufficient). pg_cron + pg_net job set via insert tool (not a migration) because it contains the project URL + anon key.
- `useAutomations` already exposes everything needed — no hook changes required.

## Out of scope (call out for follow-up)
- Real publishing to external platforms (still simulated via `post_platforms.status='scheduled'` + existing webhook flow)
- Engagement-based triggers (UI exists, no backend yet)
- Conditional/branching action graphs

## Suggested follow-ups after approval
- Add an "Undo last run" that deletes posts created by a specific `automation_runs` row
- Add per-automation cost tracking using `posts.cost_estimate`
- Surface `next_run` countdown on each card