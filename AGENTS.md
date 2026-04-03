# Repository Guidelines for CC Switch

## Project Overview

CC Switch is a Tauri 2.x + React 18 + TypeScript desktop application for managing API providers (Claude Code, Codex, Gemini CLI). The backend is Rust with SQLite (rusqlite) for persistence. This is a long-lived fork of `farion1231/cc-switch`.

---

## Project Structure & Module Organization

### Frontend (`src/`)

```
src/
├── components/          # React UI components
│   ├── ui/              # Primitive UI components (button, input, dialog, etc.)
│   ├── providers/       # Provider management UI
│   ├── settings/        # Settings panels
│   ├── mcp/             # MCP server management UI
│   ├── proxy/           # Proxy/failover UI (fork-specific)
│   ├── skills/          # Skills management UI
│   ├── sessions/        # Session manager UI
│   ├── usage/           # Usage tracking UI
│   ├── universal/       # Universal provider UI
│   └── common/          # Shared/common components
├── hooks/               # Custom React hooks (business logic)
├── lib/
│   ├── api/             # Type-safe Tauri API wrappers (invoke calls)
│   └── query/           # TanStack Query v5 hooks and mutations
├── config/              # Presets (provider presets, MCP templates)
├── i18n/locales/        # Translation files (zh/, en/)
├── types/               # TypeScript type definitions
└── utils/               # Utility functions
```

### Backend (`src-tauri/`)

```
src-tauri/
├── src/
│   ├── commands/        # Tauri command handlers (one file per domain)
│   ├── services/        # Business logic layer
│   ├── database/        # SQLite DAO layer
│   ├── proxy/           # Proxy/routing logic (fork-specific)
│   ├── app_config.rs    # AppType, MultiAppConfig models
│   ├── provider.rs      # Provider domain model
│   ├── mcp.rs           # MCP server model & sync
│   ├── error.rs         # AppError enum (thiserror)
│   ├── main_window.rs   # Window lifecycle (fork-specific)
│   ├── tray.rs          # System tray
│   ├── store.rs         # AppState & persistence
│   └── lib.rs           # App entry point
└── tests/               # Rust integration tests
```

### Tests

```
tests/
├── hooks/               # Hook unit tests (*.test.tsx)
├── components/          # Component integration tests
├── integration/         # Full app flow tests
├── utils/               # Test utilities
└── msw/                 # MSW handlers for API mocking
```

---

## Build, Test, and Development Commands

### Frontend

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Run full Tauri app in dev mode (hot reload)
pnpm dev

# Run renderer-only (Vite, no Rust backend)
pnpm dev:renderer

# Production build
pnpm build

# TypeScript type checking
pnpm typecheck

# Format code with Prettier
pnpm format

# Check formatting without modifying
pnpm format:check

# Run all unit tests
pnpm test:unit

# Watch mode for tests (auto-rerun on changes)
pnpm test:unit:watch

# Run a single test file
pnpm test:unit tests/hooks/useProviderActions.test.tsx

# Run tests matching a pattern
pnpm test:unit --grep "useProviderActions"

# Run with coverage
pnpm test:unit --coverage
```

### Backend (Rust)

```bash
cd src-tauri

# Format code with rustfmt
cargo fmt

# Run clippy linter
cargo clippy

# Run all tests
cargo test

# Run specific test
cargo test switch_provider_updates_codex_live_and_state

# Run tests with test-hooks feature (for test-only helpers)
cargo test --features test-hooks

# Build debug package (no bundling, faster)
cargo build --no-bundle

# Build release
cargo build --release
```

---

## Code Style & Naming Conventions

### TypeScript / React

**Formatting:**

- 2-space indentation
- Double quotes for strings
- Trailing commas where applicable
- Run `pnpm format` before committing

**Imports:**

- Use absolute paths via `@/` alias (e.g., `@/hooks/useSettings`)
- Group imports: 1) React/std libs, 2) third-party, 3) internal (@/)
- Named exports preferred; use `export type` for types only
- Example:
  ```typescript
  import { useState, useCallback } from "react";
  import { useQuery, useMutation } from "@tanstack/react-query";
  import { toast } from "sonner";
  import type { Provider } from "@/types";
  import { providersApi } from "@/lib/api/providers";
  import { useDragSort } from "@/hooks/useDragSort";
  ```

**Naming:**

- React components: `PascalCase` (e.g., `ProviderList.tsx`)
- Hooks: `camelCase` starting with `use` (e.g., `useProviderActions.ts`)
- Utility modules: `camelCase` (e.g., `errorUtils.ts`, `providerConfigUtils.ts`)
- Type files: `camelCase` or matching domain (e.g., `proxy.ts`, `omo.ts`)
- Query keys: `camelCase` array format (e.g., `["providers", appId]`)
- Test files: `*.test.ts` or `*.test.tsx`

**React Patterns:**

- Destructure props with TypeScript interfaces
- Use `useCallback` for functions passed as props to memoized components
- Use `useMemo` for expensive computations
- Prefer composition over prop drilling (use Context or query data)
- Error handling: Use `extractErrorMessage()` utility from `@/utils/errorUtils`
- Notifications: Use `sonner` toast (`toast.success()`, `toast.error()`)

**TypeScript Strictness:**

- `strict: true` enabled in tsconfig
- No `any` unless absolutely necessary
- Use `type` for unions/intersections, `interface` for object shapes
- Export types explicitly: `export type { Provider }`

### Rust

**Formatting:**

- 4-space indentation (rustfmt defaults)
- Run `cargo fmt` before committing

**Naming:**

- Modules: `snake_case` (e.g., `fork_proxy.rs`)
- Functions: `snake_case` (e.g., `get_providers`)
- Structs/Enums: `PascalCase` (e.g., `Provider`, `AppError`)
- Traits: `PascalCase` (e.g., `ServiceTrait`)
- Constants: `SCREAMING_SNAKE_CASE` for true constants, `snake_case` for module-level values

**Error Handling:**

- Use `thiserror` for custom error enums (`AppError`)
- Return `Result<T, String>` from Tauri commands (converted via `.map_err(|e| e.to_string())`)
- Use `anyhow::Result<T>` for service layer functions that don't need custom errors
- Propagate errors with `?` operator; avoid `.unwrap()` or `.expect()` in command handlers

**Command Handler Pattern:**

```rust
#[tauri::command]
pub fn get_providers(
    state: State<'_, AppState>,
    app: String,
) -> Result<IndexMap<String, Provider>, String> {
    let app_type = AppType::from_str(&app).map_err(|e| e.to_string())?;
    ProviderService::list(state.inner(), app_type).map_err(|e| e.to_string())
}
```

**Module Organization:**

- One domain per file under `commands/`, `services/`, `database/dao/`
- Use `mod.rs` for command module aggregation
- Tests in `src-tauri/tests/` (integration tests); unit tests in same file

---

## Testing Guidelines

### Frontend Testing Stack

- **Framework**: Vitest 2.x with `jsdom` environment
- **Testing Library**: `@testing-library/react` for component tests
- **Mocking**: MSW (Mock Service Worker) for Tauri API calls; `vi.mock()` for module mocks
- **Coverage target**: Full hooks coverage; component integration tests for UI flows

### Writing Frontend Tests

- Test file naming: `*.test.ts` for utils/hooks, `*.test.tsx` for components
- Co-locate tests near feature area (e.g., `tests/hooks/useProviderActions.test.tsx`)
- Use `describe`, `it`, `expect` blocks
- Mock Tauri APIs via MSW handlers or `vi.mock("@/lib/api", ...)`
- Use `renderHook` from Testing Library for hook tests
- Example hook test pattern:
  ```typescript
  vi.mock("@/lib/query", () => ({
    useAddProviderMutation: () => vi.fn(() => ({ mutateAsync: vi.fn() })),
  }));
  ```

### Running Tests

```bash
# Single file
pnpm test:unit tests/hooks/useProviderActions.test.tsx

# Single test by name
pnpm test:unit --grep "addProvider"

# Watch mode
pnpm test:unit:watch tests/hooks/useProviderActions.test.tsx
```

### Backend Testing Stack

- Standard Rust `#[test]` with `cargo test`
- `serial_test` crate for tests requiring exclusive filesystem access
- Test state management via `support.rs` module with mutex guards
- `test-hooks` Cargo feature exposes internal helpers for testing

### Writing Backend Tests

- Integration tests in `src-tauri/tests/*.rs`
- Use `#[path = "support.rs"] mod support;` to share test utilities
- Reset filesystem state before each test via `reset_test_fs()`
- Use `test_mutex().lock()` to prevent parallel test interference
- Example test pattern in `provider_commands.rs`

---

## Commit & Pull Request Guidelines

### Commit Messages

Follow Conventional Commits:

```
feat: add model-level failover queue
fix(i18n): correct Chinese translation for provider switch
chore: bump tauri to 2.8.2
fix(proxy): handle connection timeout in provider router
```

### PR Guidelines

- Title: Summarize user-visible changes
- Body:
  - Bullet points of changes
  - Commands run (typecheck, tests, etc.)
  - Link related issues
  - Screenshots for UI changes
- Explicitly call out translation, packaging, or release workflow changes

---

## Security Guidelines

- **Never commit**: API keys, auth tokens, signing keys, real credentials
- **Never commit**: Local config dumps, `.env` files, release artifacts
- **When updating versions**: Ensure `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` stay aligned
- **When touching workflows**: Verify `.github/workflows/release.yml` version strings are consistent

---

## Fork-Specific Hotspots

This repository diverges from upstream `farion1231/cc-switch`. When syncing, manually review these files:

### Model Routing & Failover (Fork-Specific)

- `src-tauri/src/database/dao/fork_proxy.rs` - Fork proxy data & fork\_ tables
- `src-tauri/src/proxy/provider_router.rs` - Model routing logic
- `src-tauri/src/proxy/forwarder.rs` - Request forwarding
- `src-tauri/tests/failover_commands.rs` - Failover test suite
- `src-tauri/tests/model_failover_queue.rs` - Model-level failover queue

### Managed Auth & Copilot (Fork-Specific)

- `src-tauri/src/commands/auth.rs` - Auth command handlers
- `src-tauri/src/commands/copilot.rs` - GitHub Copilot OAuth
- `src-tauri/src/commands/provider.rs` - Provider commands
- `src-tauri/src/proxy/providers/copilot_auth.rs` - Copilot auth provider
- `src/components/settings/AuthCenterPanel.tsx` - Auth UI
- `src/lib/api/auth.ts`, `src/lib/api/copilot.ts` - API wrappers

### Main Window & Deep Links (Fork-Specific)

- `src-tauri/src/main_window.rs` - Window lifecycle ("hide first, destroy after 3000ms")
- `src-tauri/src/lib.rs`, `src-tauri/src/tray.rs`, `src-tauri/src/store.rs`
- `src-tauri/src/commands/deeplink.rs` - Deep link handling
- `src/components/DeepLinkImportDialog.tsx` - Deep link import UI
- `src/lib/api/deeplink.ts` - Deep link API wrapper

### Version/Release Alignment

- `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`
- `.github/workflows/release.yml`, `CHANGELOG.md`, `README.md`

### UI/UX Fork Tweaks

Fork UI changes exist in provider cards, model suggestion flows, tray behavior, and settings panels. Check `src/components/providers/`, `src/config/`, and related hooks before overwriting.

---

## Recommended Sync Flow

```bash
git fetch origin
git merge upstream/main  # or git rebase upstream/main
# Resolve conflicts manually in hotspot files above
pnpm tauri build --no-bundle  # Verify build
pnpm test:unit               # Run frontend tests
cargo test                   # Run backend tests
```
