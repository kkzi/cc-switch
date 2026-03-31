# Codex Stream Check Model Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update Codex stream-check model resolution so provider-level `meta.testConfig.testModel` wins when enabled, otherwise fall back to the same `settingsConfig.config` model extraction used by the card label, and finally the global default `gpt-5.2`.

**Architecture:** Keep the change isolated to `src-tauri/src/services/stream_check.rs`. Preserve renderer behavior by leaving the card label logic unchanged and only adjusting backend stream-check model selection plus unit coverage around the new priority order.

**Tech Stack:** Rust, Tauri, serde_json, built-in Rust unit tests

---

### Task 1: Lock The Desired Behavior With Tests

**Files:**
- Modify: `src-tauri/src/services/stream_check.rs`

- [ ] **Step 1: Write the failing test**

Add unit tests for:
- default `codex_model` equals `gpt-5.2`
- enabled `meta.testConfig.testModel` overrides Codex TOML `model`
- Codex TOML `model` is used when no enabled provider test model exists
- global `codex_model` is used when neither provider source is present

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test stream_check::tests::test_default_config stream_check::tests::test_resolve_codex_test_model_prefers_enabled_meta_test_model`
Expected: FAIL because the code still defaults to `gpt-5.1-codex@low` and still prioritizes TOML `model`

### Task 2: Implement The Priority Change

**Files:**
- Modify: `src-tauri/src/services/stream_check.rs`

- [ ] **Step 1: Write minimal implementation**

Update the default config to `gpt-5.2` and change Codex model resolution order to:
1. enabled provider `meta.testConfig.testModel`
2. top-level `model` extracted from `settingsConfig.config`
3. global `codex_model`

- [ ] **Step 2: Run test to verify it passes**

Run: `cargo test stream_check::tests::test_default_config stream_check::tests::test_resolve_codex_test_model_prefers_enabled_meta_test_model stream_check::tests::test_resolve_codex_test_model_falls_back_to_provider_config stream_check::tests::test_resolve_codex_test_model_falls_back_to_global_config`
Expected: PASS

### Task 3: Verify The Targeted Area

**Files:**
- Modify: `src-tauri/src/services/stream_check.rs`

- [ ] **Step 1: Run related test module**

Run: `cargo test stream_check`
Expected: PASS
