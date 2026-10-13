import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Preview demo sign-in.
//
// This function mints a session for a shared demo account, so it is a
// deliberately privileged endpoint. It is gated by three independent
// server-side controls and fails closed when any of them is absent:
//
//   1. DEMO_LOGIN_ENABLED must be exactly "true" (secret; off by default).
//   2. The request Origin must appear in DEMO_ALLOWED_ORIGINS.
//   3. A best-effort per-IP rate limit caps session minting.
//
// The demo account's password is randomly regenerated on every call, so no
// credential for this account survives a single use and none is stored in the
// source tree. Normal email/password sign-in cannot reach the demo account
// with a known password.

const DEMO_ENABLED = Deno.env.get("DEMO_LOGIN_ENABLED") === "true";
const DEMO_EMAIL = Deno.env.get("DEMO_LOGIN_EMAIL") ?? "test@contenthub.io";

const ALLOWED_ORIGINS = (Deno.env.get("DEMO_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const attempts = new Map<string, number[]>();

function corsHeadersFor(origin: string | null) {
  return {
    "Access-Control-Allow-Origin":
      origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

function randomPassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeadersFor(origin) });
  }

  // Fail closed, and look like a missing route when disabled.
  if (!DEMO_ENABLED) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeadersFor(origin), "Content-Type": "application/json" },
    });
  }

  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeadersFor(origin), "Content-Type": "application/json" },
    });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown";

  if (rateLimited(ip)) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { ...corsHeadersFor(origin), "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Demo login is not configured");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const auth = createClient(supabaseUrl, anonKey);

    // A fresh random password per request: the credential handed to the
    // browser has no reuse value and nothing secret lives in this repo.
    const password = randomPassword();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Content Hub Demo" },
    });

    let demoUserId = created?.user?.id;

    if (createError) {
      if (!createError.message.toLowerCase().includes("already")) throw createError;

      // Resolve the existing demo user without scanning the whole user table.
      const { data: profile } = await admin
        .from("profiles")
        .select("user_id")
        .eq("email", DEMO_EMAIL)
        .maybeSingle();

      demoUserId = profile?.user_id ?? undefined;

      if (!demoUserId) {
        const { data: users, error: listError } = await admin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        if (listError) throw listError;
        demoUserId = users.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL)?.id;
      }

      if (!demoUserId) throw new Error("Demo user could not be found");

      const { error: updateError } = await admin.auth.admin.updateUserById(demoUserId, {
        password,
        email_confirm: true,
        user_metadata: { full_name: "Content Hub Demo" },
      });
      if (updateError) throw updateError;
    }

    if (demoUserId) {
      await admin.from("profiles").upsert(
        { user_id: demoUserId, display_name: "Content Hub Demo" },
        { onConflict: "user_id" },
      );

      // The demo account is intentionally unprivileged. Drop anything else so
      // this endpoint can never be used to reach an elevated role.
      await admin.from("user_roles").delete().eq("user_id", demoUserId).neq("role", "user");
      await admin.from("user_roles").upsert(
        { user_id: demoUserId, role: "user" },
        { onConflict: "user_id,role" },
      );
      await admin.from("subscriptions").upsert(
        { user_id: demoUserId, tier: "free" },
        { onConflict: "user_id" },
      );
    }

    const { data: signInData, error: signInError } = await auth.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password,
    });

    if (signInError) throw signInError;

    return new Response(JSON.stringify({ session: signInData.session }), {
      headers: { ...corsHeadersFor(origin), "Content-Type": "application/json" },
    });
  } catch (error) {
    // Never surface internal failure detail to an unauthenticated caller.
    console.error("demo-login error:", error);
    return new Response(JSON.stringify({ error: "Demo login failed" }), {
      status: 400,
      headers: { ...corsHeadersFor(origin), "Content-Type": "application/json" },
    });
  }
});
