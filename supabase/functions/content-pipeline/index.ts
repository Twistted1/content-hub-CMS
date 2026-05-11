import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

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
    const { topic, platforms, scheduleMode, scheduledAt, user_id } = await req.json();

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

    // --- Frugal Architect Logic: Pre-Flight Budget Check ---
    const calculateMonthlySpend = async (supabase: any) => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from('posts')
        .select('cost_estimate')
        .gte('created_at', startOfMonth.toISOString());

      const total = data?.reduce((acc: number, post: any) => acc + (Number(post.cost_estimate) || 0), 0) || 0;
      const { data: settings } = await supabase.from('project_settings').select('*').single();

      return {
        currentSpend: total,
        budgetLimit: settings?.monthly_openai_budget || 50
      };
    };

    const budgetStatus = await calculateMonthlySpend(adminClient);
    if (budgetStatus.currentSpend >= budgetStatus.budgetLimit) {
      return new Response(JSON.stringify({ error: "Monthly Budget Exceeded", currentSpend: budgetStatus.currentSpend }), {
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
        schedule_mode: scheduleMode || "immediate",
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
    const generatedContent = JSON.parse(contentData.choices?.[0]?.message?.content || "{}");
    
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
        workflow_step: 'Review'
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

    // 5. PUBLISHING - Fire webhooks if immediate
    if (scheduleMode === "immediate" || (!scheduledAt && scheduleMode !== "draft")) {
      await updateStep("firing_webhooks");

      const { data: webhooks } = await adminClient
        .from("webhook_configs")
        .select("*")
        .eq("user_id", targetUserId)
        .eq("is_active", true);

      let webhookResults: any[] = [];
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
              const webhookPayload = {
                event: "post.published",
                post: {
                  id: post.id,
                  title: generatedContent.title,
                  content: generatedContent.content,
                  excerpt: generatedContent.excerpt,
                  tags: generatedContent.tags,
                  coverImageUrl: finalImageUrl,
                  platforms: matchingPlatforms,
                  scheduledAt: scheduledAt,
                },
                timestamp: new Date().toISOString(),
              };

              const whHeaders: Record<string, string> = {
                "Content-Type": "application/json",
                ...(webhook.headers as Record<string, string> || {}),
              };

              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000);
              const whResp = await fetch(webhook.url, {
                method: "POST",
                headers: whHeaders,
                body: JSON.stringify(webhookPayload),
                redirect: "error",
                signal: controller.signal,
              });
              clearTimeout(timeoutId);

              webhookResults.push({
                webhook: webhook.name,
                status: whResp.status,
                success: whResp.ok,
              });
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
