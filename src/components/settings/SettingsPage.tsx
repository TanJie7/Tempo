import { useAppStore } from "../../stores/appStore";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "framer-motion";

export function SettingsPage() {
  const { config, updateConfig, saveConfig } = useAppStore();

  const handleChange = <K extends keyof typeof config>(
    key: K,
    value: (typeof config)[K],
  ) => {
    updateConfig({ [key]: value });
    // Defer save to batch rapid changes
    setTimeout(() => saveConfig(), 100);
  };

  const handleAutoStartToggle = async () => {
    const newValue = !config.autoStart;
    try {
      await invoke("set_auto_start", { enabled: newValue });
      handleChange("autoStart", newValue);
    } catch (e) {
      console.error("Failed to set auto start:", e);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">通用设置</h2>

      <div className="space-y-4">
        <SettingCard
          title="开机自启"
          description="电脑开机后自动在后台启动 Tempo"
        >
          <ToggleSwitch
            enabled={config.autoStart}
            onToggle={handleAutoStartToggle}
          />
        </SettingCard>

        <SettingCard
          title="空闲检测阈值"
          description={`鼠标/键盘无操作 ${config.idleTimeoutMinutes} 分钟后判定为离开，暂停间隔提醒的计时`}
        >
          <input
            type="range"
            min={1}
            max={30}
            value={config.idleTimeoutMinutes}
            onChange={(e) =>
              handleChange("idleTimeoutMinutes", parseInt(e.target.value))
            }
            className="w-32 accent-[var(--color-primary)]"
          />
          <span className="text-sm text-[var(--color-text-secondary)] ml-2 w-12 text-right">
            {config.idleTimeoutMinutes} 分钟
          </span>
        </SettingCard>

        <SettingCard
          title="通知显示时长"
          description={`提醒弹窗显示 ${config.notificationDurationSeconds} 秒后自动消失`}
        >
          <input
            type="range"
            min={3}
            max={30}
            value={config.notificationDurationSeconds}
            onChange={(e) =>
              handleChange(
                "notificationDurationSeconds",
                parseInt(e.target.value),
              )
            }
            className="w-32 accent-[var(--color-primary)]"
          />
          <span className="text-sm text-[var(--color-text-secondary)] ml-2 w-8 text-right">
            {config.notificationDurationSeconds}s
          </span>
        </SettingCard>

        <SettingCard
          title="主题"
          description="选择浅色、深色或跟随系统设置"
        >
          <div className="flex gap-2">
            {(["system", "light", "dark"] as const).map((theme) => (
              <button
                key={theme}
                onClick={() => handleChange("theme", theme)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  config.theme === theme
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                }`}
              >
                {theme === "system" ? "系统" : theme === "light" ? "浅色" : "深色"}
              </button>
            ))}
          </div>
        </SettingCard>

        <SettingCard
          title="软件使用监控"
          description="记录各个软件的聚焦使用时间（每2秒检测一次前台窗口，资源消耗极低）"
        >
          <ToggleSwitch
            enabled={config.monitorApps}
            onToggle={() => handleChange("monitorApps", !config.monitorApps)}
          />
        </SettingCard>
      </div>
    </div>
  );
}

function SettingCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1 mr-4">
          <h3 className="font-medium text-[var(--color-text)]">{title}</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            {description}
          </p>
        </div>
        <div className="flex items-center">{children}</div>
      </div>
    </div>
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
      className={`w-11 h-6 rounded-full transition-colors relative ${
        enabled ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
      }`}
    >
      <motion.div
        className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm"
        animate={{ left: enabled ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
