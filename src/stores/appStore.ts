import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, Page } from "../types";

const DEFAULT_CONFIG: AppConfig = {
  reminders: [
    {
      id: "default-water",
      title: "喝水时间",
      description: "站起来喝杯水，活动一下",
      type: "interval",
      intervalMinutes: 50,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      enabled: true,
      color: "#06b6d4",
    },
    {
      id: "default-walk",
      title: "站起来走走",
      description: "离开座位，活动一下身体",
      type: "interval",
      intervalMinutes: 120,
      activeDays: [1, 2, 3, 4, 5],
      enabled: true,
      color: "#10b981",
    },
    {
      id: "default-morning",
      title: "出去散步",
      description: "早晨散步，呼吸新鲜空气",
      type: "scheduled",
      scheduledTime: "08:00",
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      enabled: true,
      color: "#f59e0b",
    },
  ],
  restPeriods: [
    {
      id: "default-lunch",
      name: "午休",
      startTime: "12:00",
      endTime: "13:30",
      activeDays: [1, 2, 3, 4, 5],
      enabled: true,
    },
    {
      id: "default-sleep",
      name: "睡眠",
      startTime: "22:00",
      endTime: "08:00",
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      enabled: true,
    },
  ],
  idleTimeoutMinutes: 10,
  autoStart: false,
  monitorApps: false,
  theme: "system",
  notificationDurationSeconds: 8,
};

interface AppState {
  config: AppConfig;
  currentPage: Page;
  isPaused: boolean;
  isIdle: boolean;
  todayActiveMinutes: number;
  setConfig: (config: AppConfig) => void;
  updateConfig: (partial: Partial<AppConfig>) => void;
  setCurrentPage: (page: Page) => void;
  setPaused: (paused: boolean) => void;
  setIdle: (idle: boolean) => void;
  setTodayActiveMinutes: (minutes: number) => void;
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  config: DEFAULT_CONFIG,
  currentPage: "reminders",
  isPaused: false,
  isIdle: false,
  todayActiveMinutes: 0,

  setConfig: (config) => set({ config }),

  updateConfig: (partial) =>
    set((state) => ({
      config: { ...state.config, ...partial },
    })),

  setCurrentPage: (page) => set({ currentPage: page }),
  setPaused: (paused) => set({ isPaused: paused }),
  setIdle: (idle) => set({ isIdle: idle }),
  setTodayActiveMinutes: (minutes) => set({ todayActiveMinutes: minutes }),

  loadConfig: async () => {
    try {
      const config = await invoke<AppConfig>("load_config");
      set({ config });
    } catch {
      // Use default config on first run
      await get().saveConfig();
    }
  },

  saveConfig: async () => {
    try {
      await invoke("save_config", { config: get().config });
    } catch (e) {
      console.error("Failed to save config:", e);
    }
  },
}));
