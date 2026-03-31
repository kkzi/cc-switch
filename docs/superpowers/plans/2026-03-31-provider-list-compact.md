# Provider List Compact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the provider list UI slightly more compact across the list container, provider cards, and empty states without changing information density or behavior.

**Architecture:** Keep the existing component structure and interactions intact, and only reduce Tailwind spacing classes by one step in the affected provider list surfaces. Lock the intended density with focused component tests that assert the updated compact layout classes and preserve existing list behavior coverage.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Tailwind utility classes, React Query

---

## File Structure

- Modify: `src/components/providers/ProviderList.tsx`
  - Reduce spacing for the loading skeleton container, rendered list stack, search popover shell, and no-result notice.
- Modify: `src/components/providers/ProviderCard.tsx`
  - Reduce card padding, top-level layout gaps, title/meta spacing, action-area spacing, and expanded usage section spacing.
- Modify: `src/components/providers/ProviderEmptyState.tsx`
  - Reduce empty-state padding, icon shell size, text spacing, and action stack spacing.
- Modify: `tests/components/ProviderList.test.tsx`
  - Add compact-layout regression checks for the list loading and no-result states without disturbing existing behavior tests.
- Create: `tests/components/ProviderCard.test.tsx`
  - Add focused class-based regression coverage for the compact provider card layout.
- Create: `tests/components/ProviderEmptyState.test.tsx`
  - Add focused class-based regression coverage for the compact empty state layout.

### Task 1: Lock Compact Provider List Spacing

**Files:**
- Modify: `tests/components/ProviderList.test.tsx`
- Test: `tests/components/ProviderList.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
it("renders compact loading placeholders", () => {
  const { container } = renderWithQueryClient(<ProviderList isLoading {...props} />);
  expect(container.firstChild).toHaveClass("space-y-2.5");
  expect(container.querySelector(".h-24")).toBeTruthy();
});

it("renders compact no-result spacing", () => {
  renderWithQueryClient(<ProviderList {...propsWithSearchNoMatch} />);
  expect(screen.getByText("No providers match your search.").parentElement).toHaveClass(
    "px-5",
    "py-6",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/components/ProviderList.test.tsx --exclude .worktrees/**`
Expected: FAIL because the current list still uses the old spacing classes.

- [ ] **Step 3: Write minimal implementation**

```tsx
if (isLoading) {
  return <div className="space-y-2.5">...</div>;
}

<div className="space-y-2.5">{/* provider cards */}</div>

<div className="px-5 py-6 text-sm text-center border border-dashed rounded-lg border-border text-muted-foreground">
  ...
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/components/ProviderList.test.tsx --exclude .worktrees/**`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/components/ProviderList.test.tsx src/components/providers/ProviderList.tsx
git commit -m "test: lock compact provider list spacing"
```

### Task 2: Lock Compact Provider Card Spacing

**Files:**
- Create: `tests/components/ProviderCard.test.tsx`
- Modify: `src/components/providers/ProviderCard.tsx`
- Test: `tests/components/ProviderCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
it("renders the compact card shell spacing", () => {
  render(<ProviderCard {...props} />);
  expect(screen.getByText("Test Provider").closest("div[class*='rounded-xl']")).toHaveClass(
    "p-3.5",
  );
});

it("renders the compact expanded usage spacing", () => {
  render(<ProviderCard {...propsWithMultiplePlans} />);
  expect(screen.getByTestId("expanded-usage-shell")).toHaveClass("mt-3", "pt-3");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/components/ProviderCard.test.tsx --exclude .worktrees/**`
Expected: FAIL because the current card still uses the old spacing classes.

- [ ] **Step 3: Write minimal implementation**

```tsx
<div className="relative overflow-hidden rounded-xl border border-border p-3.5 ...">
  <div className="relative flex flex-col gap-3 sm:flex-row ...">
    ...
    <div className="relative flex items-center ml-auto min-w-0 gap-2.5">
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/components/ProviderCard.test.tsx --exclude .worktrees/**`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/components/ProviderCard.test.tsx src/components/providers/ProviderCard.tsx
git commit -m "test: lock compact provider card spacing"
```

### Task 3: Lock Compact Provider Empty State Spacing

**Files:**
- Create: `tests/components/ProviderEmptyState.test.tsx`
- Modify: `src/components/providers/ProviderEmptyState.tsx`
- Test: `tests/components/ProviderEmptyState.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
it("renders the compact empty state shell", () => {
  render(<ProviderEmptyState appId="claude" onCreate={vi.fn()} />);
  const shell = screen.getByText("provider.noProviders").closest("div[class*='border-dashed']");
  expect(shell).toHaveClass("p-8");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/components/ProviderEmptyState.test.tsx --exclude .worktrees/**`
Expected: FAIL because the current empty state still uses larger spacing classes.

- [ ] **Step 3: Write minimal implementation**

```tsx
<div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
  <div className="mb-3 flex h-14 w-14 ...">
  ...
  <div className="mt-5 flex flex-col gap-1.5">
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/components/ProviderEmptyState.test.tsx --exclude .worktrees/**`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/components/ProviderEmptyState.test.tsx src/components/providers/ProviderEmptyState.tsx
git commit -m "test: lock compact provider empty state spacing"
```

### Task 4: Final Verification

**Files:**
- Modify: `src/components/providers/ProviderList.tsx`
- Modify: `src/components/providers/ProviderCard.tsx`
- Modify: `src/components/providers/ProviderEmptyState.tsx`
- Modify: `tests/components/ProviderList.test.tsx`
- Create: `tests/components/ProviderCard.test.tsx`
- Create: `tests/components/ProviderEmptyState.test.tsx`

- [ ] **Step 1: Run targeted frontend tests**

Run: `pnpm exec vitest run tests/components/ProviderList.test.tsx tests/components/ProviderCard.test.tsx tests/components/ProviderEmptyState.test.tsx --exclude .worktrees/**`
Expected: PASS

- [ ] **Step 2: Run type checking**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Review changed files**

Run: `git diff -- src/components/providers/ProviderList.tsx src/components/providers/ProviderCard.tsx src/components/providers/ProviderEmptyState.tsx tests/components/ProviderList.test.tsx tests/components/ProviderCard.test.tsx tests/components/ProviderEmptyState.test.tsx`
Expected: Only compact spacing and related regression tests changed.

- [ ] **Step 4: Commit**

```bash
git add src/components/providers/ProviderList.tsx src/components/providers/ProviderCard.tsx src/components/providers/ProviderEmptyState.tsx tests/components/ProviderList.test.tsx tests/components/ProviderCard.test.tsx tests/components/ProviderEmptyState.test.tsx docs/superpowers/plans/2026-03-31-provider-list-compact.md docs/superpowers/specs/2026-03-31-provider-list-compact-design.md
git commit -m "feat: compact provider list spacing"
```
