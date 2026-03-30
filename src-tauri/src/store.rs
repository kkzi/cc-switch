use crate::database::Database;
use crate::deeplink::{DeepLinkImportRequest, PendingDeepLinkError};
use crate::services::ProxyService;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

/// 全局应用状态
pub struct AppState {
    pub db: Arc<Database>,
    pub proxy_service: ProxyService,
    main_window_ready: AtomicBool,
    main_window_destroy_generation: AtomicU64,
    pending_deeplink: Mutex<Option<DeepLinkImportRequest>>,
    pending_deeplink_error: Mutex<Option<PendingDeepLinkError>>,
}

impl AppState {
    /// 创建新的应用状态
    pub fn new(db: Arc<Database>) -> Self {
        let proxy_service = ProxyService::new(db.clone());

        Self {
            db,
            proxy_service,
            main_window_ready: AtomicBool::new(false),
            main_window_destroy_generation: AtomicU64::new(0),
            pending_deeplink: Mutex::new(None),
            pending_deeplink_error: Mutex::new(None),
        }
    }

    pub fn is_main_window_ready(&self) -> bool {
        self.main_window_ready.load(Ordering::SeqCst)
    }

    pub fn set_main_window_ready(&self, ready: bool) {
        self.main_window_ready.store(ready, Ordering::SeqCst);
    }

    pub fn next_main_window_destroy_generation(&self) -> u64 {
        self.main_window_destroy_generation
            .fetch_add(1, Ordering::SeqCst)
            + 1
    }

    pub fn is_main_window_destroy_generation_current(&self, generation: u64) -> bool {
        self.main_window_destroy_generation.load(Ordering::SeqCst) == generation
    }

    pub fn set_pending_deeplink(&self, request: DeepLinkImportRequest) {
        *self
            .pending_deeplink
            .lock()
            .unwrap_or_else(|e| e.into_inner()) = Some(request);
    }

    pub fn take_pending_deeplink(&self) -> Option<DeepLinkImportRequest> {
        self.pending_deeplink
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .take()
    }

    pub fn clear_pending_deeplink(&self) {
        *self
            .pending_deeplink
            .lock()
            .unwrap_or_else(|e| e.into_inner()) = None;
    }

    pub fn set_pending_deeplink_error(&self, error: PendingDeepLinkError) {
        *self
            .pending_deeplink_error
            .lock()
            .unwrap_or_else(|e| e.into_inner()) = Some(error);
    }

    pub fn take_pending_deeplink_error(&self) -> Option<PendingDeepLinkError> {
        self.pending_deeplink_error
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .take()
    }

    pub fn clear_pending_deeplink_error(&self) {
        *self
            .pending_deeplink_error
            .lock()
            .unwrap_or_else(|e| e.into_inner()) = None;
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::AppState;
    use crate::{database::Database, deeplink::DeepLinkImportRequest};

    fn test_state() -> AppState {
        AppState::new(Arc::new(Database::memory().expect("memory db")))
    }

    #[test]
    fn main_window_ready_flag_round_trips() {
        let state = test_state();
        assert!(!state.is_main_window_ready());

        state.set_main_window_ready(true);
        assert!(state.is_main_window_ready());

        state.set_main_window_ready(false);
        assert!(!state.is_main_window_ready());
    }

    #[test]
    fn pending_deeplink_round_trips_once() {
        let state = test_state();
        let request = DeepLinkImportRequest {
            version: "v1".into(),
            resource: "provider".into(),
            app: Some("claude".into()),
            name: Some("demo".into()),
            enabled: None,
            homepage: None,
            endpoint: None,
            api_key: None,
            icon: None,
            model: None,
            notes: None,
            haiku_model: None,
            sonnet_model: None,
            opus_model: None,
            content: None,
            description: None,
            apps: None,
            repo: None,
            directory: None,
            branch: None,
            config: None,
            config_format: None,
            config_url: None,
            usage_enabled: None,
            usage_script: None,
            usage_api_key: None,
            usage_base_url: None,
            usage_access_token: None,
            usage_user_id: None,
            usage_auto_interval: None,
        };

        state.set_pending_deeplink(request.clone());

        let first = state.take_pending_deeplink().expect("pending deeplink");
        assert_eq!(first.resource, request.resource);
        assert_eq!(first.app, request.app);
        assert_eq!(first.name, request.name);
        assert!(state.take_pending_deeplink().is_none());
    }

    #[test]
    fn main_window_destroy_generation_invalidates_older_tokens() {
        let state = test_state();

        let first = state.next_main_window_destroy_generation();
        let second = state.next_main_window_destroy_generation();

        assert!(state.is_main_window_destroy_generation_current(second));
        assert!(!state.is_main_window_destroy_generation_current(first));
    }
}
