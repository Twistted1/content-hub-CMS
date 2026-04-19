import { LucideIcon, Zap, Clock, Share2, RefreshCw } from "lucide-react";
import { TriggerType, Automation } from "@/hooks/useAutomations";

export interface QuickStat {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
}

export const triggerOptions: { value: TriggerType; label: string }[] = [
  { value: "scheduled", label: "Scheduled Time" },
  { value: "new-content", label: "New Content" },
  { value: "engagement", label: "Engagement Threshold" },
  { value: "manual", label: "Manual Trigger" },
];

export const scheduleOptions = [
  { value: "hourly", label: "Every Hour" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export const platformOptions = [
  "YouTube",
  "TikTok",
  "Instagram",
  "Facebook",
  "X",
  "LinkedIn",
  "Email",
  "Slack",
  "Google Drive",
];

export const getQuickStats = (automations: Automation[]): QuickStat[] => {
  const activeCount = automations.filter((a) => a.status === "active").length;
  const totalRuns = automations.reduce((sum, a) => sum + a.runs, 0);
  const uniquePlatforms = new Set(automations.flatMap((a) => a.platforms)).size;

  return [
    { label: "Active Automations", value: String(activeCount), icon: Zap, color: "text-emerald-500" },
    { label: "Total Runs", value: String(totalRuns), icon: RefreshCw, color: "text-blue-500" },
    { label: "Time Saved", value: `${Math.floor(totalRuns * 0.05)}h`, icon: Clock, color: "text-purple-500" },
    { label: "Connected Apps", value: String(uniquePlatforms), icon: Share2, color: "text-orange-500" },
  ];
};

export interface WorkflowPreset {
  id: string;
  name: string;
  description: string;
  frequency: string;
  color: string;
  icon: string;
}

export const workflowPresets: WorkflowPreset[] = [
  {
    id: "twitter-daily",
    name: "X (Twitter) Daily",
    description: "Automatically generate and publish 3 posts per day to X — morning, midday, and evening — optimised for peak engagement windows.",
    frequency: "3x Daily",
    color: "bg-sky-500/10 text-sky-400",
    icon: "Twitter",
  },
  {
    id: "instagram-daily",
    name: "Instagram Feed",
    description: "Schedule one high-quality Instagram post per day with AI-generated captions, hashtags, and optimal posting time detection.",
    frequency: "1x Daily",
    color: "bg-fuchsia-500/10 text-fuchsia-400",
    icon: "Instagram",
  },
  {
    id: "facebook-weekly",
    name: "Facebook Strategy",
    description: "Publish 3 Facebook posts per week — including carousels, links, and engagement posts — tailored to your audience demographics.",
    frequency: "3x Weekly",
    color: "bg-blue-500/10 text-blue-400",
    icon: "Facebook",
  },
];

