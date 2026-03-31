import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProviderEmptyState } from "@/components/providers/ProviderEmptyState";

describe("ProviderEmptyState compact layout", () => {
  it("renders the compact empty state shell and actions spacing", () => {
    render(<ProviderEmptyState appId="claude" onCreate={vi.fn()} />);

    const title = screen.getByText("provider.noProviders");
    const shell = title.closest("div.border-dashed");
    expect(shell).toHaveClass("p-8");

    const actions = screen.getByRole("button", {
      name: "provider.addProvider",
    }).parentElement;
    expect(actions).toHaveClass("mt-5", "gap-1.5");
  });
});
