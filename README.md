<div align="center">

# Tempo

A lightweight Windows desktop reminder & time management tool.

轻量级 Windows 桌面提醒与时间管理工具。

[![Windows](https://img.shields.io/badge/platform-Windows%2011-0078D4?logo=windows11)](https://github.com/TanJie7/Tempo)
[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri)](https://v2.tauri.app/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

## Features

- **Interval & Scheduled Reminders** — e.g. "Drink water every 50 min", "Walk at 8:00 AM daily"
- **Rest Periods** — Pause all reminders during configured rest times
- **Idle Detection** — Auto-pause when keyboard/mouse inactive (customizable threshold)
- **Notification Popup** — Animated slide-in card at bottom-left of primary monitor
- **System Tray** — Runs in background, minimize to tray on close
- **Auto Start** — Optional Windows startup via Registry
- **Usage Tracking** — Daily active time, per-app focus time (opt-in)

## Screenshot

> *Coming soon*

## Getting Started

### Prerequisites

| Dependency | Install |
|---|---|
| Node.js >= 18 | [nodejs.org](https://nodejs.org/) |
| Rust toolchain | [rustup.rs](https://rustup.rs/) |
| Visual Studio Build Tools | [C++ workload](https://visualstudio.microsoft.com/visual-cpp-build-tools/) |

### Development

```bash
# Install dependencies
npm install

# Run in dev mode (hot reload)
npx tauri dev

# Build for production
npx tauri build
```

Build output: `src-tauri/target/release/Tempo.exe`

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Tauri v2 |
| Backend | Rust |
| Frontend | React 18 · TypeScript · Tailwind CSS v4 |
| Animation | Framer Motion |
| State | Zustand |
| Storage | JSON (config) · SQLite (usage data) |

## Project Structure

```
src/                      # Frontend (React)
├── components/
│   ├── settings/         # Reminder & rest period management
│   ├── notification/     # Popup notification UI
│   ├── dashboard/        # Usage statistics
│   └── ui/               # Shared UI components
├── stores/               # Zustand state management
└── types/                # TypeScript definitions

src-tauri/src/            # Backend (Rust)
├── lib.rs                # Tauri commands & app setup
├── config.rs             # Config read/write (data/config.json)
├── reminder.rs           # Reminder scheduling engine
├── idle.rs               # Idle detection (Win32 API)
├── autostart.rs          # Windows Registry auto-start
└── monitor.rs            # Foreground app tracking (Win32 API)
```

## License

[MIT](LICENSE)
