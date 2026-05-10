import type { AppId } from "@/lib/api";
import { getCodexCustomTemplate } from "@/config/codexTemplates";
import type { AddProviderInitialData } from "@/components/providers/AddProviderDialog";
import { setCodexBaseUrl } from "@/utils/providerConfigUtils";
import { resolveProviderName } from "@/utils/providerName";

export function buildAddProviderInitialData(
  appId: AppId,
  name: string,
  baseUrl: string,
  apiKey: string,
): AddProviderInitialData {
  const resolvedName = resolveProviderName(name, [baseUrl]);

  switch (appId) {
    case "codex": {
      const template = getCodexCustomTemplate();

      return {
        name: resolvedName,
        category: "custom",
        meta: {
          commonConfigEnabled: true,
        },
        settingsConfig: {
          auth: {
            OPENAI_API_KEY: apiKey,
          },
          config: setCodexBaseUrl(template.config, baseUrl),
        },
      };
    }
    case "gemini":
      return {
        name: resolvedName,
        category: "custom",
        settingsConfig: {
          env: {
            GOOGLE_GEMINI_BASE_URL: baseUrl,
            GEMINI_API_KEY: apiKey,
          },
        },
      };
    case "opencode":
      return {
        name: resolvedName,
        category: "custom",
        settingsConfig: {
          npm: "@ai-sdk/openai-compatible",
          options: {
            baseURL: baseUrl,
            apiKey,
            setCacheKey: true,
          },
          models: {},
        },
      };
    case "openclaw":
      return {
        name: resolvedName,
        category: "custom",
        settingsConfig: {
          baseUrl,
          apiKey,
          api: "openai-completions",
          models: [],
        },
      };
    case "claude":
    default:
      return {
        name: resolvedName,
        category: "custom",
        settingsConfig: {
          env: {
            ANTHROPIC_BASE_URL: baseUrl,
            ANTHROPIC_AUTH_TOKEN: apiKey,
          },
          config: {},
        },
      };
  }
}
