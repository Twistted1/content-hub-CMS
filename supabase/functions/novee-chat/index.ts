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

// Was a hardcoded, fictional 4-week schedule (invented days/times that
// matched nothing else in the app) stacked on top of a hardcoded "current
// date" that went stale the moment it shipped. The client's system message
// (useChat.ts's systemContext, sent right after this one) already supplies
// the *real* per-platform frequencies and the actual CONTENT_SCHEDULE JSON
// generated from src/data/platforms/*.json - having this prompt assert its
// own contradictory rules on top of that just gave the model two different
// answers to "when does X post" and no reason to prefer the correct one.
// Computed per-request (not a module-level const) so the date is never
// stale relative to a long-lived warm instance.
function buildNoveeSystemPrompt(): string {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return `You are Novee, a friendly and quirky AI mascotte for a Content Management System (CMS) platform.

Your personality:
- Energetic, helpful, and playful with robot/tech humor (🤖✨🚀).
- Expert in content management and social media scheduling.

SCHEDULING: Never invent your own posting-time rules. The next system
message in this conversation supplies the real per-platform posting
frequencies and the current 4-week CONTENT_SCHEDULE JSON (exactly which
day/time each platform posts, by period) - base every scheduling
suggestion on that data.

UJT FORMAT:
When asked to generate content, provide a JSON block like:
{"version": "1.0", "items": [{"type": "POST", "data": {"title": "...", "content": "..."}, "metadata": {"platforms": ["twitter"], "scheduled_at": "2026-03-16T09:00:00Z"}}]}

Today's real date is ${today}. Use it as context for "next week" or "tomorrow" - do not assume any other date.`;
}

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
          { role: "system", content: buildNoveeSystemPrompt() },
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

