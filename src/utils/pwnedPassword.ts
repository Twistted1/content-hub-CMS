import { reportError } from "@/lib/errorReporting";

/**
 * Leaked-password check against the free HaveIBeenPwned Pwned Passwords range
 * API — the same corpus Supabase's Pro-only "Leaked Password Protection"
 * toggle uses, without needing the paid plan.
 *
 * k-anonymity: only the first 5 characters of the SHA-1 hash are sent. The
 * password itself, and the remaining 32 hash characters, never leave the
 * browser — the suffix is compared locally against the returned range.
 *
 * Call sites treat this as advisory (see `checkPasswordLeaked`).
 */

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const TIMEOUT_MS = 3000;

async function sha1Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Number of times `password` appears in known breaches (0 = not found).
 *
 * Throws on network/API failure so the caller decides the policy.
 */
export async function countPasswordBreaches(password: string): Promise<number> {
  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(HIBP_RANGE_URL + prefix, {
      signal: controller.signal,
      // Pads the response body with random hashes so the response size cannot
      // be used to infer whether the prefix matched anything.
      headers: { "Add-Padding": "true" },
    });
    if (!response.ok) {
      throw new Error(`Pwned Passwords API returned ${response.status}`);
    }

    for (const line of (await response.text()).split("\n")) {
      const [hashSuffix, count] = line.split(":");
      if (hashSuffix?.trim().toUpperCase() === suffix) {
        return Number.parseInt(count ?? "0", 10) || 0;
      }
    }
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * True if the password appears in a known breach.
 *
 * FAIL-OPEN by design: if HIBP is unreachable, this returns false and the
 * password is allowed through. A third-party outage must not become a signup
 * outage, and Supabase's own leaked-password protection behaves the same way.
 * The failure is reported to Sentry so a persistent outage is still visible.
 */
export async function isPasswordLeaked(password: string): Promise<boolean> {
  try {
    return (await countPasswordBreaches(password)) > 0;
  } catch (error) {
    reportError(error, { area: "hibp-leaked-password-check" });
    return false;
  }
}