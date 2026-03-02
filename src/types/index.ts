export interface Reminder {
  id: string;
  title: string;
  description?: string;
  type: "interval" | "scheduled";
  intervalMinutes?: number;
  scheduledTime?: string;
  activeDays: number[];
  enabled: boolean;
  color: string;
}

export interface RestPeriod {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  activeDays: number[];
  enabled: boolean;
}

export interface AppConfig {
  reminders: Reminder[];
  restPeriods: RestPeriod[];
  idleTimeoutMinutes: number;
  autoStart: boolean;
  monitorApps: boolean;
  remindersPaused: boolean;
  theme: "light" | "dark" | "system";
  notificationDurationMinutes: number;
}

export interface ReminderCountdown {
  id: string;
  title: string;
  color: string;
  reminderType: "interval" | "scheduled" | string;
  enabled: boolean;
  nextInSeconds: number | null;
  blockedReason: "disabled" | "paused" | "idle" | "rest" | null | string;
}

export interface AppUsageRecord {
  date: string;
  activeMinutes: number;
}

export interface AppFocusRecord {
  appName: string;
  windowTitle: string;
  focusSeconds: number;
  date: string;
}

export type Page = "reminders" | "rest" | "dashboard" | "settings";
