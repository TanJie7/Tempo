import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface NotificationData {
  id: number;
  reminderId: string;
  title: string;
  description?: string;
  color: string;
  durationSeconds: number;
  theme?: "light" | "dark" | "system";
}

export function NotificationPopup() {
  const [notification, setNotification] = useState<NotificationData | null>(null);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const handledNotificationRef = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    let activeThemeMode: "light" | "dark" | "system" = "system";

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
    let unlisten: (() => void) | undefined;
    let pendingPollTimer: number | null = null;

    const openPopup = (data: NotificationData) => {
      applyTheme(data.theme ?? "system");
      handledNotificationRef.current = null;
      setSubmitting(false);
      setNotification(data);
      setProgress(100);
      setLoading(false);
      setVisible(true);
    };

    const fetchPending = async () => {
      try {
        const pending = await invoke<NotificationData | null>("consume_pending_notification");
        if (pending?.title) {
          openPopup(pending);
        }
      } catch (e) {
        console.error("Failed to load pending notification:", e);
      }
    };

    const setup = async () => {
      await fetchPending();

      unlisten = await listen<NotificationData>("notification-payload", (event) => {
        if (event.payload?.title) {
          openPopup(event.payload);
        }
      });

      pendingPollTimer = window.setInterval(() => {
        void fetchPending();
      }, 250);
    };

    void setup();

    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
      if (pendingPollTimer !== null) {
        window.clearInterval(pendingPollTimer);
      }
      unlisten?.();
      mediaQuery.removeEventListener("change", mediaListener);
    };
  }, []);

  useEffect(() => {
    if (!visible || !notification) {
      return;
    }

    const totalMs = Math.max(3000, Math.min(600000, notification.durationSeconds * 1000));
    const startTime = Date.now();

    const progressInterval = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / totalMs) * 100);
      setProgress(remaining);
    }, 50);

    const timer = window.setTimeout(() => {
      void closePopup("missed");
    }, totalMs);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(progressInterval);
    };
  }, [visible, notification]);

  const submitAction = async (id: number, action: "done" | "snooze" | "missed") => {
    if (handledNotificationRef.current === id) {
      return;
    }
    handledNotificationRef.current = id;
    try {
      await invoke("submit_notification_action", {
        notificationId: id,
        action,
      });
    } catch (e) {
      console.error("Failed to submit notification action:", e);
    }
  };

  const closePopup = async (action: "done" | "snooze" | "missed" = "missed") => {
    const currentId = notification?.id;
    if (currentId !== undefined) {
      setSubmitting(true);
      await submitAction(currentId, action);
      setSubmitting(false);
    }

    setVisible(false);
    setLoading(false);

    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(async () => {
      try {
        await getCurrentWindow().hide();
      } catch (e) {
        console.error("Failed to hide notification window:", e);
      }
    }, 260);
  };

  const title = notification?.title?.trim() || "Tempo Reminder";
  const description =
    notification?.description?.trim() || "It is time to take a short break.";

  return (
    <div className="w-full h-full overflow-hidden" data-tauri-drag-region>
      <AnimatePresence>
        {visible && notification ? (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.82 }}
            className="w-full h-full rounded-[14px] overflow-hidden relative"
            style={{
              backgroundColor: "var(--color-surface)",
              boxShadow: "0 10px 22px rgba(0,0,0,0.22)",
            }}
          >
            <div className="flex items-stretch h-[calc(100%-3px)] relative z-10">
              <div className="w-2 flex-shrink-0" style={{ backgroundColor: notification.color }} />

              <div className="p-3 pb-3 flex-1 min-w-0 relative">
                <div className="flex gap-3 items-start min-w-0 pb-12">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
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

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-[15px] tracking-tight leading-snug text-main break-words">
                        {title}
                      </h3>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-muted flex-shrink-0">Tempo</span>
                    </div>
                    <p className="text-[12px] mt-1 leading-relaxed tracking-wide text-sub whitespace-pre-wrap break-words">
                      {description}
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void closePopup("missed");
                    }}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-colors -mt-0.5 -mr-1 hover:bg-black/5 dark:hover:bg-white/10 text-muted flex-shrink-0"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="13"
                      height="13"
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

                <div className="absolute left-3 right-3 bottom-3 grid grid-cols-2 gap-2">
                  <button
                    disabled={submitting}
                    onClick={(e) => {
                      e.stopPropagation();
                      void closePopup("snooze");
                    }}
                    className="h-8 px-3 rounded-lg border border-subtle text-[12px] text-sub hover:text-main transition-colors disabled:opacity-50"
                  >
                    拖延一次
                  </button>
                  <button
                    disabled={submitting}
                    onClick={(e) => {
                      e.stopPropagation();
                      void closePopup("done");
                    }}
                    className="h-8 px-3 rounded-lg text-[12px] font-semibold text-white transition-colors disabled:opacity-50"
                    style={{ backgroundColor: notification.color }}
                  >
                    确认完成
                  </button>
                </div>
              </div>
            </div>

            <div className="h-[3px] w-full" style={{ backgroundColor: "var(--color-border)" }}>
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
            className="w-full h-full rounded-[14px] bg-glass px-4 py-3 text-xs text-sub flex items-center"
          >
            正在准备提醒内容...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
