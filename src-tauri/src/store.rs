use crate::database::Database;
use crate::services::{ProxyService, UsageCache};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// 全局应用状态
pub struct AppState {
    pub db: Arc<Database>,
    pub proxy_service: ProxyService,
    main_window_destroy_generation: AtomicU64,
    pub usage_cache: Arc<UsageCache>,
}

impl AppState {
    /// 创建新的应用状态
    pub fn new(db: Arc<Database>) -> Self {
        let proxy_service = ProxyService::new(db.clone());

        Self {
            db,
            proxy_service,
            main_window_destroy_generation: AtomicU64::new(0),
            usage_cache: Arc::new(UsageCache::new()),
        }
    }

    pub fn next_main_window_destroy_generation(&self) -> u64 {
        self.main_window_destroy_generation
            .fetch_add(1, Ordering::SeqCst)
            + 1
    }

    pub fn is_main_window_destroy_generation_current(&self, generation: u64) -> bool {
        self.main_window_destroy_generation.load(Ordering::SeqCst) == generation
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::AppState;
    use crate::database::Database;

    fn test_state() -> AppState {
        AppState::new(Arc::new(Database::memory().expect("memory db")))
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
