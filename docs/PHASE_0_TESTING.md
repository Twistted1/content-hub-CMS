# Phase 0 — Testing Foundation

> **Superseded — all items below are done.** Live status now lives in
> `docs/MASTER_CHECKLIST.md`. This file is kept as the original plan for
> reference, not updated further.

**Purpose:** Prerequisite to Phase 1 of the Project Master Checklist. Phase 1
asks to "Run complete test suite," "Run end-to-end tests," and "Perform
regression testing" — none of that is currently possible because **no test
infrastructure exists in this repo**: zero test files, zero testing
dependencies in `package.json`, no CI workflow. Phase 0 builds the thing
Phase 1 assumes already exists.

Tailored to this stack specifically (Vite 7 + React 18 + TypeScript +
Supabase + TanStack Query + Zustand), not generic boilerplate.

---

## 0.1 — Unit & Component Testing Setup

- [ ] Install **Vitest** (shares config with Vite already in use — no second
      bundler to maintain, Jest-compatible API)
- [ ] Install **@testing-library/react** + **@testing-library/jest-dom** +
      **@testing-library/user-event** for component-level tests
- [ ] Add `vitest.config.ts` (or a `test` block in `vite.config.ts`):
      `environment: "jsdom"`, path alias `@` matching `tsconfig.json`'s
      `paths`, a `setupFiles` entry for jest-dom matchers
- [ ] Add `src/test/setup.ts` (jest-dom import, any global mocks)
- [ ] Add `package.json` scripts: `"test": "vitest run"`,
      `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`
- [ ] Install **@vitest/coverage-v8** for the coverage script
- [ ] Decide + document convention: colocated `*.test.ts(x)` next to the
      file under test (matches how the codebase is already organized by
      feature, not a parallel `__tests__` tree)

## 0.2 — Mocking the Supabase Boundary

Nearly every hook in `src/hooks/*` calls `supabase.from(...)` directly.
Tests must not hit the live project.

- [ ] Install **msw** (Mock Service Worker) to intercept Supabase REST calls
      at the network layer, or build a lightweight `vi.mock('@/integrations/supabase/client')`
      per-test-file for simpler cases
- [ ] Write one shared test helper (`src/test/mockSupabase.ts`) other test
      files import, so 20+ hooks aren't each hand-rolling a mock client
- [ ] Add a fixture set of realistic fake rows (posts, templates, automations)
      for hooks to return — reuse the shape already defined in
      `src/integrations/supabase/types.ts`

## 0.3 — First Coverage Pass (priority order, given we start at 0%)

Highest-value targets first — pure logic and the code most likely to
silently regress, not "whatever's easiest":

- [ ] `src/utils/scheduling.ts` — pure functions (`getNextOptimalDate`,
      `getCurrentPeriod`, day/slot math), no mocking needed, cheapest tests
      to write and highest bug-catching value per test
- [ ] `src/pages/Index.tsx` dashboard computations — the real-data
      replacements from this session (platform health %, goal deltas,
      publish-rate math, month/week trend booleans). These are new,
      hand-written date-range logic with off-by-one risk (`startOfWeek`,
      `subMonths` boundaries) and zero coverage today
      — the single most regression-prone area in the app right now
- [ ] `src/hooks/useTemplates.ts` — newest hook, CRUD mutations, DB-backed
      as of this session
- [ ] `src/hooks/useDashboardStats.ts` — platform breakdown + recent
      activity aggregation
- [ ] `src/i18n/*` — turn the ad-hoc parity check (the python script used
      manually all session to diff `en.json`/`pt.json` keys) into a real
      test that runs in CI, so a future edit can't silently drop a locale key
- [ ] Auth form validation (`src/pages/Auth.tsx`) — sign-in/sign-up field
      validation logic, independent of actually calling Supabase auth

## 0.4 — End-to-End Testing Setup

- [ ] Install **Playwright** (`@playwright/test`) — this environment
      already has Chromium pre-installed for it, so E2E runs don't need a
      separate browser-download step in CI
- [ ] Add `playwright.config.ts` pointed at `npm run dev` (webServer option,
      auto-starts/tears-down the dev server for the test run)
- [ ] One golden-path spec first, nothing more: sign up → land on
      dashboard → create a post → schedule it → see it on the calendar →
      log out. This single flow exercises Auth, Supabase writes, routing,
      and the calendar — most bug-catching value for the least test code
- [ ] A second spec for the thing most likely to break without warning:
      the Templates CRUD flow added this session (create → edit → favorite
      → delete, verify it survives a page reload)
- [ ] Needs a dedicated Supabase test project or a seeded/cleaned test user
      — **decision point for you**: run E2E against a disposable Supabase
      branch/project, or against a test account in the real project with
      teardown after each run? Either works; picking one is a prerequisite
      to writing the spec, not optional

## 0.5 — Continuous Integration

There is no `.github/workflows` directory — tests that only run when someone
remembers to run them locally don't stay green.

- [ ] Add `.github/workflows/ci.yml`: on push + PR, run `npm ci`,
      `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run build`
- [ ] Add a second job (or step) for `npx playwright test`, only after 0.4
      lands — E2E is slower, can run after the fast checks pass
- [ ] Branch protection on `main` requiring the CI check to pass before
      merge (GitHub repo setting, not a code change — flagging as a
      decision for you since it affects how you push to `main` going
      forward)

## 0.6 — Coverage Baseline

- [ ] Set an initial `vitest.config.ts` coverage threshold low enough to
      pass immediately (e.g. 15–20% given the starting point is 0%), not
      100% — a threshold nobody can hit gets deleted or ignored within a week
- [ ] Revisit and ratchet the threshold up each time a new feature area
      gets its first tests, rather than trying to backfill everything at once

---

## Why this is Phase 0 and not folded into Phase 1

Phase 1's items assume a test suite that can be run. Right now "run complete
test suite" has no command to execute — `npm test` doesn't exist. Treating
that as a Phase 1 checkbox to tick would mean either skipping it silently or
writing a shallow suite under time pressure just to check a box. Phase 0 is
scoped narrowly: get the infrastructure and the highest-risk coverage in
place first, so Phase 1's testing items become real, executable steps
instead of aspirational ones.
