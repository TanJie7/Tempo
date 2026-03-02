use crate::config::get_data_dir;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use windows_sys::Win32::Foundation::HWND;
use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppUsageEntry {
    pub app_name: String,
    pub focus_seconds: u64,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ReminderInteractionStats {
    pub shown: u32,
    pub done: u32,
    pub snoozed: u32,
    pub missed: u32,
    pub avg_response_seconds: u32,
    pub ignored_streak: u32,
}

pub fn get_foreground_app() -> Option<(String, String)> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return None;
        }

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return None;
        }

        let process_name = get_process_name(pid)?;
        let title = get_window_title(hwnd);

        Some((process_name, title))
    }
}

unsafe fn get_process_name(pid: u32) -> Option<String> {
    let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
    if handle.is_null() {
        return None;
    }

    let mut buf = [0u16; 1024];
    let mut size = buf.len() as u32;
    let result = windows_sys::Win32::System::Threading::QueryFullProcessImageNameW(
        handle,
        0,
        buf.as_mut_ptr(),
        &mut size,
    );

    windows_sys::Win32::Foundation::CloseHandle(handle);

    if result != 0 && size > 0 {
        let path = OsString::from_wide(&buf[..size as usize])
            .to_string_lossy()
            .to_string();
        path.rsplit('\\').next().map(|s| s.to_string())
    } else {
        None
    }
}

unsafe fn get_window_title(hwnd: HWND) -> String {
    let len = windows_sys::Win32::UI::WindowsAndMessaging::GetWindowTextLengthW(hwnd);
    if len == 0 {
        return String::new();
    }
    let mut buf = vec![0u16; (len + 1) as usize];
    windows_sys::Win32::UI::WindowsAndMessaging::GetWindowTextW(
        hwnd,
        buf.as_mut_ptr(),
        buf.len() as i32,
    );
    OsString::from_wide(&buf[..len as usize])
        .to_string_lossy()
        .to_string()
}

pub fn init_db() -> Result<Connection, String> {
    let db_path = get_data_dir().join("usage.db");
    std::fs::create_dir_all(get_data_dir()).map_err(|e| e.to_string())?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS app_usage (
            app_name TEXT NOT NULL,
            date TEXT NOT NULL,
            focus_seconds INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (app_name, date)
        );
        CREATE TABLE IF NOT EXISTS daily_usage (
            date TEXT PRIMARY KEY,
            active_seconds INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS notification_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            notification_id INTEGER NOT NULL,
            reminder_id TEXT NOT NULL,
            title TEXT NOT NULL,
            event_type TEXT NOT NULL,
            shown_at TEXT NOT NULL,
            event_at TEXT NOT NULL,
            response_seconds INTEGER,
            snooze_minutes INTEGER,
            date TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_notification_events_date
            ON notification_events(date);
        CREATE INDEX IF NOT EXISTS idx_notification_events_event_at
            ON notification_events(event_at);",
    )
    .map_err(|e| e.to_string())?;

    Ok(conn)
}

pub fn record_app_focus(
    conn: &Connection,
    app_name: &str,
    seconds: u64,
    date: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO app_usage (app_name, date, focus_seconds)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(app_name, date) DO UPDATE SET focus_seconds = focus_seconds + ?3",
        rusqlite::params![app_name, date, seconds],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update_daily_usage(conn: &Connection, date: &str, seconds: u64) -> Result<(), String> {
    conn.execute(
        "INSERT INTO daily_usage (date, active_seconds) VALUES (?1, ?2)
         ON CONFLICT(date) DO UPDATE SET active_seconds = active_seconds + ?2",
        rusqlite::params![date, seconds],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_daily_active_minutes(conn: &Connection, date: &str) -> u32 {
    conn.query_row(
        "SELECT active_seconds FROM daily_usage WHERE date = ?1",
        rusqlite::params![date],
        |row| row.get::<_, u32>(0),
    )
    .unwrap_or(0)
        / 60
}

fn period_key(period: &str, reference_date: &str) -> Option<String> {
    match period {
        "day" if reference_date.len() >= 10 => Some(reference_date[..10].to_string()),
        "month" if reference_date.len() >= 7 => Some(reference_date[..7].to_string()),
        "year" if reference_date.len() >= 4 => Some(reference_date[..4].to_string()),
        _ => None,
    }
}

pub fn get_active_minutes_by_period(conn: &Connection, period: &str, reference_date: &str) -> u32 {
    let Some(key) = period_key(period, reference_date) else {
        return 0;
    };

    let seconds: i64 = match period {
        "day" => conn
            .query_row(
                "SELECT COALESCE(active_seconds, 0) FROM daily_usage WHERE date = ?1",
                rusqlite::params![key],
                |row| row.get(0),
            )
            .unwrap_or(0),
        "month" => conn
            .query_row(
                "SELECT COALESCE(SUM(active_seconds), 0) FROM daily_usage WHERE substr(date, 1, 7) = ?1",
                rusqlite::params![key],
                |row| row.get(0),
            )
            .unwrap_or(0),
        "year" => conn
            .query_row(
                "SELECT COALESCE(SUM(active_seconds), 0) FROM daily_usage WHERE substr(date, 1, 4) = ?1",
                rusqlite::params![key],
                |row| row.get(0),
            )
            .unwrap_or(0),
        _ => 0,
    };

    (seconds.max(0) as u64 / 60) as u32
}

pub fn get_top_apps(conn: &Connection, date: &str, limit: u32) -> Vec<AppUsageEntry> {
    let mut stmt = match conn.prepare(
        "SELECT app_name, focus_seconds, date
         FROM app_usage WHERE date = ?1
         ORDER BY focus_seconds DESC
         LIMIT ?2",
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    let rows = match stmt.query_map(rusqlite::params![date, limit], |row| {
        Ok(AppUsageEntry {
            app_name: row.get(0)?,
            focus_seconds: row.get(1)?,
            date: row.get(2)?,
        })
    }) {
        Ok(r) => r,
        Err(_) => return vec![],
    };

    rows.filter_map(|r| r.ok()).collect()
}

pub fn get_top_apps_by_period(
    conn: &Connection,
    period: &str,
    reference_date: &str,
    limit: u32,
) -> Vec<AppUsageEntry> {
    let Some(key) = period_key(period, reference_date) else {
        return vec![];
    };

    if period == "day" {
        return get_top_apps(conn, &key, limit);
    }

    let (sql, filter_key) = match period {
        "month" => (
            "SELECT app_name, SUM(focus_seconds) AS total_seconds
             FROM app_usage
             WHERE substr(date, 1, 7) = ?1
             GROUP BY app_name
             ORDER BY total_seconds DESC
             LIMIT ?2",
            key,
        ),
        "year" => (
            "SELECT app_name, SUM(focus_seconds) AS total_seconds
             FROM app_usage
             WHERE substr(date, 1, 4) = ?1
             GROUP BY app_name
             ORDER BY total_seconds DESC
             LIMIT ?2",
            key,
        ),
        _ => return vec![],
    };

    let mut stmt = match conn.prepare(sql) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    let period_key_for_row = filter_key.clone();
    let rows = match stmt.query_map(rusqlite::params![filter_key, limit], move |row| {
        Ok(AppUsageEntry {
            app_name: row.get(0)?,
            focus_seconds: row.get(1)?,
            date: period_key_for_row.clone(),
        })
    }) {
        Ok(r) => r,
        Err(_) => return vec![],
    };

    rows.filter_map(|r| r.ok()).collect()
}

pub fn record_notification_event(
    conn: &Connection,
    notification_id: u64,
    reminder_id: &str,
    title: &str,
    event_type: &str,
    shown_at: &str,
    event_at: &str,
    response_seconds: Option<u32>,
    snooze_minutes: Option<u32>,
    date: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO notification_events (
            notification_id, reminder_id, title, event_type, shown_at, event_at,
            response_seconds, snooze_minutes, date
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            notification_id as i64,
            reminder_id,
            title,
            event_type,
            shown_at,
            event_at,
            response_seconds,
            snooze_minutes,
            date
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn get_reminder_interaction_stats_by_period(
    conn: &Connection,
    period: &str,
    reference_date: &str,
) -> ReminderInteractionStats {
    let Some(key) = period_key(period, reference_date) else {
        return ReminderInteractionStats::default();
    };

    let (sql, filter_key) = match period {
        "day" => (
            "SELECT
                COALESCE(SUM(CASE WHEN event_type = 'shown' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN event_type = 'done' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN event_type = 'snooze' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN event_type = 'missed' THEN 1 ELSE 0 END), 0),
                AVG(response_seconds)
             FROM notification_events
             WHERE date = ?1",
            key.clone(),
        ),
        "month" => (
            "SELECT
                COALESCE(SUM(CASE WHEN event_type = 'shown' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN event_type = 'done' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN event_type = 'snooze' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN event_type = 'missed' THEN 1 ELSE 0 END), 0),
                AVG(response_seconds)
             FROM notification_events
             WHERE substr(date, 1, 7) = ?1",
            key.clone(),
        ),
        "year" => (
            "SELECT
                COALESCE(SUM(CASE WHEN event_type = 'shown' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN event_type = 'done' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN event_type = 'snooze' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN event_type = 'missed' THEN 1 ELSE 0 END), 0),
                AVG(response_seconds)
             FROM notification_events
             WHERE substr(date, 1, 4) = ?1",
            key.clone(),
        ),
        _ => return ReminderInteractionStats::default(),
    };

    let (shown, done, snoozed, missed, avg_response) = conn
        .query_row(sql, rusqlite::params![filter_key], |row| {
            Ok((
                row.get::<_, u32>(0)?,
                row.get::<_, u32>(1)?,
                row.get::<_, u32>(2)?,
                row.get::<_, u32>(3)?,
                row.get::<_, Option<f64>>(4)?,
            ))
        })
        .unwrap_or((0, 0, 0, 0, None));

    let ignored_streak = {
        let (streak_sql, streak_key) = match period {
            "day" => (
                "SELECT event_type
                 FROM notification_events
                 WHERE date = ?1 AND event_type IN ('done','snooze','missed')
                 ORDER BY event_at DESC, id DESC
                 LIMIT 50",
                key.clone(),
            ),
            "month" => (
                "SELECT event_type
                 FROM notification_events
                 WHERE substr(date, 1, 7) = ?1 AND event_type IN ('done','snooze','missed')
                 ORDER BY event_at DESC, id DESC
                 LIMIT 50",
                key.clone(),
            ),
            "year" => (
                "SELECT event_type
                 FROM notification_events
                 WHERE substr(date, 1, 4) = ?1 AND event_type IN ('done','snooze','missed')
                 ORDER BY event_at DESC, id DESC
                 LIMIT 50",
                key.clone(),
            ),
            _ => return ReminderInteractionStats::default(),
        };

        let mut streak = 0u32;
        if let Ok(mut stmt) = conn.prepare(streak_sql) {
            if let Ok(rows) = stmt.query_map(rusqlite::params![streak_key], |row| {
                row.get::<_, String>(0)
            }) {
                for item in rows.filter_map(|r| r.ok()) {
                    if item == "missed" {
                        streak += 1;
                    } else {
                        break;
                    }
                }
            }
        }
        streak
    };

    ReminderInteractionStats {
        shown,
        done,
        snoozed,
        missed,
        avg_response_seconds: avg_response.unwrap_or(0.0).round().max(0.0) as u32,
        ignored_streak,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seeded_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(
            "CREATE TABLE app_usage (
                app_name TEXT NOT NULL,
                date TEXT NOT NULL,
                focus_seconds INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (app_name, date)
            );
            CREATE TABLE daily_usage (
                date TEXT PRIMARY KEY,
                active_seconds INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE notification_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                notification_id INTEGER NOT NULL,
                reminder_id TEXT NOT NULL,
                title TEXT NOT NULL,
                event_type TEXT NOT NULL,
                shown_at TEXT NOT NULL,
                event_at TEXT NOT NULL,
                response_seconds INTEGER,
                snooze_minutes INTEGER,
                date TEXT NOT NULL
            );",
        )
        .expect("schema");

        conn.execute(
            "INSERT INTO daily_usage(date, active_seconds) VALUES
                ('2026-03-01', 3600),
                ('2026-03-02', 1800),
                ('2026-02-28', 600),
                ('2025-03-01', 7200)",
            [],
        )
        .expect("seed daily");

        conn.execute(
            "INSERT INTO app_usage(app_name, date, focus_seconds) VALUES
                ('Code.exe', '2026-03-01', 1800),
                ('chrome.exe', '2026-03-01', 1200),
                ('Code.exe', '2026-03-02', 600),
                ('tempo.exe', '2026-03-02', 300),
                ('chrome.exe', '2026-02-28', 1000),
                ('yearApp.exe', '2025-03-01', 5000)",
            [],
        )
        .expect("seed apps");

        conn
    }

    #[test]
    fn aggregates_active_minutes_by_period() {
        let conn = seeded_conn();
        assert_eq!(get_active_minutes_by_period(&conn, "day", "2026-03-01"), 60);
        assert_eq!(get_active_minutes_by_period(&conn, "month", "2026-03-15"), 90);
        assert_eq!(get_active_minutes_by_period(&conn, "year", "2026-08-12"), 100);
    }

    #[test]
    fn aggregates_top_apps_by_period() {
        let conn = seeded_conn();
        let month = get_top_apps_by_period(&conn, "month", "2026-03-15", 3);
        assert_eq!(month.len(), 3);
        assert_eq!(month[0].app_name, "Code.exe");
        assert_eq!(month[0].focus_seconds, 2400);
        assert_eq!(month[1].app_name, "chrome.exe");
        assert_eq!(month[1].focus_seconds, 1200);

        let year = get_top_apps_by_period(&conn, "year", "2026-08-12", 3);
        assert_eq!(year.len(), 3);
        assert_eq!(year[0].app_name, "Code.exe");
        assert_eq!(year[0].focus_seconds, 2400);
        assert_eq!(year[1].app_name, "chrome.exe");
        assert_eq!(year[1].focus_seconds, 2200);
    }

    #[test]
    fn aggregates_reminder_interaction_stats() {
        let conn = seeded_conn();
        conn.execute(
            "INSERT INTO notification_events(
                notification_id, reminder_id, title, event_type, shown_at, event_at,
                response_seconds, snooze_minutes, date
            ) VALUES
                (1, 'r1', '喝水', 'shown',  '2026-03-02 09:00:00', '2026-03-02 09:00:00', NULL, NULL, '2026-03-02'),
                (1, 'r1', '喝水', 'done',   '2026-03-02 09:00:00', '2026-03-02 09:00:15', 15, NULL, '2026-03-02'),
                (2, 'r2', '走走', 'shown',  '2026-03-02 10:00:00', '2026-03-02 10:00:00', NULL, NULL, '2026-03-02'),
                (2, 'r2', '走走', 'snooze', '2026-03-02 10:00:00', '2026-03-02 10:00:40', 40, 5, '2026-03-02'),
                (3, 'r3', '休息', 'shown',  '2026-03-02 11:00:00', '2026-03-02 11:00:00', NULL, NULL, '2026-03-02'),
                (3, 'r3', '休息', 'missed', '2026-03-02 11:00:00', '2026-03-02 11:01:00', 60, NULL, '2026-03-02'),
                (4, 'r4', '复盘', 'shown',  '2026-03-02 12:00:00', '2026-03-02 12:00:00', NULL, NULL, '2026-03-02'),
                (4, 'r4', '复盘', 'missed', '2026-03-02 12:00:00', '2026-03-02 12:00:55', 55, NULL, '2026-03-02')",
            [],
        )
        .expect("seed notification events");

        let stats = get_reminder_interaction_stats_by_period(&conn, "day", "2026-03-02");
        assert_eq!(stats.shown, 4);
        assert_eq!(stats.done, 1);
        assert_eq!(stats.snoozed, 1);
        assert_eq!(stats.missed, 2);
        assert_eq!(stats.ignored_streak, 2);
        assert!(stats.avg_response_seconds >= 40);
    }

    #[test]
    fn reminder_interaction_stats_respect_selected_period() {
        let conn = seeded_conn();
        conn.execute(
            "INSERT INTO notification_events(
                notification_id, reminder_id, title, event_type, shown_at, event_at,
                response_seconds, snooze_minutes, date
            ) VALUES
                (11, 'r1', '喝水', 'shown',  '2026-03-10 09:00:00', '2026-03-10 09:00:00', NULL, NULL, '2026-03-10'),
                (11, 'r1', '喝水', 'done',   '2026-03-10 09:00:00', '2026-03-10 09:00:30', 30, NULL, '2026-03-10'),
                (12, 'r2', '走走', 'shown',  '2026-03-12 10:00:00', '2026-03-12 10:00:00', NULL, NULL, '2026-03-12'),
                (12, 'r2', '走走', 'missed', '2026-03-12 10:00:00', '2026-03-12 10:00:20', 20, NULL, '2026-03-12'),
                (13, 'r3', '休息', 'shown',  '2026-04-01 08:00:00', '2026-04-01 08:00:00', NULL, NULL, '2026-04-01'),
                (13, 'r3', '休息', 'missed', '2026-04-01 08:00:00', '2026-04-01 08:01:00', 60, NULL, '2026-04-01')",
            [],
        )
        .expect("seed period-scoped notification events");

        let march = get_reminder_interaction_stats_by_period(&conn, "month", "2026-03-20");
        assert_eq!(march.shown, 2);
        assert_eq!(march.done, 1);
        assert_eq!(march.missed, 1);
        assert_eq!(march.avg_response_seconds, 25);

        let year = get_reminder_interaction_stats_by_period(&conn, "year", "2026-09-01");
        assert_eq!(year.shown, 3);
        assert_eq!(year.done, 1);
        assert_eq!(year.missed, 2);
    }
}
