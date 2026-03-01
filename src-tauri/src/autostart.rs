use winreg::enums::*;
use winreg::RegKey;

const APP_NAME: &str = "Tempo";

pub fn set_auto_start(enabled: bool) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let run_key = hkcu
        .open_subkey_with_flags(
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            KEY_SET_VALUE | KEY_READ,
        )
        .map_err(|e| e.to_string())?;

    if enabled {
        let exe_path = std::env::current_exe()
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .to_string();
        run_key
            .set_value(APP_NAME, &format!("\"{}\" --minimized", exe_path))
            .map_err(|e| e.to_string())?;
    } else {
        // Ignore error if key doesn't exist
        let _ = run_key.delete_value(APP_NAME);
    }

    Ok(())
}

pub fn is_auto_start_enabled() -> bool {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(run_key) = hkcu.open_subkey_with_flags(
        r"Software\Microsoft\Windows\CurrentVersion\Run",
        KEY_READ,
    ) {
        run_key.get_value::<String, _>(APP_NAME).is_ok()
    } else {
        false
    }
}
