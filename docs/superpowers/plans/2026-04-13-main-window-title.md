# Main Window Title Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show `cc-switch` in the native main window title bar by updating the dynamically created Tauri main window title.

**Architecture:** Keep the change isolated to `src-tauri/src/main_window.rs`. Introduce a small title helper so the title value is testable without constructing a real Tauri window, then wire `ensure_main_window` to use that helper.

**Tech Stack:** Rust, Tauri 2.x unit tests, Cargo

---

### Task 1: Lock The Title Behavior With Tests

**Files:**
- Modify: `src-tauri/src/main_window.rs`
- Test: `src-tauri/src/main_window.rs`

- [ ] **Step 1: Write the failing test**

```rust
    #[test]
    fn main_window_uses_cc_switch_title() {
        assert_eq!(main_window_title(), "cc-switch");
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --lib main_window::tests::main_window_uses_cc_switch_title`
Expected: FAIL with unresolved function or wrong returned title.

- [ ] **Step 3: Write minimal implementation**

```rust
fn main_window_title() -> &'static str {
    "cc-switch"
}
```

Then update the builder chain to use:

```rust
        .title(main_window_title())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --lib main_window::tests::main_window_uses_cc_switch_title`
Expected: PASS

- [ ] **Step 5: Re-run the related window unit tests**

Run: `cargo test --lib main_window::tests`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/main_window.rs
git commit -m "fix: show main window title"
```

### Task 2: Verify The Desktop Build Still Works

**Files:**
- Verify: `src-tauri/src/main_window.rs`

- [ ] **Step 1: Run release no-bundle build**

Run: `pnpm tauri build --no-bundle`
Expected: build succeeds and produces `src-tauri/target/release/cc-switch.exe`

- [ ] **Step 2: Commit verification-complete work**

```bash
git add src-tauri/src/main_window.rs
git commit -m "fix: show main window title"
```
