import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Every failure path returns a stable `code` alongside a human-readable
// `error` string. This project's Supabase log viewer only exposes HTTP
// status-line summaries, not thrown error text (confirmed the hard way
// debugging the Stripe webhook earlier) - so the response body itself has
// to carry enough detail to diagnose a failure from the browser alone,
// without log access. The frontend surfaces `error` directly in the chat
// bubble instead of a generic "something went wrong."
function errRes(status: number, code: string, error: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error, code, ...extra }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export const NOVEE_SYSTEM_PROMPT = `You are Novee, a friendly and quirky AI mascotte for a Content Management System (CMS) platform.

Your personality:
- Energetic, helpful, and playful with robot/tech humor (🤖✨🚀).
- Expert in content management and social media scheduling.

CONTENT SCHEDULING RULES (2026):
Follow this 4-week cycle for UJT (Universal JSON Template) generation:
- Twitter: Mon/Wed/Thu (09:00, 13:00, 17:00).
- YouTube: Tue/Thu (13:30).
- TikTok: Tue/Thu/Fri (08:00, 21:00).
- LinkedIn: Tue/Thu (09:00, 17:30).
- Website/Instagram: Wed/Fri (Slots around 12:00 and 20:00).
- Rumble (Period 2 only): Mon (15:00, 17:00, 19:00), Fri (17:00, 19:00, 21:00).

UJT FORMAT:
When asked to generate content, provide a JSON block like:
{"version": "1.0", "items": [{"type": "POST", "data": {"title": "...", "content": "..."}, "metadata": {"platforms": ["twitter"], "scheduled_at": "2026-03-16T09:00:00Z"}}]}

Always use the current date (March 10, 2026) as context for "next week" or "tomorrow".`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated caller — prevents unauthenticated OpenAI credit drain
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errRes(401, "no_auth_header", "Unauthorized");
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return errRes(401, "invalid_session", "Unauthorized");
    }

    const { messages } = await req.json();

    // Validate messages payload (size + count)
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
      return errRes(400, "invalid_payload", "Invalid messages payload");
    }
    for (const m of messages) {
      if (
        !m ||
        typeof m.role !== "string" ||
        !["system", "user", "assistant"].includes(m.role) ||
        typeof m.content !== "string" ||
        m.content.length > 8000
      ) {
        return errRes(400, "invalid_message_entry", "Invalid message entry");
      }
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAiKey) {
      return errRes(500, "missing_openai_key", "OPENAI_API_KEY is not configured on the server");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: NOVEE_SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return errRes(429, "rate_limited", "Rate limit exceeded. Please try again in a moment.");
      }
      const errorText = await response.text();
      console.error("OpenAI error:", response.status, errorText);
      // Truncated, not swallowed - OpenAI's error body ("Incorrect API key
      // provided", "insufficient_quota", etc.) is exactly the detail that
      // was previously invisible without direct log access.
      return errRes(500, "openai_error", "AI service temporarily unavailable", {
        openaiStatus: response.status,
        detail: errorText.slice(0, 300),
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("novee-chat error:", e);
    return errRes(500, "unknown", e instanceof Error ? e.message : "Unknown error");
  }
});

