import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Provider } from "@/types";
import { ProviderCard } from "@/components/providers/ProviderCard";

const useProviderHealthMock = vi.fn();
const useUsageQueryMock = vi.fn();

vi.mock("@/components/providers/ProviderActions", () => ({
  ProviderActions: () => <div data-testid="provider-actions" />,
}));

vi.mock("@/components/ProviderIcon", () => ({
  ProviderIcon: () => <div data-testid="provider-icon" />,
}));

vi.mock("@/components/UsageFooter", () => ({
  default: ({ inline }: { inline: boolean }) => (
    <div data-testid={inline ? "usage-footer-inline" : "usage-footer-block"} />
  ),
}));

vi.mock("@/components/providers/ProviderHealthBadge", () => ({
  ProviderHealthBadge: () => <div data-testid="provider-health-badge" />,
}));

vi.mock("@/components/providers/FailoverPriorityBadge", () => ({
  FailoverPriorityBadge: () => <div data-testid="failover-priority-badge" />,
}));

vi.mock("@/lib/query/failover", () => ({
  useProviderHealth: (...args: unknown[]) => useProviderHealthMock(...args),
}));

vi.mock("@/lib/query/queries", () => ({
  useUsageQuery: (...args: unknown[]) => useUsageQueryMock(...args),
}));

function createProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: overrides.id ?? "provider-1",
    name: overrides.name ?? "Test Provider",
    settingsConfig: overrides.settingsConfig ?? {},
    websiteUrl: overrides.websiteUrl ?? "https://api.example.com/v1",
    meta: overrides.meta,
    notes: overrides.notes,
    category: overrides.category,
  };
}

describe("ProviderCard compact layout", () => {
  const baseProps = {
    provider: createProvider(),
    isCurrent: true,
    appId: "claude" as const,
    onSwitch: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onConfigureUsage: vi.fn(),
    onOpenWebsite: vi.fn(),
    onDuplicate: vi.fn(),
    isProxyRunning: false,
  };

  beforeEach(() => {
    useProviderHealthMock.mockReturnValue({ data: null });
    useUsageQueryMock.mockReturnValue({ data: undefined });
  });

  it("renders a tighter card shell and title rhythm", () => {
    const { container } = render(<ProviderCard {...baseProps} />);

    expect(container.firstElementChild).toHaveClass("p-3");
    expect(container.firstElementChild?.children[1]).toHaveClass("gap-2.5");
    expect(container.firstElementChild?.querySelector(".space-y-0")).toBeInTheDocument();
    expect(
      container.firstElementChild?.querySelector(".min-h-5"),
    ).toBeInTheDocument();
  });

  it("renders tighter expanded usage spacing when multiple plans exist", async () => {
    useUsageQueryMock.mockReturnValue({
      data: {
        success: true,
        data: [{ planName: "A" }, { planName: "B" }],
      },
    });

    const { container } = render(<ProviderCard {...baseProps} />);

    expect(await screen.findByTestId("usage-footer-block")).toBeInTheDocument();
    const expandedShell = container.querySelector(".border-t.border-border-default");
    expect(expandedShell).toHaveClass("mt-2.5", "pt-2.5");
  });
});
