/**
 * Shared AI spend enforcement for every paid-API call site:
 *   - content-pipeline   (OpenAI GPT-4o + DALL-E 3)
 *   - novee-chat         (OpenAI)
 *   - generate-strategy  (Gemini)
 *
 * Before this module, content-pipeline was the only one of the three with any
 * check at all, and that check summed spend across *every* signed-up user
 * against one shared instance-wide limit — so any authenticated free account
 * could call these directly and spend the owner's budget, and a single heavy
 * user could exhaust it for everyone else. This enforces two limits together:
 * the existing instance-wide ceiling (total spend protection, from
 * `project_settings.monthly_openai_budget`) plus a per-user monthly cap that
 * now varies by subscription tier (stops one account draining it alone, and
 * makes the paid plans mean something beyond the client-side sidebar gate).
 *
 * `ai_usage_log` is the shared source of truth for "spend so far"; a caller
 * writes one row per successful call via `recordAiUsage`.
 */

/**
 * Per-tier internal cost ceiling, in dollars of actual OpenAI/Gemini spend —
 * NOT the Stripe subscription price. A customer never sees this number; it
 * only stops abuse. Decided 2026-10-16 against real per-call costs (~$0.05 for
 * a content-pipeline post with an image, ~$0.01 for a chat/strategy call), so
 * free = ~20 image posts/month, starter = ~100, pro = ~300.
 *
 * `enterprise` exists in the `subscription_tier` enum but has no Stripe price
 * wired up anywhere yet (`create-checkout`/`stripe-webhook` never produce it);
 * treated the same as `pro` until that changes.
 *
 * Replaces the old flat `project_settings.per_user_monthly_budget` column as
 * the per-user limit's source — that column is no longer read here. It is left
 * in place rather than dropped (schema churn for a column that costs nothing
 * sitting unused), but a value stored there no longer has any effect.
 */
export const TIER_MONTHLY_AI_BUDGET: Record<SubscriptionTier, number> = {
  free: 1,
  starter: 5,
  pro: 15,
  enterprise: 15,
};

export type SubscriptionTier = "free" | "starter" | "pro" | "enterprise";

export interface BudgetCheck {
  allowed: boolean;
  reason?: "instance_budget_exceeded" | "user_budget_exceeded";
  instanceSpend: number;
  instanceLimit: number;
  userSpend: number;
  userLimit: number;
  /** The tier `userLimit` was derived from. */
  tier: SubscriptionTier;
  /**
   * True when the usage figures could not be read, so `instanceSpend`/`userSpend`
   * are not trustworthy. Still allowed — see `checkAiBudget` for why — but a
   * caller or a log should treat a degraded check as "spend is unenforced", not
   * as "the user is under budget".
   */
  degraded?: boolean;
}

/**
 * Resolve a user's current tier from `public.subscriptions`. A missing row,
 * a read error, or a stored tier whose `end_date` has already passed (the
 * cancellation webhook has not caught up yet) all resolve to "free" — the
 * conservative default errs toward under-granting budget, never over.
 */
async function resolveTier(admin: any, userId: string): Promise<SubscriptionTier> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("tier, end_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error(
      "[aiBudget] could not read subscriptions for tier, defaulting to free-tier budget:",
      error.message ?? error,
    );
    return "free";
  }
  if (!data || data.tier === "free") return "free";

  const stillActive = !data.end_date || new Date(data.end_date) > new Date();
  if (!stillActive) return "free";

  const tier = data.tier as SubscriptionTier;
  return tier in TIER_MONTHLY_AI_BUDGET ? tier : "free";
}

function startOfMonthIso(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Check both limits for `userId`. Call this BEFORE making the paid API call —
 * it does not itself record anything, so it is safe to call even if the
 * caller then decides not to proceed.
 *
 * **On a read failure this allows the call and marks the result `degraded`.**
 * That is a deliberate fail-open, matching the choice already made for the
 * HaveIBeenPwned password check in `src/utils/pwnedPassword.ts`: a dependency
 * blip should not become a product outage, and this is a cost control rather than
 * an authorisation boundary. What must never happen is failing *silently* —
 * `ai_usage_log` going missing used to mean every check passed with no signal
 * anywhere, so the failure is now logged loudly and flagged on the result. The
 * table itself is created by `20261019000001_add_ai_usage_log.sql`.
 */
export async function checkAiBudget(admin: any, userId: string): Promise<BudgetCheck> {
  const since = startOfMonthIso();

  const [tier, settingsResult] = await Promise.all([
    resolveTier(admin, userId),
    admin.from("project_settings").select("monthly_openai_budget").single(),
  ]);
  const { data: settings, error: settingsError } = settingsResult;
  if (settingsError) {
    // Not fatal: the default below is the same one the code used before this
    // column existed. Logged because it means the limit is NOT the configured
    // one, which is worth knowing when someone asks why a cap did not apply.
    console.error(
      "[aiBudget] could not read project_settings limits, falling back to defaults:",
      settingsError.message ?? settingsError,
    );
  }
  const instanceLimit = Number(settings?.monthly_openai_budget ?? 50);
  const userLimit = TIER_MONTHLY_AI_BUDGET[tier];

  const { data: rows, error: usageError } = await admin
    .from("ai_usage_log")
    .select("user_id, cost_estimate")
    .gte("created_at", since);

  if (usageError) {
    console.error(
      "[aiBudget] AI SPEND IS NOT BEING ENFORCED: could not read ai_usage_log. " +
        "If the table is missing, apply migration 20261019000001_add_ai_usage_log.sql.",
      usageError.message ?? usageError,
    );
    return {
      allowed: true,
      instanceSpend: 0,
      instanceLimit,
      userSpend: 0,
      userLimit,
      tier,
      degraded: true,
    };
  }

  let instanceSpend = 0;
  let userSpend = 0;
  for (const r of rows || []) {
    const cost = Number(r.cost_estimate) || 0;
    instanceSpend += cost;
    if (r.user_id === userId) userSpend += cost;
  }

  if (instanceSpend >= instanceLimit) {
    return { allowed: false, reason: "instance_budget_exceeded", instanceSpend, instanceLimit, userSpend, userLimit, tier };
  }
  if (userSpend >= userLimit) {
    return { allowed: false, reason: "user_budget_exceeded", instanceSpend, instanceLimit, userSpend, userLimit, tier };
  }
  return { allowed: true, instanceSpend, instanceLimit, userSpend, userLimit, tier };
}

/**
 * Record one successful call's cost. Call this AFTER the paid API call succeeds.
 *
 * The insert error is surfaced rather than discarded. It used to be ignored
 * entirely, which meant a missing `ai_usage_log` produced no signal at all: every
 * check read zero spend, so the limits silently never applied. This does not throw
 * — the user has already been charged for the call at this point, so failing the
 * request would punish them for an infrastructure fault — but it must be visible
 * in the edge function logs.
 */
export async function recordAiUsage(
  admin: any,
  userId: string,
  source: "content-pipeline" | "novee-chat" | "generate-strategy",
  costEstimate: number,
): Promise<boolean> {
  const { error } = await admin
    .from("ai_usage_log")
    .insert({ user_id: userId, source, cost_estimate: costEstimate });
  if (error) {
    console.error(
      `[aiBudget] FAILED TO RECORD ${costEstimate} of AI spend for ${source}; ` +
        "the monthly limits will under-count until this is fixed. " +
        "If the table is missing, apply migration 20261019000001_add_ai_usage_log.sql.",
      error.message ?? error,
    );
    return false;
  }
  return true;
}

/** Standard 402 response body/shape, consistent across all three call sites. */
export function budgetExceededResponse(check: BudgetCheck) {
  let message: string;
  if (check.reason === "instance_budget_exceeded") {
    message = "This project's monthly AI budget has been reached. Try again next month, or ask the project owner to raise the limit.";
  } else if (check.tier === "pro" || check.tier === "enterprise") {
    message = "You've reached your plan's monthly AI usage limit. Try again next month, or ask the project owner to raise it.";
  } else {
    message = "You've reached your plan's monthly AI usage limit. Upgrade your plan for a higher limit, or try again next month.";
  }
  return {
    error: "Monthly Budget Exceeded",
    reason: check.reason,
    message,
    instanceSpend: check.instanceSpend,
    instanceLimit: check.instanceLimit,
    userSpend: check.userSpend,
    userLimit: check.userLimit,
    tier: check.tier,
  };
}
