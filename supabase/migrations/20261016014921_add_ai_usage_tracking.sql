-- The only budget check in the app (content-pipeline) sums cost_estimate
-- across ALL users against one shared instance-wide limit, and the other two
-- AI call sites (novee-chat, generate-strategy) have no check at all. That
-- means: (a) any authenticated free signup can call these directly and spend
-- the owner's OpenAI/Gemini budget, and (b) even where a check exists, one
-- heavy user exhausts it for everyone else.
--
-- Fix: a dedicated, append-only usage log shared by all three call sites, plus
-- a per-user monthly cap alongside the existing instance-wide one. The
-- instance-wide limit is kept (it protects total spend); the per-user limit is
-- new and is what actually stops a single account from draining it alone.

ALTER TABLE public.project_settings
  ADD COLUMN IF NOT EXISTS per_user_monthly_budget numeric NOT NULL DEFAULT 5.00;

COMMENT ON COLUMN public.project_settings.per_user_monthly_budget IS
  'Per-user monthly AI spend cap in USD, enforced alongside monthly_openai_budget (the instance-wide total). Prevents one account from exhausting the shared budget alone. Adjustable like monthly_openai_budget.';

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL, -- 'content-pipeline' | 'novee-chat' | 'generate-strategy'
  cost_estimate numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_usage_log IS
  'Append-only AI spend record, one row per call, written by the service role after a successful OpenAI/Gemini call. Source of truth for both the per-user and instance-wide budget checks.';

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_created
  ON public.ai_usage_log (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created
  ON public.ai_usage_log (created_at);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI usage"
  ON public.ai_usage_log FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can view all AI usage"
  ON public.ai_usage_log FOR SELECT
  USING (has_role((select auth.uid()), 'admin'));

-- No INSERT/UPDATE/DELETE policy for anon/authenticated: only the service
-- role (which bypasses RLS) writes to this table, from the edge functions.
