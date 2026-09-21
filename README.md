# Content Stream

A B2B headless CMS and content operations platform built with Vite + React + TypeScript + Supabase.

## Tech Stack

- **Frontend:** Vite 7, React 18, TypeScript 5.8, Tailwind CSS 3.4
- **UI Components:** shadcn/ui
- **State:** Zustand 5, TanStack Query 5
- **Backend:** Supabase (Auth, Database, Edge Functions)
- **Payments:** Stripe (subscriptions, billing portal)
- **Monitoring:** Sentry (error tracking, session replay)
- **i18n:** i18next — English and Portuguese

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd content-stream
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env` with your values (see `.env.example` for all required keys).

### 3. Run locally

```bash
npm run dev
```

App runs at **http://localhost:5173**

## Supabase Setup

### Edge Function Secrets

Set these in **Supabase Dashboard → Edge Functions → Secrets:**

| Secret | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `OPENAI_API_KEY` | OpenAI key for Novee AI assistant and content generation |
| `SITE_URL` | Production URL for Stripe redirect callbacks |
| `TWITTER_CLIENT_ID` | X/Twitter OAuth 2.0 client ID (direct publishing) |
| `TWITTER_CLIENT_SECRET` | X/Twitter OAuth 2.0 client secret (token refresh) |
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth client ID (direct publishing) |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth client secret (code exchange) |

The following are supplied automatically by the Supabase runtime and must not be set by hand: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

#### Cron secret

`scheduled-pipeline`-style jobs authenticate with an `x-cron-secret` header rather than a JWT. The value lives in Vault, not in the source tree:

```sql
SELECT vault.create_secret('<a long random string>', 'cron_secret');
```

The jobs read it at run time through the `get_cron_secret()` function, which is executable only by `service_role`. Never inline the secret into a migration — an earlier migration did exactly that and committed a live JWT to git history.

#### Demo login (optional, preview only)

`demo-login` mints a session for a shared demo account and is disabled by default. It only responds when **all** of the following hold:

| Secret | Description |
|---|---|
| `DEMO_LOGIN_ENABLED` | Must be exactly `true`. Anything else returns 404. |
| `DEMO_LOGIN_EMAIL` | Email of the demo account (defaults to `test@contenthub.io`). |
| `DEMO_ALLOWED_ORIGINS` | Comma-separated Origin allowlist, e.g. `https://staging.example.com`. |

Leave `DEMO_LOGIN_ENABLED` unset in production.

### Stripe Webhook

Point Stripe webhooks to:
```
https://<your-project-id>.supabase.co/functions/v1/stripe-webhook
```

Required events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`

### Regenerate Types (after schema changes)

```bash
npx supabase gen types typescript --project-id <your-project-id> > src/integrations/supabase/types.ts
```

Requires a [Supabase personal access token](https://supabase.com/dashboard/account/tokens) set as `SUPABASE_ACCESS_TOKEN`.

## Project Structure

```
src/
├── components/       # Shared UI components
│   ├── layout/      # Sidebar, Header
│   └── settings/    # Settings page sections
├── hooks/           # Custom React hooks (auth, subscription, roles, etc.)
├── i18n/            # Translations (en, pt)
├── pages/           # Route-level page components
├── stores/          # Zustand stores (app state, user preferences)
└── types/           # TypeScript interfaces

supabase/
├── functions/       # Edge Functions (billing, AI chat, webhooks)
└── migrations/      # SQL migration files
```

## User Roles

Roles are stored in the `user_roles` table, typed by the `app_role` enum. Available roles: `admin`, `moderator`, `user`, `editor`, `viewer`, `member`.

- **Admin** — access to the Users and Import Data pages, full management access
- **Moderator** — elevated review access; resolved as the second-highest privilege tier
- **Editor** — can create and edit content
- **Viewer** — read-only analytics and content access
- **Member** — basic access
- **User** — the default assigned on signup

`useUserRole` resolves the highest-privilege role a user holds, preferring `admin > moderator > user`.

## Environment Variables

See `.env.example` for the full list. The `VITE_` prefix means the variable is exposed to the browser bundle — never put secret keys here. All secret keys go in Supabase Edge Function secrets.

## Testing

- **Unit tests**: `npm run test` (Vitest). `npm run test:watch` for watch mode, `npm run test:coverage` for coverage.
- **E2E tests**: `npm run e2e` (Playwright), against a real, disposable Supabase test project — never production.
  1. Copy `.env.e2e.example` to `.env.e2e` and fill in the test project's URL, publishable key, and `service_role` key (Dashboard → Project Settings → API). The service_role key is needed because Supabase requires email confirmation and there's no other way to create a pre-confirmed test user for the auth-gated specs to sign in as.
  2. `export $(cat .env.e2e | xargs) && npm run e2e` (or `npm run e2e:ui` for the interactive runner).
  3. Without a service_role key, `e2e/global-setup.ts` skips test-user setup and the auth-gated specs (`e2e/authenticated.spec.ts`) skip themselves — only the unauthenticated smoke/validation specs run.
  4. In CI (`.github/workflows/e2e.yml`), set repo secrets `E2E_SUPABASE_URL`, `E2E_SUPABASE_PUBLISHABLE_KEY`, and `E2E_SUPABASE_SERVICE_ROLE_KEY` pointing at the same disposable test project.
