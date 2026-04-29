import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function computeNextRun(schedule: string | null | undefined, from: Date): Date {
  const next = new Date(from);
  switch (schedule) {
    case "hourly":
      next.setHours(next.getHours() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "daily":
    default:
      next.setDate(next.getDate() + 1);
      break;
  }
  return next;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const summary: Array<Record<string, unknown>> = [];

  try {
    const nowIso = new Date().toISOString();

    const { data: due, error: dueErr } = await supabase
      .from("automations")
      .select("*")
      .eq("status", "active")
      .eq("trigger", "scheduled")
      .or(`next_run.is.null,next_run.lte.${nowIso}`);

    if (dueErr) throw dueErr;

    for (const automation of due ?? []) {
      const runInsert = await supabase
        .from("automation_runs")
        .insert({
          automation_id: automation.id,
          user_id: automation.user_id,
          status: "running",
        })
        .select()
        .single();

      if (runInsert.error) {
        summary.push({ id: automation.id, error: runInsert.error.message });
        continue;
      }
      const runId = runInsert.data.id;

      try {
        const stratResp = await fetch(`${SUPABASE_URL}/functions/v1/generate-strategy`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE}`,
          },
          body: JSON.stringify({ topic: automation.name }),
        });
        const strat = await stratResp.json();
        if (!stratResp.ok) throw new Error(strat?.error || "Strategy failed");

        const platforms: string[] = (automation.platforms || []).map((p: string) =>
          p.toLowerCase().replace("x", "twitter")
        );

        let createdCount = 0;
        const today = new Date();
        const dayStrategy = (strat.content_strategy || [])[0] || {};

        const items: Array<{ platform: string; title: string; content: string; image?: string; time: string }> = [];
        const dayTopic = dayStrategy.topic || automation.name;

        if (platforms.includes("twitter") && dayStrategy.twitter) {
          const times = ["09:00:00", "13:00:00", "17:00:00"];
          dayStrategy.twitter.slice(0, 3).forEach((t: string, i: number) =>
            items.push({ platform: "twitter", title: `X: ${dayTopic} #${i + 1}`, content: t, image: dayStrategy.image, time: times[i] })
          );
        }
        if (platforms.includes("instagram") && dayStrategy.instagram) {
          items.push({ platform: "instagram", title: `IG: ${dayTopic}`, content: dayStrategy.instagram.caption, image: dayStrategy.instagram.image, time: "11:00:00" });
        }
        if (platforms.includes("facebook") && dayStrategy.facebook) {
          items.push({ platform: "facebook", title: `FB: ${dayTopic}`, content: dayStrategy.facebook.post, image: dayStrategy.image, time: "10:00:00" });
        }
        if (platforms.includes("linkedin") && dayStrategy.linkedin) {
          items.push({ platform: "linkedin", title: `LI: ${dayTopic}`, content: dayStrategy.linkedin.post, image: dayStrategy.image, time: "08:30:00" });
        }
        if (platforms.includes("tiktok") && dayStrategy.tiktok) {
          items.push({ platform: "tiktok", title: `TT: ${dayTopic}`, content: dayStrategy.tiktok.script, image: dayStrategy.tiktok.thumbnail, time: "18:00:00" });
        }
        if (platforms.includes("youtube") && dayStrategy.youtube) {
          items.push({ platform: "youtube", title: dayStrategy.youtube.video_title, content: dayStrategy.youtube.community_post, image: dayStrategy.youtube.thumbnail, time: "15:00:00" });
        }
        if (platforms.includes("website") && dayStrategy.article) {
          items.push({ platform: "website", title: dayStrategy.article.title, content: dayStrategy.article.content, image: dayStrategy.image, time: "06:00:00" });
        }

        const datePart = today.toISOString().split("T")[0];
        for (const item of items) {
          const { data: post, error: postErr } = await supabase
            .from("posts")
            .insert({
              title: item.title,
              content: item.content,
              status: "awaiting_review",
              scheduled_at: `${datePart}T${item.time}.000Z`,
              user_id: automation.user_id,
              category: item.platform === "website" ? "article" : "content",
              excerpt: (item.content || "").substring(0, 100),
              is_ai_generated: true,
            })
            .select()
            .single();
          if (postErr) continue;
          await supabase.from("post_platforms").insert({ post_id: post.id, platform: item.platform as any, status: "scheduled" });
          if (item.image) {
            await supabase.from("media").insert({ post_id: post.id, url: item.image, filename: `${post.id}-image`, mime_type: "image/*", user_id: automation.user_id });
          }
          createdCount++;
        }

        const nextRun = computeNextRun(automation.schedule, new Date());
        await supabase
          .from("automations")
          .update({
            run_count: (automation.run_count || 0) + 1,
            last_run: new Date().toISOString(),
            next_run: nextRun.toISOString(),
          })
          .eq("id", automation.id);

        await supabase
          .from("automation_runs")
          .update({
            status: "success",
            completed_at: new Date().toISOString(),
            result: { created: createdCount, platforms } as any,
          })
          .eq("id", runId);

        summary.push({ id: automation.id, created: createdCount });
      } catch (err: any) {
        await supabase
          .from("automation_runs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: err.message,
          })
          .eq("id", runId);
        summary.push({ id: automation.id, error: err.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: summary.length, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});