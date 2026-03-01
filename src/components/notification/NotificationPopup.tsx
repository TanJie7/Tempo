import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface NotificationData {
  title: string;
  description?: string;
  color: string;
  duration: number;
}

export function NotificationPopup() {
  const [notification, setNotification] = useState<NotificationData | null>(
    null,
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.listen<NotificationData>(
      "show-notification",
      (event) => {
        setNotification(event.payload);
        setVisible(true);
      },
    );

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (!visible || !notification) return;
    const timer = setTimeout(() => {
      setVisible(false);
      // Close window after animation
      setTimeout(() => {
        getCurrentWindow().close();
      }, 400);
    }, notification.duration * 1000);
    return () => clearTimeout(timer);
  }, [visible, notification]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      getCurrentWindow().close();
    }, 400);
  };

  return (
    <div className="w-full h-full flex items-end p-0">
      <AnimatePresence>
        {visible && notification && (
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
            className="w-[300px] rounded-xl overflow-hidden shadow-2xl backdrop-blur-xl cursor-pointer"
            style={{
              background:
                "rgba(255, 255, 255, 0.85)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
            }}
            onClick={handleClose}
          >
            <div className="flex items-stretch">
              <div
                className="w-1.5 flex-shrink-0"
                style={{ backgroundColor: notification.color }}
              />
              <div className="p-4 flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Tempo</p>
                    <h3 className="font-semibold text-gray-800 text-sm">
                      {notification.title}
                    </h3>
                    {notification.description && (
                      <p className="text-xs text-gray-500 mt-1">
                        {notification.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClose();
                    }}
                    className="text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none ml-2"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
