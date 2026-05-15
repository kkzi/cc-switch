import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import type { Provider } from "@/types";
import type { AppId } from "@/lib/api";
import type { StreamCheckResult } from "@/lib/api/model-test";
import { cn } from "@/lib/utils";
import { ProviderActions } from "@/components/providers/ProviderActions";
import { ProviderIcon } from "@/components/ProviderIcon";
import UsageFooter from "@/components/UsageFooter";
import { isHermesReadOnlyProvider } from "@/config/hermesProviderPresets";
import { ProviderHealthBadge } from "@/components/providers/ProviderHealthBadge";
import { FailoverPriorityBadge } from "@/components/providers/FailoverPriorityBadge";
import { extractCodexBaseUrl } from "@/utils/providerConfigUtils";
import { copyText } from "@/lib/clipboard";
import { useProviderHealth } from "@/lib/query/failover";
import { useUsageQuery } from "@/lib/query/queries";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  recentTestResult?: StreamCheckResult | null;
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
  onPrimaryAction?: (provider: Provider) => void;
}

const extractModelName = (provider: Provider, appId: AppId): string | null => {
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

/** 判断是否为官方供应商（无自定义 base URL / API key，直连官方 API） */
function isOfficialProvider(provider: Provider, appId: AppId): boolean {
  if (provider.category === "official") {
    return true;
  }

  const config = provider.settingsConfig as Record<string, any>;
  if (appId === "claude") {
    const baseUrl = config?.env?.ANTHROPIC_BASE_URL;
    return !baseUrl || (typeof baseUrl === "string" && baseUrl.trim() === "");
  }
  if (appId === "codex") {
    const apiKey = config?.auth?.OPENAI_API_KEY;
    return !apiKey || (typeof apiKey === "string" && apiKey.trim() === "");
  }
  if (appId === "gemini") {
    const apiKey = config?.env?.GEMINI_API_KEY;
    const baseUrl = config?.env?.GOOGLE_GEMINI_BASE_URL;
    return (
      (!apiKey || (typeof apiKey === "string" && apiKey.trim() === "")) &&
      (!baseUrl || (typeof baseUrl === "string" && baseUrl.trim() === ""))
    );
  }
  return false;
}

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

const decodeEscapedText = (input: string) =>
  input
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\"/g, '"')
    .replace(/\\\\/g, "\\");

const unwrapRustOptionString = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed === "None") return "";

  const someQuotedMatch = trimmed.match(/^Some\("([\s\S]*)"\)$/);
  if (someQuotedMatch) {
    return decodeEscapedText(someQuotedMatch[1]);
  }

  const someRawMatch = trimmed.match(/^Some\(([\s\S]*)\)$/);
  if (someRawMatch) {
    return decodeEscapedText(someRawMatch[1].trim());
  }

  return input;
};

const padTimePart = (value: number) => value.toString().padStart(2, "0");

const normalizeUnixTimestamp = (value: number) => {
  // Stream check timestamps from Rust are currently Unix seconds; some
  // frontend-generated timestamps (tests / local UI state) are already ms.
  return value < 1_000_000_000_000 ? value * 1000 : value;
};

const formatTooltipTimestamp = (timestamp: number | null) => {
  if (timestamp === null || !Number.isFinite(timestamp)) {
    return "";
  }

  const date = new Date(normalizeUnixTimestamp(timestamp));
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return [
    date.getFullYear(),
    padTimePart(date.getMonth() + 1),
    padTimePart(date.getDate()),
  ].join("-") +
    ` ${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}:${padTimePart(date.getSeconds())}`;
};

const parseTimestamp = (value?: string | number | null) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? normalizeUnixTimestamp(value) : null;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  if (/^\d+$/.test(value.trim())) {
    const numeric = Number(value.trim());
    return Number.isFinite(numeric) ? normalizeUnixTimestamp(numeric) : null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const prependTooltipTimestamp = (
  message: string,
  timestamp: number | null,
) => {
  const trimmed = message.trim();
  if (!trimmed) return "";

  const timestampText = formatTooltipTimestamp(timestamp);
  if (!timestampText) {
    return trimmed;
  }

  const [firstLine, ...rest] = trimmed.split("\n");
  return [`${timestampText} ${firstLine}`.trim(), ...rest].join("\n").trim();
};

const extractParsedErrorDetail = (parsed: {
  error?: { message?: unknown } | string;
  message?: unknown;
}) => {
  if (typeof parsed.error === "string" && parsed.error.trim()) {
    return parsed.error;
  }

  if (
    parsed.error &&
    typeof parsed.error === "object" &&
    typeof parsed.error.message === "string"
  ) {
    return parsed.error.message;
  }

  if (typeof parsed.message === "string" && parsed.message.trim()) {
    return parsed.message;
  }

  return "";
};

const extractParsedErrorTitle = (parsed: {
  error?: { type?: unknown; code?: unknown } | string;
}) => {
  if (parsed.error && typeof parsed.error === "object") {
    if (typeof parsed.error.type === "string" && parsed.error.type.trim()) {
      return parsed.error.type;
    }
    if (typeof parsed.error.code === "string" && parsed.error.code.trim()) {
      return parsed.error.code;
    }
  }

  return "Auth rejected";
};

const formatTooltipPayload = (
  status: string,
  title: string,
  payload: string,
  timestamp: number | null,
) => {
  const rawPayload = unwrapRustOptionString(payload.trim()).trim();

  try {
    const parsed = JSON.parse(rawPayload) as unknown;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as {
        error?: { message?: unknown } | string;
        message?: unknown;
      };
      const detail = extractParsedErrorDetail(obj) || rawPayload;
      return prependTooltipTimestamp(
        `${status} ${title}\n${decodeEscapedText(detail)}`.trim(),
        timestamp,
      );
    }
  } catch {
    return prependTooltipTimestamp(
      `${status} ${title}\n${decodeEscapedText(rawPayload)}`.trim(),
      timestamp,
    );
  }

  return prependTooltipTimestamp(
    `${status} ${title}\n${decodeEscapedText(rawPayload)}`.trim(),
    timestamp,
  );
};

const extractHealthTooltipMessage = (
  message: string,
  timestamp: number | null,
) => {
  const trimmed = unwrapRustOptionString(message).trim();
  if (!trimmed) return "";

  const normalized = prependTooltipTimestamp(
    decodeEscapedText(trimmed),
    timestamp,
  );
  const summaryPrefixMatch = trimmed.match(
    /^([^\n(]+?)\s*\((\d{3})\):\s*([\s\S]+)$/,
  );
  if (summaryPrefixMatch) {
    const [, title, status, payload] = summaryPrefixMatch;
    return formatTooltipPayload(status, title.trim(), payload, timestamp);
  }

  const localizedStatusPrefixMatch = trimmed.match(
    /^([^\n(]+?)\s*\(状态码\s*(\d{3})\):\s*([\s\S]+)$/,
  );
  if (localizedStatusPrefixMatch) {
    const [, title, status, payload] = localizedStatusPrefixMatch;
    return formatTooltipPayload(status, title.trim(), payload, timestamp);
  }

  const statusPrefixMatch = trimmed.match(/^(\d{3})\s+([^\n:]+):\s*([\s\S]+)$/);
  if (statusPrefixMatch) {
    const [, status, title, payload] = statusPrefixMatch;
    return formatTooltipPayload(status, title.trim(), payload, timestamp);
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as {
        error?: { message?: unknown; type?: unknown; code?: unknown } | string;
        message?: unknown;
        status?: unknown;
      };
      const status =
        typeof obj.status === "string"
          ? obj.status
          : typeof obj.status === "number"
            ? String(obj.status)
            : "401";
      const title = extractParsedErrorTitle(obj);
      const detail = extractParsedErrorDetail(obj) || trimmed;
      return prependTooltipTimestamp(
        `${status} ${title}\n${decodeEscapedText(detail)}`.trim(),
        timestamp,
      );
    }
  } catch {
    return normalized;
  }

  return normalized;
};

type TooltipEntrySource = "recent" | "health";

type TooltipEntry = {
  source: TooltipEntrySource;
  message: string;
  timestamp: number | null;
};

const pickNewerTooltipEntry = (
  recent: TooltipEntry | null,
  health: TooltipEntry | null,
) => {
  if (!recent) return health;
  if (!health) return recent;

  if (recent.timestamp !== null && health.timestamp !== null) {
    return recent.timestamp >= health.timestamp ? recent : health;
  }

  if (recent.timestamp !== null) {
    return recent;
  }

  if (health.timestamp !== null) {
    return health;
  }

  return recent;
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
  recentTestResult,
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
  onPrimaryAction,
}: ProviderCardProps) {
  const { t } = useTranslation();

  // OMO and OMO Slim share the same card behavior
  const isAnyOmo = isOmo || isOmoSlim;
  const handleDisableAnyOmo = isOmoSlim ? onDisableOmoSlim : onDisableOmo;
  const isAdditiveMode = appId === "opencode" && !isAnyOmo;

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
  const latestHealthError = health?.last_error?.trim() || "";
  const latestHealthTimestamp = useMemo(
    () => parseTimestamp(health?.last_failure_at ?? health?.updated_at),
    [health?.last_failure_at, health?.updated_at],
  );
  const latestHealthTooltip = useMemo(
    () => extractHealthTooltipMessage(latestHealthError, latestHealthTimestamp),
    [latestHealthError, latestHealthTimestamp],
  );
  const recentTestTimestamp =
    typeof recentTestResult?.testedAt === "number"
      ? normalizeUnixTimestamp(recentTestResult.testedAt)
      : null;
  const recentTestTooltip = useMemo(
    () =>
      extractHealthTooltipMessage(
        recentTestResult?.message ?? "",
        recentTestTimestamp,
      ),
    [recentTestResult?.message, recentTestTimestamp],
  );
  const latestHealthEntry = useMemo<TooltipEntry | null>(() => {
    if (!latestHealthTooltip) return null;
    return {
      source: "health",
      message: latestHealthTooltip,
      timestamp: latestHealthTimestamp,
    };
  }, [latestHealthTimestamp, latestHealthTooltip]);
  const recentTestEntry = useMemo<TooltipEntry | null>(() => {
    if (!recentTestTooltip) return null;
    return {
      source: "recent",
      message: recentTestTooltip,
      timestamp: recentTestTimestamp,
    };
  }, [recentTestTimestamp, recentTestTooltip]);
  const latestTooltipEntry = useMemo(
    () => pickNewerTooltipEntry(recentTestEntry, latestHealthEntry),
    [latestHealthEntry, recentTestEntry],
  );
  const recentTooltipKey = useMemo(() => {
    if (!latestTooltipEntry || latestTooltipEntry.source !== "recent") return "";
    return `${recentTestResult?.testedAt ?? ""}:${recentTestResult?.status ?? ""}:${latestTooltipEntry.message}`;
  }, [latestTooltipEntry, recentTestResult?.status, recentTestResult?.testedAt]);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [isRecentTooltipActive, setIsRecentTooltipActive] = useState(false);
  const [isTooltipRegionHovered, setIsTooltipRegionHovered] = useState(false);
  const [recentTooltipSnapshot, setRecentTooltipSnapshot] = useState("");
  const [recentStatusSnapshot, setRecentStatusSnapshot] = useState<
    StreamCheckResult["status"] | null
  >(null);
  const activeRecentTooltip = isRecentTooltipActive
    ? recentTestTooltip || recentTooltipSnapshot
    : "";
  const lastCheckStatus = isTesting
    ? null
    : isRecentTooltipActive
      ? (recentTestResult?.status ??
        recentStatusSnapshot ??
        health?.last_check_status)
      : latestTooltipEntry?.source === "health"
        ? health?.last_check_status
        : (recentTestResult?.status ?? health?.last_check_status);
  const iconBorderClass = useMemo(() => {
    if (lastCheckStatus === "operational") return "border-green-500";
    if (lastCheckStatus === "degraded") return "border-yellow-500";
    if (lastCheckStatus === "failed") return "border-red-500";
    return "border-border-default";
  }, [lastCheckStatus]);
  const tooltipMessage =
    activeRecentTooltip || latestTooltipEntry?.message || "";
  const isHealthTooltipActive =
    !activeRecentTooltip && latestTooltipEntry?.source === "health";
  const hideTooltipTimerRef = useRef<number | null>(null);
  const lastAutoOpenedRecentTooltipKeyRef = useRef("");

  const usageEnabled = provider.meta?.usage_script?.enabled ?? false;
  const isOfficial = isOfficialProvider(provider, appId);
  const isOfficialBlockedByProxy =
    isProxyTakeover && (provider.category === "official" || isOfficial);
  // Hermes v12+ overlay entries live under the `providers:` dict and are
  // read-only here — writes have to go through Hermes Web UI.
  const isHermesReadOnly =
    appId === "hermes" && isHermesReadOnlyProvider(provider.settingsConfig);

  // 获取用量数据以判断是否有多套餐
  // 累加模式应用（OpenCode/OpenClaw/Hermes）：使用 isInConfig 代替 isCurrent
  const shouldAutoQuery =
    appId === "opencode" || appId === "openclaw" || appId === "hermes"
      ? isInConfig
      : isCurrent;
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

  const clearHideTooltipTimer = useCallback(() => {
    if (hideTooltipTimerRef.current !== null) {
      window.clearTimeout(hideTooltipTimerRef.current);
      hideTooltipTimerRef.current = null;
    }
  }, []);

  const hideTooltipImmediately = useCallback(() => {
    clearHideTooltipTimer();
    setIsTooltipOpen(false);
    setIsRecentTooltipActive(false);
    setRecentTooltipSnapshot("");
    setRecentStatusSnapshot(null);
  }, [clearHideTooltipTimer]);

  const scheduleHideTooltip = useCallback((delayMs: number) => {
    clearHideTooltipTimer();
    hideTooltipTimerRef.current = window.setTimeout(() => {
      hideTooltipImmediately();
      hideTooltipTimerRef.current = null;
    }, delayMs);
  }, [clearHideTooltipTimer, hideTooltipImmediately]);

  useEffect(() => {
    if (hasMultiplePlans) {
      setIsExpanded(true);
    }
  }, [hasMultiplePlans]);

  useEffect(() => {
    if (isTesting) {
      hideTooltipImmediately();
      lastAutoOpenedRecentTooltipKeyRef.current = "";
      return;
    }

    if (!recentTooltipKey) {
      lastAutoOpenedRecentTooltipKeyRef.current = "";
      if (
        isRecentTooltipActive &&
        isTooltipRegionHovered &&
        recentTooltipSnapshot
      ) {
        clearHideTooltipTimer();
        return;
      }

      if (isRecentTooltipActive) {
        hideTooltipImmediately();
      }
      return;
    }

    if (lastAutoOpenedRecentTooltipKeyRef.current === recentTooltipKey) {
      if (
        isRecentTooltipActive &&
        !isTooltipRegionHovered &&
        hideTooltipTimerRef.current === null
      ) {
        scheduleHideTooltip(5000);
      }
      return;
    }

    clearHideTooltipTimer();
    setRecentTooltipSnapshot(latestTooltipEntry?.message || recentTestTooltip);
    setRecentStatusSnapshot(recentTestResult?.status ?? null);
    setIsTooltipOpen(true);
    setIsRecentTooltipActive(true);
    lastAutoOpenedRecentTooltipKeyRef.current = recentTooltipKey;
    if (!isTooltipRegionHovered) {
      scheduleHideTooltip(5000);
    }

    return () => {
      clearHideTooltipTimer();
    };
  }, [
    hideTooltipImmediately,
    isRecentTooltipActive,
    isTesting,
    isTooltipRegionHovered,
    latestTooltipEntry,
    recentTestResult?.status,
    recentTestTooltip,
    recentTooltipKey,
    recentTooltipSnapshot,
    scheduleHideTooltip,
    clearHideTooltipTimer,
  ]);

  useEffect(() => {
    return () => {
      clearHideTooltipTimer();
    };
  }, []);

  useEffect(() => {
    if (!isTooltipOpen) return;

    const handleWindowScroll = () => {
      hideTooltipImmediately();
    };

    window.addEventListener("scroll", handleWindowScroll, true);
    return () => {
      window.removeEventListener("scroll", handleWindowScroll, true);
    };
  }, [hideTooltipImmediately, isTooltipOpen]);

  const handleTooltipRegionEnter = () => {
    setIsTooltipRegionHovered(true);
    if (isRecentTooltipActive) {
      clearHideTooltipTimer();
    }
  };

  const handleTooltipRegionLeave = () => {
    setIsTooltipRegionHovered(false);
    if (isRecentTooltipActive) {
      scheduleHideTooltip(5000);
    }
  };

  const handleOpenWebsite = () => {
    if (!isClickableUrl) {
      return;
    }
    onOpenWebsite(displayUrl);
  };

  const handleTooltipCopy = async () => {
    if (!isHealthTooltipActive || latestTooltipEntry?.source !== "health") {
      return;
    }

    try {
      await copyText(latestTooltipEntry.message);
      toast.success(
        t("sessionManager.messageCopied", {
          defaultValue: "已复制消息内容",
        }),
      );
    } catch (error) {
      toast.error(
        t("settings.installCommandsCopyFailed", {
          defaultValue: "复制失败，请手动复制。",
        }),
      );
    }
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
  const hasPersistentConfigHighlight = isAdditiveMode && isInConfig;
  const shouldUseBlue =
    (isAnyOmo && isActiveProvider) ||
    (!isAnyOmo &&
      !isProxyTakeover &&
      (isActiveProvider || hasPersistentConfigHighlight));
  const shouldShowHealthBadge =
    isProxyRunning && isInFailoverQueue && Boolean(health);
  const shouldShowFailoverPriorityBadge =
    isAutoFailoverEnabled &&
    isInFailoverQueue &&
    typeof failoverPriority === "number";

  const handleCardDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onPrimaryAction) return;

    const target = event.target as HTMLElement | null;
    if (
      target?.closest("button, a, input, textarea, select, [role='button']")
    ) {
      return;
    }

    onPrimaryAction(provider);
  };

  return (
    <div
      onDoubleClick={handleCardDoubleClick}
      className={cn(
        "group relative overflow-hidden border border-border-default bg-card p-2.5 text-card-foreground",
        isAutoFailoverEnabled || isProxyTakeover
          ? "hover:border-emerald-500/50"
          : "hover:border-border-active",
        shouldUseGreen &&
          "border-emerald-500/60 shadow-sm shadow-emerald-500/10",
        shouldUseBlue && "border-blue-500/60 shadow-sm shadow-blue-500/10",
        !(isActiveProvider || hasPersistentConfigHighlight) &&
          "hover:shadow-sm",
        dragHandleProps?.isDragging && "z-10 cursor-grabbing border-foreground",
      )}
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-r to-transparent transition-opacity duration-500 pointer-events-none",
          shouldUseGreen && "from-emerald-500/10",
          shouldUseBlue && "from-blue-500/10",
          !shouldUseGreen && !shouldUseBlue && "from-primary/10",
          isActiveProvider || hasPersistentConfigHighlight
            ? "opacity-100"
            : "opacity-0",
        )}
      />
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-1.5">
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

          <TooltipProvider delayDuration={150}>
            <Tooltip
              open={tooltipMessage ? isTooltipOpen : false}
              onOpenChange={(open) => {
                if (!tooltipMessage) {
                  hideTooltipImmediately();
                  return;
                }
                if (isRecentTooltipActive && !open) {
                  return;
                }
                setIsTooltipOpen(open);
              }}
            >
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center border bg-muted",
                    iconBorderClass,
                  )}
                  onPointerEnter={handleTooltipRegionEnter}
                  onPointerLeave={handleTooltipRegionLeave}
                >
                  <ProviderIcon
                    icon={provider.icon}
                    name={provider.name}
                    color={provider.iconColor}
                    size={18}
                    showTitle={false}
                  />
                </div>
              </TooltipTrigger>
              {tooltipMessage && (
                <TooltipContent
                  side="top"
                  className={cn(
                    "max-w-[420px] whitespace-pre-wrap break-all",
                    isHealthTooltipActive &&
                      "cursor-copy select-text transition-opacity hover:opacity-90",
                  )}
                  onPointerEnter={handleTooltipRegionEnter}
                  onPointerLeave={handleTooltipRegionLeave}
                  onClick={() => {
                    void handleTooltipCopy();
                  }}
                  title={
                    isHealthTooltipActive
                      ? t("sessionManager.copyMessage", {
                          defaultValue: "复制消息",
                        })
                      : undefined
                  }
                >
                  {tooltipMessage}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

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

              {appId === "claude-desktop" &&
                provider.category !== "official" &&
                provider.meta?.claudeDesktopMode === "proxy" && (
                  <span className="inline-flex items-center rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                    {t("claudeDesktop.modeProxy", {
                      defaultValue: "需要路由",
                    })}
                  </span>
                )}

              {shouldShowHealthBadge && health && (
                <ProviderHealthBadge
                  consecutiveFailures={health.consecutive_failures}
                  className="h-4 shrink-0 gap-1 px-1 py-0 text-[10px] leading-none"
                />
              )}

              {shouldShowFailoverPriorityBadge && (
                <FailoverPriorityBadge
                  priority={failoverPriority}
                  className="h-4 shrink-0 px-1 py-0 text-[10px] leading-none"
                />
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

              {isHermesReadOnly && (
                <span
                  className="inline-flex items-center rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-700/60 dark:text-slate-200"
                  title={t("provider.managedByHermesHint", {
                    defaultValue: "由 Hermes 管理，请在 Hermes Web UI 中编辑",
                  })}
                >
                  {t("provider.managedByHermes", {
                    defaultValue: "Hermes Managed",
                  })}
                </span>
              )}
            </div>

            {(displayUrl || usageEnabled) && (
              <div className="flex min-h-4 min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-left">
                {displayUrl && (
                  <button
                    type="button"
                    onClick={handleOpenWebsite}
                    className={cn(
                      "inline-flex min-w-0 max-w-[280px] items-center overflow-hidden text-xs leading-none",
                      isClickableUrl
                        ? "cursor-pointer text-blue-600 hover:underline dark:text-blue-400"
                        : "cursor-default text-muted-foreground",
                    )}
                    title={displayUrl}
                    disabled={!isClickableUrl}
                  >
                    <span className="block min-w-0 truncate">{displayUrl}</span>
                  </button>
                )}

                {hasMultiplePlans ? (
                  <div className="inline-flex min-w-0 items-center gap-1 text-left text-[11px] leading-none text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    <span className="font-medium tabular-nums">
                      {t("usage.multiplePlans", {
                        count: usage?.data?.length || 0,
                        defaultValue: `${usage?.data?.length || 0} 个套餐`,
                      })}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                      }}
                      className="inline-flex h-auto shrink-0 items-center p-0 text-gray-500 hover:text-foreground dark:text-gray-400"
                      title={
                        isExpanded
                          ? t("usage.collapse", { defaultValue: "收起" })
                          : t("usage.expand", { defaultValue: "展开" })
                      }
                    >
                      {isExpanded ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )}
                    </button>
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
              </div>
            )}
          </div>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2 pl-2">
          <div className="flex items-center gap-1">
            <ProviderActions
              appId={appId}
              isCurrent={isCurrent}
              isInConfig={isInConfig}
              isTesting={isTesting}
              isProxyTakeover={isProxyTakeover}
              isOfficialBlockedByProxy={isOfficialBlockedByProxy}
              isReadOnly={isHermesReadOnly}
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
