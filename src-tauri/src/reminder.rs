use crate::config::{AppConfig, Reminder, RestPeriod};
use chrono::{DateTime, Datelike, Duration, Local, TimeZone, Timelike};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderCountdown {
    pub id: String,
    pub title: String,
    pub color: String,
    pub reminder_type: String,
    pub enabled: bool,
    pub next_in_seconds: Option<i64>,
    pub blocked_reason: Option<String>,
}

pub struct ReminderEngine {
    last_triggered: Mutex<HashMap<String, chrono::DateTime<Local>>>,
    last_scheduled_triggered: Mutex<HashMap<String, String>>,
}

impl ReminderEngine {
    pub fn new() -> Self {
        Self {
            last_triggered: Mutex::new(HashMap::new()),
            last_scheduled_triggered: Mutex::new(HashMap::new()),
        }
    }

    pub fn check_reminders(&self, config: &AppConfig, is_idle: bool) -> Vec<Reminder> {
        let now = Local::now();
        let current_day = now.weekday().num_days_from_sunday();
        let mut to_fire = Vec::new();

        if config.reminders_paused {
            return to_fire;
        }

        // Check if we're in a rest period
        if self.is_in_rest_period(&config.rest_periods, &now) {
            return to_fire;
        }

        for reminder in &config.reminders {
            if !reminder.enabled {
                continue;
            }

            // Check if today is an active day
            if !reminder.active_days.contains(&current_day) {
                continue;
            }

            match reminder.reminder_type.as_str() {
                "interval" => {
                    if is_idle {
                        // Don't count idle time for interval reminders
                        continue;
                    }
                    if let Some(minutes) = reminder.interval_minutes {
                        let mut last = self.last_triggered.lock().unwrap();
                        let should_fire = match last.get(&reminder.id) {
                            Some(last_time) => {
                                let elapsed = now.signed_duration_since(*last_time);
                                elapsed.num_minutes() >= minutes as i64
                            }
                            None => {
                                // First time: set initial time and don't fire immediately
                                last.insert(reminder.id.clone(), now);
                                false
                            }
                        };
                        if should_fire {
                            last.insert(reminder.id.clone(), now);
                            to_fire.push(reminder.clone());
                        }
                    }
                }
                "scheduled" => {
                    if let Some(ref time_str) = reminder.scheduled_time {
                        let parts: Vec<&str> = time_str.split(':').collect();
                        if parts.len() == 2 {
                            if let (Ok(hour), Ok(minute)) =
                                (parts[0].parse::<u32>(), parts[1].parse::<u32>())
                            {
                                if now.hour() == hour && now.minute() == minute {
                                    let date_key = now.format("%Y-%m-%d").to_string();
                                    let mut last = self.last_scheduled_triggered.lock().unwrap();
                                    let key = format!("{}_{}", reminder.id, date_key);
                                    if !last.contains_key(&key) {
                                        last.insert(key, date_key);
                                        to_fire.push(reminder.clone());
                                    }
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        to_fire
    }

    pub fn get_countdowns(&self, config: &AppConfig, is_idle: bool) -> Vec<ReminderCountdown> {
        let now = Local::now();
        let in_rest_period = self.is_in_rest_period(&config.rest_periods, &now);
        let paused = config.reminders_paused;
        let interval_last = self.last_triggered.lock().unwrap().clone();

        config
            .reminders
            .iter()
            .map(|reminder| {
                let blocked_reason = if !reminder.enabled {
                    Some("disabled".to_string())
                } else if paused {
                    Some("paused".to_string())
                } else if in_rest_period {
                    Some("rest".to_string())
                } else if reminder.reminder_type == "interval" && is_idle {
                    Some("idle".to_string())
                } else {
                    None
                };

                let next_in_seconds = if !reminder.enabled {
                    None
                } else {
                    match reminder.reminder_type.as_str() {
                        "interval" => reminder
                            .interval_minutes
                            .map(i64::from)
                            .map(|minutes| minutes * 60)
                            .map(|interval_secs| {
                                if let Some(last_time) = interval_last.get(&reminder.id) {
                                    let elapsed = now.signed_duration_since(*last_time).num_seconds();
                                    (interval_secs - elapsed).max(0)
                                } else {
                                    interval_secs
                                }
                            }),
                        "scheduled" => next_scheduled_datetime(reminder, &now).map(|dt| {
                            dt.signed_duration_since(now).num_seconds().max(0)
                        }),
                        _ => None,
                    }
                };

                ReminderCountdown {
                    id: reminder.id.clone(),
                    title: reminder.title.clone(),
                    color: reminder.color.clone(),
                    reminder_type: reminder.reminder_type.clone(),
                    enabled: reminder.enabled,
                    next_in_seconds,
                    blocked_reason,
                }
            })
            .collect()
    }

    fn is_in_rest_period(
        &self,
        rest_periods: &[RestPeriod],
        now: &chrono::DateTime<Local>,
    ) -> bool {
        let current_day = now.weekday().num_days_from_sunday();
        let current_minutes = now.hour() * 60 + now.minute();

        for period in rest_periods {
            if !period.enabled || !period.active_days.contains(&current_day) {
                continue;
            }

            let start = parse_time_to_minutes(&period.start_time);
            let end = parse_time_to_minutes(&period.end_time);

            if start <= end {
                // Same day: e.g., 12:00 - 13:00
                if current_minutes >= start && current_minutes < end {
                    return true;
                }
            } else {
                // Cross midnight: e.g., 22:00 - 08:00
                if current_minutes >= start || current_minutes < end {
                    return true;
                }
            }
        }

        false
    }

    pub fn reset_timer(&self, reminder_id: &str) {
        let mut last = self.last_triggered.lock().unwrap();
        last.remove(reminder_id);
    }
}

fn parse_time_to_minutes(time_str: &str) -> u32 {
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() == 2 {
        let hours: u32 = parts[0].parse().unwrap_or(0);
        let minutes: u32 = parts[1].parse().unwrap_or(0);
        hours * 60 + minutes
    } else {
        0
    }
}

fn parse_hhmm(time_str: &str) -> Option<(u32, u32)> {
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    let hour = parts[0].parse::<u32>().ok()?;
    let minute = parts[1].parse::<u32>().ok()?;
    if hour > 23 || minute > 59 {
        return None;
    }
    Some((hour, minute))
}

fn next_scheduled_datetime(reminder: &Reminder, now: &DateTime<Local>) -> Option<DateTime<Local>> {
    let time_str = reminder.scheduled_time.as_ref()?;
    let (hour, minute) = parse_hhmm(time_str)?;

    for day_offset in 0..8 {
        let candidate_date = now.date_naive() + Duration::days(day_offset);
        let day = candidate_date.weekday().num_days_from_sunday();
        if !reminder.active_days.contains(&day) {
            continue;
        }

        let naive = candidate_date.and_hms_opt(hour, minute, 0)?;
        let local_candidate = match Local.from_local_datetime(&naive) {
            chrono::LocalResult::Single(dt) => dt,
            chrono::LocalResult::Ambiguous(dt, _) => dt,
            chrono::LocalResult::None => continue,
        };

        if day_offset > 0 || local_candidate >= *now {
            return Some(local_candidate);
        }
    }

    None
}
