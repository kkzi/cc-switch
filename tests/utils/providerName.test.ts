import { describe, expect, it } from "vitest";
import { resolveProviderName } from "@/utils/providerName";

describe("resolveProviderName", () => {
  it("returns the explicit provider name when present", () => {
    expect(
      resolveProviderName("My Provider", ["https://api.example.com/v1"]),
    ).toBe("My Provider");
  });

  it("falls back to the first valid candidate hostname when name is empty", () => {
    expect(resolveProviderName("", ["", "https://api.example.com/v1"])).toBe(
      "api.example.com",
    );
  });

  it("returns empty string when neither name nor candidates are usable", () => {
    expect(resolveProviderName("   ", ["not-a-url"])).toBe("");
  });
});
