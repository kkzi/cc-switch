import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { ProviderPresetSelector } from "@/components/providers/forms/ProviderPresetSelector";

vi.mock("@/components/ui/form", () => ({
  FormLabel: ({ children }: { children: ReactNode }) => <label>{children}</label>,
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

describe("ProviderPresetSelector", () => {
  it("switches the toggle button text when expanding collapsed presets", async () => {
    const user = userEvent.setup();
    const makePreset = (name: string) =>
      ({
        name,
        websiteUrl: "https://example.com",
        settingsConfig: {},
      }) as const;

    function ControlledSelector() {
      const [showAllPresets, setShowAllPresets] = useState(false);

      return (
        <ProviderPresetSelector
          selectedPresetId={null}
          groupedPresets={{
            featured: [
              {
                id: "zhipu",
                preset: makePreset("Zhipu GLM"),
              },
            ],
            others: [
              {
                id: "other-provider",
                preset: makePreset("Other Provider"),
              },
            ],
          }}
          categoryKeys={["featured", "others"]}
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
});
