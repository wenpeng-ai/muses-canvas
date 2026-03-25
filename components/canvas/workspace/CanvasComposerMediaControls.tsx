"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMessages } from "next-intl";
import { Check, ChevronDown } from "lucide-react";
import { AspectRatioOptionCard } from "@/components/create/AspectRatioOptionCard";
import { CanvasProviderBrandIcon } from "@/components/canvas/workspace/CanvasProviderBrandIcon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IMAGE_COMPOSER_RATIO_OPTIONS,
  getVideoComposerConfig,
  resolveImageComposerAspectRatio,
  resolveVideoComposerDuration,
  resolveVideoComposerSize,
} from "@/lib/canvas/composer-media";
import { getCanvasPageCopy } from "@/lib/canvas/copy";
import type { AppMessages } from "@/i18n/messages";
import type { ProviderModelOption } from "@/lib/provider-settings";
import { cn } from "@/lib/utils";

function getGridColumnsClassName(count: number) {
  if (count <= 2) return "grid-cols-2";
  if (count === 3) return "grid-cols-3";
  return "grid-cols-4";
}

function useCloseOnScroll(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleWindowChange = () => {
      onClose();
    };

    window.addEventListener("scroll", handleWindowChange, { passive: true });
    window.addEventListener("resize", handleWindowChange);

    return () => {
      window.removeEventListener("scroll", handleWindowChange);
      window.removeEventListener("resize", handleWindowChange);
    };
  }, [onClose, open]);
}

function ComposerModelPicker({
  value,
  options,
  open,
  onOpenChange,
  onSelect,
  emptyLabel,
  onEmptyAction,
  triggerClassName,
  dropdownClassName,
  maxListHeightClassName,
  dropdownContainer,
}: {
  value: string;
  options: ProviderModelOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (value: string) => void;
  emptyLabel: string;
  onEmptyAction?: () => void;
  triggerClassName?: string;
  dropdownClassName?: string;
  maxListHeightClassName?: string;
  dropdownContainer?: HTMLElement | null;
}) {
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0] ?? null,
    [options, value],
  );
  const selectedModelItemRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      selectedModelItemRef.current?.scrollIntoView({ block: "center" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, value]);

  if (options.length === 0) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onEmptyAction}
        className={cn(
          "h-9 min-w-0 max-w-full justify-start rounded-[10px] bg-transparent px-3.5 text-[14px] font-medium text-[#6b7280] hover:bg-black/[0.06] focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent dark:text-foreground/62 dark:hover:bg-white/12",
          triggerClassName,
        )}
      >
        <span className="min-w-0 text-left">{emptyLabel}</span>
      </Button>
    );
  }

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={!selectedOption}
          className={cn(
            "h-9 min-w-0 cursor-pointer justify-between gap-2 rounded-[10px] bg-transparent px-3.5 text-[14px] font-medium text-[#2f3540] hover:bg-black/[0.06] focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-default disabled:opacity-65 dark:bg-transparent dark:text-foreground/88 dark:hover:bg-white/12",
            triggerClassName,
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            {selectedOption ? (
              <CanvasProviderBrandIcon
                providerId={selectedOption.providerId}
                className="h-4 w-4 [&_img]:h-4 [&_img]:w-4"
              />
            ) : null}
            <span className="truncate">
              {selectedOption?.label ?? emptyLabel}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        collisionPadding={12}
        container={dropdownContainer ?? undefined}
        updatePositionStrategy="always"
        sticky="always"
        className={cn(
          "overflow-hidden rounded-[14px] border border-black/8 bg-white/98 p-1.5 text-[#2f3540] shadow-[0_18px_42px_-28px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-[#181818]/98 dark:text-foreground dark:shadow-[0_18px_42px_-24px_rgba(0,0,0,0.55)]",
          dropdownClassName,
        )}
      >
        <div
          className={cn(
            "model-picker-scrollbar flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden",
            maxListHeightClassName,
          )}
        >
          {options.map((option) => {
            const selected = selectedOption?.value === option.value;

            return (
              <DropdownMenuItem
                key={option.value}
                ref={selected ? selectedModelItemRef : undefined}
                onSelect={() => onSelect(option.value)}
                className={cn(
                  "grid h-9 cursor-pointer grid-cols-[18px_minmax(0,1fr)_14px] items-center gap-2 rounded-[10px] px-3 text-[13px] font-medium text-[#2f3540] outline-none transition-colors hover:bg-[#f3f4f6] focus:bg-[#f3f4f6] dark:text-foreground/88 dark:hover:bg-white/8 dark:focus:bg-white/8",
                  selected &&
                    "bg-[#eceef1] text-[#21262d] dark:bg-white/10 dark:text-foreground",
                )}
              >
                <CanvasProviderBrandIcon
                  providerId={option.providerId}
                  className="h-[15px] w-[15px] [&_img]:h-[15px] [&_img]:w-[15px]"
                />
                <span className="truncate">{option.label}</span>
                <span className="flex h-3.5 w-3.5 items-center justify-center">
                  {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                </span>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CanvasComposerImageControls({
  modelValue,
  modelOptions,
  aspectRatio,
  onChange,
  onRequestAddModel,
  dropdownContainer,
}: {
  modelValue: string;
  modelOptions: ProviderModelOption[];
  aspectRatio: string;
  onChange: (patch: { model?: string; size?: string }) => void;
  onRequestAddModel?: () => void;
  dropdownContainer?: HTMLElement | null;
}) {
  const messages = useMessages() as AppMessages;
  const copy = getCanvasPageCopy(messages);
  const [modelOpen, setModelOpen] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);
  const normalizedAspectRatio = resolveImageComposerAspectRatio(aspectRatio);
  const hasSelectedModel = modelOptions.length > 0;

  useCloseOnScroll(modelOpen || paramsOpen, () => {
    setModelOpen(false);
    setParamsOpen(false);
  });

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <ComposerModelPicker
        value={modelValue}
        options={modelOptions}
        open={modelOpen}
        onOpenChange={setModelOpen}
        onSelect={(value) => {
          onChange({
            model: value,
            size: resolveImageComposerAspectRatio(undefined),
          });
          setModelOpen(false);
        }}
        emptyLabel={copy.noImageModelsAvailable}
        onEmptyAction={onRequestAddModel}
        triggerClassName={cn(
          "rounded-[10px]",
          hasSelectedModel ? "max-w-[220px]" : "max-w-full",
        )}
        dropdownClassName="w-[236px]"
        maxListHeightClassName="max-h-[360px]"
        dropdownContainer={dropdownContainer}
      />

      {hasSelectedModel ? (
        <div className="h-4 w-px shrink-0 bg-black/10 dark:bg-white/12" />
      ) : null}

      {hasSelectedModel ? (
        <DropdownMenu modal={false} open={paramsOpen} onOpenChange={setParamsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 justify-between gap-2 rounded-[10px] bg-transparent px-3.5 text-[13px] text-[#2f3540] hover:bg-black/[0.06] focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent dark:text-foreground/88 dark:hover:bg-white/12"
            >
              <span className="truncate text-left">{normalizedAspectRatio}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  paramsOpen && "rotate-180",
                )}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            sideOffset={8}
            collisionPadding={12}
            container={dropdownContainer ?? undefined}
            updatePositionStrategy="always"
            sticky="always"
            className="w-[292px] max-w-[calc(100vw-2rem)] rounded-[14px] border border-black/8 bg-white/98 p-0 text-[#2f3540] shadow-[0_18px_44px_-28px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-[#181818]/98 dark:text-foreground dark:shadow-[0_18px_44px_-28px_rgba(0,0,0,0.58)]"
          >
            <div className="space-y-4 p-3.5">
              <section className="space-y-3">
                <p className="text-[13px] font-medium text-[#434851] dark:text-foreground/72">
                  {copy.aspectRatio}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {IMAGE_COMPOSER_RATIO_OPTIONS.map((ratio) => (
                    <AspectRatioOptionCard
                      key={ratio}
                      ratio={ratio}
                      label={ratio}
                      selected={normalizedAspectRatio === ratio}
                      onClick={() => onChange({ size: ratio })}
                    />
                  ))}
                </div>
              </section>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

export function CanvasComposerVideoControls({
  modelValue,
  modelOptions,
  durationSeconds,
  size,
  onChange,
  onRequestAddModel,
  dropdownContainer,
}: {
  modelValue: string;
  modelOptions: ProviderModelOption[];
  durationSeconds: number;
  size: string;
  onChange: (patch: {
    model?: string;
    durationSeconds?: number;
    size?: string;
  }) => void;
  onRequestAddModel?: () => void;
  dropdownContainer?: HTMLElement | null;
}) {
  const messages = useMessages() as AppMessages;
  const copy = getCanvasPageCopy(messages);
  const [modelOpen, setModelOpen] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);
  const videoConfig = getVideoComposerConfig(modelValue);
  const normalizedDuration = resolveVideoComposerDuration(modelValue, durationSeconds);
  const normalizedSize = resolveVideoComposerSize(modelValue, size);
  const hasSelectedModel = modelOptions.length > 0;

  useCloseOnScroll(modelOpen || paramsOpen, () => {
    setModelOpen(false);
    setParamsOpen(false);
  });

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <ComposerModelPicker
        value={modelValue}
        options={modelOptions}
        open={modelOpen}
        onOpenChange={setModelOpen}
        onSelect={(value) => {
          const nextConfig = getVideoComposerConfig(value);
          onChange({
            model: value,
            durationSeconds: nextConfig.defaultDuration,
            size: nextConfig.defaultSize,
          });
          setModelOpen(false);
        }}
        emptyLabel={copy.noVideoModelsAvailable}
        onEmptyAction={onRequestAddModel}
        triggerClassName={cn(
          "rounded-[10px]",
          hasSelectedModel ? "max-w-[220px]" : "max-w-full",
        )}
        dropdownClassName="w-[236px]"
        maxListHeightClassName="max-h-[320px]"
        dropdownContainer={dropdownContainer}
      />

      {hasSelectedModel ? (
        <div className="h-4 w-px shrink-0 bg-black/10 dark:bg-white/12" />
      ) : null}

      {hasSelectedModel ? (
        <DropdownMenu modal={false} open={paramsOpen} onOpenChange={setParamsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 justify-between gap-2 rounded-[10px] bg-transparent px-3.5 text-[13px] text-[#2f3540] hover:bg-black/[0.06] focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent dark:text-foreground/88 dark:hover:bg-white/12"
            >
              <span className="truncate text-left">{`${normalizedDuration}s · ${normalizedSize}`}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  paramsOpen && "rotate-180",
                )}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            sideOffset={8}
            collisionPadding={12}
            container={dropdownContainer ?? undefined}
            updatePositionStrategy="always"
            sticky="always"
            className="w-[324px] max-w-[calc(100vw-2rem)] rounded-[14px] border border-black/8 bg-white/98 p-0 text-[#2f3540] shadow-[0_18px_44px_-28px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-[#181818]/98 dark:text-foreground dark:shadow-[0_18px_44px_-28px_rgba(0,0,0,0.58)]"
          >
            <div className="space-y-4 p-3.5">
              <section className="space-y-3">
                <p className="text-[13px] font-medium text-[#434851] dark:text-foreground/72">
                  {copy.duration}
                </p>
                <div
                  className={cn(
                    "grid gap-2",
                    getGridColumnsClassName(videoConfig.durations.length),
                  )}
                >
                  {videoConfig.durations.map((duration) => (
                    <button
                      key={duration}
                      type="button"
                      onClick={() => onChange({ durationSeconds: duration })}
                      className={cn(
                        "inline-flex h-10 items-center justify-center rounded-[12px] border px-3.5 text-[14px] font-medium transition-colors",
                        normalizedDuration === duration
                          ? "border-[#c8ccd2] bg-[#dfe1e4] text-[#1f2329] dark:border-white/10 dark:bg-white/10 dark:text-foreground"
                          : "border-black/12 bg-white text-[#555b66] hover:bg-[#f8f8f9] dark:border-white/10 dark:bg-[#15171b] dark:text-foreground/62 dark:hover:bg-white/8",
                      )}
                    >
                      {duration}s
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-[13px] font-medium text-[#434851] dark:text-foreground/72">
                  {copy.aspectRatio}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {videoConfig.sizes.map((ratio) => (
                    <AspectRatioOptionCard
                      key={ratio}
                      ratio={ratio}
                      label={ratio}
                      selected={normalizedSize === ratio}
                      onClick={() => onChange({ size: ratio })}
                    />
                  ))}
                </div>
              </section>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

export function CanvasComposerTextControls({
  modelValue,
  modelOptions,
  onChange,
  onRequestAddModel,
  dropdownContainer,
}: {
  modelValue: string;
  modelOptions: ProviderModelOption[];
  onChange: (patch: { model?: string }) => void;
  onRequestAddModel?: () => void;
  dropdownContainer?: HTMLElement | null;
}) {
  const messages = useMessages() as AppMessages;
  const copy = getCanvasPageCopy(messages);
  const [modelOpen, setModelOpen] = useState(false);

  useCloseOnScroll(modelOpen, () => {
    setModelOpen(false);
  });

  return (
    <div className="flex min-w-0 items-center">
      <ComposerModelPicker
        value={modelValue}
        options={modelOptions}
        open={modelOpen}
        onOpenChange={setModelOpen}
        onSelect={(value) => {
          onChange({ model: value });
          setModelOpen(false);
        }}
        emptyLabel={copy.noTextModelsAvailable}
        onEmptyAction={onRequestAddModel}
        triggerClassName={cn(
          "rounded-[10px]",
          modelOptions.length > 0 ? "max-w-[220px]" : "max-w-full",
        )}
        dropdownClassName="w-[236px]"
        maxListHeightClassName="max-h-[320px]"
        dropdownContainer={dropdownContainer}
      />
    </div>
  );
}
