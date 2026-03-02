import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, Variants } from "framer-motion";
import { useAppStore } from "../../stores/appStore";
import type { ReminderInteractionStats } from "../../types";

interface TopAppEntry {
  app_name: string;
  focus_seconds: number;
  date: string;
}

type Period = "day" | "month" | "year";

function todayDate() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatFocus(seconds: number) {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const remain = seconds % 60;
    return `${mins}m ${remain}s`;
  }
  return `${seconds}s`;
}

function appGlyph(name: string) {
  const n = name.toLowerCase();
  if (n.includes("chrome") || n.includes("edge") || n.includes("firefox")) return "🌐";
  if (n.includes("code") || n.includes("devenv") || n.includes("idea")) return "🧩";
  if (n.includes("wechat") || n.includes("qq") || n.includes("discord")) return "💬";
  if (n.includes("notepad") || n.includes("word") || n.includes("excel")) return "📝";
  if (n.includes("explorer")) return "📁";
  if (n.includes("obs") || n.includes("potplayer") || n.includes("vlc")) return "🎬";
  if (n.includes("steam") || n.includes("game")) return "🎮";
  if (n.includes("powershell") || n.includes("cmd") || n.includes("terminal")) return "🖥️";
  return "🔹";
}

const CHART_COLORS = ["#38bdf8", "#a78bfa", "#f59e0b", "#10b981", "#f97316", "#ef4444"];

export function DashboardPage() {
  const { config } = useAppStore();
  const [apps, setApps] = useState<TopAppEntry[]>([]);
  const [currentApp, setCurrentApp] = useState<string>("");
  const [loadingApps, setLoadingApps] = useState(false);
  const [period, setPeriod] = useState<Period>("day");
  const [activeMinutes, setActiveMinutes] = useState(0);
  const [interactionStats, setInteractionStats] = useState<ReminderInteractionStats>({
    shown: 0,
    done: 0,
    snoozed: 0,
    missed: 0,
    avgResponseSeconds: 0,
    ignoredStreak: 0,
  });
  const today = useMemo(() => todayDate(), []);
  const [selectedDay, setSelectedDay] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(today.slice(0, 4));

  const hours = Math.floor(activeMinutes / 60);
  const mins = activeMinutes % 60;
  const safeDay = /^\d{4}-\d{2}-\d{2}$/.test(selectedDay) ? selectedDay : today;
  const safeMonth = /^\d{4}-\d{2}$/.test(selectedMonth) ? selectedMonth : today.slice(0, 7);
  const safeYear = /^\d{4}$/.test(selectedYear) ? selectedYear : today.slice(0, 4);

  const referenceDate = useMemo(() => {
    if (period === "day") {
      return safeDay;
    }
    if (period === "month") {
      return `${safeMonth}-01`;
    }
    return `${safeYear}-01-01`;
  }, [period, safeDay, safeMonth, safeYear]);

  const periodText = period === "day" ? "当日" : period === "month" ? "当月" : "当年";
  const completionRate =
    interactionStats.shown > 0 ? Math.round((interactionStats.done / interactionStats.shown) * 100) : 0;

  useEffect(() => {
    let cancelled = false;

    const refreshActiveMinutes = async () => {
      try {
        const minutes = await invoke<number>("get_active_minutes_by_period", {
          period,
          referenceDate,
        });
        if (!cancelled) {
          setActiveMinutes(minutes);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Failed to load active minutes by period:", e);
        }
      }
    };

    void refreshActiveMinutes();
    const timer = window.setInterval(() => {
      void refreshActiveMinutes();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [period, referenceDate]);

  useEffect(() => {
    let cancelled = false;

    const refreshInteractionStats = async () => {
      try {
        const stats = await invoke<ReminderInteractionStats>("get_reminder_interaction_stats_by_period", {
          period,
          referenceDate,
        });
        if (!cancelled) {
          setInteractionStats(stats);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Failed to load reminder interaction stats:", e);
        }
      }
    };

    void refreshInteractionStats();
    const timer = window.setInterval(() => {
      void refreshInteractionStats();
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [period, referenceDate]);

  useEffect(() => {
    if (!config.monitorApps) {
      setApps([]);
      setLoadingApps(false);
      return;
    }

    let cancelled = false;

    const refreshApps = async () => {
      setLoadingApps(true);
      try {
        const list = await invoke<TopAppEntry[]>("get_top_apps_by_period", {
          period,
          referenceDate,
        });
        if (!cancelled) {
          setApps(list);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Failed to load top apps:", e);
        }
      } finally {
        if (!cancelled) {
          setLoadingApps(false);
        }
      }
    };

    void refreshApps();
    const timer = window.setInterval(() => {
      void refreshApps();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [config.monitorApps, period, referenceDate]);

  useEffect(() => {
    if (!config.monitorApps) {
      setCurrentApp("");
      return;
    }

    let cancelled = false;

    const refreshCurrentApp = async () => {
      try {
        const appName = await invoke<string | null>("get_current_app_name");
        if (!cancelled) {
          setCurrentApp(appName ?? "");
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Failed to load current app:", e);
        }
      }
    };

    void refreshCurrentApp();
    const timer = window.setInterval(() => {
      void refreshCurrentApp();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [config.monitorApps]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30, filter: "blur(4px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { type: "spring", stiffness: 200, damping: 20 },
    },
  };

  const chartApps = apps.slice(0, 6);
  const maxFocus = Math.max(1, ...chartApps.map((a) => a.focus_seconds));

  return (
    <div className="h-full flex flex-col">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-main">Dashboard</h2>
        <p className="text-sm text-sub mt-1 tracking-wide font-light">你的今日专注与休息视图</p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
      >
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-glass border border-subtle p-6 shadow-soft group hover:shadow-float transition-all duration-500"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2 opacity-80">
              <span className="text-xl">⏱️</span>
              <p className="text-xs font-medium tracking-wider uppercase text-sub">{periodText}使用</p>
            </div>
            <p className="text-4xl font-light text-main mt-4 tracking-tight">
              {hours > 0 ? (
                <span className="font-semibold mr-1">
                  {hours}
                  <span className="text-lg font-normal opacity-60 ml-1">h</span>
                </span>
              ) : null}
              <span className="font-semibold">{mins}</span>
              <span className="text-lg font-normal opacity-60 ml-1">m</span>
            </p>
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-glass border border-subtle p-6 shadow-soft group hover:shadow-float transition-all duration-500"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2 opacity-80">
              <span className="text-xl">🔔</span>
              <p className="text-xs font-medium tracking-wider uppercase text-sub">活跃提醒</p>
            </div>
            <p className="text-4xl font-semibold text-main mt-4 tracking-tight">
              {config.reminders.filter((r) => r.enabled).length}
              <span className="text-sm font-normal opacity-60 ml-2 tracking-normal uppercase">Active</span>
            </p>
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-glass border border-subtle p-6 shadow-soft group hover:shadow-float transition-all duration-500"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2 opacity-80">
              <span className="text-xl">✅</span>
              <p className="text-xs font-medium tracking-wider uppercase text-sub">提醒反馈</p>
            </div>
            <p className="text-4xl font-semibold text-main mt-4 tracking-tight">
              {completionRate}
              <span className="text-lg font-normal opacity-60 ml-1">%</span>
            </p>
            <div className="mt-3 text-xs text-sub leading-6">
              <div>展示 {interactionStats.shown}</div>
              <div>完成 {interactionStats.done} · 拖延 {interactionStats.snoozed} · 忽略 {interactionStats.missed}</div>
              <div>平均响应 {interactionStats.avgResponseSeconds}s · 连续忽略 {interactionStats.ignoredStreak}</div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
        className="flex-1"
      >
        {!config.monitorApps ? (
          <div className="h-full rounded-2xl bg-black/5 dark:bg-white/5 border border-subtle p-10 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-glass flex items-center justify-center text-3xl mb-6 shadow-soft border border-subtle">
              ✨
            </div>
            <h3 className="text-lg font-medium text-main mb-2 tracking-tight">洞察未开启</h3>
            <p className="text-[13px] text-sub max-w-sm tracking-wide leading-relaxed">
              在设置中开启「应用监控」后会立即开始采集并展示今日软件使用时长。
            </p>
          </div>
        ) : (
          <div className="h-full rounded-2xl bg-glass border border-subtle p-8 flex flex-col shadow-soft gap-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-medium text-main tracking-tight">{periodText}软件画像</h3>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="text-[10px] uppercase tracking-widest font-bold text-sub bg-black/5 dark:bg-white/5 px-3 py-1.5 rounded-full">
                  Live
                </span>
                <div className="flex items-center rounded-full border border-subtle bg-black/[0.03] dark:bg-white/[0.04] p-1.5 gap-1">
                  {(
                    [
                      ["day", "日"],
                      ["month", "月"],
                      ["year", "年"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setPeriod(value)}
                      className={`px-4 py-1.5 min-w-10 rounded-full text-sm leading-none transition-colors ${
                        period === value
                          ? "bg-[var(--color-primary)] text-black font-semibold"
                          : "text-sub hover:text-main"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {period === "day" ? (
                  <input
                    type="date"
                    value={safeDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-subtle bg-black/[0.03] dark:bg-white/[0.04] text-main text-sm"
                  />
                ) : period === "month" ? (
                  <input
                    type="month"
                    value={safeMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-subtle bg-black/[0.03] dark:bg-white/[0.04] text-main text-sm"
                  />
                ) : (
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={safeYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="h-9 w-24 px-3 rounded-lg border border-subtle bg-black/[0.03] dark:bg-white/[0.04] text-main text-sm"
                  />
                )}
              </div>
            </div>

            <div className="rounded-xl border border-subtle bg-black/[0.03] dark:bg-white/[0.04] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-black/5 dark:bg-white/10 flex items-center justify-center text-lg flex-shrink-0">
                  {currentApp ? appGlyph(currentApp) : "…"}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-sub uppercase tracking-wide">当前前台应用</p>
                  <p className="text-sm text-main truncate">{currentApp || "正在读取"}</p>
                </div>
              </div>
            </div>

            {loadingApps ? (
              <div className="flex-1 flex items-center justify-center flex-col gap-4">
                <div className="w-8 h-8 border-2 border-subtle border-t-[var(--color-primary)] rounded-full animate-spin" />
                <p className="text-xs tracking-widest uppercase text-muted">Analyzing...</p>
              </div>
            ) : apps.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sub text-sm tracking-wide">
                当前周期暂无数据，保持使用几分钟后会显示统计。
              </div>
            ) : (
              <>
                <div className="h-32 rounded-xl border border-subtle bg-black/[0.02] dark:bg-white/[0.03] px-4 py-3 flex items-end gap-2 overflow-hidden">
                  {chartApps.map((app, idx) => {
                    const h = Math.max(10, Math.round((app.focus_seconds / maxFocus) * 100));
                    return (
                      <div key={app.app_name + idx} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                        <div className="w-full h-20 flex items-end">
                          <div
                            className="w-full rounded-md transition-all duration-300"
                            style={{
                              height: `${h}%`,
                              backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                              minHeight: "6px",
                            }}
                            title={`${app.app_name} ${formatFocus(app.focus_seconds)}`}
                          />
                        </div>
                        <span className="text-[10px] text-sub truncate w-full text-center" title={app.app_name}>
                          {app.app_name.replace(/\.exe$/i, "").slice(0, 6)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                  {apps.map((app, index) => {
                    const ratio = Math.max(6, Math.round((app.focus_seconds / maxFocus) * 100));
                    return (
                      <div
                        key={`${app.app_name}-${index}`}
                        className="rounded-xl border border-subtle bg-black/[0.03] dark:bg-white/[0.04] px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="text-base">{appGlyph(app.app_name)}</span>
                            <p className="text-sm text-main truncate">{app.app_name}</p>
                          </div>
                          <p className="text-sm font-medium text-main tabular-nums whitespace-nowrap">
                            {formatFocus(app.focus_seconds)}
                          </p>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-black/[0.08] dark:bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${ratio}%`,
                              backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

