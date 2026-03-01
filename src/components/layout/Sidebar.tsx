import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "../../stores/appStore";
import type { Page } from "../../types";

const MIN_WIDTH = 180;
const MAX_WIDTH = 320;
const DEFAULT_WIDTH = 200;

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: "dashboard", label: "数据罗盘", icon: "📊" },
  { id: "reminders", label: "提醒事项", icon: "🔔" },
  { id: "rest", label: "休息计划", icon: "☕" },
  { id: "settings", label: "应用设置", icon: "⚙️" },
];

export function Sidebar() {
  const { currentPage, setCurrentPage, isPaused } = useAppStore();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div
      className="h-full flex flex-col bg-sidebar border-r border-subtle relative z-20 flex-shrink-0"
      style={{ width }}
      data-tauri-drag-region
    >
      {/* Brand Header */}
      <div className="px-6 pt-12 pb-6 flex flex-col items-start gap-1 cursor-default" data-tauri-drag-region>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-main flex items-center justify-center text-[var(--color-background)] font-bold text-sm tracking-tighter flex-shrink-0">
              Te.
            </div>
            <h1 className="text-xl font-bold tracking-tight text-main">
              Tempo
            </h1>
          </div>
          <ThemeToggle />
        </div>
        <div className="h-5 mt-2 ml-[44px]">
          {isPaused && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse"></span>
              Paused
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all relative group ${isActive
                ? "text-main font-semibold"
                : "text-sub hover:text-main"
                }`}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-black/5 dark:bg-white/10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}

              {/* Hover effect for resting state */}
              {!isActive && (
                <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/5 dark:bg-white/0 dark:group-hover:bg-white/5 transition-colors" />
              )}

              <span className={`relative z-10 text-[18px] flex-shrink-0 ${isActive ? '' : 'opacity-70 group-hover:opacity-100 transition-opacity drop-shadow-sm'}`}>
                {item.icon}
              </span>
              <span className="relative z-10 tracking-wide truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-6" data-tauri-drag-region>
        <div className="flex items-center justify-center text-[10px] tracking-widest uppercase text-muted font-medium cursor-default">
          Tempo v1.0.0
        </div>
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-black/10 dark:hover:bg-white/10 active:bg-black/15 dark:active:bg-white/15 transition-colors z-30"
      />
    </div>
  );
}

function ThemeToggle() {
  const { config, updateConfig, saveConfig } = useAppStore();

  const cycleTheme = () => {
    const next = config.theme === 'dark' ? 'light' : 'dark';
    updateConfig({ theme: next });
    setTimeout(() => saveConfig(), 200);
  };

  const icons = {
    system: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>,
    light: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>,
    dark: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
  };

  return (
    <button
      onClick={cycleTheme}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-sub hover:text-main hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      title={`Theme: ${config.theme}`}
    >
      <motion.div
        key={config.theme}
        initial={{ y: -10, opacity: 0, scale: 0.8 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 10, opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.2 }}
      >
        {icons[config.theme as keyof typeof icons] || icons.light}
      </motion.div>
    </button>
  );
}

