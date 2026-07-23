import { Globe, Mic } from "lucide-react";
import React from "react";
import { BrandIcon } from "./BrandIcon";

// Static branding/identity only. Follower counts, view/engagement stats,
// weekly growth, "top post" data, and activity feeds are NOT tracked by
// this app (no analytics ingestion pipeline exists) and must never be
// fabricated here - see src/pages/Platforms.tsx, which merges this
// identity data with real connection status (usePlatforms/usePlatformOAuth)
// and real post counts (usePosts) at render time.
export const platforms = [
  {
    id: "youtube",
    name: "YouTube",
    icon: (props: any) => React.createElement(BrandIcon, { name: "youtube", ...props }),
    colorClass: "platform-youtube",
    bgGradient: "from-red-500/20 to-red-600/10",
  },
  {
    id: "twitter",
    name: "X",
    icon: (props: any) => React.createElement(BrandIcon, { name: "twitter", ...props }),
    colorClass: "platform-twitter",
    bgGradient: "from-zinc-700/20 to-zinc-800/10",
  },
  {
    id: "website",
    name: "Website",
    icon: Globe,
    colorClass: "platform-website",
    bgGradient: "from-teal-500/20 to-cyan-600/10",
    subPlatforms: ["Blog Posts", "Newsletter"],
  },
  {
    id: "podcast",
    name: "Podcast",
    icon: Mic,
    colorClass: "platform-podcast",
    bgGradient: "from-purple-500/20 to-violet-600/10",
  },
  {
    id: "rumble",
    name: "Rumble",
    icon: (props: any) => React.createElement(BrandIcon, { name: "rumble", ...props }),
    colorClass: "platform-rumble",
    bgGradient: "from-green-500/20 to-lime-600/10",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: (props: any) => React.createElement(BrandIcon, { name: "tiktok", ...props }),
    colorClass: "platform-tiktok",
    bgGradient: "from-pink-500/20 via-purple-500/10 to-cyan-500/10",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: (props: any) => React.createElement(BrandIcon, { name: "instagram", ...props }),
    colorClass: "platform-instagram",
    bgGradient: "from-purple-500/20 via-pink-500/10 to-orange-400/10",
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: (props: any) => React.createElement(BrandIcon, { name: "facebook", ...props }),
    colorClass: "platform-facebook",
    bgGradient: "from-blue-600/20 to-blue-700/10",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: (props: any) => React.createElement(BrandIcon, { name: "linkedin", ...props }),
    colorClass: "platform-linkedin",
    bgGradient: "from-blue-700/20 to-blue-800/10",
  },
];

// Third-party platforms not yet integrated. "users" is each platform's own
// public global user-base figure (general public knowledge), not this
// account's data.
export const availablePlatforms = [
  { id: "pinterest", name: "Pinterest", icon: (props: any) => React.createElement(BrandIcon, { name: "pinterest", ...props }), description: "Visual discovery and bookmarking", users: "450M+" },
  { id: "snapchat", name: "Snapchat", icon: (props: any) => React.createElement(BrandIcon, { name: "snapchat", ...props }), description: "Stories and AR content", users: "750M+" },
  { id: "threads", name: "Threads", icon: (props: any) => React.createElement(BrandIcon, { name: "threads", ...props }), description: "Text-based conversations", users: "150M+" },
];

export const platformColors: Record<string, string> = {
  youtube: "#EF4444",
  tiktok: "#06B6D4",
  instagram: "#E1306C",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
  twitter: "#F8FAFC",
  website: "#14B8A6",
  novusexchange: "#14B8A6",
  podcast: "#F97316",
  rumble: "#22C55E",
};
