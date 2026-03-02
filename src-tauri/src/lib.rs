mod autostart;
mod config;
mod idle;
mod monitor;
mod reminder;

use config::AppConfig;
use monitor::AppUsageEntry;
use reminder::{ReminderCountdown, ReminderEngine};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex,
};
use tauri::{
    LogicalPosition, LogicalSize, WebviewUrl,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WebviewWindow, WebviewWindowBuilder,
};

const NOTIFICATION_WIDTH: f64 = 320.0;
const NOTIFICATION_HEIGHT: f64 = 160.0;
const NOTIFICATION_RIGHT_GAP: f64 = 28.0;
const NOTIFICATION_BOTTOM_GAP: f64 = 86.0;
const SNOOZE_MINUTES: u32 = 5;

struct AppState {
    config: Mutex<AppConfig>,
    reminder_engine: ReminderEngine,
    db: Mutex<Option<rusqlite::Connection>>,
    is_quitting: Mutex<bool>,
    pending_notification: Mutex<Option<PopupNotificationPayload>>,
    active_notifications: Mutex<HashMap<u64, ActiveNotification>>,
    notification_counter: AtomicU64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PopupNotificationPayload {
    id: u64,
    reminder_id: String,
    title: String,
    description: String,
    color: String,
    duration_seconds: u32,
    theme: String,
}

#[derive(Debug, Clone)]
struct ActiveNotification {
    id: u64,
    reminder_id: String,
    title: String,
    description: String,
    color: String,
    duration_seconds: u32,
    theme: String,
    shown_at: chrono::DateTime<chrono::Local>,
}

fn persist_reminders_paused(state: &tauri::State<AppState>, paused: bool) -> Result<(), String> {
    let mut next_config = state.config.lock().unwrap().clone();
    next_config.reminders_paused = paused;
    config::save_config(&next_config)?;
    *state.config.lock().unwrap() = next_config;
    Ok(())
}

fn record_notification_event(
    app: &AppHandle,
    notification: &ActiveNotification,
    event_type: &str,
    response_seconds: Option<u32>,
    snooze_minutes: Option<u32>,
) {
    let state = app.state::<AppState>();
    let db = state.db.lock().unwrap();
    let now = chrono::Local::now();
    let shown_at = notification.shown_at.format("%Y-%m-%d %H:%M:%S").to_string();
    let event_at = now.format("%Y-%m-%d %H:%M:%S").to_string();
    let date = now.format("%Y-%m-%d").to_string();

    if let Some(ref conn) = *db {
        let _ = monitor::record_notification_event(
            conn,
            notification.id,
            &notification.reminder_id,
            &notification.title,
            event_type,
            &shown_at,
            &event_at,
            response_seconds,
            snooze_minutes,
            &date,
        );
    }
}

#[tauri::command]
fn load_config() -> Result<AppConfig, String> {
    config::load_config()
}

#[tauri::command]
fn save_config(config: AppConfig, state: tauri::State<AppState>) -> Result<(), String> {
    config::save_config(&config)?;
    *state.config.lock().unwrap() = config;
    Ok(())
}

#[tauri::command]
fn set_auto_start(enabled: bool) -> Result<(), String> {
    autostart::set_auto_start(enabled)
}

#[tauri::command]
fn get_auto_start_status() -> bool {
    autostart::is_auto_start_enabled()
}

#[tauri::command]
fn consume_pending_notification(
    state: tauri::State<AppState>,
) -> Option<PopupNotificationPayload> {
    state.pending_notification.lock().unwrap().take()
}

#[tauri::command]
fn set_reminders_paused(state: tauri::State<AppState>, paused: bool) -> Result<(), String> {
    persist_reminders_paused(&state, paused)
}

#[tauri::command]
fn get_reminder_countdowns(state: tauri::State<AppState>) -> Vec<ReminderCountdown> {
    let config = state.config.lock().unwrap().clone();
    let is_idle = idle::is_idle();
    state.reminder_engine.get_countdowns(&config, is_idle)
}

#[tauri::command]
fn get_idle_seconds() -> u32 {
    idle::get_idle_seconds()
}

#[tauri::command]
fn is_idle(state: tauri::State<AppState>) -> bool {
    let config = state.config.lock().unwrap();
    idle::get_idle_seconds() >= config.idle_timeout_minutes * 60
}

#[tauri::command]
fn get_today_active_minutes(state: tauri::State<AppState>) -> u32 {
    let db = state.db.lock().unwrap();
    if let Some(ref conn) = *db {
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        monitor::get_daily_active_minutes(conn, &today)
    } else {
        0
    }
}

#[tauri::command]
fn get_top_apps(state: tauri::State<AppState>, date: String) -> Vec<AppUsageEntry> {
    let db = state.db.lock().unwrap();
    if let Some(ref conn) = *db {
        monitor::get_top_apps(conn, &date, 10)
    } else {
        vec![]
    }
}

#[tauri::command]
fn get_active_minutes_by_period(
    state: tauri::State<AppState>,
    period: String,
    reference_date: String,
) -> u32 {
    let db = state.db.lock().unwrap();
    if let Some(ref conn) = *db {
        monitor::get_active_minutes_by_period(conn, &period, &reference_date)
    } else {
        0
    }
}

#[tauri::command]
fn get_top_apps_by_period(
    state: tauri::State<AppState>,
    period: String,
    reference_date: String,
) -> Vec<AppUsageEntry> {
    let db = state.db.lock().unwrap();
    if let Some(ref conn) = *db {
        monitor::get_top_apps_by_period(conn, &period, &reference_date, 10)
    } else {
        vec![]
    }
}

#[tauri::command]
fn get_reminder_interaction_stats_by_period(
    state: tauri::State<AppState>,
    period: String,
    reference_date: String,
) -> monitor::ReminderInteractionStats {
    let db = state.db.lock().unwrap();
    if let Some(ref conn) = *db {
        monitor::get_reminder_interaction_stats_by_period(conn, &period, &reference_date)
    } else {
        monitor::ReminderInteractionStats::default()
    }
}

#[tauri::command]
fn get_current_app_name() -> Option<String> {
    monitor::get_foreground_app().map(|(app_name, _)| app_name)
}

#[tauri::command]
fn submit_notification_action(
    app: AppHandle,
    state: tauri::State<AppState>,
    notification_id: u64,
    action: String,
) -> Result<(), String> {
    if !matches!(action.as_str(), "done" | "snooze" | "missed") {
        return Err("Unsupported notification action".to_string());
    }

    let notification = {
        let mut active = state.active_notifications.lock().unwrap();
        active.remove(&notification_id)
    };

    let Some(notification) = notification else {
        return Ok(());
    };

    let response_seconds = chrono::Local::now()
        .signed_duration_since(notification.shown_at)
        .num_seconds()
        .max(0) as u32;

    match action.as_str() {
        "done" => {
            record_notification_event(&app, &notification, "done", Some(response_seconds), None);
        }
        "snooze" => {
            record_notification_event(
                &app,
                &notification,
                "snooze",
                Some(response_seconds),
                Some(SNOOZE_MINUTES),
            );

            let app_handle = app.clone();
            let snoozed = notification.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs((SNOOZE_MINUTES * 60) as u64));
                let duration_minutes = (snoozed.duration_seconds / 60).clamp(1, 10);
                show_notification(
                    &app_handle,
                    &snoozed.title,
                    Some(&snoozed.description),
                    &snoozed.color,
                    duration_minutes,
                    &snoozed.theme,
                    &snoozed.reminder_id,
                );
            });
        }
        "missed" => {
            record_notification_event(&app, &notification, "missed", Some(response_seconds), None);
        }
        _ => unreachable!(),
    }

    Ok(())
}

#[tauri::command]
fn reset_reminder_timer(state: tauri::State<AppState>, reminder_id: String) {
    state.reminder_engine.reset_timer(&reminder_id);
}

#[tauri::command]
fn test_notification(
    app: AppHandle,
    title: String,
    description: String,
    color: String,
    duration_minutes: u32,
    theme: String,
) {
    let desc = if description.is_empty() {
        None
    } else {
        Some(description.as_str())
    };
    show_notification(
        &app,
        &title,
        desc,
        &color,
        duration_minutes,
        &theme,
        "__test__",
    );
}

fn ensure_notification_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window("notification") {
        return Ok(window);
    }

    WebviewWindowBuilder::new(app, "notification", WebviewUrl::App("notification.html".into()))
        .title("Tempo Notification")
        .inner_size(NOTIFICATION_WIDTH, NOTIFICATION_HEIGHT)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .visible(false)
        .focused(false)
        .skip_taskbar(true)
        .build()
        .map_err(|e| e.to_string())
}

fn place_notification_window(app: &AppHandle, window: &WebviewWindow) {
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());

    if let Some(monitor) = monitor {
        let scale = monitor.scale_factor();
        let size = monitor.size().to_logical::<f64>(scale);
        let position = monitor.position().to_logical::<f64>(scale);
        let x = position.x + (size.width - NOTIFICATION_WIDTH - NOTIFICATION_RIGHT_GAP).max(0.0);
        let y = position.y
            + (size.height - NOTIFICATION_HEIGHT - NOTIFICATION_BOTTOM_GAP).max(0.0);

        let _ = window.set_size(LogicalSize::new(
            NOTIFICATION_WIDTH,
            NOTIFICATION_HEIGHT,
        ));
        let _ = window.set_position(LogicalPosition::new(x, y));
    }
}

fn show_notification(
    app: &AppHandle,
    title: &str,
    description: Option<&str>,
    color: &str,
    duration_minutes: u32,
    theme: &str,
    reminder_id: &str,
) {
    let duration_seconds = duration_minutes.saturating_mul(60).clamp(5, 600);
    let shown_at = chrono::Local::now();

    let (payload, active_notification) = {
        let state = app.state::<AppState>();
        let id = state.notification_counter.fetch_add(1, Ordering::Relaxed) + 1;
        let payload = PopupNotificationPayload {
            id,
            reminder_id: reminder_id.to_string(),
            title: title.to_string(),
            description: description
                .unwrap_or("It is time to take a short break.")
                .to_string(),
            color: color.to_string(),
            duration_seconds,
            theme: theme.to_string(),
        };
        let active = ActiveNotification {
            id,
            reminder_id: reminder_id.to_string(),
            title: payload.title.clone(),
            description: payload.description.clone(),
            color: payload.color.clone(),
            duration_seconds,
            theme: payload.theme.clone(),
            shown_at,
        };
        state
            .active_notifications
            .lock()
            .unwrap()
            .insert(id, active.clone());
        *state.pending_notification.lock().unwrap() = Some(payload.clone());
        (payload, active)
    };
    record_notification_event(app, &active_notification, "shown", None, None);

    let window = match ensure_notification_window(app) {
        Ok(window) => window,
        Err(e) => {
            eprintln!("Failed to create notification window: {}", e);
            return;
        }
    };

    place_notification_window(app, &window);

    if let Err(e) = window.emit("notification-payload", payload.clone()) {
        eprintln!("Failed to emit notification payload: {}", e);
    }

    if let Err(e) = window.show() {
        eprintln!("Failed to show notification window: {}", e);
        return;
    }

    let app_handle = app.clone();
    let notification_id = payload.id;
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(
            payload.duration_seconds as u64 + 1,
        ));

        let timed_out_notification = {
            let state = app_handle.state::<AppState>();
            let mut active = state.active_notifications.lock().unwrap();
            active.remove(&notification_id)
        };

        if let Some(notification) = timed_out_notification {
            let response_seconds = chrono::Local::now()
                .signed_duration_since(notification.shown_at)
                .num_seconds()
                .max(0) as u32;
            record_notification_event(
                &app_handle,
                &notification,
                "missed",
                Some(response_seconds),
                None,
            );

            let latest = app_handle
                .state::<AppState>()
                .notification_counter
                .load(Ordering::Relaxed);
            if latest == notification.id {
                if let Some(window) = app_handle.get_webview_window("notification") {
                    let _ = window.hide();
                }
            }
        }
    });
}

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let menu = tauri::menu::MenuBuilder::new(app)
        .text("open", "打开设置")
        .separator()
        .text("pause", "暂停所有提醒")
        .separator()
        .text("quit", "退出")
        .build()?;

    let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))?;

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("Tempo")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                let state = app.state::<AppState>();
                *state.is_quitting.lock().unwrap() = true;
                app.exit(0);

                std::thread::spawn(|| {
                    std::thread::sleep(std::time::Duration::from_millis(900));
                    std::process::exit(0);
                });
            }
            "pause" => {
                let state = app.state::<AppState>();
                let current = state.config.lock().unwrap().reminders_paused;
                let next = !current;
                if let Err(e) = persist_reminders_paused(&state, next) {
                    eprintln!("Failed to update pause state: {}", e);
                } else {
                    let _ = app.emit("pause-state-changed", next);
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

fn start_background_tasks(app: AppHandle) {
    let app_handle = app.clone();

    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(30));

        let state = app_handle.state::<AppState>();
        let config = state.config.lock().unwrap().clone();

        idle::update_idle_state(config.idle_timeout_minutes);
        let is_idle = idle::is_idle();

        let to_fire = state.reminder_engine.check_reminders(&config, is_idle);
        for reminder in to_fire {
            show_notification(
                &app_handle,
                &reminder.title,
                reminder.description.as_deref(),
                &reminder.color,
                config.notification_duration_minutes,
                &config.theme,
                &reminder.id,
            );
        }

        if !is_idle {
            let db = state.db.lock().unwrap();
            if let Some(ref conn) = *db {
                let today = chrono::Local::now().format("%Y-%m-%d").to_string();
                let _ = monitor::update_daily_usage(conn, &today, 30);
            }
        }
    });

    let app_handle2 = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(2));

        let state = app_handle2.state::<AppState>();
        let config = state.config.lock().unwrap().clone();

        if !config.monitor_apps || idle::is_idle() {
            continue;
        }

        if let Some((app_name, _window_title)) = monitor::get_foreground_app() {
            let db = state.db.lock().unwrap();
            if let Some(ref conn) = *db {
                let today = chrono::Local::now().format("%Y-%m-%d").to_string();
                let _ = monitor::record_app_focus(conn, &app_name, 2, &today);
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_config = config::load_config().unwrap_or_default();
    let db = monitor::init_db().ok();

    let state = AppState {
        config: Mutex::new(initial_config),
        reminder_engine: ReminderEngine::new(),
        db: Mutex::new(db),
        is_quitting: Mutex::new(false),
        pending_notification: Mutex::new(None),
        active_notifications: Mutex::new(HashMap::new()),
        notification_counter: AtomicU64::new(0),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            load_config,
            save_config,
            set_auto_start,
            get_auto_start_status,
            consume_pending_notification,
            set_reminders_paused,
            get_reminder_countdowns,
            get_idle_seconds,
            is_idle,
            get_today_active_minutes,
            get_top_apps,
            get_active_minutes_by_period,
            get_top_apps_by_period,
            get_reminder_interaction_stats_by_period,
            get_current_app_name,
            submit_notification_action,
            reset_reminder_timer,
            test_notification,
        ])
        .setup(|app| {
            setup_tray(app.handle())?;
            start_background_tasks(app.handle().clone());
            let _ = ensure_notification_window(app.handle());

            let window = app.get_webview_window("main").unwrap();
            let window_clone = window.clone();
            let app_handle = app.handle().clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    let state = app_handle.state::<AppState>();
                    if *state.is_quitting.lock().unwrap() {
                        return;
                    }
                    api.prevent_close();
                    let _ = window_clone.hide();
                }
            });

            let args: Vec<String> = std::env::args().collect();
            if args.contains(&"--minimized".to_string()) {
                let _ = window.hide();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Tempo");
}





