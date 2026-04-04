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

  it("extracts api key substrings even when wrapped by labels", () => {
    expect(
      extractProviderDraftFromClipboard(
        "https://api.labelled-example.test/v1\n令牌：sk-ExampleKey1234567890AbCdEfGhIjKlMnOpQrStUvWxYz",
      ),
    ).toEqual({
      name: "api.labelled-example.test",
      baseUrl: "https://api.labelled-example.test/v1",
      apiKey: "sk-ExampleKey1234567890AbCdEfGhIjKlMnOpQrStUvWxYz",
    });
  });

  it("extracts OPENAI_API_KEY values from structured clipboard text", () => {
    expect(
      extractProviderDraftFromClipboard(`https://code.linzefeng.top
cfcdn：url：url：https://code1.linzefeng.top
key：{
“OPENAI_API_KEY”: “sk-812b461d244d92c14ff479762a00bd9230f5e55b27a78b6b5c2c69a32522d8ba”
}`),
    ).toEqual({
      name: "code.linzefeng.top",
      baseUrl: "https://code.linzefeng.top",
      apiKey:
        "sk-812b461d244d92c14ff479762a00bd9230f5e55b27a78b6b5c2c69a32522d8ba",
    });
  });
});
