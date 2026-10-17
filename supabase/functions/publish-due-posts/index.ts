import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildDelivery, deliveryHeaders, formatContentForPlatform, SIGNING_SECRET_ENV } from "../_shared/publishDelivery.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const TWITTER_CLIENT_ID = Deno.env.get("TWITTER_CLIENT_ID") || "";
const TWITTER_CLIENT_SECRET = Deno.env.get("TWITTER_CLIENT_SECRET") || "";

// Facebook publishes with a Business Manager System User token, not a
// per-user OAuth token like LinkedIn/Twitter — one token posts to one Page on
// behalf of the whole deployment, so it lives in env vars rather than a
// `platform_oauth_tokens` row. A System User token derived from Business
// Manager with Page-scoped permissions does not expire on its own the way a
// regular user token does.
const META_SYSTEM_USER_TOKEN = Deno.env.get("META_SYSTEM_USER_TOKEN") || "";
const META_PAGE_ID = Deno.env.get("META_PAGE_ID") || "";

// HMAC key for outbound webhook signatures. Unset means deliveries go out
// unsigned — they still work, and the delivery result records `signed: false` so
// the gap is visible rather than silent. See tools/webhook-receiver/.
const WEBHOOK_SIGNING_SECRET = Deno.env.get(SIGNING_SECRET_ENV) || "";

// "facebook" is also direct-publish (see publishFacebook below) but is
// dispatched on its own branch before this set is checked, since it uses a
// deployment-wide token rather than a per-user platform_oauth_tokens row.
const DIRECT_PLATFORMS = new Set(["linkedin", "twitter"]);

// Must match the `p_max_attempts` default in `claim_due_posts`.
const MAX_PUBLISH_ATTEMPTS = 5;

// Kept in step with the equivalent guard in `content-pipeline`. This one used to
// be the weaker of the two: it missed 0.0.0.0/8, CGNAT (100.64.0.0/10) and every
// IPv6 private range, all of which are unroutable in public DNS anyway, so
// closing the gap cannot block a legitimate receiver.
function isPrivateOrLocalHost(h: string): boolean {
  h = h.toLowerCase();
  if (h === "localhost" || h === "::1" || h.endsWith(".localhost") || h === "ip6-localhost") return true;
  // IPv6 loopback / link-local / unique-local
  if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;

  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = +m[1], b = +m[2];
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
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

/**
 * Facebook can post text-only (unlike Instagram), so a cover image switches
 * the endpoint to `/photos` (which takes the image by URL, no upload/container
 * step) rather than being required. Graph API takes the token as a form field,
 * not an Authorization header.
 */
async function publishFacebook(content: string, imageUrl?: string | null) {
  if (!META_SYSTEM_USER_TOKEN || !META_PAGE_ID) {
    throw new Error("Facebook publishing not configured: set META_SYSTEM_USER_TOKEN and META_PAGE_ID");
  }
  const endpoint = imageUrl
    ? `https://graph.facebook.com/v21.0/${META_PAGE_ID}/photos`
    : `https://graph.facebook.com/v21.0/${META_PAGE_ID}/feed`;
  const body = new URLSearchParams({
    access_token: META_SYSTEM_USER_TOKEN,
    ...(imageUrl ? { url: imageUrl, caption: content } : { message: content }),
  });
  const resp = await fetch(endpoint, { method: "POST", body });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`facebook ${resp.status}: ${JSON.stringify(data)}`);
  return data.post_id || data.id || null;
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

    // Claim and stamp in one atomic statement (`FOR UPDATE SKIP LOCKED` inside
    // `claim_due_posts`), so overlapping cron ticks cannot both take a post.
    // Rows re-enter the claim window once the backoff since their previous
    // attempt has elapsed, and drop out for good at the attempt cap.
    const { data: due, error } = await admin.rpc("claim_due_posts", {
      p_batch_size: 50,
    });
    if (error) throw error;
    if (!due || due.length === 0) {
      return new Response(JSON.stringify({ ok: true, published: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // `claim_due_posts` returns only the six columns the queue needs. The
    // delivery payload also carries excerpt/tags/type/scheduled_at/category, so
    // fetch those in one extra query rather than widening the RPC's RETURNS
    // TABLE — that would need a DROP FUNCTION + CREATE (the signature cannot be
    // replaced in place) and therefore another migration, for no behavioural
    // gain.
    const { data: fullRows } = await admin
      .from("posts")
      .select("id, excerpt, tags, type, scheduled_at, category")
      .in("id", due.map((p: any) => p.id));
    const fullById = new Map<string, any>((fullRows || []).map((r: any) => [r.id, r]));

    const results: any[] = [];
    for (const claimed of due) {
      const post = { ...claimed, ...(fullById.get(claimed.id) || {}) };
      const text = [post.title, post.content].filter(Boolean).join("\n\n");
      const { data: rows } = await admin.from("post_platforms").select("*").eq("post_id", post.id);
      const perPlatform: any[] = [];
      let anySuccess = false;
      let anyFailure = false;
      // Whether the webhook deliveries for this platform carried a signature.
      let signed = false;

      // Load user's webhooks once
      const { data: webhooks } = await admin
        .from("webhook_configs").select("*").eq("user_id", post.user_id).eq("is_active", true);

      for (const pp of rows || []) {
        const platform = pp.platform;
        // Truncate per platform before anything is sent. The same `text` used to
        // go to every platform verbatim, so a long article failed LinkedIn and
        // Instagram outright while being silently cut to 280 for X.
        const platformText = formatContentForPlatform(platform, text);
        try {
          if (platform === "facebook") {
            // Deployment-wide System User token, not a per-user OAuth row —
            // see the META_SYSTEM_USER_TOKEN/META_PAGE_ID comment above.
            const pid = await publishFacebook(platformText, post.cover_image_url);
            await admin.from("post_platforms").update({
              status: "published", published_at: new Date().toISOString(), platform_post_id: pid, error_message: null,
            }).eq("id", pp.id);
            perPlatform.push({ platform, success: true, platformPostId: pid });
            anySuccess = true;
          } else if (DIRECT_PLATFORMS.has(platform)) {
            const { data: token } = await admin
              .from("platform_oauth_tokens").select("*")
              .eq("user_id", post.user_id).eq("platform", platform).maybeSingle();
            if (!token) throw new Error(`No ${platform} OAuth token — connect on Platforms page`);
            let tk = token;
            if (platform === "twitter") {
              const expSoon = token.expires_at && new Date(token.expires_at).getTime() - Date.now() < 60_000;
              if (expSoon) tk = await refreshTwitterToken(admin, token);
            }
            const pid = platform === "linkedin"
              ? await publishLinkedIn(tk, platformText)
              : await publishTwitter(tk, platformText);
            await admin.from("post_platforms").update({
              status: "published", published_at: new Date().toISOString(), platform_post_id: pid, error_message: null,
            }).eq("id", pp.id);
            perPlatform.push({ platform, success: true, platformPostId: pid });
            anySuccess = true;
          } else {
            // Webhook for IG / TikTok / YouTube / Rumble / Podcast / Website
            const matching = (webhooks || []).filter((w: any) =>
              !w.platforms?.length || w.platforms.includes(platform)
            ).filter((w: any) => isSafeWebhookUrl(w.url));

            if (matching.length === 0) throw new Error(`No active webhook configured for ${platform}`);

            for (const w of matching) {
              // One envelope shape for every webhook delivery, shared with
              // `content-pipeline`'s immediate path so a receiver cannot be
              // written against one and silently mishandle the other.
              const payload = buildDelivery({
                postId: post.id,
                platform,
                title: post.title,
                content: post.content,
                excerpt: post.excerpt,
                tags: post.tags,
                type: post.type,
                coverImageUrl: post.cover_image_url,
                scheduledAt: post.scheduled_at,
                category: post.category,
              });
              // Sign the exact bytes that are sent, so the receiver can verify
              // provenance instead of trusting whatever reaches its URL.
              const body = JSON.stringify(payload);
              const headers = await deliveryHeaders(
                body,
                payload.delivery_id,
                WEBHOOK_SIGNING_SECRET,
                (w.headers as Record<string, string>) || {},
              );

              const ctrl = new AbortController();
              const t = setTimeout(() => ctrl.abort(), 8000);
              const r = await fetch(w.url, {
                method: "POST",
                redirect: "error",
                signal: ctrl.signal,
                headers,
                body,
              });
              clearTimeout(t);
              if (!r.ok) throw new Error(`webhook ${w.name} ${r.status}`);
              signed = !!WEBHOOK_SIGNING_SECRET;
            }
            await admin.from("post_platforms").update({
              status: "published", published_at: new Date().toISOString(), error_message: null,
            }).eq("id", pp.id);
            perPlatform.push({ platform, success: true, via: "webhook", signed });
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

      if (anySuccess && !anyFailure) {
        // Fully delivered: clear the retry bookkeeping so the post is done.
        await admin.from("posts").update({
          status: "published",
          published_at: new Date().toISOString(),
          publish_error: null,
          publish_attempted_at: null,
          publish_attempts: 0,
        }).eq("id", post.id);
      } else if (anySuccess) {
        // Partial delivery: keep the successful platforms, leave the post out
        // of the queue rather than re-publishing what already landed.
        await admin.from("posts").update({
          status: "published",
          published_at: new Date().toISOString(),
          publish_error: perPlatform.filter(p => !p.success).map(p => `${p.platform}: ${p.error}`).join("; "),
          publish_attempted_at: null,
        }).eq("id", post.id);
      } else {
        const attempts = (post as any).publish_attempts ?? 1;
        const exhausted = attempts >= MAX_PUBLISH_ATTEMPTS;
        await admin.from("posts").update({
          // Stay 'scheduled' while retries remain so the next cron tick picks
          // the post back up after its backoff; park as 'failed' only at the cap.
          status: exhausted ? "failed" : "scheduled",
          publish_error: `attempt ${attempts}/${MAX_PUBLISH_ATTEMPTS}: ` +
            perPlatform.map(p => `${p.platform}: ${p.error}`).join("; "),
        }).eq("id", post.id);
      }

      results.push({ postId: post.id, perPlatform, attempts: (post as any).publish_attempts });
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