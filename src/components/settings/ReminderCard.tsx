import { motion, Variants } from "framer-motion";
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
      if (hours > 0 && mins > 0) return `每 ${hours}小时 ${mins}分钟`;
      if (hours > 0) return `每 ${hours} 小时`;
      return `每 ${mins} 分钟`;
    }
    return `每天 ${reminder.scheduledTime}`;
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
  };

  return (
    <motion.div
      variants={itemVariants}
      layout
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
      className={`relative rounded-xl bg-glass border border-subtle transition-all duration-300 group ${!reminder.enabled ? "opacity-50 grayscale-[0.5]" : "shadow-soft hover:shadow-float"
        }`}
    >
      <div className="flex items-stretch min-h-[88px] rounded-xl overflow-hidden bg-transparent">
        {/* Color Indicator */}
        <div
          className="w-1.5 flex-shrink-0 transition-all duration-300"
          style={{ backgroundColor: reminder.color, opacity: reminder.enabled ? 1 : 0.3 }}
        />

        <div className="flex-1 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold tracking-tight text-main truncate">
                {reminder.title}
              </h3>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-sub border border-black/5 dark:border-white/5">
                {reminder.type === "interval" ? "Interval" : "Scheduled"}
              </span>
            </div>

            <p className="text-sm font-medium text-sub mb-1.5 tracking-wide">
              {formatTime()}
            </p>

            {reminder.description && (
              <p className="text-[13px] text-sub truncate max-w-md font-light mb-1">
                {reminder.description}
              </p>
            )}

            <div className="flex gap-1 mt-2.5">
              {DAY_LABELS.map((label, idx) => {
                const isActive = reminder.activeDays.includes(idx);
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
                onClick={onEdit}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-sub hover:text-main transition-colors"
                title="编辑"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </button>
              <button
                onClick={onDelete}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-sub hover:text-red-500 transition-colors"
                title="删除"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>

            {/* Custom animated toggle - Minimalist Apple Style */}
            <button
              onClick={onToggle}
              className={`w-[52px] h-[32px] flex items-center rounded-full p-1 transition-colors duration-300 relative focus:outline-none ml-2 border border-subtle ${reminder.enabled ? "bg-toggle" : "bg-black/10 dark:bg-white/20"
                }`}
            >
              <motion.div
                className="w-6 h-6 bg-[var(--color-background)] rounded-full shadow-sm"
                layout
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                style={{ originY: 0.5 }}
                animate={{ x: reminder.enabled ? 20 : 0 }}
              />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}


