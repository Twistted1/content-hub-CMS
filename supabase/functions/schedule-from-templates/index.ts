import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Weekly schedule per platform, inlined from src/data/platforms/*.json so the
// edge function has no FS dependency. Times are local HH:MM (or HH:MM-HH:MM, in
// which case we use the start). Keys "1".."4" are week-of-month buckets.
type WeeklySchedule = Record<string, Record<string, string[]>>;

const SCHEDULES: Record<string, WeeklySchedule> = {
  twitter: {
    "1": { Monday: ["09:00","13:00","17:00"], Tuesday: ["09:00","13:00","17:00"], Wednesday: ["09:00","13:00","17:00"], Thursday: ["09:00","13:00","17:00"], Friday: ["09:00","13:00","17:00"], Saturday: ["10:00","14:00","18:00"], Sunday: ["10:00","14:00","18:00"] },
    "2": { Monday: ["09:00","13:00","17:00"], Tuesday: ["09:00","13:00","17:00"], Wednesday: ["09:00","13:00","17:00"], Thursday: ["09:00","13:00","17:00"], Friday: ["09:00","13:00","17:00"], Saturday: ["10:00","14:00","18:00"], Sunday: ["10:00","14:00","18:00"] },
    "3": { Monday: ["09:00","13:00","17:00"], Tuesday: ["09:00","13:00","17:00"], Wednesday: ["09:00","13:00","17:00"], Thursday: ["09:00","13:00","17:00"], Friday: ["09:00","13:00","17:00"], Saturday: ["10:00","14:00","18:00"], Sunday: ["10:00","14:00","18:00"] },
    "4": { Monday: ["09:00","13:00","17:00"], Tuesday: ["09:00","13:00","17:00"], Wednesday: ["09:00","13:00","17:00"], Thursday: ["09:00","13:00","17:00"], Friday: ["09:00","13:00","17:00"], Saturday: ["10:00","14:00","18:00"], Sunday: ["10:00","14:00","18:00"] },
  },
  instagram: {
    "1": { Monday: ["12:00"], Tuesday: ["12:00"], Wednesday: ["12:00"], Thursday: ["12:00"], Friday: ["12:00"], Saturday: ["12:00"], Sunday: ["12:00"] },
    "2": { Monday: ["13:00"], Tuesday: ["13:00"], Wednesday: ["13:00"], Thursday: ["13:00"], Friday: ["13:00"], Saturday: ["13:00"], Sunday: ["13:00"] },
    "3": { Monday: ["14:00"], Tuesday: ["14:00"], Wednesday: ["14:00"], Thursday: ["14:00"], Friday: ["14:00"], Saturday: ["14:00"], Sunday: ["14:00"] },
    "4": { Monday: ["15:00"], Tuesday: ["15:00"], Wednesday: ["15:00"], Thursday: ["15:00"], Friday: ["15:00"], Saturday: ["15:00"], Sunday: ["15:00"] },
  },
  facebook: {
    "1": { Wednesday: ["14:00"] },
    "2": { Wednesday: ["14:00"] },
    "3": { Wednesday: ["14:00"] },
    "4": { Wednesday: ["14:00"] },
  },
  linkedin: {
    "1": { Monday: ["09:00"], Tuesday: ["09:00"], Wednesday: ["09:00"], Thursday: ["09:00"], Friday: ["09:00"], Saturday: ["09:00"], Sunday: ["09:00"] },
    "2": { Monday: ["09:00"], Tuesday: ["09:00"], Wednesday: ["09:00"], Thursday: ["09:00"], Friday: ["09:00"], Saturday: ["09:00"], Sunday: ["09:00"] },
    "3": { Monday: ["09:00"], Tuesday: ["09:00"], Wednesday: ["09:00"], Thursday: ["09:00"], Friday: ["09:00"], Saturday: ["09:00"], Sunday: ["09:00"] },
    "4": { Monday: ["09:00"], Tuesday: ["09:00"], Wednesday: ["09:00"], Thursday: ["09:00"], Friday: ["09:00"], Saturday: ["09:00"], Sunday: ["09:00"] },
  },
  tiktok: {
    "1": { Tuesday: ["19:00"], Thursday: ["19:00"], Friday: ["20:00"] },
    "2": { Tuesday: ["19:00"], Thursday: ["19:00"], Friday: ["20:00"] },
    "3": { Tuesday: ["19:00"], Thursday: ["19:00"], Friday: ["20:00"] },
    "4": { Tuesday: ["19:00"], Thursday: ["19:00"], Friday: ["20:00"] },
  },
  youtube: {
    "1": { Thursday: ["14:00"] },
    "2": { Thursday: ["14:00"] },
    "3": { Thursday: ["14:00"] },
    "4": { Thursday: ["14:00"] },
  },
  rumble: {
    "1": { Friday: ["18:00"] },
    "2": { Friday: ["18:00"] },
    "3": { Friday: ["18:00"] },
    "4": { Friday: ["18:00"] },
  },
  website: {
    "1": { Monday: ["10:00"], Tuesday: ["10:00"], Wednesday: ["10:00"], Thursday: ["10:00"], Friday: ["10:00"], Saturday: ["10:00"], Sunday: ["10:00"] },
    "2": { Monday: ["10:00"], Tuesday: ["10:00"], Wednesday: ["10:00"], Thursday: ["10:00"], Friday: ["10:00"], Saturday: ["10:00"], Sunday: ["10:00"] },
    "3": { Monday: ["10:00"], Tuesday: ["10:00"], Wednesday: ["10:00"], Thursday: ["10:00"], Friday: ["10:00"], Saturday: ["10:00"], Sunday: ["10:00"] },
    "4": { Monday: ["10:00"], Tuesday: ["10:00"], Wednesday: ["10:00"], Thursday: ["10:00"], Friday: ["10:00"], Saturday: ["10:00"], Sunday: ["10:00"] },
  },
  podcast: {
    "1": { Wednesday: ["08:00"] },
    "2": { Wednesday: ["08:00"] },
    "3": { Wednesday: ["08:00"] },
    "4": { Wednesday: ["08:00"] },
  },
};

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const WEBSITE_CATEGORY_BY_DAY: Record<string, { category: string; focus: string }> = {
  Monday: { category: "Geopolitics", focus: "International power dynamics" },
  Tuesday: { category: "Economics", focus: "Global financial systems" },
  Wednesday: { category: "Media", focus: "Narrative control / Information warfare" },
  Thursday: { category: "Technology", focus: "Surveillance / AI / Infrastructure" },
  Friday: { category: "Security", focus: "Intelligence / Defense" },
  Saturday: { category: "Climate", focus: "Resource conflicts / Policy" },
  Sunday: { category: "Corporate Social Responsibility", focus: "Governance / Impact" },
};

function weekOfMonth(d: Date): string {
  return String(Math.min(4, Math.ceil(d.getUTCDate() / 7)));
}

function parseSlotTime(slot: string): string {
  // "09:00" or "09:00-11:00" -> return the start "HH:MM"
  return slot.split("-")[0].trim();
}

// Returns ISO timestamps of all slots in [from, to) for a given platform.
function slotsForRange(platform: string, from: Date, to: Date): Date[] {
  const sched = SCHEDULES[platform];
  if (!sched) return [];
  const out: Date[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (cursor < to) {
    const wk = weekOfMonth(cursor);
    const dayName = DAY_NAMES[cursor.getUTCDay()];
    const slots = sched[wk]?.[dayName] || [];
    for (const slot of slots) {
      const [h, m] = parseSlotTime(slot).split(":").map(Number);
      const at = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), h, m, 0));
      if (at >= from && at < to) out.push(at);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

async function authorize(req: Request, admin: any): Promise<{ ok: boolean; userId?: string; isService: boolean }> {
  const cronHeader = req.headers.get("x-cron-secret");
  if (cronHeader) {
    const { data } = await admin.rpc("get_cron_secret");
    if (data && data === cronHeader) return { ok: true, isService: true };
    return { ok: false, isService: false };
  }
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return { ok: false, isService: false };
  if (auth === `Bearer ${SERVICE_KEY}`) return { ok: true, isService: true };
  const user = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user: u } } = await user.auth.getUser();
  if (!u) return { ok: false, isService: false };
  return { ok: true, userId: u.id, isService: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const authz = await authorize(req, admin);
    if (!authz.ok) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lookahead window: next 24h from now (UTC).
    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find active scheduled automations. If a user has any active scheduled
    // automation we treat their selected platforms as opted-in.
    let autoQuery = admin
      .from("automations")
      .select("id, user_id, platforms, status, trigger, run_count")
      .eq("status", "active")
      .eq("trigger", "scheduled");
    if (!authz.isService && authz.userId) autoQuery = autoQuery.eq("user_id", authz.userId);
    const { data: automations, error: autoErr } = await autoQuery;
    if (autoErr) throw autoErr;

    if (!automations || automations.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No active scheduled automations", created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalCreated = 0;
    let totalSkipped = 0;
    const perAutomation: any[] = [];

    for (const a of automations) {
      const userId = a.user_id;

      // Overlap guard: this function is invoked every 15 minutes by pg_cron,
      // but content-pipeline's OpenAI + DALL-E calls can each take well
      // over that on a busy first pass (many untaken slots right after a
      // wipe), so a slow invocation can still be running when the next
      // cron tick fires. Both would see the same "not yet taken" slots in
      // their independent `existing` snapshot and double-create - exactly
      // the exact-duplicate-pairs pattern seen in the data. A stale
      // "running" row (crashed before ever reaching the success/failed
      // update below) must not permanently wedge this automation, so only
      // rows from the last 20 minutes - a bit over one cron interval -
      // count as an active lock.
      const { data: inFlight } = await admin
        .from("automation_runs")
        .select("id")
        .eq("automation_id", a.id)
        .eq("status", "running")
        .gte("started_at", new Date(Date.now() - 20 * 60 * 1000).toISOString())
        .limit(1);
      if (inFlight && inFlight.length > 0) {
        perAutomation.push({ automationId: a.id, userId, created: 0, skipped: 0, note: "skipped: previous run still in flight" });
        continue;
      }

      const platforms = new Set<string>();
      (a.platforms || []).forEach((p: string) => {
        const norm = String(p).toLowerCase().replace(/^x$/, "twitter");
        if (SCHEDULES[norm]) platforms.add(norm);
      });

      // Record this pass so "last run" / "success rate" reflect what the cron
      // pipeline actually does, same as the manual "Run Now" write path.
      const { data: run } = await admin
        .from("automation_runs")
        .insert({ automation_id: a.id, user_id: userId, status: "running" })
        .select()
        .single();

      let created = 0, skipped = 0;
      try {
        for (const platform of platforms) {
          const slots = slotsForRange(platform, now, horizon);
          if (slots.length === 0) continue;

          // Find existing posts for this (user, platform) in the window — via post_platforms join.
          const { data: existing } = await admin
            .from("post_platforms")
            .select("post_id, platform, posts!inner(user_id, scheduled_at)")
            .eq("platform", platform as any)
            .eq("posts.user_id", userId)
            .gte("posts.scheduled_at", now.toISOString())
            .lt("posts.scheduled_at", horizon.toISOString());

          const taken = new Set<string>((existing || []).map((r: any) => new Date(r.posts.scheduled_at).toISOString()));

          for (const slot of slots) {
            const iso = slot.toISOString();
            if (taken.has(iso)) { skipped++; continue; }

            // Fire content-pipeline for this single slot. Force `awaiting_review`.
            try {
              const resp = await fetch(`${SUPABASE_URL}/functions/v1/content-pipeline`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${SERVICE_KEY}`,
                },
                body: JSON.stringify({
                  topic: platform === "website"
                    ? `${WEBSITE_CATEGORY_BY_DAY[DAY_NAMES[slot.getUTCDay()]].category}: ${WEBSITE_CATEGORY_BY_DAY[DAY_NAMES[slot.getUTCDay()]].focus}`
                    : `${platform.charAt(0).toUpperCase() + platform.slice(1)} post for ${slot.toUTCString()}`,
                  platforms: [platform],
                  scheduleMode: "awaiting_review",
                  scheduledAt: iso,
                  user_id: userId,
                }),
              });
              if (resp.ok) created++;
              else {
                const t = await resp.text();
                console.error(`content-pipeline failed for ${userId}/${platform}/${iso}: ${resp.status} ${t}`);
              }
            } catch (e: any) {
              console.error("content-pipeline call error:", e);
            }
          }
        }

        if (run?.id) {
          await admin.from("automation_runs").update({
            status: "success",
            completed_at: new Date().toISOString(),
            result: { created, skipped, platforms: [...platforms] },
          }).eq("id", run.id);
        }
        await admin.from("automations").update({
          run_count: (a.run_count || 0) + 1,
          last_run: new Date().toISOString(),
        }).eq("id", a.id);
      } catch (e: any) {
        console.error(`automation ${a.id} failed:`, e);
        if (run?.id) {
          await admin.from("automation_runs").update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: e?.message || String(e),
          }).eq("id", run.id);
        }
      }

      perAutomation.push({ automationId: a.id, userId, created, skipped });
      totalCreated += created;
      totalSkipped += skipped;
    }

    return new Response(JSON.stringify({ ok: true, created: totalCreated, skipped: totalSkipped, perAutomation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("schedule-from-templates error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});