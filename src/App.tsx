import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAppStore } from "./stores/appStore";
import { Sidebar } from "./components/layout/Sidebar";
import { RemindersPage } from "./components/settings/RemindersPage";
import { RestPeriodsPage } from "./components/settings/RestPeriodsPage";
import { DashboardPage } from "./components/dashboard/DashboardPage";
import { SettingsPage } from "./components/settings/SettingsPage";

function useThemeEffect(theme: "light" | "dark" | "system") {
  useEffect(() => {
    const applyTheme = async () => {
      const root = document.documentElement;
      const isDark =
        theme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
          : theme === "dark";

      root.classList.toggle("dark", isDark);

      try {
        await getCurrentWindow().setTheme(isDark ? "dark" : "light");
      } catch (e) {
        console.warn("Could not set native window theme", e);
      }
    };

    void applyTheme();

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => {
        void applyTheme();
      };
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme]);
}

function App() {
  return <MainApp />;
}

function MainApp() {
  const { currentPage, loadConfig, config, setTodayActiveMinutes, setPaused } =
    useAppStore();
  const [loaded, setLoaded] = useState(false);

  useThemeEffect(config?.theme || "system");

  useEffect(() => {
    loadConfig().then(() => setLoaded(true));
  }, [loadConfig]);

  useEffect(() => {
    const refreshUsage = async () => {
      try {
        const minutes = await invoke<number>("get_today_active_minutes");
        setTodayActiveMinutes(minutes);
      } catch (e) {
        console.error("Failed to load active minutes:", e);
      }
    };

    void refreshUsage();
    const timer = window.setInterval(() => {
      void refreshUsage();
    }, 15000);

    return () => window.clearInterval(timer);
  }, [setTodayActiveMinutes]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      try {
        unlisten = await listen("toggle-pause", () => {
          const current = useAppStore.getState().isPaused;
          setPaused(!current);
        });
      } catch (e) {
        console.error("Failed to listen toggle-pause event:", e);
      }
    };

    void setup();

    return () => {
      unlisten?.();
    };
  }, [setPaused]);

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-app">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="text-sub text-lg font-medium"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-main border-t-transparent rounded-full animate-spin" />
            <span className="text-sm tracking-widest uppercase">Loading</span>
          </div>
        </motion.div>
      </div>
    );
  }

  const pageContent = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage />;
      case "reminders":
        return <RemindersPage />;
      case "rest":
        return <RestPeriodsPage />;
      case "settings":
        return <SettingsPage />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-app overflow-hidden text-main font-serif selection:bg-black/10 dark:selection:bg-white/10 selection:text-main">
      <Sidebar />

      <main
        className="flex-1 relative h-full overflow-hidden flex flex-col bg-transparent"
        data-tauri-drag-region
      >
        <div className="flex-1 overflow-y-auto px-10 md:px-16 py-12 pb-24 h-full relative z-10">
          <div className="h-full max-w-5xl mx-auto">{pageContent()}</div>
        </div>
      </main>
    </div>
  );
}

export default App;
