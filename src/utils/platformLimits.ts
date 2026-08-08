/**
 * Per-platform character/hashtag limits, shared between the Calendar's event
 * editor and the Review Inbox's per-post editor so the two surfaces can't
 * drift out of sync with each other.
 */
export interface PlatformLimit {
  caption: number;
  hashtags?: number;
  label: string;
}

export const PLATFORM_LIMITS: Record<string, PlatformLimit> = {
  twitter:   { caption: 280,    label: "X (Twitter)" },
  x:         { caption: 280,    label: "X (Twitter)" },
  instagram: { caption: 2200,   hashtags: 30,  label: "Instagram" },
  facebook:  { caption: 63206,  label: "Facebook" },
  linkedin:  { caption: 3000,   label: "LinkedIn" },
  tiktok:    { caption: 2200,   hashtags: 100, label: "TikTok" },
  youtube:   { caption: 5000,   label: "YouTube" },
  threads:   { caption: 500,    label: "Threads" },
  rumble:    { caption: 5000,   label: "Rumble" },
  website:   { caption: 100000, label: "Website" },
  podcast:   { caption: 4000,   label: "Podcast" },
};

export function getPlatformLimit(platform?: string | null): PlatformLimit | null {
  if (!platform) return null;
  return PLATFORM_LIMITS[platform.toLowerCase()] ?? null;
}
