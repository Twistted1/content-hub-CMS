import { format, getDay, getWeekOfMonth, addDays, getWeek } from "date-fns";

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
import apiSchedule from '../data/platforms/api.json';

const allPlatformSchedules = [
  twitterSchedule,
  instagramSchedule,
  youtubeSchedule,
  tiktokSchedule,
  rumbleSchedule,
  websiteSchedule,
  linkedinSchedule,
  apiSchedule
];

export const CONTENT_SCHEDULE: Record<number, Record<DayName, ScheduledSlot[]>> = {};

// Initialize Periods 1-4
[1, 2, 3, 4].forEach(period => {
  CONTENT_SCHEDULE[period] = {
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: []
  };
});

// Build the content schedule dynamically
allPlatformSchedules.forEach((platformData) => {
  const platformName = platformData.platform;
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

export function getCurrentPeriod(date: Date = new Date()): number {
  const weekOfMonth = getWeekOfMonth(date);
  // Cycle between 1-4
  return ((weekOfMonth - 1) % 4) + 1;
}

export function getRecommendedSlots(platform: string, date: Date = new Date()): ScheduledSlot[] {
  const period = getCurrentPeriod(date);
  const dayIndex = getDay(date);
  const dayName = DAYS[dayIndex];

  const daySchedule = CONTENT_SCHEDULE[period][dayName] || [];
  return daySchedule.filter(s => s.platform.toLowerCase() === platform.toLowerCase());
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
