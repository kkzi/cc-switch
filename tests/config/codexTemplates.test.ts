import { describe, expect, it } from "vitest";
import { parse as parseToml } from "smol-toml";
import { getCodexCustomTemplate } from "@/config/codexTemplates";

describe("Codex custom templates", () => {
  it("returns the default custom provider template without forcing Goal mode", () => {
    const template = getCodexCustomTemplate();
    const parsed = parseToml(template.config) as {
      features?: { goals?: boolean };
      model?: string;
      approvals_reviewer?: string;
      ask_for_approval?: string;
      sandbox?: string;
      skip_git_repo_check?: boolean;
      model_providers?: Record<string, unknown>;
    };

    expect(template.auth).toEqual({ OPENAI_API_KEY: "" });
    expect(parsed.model).toBe("gpt-5.5");
    expect(parsed.approvals_reviewer).toBe("user");
    expect(parsed.ask_for_approval).toBe("never");
    expect(parsed.sandbox).toBe("workspace-write");
    expect(parsed.skip_git_repo_check).toBe(true);
    expect(parsed.features?.goals).toBeUndefined();
    expect(parsed.model_providers?.custom).toBeDefined();
  });
});
