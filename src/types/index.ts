import { Database } from "@/integrations/supabase/types";

// Projects
export type ProjectStatus = "planning" | "in-progress" | "review" | "completed" | "on-hold";
export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  priority: "low" | "medium" | "high";
  dueDate: string;
  startDate: string;
  progress: number;
  comments: number;
  attachments: number;
  assignees: { name: string; avatar?: string }[];
  tags: string[];
  createdAt: string;
}

// Tasks
export interface Task {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: "todo" | "in-progress" | "review" | "done" | "blocked";
  priority: "low" | "medium" | "high" | "urgent";
  startDate?: number; // Day offset
  duration?: number;
  progress: number;
  dependencies?: string[];
  assigneeId?: string;
  dueDate?: string;
  createdAt: string;
}

// Posts
export type PostStatus = Database["public"]["Enums"]["post_status"] | "awaiting_review";
export type PostType = Database["public"]["Enums"]["post_type"];
export type PlatformType = Database["public"]["Enums"]["platform_type"];

export interface PostPlatform {
  id: string;
  postId: string;
  platform: PlatformType;
  status: PostStatus;
  platformPostId: string | null;
  publishedAt: string | null;
  errorMessage: string | null;
}

export interface UserPlatform {
  id: string;
  userId: string;
  platformType: PlatformType;
  accountName: string;
  username: string | null;
  avatarUrl: string | null;
  settings: {
    autoPublish: boolean;
    notifications: boolean;
    analytics: boolean;
    contentBackup: boolean;
  };
  status: string;
  lastSync: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Media {
  id: string;
  userId: string;
  postId: string | null;
  filename: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  title: string;
  content: string | null;
  excerpt: string | null;
  status: PostStatus;
  type: PostType;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: string | null;
  platforms?: PostPlatform[];
  media?: Media[];
}

// Automations
export type TriggerType = "scheduled" | "new-content" | "engagement" | "manual";
export type AutomationStatus = "active" | "paused";

export interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: TriggerType;
  triggerConfig: {
    schedule?: string;
    threshold?: number;
  };
  platforms: string[];
  status: AutomationStatus;
  lastRun: string | null;
  runs: number;
  createdAt: string;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  status: "success" | "failed" | "running";
  startedAt: string;
  completedAt: string | null;
  message: string;
}

// Users
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive" | "pending";
  lastActive?: string;
  joinedDate: string;
  avatar?: string;
  permissions?: string[];
}

// Strategies
export type StrategyStatus = 'active' | 'planning' | 'completed' | 'paused';

export interface StrategyGoal {
  id: string;
  title: string;
  completed: boolean;
  sort_order: number;
}

export interface Strategy {
  id: string;
  name: string;
  description: string | null;
  status: StrategyStatus;
  progress: number;
  start_date: string | null;
  end_date: string | null;
  platforms: string[];
  assignees: string[];
  created_at: string;
  updated_at: string;
  goalItems: StrategyGoal[];
}

// Notes
export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  color: string;
  startDate?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

// Universal JSON Template (UJT)
export interface UJTItem {
  type: "ARTICLE" | "POST" | "NOTE" | "PROJECT" | "STRATEGY";
  data: any;
  metadata?: {
    platforms?: PlatformType[];
    scheduled_at?: string;
    priority?: "low" | "medium" | "high";
    status?: string;
    tags?: string[];
    isPinned?: boolean;
    color?: string;
    category?: string;
  };
  imageUrl?: string;
}

export interface UniversalTemplate {
  version: "1.0";
  items: UJTItem[];
}
