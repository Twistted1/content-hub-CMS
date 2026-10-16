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
 */
export async function checkAiBudget(admin: any, userId: string): Promise<BudgetCheck> {
  const since = startOfMonthIso();

  const { data: settings } = await admin
    .from("project_settings")
    .select("monthly_openai_budget, per_user_monthly_budget")
    .single();
  const instanceLimit = Number(settings?.monthly_openai_budget ?? 50);
  const userLimit = Number(settings?.per_user_monthly_budget ?? 5);

  const { data: rows } = await admin
    .from("ai_usage_log")
    .select("user_id, cost_estimate")
    .gte("created_at", since);

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

/** Record one successful call's cost. Call this AFTER the paid API call succeeds. */
export async function recordAiUsage(
  admin: any,
  userId: string,
  source: "content-pipeline" | "novee-chat" | "generate-strategy",
  costEstimate: number,
): Promise<void> {
  await admin.from("ai_usage_log").insert({ user_id: userId, source, cost_estimate: costEstimate });
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
