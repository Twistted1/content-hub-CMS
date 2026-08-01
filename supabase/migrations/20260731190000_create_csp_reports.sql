-- CSP is enforced (vercel.json) but was unverifiable: no reporting endpoint
-- meant "zero violations" couldn't be distinguished from "reports have nowhere
-- to go". This table backs the csp-report edge function, which is the target
-- of the report-uri/report-to directives.

CREATE TABLE public.csp_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_uri TEXT,
  blocked_uri TEXT,
  violated_directive TEXT,
  effective_directive TEXT,
  original_policy TEXT,
  disposition TEXT,
  status_code INTEGER,
  source_file TEXT,
  line_number INTEGER,
  column_number INTEGER,
  script_sample TEXT,
  referrer TEXT,
  user_agent TEXT,
  raw_report JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_csp_reports_created_at ON public.csp_reports (created_at DESC);
CREATE INDEX idx_csp_reports_violated_directive ON public.csp_reports (violated_directive);

ALTER TABLE public.csp_reports ENABLE ROW LEVEL SECURITY;

-- Reports are written by the csp-report edge function using the service role
-- key (bypasses RLS), never directly by clients. Only admins can read them.
CREATE POLICY "Admins can view CSP reports"
ON public.csp_reports FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
