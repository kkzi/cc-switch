import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Download, Loader2, Wand2 } from "lucide-react";
import EndpointSpeedTest from "./EndpointSpeedTest";
import { ApiKeySection, EndpointField, ModelInputWithFetch } from "./shared";
import { CopilotAuthSection } from "./CopilotAuthSection";
import { CodexOAuthSection } from "./CodexOAuthSection";
import {
  copilotGetModels,
  copilotGetModelsForAccount,
} from "@/lib/api/copilot";
import type { CopilotModel } from "@/lib/api/copilot";
import {
  fetchModelsForConfig,
  showFetchModelsError,
  type FetchedModel,
} from "@/lib/api/model-fetch";
import type {
  ProviderCategory,
  ClaudeApiFormat,
  ClaudeApiKeyField,
} from "@/types";
import {
  providerPresets,
  type TemplateValueConfig,
} from "@/config/claudeProviderPresets";

interface EndpointCandidate {
  url: string;
}

interface ClaudeFormFieldsProps {
  providerId?: string;
  // API Key
  shouldShowApiKey: boolean;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  category?: ProviderCategory;
  shouldShowApiKeyLink: boolean;
  websiteUrl: string;
  isPartner?: boolean;
  partnerPromotionKey?: string;

  // GitHub Copilot OAuth
  isCopilotPreset?: boolean;
  usesOAuth?: boolean;
  isCopilotAuthenticated?: boolean;
  /** 当前选中的 GitHub 账号 ID（多账号支持） */
  selectedGitHubAccountId?: string | null;
  /** GitHub 账号选择回调（多账号支持） */
  onGitHubAccountSelect?: (accountId: string | null) => void;

  // Codex OAuth (ChatGPT Plus/Pro)
  isCodexOauthPreset?: boolean;
  isCodexOauthAuthenticated?: boolean;
  selectedCodexAccountId?: string | null;
  onCodexAccountSelect?: (accountId: string | null) => void;
  codexFastMode?: boolean;
  onCodexFastModeChange?: (enabled: boolean) => void;

  // Template Values
  templateValueEntries: Array<[string, TemplateValueConfig]>;
  templateValues: Record<string, TemplateValueConfig>;
  templatePresetName: string;
  onTemplateValueChange: (key: string, value: string) => void;

  // Base URL
  shouldShowSpeedTest: boolean;
  baseUrl: string;
  onBaseUrlChange: (url: string) => void;
  isEndpointModalOpen: boolean;
  onEndpointModalToggle: (open: boolean) => void;
  onCustomEndpointsChange?: (endpoints: string[]) => void;
  autoSelect: boolean;
  onAutoSelectChange: (checked: boolean) => void;
  showEndpointTools?: boolean;

  // Model Selector
  shouldShowModelSelector: boolean;
  claudeModel: string;
  defaultHaikuModel: string;
  defaultSonnetModel: string;
  defaultOpusModel: string;
  onModelChange: (
    field:
      | "ANTHROPIC_MODEL"
      | "ANTHROPIC_DEFAULT_HAIKU_MODEL"
      | "ANTHROPIC_DEFAULT_SONNET_MODEL"
      | "ANTHROPIC_DEFAULT_OPUS_MODEL",
    value: string,
  ) => void;

  // Speed Test Endpoints
  speedTestEndpoints: EndpointCandidate[];

  // API Format (for Claude-compatible providers that need request/response conversion)
  apiFormat: ClaudeApiFormat;
  onApiFormatChange: (format: ClaudeApiFormat) => void;

  // Auth Field (ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY)
  apiKeyField: ClaudeApiKeyField;
  onApiKeyFieldChange: (field: ClaudeApiKeyField) => void;

  // Full URL mode
  isFullUrl: boolean;
  onFullUrlChange: (value: boolean) => void;
}

export function ClaudeFormFields({
  providerId,
  shouldShowApiKey,
  apiKey,
  onApiKeyChange,
  category,
  shouldShowApiKeyLink,
  websiteUrl,
  isPartner,
  partnerPromotionKey,
  isCopilotPreset,
  usesOAuth,
  isCopilotAuthenticated,
  selectedGitHubAccountId,
  onGitHubAccountSelect,
  isCodexOauthPreset,
  selectedCodexAccountId,
  onCodexAccountSelect,
  codexFastMode,
  onCodexFastModeChange,
  templateValueEntries,
  templateValues,
  templatePresetName,
  onTemplateValueChange,
  shouldShowSpeedTest,
  baseUrl,
  onBaseUrlChange,
  isEndpointModalOpen,
  onEndpointModalToggle,
  onCustomEndpointsChange,
  autoSelect,
  onAutoSelectChange,
  showEndpointTools = true,
  shouldShowModelSelector,
  claudeModel,
  defaultHaikuModel,
  defaultSonnetModel,
  defaultOpusModel,
  onModelChange,
  speedTestEndpoints,
  apiFormat,
  onApiFormatChange,
  apiKeyField,
  onApiKeyFieldChange,
  isFullUrl,
  onFullUrlChange,
}: ClaudeFormFieldsProps) {
  const { t } = useTranslation();
  // Copilot 可用模型列表
  const [copilotModels, setCopilotModels] = useState<CopilotModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // 通用模型获取（非 Copilot 供应商）
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const handleFetchModels = useCallback(() => {
    if (!baseUrl || !apiKey) {
      showFetchModelsError(null, t, {
        hasApiKey: !!apiKey,
        hasBaseUrl: !!baseUrl,
      });
      return;
    }
    // 当 baseURL 仍是某预设的默认值时，优先使用预设上的 modelsUrl 覆写
    // 避免多走一次失败的候选请求（如 DeepSeek 把 /models 挂在根，而不是 /anthropic 子路径下）
    const matchedPreset = providerPresets.find((p) => {
      const env = (p.settingsConfig as { env?: Record<string, string> })?.env;
      return env?.ANTHROPIC_BASE_URL === baseUrl;
    });
    const modelsUrl = matchedPreset?.modelsUrl;

    setIsFetchingModels(true);
    fetchModelsForConfig(baseUrl, apiKey, isFullUrl, modelsUrl)
      .then((models) => {
        setFetchedModels(models);
        if (models.length === 0) {
          toast.info(t("providerForm.fetchModelsEmpty"));
        } else {
          toast.success(
            t("providerForm.fetchModelsSuccess", { count: models.length }),
          );
        }
      })
      .catch((err) => {
        console.warn("[ModelFetch] Failed:", err);
        showFetchModelsError(err, t);
      })
      .finally(() => setIsFetchingModels(false));
  }, [baseUrl, apiKey, isFullUrl, t]);

  // 当 Copilot 预设且已认证时，加载可用模型
  useEffect(() => {
    // 如果不是 Copilot 预设或未认证，清空模型列表
    if (!isCopilotPreset || !isCopilotAuthenticated) {
      setCopilotModels([]);
      setModelsLoading(false);
      return;
    }

    let cancelled = false;
    setModelsLoading(true);
    const fetchModels = selectedGitHubAccountId
      ? copilotGetModelsForAccount(selectedGitHubAccountId)
      : copilotGetModels();

    fetchModels
      .then((models) => {
        if (!cancelled) setCopilotModels(models);
      })
      .catch((err) => {
        console.warn("[Copilot] Failed to fetch models:", err);
        if (!cancelled) {
          toast.error(
            t("copilot.loadModelsFailed", {
              defaultValue: "加载 Copilot 模型列表失败",
            }),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isCopilotPreset, isCopilotAuthenticated, selectedGitHubAccountId]);

  // 模型输入框：支持手动输入 + 下拉选择
  const renderModelInput = (
    id: string,
    value: string,
    field: ClaudeFormFieldsProps["onModelChange"] extends (
      f: infer F,
      v: string,
    ) => void
      ? F
      : never,
    placeholder?: string,
  ) => {
    if (isCopilotPreset && copilotModels.length > 0) {
      // 按 vendor 分组
      const grouped: Record<string, CopilotModel[]> = {};
      for (const model of copilotModels) {
        const vendor = model.vendor || "Other";
        if (!grouped[vendor]) grouped[vendor] = [];
        grouped[vendor].push(model);
      }
      const vendors = Object.keys(grouped).sort();

      return (
        <div className="flex gap-1">
          <Input
            id={id}
            type="text"
            value={value}
            onChange={(e) => onModelChange(field, e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            className="flex-1"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-64 overflow-y-auto z-[200]"
            >
              {vendors.map((vendor, vi) => (
                <div key={vendor}>
                  {vi > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel>{vendor}</DropdownMenuLabel>
                  {grouped[vendor].map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      onSelect={() => onModelChange(field, model.id)}
                    >
                      {model.id}
                    </DropdownMenuItem>
                  ))}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }

    if (isCopilotPreset && modelsLoading) {
      return (
        <div className="flex gap-1">
          <Input
            id={id}
            type="text"
            value={value}
            onChange={(e) => onModelChange(field, e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            className="flex-1"
          />
          <Button variant="outline" size="icon" className="shrink-0" disabled>
            <Loader2 className="h-4 w-4 animate-spin" />
          </Button>
        </div>
      );
    }

    // 非 Copilot 供应商: 使用 ModelInputWithFetch（获取按钮在 section 标题旁）
    return (
      <ModelInputWithFetch
        id={id}
        value={value}
        onChange={(v) => onModelChange(field, v)}
        placeholder={placeholder}
        fetchedModels={fetchedModels}
        isLoading={isFetchingModels}
      />
    );
  };

  return (
    <>
      {/* GitHub Copilot OAuth 认证 */}
      {isCopilotPreset && (
        <CopilotAuthSection
          selectedAccountId={selectedGitHubAccountId}
          onAccountSelect={onGitHubAccountSelect}
        />
      )}

      {/* Codex OAuth 认证 (ChatGPT Plus/Pro) */}
      {isCodexOauthPreset && (
        <CodexOAuthSection
          selectedAccountId={selectedCodexAccountId}
          onAccountSelect={onCodexAccountSelect}
          fastModeEnabled={codexFastMode}
          onFastModeChange={onCodexFastModeChange}
        />
      )}

      {/* 模板变量输入 */}
      {templateValueEntries.length > 0 && (
        <div className="space-y-3">
          <FormLabel>
            {t("providerForm.parameterConfig", {
              name: templatePresetName,
              defaultValue: `${templatePresetName} 参数配置`,
            })}
          </FormLabel>
          <div className="space-y-4">
            {templateValueEntries.map(([key, config]) => (
              <div key={key} className="space-y-2">
                <FormLabel htmlFor={`template-${key}`}>
                  {config.label}
                </FormLabel>
                <Input
                  id={`template-${key}`}
                  type="text"
                  required
                  value={
                    templateValues[key]?.editorValue ??
                    config.editorValue ??
                    config.defaultValue ??
                    ""
                  }
                  onChange={(e) => onTemplateValueChange(key, e.target.value)}
                  placeholder={config.placeholder || config.label}
                  autoComplete="off"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Base URL 输入框 */}
      {shouldShowSpeedTest && (
        <EndpointField
          id="baseUrl"
          label={t("providerForm.apiEndpoint")}
          value={baseUrl}
          onChange={onBaseUrlChange}
          placeholder={t("providerForm.apiEndpointPlaceholder")}
          hint={
            apiFormat === "openai_responses"
              ? t("providerForm.apiHintResponses")
              : apiFormat === "openai_chat"
                ? t("providerForm.apiHintOAI")
                : apiFormat === "gemini_native"
                  ? t("providerForm.apiHintGeminiNative")
                  : ""
          }
          fullUrlHint={
            apiFormat === "gemini_native"
              ? t("providerForm.fullUrlHintGeminiNative")
              : undefined
          }
          showManageButton={showEndpointTools}
          onManageClick={
            showEndpointTools ? () => onEndpointModalToggle(true) : undefined
          }
          showFullUrlToggle={showEndpointTools}
          isFullUrl={isFullUrl}
          onFullUrlChange={onFullUrlChange}
        />
      )}

      {/* API Key 输入框（非 OAuth 预设时显示） */}
      {shouldShowApiKey && !usesOAuth && (
        <ApiKeySection
          value={apiKey}
          onChange={onApiKeyChange}
          category={category}
          shouldShowLink={shouldShowApiKeyLink}
          websiteUrl={websiteUrl}
          isPartner={isPartner}
          partnerPromotionKey={partnerPromotionKey}
        />
      )}

      {/* 端点测速弹窗 */}
      {shouldShowSpeedTest && showEndpointTools && isEndpointModalOpen && (
        <EndpointSpeedTest
          appId="claude"
          providerId={providerId}
          value={baseUrl}
          onChange={onBaseUrlChange}
          initialEndpoints={speedTestEndpoints}
          visible={isEndpointModalOpen}
          onClose={() => onEndpointModalToggle(false)}
          autoSelect={autoSelect}
          onAutoSelectChange={onAutoSelectChange}
          onCustomEndpointsChange={onCustomEndpointsChange}
        />
      )}

      {/* Claude 配置项 */}
      {shouldShowModelSelector && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[96px_minmax(0,1fr)_96px_minmax(0,1fr)] md:items-center md:gap-2">
            {/* API 格式选择（仅非云服务商显示） */}
            {category !== "cloud_provider" ? (
              <>
                <FormLabel
                  htmlFor="apiFormat"
                  className="font-medium leading-8 text-muted-foreground"
                >
                  {t("providerForm.apiFormat", { defaultValue: "API 格式" })}
                </FormLabel>
                <Select value={apiFormat} onValueChange={onApiFormatChange}>
                  <SelectTrigger id="apiFormat" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic">
                      {t("providerForm.apiFormatAnthropic", {
                        defaultValue: "Anthropic Messages (原生)",
                      })}
                    </SelectItem>
                    <SelectItem value="openai_chat">
                      {t("providerForm.apiFormatOpenAIChat", {
                        defaultValue: "OpenAI Chat Completions (需转换)",
                      })}
                    </SelectItem>
                    <SelectItem value="openai_responses">
                      {t("providerForm.apiFormatOpenAIResponses", {
                        defaultValue: "OpenAI Responses API (需转换)",
                      })}
                    </SelectItem>
                    <SelectItem value="gemini_native">
                      {t("providerForm.apiFormatGeminiNative", {
                        defaultValue: "Gemini Native generateContent (需转换)",
                      })}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </>
            ) : (
              <div className="hidden md:block md:col-span-2" />
            )}

            {/* 认证字段选择器 */}
            <FormLabel className="font-medium leading-8 text-muted-foreground md:text-right">
              {t("providerForm.authField", { defaultValue: "认证字段" })}
            </FormLabel>
            <Select
              value={apiKeyField}
              onValueChange={(v) => onApiKeyFieldChange(v as ClaudeApiKeyField)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ANTHROPIC_AUTH_TOKEN">
                  {t("providerForm.authFieldAuthToken", {
                    defaultValue: "ANTHROPIC_AUTH_TOKEN（默认）",
                  })}
                </SelectItem>
                <SelectItem value="ANTHROPIC_API_KEY">
                  {t("providerForm.authFieldApiKey", {
                    defaultValue: "ANTHROPIC_API_KEY",
                  })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 模型映射 */}
          <div className="grid grid-cols-1 gap-3 border-t pt-4 md:grid-cols-[96px_minmax(0,1fr)] md:items-center md:gap-2">
            <FormLabel className="font-medium leading-8 text-muted-foreground">
              {t("providerForm.modelMappingLabel")}
            </FormLabel>
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1" />
              <div className="flex flex-wrap gap-2">
                {!isCopilotPreset && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleFetchModels}
                    disabled={isFetchingModels}
                    className="h-7 gap-1"
                  >
                    {isFetchingModels ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    {t("providerForm.fetchModels")}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const value =
                      claudeModel ||
                      defaultHaikuModel ||
                      defaultSonnetModel ||
                      defaultOpusModel;
                    if (value) {
                      onModelChange("ANTHROPIC_MODEL", value);
                      onModelChange("ANTHROPIC_DEFAULT_HAIKU_MODEL", value);
                      onModelChange("ANTHROPIC_DEFAULT_SONNET_MODEL", value);
                      onModelChange("ANTHROPIC_DEFAULT_OPUS_MODEL", value);
                      toast.success(
                        t("providerForm.quickSetSuccess", {
                          defaultValue: "已将模型名称应用到所有字段",
                        }),
                      );
                    }
                  }}
                  disabled={
                    !claudeModel &&
                    !defaultHaikuModel &&
                    !defaultSonnetModel &&
                    !defaultOpusModel
                  }
                  className="h-7 gap-1"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  {t("providerForm.quickSetModels", {
                    defaultValue: "一键设置",
                  })}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[96px_minmax(0,1fr)_96px_minmax(0,1fr)] md:items-center md:gap-2">
            {/* 主模型 */}
            <FormLabel
              htmlFor="claudeModel"
              className="font-medium leading-8 text-muted-foreground"
            >
              {t("providerForm.anthropicModel", {
                defaultValue: "主模型",
              })}
            </FormLabel>
            {renderModelInput(
              "claudeModel",
              claudeModel,
              "ANTHROPIC_MODEL",
              t("providerForm.modelPlaceholder", { defaultValue: "" }),
            )}

            {/* 默认 Haiku */}
            <FormLabel
              htmlFor="claudeDefaultHaikuModel"
              className="font-medium leading-8 text-muted-foreground md:text-right"
            >
              {t("providerForm.anthropicDefaultHaikuModel", {
                defaultValue: "Haiku 模型",
              })}
            </FormLabel>
            {renderModelInput(
              "claudeDefaultHaikuModel",
              defaultHaikuModel,
              "ANTHROPIC_DEFAULT_HAIKU_MODEL",
              t("providerForm.haikuModelPlaceholder", { defaultValue: "" }),
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[96px_minmax(0,1fr)_96px_minmax(0,1fr)] md:items-center md:gap-2">
            {/* 默认 Sonnet */}
            <FormLabel
              htmlFor="claudeDefaultSonnetModel"
              className="font-medium leading-8 text-muted-foreground"
            >
              {t("providerForm.anthropicDefaultSonnetModel", {
                defaultValue: "Sonnet 模型",
              })}
            </FormLabel>
            {renderModelInput(
              "claudeDefaultSonnetModel",
              defaultSonnetModel,
              "ANTHROPIC_DEFAULT_SONNET_MODEL",
              t("providerForm.modelPlaceholder", { defaultValue: "" }),
            )}

            {/* 默认 Opus */}
            <FormLabel
              htmlFor="claudeDefaultOpusModel"
              className="font-medium leading-8 text-muted-foreground md:text-right"
            >
              {t("providerForm.anthropicDefaultOpusModel", {
                defaultValue: "Opus 模型",
              })}
            </FormLabel>
            {renderModelInput(
              "claudeDefaultOpusModel",
              defaultOpusModel,
              "ANTHROPIC_DEFAULT_OPUS_MODEL",
              t("providerForm.modelPlaceholder", { defaultValue: "" }),
            )}
          </div>
        </div>
      )}
    </>
  );
}
