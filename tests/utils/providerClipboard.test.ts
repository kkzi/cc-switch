import { describe, expect, it } from "vitest";
import { extractProviderDraftFromClipboard } from "@/utils/providerClipboard";

describe("extractProviderDraftFromClipboard", () => {
  it("extracts the first valid url and first api key token", () => {
    expect(
      extractProviderDraftFromClipboard(
        "https://api.example.com/v1\nsk-test_123-abc",
      ),
    ).toEqual({
      name: "api.example.com",
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test_123-abc",
    });
  });

  it("returns null when clipboard text has no valid http url", () => {
    expect(
      extractProviderDraftFromClipboard("sk-test_123-abc only"),
    ).toBeNull();
  });

  it("keeps apiKey empty when only a url is present", () => {
    expect(
      extractProviderDraftFromClipboard("https://api.example.com/v1"),
    ).toEqual({
      name: "api.example.com",
      baseUrl: "https://api.example.com/v1",
      apiKey: "",
    });
  });

  it("strips trailing punctuation from the detected url", () => {
    expect(
      extractProviderDraftFromClipboard(
        "API: https://api.example.com/v1,\nKEY: sk-test_123",
      ),
    ).toEqual({
      name: "api.example.com",
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test_123",
    });
  });
});
