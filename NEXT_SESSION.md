# Content Hub CMS — Session Handoff (2026-06-04)

## Repo & Working Dir
Repo: https://github.com/Twistted1/content-hub-CMS.git
Working dir: `D:\Dev\content.hub.CMS\content-hub-CMS-main`
Branch: main (git initialized, remote set)

## Dev Server
```
node_modules/.bin/vite --host 0.0.0.0 --no-open
```
Port 5173. `.env` is in place with Supabase credentials.

---

## ✅ Fixed This Session
- Platforms page: rich UI restored (Performance Overview, stats bar, follower cards)
- `user_platforms` table created in Supabase + seeded 9 platforms per user
- `.env` created with Supabase URL + anon key
- SubscriptionGate REMOVED (was locking admin out of their own app)
- Page titles: ALL pages now use `text-3xl font-black tracking-tight text-foreground`
- Sidebar: narrowed to `w-44`, compact items
- Calendar: title at top of left panel, Filter Stream compressed, mini calendar smaller
- Auth: Terms checkbox on signup
- Header: dead workspace button removed

## ⚠️ Still Open
1. Sidebar size — user not fully satisfied, may want further reduction
2. AI Assistant / Content Pipeline — need `OPENAI_API_KEY` in Supabase Edge Function secrets
3. Automation / generate-strategy — needs `GEMINI_API_KEY` in Supabase secrets
4. Twitter API keys — were exposed in previous session, need rotating
5. Instagram — `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_USER_ID` not set
6. SubscriptionGate — removed for now, re-add only when Stripe is wired and admin has active subscription

## ❌ DO NOT
- Add features not asked for
- Re-add SubscriptionGate without being asked
- Strip rich page UIs and replace with simplified versions
- Rename/restructure pages without being asked

## Key Files
- Sidebar: `src/components/layout/Sidebar.tsx` (w-44)
- DashboardLayout: `src/components/layout/DashboardLayout.tsx` (pl-44)
- Permissions: `.claude/settings.json` has `Bash(*)` + all MCPs — no prompts

## Supabase
Project: `jvbucspwcjahqpoxskvr` (eu-central-1)
Tables: posts, post_platforms, user_platforms, platform_oauth_tokens, automations, automation_runs, projects, notes, strategies, strategy_goals, reports, profiles, user_roles, webhook_configs, subscriptions, pipeline_runs
