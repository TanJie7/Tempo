use std::sync::atomic::{AtomicBool, Ordering};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

static IS_IDLE: AtomicBool = AtomicBool::new(false);

pub fn get_idle_seconds() -> u32 {
    unsafe {
        let mut info = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };
        if GetLastInputInfo(&mut info) != 0 {
            let tick_count = windows_sys::Win32::System::SystemInformation::GetTickCount();
            (tick_count.wrapping_sub(info.dwTime)) / 1000
        } else {
            0
        }
    }
}

pub fn is_idle() -> bool {
    IS_IDLE.load(Ordering::Relaxed)
}

pub fn update_idle_state(timeout_minutes: u32) {
    let idle_secs = get_idle_seconds();
    let threshold = timeout_minutes * 60;
    IS_IDLE.store(idle_secs >= threshold, Ordering::Relaxed);
}
