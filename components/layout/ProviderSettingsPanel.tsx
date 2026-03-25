"use client";

import Image from "next/image";
import { useMessages } from "next-intl";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  KeyRound,
  Loader2,
  Minus,
  PencilLine,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_PROVIDER_SETTINGS,
  encodeProviderModel,
  getProviderDefinition,
  getProviderDisplayName,
  getProviderModelOptions,
  getProviderPlatform,
  getProviderPlatformConfig,
  getProviderPlatformDisplayName,
  getProviderPresetModelTemplates,
  getProviderShortDisplayName,
  getProviderPlatforms,
  isProviderPlatformConfigured,
  isProviderModelEnabled,
  normalizeEditableProviderSettings,
  type ProviderCustomModel,
  type ProviderId,
  type ProviderModelKind,
  type ProviderModelOption,
  type ProviderPlatform,
  type ProviderSettings,
} from "@/lib/provider-settings";
import { testProviderModelWithApi } from "@/lib/provider/api";
import type { AppMessages } from "@/i18n/messages";
import {
  formatProviderCopy,
  getProviderSettingsCopy,
} from "@/lib/provider/copy";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type ProviderSettingsPanelProps = {
  settings: ProviderSettings;
  loading?: boolean;
  errorMessage?: string;
  resetDialogsToken?: number;
  openAddModelDialogToken?: number;
  openAddModelDialogKind?: ProviderModelKind | null;
  onChange: (settings: ProviderSettings) => void;
};

const KIND_ORDER: Record<ProviderModelKind, number> = {
  text: 0,
  image: 1,
  video: 2,
};

const DEFAULT_MODEL_FIELDS = {
  text: "textModel",
  image: "imageModel",
  video: "videoModel",
} as const;
const ALL_MODEL_KINDS = ["text", "image", "video"] as const;

const FEATURED_PROVIDER_IDS = [
  "openai",
  "google",
  "grok",
  "deepseek",
  "seedance",
  "hailuo",
  "kling",
  "sora",
  "veo",
] as const satisfies readonly ProviderId[];

const ADDABLE_PROVIDER_IDS = [
  "custom",
  ...FEATURED_PROVIDER_IDS,
] as const satisfies readonly ProviderId[];

type ProviderBrandMeta = {
  label: string;
  iconSrc?: string;
  monogram?: string;
};

const PROVIDER_BRAND_META: Partial<Record<ProviderId, ProviderBrandMeta>> = {
  openai: {
    label: "OpenAI",
    iconSrc: "/icons/gpt.svg",
  },
  google: {
    label: "Gemini",
    iconSrc: "/icons/gemini.svg",
  },
  grok: {
    label: "Grok",
    iconSrc: "/icons/grok.svg",
  },
  deepseek: {
    label: "DeepSeek",
    iconSrc: "/icons/deepseek.svg",
  },
  seedance: {
    label: "Seedance",
    iconSrc: "/icons/seedream.svg",
  },
  hailuo: {
    label: "Hailuo",
    iconSrc: "/icons/hailuo.svg",
  },
  kling: {
    label: "Kling",
    iconSrc: "/icons/kling.svg",
  },
  sora: {
    label: "Sora",
    iconSrc: "/icons/sora.svg",
  },
  veo: {
    label: "Veo",
    iconSrc: "/icons/veo.svg",
  },
  custom: {
    label: "Custom",
    iconSrc: "/icons/custom-endpoint.svg",
  },
};

function getProviderBrandMeta(
  providerId: ProviderId,
  options?: {
    customLabel?: string;
  },
) {
  const fallbackLabel = getProviderShortDisplayName(providerId);
  const baseMeta =
    PROVIDER_BRAND_META[providerId] ?? {
      label: fallbackLabel,
      monogram: fallbackLabel.slice(0, 2).toUpperCase(),
    };

  return providerId === "custom" && options?.customLabel
    ? {
        ...baseMeta,
        label: options.customLabel,
      }
    : baseMeta;
}

function getProviderKindLabel(
  kind: ProviderModelKind,
  copy: ReturnType<typeof getProviderSettingsCopy>,
) {
  switch (kind) {
    case "text":
      return copy.textKind;
    case "image":
      return copy.imageKind;
    case "video":
      return copy.videoKind;
    default:
      return kind;
  }
}

function ProviderBrandIcon({
  providerId,
  size = "md",
}: {
  providerId: ProviderId;
  size?: "sm" | "md";
}) {
  const meta = {
    ...getProviderBrandMeta(providerId),
    label: getProviderDisplayName(providerId),
  };
  const sizeClassName = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const imageClassName = size === "sm" ? "h-[18px] w-[18px]" : "h-[22px] w-[22px]";

  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", sizeClassName)} aria-hidden="true">
      {meta.iconSrc ? (
        <Image
          src={meta.iconSrc}
          alt=""
          width={24}
          height={24}
          className={cn(imageClassName, "object-contain")}
          unoptimized
        />
      ) : (
        <span className="text-[11px] font-semibold tracking-[0.06em] text-foreground dark:text-white">
          {meta.monogram ?? meta.label.slice(0, 1)}
        </span>
      )}
    </span>
  );
}

function KindBadge({ kind }: { kind: ProviderModelKind }) {
  const messages = useMessages() as AppMessages;
  const copy = getProviderSettingsCopy(messages);
  const palette =
    kind === "text"
      ? "bg-[#eef3ff] text-[#4767b3]"
      : kind === "image"
        ? "bg-[#eef8f0] text-[#3f7f5b]"
        : "bg-[#f5efff] text-[#6a57a6]";

  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium",
        palette,
      )}
    >
      {getProviderKindLabel(kind, copy)}
    </span>
  );
}

function FieldLabel({
  children,
  required = false,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <span className="text-[15px] font-medium text-foreground dark:text-white">
      {required ? <span className="mr-1 text-[#d45a51]">*</span> : null}
      {children}
    </span>
  );
}

function ProviderFieldControl({
  providerId,
  label,
  interactive = false,
  open = false,
  onClick,
  fieldRef,
}: {
  providerId: ProviderId | null;
  label?: string;
  interactive?: boolean;
  open?: boolean;
  onClick?: () => void;
  fieldRef?: RefObject<HTMLDivElement | null>;
}) {
  const messages = useMessages() as AppMessages;
  const copy = getProviderSettingsCopy(messages);
  const content = providerId ? (
    <div className="flex min-w-0 items-center gap-4">
      <ProviderBrandIcon providerId={providerId} size="sm" />
      <span className="truncate font-medium text-foreground dark:text-white">
        {label ?? getProviderDisplayName(providerId)}
      </span>
    </div>
  ) : (
    <span className="truncate font-medium text-muted-foreground dark:text-white/45">
      {copy.selectProviderPlatform}
    </span>
  );

  if (interactive) {
    return (
      <div ref={fieldRef} className="relative">
        <button
          type="button"
          onClick={onClick}
          aria-expanded={open}
          className="flex h-11 w-full items-center rounded-[14px] border border-black/8 bg-white px-4 pr-12 text-left text-[15px] shadow-none transition hover:bg-black/[0.015] dark:border-white/10 dark:bg-[#141414] dark:hover:bg-white/[0.03]"
        >
          {content}

          <ChevronDown
            className={cn(
              "pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform",
              open ? "rotate-180" : "",
            )}
          />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-11 w-full items-center rounded-[14px] border border-black/8 bg-white px-4 pr-12 text-left text-[15px] shadow-none dark:border-white/10 dark:bg-[#141414]">
      {content}
    </div>
  );
}

function OutlineActionButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center justify-center rounded-full border border-black/14 bg-white/84 px-4 text-[13px] font-medium text-foreground transition hover:bg-white dark:border-white/12 dark:bg-white/6 dark:text-white dark:hover:bg-white/10"
    >
      {children}
    </button>
  );
}

function HeaderIconButton({
  children,
  onClick,
  title,
  destructive = false,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-[9px] transition",
        destructive
          ? "text-[#b35a55] hover:bg-[#f9ecea] dark:text-[#f1aaa4] dark:hover:bg-[#3c2423]"
          : "text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06] dark:hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function TogglePill({
  checked,
  onClick,
  size = "md",
}: {
  checked: boolean;
  onClick: () => void;
  size?: "sm" | "md";
}) {
  const isSmall = size === "sm";

  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onClick}
      className={cn(
        "relative shrink-0 rounded-full transition-colors",
        isSmall ? "h-[18px] w-[32px]" : "h-[22px] w-[40px]",
        checked
          ? "bg-[#111111] dark:bg-white"
          : "bg-black/12 dark:bg-white/14",
      )}
    >
      <span
        className={cn(
          "absolute rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.18)] transition-[left] dark:bg-[#111111]",
          isSmall ? "top-[2px] h-[14px] w-[14px]" : "top-[2px] h-[18px] w-[18px]",
          checked
            ? isSmall
              ? "left-[16px] dark:bg-[#111111]"
              : "left-[20px] dark:bg-[#111111]"
            : "left-[2px]",
        )}
      />
    </button>
  );
}

const DROPDOWN_ITEM_CLASS =
  "flex h-11 w-full items-center gap-3 rounded-[12px] px-3 text-[15px] font-medium transition";

function FloatingDropdownPanel({
  open,
  anchorRef,
  portalContainerRef,
  viewportRef,
  onClose,
  children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  portalContainerRef?: RefObject<HTMLElement | null>;
  viewportRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) {
        return;
      }

      const portalContainer = portalContainerRef?.current ?? document.body;
      const viewport = viewportRef?.current;
      const rect = anchor.getBoundingClientRect();
      const portalRect =
        portalContainer === document.body
          ? {
              top: 0,
              left: 0,
              right: window.innerWidth,
              bottom: window.innerHeight,
            }
          : portalContainer.getBoundingClientRect();
      const viewportRect =
        viewport?.getBoundingClientRect() ?? {
          top: 0,
          left: 0,
          right: window.innerWidth,
          bottom: window.innerHeight,
        };
      const viewportPadding = 16;
      const gap = 8;
      const availableBelow = viewportRect.bottom - rect.bottom - gap;
      const availableAbove = rect.top - viewportRect.top - gap;
      const shouldOpenUp = availableBelow < 180 && availableAbove > availableBelow;
      const width = Math.min(
        rect.width,
        viewportRect.right - viewportRect.left - viewportPadding * 2,
      );
      const anchoredLeft = Math.max(
        viewportRect.left + viewportPadding,
        Math.min(rect.left, viewportRect.right - width - viewportPadding),
      );
      const left = Math.max(0, anchoredLeft - portalRect.left);
      const maxHeight = Math.max(
        120,
        Math.min(280, shouldOpenUp ? availableAbove : availableBelow),
      );

      setPortalNode(portalContainer);
      setPanelStyle(
        shouldOpenUp
          ? {
              position: portalContainer === document.body ? "fixed" : "absolute",
              left,
              bottom: portalRect.bottom - rect.top + gap,
              width,
              maxHeight,
            }
          : {
              position: portalContainer === document.body ? "fixed" : "absolute",
              left,
              top: rect.bottom - portalRect.top + gap,
              width,
              maxHeight,
            },
      );
    };

    const frameId = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, open, portalContainerRef, viewportRef]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;

      if (!target) {
        return;
      }

      if (
        anchorRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }

      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("touchstart", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("touchstart", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [anchorRef, onClose, open]);

  if (
    !open ||
    !panelStyle ||
    !portalNode ||
    typeof document === "undefined" ||
    typeof window === "undefined"
  ) {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      style={panelStyle}
      className="z-[80]"
      data-canvas-zoom-relay=""
      data-provider-dropdown-content="true"
    >
      <div className="overflow-hidden rounded-[16px] border border-black/8 bg-white p-1.5 shadow-[0_24px_72px_-32px_rgba(15,23,42,0.26)] dark:border-white/10 dark:bg-[#141414] dark:shadow-[0_26px_72px_-34px_rgba(0,0,0,0.64)]">
        <div
          className="model-picker-scrollbar overflow-y-auto overscroll-contain pr-1"
          style={{
            maxHeight:
              typeof panelStyle.maxHeight === "number"
                ? Math.max(96, panelStyle.maxHeight - 12)
                : panelStyle.maxHeight,
          }}
          onWheelCapture={(event) => event.stopPropagation()}
        >
          <div className="space-y-1.5">{children}</div>
        </div>
      </div>
    </div>,
    portalNode,
  );
}

function normalizeCustomModelLabel(modelId: string) {
  return modelId.trim();
}

function platformAppearsInDefaults(
  settings: ProviderSettings,
  platformId: string,
) {
  return (["text", "image", "video"] as const).some((kind) =>
    settings.defaults[DEFAULT_MODEL_FIELDS[kind]].startsWith(`${platformId}::`),
  );
}

function platformHasPresence(settings: ProviderSettings, platformId: string) {
  return (
    isProviderPlatformConfigured(settings, platformId) ||
    settings.customModels.some((model) => model.platformId === platformId) ||
    platformAppearsInDefaults(settings, platformId)
  );
}

function getFallbackModelValue(
  platformId: string,
  kind: ProviderModelKind,
  settings: ProviderSettings,
  excludedValue?: string,
) {
  const options = getProviderModelOptions(kind, settings, {
    includeDisabled: true,
  }).filter(
    (model) => model.value !== excludedValue,
  );

  const enabledDifferentPlatform = options.find(
    (model) =>
      model.platformId !== platformId &&
      platformHasPresence(settings, model.platformId) &&
      isProviderModelEnabled(settings, model.value),
  );

  if (enabledDifferentPlatform) {
    return enabledDifferentPlatform.value;
  }

  const enabledSamePlatform = options.find(
    (model) =>
      model.platformId === platformId &&
      isProviderModelEnabled(settings, model.value),
  );
  if (enabledSamePlatform) {
    return enabledSamePlatform.value;
  }

  const differentPlatformOption = options.find(
    (model) => model.platformId !== platformId,
  );
  if (differentPlatformOption) {
    return differentPlatformOption.value;
  }

  return options.find((model) => model.platformId === platformId)?.value ?? null;
}

function getPreferredAddProviderId(settings: ProviderSettings) {
  return (
    FEATURED_PROVIDER_IDS.find(
      (providerId) => getProviderPlatforms(settings, providerId).length === 0,
    ) ?? FEATURED_PROVIDER_IDS[0]
  );
}

function getProviderPresetModels(
  providerId: ProviderId,
  options?: {
    platformId?: string;
  },
) {
  const platformId = options?.platformId ?? providerId;

  return getProviderPresetModelTemplates(providerId)
    .map((model) => ({
      ...model,
      platformId,
      value: encodeProviderModel(platformId, model.modelId),
    }))
    .sort((left, right) =>
      left.modelId.localeCompare(right.modelId),
    );
}

function getApiKeyInputPlaceholder(
  providerId: ProviderId,
  copy: ReturnType<typeof getProviderSettingsCopy>,
) {
  return formatProviderCopy(copy.enterApiKeyForProvider, {
    provider: getProviderBrandMeta(providerId, {
      customLabel: copy.customProvider,
    }).label,
  });
}

function getBaseUrlInputPlaceholder(
  providerId: ProviderId,
  copy: ReturnType<typeof getProviderSettingsCopy>,
) {
  const placeholder = getProviderDefinition(providerId).baseUrlPlaceholder.trim();

  if (/^optional\b/i.test(placeholder)) {
    return copy.enterBaseUrl;
  }

  return placeholder;
}

function createEmptyPlatformDraft(providerId: ProviderId) {
  return {
    displayName: "",
    apiKey: "",
    baseUrl: getProviderDefinition(providerId).defaultBaseUrl,
  };
}

function getNextPlatformId(
  settings: ProviderSettings,
  providerId: ProviderId,
) {
  const existingIds = new Set(settings.platforms.map((platform) => platform.id));
  if (!existingIds.has(providerId)) {
    return providerId;
  }

  let index = 2;
  let nextId = `${providerId}-${index}`;
  while (existingIds.has(nextId)) {
    index += 1;
    nextId = `${providerId}-${index}`;
  }

  return nextId;
}

function applyProviderModelSelection(
  settings: ProviderSettings,
  platformId: string,
  providerId: ProviderId,
  modelId: string,
  kind: ProviderModelKind,
) {
  const nextCustomModels = [...settings.customModels];
  const trimmedModelId = modelId.trim();
  let nextHiddenPresetModels = settings.hiddenPresetModels;

  if (trimmedModelId.length > 0) {
    const presetMatch = getProviderPresetModels(providerId, {
      platformId,
    }).find(
      (model) => model.modelId.toLowerCase() === trimmedModelId.toLowerCase(),
    );
    const usesPresetKind = presetMatch?.kind === kind;
    const duplicateExists = nextCustomModels.some(
      (model) =>
        model.platformId === platformId &&
        model.kind === kind &&
        model.modelId.toLowerCase() === trimmedModelId.toLowerCase(),
    );

    if (presetMatch && usesPresetKind) {
      nextHiddenPresetModels = settings.hiddenPresetModels.filter(
        (value) => value !== presetMatch.value,
      );
    } else if (!duplicateExists) {
      nextCustomModels.push({
        platformId,
        providerId,
        kind,
        modelId: trimmedModelId,
        label: normalizeCustomModelLabel(trimmedModelId),
        description: "",
      });
    }
  }

  return {
    customModels: nextCustomModels,
    hiddenPresetModels: nextHiddenPresetModels,
  };
}

function findCustomModelForOption(
  settings: ProviderSettings,
  model: ProviderModelOption,
) {
  return (
    settings.customModels.find(
      (item) =>
        item.platformId === model.platformId &&
        item.providerId === model.providerId &&
        item.kind === model.kind &&
        item.modelId === model.modelId,
    ) ?? null
  );
}

function buildProviderModelTestPayload(
  settings: ProviderSettings,
  model: ProviderModelOption,
) {
  const platform = getProviderPlatform(settings, model.platformId);
  if (!platform) {
    return null;
  }

  const customModel = model.preset
    ? null
    : findCustomModelForOption(settings, model);

  return {
    model: model.value,
    kind: model.kind,
    imageAspectRatio:
      settings.defaults.imageAspectRatio ||
      DEFAULT_PROVIDER_SETTINGS.defaults.imageAspectRatio,
    platform: {
      id: platform.id,
      providerId: platform.providerId,
      apiKey: platform.apiKey,
      baseUrl: platform.baseUrl,
      displayName: platform.displayName ?? "",
    } satisfies ProviderPlatform,
    customModel: customModel
      ? ({
          platformId: customModel.platformId,
          providerId: customModel.providerId,
          modelId: customModel.modelId,
          kind: customModel.kind,
          label: customModel.label,
          description: customModel.description,
        } satisfies ProviderCustomModel)
      : null,
  };
}

function ModelSelectionFields({
  providerId,
  modelId,
  modelKind,
  onModelIdChange,
  onModelKindChange,
  portalContainerRef,
  viewportRef,
}: {
  providerId: ProviderId | null;
  modelId: string;
  modelKind: ProviderModelKind;
  onModelIdChange: (value: string) => void;
  onModelKindChange: (kind: ProviderModelKind) => void;
  portalContainerRef: RefObject<HTMLElement | null>;
  viewportRef: RefObject<HTMLElement | null>;
}) {
  const messages = useMessages() as AppMessages;
  const copy = getProviderSettingsCopy(messages);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const modelFieldRef = useRef<HTMLDivElement | null>(null);
  const presetModels = providerId ? getProviderPresetModels(providerId) : [];
  const showPresetModelPicker = !!providerId && providerId !== "custom";
  const modelPickerItems = presetModels.map((preset) => ({
    value: preset.modelId,
    label: preset.modelId,
    kind: preset.kind,
  }));

  return (
    <>
      <div className="grid gap-2.5">
        <FieldLabel required>{copy.modelName}</FieldLabel>
        <div ref={modelFieldRef} className="relative">
          <div
            className={cn(
              "flex h-11 w-full items-center rounded-[14px] border border-black/8 bg-white shadow-none transition focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/18 dark:border-white/10 dark:bg-[#141414]",
              showPresetModelPicker ? "pr-1" : "",
            )}
          >
            <Input
              value={modelId}
              onChange={(event) => onModelIdChange(event.target.value)}
              placeholder={
                providerId
                  ? formatProviderCopy(copy.modelIdPlaceholderWithExample, {
                      example: "gpt-5-mini",
                    })
                  : copy.modelIdPlaceholder
              }
              className="h-full border-0 bg-transparent px-4 text-[15px] shadow-none focus-visible:ring-0 dark:bg-transparent"
            />

            {showPresetModelPicker ? (
              <button
                type="button"
                onClick={() => setModelPickerOpen((current) => !current)}
                aria-expanded={modelPickerOpen}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium transition",
                  modelPickerOpen
                    ? "bg-[#111111] text-white dark:bg-white dark:text-[#111111]"
                    : "bg-black/[0.045] text-foreground hover:bg-black/[0.07] dark:bg-white/[0.08] dark:text-white dark:hover:bg-white/[0.12]",
	                )}
	              >
	                <span>{copy.preset}</span>
	                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    modelPickerOpen ? "rotate-180" : "",
                  )}
                />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-2.5">
        <FieldLabel required>{copy.type}</FieldLabel>
        <div className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-[14px] bg-[#f5f5f2] p-1 dark:bg-[#141414]">
          {ALL_MODEL_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => onModelKindChange(kind)}
              className={cn(
                "h-[34px] min-w-[92px] rounded-[10px] px-4 text-[14px] font-medium transition",
                modelKind === kind
                  ? "bg-white text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.08),0_0_0_1px_rgba(15,23,42,0.05)] dark:bg-[#1a2028] dark:text-white dark:shadow-[0_1px_2px_rgba(0,0,0,0.24)]"
                  : "text-muted-foreground hover:bg-white/65 hover:text-foreground dark:text-white/58 dark:hover:bg-white/[0.04] dark:hover:text-white",
	              )}
	            >
	              {getProviderKindLabel(kind, copy)}
	            </button>
	          ))}
        </div>
      </div>

      {showPresetModelPicker ? (
        <FloatingDropdownPanel
          open={modelPickerOpen}
          anchorRef={modelFieldRef}
          portalContainerRef={portalContainerRef}
          viewportRef={viewportRef}
          onClose={() => setModelPickerOpen(false)}
        >
          {modelPickerItems.length > 0 ? (
            modelPickerItems.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  onModelIdChange(item.value);
                  onModelKindChange(item.kind);
                  setModelPickerOpen(false);
                }}
                className={cn(
                  DROPDOWN_ITEM_CLASS,
                  "text-foreground hover:bg-black/[0.03] dark:text-white dark:hover:bg-white/[0.05]",
                )}
              >
                <span className="truncate">{item.label}</span>
              </button>
            ))
          ) : (
            <div className="flex min-h-11 items-center rounded-[12px] px-3 text-[13px] text-muted-foreground dark:text-white/48">
              {copy.noPresetModels}
            </div>
          )}
        </FloatingDropdownPanel>
      ) : null}
    </>
  );
}

function ProviderModelDialog({
  open,
  mode,
  initialProviderId,
  initialPlatformId,
  initialModelKind,
  settings,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  mode: "add" | "edit";
  initialProviderId: ProviderId;
  initialPlatformId?: string | null;
  initialModelKind?: ProviderModelKind | null;
  settings: ProviderSettings;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: {
    platformId?: string | null;
    providerId: ProviderId;
    displayName: string;
    apiKey: string;
    baseUrl: string;
    modelId: string;
    kind: ProviderModelKind;
  }) => void;
}) {
  const messages = useMessages() as AppMessages;
  const copy = getProviderSettingsCopy(messages);
  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const dialogContentRef = useRef<HTMLDivElement | null>(null);
  const dialogViewportRef = useRef<HTMLDivElement | null>(null);
  const providerFieldRef = useRef<HTMLDivElement | null>(null);
  const initialPlatform =
    mode === "edit" && initialPlatformId
      ? getProviderPlatform(settings, initialPlatformId)
      : null;
  const initialDraftConfig = initialPlatform
    ? getProviderPlatformConfig(settings, initialPlatform.id, initialPlatform.providerId)
    : createEmptyPlatformDraft(initialProviderId);
  const [draftProviderId, setDraftProviderId] = useState<ProviderId | null>(
    mode === "add" ? null : initialPlatform?.providerId ?? initialProviderId,
  );
  const [providerDisplayName, setProviderDisplayName] = useState(
    initialPlatform?.displayName ?? initialDraftConfig.displayName ?? "",
  );
  const [apiKey, setApiKey] = useState(initialDraftConfig.apiKey ?? "");
  const [baseUrl, setBaseUrl] = useState(
    mode === "add" ? "" : initialDraftConfig.baseUrl ?? "",
  );
  const [modelId, setModelId] = useState("");
  const [modelKind, setModelKind] = useState<ProviderModelKind>(
    initialModelKind ??
      (draftProviderId
      ? getProviderDefinition(draftProviderId).supportedKinds[0] ?? "text"
      : "text"),
  );

  const selectedProvider = draftProviderId
    ? getProviderDefinition(draftProviderId)
    : null;
  const shouldPreserveComposerKind =
    mode === "add" && initialModelKind !== null && initialModelKind !== undefined;
  const confirmDisabled =
    !draftProviderId ||
    !baseUrl.trim() ||
    !apiKey.trim() ||
    (mode === "add" && !modelId.trim());

  const providerPickerItems = ADDABLE_PROVIDER_IDS.map((providerId) => ({
    value: providerId,
    label: getProviderBrandMeta(providerId, {
      customLabel: copy.customProvider,
    }).label,
    providerId,
  }));

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setProviderPickerOpen(false);
        }

        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        ref={dialogContentRef}
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (
            target?.closest("[data-provider-dropdown-content='true']")
          ) {
            event.preventDefault();
          }
        }}
        className="flex max-w-[540px] flex-col gap-0 overflow-hidden rounded-[24px] border border-black/8 bg-white p-0 shadow-[0_28px_90px_-36px_rgba(15,23,42,0.38)] dark:border-white/10 dark:bg-[#10161d] dark:shadow-[0_32px_96px_-36px_rgba(0,0,0,0.72)]"
      >
        <DialogHeader className="border-b border-black/6 px-6 py-5 text-left dark:border-white/10">
          <DialogTitle className="text-[20px] font-semibold text-foreground dark:text-white">
            {mode === "add" ? copy.addModelTitle : copy.editPlatformTitle}
          </DialogTitle>
        </DialogHeader>

        <div
          ref={dialogViewportRef}
          className="space-y-4 px-6 py-5"
        >
          <div className="grid gap-2.5">
            <FieldLabel required>{copy.providerPlatform}</FieldLabel>

            <ProviderFieldControl
              providerId={draftProviderId}
              label={
                draftProviderId
                  ? getProviderBrandMeta(draftProviderId, {
                      customLabel: copy.customProvider,
                    }).label
                  : undefined
              }
              interactive={mode === "add"}
              open={providerPickerOpen}
              onClick={() => {
                setProviderPickerOpen((current) => !current);
              }}
              fieldRef={providerFieldRef}
            />
          </div>

          <label className="grid gap-2.5">
            <FieldLabel>{copy.displayName}</FieldLabel>
            <Input
              value={providerDisplayName}
              onChange={(event) => setProviderDisplayName(event.target.value)}
              placeholder={
                draftProviderId
                  ? formatProviderCopy(copy.displayNamePlaceholderWithExample, {
                      example: `${getProviderBrandMeta(draftProviderId, {
                        customLabel: copy.customProvider,
                      }).label} 2`,
                    })
                  : copy.displayNamePlaceholder
              }
              className="h-11 rounded-[14px] border border-black/8 bg-white px-4 text-[15px] shadow-none dark:border-white/10 dark:bg-[#141414]"
            />
          </label>

          <label className="grid gap-2.5">
            <FieldLabel required>{copy.baseUrl}</FieldLabel>
            <Input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder={
                draftProviderId
                  ? getBaseUrlInputPlaceholder(draftProviderId, copy)
                  : copy.selectProviderFirst
              }
              disabled={!draftProviderId || !selectedProvider?.baseUrlEditable}
              className="h-11 rounded-[14px] border border-black/8 bg-white px-4 text-[15px] shadow-none disabled:opacity-70 dark:border-white/10 dark:bg-[#141414]"
            />
          </label>

          <label className="grid gap-2.5">
            <FieldLabel required>{copy.apiKey}</FieldLabel>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={
                  draftProviderId
                    ? getApiKeyInputPlaceholder(draftProviderId, copy)
                    : copy.selectProviderFirst
                }
                disabled={!draftProviderId}
                className="h-11 rounded-[14px] border border-black/8 bg-white px-4 pr-10 text-[15px] shadow-none dark:border-white/10 dark:bg-[#141414]"
              />
            </div>
          </label>

          {mode === "add" ? (
            <div className="grid gap-4">
              <ModelSelectionFields
                key={draftProviderId ?? "unselected-provider"}
                providerId={draftProviderId}
                modelId={modelId}
                modelKind={modelKind}
                onModelIdChange={setModelId}
                onModelKindChange={setModelKind}
                portalContainerRef={dialogContentRef}
                viewportRef={dialogViewportRef}
              />
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t border-black/6 px-6 py-4 dark:border-white/10">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-[12px] px-5 text-[15px] text-muted-foreground hover:text-foreground dark:text-white/70 dark:hover:text-white"
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (confirmDisabled || !draftProviderId) {
                return;
              }

              onConfirm({
                platformId: initialPlatformId,
                providerId: draftProviderId,
                displayName: providerDisplayName,
                apiKey,
                baseUrl,
                modelId,
                kind: modelKind,
              });
              onOpenChange(false);
            }}
            disabled={confirmDisabled}
            className="h-10 rounded-[12px] bg-[#1f2937] px-6 text-[15px] text-white hover:bg-[#111827] dark:bg-white dark:text-[#111111] dark:hover:bg-white/90"
          >
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>

      {mode === "add" ? (
        <>
          <FloatingDropdownPanel
            open={providerPickerOpen}
            anchorRef={providerFieldRef}
            portalContainerRef={dialogContentRef}
            viewportRef={dialogViewportRef}
            onClose={() => setProviderPickerOpen(false)}
          >
            {providerPickerItems.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  const nextProviderId = item.value as ProviderId;
                  const config = createEmptyPlatformDraft(nextProviderId);
                  const providerDefinition = getProviderDefinition(nextProviderId);
                  const nextKind = shouldPreserveComposerKind
                    ? modelKind
                    : providerDefinition.supportedKinds[0] ?? "text";
                  setDraftProviderId(nextProviderId);
                  setProviderDisplayName(config.displayName ?? "");
                  setApiKey(config.apiKey);
                  setBaseUrl(
                    providerDefinition.baseUrlEditable ? "" : config.baseUrl,
                  );
                  setModelId("");
                  setModelKind(nextKind);
                  setProviderPickerOpen(false);
                }}
                className={cn(
                  DROPDOWN_ITEM_CLASS,
                  item.value === draftProviderId
                    ? "bg-black/[0.05] text-foreground dark:bg-white/[0.08] dark:text-white"
                    : "text-foreground hover:bg-black/[0.03] dark:text-white dark:hover:bg-white/[0.05]",
                )}
              >
                {item.providerId ? (
                  <ProviderBrandIcon providerId={item.providerId} size="sm" />
                ) : null}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </FloatingDropdownPanel>
        </>
      ) : null}
    </Dialog>
  );
}

function QuickAddModelDialog({
  open,
  platformId,
  settings,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  platformId: string;
  settings: ProviderSettings;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: {
    platformId: string;
    providerId: ProviderId;
    modelId: string;
    kind: ProviderModelKind;
  }) => void;
}) {
  const messages = useMessages() as AppMessages;
  const copy = getProviderSettingsCopy(messages);
  const dialogContentRef = useRef<HTMLDivElement | null>(null);
  const dialogViewportRef = useRef<HTMLDivElement | null>(null);
  const platform = getProviderPlatform(settings, platformId);
  const providerId = platform?.providerId ?? "custom";
  const platformDisplayName = platform?.displayName ?? "";
  const [modelId, setModelId] = useState("");
  const [modelKind, setModelKind] = useState<ProviderModelKind>(
    getProviderDefinition(providerId).supportedKinds[0] ?? "text",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialogContentRef}
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-provider-dropdown-content='true']")) {
            event.preventDefault();
          }
        }}
        className="flex max-w-[540px] flex-col gap-0 overflow-hidden rounded-[22px] border border-black/8 bg-white p-0 shadow-[0_24px_72px_-32px_rgba(15,23,42,0.32)] dark:border-white/10 dark:bg-[#10161d] dark:shadow-[0_28px_80px_-34px_rgba(0,0,0,0.68)]"
      >
        <DialogHeader className="border-b border-black/6 px-6 py-5 text-left dark:border-white/10">
          <DialogTitle className="text-[20px] font-semibold text-foreground dark:text-white">
            {copy.addModelTitle}
          </DialogTitle>
        </DialogHeader>

        <div
          ref={dialogViewportRef}
          className="space-y-4 px-6 py-5"
        >
          <div className="grid gap-2.5">
            <FieldLabel required>{copy.providerPlatform}</FieldLabel>
            <ProviderFieldControl
              providerId={providerId}
              label={getProviderBrandMeta(providerId, {
                customLabel: copy.customProvider,
              }).label}
            />
          </div>

          <label className="grid gap-2.5">
            <FieldLabel>{copy.displayName}</FieldLabel>
            <Input
              value={platformDisplayName}
              readOnly
              placeholder={copy.notSet}
              className="h-11 rounded-[14px] border border-black/8 bg-white px-4 text-[15px] shadow-none focus-visible:ring-0 dark:border-white/10 dark:bg-[#141414]"
            />
          </label>

          <ModelSelectionFields
            providerId={providerId}
            modelId={modelId}
            modelKind={modelKind}
            onModelIdChange={setModelId}
            onModelKindChange={setModelKind}
            portalContainerRef={dialogContentRef}
            viewportRef={dialogViewportRef}
          />
        </div>

        <DialogFooter className="border-t border-black/6 px-6 py-4 dark:border-white/10">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-[12px] px-5 text-[15px] text-muted-foreground hover:text-foreground dark:text-white/70 dark:hover:text-white"
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (!modelId.trim()) {
                return;
              }

              onConfirm({
                platformId,
                providerId,
                modelId,
                kind: modelKind,
              });
              onOpenChange(false);
            }}
            disabled={!modelId.trim()}
            className="h-10 rounded-[12px] bg-[#1f2937] px-6 text-[15px] text-white hover:bg-[#111827] dark:bg-white dark:text-[#111111] dark:hover:bg-white/90"
          >
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModelsLibraryPage({
  settings,
  onOpenAddDialog,
  onOpenEditDialog,
  onOpenQuickAdd,
  onTogglePlatform,
  onToggleModel,
  onTestModel,
  testingModelValue,
  onRemovePlatform,
  onRemoveModel,
}: {
  settings: ProviderSettings;
  onOpenAddDialog: (providerId: ProviderId) => void;
  onOpenEditDialog: (platformId: string) => void;
  onOpenQuickAdd: (platformId: string) => void;
  onTogglePlatform: (platformId: string) => void;
  onToggleModel: (model: ProviderModelOption) => void;
  onTestModel: (model: ProviderModelOption) => void;
  testingModelValue: string | null;
  onRemovePlatform: (platformId: string) => void;
  onRemoveModel: (model: ProviderModelOption) => void;
}) {
  const messages = useMessages() as AppMessages;
  const copy = getProviderSettingsCopy(messages);
  const [collapsedPlatforms, setCollapsedPlatforms] = useState<Record<string, boolean>>({});
  const { confirm, confirmDialog } = useConfirmDialog();

  const requestPlatformRemoval = async (
    platformId: string,
    platformLabel: string,
  ) => {
    const confirmed = await confirm({
      title: copy.deletePlatformTitle,
      description: formatProviderCopy(copy.deletePlatformDescription, {
        platform: platformLabel,
      }),
      confirmLabel: copy.deletePlatformConfirm,
      cancelLabel: copy.deletePlatformCancel,
      tone: "destructive",
    });

    if (!confirmed) {
      return;
    }

    onRemovePlatform(platformId);
  };

  const requestModelRemoval = async (model: ProviderModelOption) => {
    const confirmed = await confirm({
      title: copy.deleteModelTitle,
      description: formatProviderCopy(copy.deleteModelDescription, {
        model: model.modelId,
      }),
      confirmLabel: copy.deleteModelConfirm,
      cancelLabel: copy.deleteModelCancel,
      tone: "destructive",
    });

    if (!confirmed) {
      return;
    }

    onRemoveModel(model);
  };

  const platformGroups = useMemo(
    () =>
      settings.platforms.map((platform) => {
        const models = (["text", "image", "video"] as const)
          .flatMap((kind) =>
            getProviderModelOptions(kind, settings, {
              includeDisabled: true,
            }).filter(
              (model) => model.platformId === platform.id,
            ),
          )
          .sort((left, right) => {
            const kindDiff = KIND_ORDER[left.kind] - KIND_ORDER[right.kind];
            if (kindDiff !== 0) {
              return kindDiff;
            }

            if (left.preset !== right.preset) {
              return left.preset ? -1 : 1;
            }

            return left.modelId.localeCompare(right.modelId);
          });

        return {
          platformId: platform.id,
          providerId: platform.providerId,
          label: getProviderPlatformDisplayName(
            platform.id,
            settings,
            platform.providerId,
          ),
          models,
          active:
            models.length > 0 &&
            models.every((model) => isProviderModelEnabled(settings, model.value)),
        };
      }).filter(
        (group) =>
          group.models.length > 0 || platformHasPresence(settings, group.platformId),
      ),
    [settings],
  );

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-20 -mx-3.5 bg-white/96 px-3.5 pb-2.5 pt-3.5 backdrop-blur dark:bg-[#10161d]/96">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[18px] font-semibold text-foreground dark:text-white">
            {copy.models}
          </h2>

          <OutlineActionButton
            onClick={() => onOpenAddDialog(getPreferredAddProviderId(settings))}
          >
            <span className="mr-1 text-[14px]">+</span>
            {copy.addModel}
          </OutlineActionButton>
        </div>
      </div>

      {platformGroups.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-10 text-center">
          <div aria-hidden="true" className="relative mb-7 h-[156px] w-[236px]">
            <div className="absolute left-1/2 top-6 h-[104px] w-[104px] -translate-x-1/2 rounded-[32px] bg-[#f1f4f9] shadow-[0_24px_50px_-32px_rgba(15,23,42,0.28)] dark:bg-[#171d26] dark:shadow-[0_24px_50px_-32px_rgba(0,0,0,0.58)]" />
            <div className="absolute left-1/2 top-[22px] flex h-[104px] w-[104px] -translate-x-1/2 items-center justify-center rounded-[32px] bg-white shadow-[0_24px_56px_-30px_rgba(15,23,42,0.22)] dark:bg-[#10161d] dark:shadow-[0_24px_56px_-30px_rgba(0,0,0,0.62)]">
              <div className="relative h-11 w-11">
                <span className="absolute left-1 top-1 h-[18px] w-[18px] rounded-[7px] border border-[#161616]/14 bg-[#eef2f7] shadow-[0_10px_18px_-14px_rgba(15,23,42,0.4)] dark:border-white/12 dark:bg-[#19212b]" />
                <span className="absolute right-0 top-2.5 h-[18px] w-[18px] rounded-[7px] border border-[#161616]/14 bg-[#f4efe7] shadow-[0_10px_18px_-14px_rgba(15,23,42,0.4)] dark:border-white/12 dark:bg-[#231d18]" />
                <span className="absolute bottom-0 left-1/2 h-[20px] w-[20px] -translate-x-1/2 rounded-[8px] border border-[#161616]/14 bg-[#edf7f1] shadow-[0_10px_18px_-14px_rgba(15,23,42,0.4)] dark:border-white/12 dark:bg-[#17241d]" />
                <span className="absolute left-[17px] top-[14px] h-[12px] w-[1.5px] rounded-full bg-[#161616]/18 dark:bg-white/18" />
                <span className="absolute left-[17px] top-[14px] h-[1.5px] w-[10px] rounded-full bg-[#161616]/18 dark:bg-white/18" />
                <span className="absolute left-[20px] top-[23px] h-[8px] w-[1.5px] rounded-full bg-[#161616]/18 dark:bg-white/18" />
              </div>
            </div>

            <div className="absolute left-2 top-[56px] rotate-[-10deg] rounded-[18px] bg-white px-4 py-3 shadow-[0_20px_38px_-28px_rgba(15,23,42,0.26)] dark:bg-[#141a22] dark:shadow-[0_20px_38px_-28px_rgba(0,0,0,0.64)]">
              <div className="mb-2 h-2.5 w-2.5 rounded-full bg-[#7c8cf8]" />
              <p className="text-[14px] font-semibold text-foreground dark:text-white">
                {copy.textKind}
              </p>
            </div>

            <div className="absolute right-1 top-[74px] rotate-[9deg] rounded-[18px] bg-white px-4 py-3 shadow-[0_20px_38px_-28px_rgba(15,23,42,0.26)] dark:bg-[#141a22] dark:shadow-[0_20px_38px_-28px_rgba(0,0,0,0.64)]">
              <div className="mb-2 h-2.5 w-2.5 rounded-full bg-[#66b88f]" />
              <p className="text-[14px] font-semibold text-foreground dark:text-white">
                {copy.imageKind}
              </p>
            </div>

            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-[18px] bg-white px-4 py-3 shadow-[0_20px_38px_-28px_rgba(15,23,42,0.26)] dark:bg-[#141a22] dark:shadow-[0_20px_38px_-28px_rgba(0,0,0,0.64)]">
              <div className="mb-2 h-2.5 w-2.5 rounded-full bg-[#f0a35e]" />
              <p className="text-[14px] font-semibold text-foreground dark:text-white">
                {copy.videoKind}
              </p>
            </div>
          </div>

          <p className="text-[24px] font-semibold tracking-[-0.04em] text-foreground dark:text-white">
            {copy.noAvailableModels}
          </p>
          <p className="mt-2 text-[16px] text-muted-foreground dark:text-white/58">
            {copy.addPlatformAndModel}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {platformGroups.map((group) => {
            const isCollapsed = collapsedPlatforms[group.platformId] ?? false;

            return (
              <section
                key={group.platformId}
                className="overflow-hidden rounded-[18px] border border-black/6 bg-white/84 shadow-[0_16px_38px_-34px_rgba(15,23,42,0.18)] backdrop-blur dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedPlatforms((current) => ({
                        ...current,
                        [group.platformId]: !current[group.platformId],
                      }))
                    }
                    className="flex min-w-0 items-center gap-2.5 text-left"
                  >
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-foreground transition-transform duration-200 dark:text-white",
                        isCollapsed ? "-rotate-90" : "rotate-0",
                      )}
                    />
                    <ProviderBrandIcon
                      providerId={group.providerId}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[16px] font-medium text-foreground dark:text-white">
                        {group.label}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-0.5">
                    <TogglePill
                      checked={group.active}
                      onClick={() => onTogglePlatform(group.platformId)}
                    />
                    <HeaderIconButton
                      title={copy.addModelTooltip}
                      onClick={() => onOpenQuickAdd(group.platformId)}
                    >
                      <Plus className="h-4 w-4" />
                    </HeaderIconButton>
                    <HeaderIconButton
                      title={copy.removePlatformTooltip}
                      destructive
                      onClick={() => {
                        void requestPlatformRemoval(
                          group.platformId,
                          group.label,
                        );
                      }}
                    >
                      <Minus className="h-4 w-4" />
                    </HeaderIconButton>
                    <HeaderIconButton
                      title={copy.editPlatformTooltip}
                      onClick={() => onOpenEditDialog(group.platformId)}
                    >
                      <PencilLine className="h-4 w-4" />
                    </HeaderIconButton>
                  </div>
                </div>

                <div
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300",
                    isCollapsed
                      ? "grid-rows-[0fr] opacity-0"
                      : "grid-rows-[1fr] opacity-100",
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="bg-[#fbfbfa] dark:bg-[#0f141b]">
                      {group.models.map((model) => {
                        const isActive = isProviderModelEnabled(settings, model.value);
                        const isTesting = testingModelValue === model.value;
                        return (
                          <div
                            key={model.value}
                            className={cn(
                              "group/model-row flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]",
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-[14px] font-medium text-foreground dark:text-white">
                                  {model.modelId}
                                </p>
                                <TogglePill
                                  size="sm"
                                  checked={isActive}
                                  onClick={() => onToggleModel(model)}
                                />
                                <KindBadge kind={model.kind} />
                              </div>
                            </div>

                            <div
                              className={cn(
                                "flex shrink-0 items-center gap-2 transition-opacity",
                                isTesting
                                  ? "opacity-100"
                                  : "pointer-events-none opacity-0 group-hover/model-row:pointer-events-auto group-hover/model-row:opacity-100",
                              )}
                            >
                              <button
                                type="button"
                                disabled={isTesting}
                                className="inline-flex h-8 items-center rounded-full px-3 text-[12px] font-medium text-foreground transition-colors group-hover/model-row:bg-black/[0.03] hover:bg-black/[0.05] disabled:cursor-wait disabled:opacity-70 dark:text-white dark:group-hover/model-row:bg-white/[0.05] dark:hover:bg-white/[0.08]"
                                onClick={() => onTestModel(model)}
                              >
                                {isTesting ? (
                                  <>
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    {copy.testing}
                                  </>
                                ) : (
                                  copy.test
                                )}
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-8 items-center rounded-full px-3 text-[12px] font-medium text-[#b24b43] transition-colors group-hover/model-row:bg-[#fff6f4] hover:bg-[#fff1f0] dark:text-[#ff9b92] dark:group-hover/model-row:bg-[#211514] dark:hover:bg-[#251715]"
                                onClick={() => {
                                  void requestModelRemoval(model);
                                }}
                              >
                                {copy.delete}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
      {confirmDialog}
    </div>
  );
}

export function ProviderSettingsPanel({
  settings,
  loading = false,
  errorMessage,
  resetDialogsToken = 0,
  openAddModelDialogToken = 0,
  openAddModelDialogKind = null,
  onChange,
}: ProviderSettingsPanelProps) {
  const messages = useMessages() as AppMessages;
  const copy = getProviderSettingsCopy(messages);
  const { addToast } = useToast();
  const lastOpenAddModelDialogTokenRef = useRef(openAddModelDialogToken);
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    mode: "add" | "edit";
    providerId: ProviderId;
    platformId: string | null;
    preferredKind: ProviderModelKind | null;
  }>({
    open: false,
    mode: "add",
    providerId: "google",
    platformId: null,
    preferredKind: null,
  });
  const [quickAddState, setQuickAddState] = useState<{
    open: boolean;
    platformId: string | null;
  }>({
    open: false,
    platformId: null,
  });
  const [testingModelValue, setTestingModelValue] = useState<string | null>(null);
  const commitSettings = (nextSettings: ProviderSettings) => {
    onChange(normalizeEditableProviderSettings(nextSettings));
  };

  useEffect(() => {
    setDialogState((current) =>
      current.open ? { ...current, open: false } : current,
    );
    setQuickAddState((current) =>
      current.open ? { ...current, open: false } : current,
    );
  }, [resetDialogsToken]);

  useEffect(() => {
    if (openAddModelDialogToken === lastOpenAddModelDialogTokenRef.current) {
      return;
    }

    lastOpenAddModelDialogTokenRef.current = openAddModelDialogToken;
    setQuickAddState((current) =>
      current.open ? { ...current, open: false } : current,
    );
    setDialogState({
      open: true,
      mode: "add",
      providerId: getPreferredAddProviderId(settings),
      platformId: null,
      preferredKind: openAddModelDialogKind,
    });
  }, [openAddModelDialogKind, openAddModelDialogToken, settings]);

  const removeModel = (target: ProviderModelOption) => {
    const defaultField = DEFAULT_MODEL_FIELDS[target.kind];
    const nextDefaults = { ...settings.defaults };
    const remainingModels = getProviderModelOptions(target.kind, settings, {
      includeDisabled: true,
    }).filter((model) => model.value !== target.value);

    if (remainingModels.length === 0) {
      window.alert(
        formatProviderCopy(copy.keepAtLeastOneModel, {
          kind: getProviderKindLabel(target.kind, copy),
        }),
      );
      return;
    }

    if (settings.defaults[defaultField] === target.value) {
      const fallback = getFallbackModelValue(
        target.platformId,
        target.kind,
        settings,
        target.value,
      );

      if (!fallback) {
        window.alert(
          formatProviderCopy(copy.keepAtLeastOneModel, {
            kind: getProviderKindLabel(target.kind, copy),
          }),
        );
        return;
      }

      nextDefaults[defaultField] = fallback;
    }

    commitSettings({
      ...settings,
      defaults: nextDefaults,
      customModels: target.preset
        ? settings.customModels
        : settings.customModels.filter(
            (model) =>
              !(
                model.platformId === target.platformId &&
                model.kind === target.kind &&
                model.modelId === target.modelId &&
                model.label === target.label
              ),
          ),
      hiddenPresetModels: target.preset
        ? [
            ...settings.hiddenPresetModels.filter((value) => value !== target.value),
            target.value,
          ]
        : settings.hiddenPresetModels,
      disabledModelValues: settings.disabledModelValues.filter(
        (value) => value !== target.value,
      ),
    });
  };

  const toggleModel = (target: ProviderModelOption) => {
    const nextDisabledModelValues = new Set(settings.disabledModelValues);

    if (nextDisabledModelValues.has(target.value)) {
      nextDisabledModelValues.delete(target.value);
    } else {
      nextDisabledModelValues.add(target.value);
    }

    commitSettings({
      ...settings,
      disabledModelValues: [...nextDisabledModelValues],
    });
  };

  const togglePlatform = (platformId: string) => {
    const platformModels = (["text", "image", "video"] as const).flatMap((kind) =>
      getProviderModelOptions(kind, settings, {
        includeDisabled: true,
      }).filter((model) => model.platformId === platformId),
    );

    if (platformModels.length === 0) {
      return;
    }

    const nextDisabledModelValues = new Set(settings.disabledModelValues);
    const allEnabled = platformModels.every((model) =>
      isProviderModelEnabled(settings, model.value),
    );

    for (const model of platformModels) {
      if (allEnabled) {
        nextDisabledModelValues.add(model.value);
      } else {
        nextDisabledModelValues.delete(model.value);
      }
    }

    commitSettings({
      ...settings,
      disabledModelValues: [...nextDisabledModelValues],
    });
  };

  const removePlatform = (platformId: string) => {
    const platform = getProviderPlatform(settings, platformId);
    if (!platform) {
      return;
    }

    const nextDefaults = { ...settings.defaults };
    for (const kind of ["text", "image", "video"] as const) {
      const field = DEFAULT_MODEL_FIELDS[kind];
      if (settings.defaults[field].startsWith(`${platformId}::`)) {
        const fallback = getFallbackModelValue(platformId, kind, settings);
        if (fallback) {
          nextDefaults[field] = fallback;
        }
      }
    }

    commitSettings({
      ...settings,
      platforms: settings.platforms.filter((item) => item.id !== platform.id),
      defaults: nextDefaults,
      customModels: settings.customModels.filter(
        (model) => model.platformId !== platform.id,
      ),
      hiddenPresetModels: settings.hiddenPresetModels.filter(
        (value) => !value.startsWith(`${platform.id}::`),
      ),
      disabledModelValues: settings.disabledModelValues.filter(
        (value) => !value.startsWith(`${platform.id}::`),
      ),
    });
  };

  const applyProviderDialog = (payload: {
    platformId?: string | null;
    providerId: ProviderId;
    displayName: string;
    apiKey: string;
    baseUrl: string;
    modelId: string;
    kind: ProviderModelKind;
  }) => {
    const existingPlatform =
      payload.platformId ? getProviderPlatform(settings, payload.platformId) : null;
    const nextPlatformId = existingPlatform?.id ?? getNextPlatformId(settings, payload.providerId);
    const nextPlatforms = existingPlatform
      ? settings.platforms.map((platform) =>
          platform.id === existingPlatform.id
            ? {
                ...platform,
                providerId: payload.providerId,
                apiKey: payload.apiKey.trim(),
                baseUrl: payload.baseUrl.trim(),
                displayName: payload.displayName.trim(),
              }
            : platform,
        )
      : [
          ...settings.platforms,
          {
            id: nextPlatformId,
            providerId: payload.providerId,
            apiKey: payload.apiKey.trim(),
            baseUrl: payload.baseUrl.trim(),
            displayName: payload.displayName.trim(),
          } satisfies ProviderPlatform,
        ];
    const platformSettings = {
      ...settings,
      platforms: nextPlatforms,
    };

    const nextSelection = payload.modelId.trim()
      ? applyProviderModelSelection(
          platformSettings,
          nextPlatformId,
          payload.providerId,
          payload.modelId,
          payload.kind,
        )
      : {
          customModels: settings.customModels,
          hiddenPresetModels: settings.hiddenPresetModels,
        };

    commitSettings({
      ...platformSettings,
      customModels: nextSelection.customModels,
      hiddenPresetModels: nextSelection.hiddenPresetModels,
    });
  };

  const applyQuickAdd = (payload: {
    platformId: string;
    providerId: ProviderId;
    modelId: string;
    kind: ProviderModelKind;
  }) => {
    const trimmedModelId = payload.modelId.trim();
    if (!trimmedModelId) {
      return;
    }

    const { customModels, hiddenPresetModels } = applyProviderModelSelection(
      settings,
      payload.platformId,
      payload.providerId,
      trimmedModelId,
      payload.kind,
    );

    commitSettings({
      ...settings,
      hiddenPresetModels,
      customModels,
    });
  };

  const testModel = async (model: ProviderModelOption) => {
    if (testingModelValue) {
      return;
    }

    const requestPayload = buildProviderModelTestPayload(settings, model);
    if (!requestPayload) {
      addToast(copy.missingPlatformConfigForTest, "error", 2600);
      return;
    }

    setTestingModelValue(model.value);

    try {
      await testProviderModelWithApi(requestPayload, {
        failedMessage: copy.modelTestFailed,
        successMessage: formatProviderCopy(copy.modelTestPassed, {
          model: model.modelId,
        }),
      });

      addToast(
        formatProviderCopy(copy.modelTestPassed, {
          model: model.modelId,
        }),
        "success",
        2200,
      );
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : copy.modelTestFailed,
        "error",
        2600,
      );
    } finally {
      setTestingModelValue(null);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <ProviderModelDialog
        key={`${dialogState.mode}:${dialogState.platformId ?? dialogState.providerId}:${dialogState.preferredKind ?? "none"}:${dialogState.open ? "open" : "closed"}`}
        open={dialogState.open}
        mode={dialogState.mode}
        initialProviderId={dialogState.providerId}
        initialPlatformId={dialogState.platformId}
        initialModelKind={dialogState.preferredKind}
        settings={settings}
        onOpenChange={(open) =>
          setDialogState((current) => ({ ...current, open }))
        }
        onConfirm={applyProviderDialog}
      />

      <QuickAddModelDialog
        key={`${quickAddState.platformId ?? "none"}:${quickAddState.open ? "open" : "closed"}`}
        open={quickAddState.open}
        platformId={quickAddState.platformId ?? "custom"}
        settings={settings}
        onOpenChange={(open) =>
          setQuickAddState((current) => ({ ...current, open }))
        }
        onConfirm={applyQuickAdd}
      />

      {loading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-none px-3.5 pb-3.5 pt-0">
          <ModelsLibraryPage
            settings={settings}
            onOpenAddDialog={(providerId) =>
              setDialogState({
                open: true,
                mode: "add",
                providerId,
                platformId: null,
                preferredKind: null,
              })
            }
            onOpenEditDialog={(platformId) => {
              const platform = getProviderPlatform(settings, platformId);
              if (!platform) {
                return;
              }

              setDialogState({
                open: true,
                mode: "edit",
                providerId: platform.providerId,
                platformId,
                preferredKind: null,
              });
            }}
            onOpenQuickAdd={(platformId) =>
              setQuickAddState({
                open: true,
                platformId,
              })
            }
            onTogglePlatform={togglePlatform}
            onToggleModel={toggleModel}
            onTestModel={testModel}
            testingModelValue={testingModelValue}
            onRemovePlatform={removePlatform}
            onRemoveModel={removeModel}
          />

          {errorMessage ? (
            <p className="mt-4 text-sm text-[#d45a51]">{errorMessage}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
