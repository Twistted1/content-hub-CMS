import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  SCHEDULE_MODES,
  CRON_SCHEDULE_MODE,
  DEFAULT_SCHEDULE_MODE,
  SELECTABLE_SCHEDULE_MODES,
  isScheduleMode,
} from "./scheduleMode";

/**
 * `scheduleMode` is sent across a boundary the compiler cannot see: the browser
 * bundle (this side) and the Deno edge functions (the other side) cannot import
 * from each other, so the vocabulary is duplicated by necessity. This test is
 * what stops the copies drifting — the original defect was exactly that:
 * `schedule-from-templates` sent `"awaiting_review"` while the frontend union
 * only allowed `"immediate" | "scheduled" | "draft"`, and nothing failed.
 *
 * It asserts three things, strongest last:
 *   1. the edge function's array literal equals this module's list
 *   2. the cron's named mode is a member of the list
 *   3. every `scheduleMode: "..."` literal anywhere in the repo is a member
 */
const REPO_ROOT = resolve(__dirname, "../..");
const CONTENT_PIPELINE = join(REPO_ROOT, "supabase/functions/content-pipeline/index.ts");
const SCHEDULE_FROM_TEMPLATES = join(
  REPO_ROOT,
  "supabase/functions/schedule-from-templates/index.ts",
);

/** Pull `const <name> = ["a", "b"] as const;` out of an edge function source. */
function extractStringArrayLiteral(source: string, name: string): string[] | null {
  const decl = source.indexOf(`const ${name} = [`);
  if (decl === -1) return null;
  const open = source.indexOf("[", decl);
  const close = source.indexOf("]", open);
  if (close === -1) return null;
  const body = source.slice(open + 1, close);
  return [...body.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
}

/** Pull `const <name> = "value";` out of an edge function source. */
function extractStringLiteral(source: string, name: string): string | null {
  const m = source.match(new RegExp(`const ${name}\\s*=\\s*"([^"]*)"`));
  return m ? m[1] : null;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe("scheduleMode parity across the browser/edge boundary", () => {
  it("the edge function's accepted list matches this module exactly", () => {
    const source = readFileSync(CONTENT_PIPELINE, "utf8");
    const declared = extractStringArrayLiteral(source, "SCHEDULE_MODES");

    expect(declared).not.toBeNull();
    expect(declared).toEqual([...SCHEDULE_MODES]);
  });

  it("the cron's mode is in the accepted list", () => {
    const source = readFileSync(SCHEDULE_FROM_TEMPLATES, "utf8");
    const cronMode = extractStringLiteral(source, "CRON_SCHEDULE_MODE");

    expect(cronMode).not.toBeNull();
    expect(cronMode).toBe(CRON_SCHEDULE_MODE);
    expect(SCHEDULE_MODES).toContain(cronMode);
    // The regression that started this: the cron holds posts for review, so it
    // must never be the mode that publishes on creation.
    expect(cronMode).not.toBe("immediate");
  });

  it("every scheduleMode literal used anywhere in the repo is an accepted mode", () => {
    const files = [
      ...walk(join(REPO_ROOT, "src")),
      ...walk(join(REPO_ROOT, "supabase/functions")),
    ].filter((f) => !f.endsWith("scheduleModeParity.test.ts"));

    const sent = new Map<string, string[]>();
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const m of source.matchAll(/scheduleMode\s*:\s*"([^"]+)"/g)) {
        const mode = m[1];
        sent.set(mode, [...(sent.get(mode) ?? []), file.slice(REPO_ROOT.length + 1)]);
      }
    }

    // Guard against the scan silently matching nothing if the pattern ever
    // stops applying — a green test that inspects no call sites is worthless.
    expect(sent.size).toBeGreaterThan(0);

    const unknown = [...sent.entries()].filter(([mode]) => !isScheduleMode(mode));
    expect(unknown).toEqual([]);
  });

  it("the UI-selectable modes are a strict subset of the wire modes", () => {
    expect(SELECTABLE_SCHEDULE_MODES.length).toBeGreaterThan(0);
    for (const mode of SELECTABLE_SCHEDULE_MODES) {
      expect(SCHEDULE_MODES).toContain(mode);
    }
    // `awaiting_review` is assigned by the cron, never picked by a person.
    expect(SELECTABLE_SCHEDULE_MODES).not.toContain("awaiting_review");
    expect(DEFAULT_SCHEDULE_MODE).toBe("immediate");
  });
});
