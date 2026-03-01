import { useAppStore } from "../../stores/appStore";

export function DashboardPage() {
  const { todayActiveMinutes, config } = useAppStore();
  const hours = Math.floor(todayActiveMinutes / 60);
  const mins = todayActiveMinutes % 60;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">使用统计</h2>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-sm text-[var(--color-text-secondary)]">
            今日使用时长
          </p>
          <p className="text-3xl font-bold text-[var(--color-text)] mt-2">
            {hours > 0 ? `${hours}h ` : ""}
            {mins}m
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-sm text-[var(--color-text-secondary)]">
            活跃提醒数
          </p>
          <p className="text-3xl font-bold text-[var(--color-text)] mt-2">
            {config.reminders.filter((r) => r.enabled).length}
          </p>
        </div>
      </div>

      {!config.monitorApps && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-8 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-[var(--color-text-secondary)]">
            软件使用监控未开启
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            前往设置页面开启后，可查看各软件的使用时长统计
          </p>
        </div>
      )}

      {config.monitorApps && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h3 className="font-medium text-[var(--color-text)] mb-3">
            今日软件使用排行
          </h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            数据收集中，请稍后查看...
          </p>
        </div>
      )}
    </div>
  );
}
