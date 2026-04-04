import { useTranslation } from "react-i18next";
import { FormLabel } from "@/components/ui/form";
import { ModelSuggest } from "@/components/ui/model-suggest";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import EndpointSpeedTest from "./EndpointSpeedTest";
import { ApiKeySection, EndpointField } from "./shared";
import type { ProviderCategory } from "@/types";

interface EndpointCandidate {
  url: string;
}

interface GeminiFormFieldsProps {
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

  // Base URL
  shouldShowSpeedTest: boolean;
  baseUrl: string;
  onBaseUrlChange: (url: string) => void;
  isEndpointModalOpen: boolean;
  onEndpointModalToggle: (open: boolean) => void;
  onCustomEndpointsChange: (endpoints: string[]) => void;
  autoSelect: boolean;
  onAutoSelectChange: (checked: boolean) => void;

  // Model
  shouldShowModelField: boolean;
  model: string;
  onModelChange: (value: string) => void;

  // Speed Test Endpoints
  speedTestEndpoints: EndpointCandidate[];

  onFetchModels?: () => void;
  isFetchingModels?: boolean;
  modelSuggestions?: string[];
}

export function GeminiFormFields({
  providerId,
  shouldShowApiKey,
  apiKey,
  onApiKeyChange,
  category,
  shouldShowApiKeyLink,
  websiteUrl,
  isPartner,
  partnerPromotionKey,
  shouldShowSpeedTest,
  baseUrl,
  onBaseUrlChange,
  isEndpointModalOpen,
  onEndpointModalToggle,
  onCustomEndpointsChange,
  autoSelect,
  onAutoSelectChange,
  shouldShowModelField,
  model,
  onModelChange,
  speedTestEndpoints,
  onFetchModels,
  isFetchingModels = false,
  modelSuggestions = [],
}: GeminiFormFieldsProps) {
  const { t } = useTranslation();

  // 检测是否为 Google 官方（使用 OAuth）
  const isGoogleOfficial =
    partnerPromotionKey?.toLowerCase() === "google-official";

  return (
    <>
      {/* Google OAuth 提示 */}
      {isGoogleOfficial && (
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          💡{" "}
          {t("provider.form.gemini.oauthTitle", {
            defaultValue: "OAuth 认证模式",
          })}
          ：
          {t("provider.form.gemini.oauthHint", {
            defaultValue:
              "Google 官方使用 OAuth 个人认证，无需填写 API Key。首次使用时会自动打开浏览器进行登录。",
          })}
        </p>
      )}

      {/* Base URL 输入框（统一使用与 Codex 相同的样式与交互） */}
      {shouldShowSpeedTest && (
        <EndpointField
          id="baseUrl"
          label={t("providerForm.apiEndpoint", { defaultValue: "API 端点" })}
          value={baseUrl}
          onChange={onBaseUrlChange}
          placeholder={t("providerForm.apiEndpointPlaceholder", {
            defaultValue: "https://your-api-endpoint.com/",
          })}
          onManageClick={() => onEndpointModalToggle(true)}
        />
      )}

      {/* API Key 输入框 */}
      {shouldShowApiKey && !isGoogleOfficial && (
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

      {/* Model 输入框 */}
      {shouldShowModelField && (
        <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-2">
          <FormLabel htmlFor="gemini-model" className="pt-2">
            {t("provider.form.gemini.model", { defaultValue: "模型" })}
          </FormLabel>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ModelSuggest
                id="gemini-model"
                value={model}
                onChange={(v) => onModelChange(v)}
                suggestions={modelSuggestions}
                placeholder="gemini-3-pro-preview"
              />
              {onFetchModels && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onFetchModels}
                  disabled={isFetchingModels}
                  className="h-8 shrink-0"
                >
                  {isFetchingModels && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  {t("providerForm.autoFetchModels", {
                    defaultValue: "自动获取模型",
                  })}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 端点测速弹窗 */}
      {shouldShowSpeedTest && isEndpointModalOpen && (
        <EndpointSpeedTest
          appId="gemini"
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
    </>
  );
}
