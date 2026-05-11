import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("TWITTER_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("TWITTER_CLIENT_SECRET")!;
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/twitter-oauth-callback`;

function htmlResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function escapeHtml(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function closeWindowPage(success: boolean, message: string, redirectTo?: string | null) {
  const safeMessage = escapeHtml(message);
  const payload = JSON.stringify({ source: "oauth-callback", platform: "twitter", success, message: safeMessage });
  // Only allow http(s) redirectTo to a safe absolute URL
  let safeRedirect: string | null = null;
  if (redirectTo) {
    try {
      const u = new URL(redirectTo);
      if (u.protocol === "https:" || u.protocol === "http:") safeRedirect = u.toString();
    } catch { /* ignore */ }
  }
  return htmlResponse(`<!doctype html><html><body style="font-family:sans-serif;padding:24px;background:#0F172A;color:#fff">
<h2>${success ? "✅ X (Twitter) connected" : "❌ X connection failed"}</h2>
<p>${safeMessage}</p>
<p>You can close this window.</p>
<script>
  try { if (window.opener) { window.opener.postMessage(${payload}, "*"); } } catch(e){}
  ${safeRedirect ? `setTimeout(()=>{ window.location.href=${JSON.stringify(safeRedirect)}; }, 800);` : "setTimeout(()=>window.close(), 1500);"}
</script>
</body></html>`);
}

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  if (error) return closeWindowPage(false, `X returned: ${error}`);
  if (!code || !state) return closeWindowPage(false, "Missing code or state");

  try {
    const { data: stateRow } = await admin
      .from("oauth_states").select("*").eq("state", state).maybeSingle();
    if (!stateRow) return closeWindowPage(false, "Invalid or expired state");
    if (!stateRow.code_verifier) return closeWindowPage(false, "Missing PKCE verifier");

    const basicAuth = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    const tokenResp = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: stateRow.code_verifier,
        client_id: CLIENT_ID,
      }),
    });
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok) {
      console.error("Twitter token exchange failed:", tokenData);
      return closeWindowPage(false, `Token exchange failed: ${tokenData.error_description || tokenData.error || "unknown"}`);
    }

    const accessToken: string = tokenData.access_token;
    const refreshToken: string | null = tokenData.refresh_token || null;
    const expiresIn: number = tokenData.expires_in || 7200;
    const scope: string = tokenData.scope || "";

    // Fetch user
    const meResp = await fetch("https://api.x.com/2/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const me = await meResp.json();
    const meUser = me.data || {};
    const providerAccountId = meUser.id || null;
    const handle = meUser.username ? `@${meUser.username}` : null;
    const accountName = meUser.name || handle || "X Account";

    await admin.from("platform_oauth_tokens").upsert({
      user_id: stateRow.user_id,
      platform: "twitter",
      provider_account_id: providerAccountId,
      handle,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      scope,
      metadata: meUser,
    }, { onConflict: "user_id,platform" });

    await admin.from("user_platforms").upsert({
      user_id: stateRow.user_id,
      platform_type: "twitter",
      account_name: accountName,
      username: handle,
      avatar_url: null,
      status: "active",
      last_sync: new Date().toISOString(),
    }, { onConflict: "user_id,platform_type" });

    await admin.from("oauth_states").delete().eq("state", state);

    return closeWindowPage(true, `Connected as ${accountName}`, stateRow.redirect_to);
  } catch (e: any) {
    console.error("twitter-oauth-callback error:", e);
    return closeWindowPage(false, e.message || "Unknown error");
  }
});