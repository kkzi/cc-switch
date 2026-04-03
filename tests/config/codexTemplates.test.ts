import { describe, expect, it } from "vitest";
import { getCodexCustomTemplate } from "@/config/codexTemplates";

describe("getCodexCustomTemplate", () => {
  it("returns the full default Codex template", () => {
    expect(getCodexCustomTemplate()).toEqual({
      auth: {
        OPENAI_API_KEY: "",
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
requires_openai_auth = true`,
    });
  });
});
