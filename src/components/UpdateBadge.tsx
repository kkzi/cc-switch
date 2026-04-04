import { useUpdate } from "@/contexts/UpdateContext";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ArrowUpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpdateBadgeProps {
  className?: string;
  onClick?: () => void;
}

export function UpdateBadge({ className = "", onClick }: UpdateBadgeProps) {
  const { hasUpdate, updateInfo } = useUpdate();
  const { t } = useTranslation();
  const isActive = hasUpdate && updateInfo;
  const title = isActive
    ? t("settings.updateAvailable", {
        version: updateInfo?.availableVersion ?? "",
      })
    : t("settings.checkForUpdates");

  if (!isActive) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "relative h-10 w-10",
        isActive
          ? "bg-muted text-green-600 hover:bg-muted hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
          : "bg-muted text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <ArrowUpCircle className="h-5 w-5" />
    </Button>
  );
}
