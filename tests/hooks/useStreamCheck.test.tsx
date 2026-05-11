import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStreamCheck } from "@/hooks/useStreamCheck";
import { streamCheckProvider } from "@/lib/api/model-test";
import type { StreamCheckResult } from "@/lib/api/model-test";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/api/model-test", () => ({
  streamCheckProvider: vi.fn(),
}));

const streamCheckProviderMock = vi.mocked(streamCheckProvider);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useStreamCheck", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    streamCheckProviderMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the latest result after the transient tooltip window", async () => {
    const result = {
      status: "operational",
      success: true,
      message: "ok",
      modelUsed: "test-model",
      testedAt: Date.now(),
      retryCount: 0,
    } satisfies StreamCheckResult;

    streamCheckProviderMock.mockResolvedValue(result);

    const { result: hook } = renderHook(() => useStreamCheck("claude"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await hook.current.checkProvider("provider-1", "Provider 1");
    });

    expect(hook.current.getRecentResult("provider-1")).toEqual(result);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(hook.current.getRecentResult("provider-1")).toEqual(result);
  });
});
