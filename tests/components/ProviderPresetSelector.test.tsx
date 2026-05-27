import type { ReactNode } from "react";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProviderPresetSelector } from "@/components/providers/forms/ProviderPresetSelector";
import type { ProviderPreset } from "@/config/claudeProviderPresets";

vi.mock("@/components/ui/form", () => ({
  FormLabel: ({ children }: { children: ReactNode }) => (
    <label>{children}</label>
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const translations: Record<string, string> = {
        "common.expand": "Expand",
        "common.collapse": "Collapse",
        "providerPreset.label": "Provider Preset",
        "providerPreset.custom": "Custom",
        "providerPreset.other": "Other",
      };

      return translations[key] ?? options?.defaultValue ?? key;
    },
  }),
}));

const makePreset = (name: string, category = "third_party") =>
  ({
    name,
    websiteUrl: "https://example.com",
    settingsConfig: {},
    category,
  }) as ProviderPreset;

describe("ProviderPresetSelector", () => {
  it("switches the toggle button text when expanding collapsed presets", async () => {
    const user = userEvent.setup();

    function ControlledSelector() {
      const [showAllPresets, setShowAllPresets] = useState(false);

      return (
        <ProviderPresetSelector
          selectedPresetId={null}
          presetEntries={[
            { id: "zhipu", preset: makePreset("Zhipu GLM") },
            { id: "other-provider", preset: makePreset("Other Provider") },
          ]}
          presetCategoryLabels={{}}
          showAllPresets={showAllPresets}
          onToggleShowAllPresets={() => setShowAllPresets((prev) => !prev)}
          onPresetChange={vi.fn()}
        />
      );
    }

    render(<ControlledSelector />);

    const toggleButton = screen.getByRole("button", { name: "Expand" });
    await user.click(toggleButton);

    expect(
      screen.getByRole("button", { name: "Collapse" }),
    ).toBeInTheDocument();
  });

  it("keeps selected collapsed preset visible before expansion", () => {
    render(
      <ProviderPresetSelector
        selectedPresetId="second"
        presetEntries={[
          { id: "zhipu", preset: makePreset("Zhipu GLM") },
          { id: "second", preset: makePreset("Second") },
        ]}
        presetCategoryLabels={{}}
        showAllPresets={false}
        onToggleShowAllPresets={vi.fn()}
        onPresetChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Second" })).toBeInTheDocument();
  });
});
