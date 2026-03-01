import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">休息时间</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            休息期间将暂停所有提醒
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          + 添加休息
        </button>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {config.restPeriods.map((period) => (
            <motion.div
              key={period.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-opacity ${
                !period.enabled ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-[var(--color-text)]">
                    {period.name}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                    {period.startTime} - {period.endTime}
                  </p>
                  <div className="flex gap-1 mt-2">
                    {DAY_LABELS.map((label, idx) => (
                      <span
                        key={idx}
                        className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${
                          period.activeDays.includes(idx)
                            ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
                            : "text-[var(--color-text-muted)]"
                        }`}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditing(period);
                      setShowForm(true);
                    }}
                    className="p-2 rounded-lg hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] transition-colors"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(period.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors"
                  >
                    🗑️
                  </button>
                  <button
                    onClick={() => handleToggle(period.id)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      period.enabled
                        ? "bg-[var(--color-primary)]"
                        : "bg-[var(--color-border)]"
                    }`}
                  >
                    <motion.div
                      className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm"
                      animate={{ left: period.enabled ? 22 : 2 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                    />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
        className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-xl w-[400px]"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <h3 className="text-lg font-semibold">
            {period ? "编辑休息时间" : "添加休息时间"}
          </h3>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              名称
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="如：午休"
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)]"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                开始时间
              </label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) =>
                  setForm({ ...form, startTime: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                结束时间
              </label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              生效日期
            </label>
            <div className="flex gap-1.5">
              {DAY_LABELS.map((label, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDay(idx)}
                  className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${
                    form.activeDays.includes(idx)
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              保存
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
