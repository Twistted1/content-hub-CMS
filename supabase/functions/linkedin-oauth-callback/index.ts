import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("LINKEDIN_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("LINKEDIN_CLIENT_SECRET")!;
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/linkedin-oauth-callback`;

function htmlResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function closeWindowPage(success: boolean, message: string, redirectTo?: string | null) {
  const payload = JSON.stringify({ source: "oauth-callback", platform: "linkedin", success, message });
  return htmlResponse(`<!doctype html><html><body style="font-family:sans-serif;padding:24px;background:#0F172A;color:#fff">
<h2>${success ? "✅ LinkedIn connected" : "❌ LinkedIn connection failed"}</h2>
<p>${message}</p>
<p>You can close this window.</p>
<script>
  try { if (window.opener) { window.opener.postMessage(${payload}, "*"); } } catch(e){}
  ${redirectTo ? `setTimeout(()=>{ window.location.href=${JSON.stringify(redirectTo)}; }, 800);` : "setTimeout(()=>window.close(), 1500);"}
</script>
</body></html>`);
}

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  if (error) return closeWindowPage(false, `LinkedIn returned: ${error}`);
  if (!code || !state) return closeWindowPage(false, "Missing code or state");

  try {
    const { data: stateRow, error: sErr } = await admin
      .from("oauth_states")
      .select("*")
      .eq("state", state)
      .maybeSingle();
    if (sErr || !stateRow) return closeWindowPage(false, "Invalid or expired state");
    if (new Date(stateRow.expires_at) < new Date()) {
      await admin.from("oauth_states").delete().eq("state", state);
      return closeWindowPage(false, "State expired");
    }

    // Exchange code for token
    const tokenResp = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok) {
      console.error("LinkedIn token exchange failed:", tokenData);
      return closeWindowPage(false, `Token exchange failed: ${tokenData.error_description || tokenData.error || "unknown"}`);
    }

    const accessToken: string = tokenData.access_token;
    const expiresIn: number = tokenData.expires_in || 5184000;
    const scope: string = tokenData.scope || "";
    const refreshToken: string | null = tokenData.refresh_token || null;

    // Fetch userinfo (OIDC)
    const userInfoResp = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userInfo = await userInfoResp.json();
    const providerAccountId = userInfo.sub;
    const handle = userInfo.email || userInfo.name;
    const accountName = userInfo.name || userInfo.email || "LinkedIn Account";
    const avatarUrl = userInfo.picture || null;

    // Store token
    await admin.from("platform_oauth_tokens").upsert({
      user_id: stateRow.user_id,
      platform: "linkedin",
      provider_account_id: providerAccountId,
      handle,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      scope,
      metadata: userInfo,
    }, { onConflict: "user_id,platform" });

    // Upsert into user_platforms for UI
    await admin.from("user_platforms").upsert({
      user_id: stateRow.user_id,
      platform_type: "linkedin",
      account_name: accountName,
      username: handle,
      avatar_url: avatarUrl,
      status: "active",
      last_sync: new Date().toISOString(),
    }, { onConflict: "user_id,platform_type" });

    await admin.from("oauth_states").delete().eq("state", state);

    return closeWindowPage(true, `Connected as ${accountName}`, stateRow.redirect_to);
  } catch (e: any) {
    console.error("linkedin-oauth-callback error:", e);
    return closeWindowPage(false, e.message || "Unknown error");
  }
});