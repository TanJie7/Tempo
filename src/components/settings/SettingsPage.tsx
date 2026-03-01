import { useEffect, useRef } from "react";
import { useAppStore } from "../../stores/appStore";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "framer-motion";

export function SettingsPage() {
  const { config, updateConfig, saveConfig } = useAppStore();
  const saveTimer = useRef<number | null>(null);

  const handleChange = <K extends keyof typeof config>(
    key: K,
    value: (typeof config)[K],
  ) => {
    updateConfig({ [key]: value });

    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
    }

    saveTimer.current = window.setTimeout(() => {
      void saveConfig();
    }, 220);
  };

  useEffect(() => {
    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, []);

  const handleAutoStartToggle = async () => {
    const newValue = !config.autoStart;
    try {
      await invoke("set_auto_start", { enabled: newValue });
      handleChange("autoStart", newValue);
    } catch (e) {
      console.error("Failed to set auto start:", e);
    }
  };

  const handleTestPopup = async () => {
    try {
      await invoke("test_notification", {
        title: "喝水时间",
        description: "站起来喝杯水，活动一下。",
        color: "#0ea5e9",
        durationMinutes: config.notificationDurationMinutes,
        theme: config.theme,
      });
    } catch (e) {
      console.error("Failed to trigger test popup:", e);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 24 },
    },
  };

  return (
    <div className="pb-10 h-full overflow-y-auto pr-4 -mr-4">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 pt-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-main">Settings</h2>
          <p className="text-sm text-sub mt-1 tracking-wide font-light">定制你的 Tempo 体验</p>
        </div>

        <button
          onClick={handleTestPopup}
          className="px-5 py-2.5 bg-glass text-main rounded-lg text-sm font-medium hover:scale-105 hover:shadow-float shadow-soft transition-all active:scale-95 flex items-center gap-2 border border-subtle"
        >
          <span className="text-lg">🚀</span> Test Popup
        </button>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-2 max-w-3xl"
      >
        <SettingCard
          variants={itemVariants}
          title="开机自启"
          description="电脑开机后自动在后台启动 Tempo，不错过任何提醒"
        >
          <ToggleSwitch enabled={config.autoStart} onToggle={handleAutoStartToggle} />
        </SettingCard>

        <SettingCard
          variants={itemVariants}
          title="空闲检测阈值"
          description={`当鼠标/键盘无操作 ${config.idleTimeoutMinutes} 分钟后判定为离开，暂停间隔提醒`}
        >
          <div className="flex items-center gap-6">
            <span className="text-lg font-light text-main w-12 text-right tracking-tighter">
              {config.idleTimeoutMinutes} <span className="text-sub text-xs font-normal">m</span>
            </span>
            <input
              type="range"
              min={1}
              max={30}
              value={config.idleTimeoutMinutes}
              onChange={(e) => handleChange("idleTimeoutMinutes", parseInt(e.target.value))}
              className="w-40 h-1 bg-black/10 dark:bg-white/10 rounded-full appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                         [&::-webkit-slider-thumb]:bg-[var(--color-background)] [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-subtle
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md
                         hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95 [&::-webkit-slider-thumb]:transition-transform"
            />
          </div>
        </SettingCard>

        <SettingCard
          variants={itemVariants}
          title="通知显示时长"
          description="持续提醒时长（1-10 分钟）。单条通知淡出由系统控制，这里会按分钟重复提醒。"
        >
          <div className="flex items-center gap-6">
            <span className="text-lg font-light text-main w-12 text-right tracking-tighter">
              {config.notificationDurationMinutes}{" "}
              <span className="text-sub text-xs font-normal">m</span>
            </span>
            <input
              type="range"
              min={1}
              max={10}
              value={config.notificationDurationMinutes}
              onChange={(e) =>
                handleChange("notificationDurationMinutes", parseInt(e.target.value))
              }
              className="w-40 h-1 bg-black/10 dark:bg-white/10 rounded-full appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                         [&::-webkit-slider-thumb]:bg-[var(--color-background)] [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-subtle
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md
                         hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95 [&::-webkit-slider-thumb]:transition-transform"
            />
          </div>
        </SettingCard>

        <SettingCard
          variants={itemVariants}
          title="软件使用监控"
          description="记录各个软件的前台聚焦时间，极低系统资源消耗"
        >
          <ToggleSwitch
            enabled={config.monitorApps}
            onToggle={() => handleChange("monitorApps", !config.monitorApps)}
          />
        </SettingCard>
      </motion.div>
    </div>
  );
}

function SettingCard({
  title,
  description,
  children,
  variants,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  variants: any;
}) {
  return (
    <motion.div
      variants={variants}
      className="rounded-xl bg-glass p-4 transition-all hover:shadow-float group border border-subtle"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-main tracking-tight">{title}</h3>
          <p className="text-[13px] font-light text-sub mt-1 tracking-wide leading-relaxed">
            {description}
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center justify-start">{children}</div>
      </div>
    </motion.div>
  );
}

function ToggleSwitch({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-[52px] h-[32px] flex items-center rounded-full p-1 transition-colors duration-300 relative focus:outline-none border border-subtle ${
        enabled ? "bg-toggle" : "bg-black/10 dark:bg-white/20"
      }`}
    >
      <motion.div
        className="w-6 h-6 bg-[var(--color-background)] rounded-full shadow-sm"
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        style={{ originY: 0.5 }}
        animate={{
          x: enabled ? 20 : 0,
        }}
      />
    </button>
  );
}
