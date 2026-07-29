import { describe, it, expect } from "vitest";
import en from "./en.json";
import pt from "./pt.json";

/**
 * Every UI string is looked up by key at runtime with no fallback text, so a
 * key present in one locale but missing in the other renders as a raw
 * "namespace.key" string in production for whichever locale is short a key.
 */
function collectKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return [prefix];
  }
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    collectKeys(value, prefix ? `${prefix}.${key}` : key)
  );
}

describe("en/pt locale key parity", () => {
  it("has no keys present in en.json but missing from pt.json", () => {
    const enKeys = new Set(collectKeys(en));
    const ptKeys = new Set(collectKeys(pt));
    const missingFromPt = [...enKeys].filter((k) => !ptKeys.has(k));
    expect(missingFromPt).toEqual([]);
  });

  it("has no keys present in pt.json but missing from en.json", () => {
    const enKeys = new Set(collectKeys(en));
    const ptKeys = new Set(collectKeys(pt));
    const missingFromEn = [...ptKeys].filter((k) => !enKeys.has(k));
    expect(missingFromEn).toEqual([]);
  });

  // pt's "currentPlanDescPrefix" already reads "...no plano" (on the plan),
  // so the trailing suffix that english needs ("... plan") has nothing left
  // to say in portuguese — an intentional empty string, not a missing one.
  const KNOWN_EMPTY = new Set(["pt:settings.billing.currentPlanDescSuffix"]);

  it("has no empty string values in either locale, other than known intentional ones", () => {
    const emptyIn = (obj: unknown, file: string) => {
      const keys = collectKeys(obj).filter((k) => {
        const value = k.split(".").reduce((o: any, part) => o?.[part], obj as any);
        return typeof value === "string" && value.trim() === "";
      });
      return keys.map((k) => `${file}:${k}`);
    };
    const empties = [...emptyIn(en, "en"), ...emptyIn(pt, "pt")];
    expect(empties.filter((k) => !KNOWN_EMPTY.has(k))).toEqual([]);
  });
});
