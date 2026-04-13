# Main Window Title Design

## Goal

Show `cc-switch` in the native main window title bar on Windows.

## Current State

- The main window is created dynamically in `src-tauri/src/main_window.rs`.
- The dynamic `WebviewWindowBuilder` currently sets `.title("")`.
- As a result, the native window title bar text is blank.

## Chosen Approach

Set the dynamic main window title to the fixed string `cc-switch`.

## Alternatives Considered

1. Read the title from Tauri `productName`.
   - More configurable, but unnecessary for this small fork-specific requirement.
2. Apply a Windows-only branch.
   - More conservative, but adds platform-specific behavior without need.

## Scope

- Update the main window builder title in `src-tauri/src/main_window.rs`.
- Add a small unit test that locks the intended title value behind a helper.

## Out of Scope

- Changing any in-page React header text.
- Renaming the app bundle metadata.
- Changing tray labels or other windows.

## Validation

- Run the targeted Rust unit test for the title helper.
- Run `pnpm tauri build --no-bundle` to confirm the desktop app still builds.
