import { useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
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

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  return (
    <div className="pb-10 h-full flex flex-col">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 pt-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-main">Reminders</h2>
          <p className="text-sm text-sub mt-1 tracking-wide font-light">管理你的日常专属提醒</p>
        </div>
        <button
          onClick={() => {
            setEditingReminder(null);
            setShowForm(true);
          }}
          className="px-6 py-3 bg-main text-[var(--color-background)] rounded-full text-sm font-medium hover:opacity-90 hover:shadow-float transition-all active:scale-[0.98] flex items-center justify-center gap-2 max-w-fit"
        >
          <span className="text-xl font-light leading-none">+</span> Create
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-4 -mr-4">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-3"
        >
          <AnimatePresence mode="popLayout">
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
        </motion.div>

        {config.reminders.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-64 text-center mt-10"
          >
            <div className="w-16 h-16 bg-glass rounded-full flex items-center justify-center text-3xl mb-4 shadow-soft">
              ✨
            </div>
            <h3 className="text-lg font-medium tracking-tight text-main mb-1">Blank Slate</h3>
            <p className="text-sub text-[13px] tracking-wide">添加你的第一个专属提醒</p>
          </motion.div>
        )}
      </div>

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
