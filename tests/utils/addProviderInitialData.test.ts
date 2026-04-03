import { describe, expect, it } from "vitest";
import { buildAddProviderInitialData } from "@/utils/addProviderInitialData";

describe("buildAddProviderInitialData", () => {
  it("builds Codex clipboard initial data from the default template and enables common config", () => {
    expect(
      buildAddProviderInitialData(
        "codex",
        "sub.jia4u.de",
        "https://sub.jia4u.de",
        "sk-test_123",
      ),
    ).toEqual({
      name: "sub.jia4u.de",
      category: "custom",
      meta: {
        commonConfigEnabled: true,
      },
      settingsConfig: {
        auth: {
          OPENAI_API_KEY: "sk-test_123",
        },
        config: `model_provider = "custom"
model = "gpt-5.4"
approvals_reviewer = "user"
model_reasoning_effort = "high"
disable_response_storage = true
ask_for_approval = "never"
sandbox = "workspace-write"
skip_git_repo_check = true

[model_providers]
[model_providers.custom]
name = "custom"
wire_api = "responses"
requires_openai_auth = true
base_url = "https://sub.jia4u.de"`,
      },
    });
  });
});
