import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Provider } from "@/types";
import { ProviderCard } from "@/components/providers/ProviderCard";
import type { StreamCheckResult } from "@/lib/api/model-test";

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

vi.mock("@/components/ui/tooltip", () => {
  const TooltipContext = React.createContext<{
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }>({ open: false });

  return {
    TooltipProvider: ({ children }: any) => <div>{children}</div>,
    Tooltip: ({ children, open, onOpenChange }: any) => (
      <TooltipContext.Provider
        value={{ open: Boolean(open), onOpenChange }}
      >
        <div>{children}</div>
      </TooltipContext.Provider>
    ),
    TooltipTrigger: ({ children }: any) => {
      const context = React.useContext(TooltipContext);
      if (!React.isValidElement(children)) {
        return <div>{children}</div>;
      }
      return React.cloneElement(children, {
        onPointerEnter: (event: PointerEvent) => {
          children.props.onPointerEnter?.(event);
          context.onOpenChange?.(true);
        },
        onPointerLeave: (event: PointerEvent) => {
          children.props.onPointerLeave?.(event);
          context.onOpenChange?.(false);
        },
      });
    },
    TooltipContent: ({ children, ...props }: any) => {
      const context = React.useContext(TooltipContext);
      if (!context.open) return null;
      return (
        <div data-testid="provider-card-tooltip" {...props}>
          {children}
        </div>
      );
    },
  };
});

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
    vi.useRealTimers();
    useProviderHealthMock.mockReturnValue({ data: null });
    useUsageQueryMock.mockReturnValue({ data: undefined });
  });

  it("renders a tighter card shell and title rhythm", () => {
    const { container } = render(<ProviderCard {...baseProps} />);

    expect(container.firstElementChild).toHaveClass("p-2.5");
    expect(container.firstElementChild?.children[1]).toHaveClass("gap-2");
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
    expect(expandedShell).toHaveClass("mt-2", "pt-2");
  });

  it("renders health badges back in the title row without reserving top-right space", () => {
    useProviderHealthMock.mockReturnValue({
      data: { consecutive_failures: 0 },
    });

    const { container } = render(
      <ProviderCard
        {...baseProps}
        isProxyRunning={true}
        isInFailoverQueue={true}
        isAutoFailoverEnabled={true}
        failoverPriority={1}
      />,
    );

    expect(screen.getByTestId("provider-health-badge")).toBeInTheDocument();
    expect(screen.getByTestId("failover-priority-badge")).toBeInTheDocument();
    expect(
      container.querySelector(".pointer-events-none.absolute.right-0.top-0"),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(".min-h-5 [data-testid='provider-health-badge']"),
    ).toBeInTheDocument();
    expect(container.querySelector(".pr-24")).not.toBeInTheDocument();
  });

  it("does not render a tooltip for the provider logo", () => {
    render(<ProviderCard {...baseProps} />);

    expect(screen.queryByTestId("provider-card-tooltip")).not.toBeInTheDocument();
  });

  it("renders tooltip content on the provider icon and removes inline error UI", () => {
    const longError =
      "503 upstream timeout while contacting a very long upstream error message for provider health diagnostics";
    useProviderHealthMock.mockReturnValue({
      data: {
        consecutive_failures: 3,
        last_check_status: "failed",
        last_error: longError,
      },
    });

    const { container } = render(<ProviderCard {...baseProps} />);

    fireEvent.pointerEnter(screen.getByTestId("provider-icon").parentElement!);

    expect(screen.getByTestId("provider-card-tooltip")).toHaveTextContent(
      longError,
    );
    expect(container.querySelector(".border-red-500")).toBeInTheDocument();
    expect(screen.queryByText("最近错误:")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看详情" })).not.toBeInTheDocument();
  });

  it("resets icon border to default while testing is running", () => {
    useProviderHealthMock.mockReturnValue({
      data: {
        consecutive_failures: 3,
        last_check_status: "failed",
        last_error: "old failure",
      },
    });

    const { container } = render(
      <ProviderCard
        {...baseProps}
        isTesting={true}
        recentTestResult={
          {
            status: "operational",
            success: true,
            message: "ok",
            modelUsed: "test-model",
            testedAt: Date.now(),
            retryCount: 0,
          } satisfies StreamCheckResult
        }
      />,
    );

    expect(container.querySelector(".border-border-default")).toBeInTheDocument();
    expect(container.querySelector(".border-red-500")).not.toBeInTheDocument();
    expect(container.querySelector(".border-green-500")).not.toBeInTheDocument();
  });

  it("prefers recent test result for border color and tooltip message", () => {
    useProviderHealthMock.mockReturnValue({
      data: {
        consecutive_failures: 3,
        last_check_status: "failed",
        last_error: "old failure",
      },
    });

    const recentResult = {
      status: "degraded",
      success: true,
      message: "temporary slowdown",
      modelUsed: "test-model",
      testedAt: Date.now(),
      retryCount: 0,
    } satisfies StreamCheckResult;

    const { container } = render(
      <ProviderCard
        {...baseProps}
        recentTestResult={recentResult}
      />,
    );

    expect(container.querySelector(".border-yellow-500")).toBeInTheDocument();
    expect(screen.getByTestId("provider-card-tooltip")).toHaveTextContent(
      "temporary slowdown",
    );
  });

  it("formats structured health errors into multiline tooltip text", () => {
    useProviderHealthMock.mockReturnValue({
      data: {
        consecutive_failures: 1,
        last_check_status: "failed",
        last_error:
          '401 Auth rejected: {"error":{"message":"Invalid token\\nPlease check","type":"new_api_error"}}',
      },
    });

    render(<ProviderCard {...baseProps} />);

    fireEvent.pointerEnter(screen.getByTestId("provider-icon").parentElement!);

    expect(screen.getByTestId("provider-card-tooltip")).toHaveTextContent(
      "401 Auth rejected",
    );
    expect(screen.getByTestId("provider-card-tooltip")).toHaveTextContent(
      "Invalid token",
    );
  });

  it("decodes prefixed json-like health errors for tooltip display", () => {
    useProviderHealthMock.mockReturnValue({
      data: {
        consecutive_failures: 1,
        last_check_status: "failed",
        last_error:
          'Auth rejected (401): {"error":{"message":"Invalid token\\nPlease check"}}',
      },
    });

    render(<ProviderCard {...baseProps} />);

    fireEvent.pointerEnter(screen.getByTestId("provider-icon").parentElement!);

    expect(screen.getByTestId("provider-card-tooltip")).toHaveTextContent(
      "401 Auth rejected",
    );
    expect(screen.getByTestId("provider-card-tooltip")).toHaveTextContent(
      "Invalid token",
    );
    expect(screen.getByTestId("provider-card-tooltip")).not.toHaveTextContent(
      "\\n",
    );
  });

  it("keeps the recent tooltip visible while hovering the icon region", () => {
    useProviderHealthMock.mockReturnValue({ data: null });

    const recentResult = {
      status: "degraded",
      success: true,
      message: "temporary slowdown",
      modelUsed: "test-model",
      testedAt: Date.now(),
      retryCount: 0,
    } satisfies StreamCheckResult;

    const { rerender } = render(
      <ProviderCard
        {...baseProps}
        recentTestResult={recentResult}
      />,
    );

    fireEvent.pointerEnter(screen.getByTestId("provider-icon").parentElement!);

    rerender(<ProviderCard {...baseProps} recentTestResult={null} />);

    expect(screen.getByTestId("provider-card-tooltip")).toHaveTextContent(
      "temporary slowdown",
    );
  });

  it("auto hides the recent tooltip after 5 seconds when not hovered", async () => {
    vi.useFakeTimers();
    useProviderHealthMock.mockReturnValue({ data: null });

    const recentResult = {
      status: "degraded",
      success: true,
      message: "temporary slowdown",
      modelUsed: "test-model",
      testedAt: Date.now(),
      retryCount: 0,
    } satisfies StreamCheckResult;

    render(
      <ProviderCard
        {...baseProps}
        recentTestResult={recentResult}
      />,
    );

    expect(screen.getByTestId("provider-card-tooltip")).toHaveTextContent(
      "temporary slowdown",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(screen.queryByTestId("provider-card-tooltip")).not.toBeInTheDocument();
  });
});
