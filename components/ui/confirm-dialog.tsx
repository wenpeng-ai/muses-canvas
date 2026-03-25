"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ConfirmDialogTone = "default" | "destructive";

export type ConfirmDialogOptions = {
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
};

type ThemedConfirmDialogProps = ConfirmDialogOptions & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function ThemedConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "default",
}: ThemedConfirmDialogProps) {
  const t = useTranslations("common");
  const destructive = tone === "destructive";
  const resolvedConfirmLabel = confirmLabel || t("confirm");
  const resolvedCancelLabel = cancelLabel || t("cancel");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[&>button]:hidden max-w-[440px] gap-0 rounded-[24px] border border-black/8 bg-white p-0 text-[#1f2937] shadow-[0_32px_72px_-42px_rgba(15,23,42,0.3)] dark:border-white/10 dark:bg-[#14181f] dark:text-white">
        <div className="relative flex flex-col">
          <DialogHeader className="px-6 pb-4 pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <span
                  className={cn(
                    "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]",
                    destructive
                      ? "bg-[#fff3f1] text-[#b42318] dark:bg-[#2a1716] dark:text-[#ffb3ab]"
                      : "bg-[#f3f4f6] text-[#1f2937] dark:bg-white/8 dark:text-white",
                  )}
                >
                  <AlertTriangle className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="text-[22px] font-semibold leading-[1.1] tracking-[-0.03em]">
                    {title}
                  </DialogTitle>
                  {description ? (
                    <DialogDescription className="mt-2 text-[14px] leading-6 text-[#5f6774] dark:text-slate-300">
                      {description}
                    </DialogDescription>
                  ) : null}
                </div>
              </div>

              <DialogClose asChild>
                <button
                  type="button"
                  aria-label={t("closeDialog")}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#5f6774] transition-colors hover:bg-black/[0.04] dark:text-slate-300 dark:hover:bg-white/6"
                >
                  <X className="h-5 w-5" />
                </button>
              </DialogClose>
            </div>
          </DialogHeader>

          <DialogFooter className="gap-2 border-t border-black/6 px-6 py-5 sm:justify-end sm:space-x-0 dark:border-white/8">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-[14px] border-black/8 bg-white px-5 text-[15px] font-medium text-[#3b4452] hover:bg-black/[0.03] dark:border-white/10 dark:bg-transparent dark:text-white/80 dark:hover:bg-white/[0.05]"
              onClick={() => onOpenChange(false)}
            >
              {resolvedCancelLabel}
            </Button>
            <Button
              type="button"
              className={cn(
                "h-11 rounded-[14px] px-5 text-[15px] font-medium text-white",
                destructive
                  ? "bg-[#b42318] hover:bg-[#912018] dark:bg-[#c43c30] dark:hover:bg-[#aa3127]"
                  : "bg-[#111827] hover:bg-[#0f172a] dark:bg-white dark:text-[#111111] dark:hover:bg-white/90",
              )}
              onClick={onConfirm}
            >
              {resolvedConfirmLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useConfirmDialog() {
  const [options, setOptions] = React.useState<ConfirmDialogOptions | null>(null);
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);

  const resolve = React.useCallback((value: boolean) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setOptions(null);
    resolver?.(value);
  }, []);

  React.useEffect(
    () => () => {
      if (!resolverRef.current) {
        return;
      }

      resolverRef.current(false);
      resolverRef.current = null;
    },
    [],
  );

  const confirm = React.useCallback((nextOptions: ConfirmDialogOptions) => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }

    return new Promise<boolean>((resolvePromise) => {
      resolverRef.current = resolvePromise;
      setOptions(nextOptions);
    });
  }, []);

  return {
    confirm,
    confirmDialog: (
      <ThemedConfirmDialog
        open={options !== null}
        title={options?.title ?? ""}
        description={options?.description}
        confirmLabel={options?.confirmLabel}
        cancelLabel={options?.cancelLabel}
        tone={options?.tone}
        onOpenChange={(open) => {
          if (!open) {
            resolve(false);
          }
        }}
        onConfirm={() => resolve(true)}
      />
    ),
  };
}
