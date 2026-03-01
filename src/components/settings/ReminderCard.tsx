import { motion } from "framer-motion";
import type { Reminder } from "../../types";

const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

interface ReminderCardProps {
  reminder: Reminder;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ReminderCard({
  reminder,
  onToggle,
  onEdit,
  onDelete,
}: ReminderCardProps) {
  const formatTime = () => {
    if (reminder.type === "interval") {
      const hours = Math.floor((reminder.intervalMinutes ?? 0) / 60);
      const mins = (reminder.intervalMinutes ?? 0) % 60;
      if (hours > 0 && mins > 0) return `每 ${hours}小时${mins}分钟`;
      if (hours > 0) return `每 ${hours} 小时`;
      return `每 ${mins} 分钟`;
    }
    return `每天 ${reminder.scheduledTime}`;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-opacity ${
        !reminder.enabled ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-stretch">
        <div
          className="w-1.5 flex-shrink-0"
          style={{ backgroundColor: reminder.color }}
        />
        <div className="flex-1 p-4 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-[var(--color-text)] truncate">
                {reminder.title}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
                {reminder.type === "interval" ? "间隔" : "定时"}
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {formatTime()}
            </p>
            {reminder.description && (
              <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                {reminder.description}
              </p>
            )}
            <div className="flex gap-1 mt-2">
              {DAY_LABELS.map((label, idx) => (
                <span
                  key={idx}
                  className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${
                    reminder.activeDays.includes(idx)
                      ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
                      : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={onEdit}
              className="p-2 rounded-lg hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] transition-colors"
              title="编辑"
            >
              ✏️
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-lg hover:bg-red-50 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors"
              title="删除"
            >
              🗑️
            </button>
            <button
              onClick={onToggle}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                reminder.enabled
                  ? "bg-[var(--color-primary)]"
                  : "bg-[var(--color-border)]"
              }`}
            >
              <motion.div
                className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm"
                animate={{ left: reminder.enabled ? 22 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
