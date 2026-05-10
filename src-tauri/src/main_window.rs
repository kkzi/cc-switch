use tauri::{image::Image, AppHandle, Manager, Runtime, WebviewUrl};

#[cfg(target_os = "macos")]
use crate::tray;
use crate::{error::AppError, store::AppState};

pub const MAIN_WINDOW_LABEL: &str = "main";
const MAIN_WINDOW_DESTROY_DELAY_MS: u64 = 3_000;

fn main_window_title() -> &'static str {
    "cc-switch"
}

trait MainWindowIconBuilder: Sized {
    fn icon(self, icon: Image<'static>) -> Result<Self, AppError>;
}

impl<'a, R: Runtime, M: Manager<R>> MainWindowIconBuilder for tauri::WebviewWindowBuilder<'a, R, M> {
    fn icon(self, icon: Image<'static>) -> Result<Self, AppError> {
        self.icon(icon)
            .map_err(|e| AppError::Message(format!("设置主窗口图标失败: {e}")))
    }
}

fn apply_default_window_icon<B: MainWindowIconBuilder>(
    builder: B,
    icon: Option<Image<'static>>,
) -> Result<B, AppError> {
    match icon {
        Some(icon) => builder.icon(icon),
        None => Ok(builder),
    }
}

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
        .title(main_window_title())
        .inner_size(1000.0, 650.0)
        .min_inner_size(900.0, 600.0)
        .visible(false)
        .resizable(true)
        .fullscreen(false)
        .center();
    let builder = apply_default_window_icon(
        builder,
        app.default_window_icon().cloned().map(|icon| icon.to_owned()),
    )?;
    #[cfg(target_os = "macos")]
    let builder = builder.title_bar_style(tauri::TitleBarStyle::Overlay);

    let window = builder
        .build()
        .map_err(|e| AppError::Message(format!("创建主窗口失败: {e}")))?;

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
    use super::{
        apply_default_window_icon, main_window_title, resolve_toggle_main_window_action,
        MainWindowIconBuilder, ToggleMainWindowAction,
    };
    use crate::AppError;
    use tauri::image::Image;

    #[derive(Default)]
    struct RecordingBuilder {
        icon_called: bool,
    }

    impl MainWindowIconBuilder for RecordingBuilder {
        fn icon(self, _icon: Image<'static>) -> Result<Self, AppError> {
            Ok(Self { icon_called: true })
        }
    }

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

    #[test]
    fn apply_default_icon_calls_builder_when_icon_exists() {
        let builder = RecordingBuilder::default();
        let icon = Image::new_owned(Vec::new(), 1, 1);

        let result = apply_default_window_icon(builder, Some(icon)).unwrap();

        assert!(result.icon_called);
    }

    #[test]
    fn apply_default_icon_skips_builder_when_icon_missing() {
        let builder = RecordingBuilder::default();

        let result = apply_default_window_icon(builder, None).unwrap();

        assert!(!result.icon_called);
    }

    #[test]
    fn main_window_uses_cc_switch_title() {
        assert_eq!(main_window_title(), "cc-switch");
    }
}
