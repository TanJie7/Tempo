import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "./stores/appStore";
import { Sidebar } from "./components/layout/Sidebar";
import { RemindersPage } from "./components/settings/RemindersPage";
import { RestPeriodsPage } from "./components/settings/RestPeriodsPage";
import { DashboardPage } from "./components/dashboard/DashboardPage";
import { SettingsPage } from "./components/settings/SettingsPage";
import { NotificationPopup } from "./components/notification/NotificationPopup";

function App() {
  // Check if this is a notification window
  const isNotification = window.location.search.includes("notification=true");

  if (isNotification) {
    return <NotificationPopup />;
  }

  return <MainApp />;
}

function MainApp() {
  const { currentPage, loadConfig } = useAppStore();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadConfig().then(() => setLoaded(true));
  }, [loadConfig]);

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-[var(--color-text-secondary)] text-lg"
        >
          加载中...
        </motion.div>
      </div>
    );
  }

  const pageContent = () => {
    switch (currentPage) {
      case "reminders":
        return <RemindersPage />;
      case "rest":
        return <RestPeriodsPage />;
      case "dashboard":
        return <DashboardPage />;
      case "settings":
        return <SettingsPage />;
    }
  };

  return (
    <div className="flex h-screen" data-tauri-drag-region>
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {pageContent()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
