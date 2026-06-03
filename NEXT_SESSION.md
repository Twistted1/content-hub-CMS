# Fresh Start — Content Hub CMS — Session Handoff

## Repo
```
https://github.com/Twistted1/content-hub-CMS.git
```
Clone to `/d/Dev/content-hub-cms-work` before touching anything.
**Do NOT use the local D:\Dev\content-hub-cms — it only has node_modules.**

---

## What This App Is
**Content Hub CMS** — headless CMS + social media automation for **Novus Exchange** (novusexchange.com).
- Generates a full week of AI content across 9 platforms (Gemini 2.5 Flash)
- Automation Review Hub: approve/reject AI posts before publishing
- Auto-publishes to Twitter via OAuth 1.0a (pg_cron every 1 min)
- Instagram publishing code exists but needs Supabase secrets
- Stripe billing (Pro $29/mo, Enterprise $99/mo)
- Supabase project: `jvbucspwcjahqpoxskvr` (eu-central-1)
- Stack: Vite 7, React 18, TypeScript, Tailwind, shadcn/ui, TanStack Query, Zustand

---

## State After Last Session (fully committed to main)

### ✅ DONE — No Longer Fake
- `platformsData.ts` — stripped to static config only (names, icons, colors, URLs). Zero fake follower counts or engagement rates.
- `PlatformCard.tsx` — real post counts from `usePosts()`, real settings from `usePlatforms()`
- `PlatformDetailSheet.tsx` — real data only, settings write to `user_platforms` table
- `Platforms.tsx` — fully wired: `usePlatforms()` + `usePosts()`, real overview stats, fake Activity + Insights tabs removed
- `ReportPreviewDialog.tsx` — real charts from `usePosts()` (status breakdown, platform breakdown, 7-day activity). Print and Download (.txt) actually work.
- `App.tsx` — dead routes `/models` and `/workflow` removed
- `Sidebar.tsx` — "Content Models" → "Gantt Chart" pointing to `/gantt`
- `Reports.tsx` — fake schedule toast removed
- `.claude/settings.json` — permission allowlist added (npm run build/dev, all Claude Preview MCP tools, Supabase read tools, Vercel read tools)

### 🗑️ Deleted
- `src/pages/ContentModel.tsx` — was a shell (setTimeout fake analysis)
- `src/pages/ContentModels.tsx` — hardcoded fake model list
- `src/pages/WorkflowTest.tsx` — Antigravity junk
- `src/components/mascot/NoveeMascot.tsx` — never rendered anywhere
- `src/hooks/useNoveeChat.ts` — only used by deleted mascot

### ✅ Already Real (Supabase-backed)
- Auth (Supabase Auth)
- Posts CRUD (`posts` + `post_platforms` tables via `usePosts`)
- Automation Review Hub (approve/reject/fire-webhooks)
- Twitter publishing (direct OAuth 1.0a, pg_cron)
- AI Strategy generation (`generate-strategy` → Gemini 2.5 Flash)
- Quick Post (`content-pipeline` → GPT-4o + DALL-E 3)
- AI Chat (`novee-chat` → GPT-4o-mini streaming, used by `AIAssistant.tsx` via `useChat.ts`)
- Projects, Notes, Strategies, Reports, Analytics — all Supabase
- IntegrationsSettings — real OAuth flow, reads `platform_oauth_tokens`
- Stripe billing (checkout + portal + webhook)
- Import Data — CSV parser with real Supabase inserts

---

## What Still Needs Building (Code)

### 1. Wire SubscriptionGate — HIGHEST PRIORITY
`src/components/subscription/SubscriptionGate.tsx` exists and works perfectly.
It is imported on **zero pages**. Free users get everything for free.

Wrap these pages/features:
- `/ai` (AIAssistant) → Pro
- `/automation` (Automation page) → Pro
- `/pipeline` (ContentPipeline / Quick Post) → Pro
- `/reports` (Reports) → Pro
- `/analytics` (Analytics) → Pro (or at least limit history)
- `/users` (Users management) → Enterprise

Usage:
```tsx
<SubscriptionGate requiredTier="pro" feature="AI Assistant" benefits={["Unlimited AI chat", "..."]}>
  <AIAssistant />
</SubscriptionGate>
```
The hook `useSubscription()` already calls `check-subscription` edge function.

### 2. Header Workspace Selector (~30 min)
`src/components/layout/Header.tsx` — the "Workspace / My Workspace" button is static with no handler. Either wire it to a real workspace switcher or remove it.

### 3. Auth Page — Terms Acceptance (~30 min)
`src/pages/Auth.tsx` — no terms checkbox on signup. Add a checkbox: "I agree to the Terms of Service and Privacy Policy" that must be checked before account creation.

### 4. Onboarding Flow (~3h)
New users who sign up land on the dashboard with zero data and zero guidance. Need a simple first-run wizard: connect platforms → run first strategy → review posts.

### 5. generate-strategy improvements (~1h)
Edge function: `supabase/functions/generate-strategy/index.ts`
- Enforce tweet slots: 08:30, 12:30, 18:00 UTC
- Instagram slot: 15:00 UTC
- `#NovusExchange` must be in every tweet
- Word count gate: reject article < 800 words, retry up to 2x

---

## External Config Needed (NOT code — user must do)
- **Rotate Twitter API keys** (were shared in chat 2026-05-29, treat as compromised)
  → developer.twitter.com → update `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET` in Supabase Edge Function secrets
- **Instagram secrets**: set `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_USER_ID` in Supabase secrets
- **Make.com scenarios**: configure webhooks for Facebook, LinkedIn, TikTok, YouTube, Rumble

---

## Edge Functions on Disk
| Function | Purpose |
|---|---|
| `generate-strategy` | 7-day content scaffold (Gemini 2.5 Flash) |
| `content-pipeline` | Single quick post (GPT-4o + DALL-E 3) |
| `novee-chat` | AI Assistant chat (GPT-4o-mini, streaming) |
| `publish-twitter` | Twitter OAuth 1.0a direct posting |
| `fire-webhooks` | Webhook orchestrator |
| `execute-automation` | Cron: Twitter + Instagram publishing |
| `stripe-webhook` | Stripe event handler |
| `check-subscription` | Reads Stripe subscription tier |
| `create-checkout` | Creates Stripe Checkout session |
| `customer-portal` | Opens Stripe Billing Portal |
| `oauth-init` | Platform OAuth initiation |
| `twitter-oauth-callback` | Twitter OAuth callback |
| `linkedin-oauth-callback` | LinkedIn OAuth callback |
| `scheduled-pipeline` | ⚠️ Orphaned — overlaps execute-automation, not used |

---

## Supabase Key Tables
`posts`, `post_platforms`, `user_platforms`, `platform_oauth_tokens`,
`automations`, `automation_runs`, `projects`, `notes`, `strategies`,
`strategy_goals`, `reports`, `profiles`, `user_roles`, `webhook_configs`,
`subscriptions`, `invitations`, `media`

---

## Key File Paths
- Pages: `src/pages/`
- Hooks: `src/hooks/` — all Supabase-backed
- Platform config (static only): `src/components/platforms/platformsData.ts`
- Subscription gate: `src/components/subscription/SubscriptionGate.tsx`
- Supabase client: `src/integrations/supabase/client.ts`
- Types: `src/types/index.ts`
- Supabase DB types: `src/integrations/supabase/types.ts`
- i18n: `src/i18n/locales/en.json` + `pt.json`
- Settings/allowlist: `.claude/settings.json`

---

## Build
```bash
cd /d/Dev/content-hub-cms-work
npm install --legacy-peer-deps   # only needed once
node_modules/.bin/vite build     # or: npm run build (if vite in PATH)
```
Build passes clean. Zero errors. Only chunk-size warning (non-blocking).

---

## Start Here Next Session
1. `git clone https://github.com/Twistted1/content-hub-CMS.git /d/Dev/content-hub-cms-work`
2. Wire `SubscriptionGate` to the 6 pages listed above
3. Fix Header workspace selector
4. Add Terms checkbox to Auth signup
5. (Optional) generate-strategy improvements

*Last updated: 2026-06-03 — fake data purge complete, Supabase fully wired, dead code deleted.*
