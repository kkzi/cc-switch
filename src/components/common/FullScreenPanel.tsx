import React from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isWindows, isLinux } from "@/lib/platform";
import { isTextEditableTarget } from "@/utils/domUtils";

interface FullScreenPanelProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const DRAG_BAR_HEIGHT = isWindows() || isLinux() ? 0 : 28; // px - match App.tsx
const HEADER_HEIGHT = 56; // px - compact layout

/**
 * Reusable full-screen panel component
 * Handles portal rendering, header with back button, and footer
 * Uses solid theme colors without transparency
 */
export const FullScreenPanel: React.FC<FullScreenPanelProps> = ({
  isOpen,
  title,
  onClose,
  children,
  footer,
}) => {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // ESC 键关闭面板
  const onCloseRef = React.useRef(onClose);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // 子组件（例如 Radix 的 Select/Dialog/Dropdown）如果已经消费了 ESC，就不要再关闭整个面板
        if (event.defaultPrevented) {
          return;
        }

        if (isTextEditableTarget(event.target)) {
          return; // 让输入框自己处理 ESC（比如清空、失焦等）
        }

        event.stopPropagation(); // 阻止事件继续冒泡到 window，避免触发 App.tsx 的全局监听
        onCloseRef.current();
      }
    };

    // 使用冒泡阶段监听，让子组件（如 Radix UI）优先处理 ESC
    window.addEventListener("keydown", handleKeyDown, false);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, false);
    };
  }, [isOpen]);

  return createPortal(
    isOpen ? (
      <div
        className="fixed inset-0 z-[60] flex flex-col"
        style={{ backgroundColor: "hsl(var(--background))" }}
      >
          {/* Drag region - match App.tsx */}
          <div
            data-tauri-drag-region
            style={
              {
                WebkitAppRegion: "drag",
                height: DRAG_BAR_HEIGHT,
              } as React.CSSProperties
            }
          />

          {/* Header - match App.tsx */}
          <div
            className="flex shrink-0 items-center border-b border-border-default"
            data-tauri-drag-region
            style={
              {
                WebkitAppRegion: "drag",
                backgroundColor: "hsl(var(--background))",
                height: HEADER_HEIGHT,
              } as React.CSSProperties
            }
          >
            <div
              className="flex w-full items-center gap-3 px-4"
              data-tauri-drag-region
              style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
            >
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onClose}
                className="select-none"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h2 className="select-none text-base font-semibold text-foreground">
                {title}
              </h2>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto scroll-overlay">
            <div className="w-full space-y-4 px-4 py-4">{children}</div>
          </div>

          {/* Footer */}
          {footer && (
            <div
              className="shrink-0 border-t border-border-default py-3"
              style={{ backgroundColor: "hsl(var(--background))" }}
            >
              <div className="flex items-center justify-end gap-2 px-4">
                {footer}
              </div>
            </div>
          )}
      </div>
    ) : null,
    document.body,
  );
};
