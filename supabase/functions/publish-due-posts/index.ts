import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const TWITTER_CLIENT_ID = Deno.env.get("TWITTER_CLIENT_ID") || "";
const TWITTER_CLIENT_SECRET = Deno.env.get("TWITTER_CLIENT_SECRET") || "";

const DIRECT_PLATFORMS = new Set(["linkedin", "twitter"]);

function isPrivateOrLocalHost(h: string): boolean {
  h = h.toLowerCase();
  if (h === "localhost" || h === "::1") return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\./);
  if (!m) return false;
  const a = +m[1], b = +m[2];
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
function isSafeWebhookUrl(raw: string): boolean {
  try { const u = new URL(raw); return u.protocol === "https:" && !isPrivateOrLocalHost(u.hostname); } catch { return false; }
}

async function refreshTwitterToken(admin: any, tokenRow: any) {
  if (!tokenRow.refresh_token) return tokenRow;
  const basic = btoa(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`);
  const resp = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokenRow.refresh_token, client_id: TWITTER_CLIENT_ID }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`twitter refresh failed: ${JSON.stringify(data)}`);
  const upd = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || tokenRow.refresh_token,
    expires_at: new Date(Date.now() + (data.expires_in || 7200) * 1000).toISOString(),
  };
  await admin.from("platform_oauth_tokens").update(upd).eq("id", tokenRow.id);
  return { ...tokenRow, ...upd };
}

async function publishLinkedIn(token: any, content: string) {
  const body = {
    author: `urn:li:person:${token.provider_account_id}`,
    lifecycleState: "PUBLISHED",
    specificContent: { "com.linkedin.ugc.ShareContent": { shareCommentary: { text: content }, shareMediaCategory: "NONE" } },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };
  const resp = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json", "X-Restli-Protocol-Version": "2.0.0" },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`linkedin ${resp.status}: ${text}`);
  const data = text ? JSON.parse(text) : {};
  return data.id || resp.headers.get("x-restli-id") || null;
}

async function publishTwitter(token: any, content: string) {
  const resp = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: content.slice(0, 280) }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`twitter ${resp.status}: ${JSON.stringify(data)}`);
  return data.data?.id || null;
}

async function authorize(req: Request, admin: any): Promise<boolean> {
  const cron = req.headers.get("x-cron-secret");
  if (cron) {
    const { data } = await admin.rpc("get_cron_secret");
    return !!data && data === cron;
  }
  return req.headers.get("Authorization") === `Bearer ${SERVICE_KEY}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    if (!(await authorize(req, admin))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nowIso = new Date().toISOString();

    // Atomically claim due posts: mark them as 'generating' transient lock via publish_attempted_at.
    const { data: due, error } = await admin
      .from("posts")
      .select("id, user_id, title, content, cover_image_url")
      .eq("status", "scheduled")
      .lte("scheduled_at", nowIso)
      .is("publish_attempted_at", null)
      .limit(50);
    if (error) throw error;
    if (!due || due.length === 0) {
      return new Response(JSON.stringify({ ok: true, published: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lock them
    const ids = due.map((p: any) => p.id);
    await admin.from("posts").update({ publish_attempted_at: nowIso }).in("id", ids);

    const results: any[] = [];
    for (const post of due) {
      const text = [post.title, post.content].filter(Boolean).join("\n\n");
      const { data: rows } = await admin.from("post_platforms").select("*").eq("post_id", post.id);
      const perPlatform: any[] = [];
      let anySuccess = false;
      let anyFailure = false;

      // Load user's webhooks once
      const { data: webhooks } = await admin
        .from("webhook_configs").select("*").eq("user_id", post.user_id).eq("is_active", true);

      for (const pp of rows || []) {
        const platform = pp.platform;
        try {
          if (DIRECT_PLATFORMS.has(platform)) {
            const { data: token } = await admin
              .from("platform_oauth_tokens").select("*")
              .eq("user_id", post.user_id).eq("platform", platform).maybeSingle();
            if (!token) throw new Error(`No ${platform} OAuth token — connect on Platforms page`);
            let tk = token;
            if (platform === "twitter") {
              const expSoon = token.expires_at && new Date(token.expires_at).getTime() - Date.now() < 60_000;
              if (expSoon) tk = await refreshTwitterToken(admin, token);
            }
            const pid = platform === "linkedin" ? await publishLinkedIn(tk, text) : await publishTwitter(tk, text);
            await admin.from("post_platforms").update({
              status: "published", published_at: new Date().toISOString(), platform_post_id: pid, error_message: null,
            }).eq("id", pp.id);
            perPlatform.push({ platform, success: true, platformPostId: pid });
            anySuccess = true;
          } else {
            // Webhook for IG / FB / TikTok / YouTube / Rumble / Podcast / Website
            const matching = (webhooks || []).filter((w: any) =>
              !w.platforms?.length || w.platforms.includes(platform)
            ).filter((w: any) => isSafeWebhookUrl(w.url));

            if (matching.length === 0) throw new Error(`No active webhook configured for ${platform}`);

            for (const w of matching) {
              const ctrl = new AbortController();
              const t = setTimeout(() => ctrl.abort(), 8000);
              const r = await fetch(w.url, {
                method: "POST",
                redirect: "error",
                signal: ctrl.signal,
                headers: { "Content-Type": "application/json", ...(w.headers as Record<string, string> || {}) },
                body: JSON.stringify({
                  event: "post.publish",
                  platform,
                  post: {
                    id: post.id,
                    title: post.title,
                    content: post.content,
                    coverImageUrl: post.cover_image_url,
                  },
                  timestamp: new Date().toISOString(),
                }),
              });
              clearTimeout(t);
              if (!r.ok) throw new Error(`webhook ${w.name} ${r.status}`);
            }
            await admin.from("post_platforms").update({
              status: "published", published_at: new Date().toISOString(), error_message: null,
            }).eq("id", pp.id);
            perPlatform.push({ platform, success: true, via: "webhook" });
            anySuccess = true;
          }
        } catch (e: any) {
          await admin.from("post_platforms").update({
            status: "failed", error_message: e.message,
          }).eq("id", pp.id);
          perPlatform.push({ platform, success: false, error: e.message });
          anyFailure = true;
        }
      }

      if (anySuccess) {
        await admin.from("posts").update({
          status: "published",
          published_at: new Date().toISOString(),
          publish_error: anyFailure ? perPlatform.filter(p => !p.success).map(p => `${p.platform}: ${p.error}`).join("; ") : null,
        }).eq("id", post.id);
      } else {
        await admin.from("posts").update({
          status: "failed",
          publish_error: perPlatform.map(p => `${p.platform}: ${p.error}`).join("; "),
        }).eq("id", post.id);
      }

      results.push({ postId: post.id, perPlatform });
    }

    return new Response(JSON.stringify({ ok: true, published: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("publish-due-posts error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});