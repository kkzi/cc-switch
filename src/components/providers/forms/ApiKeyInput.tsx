import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  id?: string;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  label = "API Key",
  id = "apiKey",
}) => {
  const { t } = useTranslation();
  const [showKey, setShowKey] = useState(false);

  const toggleShowKey = () => {
    setShowKey(!showKey);
  };

  const inputClass = `h-8 w-full border border-border-default bg-background px-2.5 py-1 pr-9 text-sm ${
    disabled
      ? "bg-muted border-border-default text-muted-foreground cursor-not-allowed"
      : "text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
  }`;

  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-2">
      <label htmlFor={id} className="pt-2 text-sm font-medium text-foreground">
        {label} {required && "*"}
      </label>
      <div className="relative">
        <input
          type={showKey ? "text" : "password"}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? t("apiKeyInput.placeholder")}
          disabled={disabled}
          required={required}
          autoComplete="off"
          className={inputClass}
        />
        {!disabled && value && (
          <button
            type="button"
            onClick={toggleShowKey}
            className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground hover:text-foreground"
            aria-label={showKey ? t("apiKeyInput.hide") : t("apiKeyInput.show")}
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </div>
  );
};

export default ApiKeyInput;
