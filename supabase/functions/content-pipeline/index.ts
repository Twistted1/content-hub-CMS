import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildDelivery, deliveryHeaders, SIGNING_SECRET_ENV } from "../_shared/publishDelivery.ts";
import { checkAiBudget, recordAiUsage, budgetExceededResponse } from "../_shared/aiBudget.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// HMAC key for outbound webhook signatures. Unset means deliveries go out
// unsigned — they still work, and the result records `signed: false` so the gap
// is visible rather than silent. See tools/webhook-receiver/.
const WEBHOOK_SIGNING_SECRET = Deno.env.get(SIGNING_SECRET_ENV) || "";

// SSRF guard: only allow https webhooks to public hosts
function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h === "ip6-localhost") return true;
  // IPv6 loopback / link-local / ULA
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  // IPv4 dotted quad checks
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1]), parseInt(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  return false;
}

function isSafeWebhookUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    if (!u.hostname) return false;
    if (isPrivateOrLocalHost(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

// The accepted `scheduleMode` values. This list is duplicated in the frontend
// at src/utils/scheduleMode.ts (a Deno function cannot import from the browser
// bundle) and the two are kept in lockstep by
// src/utils/scheduleModeParity.test.ts, which fails if either side drifts or if
// any call site sends a mode that is not listed here.
const SCHEDULE_MODES = ["immediate", "scheduled", "draft", "awaiting_review"] as const;
type ScheduleMode = (typeof SCHEDULE_MODES)[number];

/**
 * Absent means "immediate" (the shipped default, preserved below). An
 * unrecognised value resolves to "scheduled" — a held post — rather than
 * "immediate", so a typo can never cause an unreviewed publish.
 */
function normalizeScheduleMode(raw: unknown): ScheduleMode {
  if (raw === undefined || raw === null || raw === "") return "immediate";
  return (SCHEDULE_MODES as readonly string[]).includes(raw as string)
    ? (raw as ScheduleMode)
    : "scheduled";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    // `category` is optional and caller-supplied (schedule-from-templates passes
    // the day's WEBSITE_CATEGORY_BY_DAY value for website posts). Nothing used
    // to populate posts.category at all, so it was always null and every
    // delivery's category was silently dropped before it ever reached a
    // receiver — see _shared/publishDelivery.ts's DeliveryInput.category.
    const { topic, platforms, scheduleMode, scheduledAt, user_id, category } = await req.json();
    // Resolve once, so the stored value, the gate below and any future consumer
    // all agree on what this request asked for.
    const mode = normalizeScheduleMode(scheduleMode);

    const isServiceRequest = authHeader === `Bearer ${supabaseServiceKey}`;
    let authenticatedUserId: string | null = null;

    if (!isServiceRequest) {
      const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader! } },
      });
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      authenticatedUserId = user.id;
    }

    // Determine target user (either from auth or passed by service role)
    const targetUserId = isServiceRequest ? user_id : authenticatedUserId;
    if (!targetUserId) throw new Error("Missing target user");

    // Pre-flight budget check: both the instance-wide total and this user's
    // own monthly cap, so a single account cannot exhaust the shared budget
    // alone (see _shared/aiBudget.ts for why).
    const budgetCheck = await checkAiBudget(adminClient, targetUserId);
    if (!budgetCheck.allowed) {
      return new Response(JSON.stringify(budgetExceededResponse(budgetCheck)), {
        status: 402, // Payment Required / Over budget
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!topic || !platforms?.length) {
      return new Response(JSON.stringify({ error: "topic and platforms are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Create pipeline run
    const { data: pipelineRun, error: insertError } = await adminClient
      .from("pipeline_runs")
      .insert({
        user_id: targetUserId,
        topic,
        platforms,
        schedule_mode: mode,
        scheduled_at: scheduledAt || null,
        status: "running",
        steps: [{ step: "started", ts: new Date().toISOString() }],
      })
      .select()
      .single();

    if (insertError) throw insertError;
    const runId = pipelineRun.id;

    const updateStep = async (step: string, data?: any) => {
      const { data: current } = await adminClient
        .from("pipeline_runs")
        .select("steps")
        .eq("id", runId)
        .single();
      const steps = [...((current?.steps as any[]) || []), { step, ts: new Date().toISOString(), ...data }];
      await adminClient.from("pipeline_runs").update({ steps }).eq("id", runId);
    };

    // 2. IDEA GENERATION
    await updateStep("generating_content");

    const platformList = platforms.join(", ");
    const contentPrompt = `You are a professional social media content creator. Generate a complete post about: "${topic}"
Target platforms: ${platformList}
Return a JSON object with:
{
  "title": "A compelling title (max 80 chars)",
  "content": "The full post content optimized for ${platformList}.",
  "excerpt": "A summary",
  "type": "text",
  "tags": ["tag1", "tag2"],
  "imagePrompt": "A description for a cover image."
}
Return ONLY JSON.`;

    const contentResponse = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: contentPrompt }],
        response_format: { type: "json_object" }
      }),
    });

    const contentData = await contentResponse.json();
    let generatedContent: any = {};
    try {
      generatedContent = JSON.parse(contentData.choices?.[0]?.message?.content || "{}");
    } catch (parseErr) {
      console.error("Failed to parse OpenAI JSON, using fallback:", parseErr);
      generatedContent = {};
    }

    // Safe fallbacks so the post insert never violates NOT NULL constraints
    const safeTitle = (generatedContent.title && String(generatedContent.title).trim()) || topic.slice(0, 80);
    const safeContent = (generatedContent.content && String(generatedContent.content).trim()) || topic;
    generatedContent.title = safeTitle;
    generatedContent.content = safeContent;

    // Estimate Cost: GPT-4o tokens (approx $0.01)
    let estimatedCost = 0.01;

    await updateStep("content_generated", { title: generatedContent.title });

    // 3. IMAGE GENERATION (Optimization: 1024x1024 only)
    await updateStep("generating_image");

    let finalImageUrl: string | null = null;
    try {
      const dalleResponse = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: generatedContent.imagePrompt || `Professional image for: ${topic}`,
          n: 1,
          size: "1024x1024",
          quality: "standard",
        }),
      });

      if (dalleResponse.ok) {
        const dalleData = await dalleResponse.json();
        const openaiImageUrl = dalleData.data?.[0]?.url;
        estimatedCost += 0.04; // DALL-E 3 Standard 1024x1024 cost

        // Optimization: Download and Upload to Supabase Storage
        if (openaiImageUrl) {
          try {
            const imgFetch = await fetch(openaiImageUrl);
            const imgBlob = await imgFetch.blob();
            const fileName = `${targetUserId}/${runId}.png`;
            
            const { data: uploadData, error: uploadError } = await adminClient.storage
              .from('post-images')
              .upload(fileName, imgBlob, { upsert: true, contentType: 'image/png' });

            if (!uploadError) {
              const { data: { publicUrl } } = adminClient.storage.from('post-images').getPublicUrl(fileName);
              finalImageUrl = publicUrl;
              await updateStep("image_stored", { url: publicUrl });
            } else {
              console.error("Storage upload error:", uploadError);
              finalImageUrl = openaiImageUrl; // Fallback
            }
          } catch (storageErr) {
            console.error("Storage processing error:", storageErr);
            finalImageUrl = openaiImageUrl;
          }
        }
      }
    } catch (imgErr: any) {
      console.error("Image gen error:", imgErr);
    }

    // Record spend now that it's final (text + image, if any), so the budget
    // check above sees it on the next call regardless of what happens below.
    await recordAiUsage(adminClient, targetUserId, "content-pipeline", estimatedCost);

    // 4. THE GATEKEEPER - Enforce status: awaiting_review
    await updateStep("creating_post");

    const postStatus = "awaiting_review"; // FORCED for AI generation
    const { data: post, error: postError } = await adminClient
      .from("posts")
      .insert({
        user_id: targetUserId,
        title: generatedContent.title,
        content: generatedContent.content,
        excerpt: generatedContent.excerpt || null,
        type: generatedContent.type || "text",
        status: postStatus,
        scheduled_at: scheduledAt || null,
        tags: generatedContent.tags || [],
        cover_image_url: finalImageUrl,
        is_ai_generated: true,
        cost_estimate: estimatedCost,
        workflow_step: 'Review',
        category: category || null,
      })
      .select()
      .single();

    if (postError) throw postError;

    // Create post_platforms entries
    const platformInserts = platforms.map((p: string) => ({
      post_id: post.id,
      platform: p,
      status: postStatus,
    }));
    await adminClient.from("post_platforms").insert(platformInserts);

    await updateStep("post_created", { postId: post.id, status: postStatus, cost: estimatedCost });

    // 5. PUBLISHING - deliver now only when the caller explicitly asked for it.
    // Every other mode holds the post: "scheduled"/"awaiting_review" wait for
    // the review + scheduling flow, "draft" waits for a human. The previous
    // guard was `scheduleMode === "immediate" || (!scheduledAt && scheduleMode
    // !== "draft")`, which published immediately whenever a non-draft mode
    // arrived without a `scheduledAt` — including values this function did not
    // recognise.
    if (mode === "immediate") {
      await updateStep("firing_webhooks");

      const { data: webhooks } = await adminClient
        .from("webhook_configs")
        .select("*")
        .eq("user_id", targetUserId)
        .eq("is_active", true);

      const webhookResults: any[] = [];
      if (webhooks && webhooks.length > 0) {
        for (const webhook of webhooks) {
          // Check if webhook matches any of the target platforms
          const matchingPlatforms = platforms.filter((p: string) =>
            webhook.platforms.length === 0 || webhook.platforms.includes(p)
          );

          if (matchingPlatforms.length > 0) {
            if (!isSafeWebhookUrl(webhook.url)) {
              webhookResults.push({
                webhook: webhook.name,
                status: 0,
                success: false,
                error: "Blocked: webhook URL must be https and point to a public host",
              });
              continue;
            }
            try {
              // One delivery per platform, not one per webhook. The shared
              // envelope carries a single top-level `platform`, per-platform
              // truncation is applied inside `buildDelivery`, and `delivery_id`
              // is only meaningful for a single (post, platform) pair. This
              // previously sent ONE payload per webhook listing every matched
              // platform in a nested `platforms` array, with the event name
              // `post.published` — a different contract from the cron path.
              for (const platform of matchingPlatforms) {
                const payload = buildDelivery({
                  postId: post.id,
                  platform,
                  title: generatedContent.title,
                  content: generatedContent.content,
                  excerpt: generatedContent.excerpt,
                  tags: generatedContent.tags,
                  type: generatedContent.type,
                  coverImageUrl: finalImageUrl,
                  scheduledAt: scheduledAt ?? null,
                  category: category || null,
                });
                // Sign the exact bytes sent, so the receiver can verify provenance.
                const body = JSON.stringify(payload);
                const whHeaders = await deliveryHeaders(
                  body,
                  payload.delivery_id,
                  WEBHOOK_SIGNING_SECRET,
                  (webhook.headers as Record<string, string>) || {},
                );

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const whResp = await fetch(webhook.url, {
                  method: "POST",
                  headers: whHeaders,
                  body,
                  redirect: "error",
                  signal: controller.signal,
                });
                clearTimeout(timeoutId);

                webhookResults.push({
                  webhook: webhook.name,
                  platform,
                  status: whResp.status,
                  success: whResp.ok,
                  signed: !!WEBHOOK_SIGNING_SECRET,
                });
              }
            } catch (whErr: any) {
              webhookResults.push({
                webhook: webhook.name,
                status: 0,
                success: false,
                error: whErr.message,
              });
            }
          }
        }
      }

      // Mark post as published if webhooks were sent
      if (webhookResults.some(r => r.success)) {
        await adminClient
          .from("posts")
          .update({ status: "published", published_at: new Date().toISOString() })
          .eq("id", post.id);

        await adminClient
          .from("post_platforms")
          .update({ status: "published", published_at: new Date().toISOString() })
          .eq("post_id", post.id);
      }

      await updateStep("webhooks_fired", { results: webhookResults });
    }

    // 6. Complete pipeline
    await adminClient
      .from("pipeline_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        post_id: post.id,
        result: {
          title: generatedContent.title,
          hasImage: !!finalImageUrl,
          postStatus,
          postId: post.id,
        },
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({
        success: true,
        pipelineId: runId,
        postId: post.id,
        title: generatedContent.title,
        status: postStatus,
        hasImage: !!finalImageUrl,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e: any) {
    console.error("content-pipeline error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Pipeline failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
