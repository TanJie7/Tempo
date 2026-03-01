import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../../stores/appStore";
import type { Reminder } from "../../types";
import { ReminderCard } from "./ReminderCard";
import { ReminderForm } from "./ReminderForm";

export function RemindersPage() {
  const { config, setConfig, saveConfig } = useAppStore();
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleToggle = (id: string) => {
    const updated = config.reminders.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r,
    );
    setConfig({ ...config, reminders: updated });
    saveConfig();
  };

  const handleDelete = (id: string) => {
    const updated = config.reminders.filter((r) => r.id !== id);
    setConfig({ ...config, reminders: updated });
    saveConfig();
  };

  const handleSave = (reminder: Reminder) => {
    const exists = config.reminders.find((r) => r.id === reminder.id);
    const updated = exists
      ? config.reminders.map((r) => (r.id === reminder.id ? reminder : r))
      : [...config.reminders, reminder];
    setConfig({ ...config, reminders: updated });
    saveConfig();
    setShowForm(false);
    setEditingReminder(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">提醒管理</h2>
        <button
          onClick={() => {
            setEditingReminder(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          + 添加提醒
        </button>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {config.reminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              onToggle={() => handleToggle(reminder.id)}
              onEdit={() => {
                setEditingReminder(reminder);
                setShowForm(true);
              }}
              onDelete={() => handleDelete(reminder.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {config.reminders.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16 text-[var(--color-text-muted)]"
        >
          <p className="text-4xl mb-3">🔔</p>
          <p>还没有提醒，点击上方按钮添加</p>
        </motion.div>
      )}

      <AnimatePresence>
        {showForm && (
          <ReminderForm
            reminder={editingReminder}
            onSave={handleSave}
            onClose={() => {
              setShowForm(false);
              setEditingReminder(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
