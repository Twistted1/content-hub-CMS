/**
 * The `scheduleMode` vocabulary accepted by the `content-pipeline` edge
 * function.
 *
 * This value is a contract across a boundary TypeScript cannot check: the
 * browser bundle sends it, and the Deno edge functions receive it. They cannot
 * import from each other (different runtimes, different module resolution), so
 * the list is necessarily duplicated — `SCHEDULE_MODES` here is the definition,
 * and `scheduleModeParity.test.ts` fails the build if any edge function or call
 * site uses a mode that is not in it.
 *
 * History worth keeping: this union used to be `"immediate" | "scheduled" |
 * "draft"`, while `schedule-from-templates` sent `"awaiting_review"`. Nothing
 * caught it, because the receiving function's guard was a catch-all
 * (`!scheduledAt && scheduleMode !== "draft"`) rather than an explicit list, so
 * an unrecognised mode had no defined meaning — it fell through to whatever the
 * surrounding condition happened to evaluate to. Adding the value here, and
 * making the guard total, is what closes that hole.
 */
export const SCHEDULE_MODES = [
  "immediate",
  "scheduled",
  "draft",
  "awaiting_review",
] as const;

export type ScheduleMode = (typeof SCHEDULE_MODES)[number];

/**
 * What an omitted mode means. Mirrors `content-pipeline`'s
 * `schedule_mode: scheduleMode || "immediate"` default, which is the behaviour
 * that already shipped — this just makes it explicit instead of incidental.
 */
export const DEFAULT_SCHEDULE_MODE: ScheduleMode = "immediate";

/** The mode `schedule-from-templates` uses for cron-generated slots. */
export const CRON_SCHEDULE_MODE: ScheduleMode = "awaiting_review";

/**
 * The subset a human may choose in the Content Pipeline UI. `"awaiting_review"`
 * is deliberately excluded: it is what the 15-minute cron assigns to slots it
 * generates, not something a person picks from a dropdown.
 */
export const SELECTABLE_SCHEDULE_MODES = [
  "draft",
  "scheduled",
  "immediate",
] as const satisfies readonly ScheduleMode[];

export type SelectableScheduleMode = (typeof SELECTABLE_SCHEDULE_MODES)[number];

export function isSelectableScheduleMode(
  value: unknown,
): value is SelectableScheduleMode {
  return (
    typeof value === "string" &&
    (SELECTABLE_SCHEDULE_MODES as readonly string[]).includes(value)
  );
}

export function isScheduleMode(value: unknown): value is ScheduleMode {
  return (
    typeof value === "string" &&
    (SCHEDULE_MODES as readonly string[]).includes(value)
  );
}

/**
 * Resolve an untrusted `scheduleMode` into a known mode.
 *
 * Absent means "immediate" (the shipped default). An unrecognised *string* is
 * deliberately resolved to `"scheduled"` rather than `"immediate"`: a typo must
 * never be the reason something publishes itself without review. `"scheduled"`
 * defers to the `publish-due-posts` cron, and with no `scheduled_at` it simply
 * never comes due — a held post, which is recoverable, unlike an accidental
 * publish.
 */
export function normalizeScheduleMode(value: unknown): ScheduleMode {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_SCHEDULE_MODE;
  }
  return isScheduleMode(value) ? value : "scheduled";
}

/**
 * Whether the pipeline should deliver to webhooks at generation time.
 *
 * Only `"immediate"` does. Every other mode holds the post: `"scheduled"` and
 * `"awaiting_review"` wait for the review/scheduling flow, and `"draft"` waits
 * for a human. This replaces the previous
 * `scheduleMode === "immediate" || (!scheduledAt && scheduleMode !== "draft")`
 * catch-all, under which a mode of `"scheduled"` or `"awaiting_review"` sent
 * *without* a `scheduledAt` published immediately.
 */
export function firesWebhooksOnCreate(mode: ScheduleMode): boolean {
  return mode === "immediate";
}
