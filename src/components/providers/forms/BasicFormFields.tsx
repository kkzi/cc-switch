import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { UseFormReturn } from "react-hook-form";
import type { ProviderFormData } from "@/lib/schemas/provider";

interface BasicFormFieldsProps {
  form: UseFormReturn<ProviderFormData>;
  /** Slot to render content before the basic fields */
  beforeNameSlot?: ReactNode;
}

const rowClassName =
  "grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2 space-y-0";
const labelClassName = "font-medium leading-8 text-muted-foreground";
const rightAlignedLabelClassName = `${labelClassName} text-right`;

export function BasicFormFields({
  form,
  beforeNameSlot,
}: BasicFormFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      {beforeNameSlot}

      <div className="grid gap-2 md:grid-cols-3">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className={rowClassName}>
              <FormLabel className={labelClassName}>
                {t("provider.name")}
              </FormLabel>
              <div className="space-y-0.5">
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
            <FormItem className={rowClassName}>
              <FormLabel className={rightAlignedLabelClassName}>
                {t("provider.notes")}
              </FormLabel>
              <div className="space-y-0.5">
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
            <FormItem className={rowClassName}>
              <FormLabel className={rightAlignedLabelClassName}>
                {t("provider.websiteUrl")}
              </FormLabel>
              <div className="space-y-0.5">
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
