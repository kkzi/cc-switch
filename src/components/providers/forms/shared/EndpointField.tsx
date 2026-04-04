import { useTranslation } from "react-i18next";
import { FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Zap } from "lucide-react";

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
}: EndpointFieldProps) {
  const { t } = useTranslation();

  const defaultManageLabel = t("providerForm.manageAndTest", {
    defaultValue: "管理和测速",
  });

  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-2">
      <FormLabel htmlFor={id} className="pt-2">
        {label}
      </FormLabel>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
          />
          {showManageButton && onManageClick && (
            <button
              type="button"
              onClick={onManageClick}
              className="inline-flex h-8 shrink-0 items-center gap-1 border border-border-default px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Zap className="h-3.5 w-3.5" />
              {manageButtonLabel || defaultManageLabel}
            </button>
          )}
        </div>
        {hint ? (
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
