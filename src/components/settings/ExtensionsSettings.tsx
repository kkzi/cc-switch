import { useCallback, useEffect, useMemo, useState } from "react";
import { Link2, Loader2, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  settingsApi,
  type ResponseErrorDetectionConfig,
} from "@/lib/api/settings";
import { isLinux, isWindows } from "@/lib/platform";
import { extractErrorMessage } from "@/utils/errorUtils";

const DEFAULT_CONFIG: ResponseErrorDetectionConfig = {
  enabled: false,
  keywords: [],
  sseScanChunks: 8,
  sseScanBytes: 32768,
};

function normalizeKeywordsText(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  );
}

export function ExtensionsSettings() {
  const { t } = useTranslation();
  const [config, setConfig] =
    useState<ResponseErrorDetectionConfig>(DEFAULT_CONFIG);
  const [savedConfig, setSavedConfig] =
    useState<ResponseErrorDetectionConfig>(DEFAULT_CONFIG);
  const [keywordsText, setKeywordsText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegisteringProtocol, setIsRegisteringProtocol] = useState(false);

  useEffect(() => {
    let mounted = true;
    settingsApi
      .getResponseErrorDetectionConfig()
      .then((loaded) => {
        if (!mounted) return;
        const next = { ...DEFAULT_CONFIG, ...loaded };
        setConfig(next);
        setSavedConfig(next);
        setKeywordsText(next.keywords.join("\n"));
      })
      .catch((error) => {
        console.error("Failed to load response error detection config", error);
        toast.error(String(error));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const nextConfig = useMemo<ResponseErrorDetectionConfig>(
    () => ({
      ...config,
      keywords: normalizeKeywordsText(keywordsText),
      sseScanChunks: Math.max(1, Math.trunc(config.sseScanChunks || 1)),
      sseScanBytes: Math.max(1024, Math.trunc(config.sseScanBytes || 1024)),
    }),
    [config, keywordsText],
  );

  const isDirty = useMemo(
    () => JSON.stringify(nextConfig) !== JSON.stringify(savedConfig),
    [nextConfig, savedConfig],
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await settingsApi.setResponseErrorDetectionConfig(nextConfig);
      setConfig(nextConfig);
      setSavedConfig(nextConfig);
      setKeywordsText(nextConfig.keywords.join("\n"));
      toast.success(t("settings.extensions.responseErrors.saved"));
    } catch (error) {
      console.error("Failed to save response error detection config", error);
      toast.error(String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegisterDeepLinkProtocols = useCallback(async () => {
    setIsRegisteringProtocol(true);
    try {
      await settingsApi.registerDeepLinkProtocols();
      toast.success(t("settings.deepLinkRegistered"), { closeButton: true });
    } catch (error) {
      console.error(
        "[ExtensionsSettings] Failed to register deep link protocols",
        error,
      );
      toast.error(t("settings.deepLinkRegisterFailed"), {
        description: extractErrorMessage(error) || undefined,
        closeButton: true,
      });
    } finally {
      setIsRegisteringProtocol(false);
    }
  }, [t]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(isWindows() || isLinux()) && (
        <div className="glass-card overflow-hidden border border-border-default">
          <div className="border-b border-border/50 px-4 py-3">
            <h3 className="text-base font-semibold">
              {t("settings.extensions.schema.title")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("settings.extensions.schema.description")}
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-4">
            <div className="space-y-0.5">
              <Label>{t("settings.registerDeepLink")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("settings.extensions.schema.registerDescription")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleRegisterDeepLinkProtocols}
              disabled={isRegisteringProtocol}
              className="gap-1.5"
            >
              {isRegisteringProtocol ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("settings.registeringDeepLink")}
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" />
                  {t("settings.registerDeepLink")}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden border border-border-default">
        <div className="border-b border-border/50 px-4 py-3">
          <h3 className="text-base font-semibold">
            {t("settings.extensions.responseErrors.title")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("settings.extensions.responseErrors.description")}
          </p>
        </div>

        <div className="space-y-5 px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>{t("settings.extensions.responseErrors.enabled")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("settings.extensions.responseErrors.enabledDescription")}
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(enabled) =>
                setConfig((current) => ({ ...current, enabled }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="response-error-keywords">
              {t("settings.extensions.responseErrors.keywords")}
            </Label>
            <Textarea
              id="response-error-keywords"
              value={keywordsText}
              onChange={(event) => setKeywordsText(event.target.value)}
              placeholder={t(
                "settings.extensions.responseErrors.keywordsPlaceholder",
              )}
              className="min-h-32 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.extensions.responseErrors.keywordsDescription")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sse-scan-chunks">
                {t("settings.extensions.responseErrors.sseScanChunks")}
              </Label>
              <Input
                id="sse-scan-chunks"
                type="number"
                min={1}
                max={64}
                value={config.sseScanChunks}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    sseScanChunks: Number(event.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sse-scan-bytes">
                {t("settings.extensions.responseErrors.sseScanBytes")}
              </Label>
              <Input
                id="sse-scan-bytes"
                type="number"
                min={1024}
                step={1024}
                value={config.sseScanBytes}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    sseScanBytes: Number(event.target.value),
                  }))
                }
              />
            </div>
          </div>

          <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            {t("settings.extensions.responseErrors.sseNote")}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!isDirty || isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t("common.save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
