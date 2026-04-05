import { useTranslation } from "react-i18next";
import { FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Link2, Zap } from "lucide-react";

interface EndpointFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hint?: string;
  showManageButton?: boolean;
  onManageClick?: () => void;
  manageButtonLabel?: string;
  showFullUrlToggle?: boolean;
  isFullUrl?: boolean;
  onFullUrlChange?: (value: boolean) => void;
}

export function EndpointField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  showManageButton = true,
  onManageClick,
  manageButtonLabel,
  showFullUrlToggle = false,
  isFullUrl = false,
  onFullUrlChange,
}: EndpointFieldProps) {
  const { t } = useTranslation();

  const defaultManageLabel = t("providerForm.manageAndTest", {
    defaultValue: "管理和测速",
  });
  const effectiveHint =
    showFullUrlToggle && isFullUrl
      ? t("providerForm.fullUrlHint", {
          defaultValue:
            "💡 请填写完整请求 URL，并且必须开启代理后使用；代理将直接使用此 URL，不拼接路径",
        })
      : hint;

  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-2">
      <FormLabel htmlFor={id} className="pt-2">
        {label}
      </FormLabel>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {showFullUrlToggle && onFullUrlChange ? (
            <div className="flex items-center gap-2 border border-border-default bg-muted/30 px-2 py-1">
              <Link2
                className={`h-3.5 w-3.5 ${
                  isFullUrl ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <span
                className={`text-xs font-medium ${
                  isFullUrl ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {t("providerForm.fullUrlLabel", {
                  defaultValue: "完整 URL",
                })}
              </span>
              <Switch
                checked={isFullUrl}
                onCheckedChange={onFullUrlChange}
                aria-label={t("providerForm.fullUrlLabel", {
                  defaultValue: "完整 URL",
                })}
                className="h-5 w-9"
              />
            </div>
          ) : null}

          <Input
            id={id}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            className="flex-1"
          />

          {showManageButton && onManageClick ? (
            <button
              type="button"
              onClick={onManageClick}
              className="inline-flex h-8 shrink-0 items-center gap-1 border border-border-default px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Zap className="h-3.5 w-3.5" />
              {manageButtonLabel || defaultManageLabel}
            </button>
          ) : null}
        </div>

        {effectiveHint ? (
          <div className="border border-amber-200 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {effectiveHint}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
