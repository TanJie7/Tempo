import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import type { Reminder } from "../../types";

const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const COLORS = [
  "#6366f1",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
];

interface ReminderFormProps {
  reminder: Reminder | null;
  onSave: (reminder: Reminder) => void;
  onClose: () => void;
}

export function ReminderForm({ reminder, onSave, onClose }: ReminderFormProps) {
  const [form, setForm] = useState<Reminder>(
    reminder ?? {
      id: `reminder-${Date.now()}`,
      title: "",
      description: "",
      type: "interval",
      intervalMinutes: 60,
      scheduledTime: "09:00",
      activeDays: [1, 2, 3, 4, 5],
      enabled: true,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(form);
  };

  const toggleDay = (day: number) => {
    setForm((f) => ({
      ...f,
      activeDays: f.activeDays.includes(day)
        ? f.activeDays.filter((d) => d !== day)
        : [...f.activeDays, day].sort(),
    }));
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="bg-glass border border-subtle shadow-float rounded-[32px] w-[90%] max-w-[440px] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-10 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-semibold tracking-tighter text-main">
              {reminder ? "Edit Reminder" : "New Reminder"}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-sub hover:text-main transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium tracking-wide text-sub mb-3">
              Title
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Drink Water"
              className="w-full px-5 py-4 rounded-2xl border border-transparent bg-black/5 dark:bg-white/5 text-main text-base focus:outline-none focus:ring-1 focus:ring-main focus:bg-transparent transition-all outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium tracking-wide text-sub mb-3">
              Description <span className="text-muted font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={form.description ?? ""}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="e.g. Drink 300ml of warm water"
              className="w-full px-5 py-4 rounded-2xl border border-transparent bg-black/5 dark:bg-white/5 text-main text-base focus:outline-none focus:ring-1 focus:ring-main focus:bg-transparent transition-all outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium tracking-wide text-sub mb-3">
              Type
            </label>
            <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-subtle">
              {(["interval", "scheduled"] as const).map((type) => {
                const isActive = form.type === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm({ ...form, type })}
                    className={`relative flex-1 py-3 rounded-xl text-sm font-medium transition-colors z-10 ${isActive ? "text-main" : "text-sub hover:text-main"
                      }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="type-active-form"
                        className="absolute inset-0 bg-[var(--color-background)] rounded-xl shadow-sm border border-subtle z-[-1]"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    {type === "interval" ? "Interval" : "Scheduled"}
                  </button>
                );
              })}
            </div>
          </div>

          {form.type === "interval" ? (
            <div>
              <label className="block text-sm font-medium tracking-wide text-sub mb-3">
                Interval
              </label>
              <div className="flex items-center gap-5">
                <span className="text-lg font-light text-main w-16 text-right tracking-tighter">
                  {form.intervalMinutes ?? 60} <span className="text-sub text-xs font-normal">min</span>
                </span>
                <input
                  type="range"
                  min={5}
                  max={180}
                  step={5}
                  value={form.intervalMinutes ?? 60}
                  onChange={(e) =>
                    setForm({ ...form, intervalMinutes: parseInt(e.target.value) })
                  }
                  className="flex-1 h-1 bg-black/10 dark:bg-white/10 rounded-full appearance-none cursor-pointer
                             [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                             [&::-webkit-slider-thumb]:bg-[var(--color-background)] [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-subtle
                             [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md
                             hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95 [&::-webkit-slider-thumb]:transition-transform"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium tracking-wide text-sub mb-3">
                Time
              </label>
              <TimePicker
                value={form.scheduledTime ?? "09:00"}
                onChange={(v: string) => setForm({ ...form, scheduledTime: v })}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium tracking-wide text-sub mb-3">
              Active Days
            </label>
            <div className="flex gap-2 justify-between">
              {DAY_LABELS.map((label, idx) => {
                const isActive = form.activeDays.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`w-11 h-11 rounded-full text-sm font-medium transition-all flex items-center justify-center ${isActive
                      ? "bg-main text-[var(--color-background)] border border-main shadow-md scale-105"
                      : "bg-black/[0.04] dark:bg-white/[0.08] border border-subtle text-sub hover:text-main hover:bg-black/[0.08] dark:hover:bg-white/[0.14]"
                      }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium tracking-wide text-sub mb-3">
              Accent Color
            </label>
            <div className="flex gap-4 flex-wrap">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, color })}
                  className={`w-8 h-8 rounded-full transition-all ${form.color === color
                    ? "ring-2 ring-offset-[3px] ring-main scale-110 ring-offset-[var(--color-background)]"
                    : "hover:scale-110 opacity-80 shadow-sm border border-white/10"
                    }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-6">
            <button
              type="submit"
              className="flex-1 py-4 rounded-full text-base font-semibold bg-main text-[var(--color-background)] hover:opacity-90 transition-all shadow-float active:scale-[0.98]"
            >
              Save Reminder
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

function TimePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const parts = value.split(":");
  const h = parseInt(parts[0]) || 0;
  const m = parseInt(parts[1]) || 0;

  const update = (hours: number, mins: number) => {
    hours = ((hours % 24) + 24) % 24;
    mins = ((mins % 60) + 60) % 60;
    onChange(`${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`);
  };

  return (
    <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 rounded-2xl px-5 py-3.5 w-fit">
      <input
        type="text"
        inputMode="numeric"
        value={String(h).padStart(2, "0")}
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, "");
          if (val.length <= 2) update(parseInt(val) || 0, m);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); update(h + 1, m); }
          if (e.key === "ArrowDown") { e.preventDefault(); update(h - 1, m); }
        }}
        className="w-10 text-center text-xl font-medium bg-transparent text-main outline-none rounded-lg hover:bg-black/5 dark:hover:bg-white/5 py-1 transition-colors"
        maxLength={2}
      />
      <span className="text-xl font-light text-sub select-none">:</span>
      <input
        type="text"
        inputMode="numeric"
        value={String(m).padStart(2, "0")}
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, "");
          if (val.length <= 2) update(h, parseInt(val) || 0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); update(h, m + 1); }
          if (e.key === "ArrowDown") { e.preventDefault(); update(h, m - 1); }
        }}
        className="w-10 text-center text-xl font-medium bg-transparent text-main outline-none rounded-lg hover:bg-black/5 dark:hover:bg-white/5 py-1 transition-colors"
        maxLength={2}
      />
    </div>
  );
}



