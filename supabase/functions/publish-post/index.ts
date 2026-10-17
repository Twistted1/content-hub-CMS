import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const TWITTER_CLIENT_ID = Deno.env.get("TWITTER_CLIENT_ID")!;
const TWITTER_CLIENT_SECRET = Deno.env.get("TWITTER_CLIENT_SECRET")!;

// Facebook/Instagram publish with a Business Manager System User token
// (deployment-wide, one Page/one IG account) rather than a per-user OAuth
// row — see the matching comment in publish-due-posts/index.ts, which this
// mirrors.
const META_SYSTEM_USER_TOKEN = Deno.env.get("META_SYSTEM_USER_TOKEN") || "";
const META_PAGE_ID = Deno.env.get("META_PAGE_ID") || "";
const META_IG_USER_ID = Deno.env.get("META_IG_USER_ID") || "";

async function refreshTwitterToken(admin: any, tokenRow: any) {
  if (!tokenRow.refresh_token) return tokenRow;
  const basicAuth = btoa(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`);
  const resp = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenRow.refresh_token,
      client_id: TWITTER_CLIENT_ID,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Twitter refresh failed: ${JSON.stringify(data)}`);
  const updated = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || tokenRow.refresh_token,
    expires_at: new Date(Date.now() + (data.expires_in || 7200) * 1000).toISOString(),
  };
  await admin.from("platform_oauth_tokens").update(updated).eq("id", tokenRow.id);
  return { ...tokenRow, ...updated };
}

async function getValidToken(admin: any, userId: string, platform: string) {
  const { data: token } = await admin
    .from("platform_oauth_tokens").select("*")
    .eq("user_id", userId).eq("platform", platform).maybeSingle();
  if (!token) throw new Error(`No connected ${platform} account. Please connect first.`);
  const expiresAt = token.expires_at ? new Date(token.expires_at) : null;
  const expiringSoon = expiresAt && expiresAt.getTime() - Date.now() < 60_000;
  if (platform === "twitter" && expiringSoon) {
    return await refreshTwitterToken(admin, token);
  }
  if (platform === "linkedin" && expiresAt && expiresAt.getTime() < Date.now()) {
    throw new Error("LinkedIn token expired. Please reconnect LinkedIn in Platforms.");
  }
  return token;
}

async function publishToLinkedIn(token: any, content: string) {
  const authorUrn = `urn:li:person:${token.provider_account_id}`;
  const body = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: content },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };
  const resp = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`LinkedIn publish failed [${resp.status}]: ${text}`);
  const data = text ? JSON.parse(text) : {};
  return { platformPostId: data.id || resp.headers.get("x-restli-id") };
}

async function publishToTwitter(token: any, content: string) {
  const resp = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: content.slice(0, 280) }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`X publish failed [${resp.status}]: ${JSON.stringify(data)}`);
  return { platformPostId: data.data?.id };
}

/**
 * Exchange the System User token for the Page's own access token — necessary
 * because Graph API requires posting *as the Page* (error `(#200)`
 * otherwise), even though the System User token itself carries
 * pages_manage_posts/pages_read_engagement. Never log the returned token —
 * only ever the `error` field of a failed response.
 */
async function getPageAccessToken(): Promise<string> {
  if (!META_SYSTEM_USER_TOKEN || !META_PAGE_ID) {
    throw new Error("Facebook/Instagram publishing not configured: set META_SYSTEM_USER_TOKEN and META_PAGE_ID");
  }
  const resp = await fetch(
    `https://graph.facebook.com/v21.0/${META_PAGE_ID}?fields=access_token&access_token=${META_SYSTEM_USER_TOKEN}`,
  );
  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error(`Facebook page-token exchange failed [${resp.status}]: ${JSON.stringify({ error: data.error })}`);
  }
  return data.access_token;
}

/**
 * Facebook can post text-only (unlike Instagram), so a cover image switches
 * the endpoint to `/photos` (image by URL, no upload/container step) rather
 * than being required. Graph API takes the token as a form field, not an
 * Authorization header.
 */
async function publishToFacebook(content: string, imageUrl?: string | null) {
  const pageToken = await getPageAccessToken();
  const endpoint = imageUrl
    ? `https://graph.facebook.com/v21.0/${META_PAGE_ID}/photos`
    : `https://graph.facebook.com/v21.0/${META_PAGE_ID}/feed`;
  const body = new URLSearchParams({
    access_token: pageToken,
    ...(imageUrl ? { url: imageUrl, caption: content } : { message: content }),
  });
  const resp = await fetch(endpoint, { method: "POST", body });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Facebook publish failed [${resp.status}]: ${JSON.stringify({ error: data.error })}`);
  return { platformPostId: data.post_id || data.id };
}

/**
 * Instagram cannot publish text-only, and publishing is always two calls:
 * create a media container, then publish it by `creation_id`. Uses the
 * Page's access token (same exchange as Facebook) — the IG professional
 * account authenticates through its connected Page, not its own token.
 */
async function publishToInstagram(content: string, imageUrl?: string | null) {
  if (!META_IG_USER_ID) {
    throw new Error("Instagram publishing not configured: set META_IG_USER_ID (and META_SYSTEM_USER_TOKEN/META_PAGE_ID)");
  }
  if (!imageUrl) {
    throw new Error("Instagram cannot publish text-only — this post has no cover image");
  }
  const pageToken = await getPageAccessToken();
  const createResp = await fetch(`https://graph.facebook.com/v21.0/${META_IG_USER_ID}/media`, {
    method: "POST",
    body: new URLSearchParams({ access_token: pageToken, image_url: imageUrl, caption: content }),
  });
  const createData = await createResp.json();
  if (!createResp.ok || !createData.id) {
    throw new Error(`Instagram media-create failed [${createResp.status}]: ${JSON.stringify({ error: createData.error })}`);
  }
  const publishResp = await fetch(`https://graph.facebook.com/v21.0/${META_IG_USER_ID}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ access_token: pageToken, creation_id: createData.id }),
  });
  const publishData = await publishResp.json();
  if (!publishResp.ok) throw new Error(`Instagram media-publish failed [${publishResp.status}]: ${JSON.stringify({ error: publishData.error })}`);
  return { platformPostId: publishData.id };
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

    const { postId, platforms } = await req.json();
    if (!postId || !Array.isArray(platforms) || platforms.length === 0) {
      return new Response(JSON.stringify({ error: "postId and platforms required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: post, error: postErr } = await admin
      .from("posts").select("*").eq("id", postId).eq("user_id", userId).maybeSingle();
    if (postErr || !post) throw new Error("Post not found");

    const content = [post.title, post.content].filter(Boolean).join("\n\n");
    const results: any[] = [];

    for (const platform of platforms) {
      try {
        let r: any;
        if (platform === "facebook" || platform === "instagram") {
          // Deployment-wide System User token, not a per-user OAuth row.
          r = platform === "facebook"
            ? await publishToFacebook(content, post.cover_image_url)
            : await publishToInstagram(content, post.cover_image_url);
        } else {
          const token = await getValidToken(admin, userId, platform);
          if (platform === "linkedin") r = await publishToLinkedIn(token, content);
          else if (platform === "twitter") r = await publishToTwitter(token, content);
          else throw new Error(`Direct publishing not supported for ${platform}`);
        }

        await admin.from("post_platforms").upsert({
          post_id: postId,
          platform,
          status: "published",
          published_at: new Date().toISOString(),
          platform_post_id: r.platformPostId || null,
          error_message: null,
        }, { onConflict: "post_id,platform" } as any);

        results.push({ platform, success: true, platformPostId: r.platformPostId });
      } catch (e: any) {
        console.error(`Publish to ${platform} failed:`, e);
        await admin.from("post_platforms").upsert({
          post_id: postId,
          platform,
          status: "failed",
          error_message: e.message,
        }, { onConflict: "post_id,platform" } as any);
        results.push({ platform, success: false, error: e.message });
      }
    }

    const anySuccess = results.some(r => r.success);
    if (anySuccess) {
      await admin.from("posts").update({
        status: "published",
        published_at: new Date().toISOString(),
        publish_attempted_at: new Date().toISOString(),
      }).eq("id", postId);
    } else {
      await admin.from("posts").update({
        publish_attempted_at: new Date().toISOString(),
        publish_error: results.map(r => `${r.platform}: ${r.error}`).join("; "),
      }).eq("id", postId);
    }

    return new Response(JSON.stringify({ success: anySuccess, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("publish-post error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});