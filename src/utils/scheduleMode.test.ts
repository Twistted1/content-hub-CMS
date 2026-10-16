import { describe, it, expect } from "vitest";
import {
  SCHEDULE_MODES,
  DEFAULT_SCHEDULE_MODE,
  CRON_SCHEDULE_MODE,
  isScheduleMode,
  isSelectableScheduleMode,
  normalizeScheduleMode,
  firesWebhooksOnCreate,
} from "./scheduleMode";

describe("normalizeScheduleMode", () => {
  it("keeps every known mode unchanged", () => {
    for (const mode of SCHEDULE_MODES) {
      expect(normalizeScheduleMode(mode)).toBe(mode);
    }
  });

  it("treats an omitted mode as the shipped default", () => {
    // `content-pipeline` stored `scheduleMode || "immediate"`, so an omitted
    // mode has always meant immediate. That is preserved, not changed.
    expect(normalizeScheduleMode(undefined)).toBe(DEFAULT_SCHEDULE_MODE);
    expect(normalizeScheduleMode(null)).toBe(DEFAULT_SCHEDULE_MODE);
    expect(normalizeScheduleMode("")).toBe(DEFAULT_SCHEDULE_MODE);
  });

  it("never resolves an unrecognised string to immediate", () => {
    // The core safety property: a typo must not publish without review.
    for (const bogus of ["Awaiting_Review", "now", "publish", "IMMEDIATE", "0"]) {
      expect(normalizeScheduleMode(bogus)).not.toBe("immediate");
      expect(normalizeScheduleMode(bogus)).toBe("scheduled");
    }
  });

  it("never resolves a non-string to immediate", () => {
    for (const bogus of [123, true, {}, [], Symbol("x")]) {
      expect(normalizeScheduleMode(bogus)).toBe("scheduled");
    }
  });
});

describe("firesWebhooksOnCreate", () => {
  it("delivers only for an explicit immediate", () => {
    expect(firesWebhooksOnCreate("immediate")).toBe(true);
  });

  it("holds every other mode, scheduledAt or not", () => {
    // This is the behaviour the old catch-all got wrong: `"scheduled"` and
    // `"awaiting_review"` with no `scheduledAt` fell through to the immediate
    // branch and published on creation.
    for (const mode of ["scheduled", "draft", CRON_SCHEDULE_MODE] as const) {
      expect(firesWebhooksOnCreate(mode)).toBe(false);
    }
  });
});

describe("type guards", () => {
  it("isScheduleMode accepts exactly the union", () => {
    for (const mode of SCHEDULE_MODES) expect(isScheduleMode(mode)).toBe(true);
    expect(isScheduleMode("awaiting_review")).toBe(true);
    expect(isScheduleMode("nope")).toBe(false);
    expect(isScheduleMode(undefined)).toBe(false);
    expect(isScheduleMode(7)).toBe(false);
  });

  it("isSelectableScheduleMode excludes the cron-only mode", () => {
    expect(isSelectableScheduleMode("draft")).toBe(true);
    expect(isSelectableScheduleMode("scheduled")).toBe(true);
    expect(isSelectableScheduleMode("immediate")).toBe(true);
    expect(isSelectableScheduleMode(CRON_SCHEDULE_MODE)).toBe(false);
    expect(isSelectableScheduleMode("whatever")).toBe(false);
  });
});
