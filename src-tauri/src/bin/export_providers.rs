//! Export providers from cc-switch.db to a JSON file.
//!
//! Usage:
//!   export-providers <path-to-cc-switch.db> [output.json]
//!
//! Output format:
//!   {
//!     "claude": ["https://example.com,  sk-..."],
//!     "codex": ["https://example.com,  sk-..."]
//!   }

use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::path::Path;

use rusqlite::Connection;
use serde_json::Value;
use toml::Value as TomlValue;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: export-providers <cc-switch.db> [output.json]");
        std::process::exit(1);
    }

    let db_path = &args[1];
    let out_path = if args.len() >= 3 {
        args[2].clone()
    } else {
        let base = Path::new(db_path).parent().unwrap_or(Path::new("."));
        base.join("providers.json").to_string_lossy().into_owned()
    };

    if !Path::new(db_path).exists() {
        eprintln!("Error: database file not found: {db_path}");
        std::process::exit(1);
    }

    let conn = match Connection::open(db_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Error opening database: {e}");
            std::process::exit(1);
        }
    };

    let mut stmt = match conn
        .prepare("SELECT app_type, settings_config FROM providers ORDER BY app_type, sort_index")
    {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Error querying providers: {e}");
            std::process::exit(1);
        }
    };

    let rows = stmt
        .query_map([], |row| {
            let app_type: String = row.get(0)?;
            let config_str: String = row.get(1)?;
            Ok((app_type, config_str))
        })
        .unwrap();

    let mut providers_by_app: BTreeMap<String, Vec<String>> = BTreeMap::new();

    for row in rows {
        let (app_type, config_str) = match row {
            Ok(r) => r,
            Err(e) => {
                eprintln!("Warning: skipping row due to error: {e}");
                continue;
            }
        };

        let config: Value = serde_json::from_str(&config_str).unwrap_or(Value::Null);
        let (base_url, api_key) = extract_credentials(&app_type, &config);

        if api_key.is_empty() {
            continue;
        }

        let entry = format_provider_entry(&base_url, &api_key);
        providers_by_app.entry(app_type).or_default().push(entry);
    }

    let json = serde_json::to_string_pretty(&providers_by_app).unwrap();

    match fs::write(&out_path, &json) {
        Ok(()) => {
            let total = providers_by_app.values().map(Vec::len).sum::<usize>();
            println!("Exported {} providers to {}", total, out_path);
        }
        Err(e) => {
            eprintln!("Error writing output: {e}");
            std::process::exit(1);
        }
    }
}

/// Extract base_url and api_key from settings_config based on app_type.
fn extract_credentials(app: &str, config: &Value) -> (String, String) {
    match app {
        "claude" => {
            let env = config.get("env").unwrap_or(&Value::Null);
            let base_url = env_get(env, "ANTHROPIC_BASE_URL");
            let api_key = env_get_opt(env, "ANTHROPIC_AUTH_TOKEN")
                .or_else(|| env_get_opt(env, "ANTHROPIC_API_KEY"))
                .unwrap_or_default();
            (base_url, api_key)
        }
        "codex" => {
            // Codex settings_config: { "auth": { "OPENAI_API_KEY": "..." }, "config": "..." }
            let auth = config.get("auth").unwrap_or(&Value::Null);
            let base_url = env_get_opt(auth, "OPENAI_BASE_URL")
                .or_else(|| {
                    config
                        .get("config")
                        .and_then(|v| v.as_str())
                        .and_then(extract_codex_base_url_from_toml)
                })
                .unwrap_or_default();
            let api_key = env_get(auth, "OPENAI_API_KEY");
            if !api_key.is_empty() {
                (base_url, api_key)
            } else {
                // Fallback: some providers store in env
                let env = config.get("env").unwrap_or(&Value::Null);
                let base_url2 = env_get_opt(env, "OPENAI_BASE_URL")
                    .or_else(|| {
                        config
                            .get("config")
                            .and_then(|v| v.as_str())
                            .and_then(extract_codex_base_url_from_toml)
                    })
                    .unwrap_or_default();
                let api_key2 = env_get(env, "OPENAI_API_KEY");
                (base_url2, api_key2)
            }
        }
        "gemini" => {
            let env = config.get("env").unwrap_or(&Value::Null);
            let base_url = env_get(env, "GOOGLE_GEMINI_BASE_URL");
            let api_key = env_get(env, "GEMINI_API_KEY");
            (base_url, api_key)
        }
        "opencode" => {
            let options = config.get("options").unwrap_or(&Value::Null);
            let base_url = str_get(options, "baseURL");
            let api_key = str_get(options, "apiKey");
            (base_url, api_key)
        }
        "openclaw" => {
            let base_url = str_get(config, "baseUrl");
            let api_key = str_get(config, "apiKey");
            (base_url, api_key)
        }
        "hermes" => {
            let base_url = str_get(config, "base_url");
            let api_key = str_get(config, "api_key");
            (base_url, api_key)
        }
        _ => (String::new(), String::new()),
    }
}

fn env_get(env: &Value, key: &str) -> String {
    env_get_opt(env, key).unwrap_or_default()
}

fn env_get_opt(env: &Value, key: &str) -> Option<String> {
    env.get(key).and_then(|v| v.as_str()).map(|s| s.to_string())
}

fn str_get(obj: &Value, key: &str) -> String {
    obj.get(key)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

fn format_provider_entry(base_url: &str, api_key: &str) -> String {
    format!("{},  {}", base_url, api_key)
}

fn extract_codex_base_url_from_toml(config_toml: &str) -> Option<String> {
    let parsed = toml::from_str::<TomlValue>(config_toml).ok()?;

    if let Some(base_url) = parsed.get("base_url").and_then(|v| v.as_str()) {
        return Some(base_url.to_string());
    }

    let providers = parsed.get("model_providers").and_then(|v| v.as_table())?;

    if let Some(active_provider_id) = parsed.get("model_provider").and_then(|v| v.as_str()) {
        if let Some(base_url) = providers
            .get(active_provider_id)
            .and_then(|v| v.get("base_url"))
            .and_then(|v| v.as_str())
        {
            return Some(base_url.to_string());
        }
    }

    providers.values().find_map(|provider| {
        provider
            .get("base_url")
            .and_then(|v| v.as_str())
            .map(|v| v.to_string())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn extract_codex_credentials_reads_base_url_from_config_toml() {
        let config = json!({
            "auth": {
                "OPENAI_API_KEY": "sk-test"
            },
            "config": r#"model_provider = "rightcode"

[model_providers.rightcode]
name = "RightCode"
base_url = "https://rightcode.example/v1"
wire_api = "responses"
"#
        });

        let (base_url, api_key) = extract_credentials("codex", &config);

        assert_eq!(base_url, "https://rightcode.example/v1");
        assert_eq!(api_key, "sk-test");
    }

    #[test]
    fn format_matches_grouped_export_value() {
        let entry = format_provider_entry("https://test-base-url.com", "sk-test-api-key");

        assert_eq!(entry, "https://test-base-url.com,  sk-test-api-key");
    }

    #[test]
    fn extract_codex_base_url_prefers_active_model_provider() {
        let config_toml = r#"model_provider = "active"

[model_providers.backup]
base_url = "https://backup.example/v1"

[model_providers.active]
base_url = "https://active.example/v1"
"#;

        let base_url = extract_codex_base_url_from_toml(config_toml);

        assert_eq!(base_url.as_deref(), Some("https://active.example/v1"));
    }
}
