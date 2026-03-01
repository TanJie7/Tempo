mod autostart;
mod config;
mod idle;
mod monitor;
mod reminder;

use config::AppConfig;
use monitor::AppUsageEntry;
use reminder::ReminderEngine;
use std::sync::Mutex;
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_notification::NotificationExt;

struct AppState {
    config: Mutex<AppConfig>,
    reminder_engine: ReminderEngine,
    db: Mutex<Option<rusqlite::Connection>>,
    is_quitting: Mutex<bool>,
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
fn get_current_app_name() -> Option<String> {
    monitor::get_foreground_app().map(|(app_name, _)| app_name)
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
    show_notification(&app, &title, desc, &color, duration_minutes, &theme);
}

fn show_notification(
    app: &AppHandle,
    title: &str,
    description: Option<&str>,
    _color: &str,
    duration_minutes: u32,
    _theme: &str,
) {
    let body = description.unwrap_or("It is time to take a short break.");
    if let Err(e) = app.notification().builder().title(title).body(body).show() {
        eprintln!("Failed to show native notification: {}", e);
        return;
    }

    // Native desktop notifications auto-dismiss quickly; re-fire to sustain visibility.
    let repeat_count = duration_minutes.clamp(1, 10).saturating_sub(1);
    if repeat_count == 0 {
        return;
    }

    let app_handle = app.clone();
    let title_owned = title.to_string();
    let body_owned = body.to_string();
    std::thread::spawn(move || {
        for _ in 0..repeat_count {
            std::thread::sleep(std::time::Duration::from_secs(60));
            let _ = app_handle
                .notification()
                .builder()
                .title(&title_owned)
                .body(&body_owned)
                .show();
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
                let _ = app.emit("toggle-pause", ());
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
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            load_config,
            save_config,
            set_auto_start,
            get_auto_start_status,
            get_idle_seconds,
            is_idle,
            get_today_active_minutes,
            get_top_apps,
            get_active_minutes_by_period,
            get_top_apps_by_period,
            get_current_app_name,
            reset_reminder_timer,
            test_notification,
        ])
        .setup(|app| {
            setup_tray(app.handle())?;
            start_background_tasks(app.handle().clone());

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





