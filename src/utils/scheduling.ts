import { getDay, getWeekOfMonth, addDays } from "date-fns";

export type DayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

export interface ScheduledSlot {
  platform: string;
  time: string; // HH:mm
}

import twitterSchedule from '../data/platforms/twitter.json';
import instagramSchedule from '../data/platforms/instagram.json';
import youtubeSchedule from '../data/platforms/youtube.json';
import tiktokSchedule from '../data/platforms/tiktok.json';
import rumbleSchedule from '../data/platforms/rumble.json';
import websiteSchedule from '../data/platforms/website.json';
import linkedinSchedule from '../data/platforms/linkedin.json';
import facebookSchedule from '../data/platforms/facebook.json';

export type PlatformKey = "twitter" | "instagram" | "tiktok" | "facebook" | "rumble" | "linkedin" | "youtube" | "website";

type PlatformScheduleData = {
  platform: string;
  schedule: Record<string, Partial<Record<DayName, string[]>>>;
};

export const PLATFORM_INFO: Record<PlatformKey, { label: string; frequency: string; publishing: string; summary: string }> = {
  twitter: {
    label: "Twitter/X",
    frequency: "3x daily",
    publishing: "Direct OAuth when connected",
    summary: "Morning, midday, and evening posts every day.",
  },
  instagram: {
    label: "Instagram",
    frequency: "1x daily",
    publishing: "Webhook",
    summary: "One daily post queued for review.",
  },
  tiktok: {
    label: "TikTok",
    frequency: "3x weekly",
    publishing: "Webhook",
    summary: "Tuesday, Thursday, and Friday video slots.",
  },
  facebook: {
    label: "Facebook",
    frequency: "1x weekly",
    publishing: "Webhook",
    summary: "One weekly community update.",
  },
  rumble: {
    label: "Rumble",
    frequency: "1x weekly",
    publishing: "Webhook",
    summary: "One weekly video distribution slot.",
  },
  linkedin: {
    label: "LinkedIn",
    frequency: "1x daily",
    publishing: "Direct OAuth when connected",
    summary: "One daily professional insight.",
  },
  youtube: {
    label: "YouTube",
    frequency: "1x weekly",
    publishing: "Webhook",
    summary: "One weekly video/community slot.",
  },
  website: {
    label: "Website/Articles",
    frequency: "1x daily",
    publishing: "Webhook",
    summary: "Daily article cycling through the seven strategic categories.",
  },
};

export const PLATFORM_ORDER: PlatformKey[] = ["twitter", "instagram", "tiktok", "facebook", "rumble", "linkedin", "youtube", "website"];

const PLATFORM_SCHEDULES: Record<PlatformKey, PlatformScheduleData> = {
  twitter: twitterSchedule,
  instagram: instagramSchedule,
  tiktok: tiktokSchedule,
  facebook: facebookSchedule,
  rumble: rumbleSchedule,
  linkedin: linkedinSchedule,
  youtube: youtubeSchedule,
  website: websiteSchedule,
};

const allPlatformSchedules = PLATFORM_ORDER.map((platform) => PLATFORM_SCHEDULES[platform]);

export function normalizePlatform(platform: string): PlatformKey | null {
  const key = platform.toLowerCase().replace(/^x$/, "twitter").replace(/^twitter\/x$/, "twitter").replace(/^articles$/, "website") as PlatformKey;
  return key in PLATFORM_INFO ? key : null;
}

export const CONTENT_SCHEDULE: Record<number, Record<DayName, ScheduledSlot[]>> = {};

// Initialize Periods 1-4
[1, 2, 3, 4].forEach(period => {
  CONTENT_SCHEDULE[period] = {
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: []
  };
});

// Build the content schedule dynamically
allPlatformSchedules.forEach((platformData) => {
  const platformName = normalizePlatform(platformData.platform);
  if (!platformName) return;
  const scheduleData = platformData.schedule as any;
  
  [1, 2, 3, 4].forEach(period => {
    const periodSchedule = scheduleData[period.toString()];
    if (periodSchedule) {
      Object.entries(periodSchedule).forEach(([day, times]) => {
        const dayName = day as DayName;
        if (Array.isArray(times)) {
          times.forEach(time => {
            CONTENT_SCHEDULE[period][dayName].push({ platform: platformName, time: time as string });
          });
        }
      });
    }
  });
});

// Sort times within each day
[1, 2, 3, 4].forEach(period => {
  Object.keys(CONTENT_SCHEDULE[period]).forEach(day => {
    CONTENT_SCHEDULE[period][day as DayName].sort((a, b) => a.time.localeCompare(b.time));
  });
});


export const DAYS: DayName[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Website/Articles cycle through 7 strategic core-domain categories — one per day of the week.
export const WEBSITE_CATEGORY_BY_DAY: Record<DayName, { category: string; focus: string }> = {
  Monday:    { category: "Geopolitics",                 focus: "International power dynamics" },
  Tuesday:   { category: "Economics",                   focus: "Global financial systems" },
  Wednesday: { category: "Media",                       focus: "Narrative control / Information warfare" },
  Thursday:  { category: "Technology",                  focus: "Surveillance / AI / Infrastructure" },
  Friday:    { category: "Security",                    focus: "Intelligence / Defense" },
  Saturday:  { category: "Climate",                     focus: "Resource conflicts / Policy" },
  Sunday:    { category: "Corporate Social Responsibility", focus: "Governance / Impact" },
};

export function getWebsiteCategoryForDate(date: Date = new Date()) {
  return WEBSITE_CATEGORY_BY_DAY[DAYS[getDay(date)]];
}

export function getWebsiteCategoryForDay(day: DayName) {
  return WEBSITE_CATEGORY_BY_DAY[day];
}

export function getCurrentPeriod(date: Date = new Date()): number {
  const weekOfMonth = getWeekOfMonth(date);
  // Cycle between 1-4
  return ((weekOfMonth - 1) % 4) + 1;
}

export function getRecommendedSlots(platform: string, date: Date = new Date()): ScheduledSlot[] {
  const platformKey = normalizePlatform(platform);
  if (!platformKey) return [];
  const period = getCurrentPeriod(date);
  const dayIndex = getDay(date);
  const dayName = DAYS[dayIndex];

  const daySchedule = CONTENT_SCHEDULE[period][dayName] || [];
  return daySchedule.filter(s => s.platform === platformKey);
}

export function getNextOptimalDate(platform: string, startDate: Date = new Date()): Date {
  let currentDate = startDate;

  // Look forward up to 14 days
  for (let i = 0; i < 14; i++) {
    const slots = getRecommendedSlots(platform, currentDate);
    if (slots.length > 0) {
      const [h, m] = slots[0].time.split(":").map(Number);
      const targetDate = new Date(currentDate);
      targetDate.setHours(h, m, 0, 0);

      if (targetDate > startDate) {
        return targetDate;
      }
    }
    currentDate = addDays(currentDate, 1);
  }

  return startDate;
}

export interface UpcomingScheduleSlot extends ScheduledSlot {
  platform: PlatformKey;
  label: string;
  date: Date;
  day: DayName;
  category?: string;
  focus?: string;
}

export function formatSlotTime(time: string): string {
  const start = time.split("-")[0];
  const [h, m] = start.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function getSlotsForDate(date: Date): UpcomingScheduleSlot[] {
  const period = getCurrentPeriod(date);
  const day = DAYS[getDay(date)];

  return (CONTENT_SCHEDULE[period][day] || []).map((slot) => {
    const platform = normalizePlatform(slot.platform) as PlatformKey;
    const websiteCategory = platform === "website" ? getWebsiteCategoryForDate(date) : undefined;

    return {
      ...slot,
      platform,
      label: PLATFORM_INFO[platform].label,
      date: new Date(date),
      day,
      category: websiteCategory?.category,
      focus: websiteCategory?.focus,
    };
  });
}

export function getUpcomingScheduleSlots(startDate: Date = new Date(), limit = 10): UpcomingScheduleSlot[] {
  const slots: UpcomingScheduleSlot[] = [];

  for (let i = 0; i < 21 && slots.length < limit; i++) {
    const date = addDays(startDate, i);
    const daySlots = getSlotsForDate(date)
      .map((slot) => {
        const [h, m] = slot.time.split("-")[0].split(":").map(Number);
        const slotDate = new Date(date);
        slotDate.setHours(h, m, 0, 0);
        return { ...slot, date: slotDate };
      })
      .filter((slot) => slot.date >= startDate);

    slots.push(...daySlots);
  }

  return slots.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, limit);
}

export function getPlatformScheduleSummary(platform: PlatformKey): string {
  const schedule = PLATFORM_SCHEDULES[platform].schedule["1"] || {};
  return DAYS
    .filter((day) => schedule[day]?.length)
    .map((day) => `${day.slice(0, 3)} ${schedule[day]!.map(formatSlotTime).join(", ")}`)
    .join(" · ");
}

export function getWeeklyPlatformOverview() {
  return PLATFORM_ORDER.map((platform) => ({
    platform,
    ...PLATFORM_INFO[platform],
    slots: getPlatformScheduleSummary(platform),
  }));
}
