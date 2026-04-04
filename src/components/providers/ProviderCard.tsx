import { useMemo, useState, useEffect, useRef } from "react";
import { GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import type { Provider } from "@/types";
import type { AppId } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ProviderActions } from "@/components/providers/ProviderActions";
import { ProviderIcon } from "@/components/ProviderIcon";
import UsageFooter from "@/components/UsageFooter";
import { ProviderHealthBadge } from "@/components/providers/ProviderHealthBadge";
import { FailoverPriorityBadge } from "@/components/providers/FailoverPriorityBadge";
import { extractCodexBaseUrl } from "@/utils/providerConfigUtils";
import { useProviderHealth } from "@/lib/query/failover";
import { useUsageQuery } from "@/lib/query/queries";

interface DragHandleProps {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  isDragging: boolean;
}

interface ProviderCardProps {
  provider: Provider;
  isCurrent: boolean;
  appId: AppId;
  isInConfig?: boolean; // OpenCode: 是否已添加到 opencode.json
  isOmo?: boolean;
  isOmoSlim?: boolean;
  onSwitch: (provider: Provider) => void;
  onEdit: (provider: Provider) => void;
  onDelete: (provider: Provider) => void;
  onRemoveFromConfig?: (provider: Provider) => void;
  onDisableOmo?: () => void;
  onDisableOmoSlim?: () => void;
  onConfigureUsage: (provider: Provider) => void;
  onOpenWebsite: (url: string) => void;
  onDuplicate: (provider: Provider) => void;
  onTest?: (provider: Provider) => void;
  onOpenTerminal?: (provider: Provider) => void;
  isTesting?: boolean;
  isProxyRunning: boolean;
  isProxyTakeover?: boolean; // 代理接管模式（Live配置已被接管，切换为热切换）
  dragHandleProps?: DragHandleProps;
  isAutoFailoverEnabled?: boolean; // 是否开启自动故障转移
  failoverPriority?: number; // 故障转移优先级（1 = P1, 2 = P2, ...）
  isInFailoverQueue?: boolean; // 是否在故障转移队列中
  onToggleFailover?: (enabled: boolean) => void; // 切换故障转移队列
  activeProviderId?: string; // 代理当前实际使用的供应商 ID（用于故障转移模式下标注绿色边框）
  // OpenClaw: default model
  isDefaultModel?: boolean;
  onSetAsDefault?: () => void;
}

const extractModelName = (
  provider: Provider,
  appId: AppId,
): string | null => {
  const config = provider.settingsConfig;
  if (!config || typeof config !== "object") return null;

  const env = (config as Record<string, any>)?.env;

  if (appId === "claude") {
    const model = env?.ANTHROPIC_MODEL;
    if (typeof model === "string" && model.trim()) return model.trim();
  }

  if (appId === "gemini") {
    const model = env?.GEMINI_MODEL;
    if (typeof model === "string" && model.trim()) return model.trim();
  }

  if (appId === "codex") {
    const toml = (config as Record<string, any>)?.config;
    if (typeof toml === "string") {
      const match = toml.match(/^model\s*=\s*"([^"]+)"/m);
      if (match?.[1]) return match[1];
    }
  }

  return null;
};

const extractApiUrl = (provider: Provider, fallbackText: string) => {
  if (provider.notes?.trim()) {
    return provider.notes.trim();
  }

  if (provider.websiteUrl) {
    return provider.websiteUrl;
  }

  const config = provider.settingsConfig;

  if (config && typeof config === "object") {
    const envBase =
      (config as Record<string, any>)?.env?.ANTHROPIC_BASE_URL ||
      (config as Record<string, any>)?.env?.GOOGLE_GEMINI_BASE_URL;
    if (typeof envBase === "string" && envBase.trim()) {
      return envBase;
    }

    const baseUrl = (config as Record<string, any>)?.config;

    if (typeof baseUrl === "string" && baseUrl.includes("base_url")) {
      const extractedBaseUrl = extractCodexBaseUrl(baseUrl);
      if (extractedBaseUrl) {
        return extractedBaseUrl;
      }
    }
  }

  return fallbackText;
};

export function ProviderCard({
  provider,
  isCurrent,
  appId,
  isInConfig = true,
  isOmo = false,
  isOmoSlim = false,
  onSwitch,
  onEdit,
  onDelete,
  onRemoveFromConfig,
  onDisableOmo,
  onDisableOmoSlim,
  onConfigureUsage,
  onOpenWebsite,
  onDuplicate,
  onTest,
  onOpenTerminal,
  isTesting,
  isProxyRunning,
  isProxyTakeover = false,
  dragHandleProps,
  isAutoFailoverEnabled = false,
  failoverPriority,
  isInFailoverQueue = false,
  onToggleFailover,
  activeProviderId,
  // OpenClaw: default model
  isDefaultModel,
  onSetAsDefault,
}: ProviderCardProps) {
  const { t } = useTranslation();

  // OMO and OMO Slim share the same card behavior
  const isAnyOmo = isOmo || isOmoSlim;
  const handleDisableAnyOmo = isOmoSlim ? onDisableOmoSlim : onDisableOmo;

  const { data: health } = useProviderHealth(provider.id, appId);

  const fallbackUrlText = t("provider.notConfigured", {
    defaultValue: "未配置接口地址",
  });

  const modelName = useMemo(() => {
    return extractModelName(provider, appId);
  }, [provider, appId]);

  const displayUrl = useMemo(() => {
    return extractApiUrl(provider, fallbackUrlText);
  }, [provider, fallbackUrlText]);

  const isClickableUrl = useMemo(() => {
    if (provider.notes?.trim()) {
      return false;
    }
    if (displayUrl === fallbackUrlText) {
      return false;
    }
    return true;
  }, [provider.notes, displayUrl, fallbackUrlText]);

  const usageEnabled = provider.meta?.usage_script?.enabled ?? false;

  // 获取用量数据以判断是否有多套餐
  // 累加模式应用（OpenCode/OpenClaw）：使用 isInConfig 代替 isCurrent
  const shouldAutoQuery =
    appId === "opencode" || appId === "openclaw" ? isInConfig : isCurrent;
  const autoQueryInterval = shouldAutoQuery
    ? provider.meta?.usage_script?.autoQueryInterval || 0
    : 0;

  const { data: usage } = useUsageQuery(provider.id, appId, {
    enabled: usageEnabled,
    autoQueryInterval,
  });

  const hasMultiplePlans =
    usage?.success && usage.data && usage.data.length > 1;

  const [isExpanded, setIsExpanded] = useState(false);

  const actionsRef = useRef<HTMLDivElement>(null);
  const [actionsWidth, setActionsWidth] = useState(0);

  useEffect(() => {
    if (hasMultiplePlans) {
      setIsExpanded(true);
    }
  }, [hasMultiplePlans]);

  useEffect(() => {
    if (actionsRef.current) {
      const updateWidth = () => {
        const width = actionsRef.current?.offsetWidth || 0;
        setActionsWidth(width);
      };
      updateWidth();
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }
  }, [onTest, onOpenTerminal]); // 按钮数量可能变化时重新计算

  const handleOpenWebsite = () => {
    if (!isClickableUrl) {
      return;
    }
    onOpenWebsite(displayUrl);
  };

  // 判断是否是"当前使用中"的供应商
  // - OMO/OMO Slim 供应商：使用 isCurrent
  // - OpenClaw：使用默认模型归属的 provider 作为当前项（蓝色边框）
  // - OpenCode（非 OMO）：不存在"当前"概念，返回 false
  // - 故障转移模式：代理实际使用的供应商（activeProviderId）
  // - 普通模式：isCurrent
  const isActiveProvider = isAnyOmo
    ? isCurrent
    : appId === "openclaw"
      ? Boolean(isDefaultModel)
      : appId === "opencode"
        ? false
        : isAutoFailoverEnabled
          ? activeProviderId === provider.id
          : isCurrent;

  const shouldUseGreen = !isAnyOmo && isProxyTakeover && isActiveProvider;
  const shouldUseBlue =
    (isAnyOmo && isActiveProvider) ||
    (!isAnyOmo && !isProxyTakeover && isActiveProvider);
  const shouldShowHealthBadge =
    isProxyRunning && isInFailoverQueue && Boolean(health);
  const shouldShowFailoverPriorityBadge =
    isAutoFailoverEnabled &&
    isInFailoverQueue &&
    typeof failoverPriority === "number";
  const shouldShowStatusBadges =
    shouldShowHealthBadge || shouldShowFailoverPriorityBadge;

  return (
    <div
      className={cn(
        "group relative overflow-hidden border border-border-default bg-card p-2.5 text-card-foreground",
        isAutoFailoverEnabled || isProxyTakeover
          ? "hover:border-foreground/40"
          : "hover:border-foreground/40",
        shouldUseGreen && "border-foreground bg-muted/40",
        shouldUseBlue && "border-foreground bg-muted/40",
        dragHandleProps?.isDragging &&
          "z-10 cursor-grabbing border-foreground",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-muted/60",
          isActiveProvider ? "opacity-100" : "opacity-0",
        )}
      />
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {shouldShowStatusBadges && (
          <div className="pointer-events-none absolute right-0 top-0 flex items-center gap-1">
            {shouldShowHealthBadge && health && (
              <ProviderHealthBadge
                consecutiveFailures={health.consecutive_failures}
                className="h-5 px-1.5 py-0"
              />
            )}

            {shouldShowFailoverPriorityBadge && (
              <FailoverPriorityBadge
                priority={failoverPriority}
                className="h-5 px-1.5 py-0"
              />
            )}
          </div>
        )}

        <div
          className={cn(
            "flex flex-1 items-center gap-1.5",
            shouldShowStatusBadges && "pr-24 sm:pr-28",
          )}
        >
          <button
            type="button"
            className={cn(
              "-ml-1 shrink-0 cursor-grab p-1 text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing",
              dragHandleProps?.isDragging && "cursor-grabbing",
            )}
            aria-label={t("provider.dragHandle")}
            {...(dragHandleProps?.attributes ?? {})}
            {...(dragHandleProps?.listeners ?? {})}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="flex h-7 w-7 items-center justify-center border border-border-default bg-muted">
            <ProviderIcon
              icon={provider.icon}
              name={provider.name}
              color={provider.iconColor}
              size={18}
            />
          </div>

          <div className="min-w-0 space-y-0">
            <div className="flex min-h-5 flex-wrap items-center gap-1.5">
              <h3 className="text-sm font-semibold leading-none">
                {provider.name}
              </h3>

              {modelName && (
                <span
                  className="inline-flex items-center bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground"
                  title={modelName}
                >
                  <span className="truncate max-w-[200px]">{modelName}</span>
                </span>
              )}

              {isOmo && (
                <span className="inline-flex items-center rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  OMO
                </span>
              )}

              {isOmoSlim && (
                <span className="inline-flex items-center rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  Slim
                </span>
              )}

              {provider.category === "third_party" &&
                provider.meta?.isPartner && (
                  <span
                    className="text-yellow-500 dark:text-yellow-400"
                    title={t("provider.officialPartner", {
                      defaultValue: "官方合作伙伴",
                    })}
                  >
                    ⭐
                  </span>
                )}
            </div>

            {displayUrl && (
              <button
                type="button"
                onClick={handleOpenWebsite}
                className={cn(
                  "inline-flex max-w-[280px] items-center text-xs",
                  isClickableUrl
                    ? "cursor-pointer text-blue-600 hover:underline dark:text-blue-400"
                    : "cursor-default text-muted-foreground",
                )}
                title={displayUrl}
                disabled={!isClickableUrl}
              >
                <span className="truncate">{displayUrl}</span>
              </button>
            )}
          </div>
        </div>

        <div
          className="relative ml-auto flex min-w-0 items-center gap-2"
          style={
            {
              "--actions-width": `${actionsWidth || 320}px`,
            } as React.CSSProperties
          }
        >
          <div className="ml-auto">
            <div className="flex items-center gap-1 transition-transform duration-200 group-hover:-translate-x-[var(--actions-width)] group-focus-within:-translate-x-[var(--actions-width)]">
              {hasMultiplePlans ? (
                <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium">
                    {t("usage.multiplePlans", {
                      count: usage?.data?.length || 0,
                      defaultValue: `${usage?.data?.length || 0} 个套餐`,
                    })}
                  </span>
                </div>
              ) : (
                <UsageFooter
                  provider={provider}
                  providerId={provider.id}
                  appId={appId}
                  usageEnabled={usageEnabled}
                  isCurrent={isCurrent}
                  isInConfig={isInConfig}
                  inline={true}
                />
              )}
              {hasMultiplePlans && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                  className="shrink-0 p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  title={
                    isExpanded
                      ? t("usage.collapse", { defaultValue: "收起" })
                      : t("usage.expand", { defaultValue: "展开" })
                  }
                >
                  {isExpanded ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                </button>
              )}
            </div>
          </div>

          <div
            ref={actionsRef}
            className="pointer-events-none absolute right-0 top-1/2 flex -translate-y-1/2 translate-x-2 items-center gap-1 pl-2 opacity-0 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100"
          >
            <ProviderActions
              appId={appId}
              isCurrent={isCurrent}
              isInConfig={isInConfig}
              isTesting={isTesting}
              isProxyTakeover={isProxyTakeover}
              isOmo={isAnyOmo}
              onSwitch={() => onSwitch(provider)}
              onEdit={() => onEdit(provider)}
              onDuplicate={() => onDuplicate(provider)}
              onTest={onTest ? () => onTest(provider) : undefined}
              onConfigureUsage={() => onConfigureUsage(provider)}
              onDelete={() => onDelete(provider)}
              onRemoveFromConfig={
                onRemoveFromConfig
                  ? () => onRemoveFromConfig(provider)
                  : undefined
              }
              onDisableOmo={handleDisableAnyOmo}
              onOpenTerminal={
                onOpenTerminal ? () => onOpenTerminal(provider) : undefined
              }
              isAutoFailoverEnabled={isAutoFailoverEnabled}
              isInFailoverQueue={isInFailoverQueue}
              onToggleFailover={onToggleFailover}
              // OpenClaw: default model
              isDefaultModel={isDefaultModel}
              onSetAsDefault={onSetAsDefault}
            />
          </div>
        </div>
      </div>

      {isExpanded && hasMultiplePlans && (
        <div className="mt-2 border-t border-border-default pt-2">
          <UsageFooter
            provider={provider}
            providerId={provider.id}
            appId={appId}
            usageEnabled={usageEnabled}
            isCurrent={isCurrent}
            isInConfig={isInConfig}
            inline={false}
          />
        </div>
      )}
    </div>
  );
}
