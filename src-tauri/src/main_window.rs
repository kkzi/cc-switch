use tauri::{AppHandle, Manager, WebviewUrl};

#[cfg(target_os = "macos")]
use crate::tray;
use crate::{error::AppError, store::AppState};

pub const MAIN_WINDOW_LABEL: &str = "main";
const MAIN_WINDOW_DESTROY_DELAY_MS: u64 = 3_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToggleMainWindowAction {
    CreateOrFocus,
    RevealExisting,
    HideThenDestroy,
}

pub fn resolve_toggle_main_window_action(
    window_exists: bool,
    window_visible: bool,
) -> ToggleMainWindowAction {
    if !window_exists {
        return ToggleMainWindowAction::CreateOrFocus;
    }

    if window_visible {
        ToggleMainWindowAction::HideThenDestroy
    } else {
        ToggleMainWindowAction::RevealExisting
    }
}

pub fn ensure_main_window(
    app: &AppHandle,
    show_and_focus: bool,
) -> Result<tauri::WebviewWindow, AppError> {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        if show_and_focus {
            reveal_main_window(app, &window);
        }
        return Ok(window);
    }

    let builder = tauri::WebviewWindowBuilder::new(app, MAIN_WINDOW_LABEL, WebviewUrl::default())
        .title("")
        .inner_size(1000.0, 650.0)
        .min_inner_size(900.0, 600.0)
        .visible(false)
        .resizable(true)
        .fullscreen(false)
        .center();
    #[cfg(target_os = "macos")]
    let builder = builder.title_bar_style(tauri::TitleBarStyle::Overlay);

    let window = builder
        .build()
        .map_err(|e| AppError::Message(format!("创建主窗口失败: {e}")))?;

    if let Some(state) = app.try_state::<AppState>() {
        state.set_main_window_ready(false);
    }

    apply_linux_webview_workaround(&window);

    if show_and_focus {
        reveal_main_window(app, &window);
    }

    Ok(window)
}

pub fn spawn_show_main_window(app: AppHandle) {
    std::thread::spawn(move || {
        if let Err(err) = ensure_main_window(&app, true) {
            log::error!("创建或显示主窗口失败: {err}");
        }
    });
}

pub fn reveal_main_window(_app: &AppHandle, window: &tauri::WebviewWindow) {
    cancel_pending_main_window_destroy(_app);

    #[cfg(target_os = "windows")]
    {
        let _ = window.set_skip_taskbar(false);
    }

    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();

    #[cfg(target_os = "macos")]
    {
        tray::apply_tray_policy(_app, true);
    }
}

pub fn hide_then_schedule_main_window_destroy(app: &AppHandle) -> Result<(), AppError> {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return Ok(());
    };

    let generation = cancel_pending_main_window_destroy(app);

    let _ = window.hide();

    #[cfg(target_os = "windows")]
    {
        let _ = window.set_skip_taskbar(true);
    }

    #[cfg(target_os = "macos")]
    {
        tray::apply_tray_policy(app, false);
    }

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(
            MAIN_WINDOW_DESTROY_DELAY_MS,
        ))
        .await;

        let Some(state) = app_handle.try_state::<AppState>() else {
            return;
        };

        if !state.is_main_window_destroy_generation_current(generation) {
            return;
        }

        let Some(window) = app_handle.get_webview_window(MAIN_WINDOW_LABEL) else {
            return;
        };

        if matches!(window.is_visible(), Ok(true)) {
            return;
        }

        if let Err(err) = destroy_main_window(&app_handle) {
            log::error!("延时销毁主窗口失败: {err}");
        }
    });

    Ok(())
}

pub fn destroy_main_window(app: &AppHandle) -> Result<(), AppError> {
    cancel_pending_main_window_destroy(app);

    if let Some(state) = app.try_state::<AppState>() {
        state.set_main_window_ready(false);
    }

    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        #[cfg(target_os = "macos")]
        {
            tray::apply_tray_policy(app, false);
        }

        window
            .destroy()
            .map_err(|e| AppError::Message(format!("销毁主窗口失败: {e}")))?;
    }

    Ok(())
}

fn cancel_pending_main_window_destroy(app: &AppHandle) -> u64 {
    app.try_state::<AppState>()
        .map(|state| state.next_main_window_destroy_generation())
        .unwrap_or(0)
}

fn apply_linux_webview_workaround(_window: &tauri::WebviewWindow) {
    #[cfg(target_os = "linux")]
    {
        let _ = _window.with_webview(|webview| {
            use webkit2gtk::{HardwareAccelerationPolicy, SettingsExt, WebViewExt};

            let wk_webview = webview.inner();
            if let Some(settings) = WebViewExt::settings(&wk_webview) {
                SettingsExt::set_hardware_acceleration_policy(
                    &settings,
                    HardwareAccelerationPolicy::Never,
                );
                log::info!("已禁用 WebKitGTK 硬件加速");
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::{resolve_toggle_main_window_action, ToggleMainWindowAction};

    #[test]
    fn toggle_action_creates_when_window_absent() {
        assert_eq!(
            resolve_toggle_main_window_action(false, false),
            ToggleMainWindowAction::CreateOrFocus
        );
    }

    #[test]
    fn toggle_action_hides_when_window_visible() {
        assert_eq!(
            resolve_toggle_main_window_action(true, true),
            ToggleMainWindowAction::HideThenDestroy
        );
    }

    #[test]
    fn toggle_action_reveals_existing_hidden_window() {
        assert_eq!(
            resolve_toggle_main_window_action(true, false),
            ToggleMainWindowAction::RevealExisting
        );
    }
}
