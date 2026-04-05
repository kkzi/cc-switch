import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FormLabel } from "@/components/ui/form";
import { ClaudeIcon, CodexIcon, GeminiIcon } from "@/components/BrandIcons";
import { Zap, Star, Layers, Settings2 } from "lucide-react";
import type { ProviderPreset } from "@/config/claudeProviderPresets";
import type { CodexProviderPreset } from "@/config/codexProviderPresets";
import type { GeminiProviderPreset } from "@/config/geminiProviderPresets";
import type { ProviderCategory } from "@/types";
import {
  universalProviderPresets,
  type UniversalProviderPreset,
} from "@/config/universalProviderPresets";
import { ProviderIcon } from "@/components/ProviderIcon";

type PresetEntry = {
  id: string;
  preset: ProviderPreset | CodexProviderPreset | GeminiProviderPreset;
};

interface ProviderPresetSelectorProps {
  selectedPresetId: string | null;
  groupedPresets: Record<string, PresetEntry[]>;
  categoryKeys: string[];
  presetCategoryLabels: Record<string, string>;
  onPresetChange: (value: string) => void;
  onUniversalPresetSelect?: (preset: UniversalProviderPreset) => void;
  onManageUniversalProviders?: () => void;
  category?: ProviderCategory; // 当前选中的分类
}

export function ProviderPresetSelector({
  selectedPresetId,
  groupedPresets,
  categoryKeys,
  presetCategoryLabels,
  onPresetChange,
  onUniversalPresetSelect,
  onManageUniversalProviders,
  category,
}: ProviderPresetSelectorProps) {
  const { t } = useTranslation();
  const [showAllPresets, setShowAllPresets] = useState(false);

  const normalizePresetLabel = (label: string) =>
    label.toLowerCase().replace(/\s+/g, " ").trim();

  const resolvePresetName = (
    preset: ProviderPreset | CodexProviderPreset | GeminiProviderPreset,
  ) => (preset.nameKey ? t(preset.nameKey) : preset.name);

  const allPresetEntries = useMemo(
    () => categoryKeys.flatMap((key) => groupedPresets[key] ?? []),
    [categoryKeys, groupedPresets],
  );

  const featuredPresetEntries = useMemo(() => {
    const shortcuts = [
      (label: string) =>
        label === "zhipu glm" ||
        label === "zhupu glm" ||
        label.startsWith("zhipu glm "),
      (label: string) =>
        label === "minimax" || label.startsWith("minimax "),
      (label: string) => label === "kimi" || label.startsWith("kimi "),
      (label: string) => label === "nvidia" || label.startsWith("nvidia "),
    ];

    const pickedIds = new Set<string>();
    const featured: PresetEntry[] = [];

    for (const match of shortcuts) {
      const found = allPresetEntries.find((entry) => {
        if (pickedIds.has(entry.id)) {
          return false;
        }
        return match(normalizePresetLabel(resolvePresetName(entry.preset)));
      });

      if (found) {
        featured.push(found);
        pickedIds.add(found.id);
      }
    }

    return featured;
  }, [allPresetEntries, t]);

  const collapsedPresetEntries = useMemo(
    () =>
      allPresetEntries.filter(
        (entry) =>
          !featuredPresetEntries.some((visible) => visible.id === entry.id),
      ),
    [allPresetEntries, featuredPresetEntries],
  );

  const selectedCollapsedEntry = useMemo(() => {
    if (!selectedPresetId || selectedPresetId === "custom" || showAllPresets) {
      return null;
    }

    return (
      collapsedPresetEntries.find((entry) => entry.id === selectedPresetId) ??
      null
    );
  }, [collapsedPresetEntries, selectedPresetId, showAllPresets]);

  const firstRowPresetEntries = selectedCollapsedEntry
    ? [...featuredPresetEntries, selectedCollapsedEntry]
    : featuredPresetEntries;

  const getCategoryHint = (): React.ReactNode => {
    switch (category) {
      case "official":
        return t("providerForm.officialHint", {
          defaultValue: "💡 官方供应商使用浏览器登录，无需配置 API Key",
        });
      case "cn_official":
        return t("providerForm.cnOfficialApiKeyHint", {
          defaultValue: "💡 国产官方供应商只需填写 API Key，请求地址已预设",
        });
      case "aggregator":
        return t("providerForm.aggregatorApiKeyHint", {
          defaultValue: "💡 聚合服务供应商只需填写 API Key 即可使用",
        });
      case "third_party":
        return t("providerForm.thirdPartyApiKeyHint", {
          defaultValue: "💡 第三方供应商需要填写 API Key 和请求地址",
        });
      case "custom":
        return t("providerForm.customApiKeyHint", {
          defaultValue: "💡 自定义配置需手动填写所有必要字段",
        });
      case "omo":
        return t("providerForm.omoHint", {
          defaultValue:
            "💡 OMO 配置管理 Agent 模型分配，兼容 oh-my-openagent.jsonc / oh-my-opencode.jsonc",
        });
      default:
        return t("providerPreset.hint", {
          defaultValue: "选择预设后可继续调整下方字段。",
        });
    }
  };

  const renderPresetIcon = (
    preset: ProviderPreset | CodexProviderPreset | GeminiProviderPreset,
  ) => {
    const iconType = preset.theme?.icon;
    if (!iconType) return null;

    switch (iconType) {
      case "claude":
        return <ClaudeIcon size={14} />;
      case "codex":
        return <CodexIcon size={14} />;
      case "gemini":
        return <GeminiIcon size={14} />;
      case "generic":
        return <Zap size={14} />;
      default:
        return null;
    }
  };

  const getPresetButtonClass = (
    isSelected: boolean,
    preset: ProviderPreset | CodexProviderPreset | GeminiProviderPreset,
  ) => {
    const baseClass =
      "inline-flex h-8 items-center gap-2 border px-2.5 text-sm font-medium";

    if (isSelected) {
      if (preset.theme?.backgroundColor) {
        return `${baseClass} text-white`;
      }
      return `${baseClass} border-foreground bg-foreground text-background`;
    }

    return `${baseClass} border-border-default bg-background text-muted-foreground hover:bg-muted`;
  };

  const getPresetButtonStyle = (
    isSelected: boolean,
    preset: ProviderPreset | CodexProviderPreset | GeminiProviderPreset,
  ) => {
    if (!isSelected || !preset.theme?.backgroundColor) {
      return undefined;
    }

    return {
      backgroundColor: preset.theme.backgroundColor,
      color: preset.theme.textColor || "#FFFFFF",
    };
  };

  return (
    <div className="space-y-2">
      <FormLabel>{t("providerPreset.label")}</FormLabel>
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPresetChange("custom")}
            className={`inline-flex h-8 items-center gap-2 border px-2.5 text-sm font-medium ${
              selectedPresetId === "custom"
                ? "border-foreground bg-foreground text-background"
                : "border-border-default bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            {t("providerPreset.custom")}
          </button>

          {firstRowPresetEntries.map((entry) => {
            const categoryKey =
              categoryKeys.find((key) =>
                (groupedPresets[key] ?? []).some((item) => item.id === entry.id),
              ) ?? "others";
            const isSelected = selectedPresetId === entry.id;
            const isPartner = entry.preset.isPartner;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onPresetChange(entry.id)}
                className={`${getPresetButtonClass(isSelected, entry.preset)} relative`}
                style={getPresetButtonStyle(isSelected, entry.preset)}
                title={
                  presetCategoryLabels[categoryKey] ?? t("providerPreset.other")
                }
              >
                {renderPresetIcon(entry.preset)}
                {resolvePresetName(entry.preset)}
                {isPartner && (
                  <span className="absolute -top-1 -right-1 flex items-center gap-0.5 border border-amber-500 bg-amber-500 px-1 text-[10px] font-bold text-white">
                    <Star className="h-2.5 w-2.5 fill-current" />
                  </span>
                )}
              </button>
            );
          })}

          {collapsedPresetEntries.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAllPresets((prev) => !prev)}
              className="inline-flex h-8 items-center gap-2 border border-border-default bg-background px-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              {showAllPresets ? t("common.collapse") : t("common.expand")}
            </button>
          )}
        </div>

        {showAllPresets && collapsedPresetEntries.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {collapsedPresetEntries.map((entry) => {
              const categoryKey =
                categoryKeys.find((key) =>
                  (groupedPresets[key] ?? []).some((item) => item.id === entry.id),
                ) ?? "others";
              const isSelected = selectedPresetId === entry.id;
              const isPartner = entry.preset.isPartner;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onPresetChange(entry.id)}
                  className={`${getPresetButtonClass(isSelected, entry.preset)} relative`}
                  style={getPresetButtonStyle(isSelected, entry.preset)}
                  title={
                    presetCategoryLabels[categoryKey] ?? t("providerPreset.other")
                  }
                >
                  {renderPresetIcon(entry.preset)}
                  {resolvePresetName(entry.preset)}
                  {isPartner && (
                    <span className="absolute -top-1 -right-1 flex items-center gap-0.5 border border-amber-500 bg-amber-500 px-1 text-[10px] font-bold text-white">
                      <Star className="h-2.5 w-2.5 fill-current" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {onUniversalPresetSelect && universalProviderPresets.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {universalProviderPresets.map((preset) => (
              <button
                key={`universal-${preset.providerType}`}
                type="button"
                onClick={() => onUniversalPresetSelect(preset)}
                className="relative inline-flex h-8 items-center gap-2 border border-border-default bg-background px-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
                title={t("universalProvider.hint", {
                  defaultValue:
                    "跨应用统一配置，自动同步到 Claude/Codex/Gemini",
                })}
              >
                <ProviderIcon icon={preset.icon} name={preset.name} size={14} />
                {preset.name}
                <span className="absolute -top-1 -right-1 flex items-center gap-0.5 border border-foreground bg-foreground px-1 text-[10px] font-bold text-background">
                  <Layers className="h-2.5 w-2.5" />
                </span>
              </button>
            ))}
            {onManageUniversalProviders && (
              <button
                type="button"
                onClick={onManageUniversalProviders}
                className="inline-flex h-8 items-center gap-2 border border-border-default bg-background px-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
                title={t("universalProvider.manage", {
                  defaultValue: "管理统一供应商",
                })}
              >
                <Settings2 className="h-4 w-4" />
                {t("universalProvider.manage", {
                  defaultValue: "管理",
                })}
              </button>
            )}
          </div>
        </>
      )}

      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        {getCategoryHint()}
      </p>
    </div>
  );
}
