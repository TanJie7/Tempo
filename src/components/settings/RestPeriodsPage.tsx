import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useAppStore } from "../../stores/appStore";
import type { RestPeriod } from "../../types";

const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export function RestPeriodsPage() {
  const { config, setConfig, saveConfig } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RestPeriod | null>(null);

  const handleToggle = (id: string) => {
    const updated = config.restPeriods.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r,
    );
    setConfig({ ...config, restPeriods: updated });
    saveConfig();
  };

  const handleDelete = (id: string) => {
    const updated = config.restPeriods.filter((r) => r.id !== id);
    setConfig({ ...config, restPeriods: updated });
    saveConfig();
  };

  const handleSave = (period: RestPeriod) => {
    const exists = config.restPeriods.find((r) => r.id === period.id);
    const updated = exists
      ? config.restPeriods.map((r) => (r.id === period.id ? period : r))
      : [...config.restPeriods, period];
    setConfig({ ...config, restPeriods: updated });
    saveConfig();
    setShowForm(false);
    setEditing(null);
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="pb-10 h-full flex flex-col">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 pt-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-main">Rest Periods</h2>
          <p className="text-sm text-sub mt-1 tracking-wide font-light">设置专注后的放松时间，期间暂停相关提醒</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="px-6 py-3 bg-main text-[var(--color-background)] rounded-full text-sm font-medium hover:opacity-90 hover:shadow-float transition-all active:scale-[0.98] flex items-center justify-center gap-2 max-w-fit"
        >
          <span className="text-xl font-light leading-none">+</span> Create
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-4 -mr-4">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-3"
        >
          <AnimatePresence mode="popLayout">
            {config.restPeriods.map((period) => (
              <motion.div
                variants={itemVariants}
                key={period.id}
                layout
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
                className={`relative rounded-xl bg-glass border border-subtle transition-all duration-300 group ${!period.enabled ? "opacity-50 grayscale-[0.5]" : "shadow-soft hover:shadow-float"
                  }`}
              >
                <div className="flex items-stretch min-h-[80px] rounded-xl overflow-hidden bg-transparent">
                  <div
                    className="w-1.5 flex-shrink-0 transition-all duration-300"
                    style={{ backgroundColor: "#10b981", opacity: period.enabled ? 1 : 0.3 }} // Emerald green for rest
                  />
                  <div className="flex-1 px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold tracking-tight text-main truncate mb-1">
                        {period.name}
                      </h3>
                      <p className="text-sm font-light text-sub mb-3 flex items-center gap-2 tracking-wide">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sub"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        {period.startTime} - {period.endTime}
                      </p>
                      <div className="flex gap-1 mt-1">
                        {DAY_LABELS.map((label, idx) => {
                          const isActive = period.activeDays.includes(idx);
                          return (
                            <span
                              key={idx}
                              className={`text-[11px] w-6 h-6 flex items-center justify-center rounded-full font-semibold transition-colors ${isActive
                                ? "bg-main text-[var(--color-background)]"
                                : "text-sub bg-black/[0.04] dark:bg-white/[0.08] border border-subtle"
                                }`}
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                        <button
                          onClick={() => {
                            setEditing(period);
                            setShowForm(true);
                          }}
                          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-sub hover:text-main transition-colors"
                          title="编辑"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                        <button
                          onClick={() => handleDelete(period.id)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-sub hover:text-red-500 transition-colors"
                          title="删除"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>

                      <button
                        onClick={() => handleToggle(period.id)}
                        className={`w-[52px] h-[32px] flex items-center rounded-full p-1 transition-colors duration-300 relative focus:outline-none ml-2 border border-subtle ${period.enabled ? "bg-toggle" : "bg-black/10 dark:bg-white/20"
                          }`}
                      >
                        <motion.div
                          className="w-6 h-6 bg-[var(--color-background)] rounded-full shadow-sm"
                          layout
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          style={{ originY: 0.5 }}
                          animate={{ x: period.enabled ? 20 : 0 }}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {config.restPeriods.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-64 text-center mt-10"
          >
            <div className="w-16 h-16 bg-glass rounded-full flex items-center justify-center text-3xl mb-4 shadow-soft">
              ☕
            </div>
            <h3 className="text-lg font-medium tracking-tight text-main mb-1">Blank Slate</h3>
            <p className="text-sub text-[13px] tracking-wide">添加您的午休或其他休息时间</p>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <RestPeriodForm
            period={editing}
            onSave={handleSave}
            onClose={() => {
              setShowForm(false);
              setEditing(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RestPeriodForm({
  period,
  onSave,
  onClose,
}: {
  period: RestPeriod | null;
  onSave: (p: RestPeriod) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<RestPeriod>(
    period ?? {
      id: `rest-${Date.now()}`,
      name: "",
      startTime: "12:00",
      endTime: "13:00",
      activeDays: [1, 2, 3, 4, 5],
      enabled: true,
    },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
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
        className="bg-glass border border-subtle shadow-float rounded-2xl w-[90%] max-w-[440px] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-10 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-semibold tracking-tighter text-main">
              {period ? "Edit Rest Period" : "New Rest Period"}
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
              Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Lunch Break"
              className="w-full px-5 py-4 rounded-2xl border border-transparent bg-black/5 dark:bg-white/5 text-main text-base focus:outline-none focus:ring-1 focus:ring-main focus:bg-transparent transition-all outline-none"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium tracking-wide text-sub mb-3">
                Start Time
              </label>
              <TimePicker
                value={form.startTime}
                onChange={(v) => setForm({ ...form, startTime: v })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium tracking-wide text-sub mb-3">
                End Time
              </label>
              <TimePicker
                value={form.endTime}
                onChange={(v) => setForm({ ...form, endTime: v })}
              />
            </div>
          </div>

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
                    className={`w-11 h-11 rounded-full text-sm font-medium transition-all ${isActive
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

          <div className="flex gap-3 pt-6">
            <button
              type="submit"
              className="flex-1 py-4 rounded-full text-base font-semibold bg-main text-[var(--color-background)] hover:opacity-90 transition-all shadow-float active:scale-[0.98]"
            >
              Save Period
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


