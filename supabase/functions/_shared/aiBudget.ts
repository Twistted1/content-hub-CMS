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
 * the existing instance-wide ceiling (total spend protection) plus a new
 * per-user monthly cap (stops one account draining it alone), both read from
 * `project_settings` and both adjustable there — this module does not decide
 * the dollar amounts, only enforces whatever is configured.
 *
 * `ai_usage_log` is the shared source of truth for "spend so far"; a caller
 * writes one row per successful call via `recordAiUsage`.
 */

export interface BudgetCheck {
  allowed: boolean;
  reason?: "instance_budget_exceeded" | "user_budget_exceeded";
  instanceSpend: number;
  instanceLimit: number;
  userSpend: number;
  userLimit: number;
  /**
   * True when the usage figures could not be read, so `instanceSpend`/`userSpend`
   * are not trustworthy. Still allowed — see `checkAiBudget` for why — but a
   * caller or a log should treat a degraded check as "spend is unenforced", not
   * as "the user is under budget".
   */
  degraded?: boolean;
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

  const { data: settings, error: settingsError } = await admin
    .from("project_settings")
    .select("monthly_openai_budget, per_user_monthly_budget")
    .single();
  if (settingsError) {
    // Not fatal: the defaults below are the same ones the code used before this
    // column existed. Logged because it means the limits are NOT the configured
    // ones, which is worth knowing when someone asks why a cap did not apply.
    console.error(
      "[aiBudget] could not read project_settings limits, falling back to defaults:",
      settingsError.message ?? settingsError,
    );
  }
  const instanceLimit = Number(settings?.monthly_openai_budget ?? 50);
  const userLimit = Number(settings?.per_user_monthly_budget ?? 5);

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
    return { allowed: false, reason: "instance_budget_exceeded", instanceSpend, instanceLimit, userSpend, userLimit };
  }
  if (userSpend >= userLimit) {
    return { allowed: false, reason: "user_budget_exceeded", instanceSpend, instanceLimit, userSpend, userLimit };
  }
  return { allowed: true, instanceSpend, instanceLimit, userSpend, userLimit };
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
  const message =
    check.reason === "instance_budget_exceeded"
      ? "This project's monthly AI budget has been reached. Try again next month, or ask the project owner to raise the limit."
      : "You've reached your personal monthly AI usage limit for this project. Try again next month, or ask the project owner to raise it.";
  return {
    error: "Monthly Budget Exceeded",
    reason: check.reason,
    message,
    instanceSpend: check.instanceSpend,
    instanceLimit: check.instanceLimit,
    userSpend: check.userSpend,
    userLimit: check.userLimit,
  };
}
