import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { countPasswordBreaches, isPasswordLeaked } from "./pwnedPassword";

// Known SHA-1 -> HIBP suffix. "password" hashes to
// 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8, so prefix 5BAA6 and this suffix.
const PASSWORD_SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

function mockRangeResponse(body: string, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    text: () => Promise.resolve(body),
  });
}

describe("countPasswordBreaches", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the breach count when the suffix is present", async () => {
    fetchMock.mockImplementation(mockRangeResponse(`0000000000000000000000000000000000A:1\r\n${PASSWORD_SUFFIX}:3303003`));

    await expect(countPasswordBreaches("password")).resolves.toBe(3303003);
  });

  it("returns 0 when the suffix is absent from the range", async () => {
    fetchMock.mockImplementation(mockRangeResponse("0000000000000000000000000000000000A:1"));

    await expect(countPasswordBreaches("password")).resolves.toBe(0);
  });

  it("only sends the first 5 hash characters, never the password", async () => {
    fetchMock.mockImplementation(mockRangeResponse("0000000000000000000000000000000000A:1"));

    await countPasswordBreaches("password");

    const url = fetchMock.mock.calls[0][0] as string;
    // Only the 5-char prefix is in the path; the suffix and the plaintext
    // password are never transmitted.
    expect(new URL(url).pathname).toBe("/range/5BAA6");
    expect(url).not.toContain(PASSWORD_SUFFIX);
    expect(fetchMock.mock.calls[0][1]?.body).toBeUndefined();
  });

  it("requests padding so response size cannot leak match information", async () => {
    fetchMock.mockImplementation(mockRangeResponse("0000000000000000000000000000000000A:1"));

    await countPasswordBreaches("password");

    expect(fetchMock.mock.calls[0][1].headers["Add-Padding"]).toBe("true");
  });

  it("throws when the API responds with a non-OK status", async () => {
    fetchMock.mockImplementation(mockRangeResponse("", false, 503));

    await expect(countPasswordBreaches("password")).rejects.toThrow("503");
  });
});

describe("isPasswordLeaked", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fails open when HIBP is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    // A third-party outage must never block signups.
    await expect(isPasswordLeaked("password")).resolves.toBe(false);
  });

  it("fails open when HIBP returns a server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve("") }));

    await expect(isPasswordLeaked("password")).resolves.toBe(false);
  });

  it("reports a breached password as leaked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`${PASSWORD_SUFFIX}:3303003`),
    }));

    await expect(isPasswordLeaked("password")).resolves.toBe(true);
  });

  // Hits the real HIBP range API. Skipped by default so the suite stays
  // offline-safe; run with HIBP_LIVE=1 to exercise the real network path.
  it.skipIf(!process.env.HIBP_LIVE)("confirms a known-breached password against the live API", async () => {
    await expect(isPasswordLeaked("password")).resolves.toBe(true);
  });
});