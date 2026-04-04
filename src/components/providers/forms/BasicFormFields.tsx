import { useTranslation } from "react-i18next";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { ProviderIcon } from "@/components/ProviderIcon";
import { IconPicker } from "@/components/IconPicker";
import { getIconMetadata } from "@/icons/extracted/metadata";
import type { UseFormReturn } from "react-hook-form";
import type { ProviderFormData } from "@/lib/schemas/provider";

interface BasicFormFieldsProps {
  form: UseFormReturn<ProviderFormData>;
  /** Slot to render content between icon and name fields */
  beforeNameSlot?: ReactNode;
  showIconPicker?: boolean;
}

export function BasicFormFields({
  form,
  beforeNameSlot,
  showIconPicker = true,
}: BasicFormFieldsProps) {
  const { t } = useTranslation();
  const [iconDialogOpen, setIconDialogOpen] = useState(false);

  const currentIcon = form.watch("icon");
  const currentIconColor = form.watch("iconColor");
  const providerName = form.watch("name") || "Provider";
  const effectiveIconColor =
    currentIconColor ||
    (currentIcon ? getIconMetadata(currentIcon)?.defaultColor : undefined);

  const handleIconSelect = (icon: string) => {
    const meta = getIconMetadata(icon);
    form.setValue("icon", icon);
    form.setValue("iconColor", meta?.defaultColor ?? "");
  };

  return (
    <>
      {showIconPicker && (
        <div className="mb-4 flex justify-center">
          <Dialog open={iconDialogOpen} onOpenChange={setIconDialogOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="flex h-16 w-16 cursor-pointer items-center justify-center border border-border-default bg-muted/30 p-2"
                title={
                  currentIcon
                    ? t("providerIcon.clickToChange", {
                        defaultValue: "点击更换图标",
                      })
                    : t("providerIcon.clickToSelect", {
                        defaultValue: "点击选择图标",
                      })
                }
              >
                <ProviderIcon
                  icon={currentIcon}
                  name={providerName}
                  color={effectiveIconColor}
                  size={36}
                />
              </button>
            </DialogTrigger>
            <DialogContent
              variant="fullscreen"
              zIndex="top"
              overlayClassName="bg-[hsl(var(--background))]"
              className="p-0"
            >
              <div className="flex h-full flex-col">
                <div className="flex-shrink-0 border-b border-border-default bg-muted/40 py-3">
                  <div className="flex items-center gap-3 px-4">
                    <DialogClose asChild>
                      <Button type="button" variant="outline" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    </DialogClose>
                    <p className="text-base font-semibold leading-tight">
                      {t("providerIcon.selectIcon", {
                        defaultValue: "选择图标",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <div className="w-full space-y-2 px-4 py-4">
                    <IconPicker
                      value={currentIcon}
                      onValueChange={handleIconSelect}
                      color={effectiveIconColor}
                    />
                    <div className="flex justify-end gap-2">
                      <DialogClose asChild>
                        <Button type="button" variant="outline">
                          {t("common.done", { defaultValue: "完成" })}
                        </Button>
                      </DialogClose>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Slot for additional fields between icon and name */}
      {beforeNameSlot}

      <div className="grid grid-cols-3 gap-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-2 space-y-0">
              <FormLabel className="pt-2 text-right">
                {t("provider.name")}
              </FormLabel>
              <div className="space-y-1">
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t("provider.namePlaceholder")}
                  />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-2 space-y-0">
              <FormLabel className="pt-2 text-right">
                {t("provider.notes")}
              </FormLabel>
              <div className="space-y-1">
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t("provider.notesPlaceholder")}
                  />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="websiteUrl"
          render={({ field }) => (
            <FormItem className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-2 space-y-0">
              <FormLabel className="pt-2 text-right">
                {t("provider.websiteUrl")}
              </FormLabel>
              <div className="space-y-1">
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t("providerForm.websiteUrlPlaceholder")}
                  />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
      </div>
    </>
  );
}
