CREATE TABLE IF NOT EXISTS public.platform_oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  provider_account_id TEXT,
  handle TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);

ALTER TABLE public.platform_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own oauth tokens"
  ON public.platform_oauth_tokens FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own oauth tokens"
  ON public.platform_oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own oauth tokens"
  ON public.platform_oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete own oauth tokens"
  ON public.platform_oauth_tokens FOR DELETE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_platform_oauth_tokens_updated_at
BEFORE UPDATE ON public.platform_oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_platform_oauth_tokens_user_platform
  ON public.platform_oauth_tokens(user_id, platform);

-- Short-lived OAuth state cache (CSRF + PKCE verifier for Twitter)
CREATE TABLE IF NOT EXISTS public.oauth_states (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  code_verifier TEXT,
  redirect_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes')
);

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own oauth states"
  ON public.oauth_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own oauth states"
  ON public.oauth_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own oauth states"
  ON public.oauth_states FOR DELETE
  USING (auth.uid() = user_id);