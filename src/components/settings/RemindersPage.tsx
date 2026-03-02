import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/appStore";
import type { Reminder, ReminderCountdown } from "../../types";
import { ReminderCard } from "./ReminderCard";
import { ReminderForm } from "./ReminderForm";

const BLOCKED_REASON_TEXT: Record<string, string> = {
  disabled: "已关闭",
  paused: "已暂停",
  idle: "空闲中",
  rest: "休息时段中",
};

function formatCountdown(seconds: number | null): string {
  if (seconds === null) {
    return "--";
  }
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function RemindersPage() {
  const { config, setConfig, saveConfig, setPaused } = useAppStore();
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [countdowns, setCountdowns] = useState<ReminderCountdown[]>([]);

  const handleToggle = (id: string) => {
    const updated = config.reminders.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r,
    );
    setConfig({ ...config, reminders: updated });
    saveConfig();
  };

  const handleDelete = (id: string) => {
    const updated = config.reminders.filter((r) => r.id !== id);
    setConfig({ ...config, reminders: updated });
    saveConfig();
  };

  const handleSave = (reminder: Reminder) => {
    const exists = config.reminders.find((r) => r.id === reminder.id);
    const updated = exists
      ? config.reminders.map((r) => (r.id === reminder.id ? reminder : r))
      : [...config.reminders, reminder];
    setConfig({ ...config, reminders: updated });
    saveConfig();
    setShowForm(false);
    setEditingReminder(null);
  };

  const toggleGlobalPause = async () => {
    const nextPaused = !config.remindersPaused;
    const previousConfig = config;
    setConfig({ ...config, remindersPaused: nextPaused });
    setPaused(nextPaused);
    try {
      await invoke("set_reminders_paused", { paused: nextPaused });
    } catch (e) {
      console.error("Failed to update pause state:", e);
      setConfig(previousConfig);
      setPaused(previousConfig.remindersPaused);
    }
  };

  useEffect(() => {
    let active = true;

    const fetchCountdowns = async () => {
      try {
        const data = await invoke<ReminderCountdown[]>("get_reminder_countdowns");
        if (active) {
          setCountdowns(data);
        }
      } catch (e) {
        console.error("Failed to fetch reminder countdowns:", e);
      }
    };

    void fetchCountdowns();
    const timer = window.setInterval(() => {
      void fetchCountdowns();
    }, 1000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [config.reminders, config.remindersPaused]);

  const sortedCountdowns = useMemo(
    () =>
      [...countdowns].sort((a, b) => {
        const aValue = a.nextInSeconds ?? Number.MAX_SAFE_INTEGER;
        const bValue = b.nextInSeconds ?? Number.MAX_SAFE_INTEGER;
        return aValue - bValue;
      }),
    [countdowns],
  );

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  return (
    <div className="pb-10 h-full flex flex-col">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 pt-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-main">Reminders</h2>
          <p className="text-sm text-sub mt-1 tracking-wide font-light">管理你的日常专属提醒</p>
        </div>
        <button
          onClick={() => {
            setEditingReminder(null);
            setShowForm(true);
          }}
          className="px-6 py-3 bg-main text-[var(--color-background)] rounded-full text-sm font-medium hover:opacity-90 hover:shadow-float transition-all active:scale-[0.98] flex items-center justify-center gap-2 max-w-fit"
        >
          <span className="text-xl font-light leading-none">+</span> Create
        </button>
      </div>

      <div className="mb-5 rounded-2xl bg-glass border border-subtle p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-main">下次提醒倒计时</h3>
            <p className="text-xs text-sub mt-1">这里会显示全部提醒的下一次触发时间</p>
          </div>
          <button
            onClick={() => {
              void toggleGlobalPause();
            }}
            className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${config.remindersPaused
              ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20"
              : "bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/20"
              }`}
          >
            {config.remindersPaused ? "继续提醒" : "暂停提醒"}
          </button>
        </div>

        {sortedCountdowns.length > 0 ? (
          <div className="space-y-2">
            {sortedCountdowns.map((item) => {
              const reasonText = item.blockedReason
                ? BLOCKED_REASON_TEXT[item.blockedReason] || item.blockedReason
                : null;
              return (
                <div
                  key={`countdown-${item.id}`}
                  className="rounded-xl border border-subtle bg-black/[0.03] dark:bg-white/[0.03] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-main truncate">{item.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-subtle text-sub uppercase tracking-wide">
                        {item.reminderType === "interval" ? "Interval" : "Scheduled"}
                      </span>
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-main">
                      {formatCountdown(item.nextInSeconds)}
                    </div>
                  </div>
                  {reasonText && (
                    <div className="mt-1 text-[11px] text-sub">{reasonText}</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-sub">暂无提醒任务</div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-4 -mr-4">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-3"
        >
          <AnimatePresence mode="popLayout">
            {config.reminders.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                onToggle={() => handleToggle(reminder.id)}
                onEdit={() => {
                  setEditingReminder(reminder);
                  setShowForm(true);
                }}
                onDelete={() => handleDelete(reminder.id)}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        {config.reminders.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-64 text-center mt-10"
          >
            <div className="w-16 h-16 bg-glass rounded-full flex items-center justify-center text-3xl mb-4 shadow-soft">
              ✨
            </div>
            <h3 className="text-lg font-medium tracking-tight text-main mb-1">Blank Slate</h3>
            <p className="text-sub text-[13px] tracking-wide">添加你的第一个专属提醒</p>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <ReminderForm
            reminder={editingReminder}
            onSave={handleSave}
            onClose={() => {
              setShowForm(false);
              setEditingReminder(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
