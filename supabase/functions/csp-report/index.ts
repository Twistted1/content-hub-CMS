import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BODY_BYTES = 64 * 1024;

interface NormalizedReport {
  document_uri: string | null;
  blocked_uri: string | null;
  violated_directive: string | null;
  effective_directive: string | null;
  original_policy: string | null;
  disposition: string | null;
  status_code: number | null;
  source_file: string | null;
  line_number: number | null;
  column_number: number | null;
  script_sample: string | null;
  referrer: string | null;
}

// Legacy `report-uri` shape: { "csp-report": { "document-uri": ..., ... } }
function normalizeLegacyReport(csp: Record<string, unknown>): NormalizedReport {
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    document_uri: str(csp["document-uri"]),
    blocked_uri: str(csp["blocked-uri"]),
    violated_directive: str(csp["violated-directive"]),
    effective_directive: str(csp["effective-directive"]),
    original_policy: str(csp["original-policy"]),
    disposition: str(csp["disposition"]),
    status_code: num(csp["status-code"]),
    source_file: str(csp["source-file"]),
    line_number: num(csp["line-number"]),
    column_number: num(csp["column-number"]),
    script_sample: str(csp["script-sample"]),
    referrer: str(csp["referrer"]),
  };
}

// Reporting API shape: { type: "csp-violation", url, body: { documentURL, ... } }
function normalizeReportingApiReport(entry: Record<string, unknown>): NormalizedReport {
  const body = (entry.body as Record<string, unknown>) ?? {};
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    document_uri: str(body.documentURL) ?? str(entry.url),
    blocked_uri: str(body.blockedURL),
    violated_directive: str(body.effectiveDirective),
    effective_directive: str(body.effectiveDirective),
    original_policy: str(body.originalPolicy),
    disposition: str(body.disposition),
    status_code: num(body.statusCode),
    source_file: str(body.sourceFile),
    line_number: num(body.lineNumber),
    column_number: num(body.columnNumber),
    script_sample: str(body.sample),
    referrer: str(body.referrer),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413, headers: corsHeaders });
  }

  try {
    const bodyText = await req.text();
    if (!bodyText || bodyText.length > MAX_BODY_BYTES) {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const parsed = JSON.parse(bodyText);
    const userAgent = req.headers.get("user-agent");

    const rows: { normalized: NormalizedReport; raw: unknown }[] = [];

    if (Array.isArray(parsed)) {
      // Reporting API batches multiple reports (of possibly mixed types) per POST.
      for (const entry of parsed) {
        if (entry && typeof entry === "object" && entry.type === "csp-violation") {
          rows.push({ normalized: normalizeReportingApiReport(entry), raw: entry });
        }
      }
    } else if (parsed && typeof parsed === "object" && "csp-report" in parsed) {
      rows.push({
        normalized: normalizeLegacyReport(parsed["csp-report"] as Record<string, unknown>),
        raw: parsed,
      });
    }

    if (rows.length === 0) {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("csp-report is not configured");
    }
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await admin.from("csp_reports").insert(
      rows.map(({ normalized, raw }) => ({
        ...normalized,
        user_agent: userAgent,
        raw_report: raw,
      })),
    );
    if (error) throw error;

    return new Response(null, { status: 204, headers: corsHeaders });
  } catch (_error) {
    // Never fail loudly back to the reporting browser; malformed/oversized
    // reports are dropped rather than surfaced as an error to the client.
    return new Response(null, { status: 204, headers: corsHeaders });
  }
});
