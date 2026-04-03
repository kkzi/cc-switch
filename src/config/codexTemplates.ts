/**
 * Codex 配置模板
 * 用于新建自定义供应商时的默认配置
 */

export interface CodexTemplate {
  auth: Record<string, any>;
  config: string;
}

/**
 * 获取 Codex 自定义模板
 * @returns Codex 模板配置
 */
export function getCodexCustomTemplate(): CodexTemplate {
  const config = `model_provider = "custom"
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
requires_openai_auth = true`;

  return {
    auth: { OPENAI_API_KEY: "" },
    config,
  };
}
