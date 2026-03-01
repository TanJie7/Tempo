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
    AppHandle, Emitter, Manager,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    WebviewUrl, WebviewWindowBuilder,
};

struct AppState {
    config: Mutex<AppConfig>,
    reminder_engine: ReminderEngine,
    db: Mutex<Option<rusqlite::Connection>>,
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
fn reset_reminder_timer(state: tauri::State<AppState>, reminder_id: String) {
    state.reminder_engine.reset_timer(&reminder_id);
}

fn show_notification(app: &AppHandle, title: &str, description: Option<&str>, color: &str, duration: u32) {
    let label = format!("notification-{}", uuid::Uuid::new_v4());

    // Get primary monitor work area for bottom-left positioning
    let (x, y) = get_notification_position(app);

    let notification_url = WebviewUrl::App("index.html?notification=true".into());

    if let Ok(win) = WebviewWindowBuilder::new(app, &label, notification_url)
        .title("Tempo Notification")
        .inner_size(320.0, 120.0)
        .position(x, y)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .build()
    {
        let payload = serde_json::json!({
            "title": title,
            "description": description,
            "color": color,
            "duration": duration
        });

        // Small delay to let the window load
        let win_clone = win.clone();
        let payload_clone = payload.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(500));
            let _ = win_clone.emit("show-notification", payload_clone);
        });
    }
}

fn get_notification_position(app: &AppHandle) -> (f64, f64) {
    // Default position: bottom-left, above taskbar
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = window.primary_monitor() {
            let size = monitor.size();
            let scale = monitor.scale_factor();
            let x = 16.0;
            let y = (size.height as f64 / scale) - 120.0 - 60.0; // 60px above taskbar
            return (x, y);
        }
    }
    (16.0, 800.0) // fallback
}

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let menu = tauri::menu::MenuBuilder::new(app)
        .text("open", "打开设置")
        .separator()
        .text("pause", "暂停所有提醒")
        .separator()
        .text("quit", "退出")
        .build()?;

    let _tray = TrayIconBuilder::new()
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
                app.exit(0);
            }
            "pause" => {
                // Toggle pause - emit event to frontend
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

    // Reminder check loop (every 30 seconds)
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(30));

            let state = app_handle.state::<AppState>();
            let config = state.config.lock().unwrap().clone();

            // Update idle state
            idle::update_idle_state(config.idle_timeout_minutes);
            let is_idle = idle::is_idle();

            // Check reminders
            let to_fire = state.reminder_engine.check_reminders(&config, is_idle);
            for reminder in to_fire {
                show_notification(
                    &app_handle,
                    &reminder.title,
                    reminder.description.as_deref(),
                    &reminder.color,
                    config.notification_duration_seconds,
                );
            }

            // Update daily usage (if not idle)
            if !is_idle {
                let db = state.db.lock().unwrap();
                if let Some(ref conn) = *db {
                    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
                    let _ = monitor::update_daily_usage(conn, &today, 30);
                }
            }
        }
    });

    // App monitoring loop (every 2 seconds, if enabled)
    let app_handle2 = app.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(2));

            let state = app_handle2.state::<AppState>();
            let config = state.config.lock().unwrap().clone();

            if !config.monitor_apps {
                continue;
            }

            if idle::is_idle() {
                continue;
            }

            if let Some((app_name, _window_title)) = monitor::get_foreground_app() {
                let db = state.db.lock().unwrap();
                if let Some(ref conn) = *db {
                    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
                    let _ = monitor::record_app_focus(conn, &app_name, 2, &today);
                }
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load initial config
    let initial_config = config::load_config().unwrap_or_default();

    // Initialize database
    let db = monitor::init_db().ok();

    let state = AppState {
        config: Mutex::new(initial_config),
        reminder_engine: ReminderEngine::new(),
        db: Mutex::new(db),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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
            reset_reminder_timer,
        ])
        .setup(|app| {
            // Setup system tray
            setup_tray(app.handle())?;

            // Start background tasks
            start_background_tasks(app.handle().clone());

            // Hide main window to tray on close
            let window = app.get_webview_window("main").unwrap();
            let window_clone = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window_clone.hide();
                }
            });

            // Check if launched with --minimized flag (auto-start)
            let args: Vec<String> = std::env::args().collect();
            if args.contains(&"--minimized".to_string()) {
                let _ = window.hide();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Tempo");
}
