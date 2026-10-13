import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WEBSITE_CATEGORY_BY_DAY, DAYS } from "./scheduling";

/**
 * The seven website categories are defined twice: here in the frontend (for
 * display) and again inside the `schedule-from-templates` edge function (for
 * generation). They must agree — if the edge function's copy drifts, the
 * Calendar shows one category while the generated article is about another,
 * with no error surfaced anywhere. This asserts they stay in lockstep.
 */
const EDGE_FUNCTION_PATH = resolve(
  __dirname,
  "../../supabase/functions/schedule-from-templates/index.ts"
);

function parseBackendCategories(): Record<string, { category: string; focus: string }> {
  const source = readFileSync(EDGE_FUNCTION_PATH, "utf8");
  const start = source.indexOf("const WEBSITE_CATEGORY_BY_DAY");
  // The declaration carries a type annotation containing braces
  // (`Record<string, { category: string; focus: string }>`), so anchor on the
  // assignment rather than the first `{` after the name.
  const assign = source.indexOf("= {", start);
  const bodyStart = source.indexOf("{", assign);
  let depth = 0;
  let end = bodyStart;
  for (let i = bodyStart; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = source.slice(bodyStart, end + 1);
  const result: Record<string, { category: string; focus: string }> = {};
  const entry = /(\w+):\s*\{\s*category:\s*"([^"]*)",\s*focus:\s*"([^"]*)"\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = entry.exec(body)) !== null) {
    result[m[1]] = { category: m[2], focus: m[3] };
  }
  return result;
}

describe("website category map parity", () => {
  const backend = parseBackendCategories();

  it("parsed all seven days from the edge function", () => {
    expect(Object.keys(backend).sort()).toEqual([...DAYS].sort());
  });

  it("matches the frontend map exactly, key by key", () => {
    const frontend: Record<string, { category: string; focus: string }> = {};
    for (const day of DAYS) frontend[day] = WEBSITE_CATEGORY_BY_DAY[day];

    expect(backend).toEqual(frontend);
  });

  it("assigns a distinct category to every day", () => {
    const categories = DAYS.map((d) => WEBSITE_CATEGORY_BY_DAY[d].category);
    expect(new Set(categories).size).toBe(categories.length);
  });
});
