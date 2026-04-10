import { Toaster as SonnerToaster } from "sonner";
import type { CSSProperties } from "react";
import { useTheme } from "@/components/theme-provider";

export function Toaster() {
  const { theme } = useTheme();

  // 将应用主题映射到 Sonner 的主题
  // 如果是 "system"，Sonner 会自己处理
  const sonnerTheme = theme === "system" ? "system" : theme;

  return (
    <SonnerToaster
      position="bottom-center"
      hotkey={["Escape"]}
      richColors
      theme={sonnerTheme}
      style={
        {
          "--width": "calc(100vw - 40px)",
        } as CSSProperties
      }
      toastOptions={{
        duration: 2000,
        style: {
          minHeight: "20px",
          maxHeight: "100px",
          height: "auto",
          padding: "6px 12px",
          overflowY: "auto",
        },
        classNames: {
          toast:
            "group rounded-md border bg-background text-foreground shadow-lg",
          title: "text-sm font-semibold",
          description: "text-sm text-muted-foreground",
          closeButton:
            "absolute right-2 top-2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          actionButton:
            "rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90",
        },
      }}
    />
  );
}
