import { describe, it, expect, vi, afterEach } from "vitest";
import { toLocalDateKey, localWallClockToUtcIso, utcIsoToLocalParts } from "./scheduleTime";

describe("scheduleTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats a local date key without a UTC rollover", () => {
    // 23:30 local on the 5th is the 6th in UTC for negative offsets; the key
    // must still be the local day.
    const d = new Date(2026, 2, 5, 23, 30);
    expect(toLocalDateKey(d)).toBe("2026-03-05");
  });

  it("converts a local wall clock to the matching UTC instant", () => {
    const iso = localWallClockToUtcIso("2026-03-05", "09:00");
    expect(iso).not.toBeNull();
    const back = new Date(iso!);
    expect(back.getFullYear()).toBe(2026);
    expect(back.getMonth()).toBe(2);
    expect(back.getDate()).toBe(5);
    expect(back.getHours()).toBe(9);
    expect(back.getMinutes()).toBe(0);
  });

  it("round-trips through utcIsoToLocalParts", () => {
    const iso = localWallClockToUtcIso("2026-07-14", "17:45")!;
    expect(utcIsoToLocalParts(iso)).toEqual({ date: "2026-07-14", time: "17:45" });
  });

  it("defaults to 09:00 when no time is supplied", () => {
    const back = new Date(localWallClockToUtcIso("2026-01-02", "")!);
    expect(back.getHours()).toBe(9);
  });

  it("returns null for a missing or malformed date", () => {
    expect(localWallClockToUtcIso(null, "09:00")).toBeNull();
    expect(localWallClockToUtcIso("", "09:00")).toBeNull();
    expect(localWallClockToUtcIso("not-a-date", "09:00")).toBeNull();
  });

  it("falls back to today when reading a null or invalid instant", () => {
    const today = toLocalDateKey(new Date());
    expect(utcIsoToLocalParts(null).date).toBe(today);
    expect(utcIsoToLocalParts("garbage").date).toBe(today);
  });
});
