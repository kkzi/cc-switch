use crate::app_config::AppType;
use crate::database::Database;
use crate::provider::Provider;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ProviderAdminView {
    pub id: String,
    pub name: String,
    pub url: String,
    pub key: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProviderAdminUpdate {
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub key: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProviderAdminError {
    InvalidApp(String),
    ProviderNotFound {
        app_type: String,
        provider_id: String,
    },
    Database(String),
    InvalidConfig(String),
}

impl ProviderAdminError {
    fn status_code(&self) -> StatusCode {
        match self {
            ProviderAdminError::InvalidApp(_) => StatusCode::BAD_REQUEST,
            ProviderAdminError::ProviderNotFound { .. } => StatusCode::NOT_FOUND,
            ProviderAdminError::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ProviderAdminError::InvalidConfig(_) => StatusCode::BAD_REQUEST,
        }
    }
}

impl std::fmt::Display for ProviderAdminError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProviderAdminError::InvalidApp(app) => write!(f, "unsupported app: {app}"),
            ProviderAdminError::ProviderNotFound {
                app_type,
                provider_id,
            } => write!(f, "provider not found: {app_type}/{provider_id}"),
            ProviderAdminError::Database(message) => write!(f, "database error: {message}"),
            ProviderAdminError::InvalidConfig(message) => {
                write!(f, "invalid provider config: {message}")
            }
        }
    }
}

impl IntoResponse for ProviderAdminError {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let body = json!({
            "error": {
                "message": self.to_string(),
                "type": "provider_admin_error",
            }
        });
        (status, Json(body)).into_response()
    }
}

pub fn parse_admin_app(app: &str) -> Result<AppType, ProviderAdminError> {
    app.parse::<AppType>()
        .map_err(|_| ProviderAdminError::InvalidApp(app.to_string()))
}

pub fn get_provider_admin_view(
    db: &Database,
    app_type: &AppType,
    provider_id: &str,
) -> Result<ProviderAdminView, ProviderAdminError> {
    let provider = db
        .get_provider_by_id(provider_id, app_type.as_str())
        .map_err(|e| ProviderAdminError::Database(e.to_string()))?
        .ok_or_else(|| ProviderAdminError::ProviderNotFound {
            app_type: app_type.as_str().to_string(),
            provider_id: provider_id.to_string(),
        })?;

    Ok(provider_admin_view(app_type, &provider))
}

pub fn list_provider_admin_views(
    db: &Database,
    app_type: &AppType,
) -> Result<Vec<ProviderAdminView>, ProviderAdminError> {
    let providers = db
        .get_all_providers(app_type.as_str())
        .map_err(|e| ProviderAdminError::Database(e.to_string()))?;

    Ok(providers
        .values()
        .map(|provider| provider_admin_view(app_type, provider))
        .collect())
}

pub fn update_provider_admin(
    db: &Database,
    app_type: &AppType,
    provider_id: &str,
    update: ProviderAdminUpdate,
) -> Result<ProviderAdminView, ProviderAdminError> {
    let mut provider = db
        .get_provider_by_id(provider_id, app_type.as_str())
        .map_err(|e| ProviderAdminError::Database(e.to_string()))?
        .ok_or_else(|| ProviderAdminError::ProviderNotFound {
            app_type: app_type.as_str().to_string(),
            provider_id: provider_id.to_string(),
        })?;

    if let Some(url) = update.url {
        set_provider_url(app_type, &mut provider.settings_config, url.trim())?;
    }

    if let Some(key) = update.key {
        set_provider_key(app_type, &mut provider, key.trim())?;
    }

    db.update_provider_settings_config(app_type.as_str(), provider_id, &provider.settings_config)
        .map_err(|e| ProviderAdminError::Database(e.to_string()))?;

    Ok(provider_admin_view(app_type, &provider))
}

fn provider_admin_view(app_type: &AppType, provider: &Provider) -> ProviderAdminView {
    ProviderAdminView {
        id: provider.id.clone(),
        name: provider.name.clone(),
        url: extract_provider_url(app_type, &provider.settings_config).unwrap_or_default(),
        key: extract_provider_key(app_type, &provider.settings_config).unwrap_or_default(),
    }
}

fn extract_provider_url(app_type: &AppType, settings: &Value) -> Option<String> {
    match app_type {
        AppType::Claude | AppType::ClaudeDesktop => get_env_string(settings, "ANTHROPIC_BASE_URL")
            .or_else(|| get_direct_string(settings, "base_url"))
            .or_else(|| get_direct_string(settings, "baseURL"))
            .or_else(|| get_direct_string(settings, "apiEndpoint")),
        AppType::Codex => get_env_string(settings, "OPENAI_BASE_URL")
            .or_else(|| get_direct_string(settings, "base_url"))
            .or_else(|| get_direct_string(settings, "baseURL"))
            .or_else(|| get_config_object_string(settings, "base_url"))
            .or_else(|| get_config_text(settings).and_then(extract_codex_base_url_from_toml)),
        AppType::Gemini => get_env_string(settings, "GOOGLE_GEMINI_BASE_URL")
            .or_else(|| get_direct_string(settings, "base_url"))
            .or_else(|| get_direct_string(settings, "baseURL")),
        AppType::OpenCode => get_nested_string(settings, &["options", "baseURL"])
            .or_else(|| get_direct_string(settings, "baseURL"))
            .or_else(|| get_direct_string(settings, "base_url")),
        AppType::OpenClaw => get_direct_string(settings, "baseUrl")
            .or_else(|| get_direct_string(settings, "base_url"))
            .or_else(|| get_direct_string(settings, "baseURL")),
        AppType::Hermes => get_direct_string(settings, "base_url")
            .or_else(|| get_direct_string(settings, "baseURL"))
            .or_else(|| get_direct_string(settings, "baseUrl")),
    }
}

fn extract_provider_key(app_type: &AppType, settings: &Value) -> Option<String> {
    match app_type {
        AppType::Claude | AppType::ClaudeDesktop => {
            first_env_string(
                settings,
                &[
                    "ANTHROPIC_AUTH_TOKEN",
                    "ANTHROPIC_API_KEY",
                    "OPENROUTER_API_KEY",
                    "OPENAI_API_KEY",
                    "GEMINI_API_KEY",
                ],
            )
            .or_else(|| get_direct_string(settings, "apiKey"))
            .or_else(|| get_direct_string(settings, "api_key"))
        }
        AppType::Codex => get_env_string(settings, "OPENAI_API_KEY")
            .or_else(|| get_nested_string(settings, &["auth", "OPENAI_API_KEY"]))
            .or_else(|| get_direct_string(settings, "apiKey"))
            .or_else(|| get_direct_string(settings, "api_key"))
            .or_else(|| get_config_object_string(settings, "api_key"))
            .or_else(|| get_config_object_string(settings, "apiKey"))
            .or_else(|| {
                get_config_text(settings)
                    .and_then(crate::codex_config::extract_codex_experimental_bearer_token)
            }),
        AppType::Gemini => get_env_string(settings, "GEMINI_API_KEY")
            .or_else(|| get_direct_string(settings, "apiKey"))
            .or_else(|| get_direct_string(settings, "api_key")),
        AppType::OpenCode => get_nested_string(settings, &["options", "apiKey"])
            .or_else(|| get_direct_string(settings, "apiKey"))
            .or_else(|| get_direct_string(settings, "api_key")),
        AppType::OpenClaw => get_direct_string(settings, "apiKey")
            .or_else(|| get_direct_string(settings, "api_key")),
        AppType::Hermes => get_direct_string(settings, "api_key")
            .or_else(|| get_direct_string(settings, "apiKey")),
    }
}

fn set_provider_url(
    app_type: &AppType,
    settings: &mut Value,
    url: &str,
) -> Result<(), ProviderAdminError> {
    match app_type {
        AppType::Claude | AppType::ClaudeDesktop => {
            if has_env_key(settings, "ANTHROPIC_BASE_URL") {
                set_env_string(settings, "ANTHROPIC_BASE_URL", url);
            } else if has_direct_key(settings, "base_url") {
                set_direct_string(settings, "base_url", url);
            } else if has_direct_key(settings, "baseURL") {
                set_direct_string(settings, "baseURL", url);
            } else if has_direct_key(settings, "apiEndpoint") {
                set_direct_string(settings, "apiEndpoint", url);
            } else {
                set_env_string(settings, "ANTHROPIC_BASE_URL", url);
            }
        }
        AppType::Codex => {
            if has_env_key(settings, "OPENAI_BASE_URL") {
                set_env_string(settings, "OPENAI_BASE_URL", url);
            } else if has_direct_key(settings, "base_url") {
                set_direct_string(settings, "base_url", url);
            } else if has_direct_key(settings, "baseURL") {
                set_direct_string(settings, "baseURL", url);
            } else if has_config_object_key(settings, "base_url") {
                set_config_object_string(settings, "base_url", url);
            } else if let Some(config_text) = get_config_text(settings) {
                let updated =
                    crate::codex_config::update_codex_toml_field(config_text, "base_url", url)
                        .map_err(ProviderAdminError::InvalidConfig)?;
                set_direct_string(settings, "config", &updated);
            } else {
                set_direct_string(settings, "base_url", url);
            }
        }
        AppType::Gemini => {
            if has_env_key(settings, "GOOGLE_GEMINI_BASE_URL") {
                set_env_string(settings, "GOOGLE_GEMINI_BASE_URL", url);
            } else if has_direct_key(settings, "base_url") {
                set_direct_string(settings, "base_url", url);
            } else if has_direct_key(settings, "baseURL") {
                set_direct_string(settings, "baseURL", url);
            } else {
                set_env_string(settings, "GOOGLE_GEMINI_BASE_URL", url);
            }
        }
        AppType::OpenCode => {
            if has_nested_key(settings, &["options", "baseURL"]) {
                set_nested_string(settings, &["options", "baseURL"], url);
            } else if has_direct_key(settings, "baseURL") {
                set_direct_string(settings, "baseURL", url);
            } else if has_direct_key(settings, "base_url") {
                set_direct_string(settings, "base_url", url);
            } else {
                set_nested_string(settings, &["options", "baseURL"], url);
            }
        }
        AppType::OpenClaw => {
            if has_direct_key(settings, "baseUrl") {
                set_direct_string(settings, "baseUrl", url);
            } else if has_direct_key(settings, "base_url") {
                set_direct_string(settings, "base_url", url);
            } else if has_direct_key(settings, "baseURL") {
                set_direct_string(settings, "baseURL", url);
            } else {
                set_direct_string(settings, "baseUrl", url);
            }
        }
        AppType::Hermes => {
            if has_direct_key(settings, "base_url") {
                set_direct_string(settings, "base_url", url);
            } else if has_direct_key(settings, "baseURL") {
                set_direct_string(settings, "baseURL", url);
            } else if has_direct_key(settings, "baseUrl") {
                set_direct_string(settings, "baseUrl", url);
            } else {
                set_direct_string(settings, "base_url", url);
            }
        }
    }

    Ok(())
}

fn set_provider_key(
    app_type: &AppType,
    provider: &mut Provider,
    key: &str,
) -> Result<(), ProviderAdminError> {
    let settings = &mut provider.settings_config;

    match app_type {
        AppType::Claude | AppType::ClaudeDesktop => {
            let env_keys = [
                "ANTHROPIC_AUTH_TOKEN",
                "ANTHROPIC_API_KEY",
                "OPENROUTER_API_KEY",
                "OPENAI_API_KEY",
                "GEMINI_API_KEY",
            ];
            if let Some(existing_key) = env_keys.iter().find(|name| has_env_key(settings, name)) {
                set_env_string(settings, existing_key, key);
            } else if has_direct_key(settings, "apiKey") {
                set_direct_string(settings, "apiKey", key);
            } else if has_direct_key(settings, "api_key") {
                set_direct_string(settings, "api_key", key);
            } else {
                let default_key = provider
                    .meta
                    .as_ref()
                    .and_then(|meta| meta.api_key_field.as_deref())
                    .unwrap_or("ANTHROPIC_AUTH_TOKEN");
                set_env_string(settings, default_key, key);
            }
        }
        AppType::Codex => {
            if has_env_key(settings, "OPENAI_API_KEY") {
                set_env_string(settings, "OPENAI_API_KEY", key);
            } else if has_nested_key(settings, &["auth", "OPENAI_API_KEY"])
                || settings.get("auth").is_some()
            {
                set_nested_string(settings, &["auth", "OPENAI_API_KEY"], key);
            } else if has_direct_key(settings, "apiKey") {
                set_direct_string(settings, "apiKey", key);
            } else if has_direct_key(settings, "api_key") {
                set_direct_string(settings, "api_key", key);
            } else if has_config_object_key(settings, "api_key") {
                set_config_object_string(settings, "api_key", key);
            } else if has_config_object_key(settings, "apiKey") {
                set_config_object_string(settings, "apiKey", key);
            } else {
                set_nested_string(settings, &["auth", "OPENAI_API_KEY"], key);
            }
        }
        AppType::Gemini => {
            if has_env_key(settings, "GEMINI_API_KEY") {
                set_env_string(settings, "GEMINI_API_KEY", key);
            } else if has_direct_key(settings, "apiKey") {
                set_direct_string(settings, "apiKey", key);
            } else if has_direct_key(settings, "api_key") {
                set_direct_string(settings, "api_key", key);
            } else {
                set_env_string(settings, "GEMINI_API_KEY", key);
            }
        }
        AppType::OpenCode => {
            if has_nested_key(settings, &["options", "apiKey"]) {
                set_nested_string(settings, &["options", "apiKey"], key);
            } else if has_direct_key(settings, "apiKey") {
                set_direct_string(settings, "apiKey", key);
            } else if has_direct_key(settings, "api_key") {
                set_direct_string(settings, "api_key", key);
            } else {
                set_nested_string(settings, &["options", "apiKey"], key);
            }
        }
        AppType::OpenClaw => {
            if has_direct_key(settings, "apiKey") {
                set_direct_string(settings, "apiKey", key);
            } else if has_direct_key(settings, "api_key") {
                set_direct_string(settings, "api_key", key);
            } else {
                set_direct_string(settings, "apiKey", key);
            }
        }
        AppType::Hermes => {
            if has_direct_key(settings, "api_key") {
                set_direct_string(settings, "api_key", key);
            } else if has_direct_key(settings, "apiKey") {
                set_direct_string(settings, "apiKey", key);
            } else {
                set_direct_string(settings, "api_key", key);
            }
        }
    }

    Ok(())
}

fn get_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(ToString::to_string)
}

fn get_direct_string(settings: &Value, key: &str) -> Option<String> {
    get_string(settings.get(key))
}

fn get_env_string(settings: &Value, key: &str) -> Option<String> {
    get_string(settings.get("env").and_then(|env| env.get(key)))
}

fn first_env_string(settings: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| get_env_string(settings, key))
}

fn get_config_object_string(settings: &Value, key: &str) -> Option<String> {
    get_string(settings.get("config").and_then(|config| config.get(key)))
}

fn get_config_text(settings: &Value) -> Option<&str> {
    settings.get("config").and_then(Value::as_str)
}

fn get_nested_string(settings: &Value, path: &[&str]) -> Option<String> {
    let mut current = settings;
    for segment in path {
        current = current.get(*segment)?;
    }
    get_string(Some(current))
}

fn has_direct_key(settings: &Value, key: &str) -> bool {
    settings.get(key).is_some()
}

fn has_env_key(settings: &Value, key: &str) -> bool {
    settings.get("env").and_then(|env| env.get(key)).is_some()
}

fn has_config_object_key(settings: &Value, key: &str) -> bool {
    settings
        .get("config")
        .and_then(Value::as_object)
        .is_some_and(|config| config.contains_key(key))
}

fn has_nested_key(settings: &Value, path: &[&str]) -> bool {
    let mut current = settings;
    for segment in path {
        let Some(next) = current.get(*segment) else {
            return false;
        };
        current = next;
    }
    true
}

fn set_direct_string(settings: &mut Value, key: &str, value: &str) {
    let object = ensure_object(settings);
    object.insert(key.to_string(), Value::String(value.to_string()));
}

fn set_env_string(settings: &mut Value, key: &str, value: &str) {
    set_nested_string(settings, &["env", key], value);
}

fn set_config_object_string(settings: &mut Value, key: &str, value: &str) {
    set_nested_string(settings, &["config", key], value);
}

fn set_nested_string(settings: &mut Value, path: &[&str], value: &str) {
    if path.is_empty() {
        return;
    }

    let mut object = ensure_object(settings);
    for segment in &path[..path.len() - 1] {
        object = ensure_child_object(object, segment);
    }

    object.insert(
        path[path.len() - 1].to_string(),
        Value::String(value.to_string()),
    );
}

fn ensure_object(value: &mut Value) -> &mut Map<String, Value> {
    if !value.is_object() {
        *value = Value::Object(Map::new());
    }
    value.as_object_mut().expect("value was set to object")
}

fn ensure_child_object<'a>(
    object: &'a mut Map<String, Value>,
    key: &str,
) -> &'a mut Map<String, Value> {
    let entry = object
        .entry(key.to_string())
        .or_insert_with(|| Value::Object(Map::new()));
    if !entry.is_object() {
        *entry = Value::Object(Map::new());
    }
    entry.as_object_mut().expect("child was set to object")
}

fn extract_codex_base_url_from_toml(config_text: &str) -> Option<String> {
    let doc = config_text.parse::<toml::Value>().ok()?;

    if let Some(active_provider) = doc.get("model_provider").and_then(|value| value.as_str()) {
        if let Some(url) = doc
            .get("model_providers")
            .and_then(|providers| providers.get(active_provider))
            .and_then(|provider| provider.get("base_url"))
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|url| !url.is_empty())
        {
            return Some(url.to_string());
        }
    }

    doc.get("base_url")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|url| !url.is_empty())
        .map(ToString::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::Database;
    use crate::provider::ProviderMeta;
    use serde_json::json;

    #[test]
    fn reads_claude_provider_credentials() {
        let provider = Provider::with_id(
            "claude-a".to_string(),
            "Claude A".to_string(),
            json!({
                "env": {
                    "ANTHROPIC_BASE_URL": "https://claude.example/v1",
                    "ANTHROPIC_AUTH_TOKEN": "sk-claude"
                }
            }),
            None,
        );

        let view = provider_admin_view(&AppType::Claude, &provider);

        assert_eq!(
            view,
            ProviderAdminView {
                id: "claude-a".to_string(),
                name: "Claude A".to_string(),
                url: "https://claude.example/v1".to_string(),
                key: "sk-claude".to_string(),
            }
        );
    }

    #[test]
    fn lists_provider_credentials_with_ids() {
        let db = Database::memory().unwrap();
        let provider_a = Provider::with_id(
            "a".to_string(),
            "Provider A".to_string(),
            json!({
                "env": {
                    "ANTHROPIC_BASE_URL": "https://a.example/v1",
                    "ANTHROPIC_AUTH_TOKEN": "sk-a"
                }
            }),
            None,
        );
        let provider_b = Provider::with_id(
            "b".to_string(),
            "Provider B".to_string(),
            json!({
                "env": {
                    "ANTHROPIC_BASE_URL": "https://b.example/v1",
                    "ANTHROPIC_AUTH_TOKEN": "sk-b"
                }
            }),
            None,
        );
        db.save_provider("claude", &provider_a).unwrap();
        db.save_provider("claude", &provider_b).unwrap();

        let views = list_provider_admin_views(&db, &AppType::Claude).unwrap();

        assert_eq!(views.len(), 2);
        assert_eq!(views[0].id, "a");
        assert_eq!(views[0].name, "Provider A");
        assert_eq!(views[0].url, "https://a.example/v1");
        assert_eq!(views[0].key, "sk-a");
        assert_eq!(views[1].id, "b");
    }

    #[test]
    fn updates_claude_existing_env_fields_in_database() {
        let db = Database::memory().unwrap();
        let provider = Provider::with_id(
            "claude-a".to_string(),
            "Claude A".to_string(),
            json!({
                "env": {
                    "ANTHROPIC_BASE_URL": "https://old.example/v1",
                    "ANTHROPIC_API_KEY": "old-key"
                }
            }),
            None,
        );
        db.save_provider("claude", &provider).unwrap();

        let view = update_provider_admin(
            &db,
            &AppType::Claude,
            "claude-a",
            ProviderAdminUpdate {
                url: Some(" https://new.example/v1 ".to_string()),
                key: Some(" new-key ".to_string()),
            },
        )
        .unwrap();

        assert_eq!(view.url, "https://new.example/v1");
        assert_eq!(view.key, "new-key");

        let saved = db
            .get_provider_by_id("claude-a", "claude")
            .unwrap()
            .unwrap();
        assert_eq!(
            saved.settings_config["env"]["ANTHROPIC_BASE_URL"],
            "https://new.example/v1"
        );
        assert_eq!(saved.settings_config["env"]["ANTHROPIC_API_KEY"], "new-key");
    }

    #[test]
    fn updates_codex_toml_url_and_auth_key() {
        let db = Database::memory().unwrap();
        let provider = Provider::with_id(
            "codex-a".to_string(),
            "Codex A".to_string(),
            json!({
                "auth": {
                    "OPENAI_API_KEY": "old-key"
                },
                "config": r#"
model_provider = "custom"

[model_providers.custom]
name = "custom"
base_url = "https://old.example/v1"
wire_api = "responses"
"#
            }),
            None,
        );
        db.save_provider("codex", &provider).unwrap();

        let view = update_provider_admin(
            &db,
            &AppType::Codex,
            "codex-a",
            ProviderAdminUpdate {
                url: Some("https://new.example/v1".to_string()),
                key: Some("new-key".to_string()),
            },
        )
        .unwrap();

        assert_eq!(view.url, "https://new.example/v1");
        assert_eq!(view.key, "new-key");

        let saved = db.get_provider_by_id("codex-a", "codex").unwrap().unwrap();
        let config = saved
            .settings_config
            .get("config")
            .and_then(Value::as_str)
            .unwrap();
        assert!(config.contains(r#"base_url = "https://new.example/v1""#));
        assert_eq!(saved.settings_config["auth"]["OPENAI_API_KEY"], "new-key");
    }

    #[test]
    fn default_claude_key_field_uses_provider_meta() {
        let mut provider =
            Provider::with_id("claude-a".to_string(), "Claude A".to_string(), json!({}), None);
        provider.meta = Some(ProviderMeta {
            api_key_field: Some("ANTHROPIC_API_KEY".to_string()),
            ..Default::default()
        });

        set_provider_key(&AppType::Claude, &mut provider, "sk-test").unwrap();

        assert_eq!(provider.settings_config["env"]["ANTHROPIC_API_KEY"], "sk-test");
    }

    #[test]
    fn missing_provider_returns_not_found() {
        let db = Database::memory().unwrap();
        let err = get_provider_admin_view(&db, &AppType::Codex, "missing").unwrap_err();

        assert_eq!(
            err,
            ProviderAdminError::ProviderNotFound {
                app_type: "codex".to_string(),
                provider_id: "missing".to_string(),
            }
        );
    }
}
