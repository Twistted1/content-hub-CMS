import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const LINKEDIN_CLIENT_ID = Deno.env.get("LINKEDIN_CLIENT_ID");
const TWITTER_CLIENT_ID = Deno.env.get("TWITTER_CLIENT_ID");

const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

function randomString(len = 64) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    .slice(0, len);
}

async function sha256Base64Url(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { platform, redirectTo } = await req.json();
    if (!platform || !["linkedin", "twitter"].includes(platform)) {
      return new Response(JSON.stringify({ error: "Invalid platform" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const state = randomString(48);
    let codeVerifier: string | null = null;
    let authUrl = "";

    if (platform === "linkedin") {
      if (!LINKEDIN_CLIENT_ID) throw new Error("LINKEDIN_CLIENT_ID not configured");
      const redirectUri = `${FUNCTIONS_BASE}/linkedin-oauth-callback`;
      const scope = "openid profile email w_member_social";
      const params = new URLSearchParams({
        response_type: "code",
        client_id: LINKEDIN_CLIENT_ID,
        redirect_uri: redirectUri,
        state,
        scope,
      });
      authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    } else {
      if (!TWITTER_CLIENT_ID) throw new Error("TWITTER_CLIENT_ID not configured");
      codeVerifier = randomString(96);
      const challenge = await sha256Base64Url(codeVerifier);
      const redirectUri = `${FUNCTIONS_BASE}/twitter-oauth-callback`;
      const scope = "tweet.read tweet.write users.read offline.access";
      const params = new URLSearchParams({
        response_type: "code",
        client_id: TWITTER_CLIENT_ID,
        redirect_uri: redirectUri,
        state,
        scope,
        code_challenge: challenge,
        code_challenge_method: "S256",
      });
      authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
    }

    await admin.from("oauth_states").insert({
      state,
      user_id: userId,
      platform,
      code_verifier: codeVerifier,
      redirect_to: redirectTo || null,
    });

    return new Response(JSON.stringify({ url: authUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("oauth-init error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});