/**
 * Static platform configuration — cosmetic data only.
 * NO follower counts, engagement rates, or analytics live here.
 * Real post counts come from usePosts(). Real settings from usePlatforms().
 */

import React from "react";
import { Globe, Mic } from "lucide-react";
import { BrandIcon } from "./BrandIcon";

export interface PlatformConfig {
  id: string;
  name: string;
  icon: any;
  colorClass: string;
  bgGradient: string;
  url: string;
  defaultUsername: string;
}

export const PLATFORM_CONFIG: PlatformConfig[] = [
  {
    id: "youtube",
    name: "YouTube",
    icon: (props: any) => React.createElement(BrandIcon, { name: "youtube", ...props }),
    colorClass: "platform-youtube",
    bgGradient: "from-red-500/20 to-red-600/10",
    url: "https://www.youtube.com/@NovusExchange",
    defaultUsername: "@NovusExchange",
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    icon: (props: any) => React.createElement(BrandIcon, { name: "twitter", ...props }),
    colorClass: "platform-twitter",
    bgGradient: "from-zinc-700/20 to-zinc-800/10",
    url: "https://x.com/NovusExchange",
    defaultUsername: "@NovusExchange",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: (props: any) => React.createElement(BrandIcon, { name: "instagram", ...props }),
    colorClass: "platform-instagram",
    bgGradient: "from-purple-500/20 via-pink-500/10 to-orange-400/10",
    url: "https://www.instagram.com/novusexchange/",
    defaultUsername: "@novusexchange",
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: (props: any) => React.createElement(BrandIcon, { name: "facebook", ...props }),
    colorClass: "platform-facebook",
    bgGradient: "from-blue-600/20 to-blue-700/10",
    url: "https://www.facebook.com/novusexchange",
    defaultUsername: "Novus Exchange",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: (props: any) => React.createElement(BrandIcon, { name: "linkedin", ...props }),
    colorClass: "platform-linkedin",
    bgGradient: "from-blue-700/20 to-blue-800/10",
    url: "https://www.linkedin.com/company/novusexchange",
    defaultUsername: "Novus Exchange",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: (props: any) => React.createElement(BrandIcon, { name: "tiktok", ...props }),
    colorClass: "platform-tiktok",
    bgGradient: "from-pink-500/20 via-purple-500/10 to-cyan-500/10",
    url: "https://www.tiktok.com/@novusexchange",
    defaultUsername: "@novusexchange",
  },
  {
    id: "rumble",
    name: "Rumble",
    icon: (props: any) => React.createElement(BrandIcon, { name: "rumble", ...props }),
    colorClass: "platform-rumble",
    bgGradient: "from-green-500/20 to-lime-600/10",
    url: "https://rumble.com/user/NovusExchange",
    defaultUsername: "@NovusExchange",
  },
  {
    id: "website",
    name: "Website",
    icon: Globe,
    colorClass: "platform-website",
    bgGradient: "from-teal-500/20 to-cyan-600/10",
    url: "https://novusexchange.com",
    defaultUsername: "novusexchange.com",
  },
  {
    id: "podcast",
    name: "Podcast",
    icon: Mic,
    colorClass: "platform-podcast",
    bgGradient: "from-purple-500/20 to-violet-600/10",
    url: "",
    defaultUsername: "Novus Exchange Podcast",
  },
];

/** Platforms not yet in PLATFORM_CONFIG — shown in the Available tab */
export const availablePlatforms = [
  {
    id: "pinterest",
    name: "Pinterest",
    icon: (props: any) => React.createElement(BrandIcon, { name: "pinterest", ...props }),
    description: "Visual discovery and bookmarking",
    users: "450M+",
  },
  {
    id: "snapchat",
    name: "Snapchat",
    icon: (props: any) => React.createElement(BrandIcon, { name: "snapchat", ...props }),
    description: "Stories and AR content",
    users: "750M+",
  },
  {
    id: "threads",
    name: "Threads",
    icon: (props: any) => React.createElement(BrandIcon, { name: "threads", ...props }),
    description: "Text-based conversations",
    users: "150M+",
  },
];

/** Hex / CSS color per platform id — used for chart strokes */
export const platformColors: Record<string, string> = {
  youtube:   "#EF4444",
  tiktok:    "#06B6D4",
  instagram: "#E1306C",
  facebook:  "#1877F2",
  linkedin:  "#0A66C2",
  twitter:   "#F8FAFC",
  website:   "#14B8A6",
  podcast:   "#F97316",
  rumble:    "#22C55E",
};
