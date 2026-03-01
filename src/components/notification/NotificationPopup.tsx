import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

interface NotificationData {
  title: string;
  description?: string;
  color: string;
  duration: number;
  theme?: "light" | "dark" | "system";
}

export function NotificationPopup() {
  const [notification, setNotification] = useState<NotificationData | null>(null);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const [loading, setLoading] = useState(true);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    let activeThemeMode: "light" | "dark" | "system" = "system";
    let cancelled = false;
    let resolved = false;

    const applyTheme = (theme: "light" | "dark" | "system") => {
      activeThemeMode = theme;
      const isDark = theme === "system" ? mediaQuery.matches : theme === "dark";
      document.documentElement.classList.toggle("dark", isDark);
    };

    const mediaListener = (e: MediaQueryListEvent) => {
      if (activeThemeMode === "system") {
        document.documentElement.classList.toggle("dark", e.matches);
      }
    };

    mediaQuery.addEventListener("change", mediaListener);

    const openFromPayload = (data: NotificationData) => {
      if (cancelled) {
        return;
      }
      resolved = true;
      applyTheme(data.theme ?? "system");
      setNotification(data);
      setVisible(true);
      setLoading(false);
      setProgress(100);
    };

    const bootstrap = (window as any).__TEMPO_NOTIFICATION_PAYLOAD__ as
      | NotificationData
      | undefined;

    let retryInterval: number | null = null;

    if (bootstrap?.title) {
      openFromPayload(bootstrap);
    } else {
      let attempts = 0;
      const maxAttempts = 24;

      retryInterval = window.setInterval(async () => {
        if (cancelled) {
          if (retryInterval !== null) {
            window.clearInterval(retryInterval);
          }
          return;
        }

        attempts += 1;
        try {
          const data = await invoke<NotificationData | null>("get_pending_notification");
          if (data?.title) {
            if (retryInterval !== null) {
              window.clearInterval(retryInterval);
            }
            openFromPayload(data);
            return;
          }
        } catch (e) {
          console.error("Failed to fetch notification:", e);
        }

        if (attempts >= maxAttempts) {
          if (retryInterval !== null) {
            window.clearInterval(retryInterval);
          }
          openFromPayload({
            title: "Tempo Reminder",
            description: "提醒已触发，但内容未及时加载。",
            color: "#6b7280",
            duration: 4,
            theme: "system",
          });
        }
      }, 120);
    }

    closeTimerRef.current = window.setTimeout(() => {
      if (!cancelled && !resolved) {
        closePopup(true);
      }
    }, 10000);

    return () => {
      cancelled = true;
      if (retryInterval !== null) {
        window.clearInterval(retryInterval);
      }
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
      mediaQuery.removeEventListener("change", mediaListener);
    };
  }, []);

  useEffect(() => {
    if (!visible || !notification) {
      return;
    }

    const totalMs = Math.max(1200, notification.duration * 1000);
    const startTime = Date.now();

    const progressInterval = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / totalMs) * 100);
      setProgress(remaining);
    }, 50);

    const timer = window.setTimeout(() => {
      closePopup();
    }, totalMs);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(progressInterval);
    };
  }, [visible, notification]);

  const closePopup = (immediate = false) => {
    setVisible(false);
    setLoading(false);

    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }

    if (immediate) {
      void getCurrentWindow().close();
      return;
    }

    closeTimerRef.current = window.setTimeout(() => {
      void getCurrentWindow().close();
    }, 260);
  };

  const title = notification?.title?.trim() || "Tempo Reminder";
  const description =
    notification?.description?.trim() || "It is time to take a short break.";

  return (
    <div
      className="w-full h-full flex items-end justify-end p-4 overflow-hidden"
      data-tauri-drag-region
    >
      <AnimatePresence>
        {visible && notification ? (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.82 }}
            className="w-full max-w-[380px] rounded-2xl overflow-hidden cursor-pointer relative border border-subtle"
            style={{
              backgroundColor: "var(--color-surface)",
              boxShadow:
                "0 10px 34px rgba(0,0,0,0.16), 0 0 0 1px var(--color-border)",
            }}
            onClick={() => closePopup()}
          >
            <div
              className="absolute top-0 left-0 w-24 h-24 rounded-full opacity-20 blur-2xl pointer-events-none"
              style={{ backgroundColor: notification.color }}
            />

            <div className="flex items-stretch relative z-10">
              <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: notification.color }} />

              <div className="p-4 flex-1 flex gap-3 items-start">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${notification.color}20`, color: notification.color }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0 pr-2">
                  <h3 className="font-semibold text-base tracking-tight leading-snug text-main">{title}</h3>
                  <p className="text-[13px] mt-1 leading-relaxed tracking-wide text-sub">{description}</p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closePopup();
                  }}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors -mt-0.5 -mr-1 hover:bg-black/5 dark:hover:bg-white/10 text-muted"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="h-[2px] w-full" style={{ backgroundColor: "var(--color-border)" }}>
              <div
                className="h-full transition-all duration-100 ease-linear"
                style={{ width: `${progress}%`, backgroundColor: notification.color, opacity: 0.8 }}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: loading ? 1 : 0.2, y: 0 }}
            className="w-full max-w-[320px] rounded-2xl border border-subtle bg-glass px-4 py-3 text-sm text-sub"
          >
            正在准备提醒内容...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
