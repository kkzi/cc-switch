//! 响应内容错误检测。
//!
//! 用于识别“HTTP 2xx 但 body/SSE 内容实际是上游错误”的场景。

use super::types::ResponseErrorDetectionConfig;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResponseErrorMatch {
    pub keyword: String,
    pub snippet: String,
}

pub fn normalize_config(
    mut config: ResponseErrorDetectionConfig,
) -> ResponseErrorDetectionConfig {
    config.keywords = normalize_keywords(config.keywords);
    if config.sse_scan_chunks == 0 {
        config.sse_scan_chunks = ResponseErrorDetectionConfig::default().sse_scan_chunks;
    }
    if config.sse_scan_bytes == 0 {
        config.sse_scan_bytes = ResponseErrorDetectionConfig::default().sse_scan_bytes;
    }
    config
}

pub fn is_enabled(config: &ResponseErrorDetectionConfig) -> bool {
    config.enabled && config.keywords.iter().any(|keyword| !keyword.trim().is_empty())
}

pub fn detect_response_error(
    text: &str,
    config: &ResponseErrorDetectionConfig,
) -> Option<ResponseErrorMatch> {
    if !is_enabled(config) || text.is_empty() {
        return None;
    }

    for keyword in normalize_keywords(config.keywords.clone()) {
        if let Some(byte_index) = text.find(&keyword) {
            return Some(ResponseErrorMatch {
                snippet: build_snippet(text, byte_index, keyword.len(), 96),
                keyword,
            });
        }
    }

    None
}

fn normalize_keywords(keywords: Vec<String>) -> Vec<String> {
    let mut normalized = Vec::new();
    for keyword in keywords {
        let keyword = keyword.trim();
        if keyword.is_empty() {
            continue;
        }
        if !normalized.iter().any(|existing| existing == keyword) {
            normalized.push(keyword.to_string());
        }
    }
    normalized
}

fn build_snippet(text: &str, byte_index: usize, keyword_len: usize, radius: usize) -> String {
    let start = text[..byte_index]
        .char_indices()
        .rev()
        .nth(radius)
        .map(|(idx, _)| idx)
        .unwrap_or(0);
    let end_target = byte_index.saturating_add(keyword_len);
    let end = text[end_target..]
        .char_indices()
        .nth(radius)
        .map(|(idx, _)| end_target + idx)
        .unwrap_or(text.len());

    let mut snippet = text[start..end].replace(['\r', '\n', '\t'], " ");
    if start > 0 {
        snippet.insert_str(0, "...");
    }
    if end < text.len() {
        snippet.push_str("...");
    }
    snippet
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disabled_config_does_not_match() {
        let config = ResponseErrorDetectionConfig {
            enabled: false,
            keywords: vec!["quota exceeded".to_string()],
            ..Default::default()
        };

        assert!(detect_response_error("quota exceeded", &config).is_none());
    }

    #[test]
    fn matches_configured_keyword() {
        let config = ResponseErrorDetectionConfig {
            enabled: true,
            keywords: vec!["quota exceeded".to_string()],
            ..Default::default()
        };

        let matched = detect_response_error("upstream says quota exceeded today", &config).unwrap();
        assert_eq!(matched.keyword, "quota exceeded");
        assert!(matched.snippet.contains("quota exceeded"));
    }

    #[test]
    fn trims_and_skips_empty_keywords() {
        let config = ResponseErrorDetectionConfig {
            enabled: true,
            keywords: vec![" ".to_string(), " invalid key ".to_string()],
            ..Default::default()
        };

        let matched = detect_response_error("body has invalid key", &config).unwrap();
        assert_eq!(matched.keyword, "invalid key");
    }

    #[test]
    fn normalize_config_restores_zero_sse_limits() {
        let config = normalize_config(ResponseErrorDetectionConfig {
            enabled: true,
            keywords: vec!["a".to_string()],
            sse_scan_chunks: 0,
            sse_scan_bytes: 0,
        });

        assert_eq!(config.sse_scan_chunks, 8);
        assert_eq!(config.sse_scan_bytes, 32 * 1024);
    }
}
