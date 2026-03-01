import { motion } from "framer-motion";
import { useAppStore } from "../../stores/appStore";
import type { Page } from "../../types";

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: "reminders", label: "提醒", icon: "🔔" },
  { id: "rest", label: "休息", icon: "☕" },
  { id: "dashboard", label: "统计", icon: "📊" },
  { id: "settings", label: "设置", icon: "⚙️" },
];

export function Sidebar() {
  const { currentPage, setCurrentPage, isPaused } = useAppStore();

  return (
    <div
      className="w-52 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface-secondary)]"
      data-tauri-drag-region
    >
      <div className="p-4 pt-8" data-tauri-drag-region>
        <h1 className="text-lg font-semibold text-[var(--color-text)]">
          Tempo
        </h1>
        {isPaused && (
          <span className="text-xs text-amber-500 font-medium">已暂停</span>
        )}
      </div>

      <nav className="flex-1 px-2 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative ${
              currentPage === item.id
                ? "text-[var(--color-primary)] font-medium"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)]"
            }`}
          >
            {currentPage === item.id && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute inset-0 rounded-lg bg-[var(--color-primary)]/10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10">{item.icon}</span>
            <span className="relative z-10">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
        v1.0.0
      </div>
    </div>
  );
}
