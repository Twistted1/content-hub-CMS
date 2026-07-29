import { describe, it, expect } from "vitest";
import {
  normalizePlatform,
  getCurrentPeriod,
  formatSlotTime,
  getWebsiteCategoryForDate,
  getRecommendedSlots,
  getNextOptimalDate,
  DAYS,
} from "./scheduling";

describe("normalizePlatform", () => {
  it("maps known platform names through unchanged", () => {
    expect(normalizePlatform("instagram")).toBe("instagram");
    expect(normalizePlatform("linkedin")).toBe("linkedin");
  });

  it("normalizes X/Twitter aliases to 'twitter'", () => {
    expect(normalizePlatform("x")).toBe("twitter");
    expect(normalizePlatform("twitter/x")).toBe("twitter");
  });

  it("normalizes 'articles' to 'website'", () => {
    expect(normalizePlatform("articles")).toBe("website");
  });

  it("is case-insensitive", () => {
    expect(normalizePlatform("Instagram")).toBe("instagram");
    expect(normalizePlatform("TIKTOK")).toBe("tiktok");
  });

  it("returns null for an unrecognized platform", () => {
    expect(normalizePlatform("myspace")).toBeNull();
  });
});

describe("getCurrentPeriod", () => {
  it("returns a period between 1 and 4 inclusive", () => {
    // Sample the first day of every month across a year — getWeekOfMonth
    // resets each month, so this exercises the (weekOfMonth - 1) % 4 + 1
    // wraparound across a wide range of real dates rather than one fixed one.
    for (let month = 0; month < 12; month++) {
      for (let day = 1; day <= 28; day += 7) {
        const period = getCurrentPeriod(new Date(2026, month, day));
        expect(period).toBeGreaterThanOrEqual(1);
        expect(period).toBeLessThanOrEqual(4);
      }
    }
  });

  it("is deterministic for the same date", () => {
    const date = new Date(2026, 6, 15);
    expect(getCurrentPeriod(date)).toBe(getCurrentPeriod(new Date(date)));
  });
});

describe("formatSlotTime", () => {
  it("formats 24h time strings to 12h with AM/PM", () => {
    expect(formatSlotTime("09:00")).toBe("9:00 AM");
    expect(formatSlotTime("13:30")).toBe("1:30 PM");
    expect(formatSlotTime("00:00")).toBe("12:00 AM");
    expect(formatSlotTime("12:00")).toBe("12:00 PM");
  });

  it("uses only the start of a time range", () => {
    expect(formatSlotTime("14:00-15:00")).toBe("2:00 PM");
  });
});

describe("getWebsiteCategoryForDate", () => {
  it("returns a category for every day of the week", () => {
    DAYS.forEach((_, i) => {
      // 2026-07-19 is a Sunday; walk one full week from there.
      const date = new Date(2026, 6, 19 + i);
      const result = getWebsiteCategoryForDate(date);
      expect(result.category).toBeTruthy();
      expect(result.focus).toBeTruthy();
    });
  });

  it("is stable for the same weekday across different weeks", () => {
    const sunday1 = getWebsiteCategoryForDate(new Date(2026, 6, 19));
    const sunday2 = getWebsiteCategoryForDate(new Date(2026, 6, 26));
    expect(sunday1).toEqual(sunday2);
  });
});

describe("getRecommendedSlots", () => {
  it("returns an empty array for an unrecognized platform", () => {
    expect(getRecommendedSlots("myspace", new Date(2026, 6, 20))).toEqual([]);
  });

  it("only returns slots for the requested platform", () => {
    const slots = getRecommendedSlots("twitter", new Date(2026, 6, 20));
    slots.forEach((slot) => expect(slot.platform).toBe("twitter"));
  });
});

describe("getNextOptimalDate", () => {
  it("returns a date strictly after the start date", () => {
    const start = new Date(2026, 6, 20, 12, 0, 0);
    const next = getNextOptimalDate("twitter", start);
    expect(next.getTime()).toBeGreaterThan(start.getTime());
  });

  it("looks no further than 14 days ahead before giving up", () => {
    const start = new Date(2026, 6, 20);
    const next = getNextOptimalDate("myspace", start);
    // Unrecognized platform has no slots at all, so it should fall back
    // to returning the original start date rather than searching forever.
    expect(next.getTime()).toBe(start.getTime());
  });
});
