# sql-options — SQL that must NOT be auto-applied

Two pieces of SQL that are ready to use but are deliberately **not** in
`supabase/migrations/`. Anything in the migrations directory runs on the next
`supabase db push`, and both of these need either verification or a decision
first:

| File | What it is | Why it is not a migration |
|---|---|---|
| `01-baseline-articles-authors.sql` | The last two tables no migration creates (`articles`, `authors`) | The column shapes are probed but **nullability and defaults are not verified**. Confirm against `information_schema`, then move it into `supabase/migrations/` under the filename given in its header. |
| `02-published-post-read.sql` | A safe public view of published posts, plus a name-agnostic way to drop the blanket `posts` read policy | Part A is additive and safe; **Part B removes a live capability and is a decision**, not a fix. Applying it unasked would change production behaviour. |

Nothing here modifies production unless you run it. Part A of file 2 is safe to
apply at any time; Part B is commented out.

## Background

- `docs/READINESS_GAP_ANALYSIS.md` — the migration-replayability analysis and why
  a baseline must sort **first** (Supabase applies migrations in filename order,
  so a CREATE TABLE at the end of the list never runs).
- `docs/HEADLESS_CONSUMPTION.md` — the website bridge, the `articles` shape, and
  why a bridge insert must be an explicit human action.
- `docs/MASTER_CHECKLIST.md` — Phase 23 covers this directory.

## The verification query

Run this before trusting any column list in these files — including the ones
below, which were established by probing the live PostgREST API rather than by
reading `types.ts` (it is stale: it omits `articles.date` and still lists
`per_user_monthly_budget` as absent when it exists).

```sql
select table_name, column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('articles', 'authors')
 order by table_name, ordinal_position;

-- and the policies, before touching any of them
select tablename, polname, cmd, roles, qual
  from pg_policies
 where schemaname = 'public' and tablename in ('posts', 'articles', 'authors')
 order by tablename, cmd, polname;
```
