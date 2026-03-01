use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reminder {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub reminder_type: String,
    #[serde(rename = "intervalMinutes")]
    pub interval_minutes: Option<u32>,
    #[serde(rename = "scheduledTime")]
    pub scheduled_time: Option<String>,
    #[serde(rename = "activeDays")]
    pub active_days: Vec<u32>,
    pub enabled: bool,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestPeriod {
    pub id: String,
    pub name: String,
    #[serde(rename = "startTime")]
    pub start_time: String,
    #[serde(rename = "endTime")]
    pub end_time: String,
    #[serde(rename = "activeDays")]
    pub active_days: Vec<u32>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub reminders: Vec<Reminder>,
    #[serde(rename = "restPeriods")]
    pub rest_periods: Vec<RestPeriod>,
    #[serde(rename = "idleTimeoutMinutes")]
    pub idle_timeout_minutes: u32,
    #[serde(rename = "autoStart")]
    pub auto_start: bool,
    #[serde(rename = "monitorApps")]
    pub monitor_apps: bool,
    pub theme: String,
    #[serde(
        rename = "notificationDurationMinutes",
        alias = "notificationDurationSeconds",
        default = "default_notification_duration_minutes"
    )]
    pub notification_duration_minutes: u32,
}

fn default_notification_duration_minutes() -> u32 {
    2
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            reminders: vec![],
            rest_periods: vec![],
            idle_timeout_minutes: 10,
            auto_start: false,
            monitor_apps: false,
            theme: "system".to_string(),
            notification_duration_minutes: default_notification_duration_minutes(),
        }
    }
}

pub fn get_data_dir() -> PathBuf {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));
    exe_dir.join("data")
}

pub fn get_config_path() -> PathBuf {
    get_data_dir().join("config.json")
}

pub fn load_config() -> Result<AppConfig, String> {
    let path = get_config_path();
    if !path.exists() {
        return Err("Config file not found".to_string());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut raw: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // Backward-compatible migration from the old second-based field.
    if raw.get("notificationDurationMinutes").is_none() {
        let minutes = raw
            .get("notificationDurationSeconds")
            .and_then(|v| v.as_u64())
            .map(|seconds| ((seconds + 59) / 60).clamp(1, 10) as u32)
            .unwrap_or_else(default_notification_duration_minutes);
        raw["notificationDurationMinutes"] = serde_json::json!(minutes);
    }

    let mut config: AppConfig = serde_json::from_value(raw).map_err(|e| e.to_string())?;
    config.notification_duration_minutes = config.notification_duration_minutes.clamp(1, 10);
    Ok(config)
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let data_dir = get_data_dir();
    fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    let path = get_config_path();
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}
