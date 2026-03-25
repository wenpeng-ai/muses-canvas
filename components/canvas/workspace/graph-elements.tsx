"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  NodeResizer,
  Position,
  getBezierPath,
  useReactFlow,
  useViewport,
  type EdgeProps,
  type NodeProps,
} from "@xyflow/react";
import { useMessages } from "next-intl";
import { useTheme } from "next-themes";
import {
  type ChangeEvent,
  type ButtonHTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  Copy,
  Crop,
  Download,
  Eraser,
  Expand,
  Focus,
  GitBranchPlus,
  ImageIcon,
  Italic,
  Maximize2,
  Pause,
  Paintbrush,
  Play,
  PlayCircle,
  Pilcrow,
  Plus,
  ScanSearch,
  Scissors,
  SunMedium,
  Trash2,
  Type,
  Upload,
  Video,
  Volume2,
  VolumeX,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SessionImage } from "@/components/ui/session-image";
import { useToast } from "@/components/ui/toast";
import { createCroppedImageFile } from "@/lib/canvas/client-image-transform";
import { getCanvasPageCopy } from "@/lib/canvas/copy";
import type { AppMessages } from "@/i18n/messages";
import { cn } from "@/lib/utils";
import type { CanvasNodeKind } from "@/lib/supabase/types";
import { useCanvasStore } from "@/store/canvas-store";
import {
  CANVAS_SOURCE_HANDLE_ID,
  CANVAS_TARGET_HANDLE_ID,
  CANVAS_EDGE_COLORS,
  DEFAULT_DRAW_COLOR,
  MAX_CANVAS_ZOOM,
  applyCropAspect,
  buildShapePoints,
  buildStrokePath,
  clamp,
  createDefaultImagePresentation,
  downloadImage,
  getConnectionTargetHighlightClassName,
  getConnectionTargetHighlightShellClassName,
  parseAspectRatioValue,
  updateCropFromPointer,
  type CanvasConnectionTargetSide,
  type CanvasFlowEdge,
  type CanvasFlowNode,
  type CanvasImagePresentation,
  type CanvasImageNodeData,
  type CanvasPoint,
  type CanvasShapeNodeData,
  type CanvasStrokeNodeData,
  type CanvasTextNodeData,
  type CanvasVideoNodeData,
} from "@/components/canvas/workspace/shared";

function resolveCanvasForegroundColor(color: string, isDark: boolean) {
  return isDark && color.toLowerCase() === DEFAULT_DRAW_COLOR
    ? "#edf3ff"
    : color;
}

function getFloatingOverlayScale(zoom: number) {
  return 1 / Math.max(zoom, 0.25);
}

function getTypeLabelOverlayScale(zoom: number) {
  return zoom > 1 ? 1 : 1 / Math.max(zoom, 0.25);
}

const DEFAULT_IMAGE_NODE_WIDTH = 200;
const DEFAULT_IMAGE_NODE_HEIGHT = Math.round((DEFAULT_IMAGE_NODE_WIDTH * 16) / 9);
const LEGACY_COMPACT_IMAGE_NODE_HEIGHT = 100;
const LEGACY_COMPACT_IMAGE_NODE_MAX_WIDTH = 180;

function getDefaultDisplayImageDimensions(width: number, height: number) {
  const safeWidth =
    Number.isFinite(width) && width > 0 ? width : DEFAULT_IMAGE_NODE_WIDTH;
  const safeHeight =
    Number.isFinite(height) && height > 0 ? height : DEFAULT_IMAGE_NODE_HEIGHT;
  const scale = Math.min(
    DEFAULT_IMAGE_NODE_WIDTH / safeWidth,
    DEFAULT_IMAGE_NODE_HEIGHT / safeHeight,
  );

  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

function shouldAutoCorrectImageNodeSize(params: {
  nodeWidth: number;
  nodeHeight: number;
  naturalWidth: number;
  naturalHeight: number;
  targetWidth: number;
  targetHeight: number;
}) {
  if (
    params.nodeWidth === params.targetWidth &&
    params.nodeHeight === params.targetHeight
  ) {
    return false;
  }

  const isLegacyDefaultSize =
    params.nodeWidth === DEFAULT_IMAGE_NODE_WIDTH &&
    params.nodeHeight === DEFAULT_IMAGE_NODE_HEIGHT;
  const isLegacyCompactSize =
    params.nodeHeight === LEGACY_COMPACT_IMAGE_NODE_HEIGHT &&
    params.nodeWidth > 0 &&
    params.nodeWidth <= LEGACY_COMPACT_IMAGE_NODE_MAX_WIDTH;
  const isInterimOriginalSize =
    params.nodeWidth === params.naturalWidth &&
    params.nodeHeight === params.naturalHeight;

  return isLegacyDefaultSize || isLegacyCompactSize || isInterimOriginalSize;
}

const TEXT_PRESET_PATCHES = {
  h1: { fontSize: 28, fontWeight: 700 },
  h2: { fontSize: 24, fontWeight: 600 },
  h3: { fontSize: 18, fontWeight: 600 },
  body: { fontSize: 14, fontWeight: 500 },
} as const;

const TEXT_PRESET_BUTTONS: Array<{
  key: keyof typeof TEXT_PRESET_PATCHES;
  label?: string;
  icon?: LucideIcon;
}> = [
  { key: "h1", label: "H1" },
  { key: "h2", label: "H2" },
  { key: "h3", label: "H3" },
  { key: "body", icon: Pilcrow },
];

function useCanvasCopy() {
  const messages = useMessages() as AppMessages;
  return getCanvasPageCopy(messages);
}

function getVisibleImageToolbarActions(copy: ReturnType<typeof getCanvasPageCopy>) {
  return [
    { icon: WandSparkles, label: copy.imageActionRedraw },
  ] as const satisfies Array<{
    icon: LucideIcon;
    label: string;
  }>;
}

function getImageToolbarUtilities(copy: ReturnType<typeof getCanvasPageCopy>) {
  return [
    { key: "crop" as const, icon: Crop, tooltip: copy.crop },
    { key: "fullscreen" as const, icon: Expand, tooltip: copy.fullscreen },
    { key: "download" as const, icon: Download, tooltip: copy.download },
  ];
}

function getImageCropAspectOptions(copy: ReturnType<typeof getCanvasPageCopy>) {
  return [
    { label: copy.freeAspect, ratio: null },
    { label: "1:1", ratio: parseAspectRatioValue("1:1") },
    { label: "4:3", ratio: parseAspectRatioValue("4:3") },
    { label: "16:9", ratio: parseAspectRatioValue("16:9") },
    { label: "9:16", ratio: parseAspectRatioValue("9:16") },
  ] as const;
}

const IMAGE_CROP_ASPECT_OPTIONS_FALLBACK = [
  { label: "Free", ratio: null },
  { label: "1:1", ratio: parseAspectRatioValue("1:1") },
  { label: "4:3", ratio: parseAspectRatioValue("4:3") },
  { label: "16:9", ratio: parseAspectRatioValue("16:9") },
  { label: "9:16", ratio: parseAspectRatioValue("9:16") },
] as const;
type ImageCropHandleMode =
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "nw";
const IMAGE_CROP_BORDER_WIDTH_PX = 1.5;
const IMAGE_CROP_HANDLE_EDGE_OFFSET_PX = -(IMAGE_CROP_BORDER_WIDTH_PX / 2);

const IMAGE_CROP_HANDLES: ReadonlyArray<{
  mode: ImageCropHandleMode;
  shape: "corner" | "horizontal" | "vertical";
  className: string;
  anchorStyle: CSSProperties;
  cursor: CSSProperties["cursor"];
}> = [
  {
    mode: "nw",
    shape: "corner",
    className: "-translate-x-1/2 -translate-y-1/2",
    anchorStyle: {
      left: IMAGE_CROP_HANDLE_EDGE_OFFSET_PX,
      top: IMAGE_CROP_HANDLE_EDGE_OFFSET_PX,
    },
    cursor: "nwse-resize",
  },
  {
    mode: "n",
    shape: "horizontal",
    className: "-translate-x-1/2 -translate-y-1/2",
    anchorStyle: {
      left: "50%",
      top: IMAGE_CROP_HANDLE_EDGE_OFFSET_PX,
    },
    cursor: "ns-resize",
  },
  {
    mode: "ne",
    shape: "corner",
    className: "translate-x-1/2 -translate-y-1/2",
    anchorStyle: {
      right: IMAGE_CROP_HANDLE_EDGE_OFFSET_PX,
      top: IMAGE_CROP_HANDLE_EDGE_OFFSET_PX,
    },
    cursor: "nesw-resize",
  },
  {
    mode: "e",
    shape: "vertical",
    className: "translate-x-1/2 -translate-y-1/2",
    anchorStyle: {
      right: IMAGE_CROP_HANDLE_EDGE_OFFSET_PX,
      top: "50%",
    },
    cursor: "ew-resize",
  },
  {
    mode: "se",
    shape: "corner",
    className: "translate-x-1/2 translate-y-1/2",
    anchorStyle: {
      bottom: IMAGE_CROP_HANDLE_EDGE_OFFSET_PX,
      right: IMAGE_CROP_HANDLE_EDGE_OFFSET_PX,
    },
    cursor: "nwse-resize",
  },
  {
    mode: "s",
    shape: "horizontal",
    className: "-translate-x-1/2 translate-y-1/2",
    anchorStyle: {
      bottom: IMAGE_CROP_HANDLE_EDGE_OFFSET_PX,
      left: "50%",
    },
    cursor: "ns-resize",
  },
  {
    mode: "sw",
    shape: "corner",
    className: "-translate-x-1/2 translate-y-1/2",
    anchorStyle: {
      bottom: IMAGE_CROP_HANDLE_EDGE_OFFSET_PX,
      left: IMAGE_CROP_HANDLE_EDGE_OFFSET_PX,
    },
    cursor: "nesw-resize",
  },
  {
    mode: "w",
    shape: "vertical",
    className: "-translate-x-1/2 -translate-y-1/2",
    anchorStyle: {
      left: IMAGE_CROP_HANDLE_EDGE_OFFSET_PX,
      top: "50%",
    },
    cursor: "ew-resize",
  },
];
function getVideoToolbarActions(copy: ReturnType<typeof getCanvasPageCopy>) {
  return [
    { key: "regenerate" as const, icon: WandSparkles, label: copy.videoActionRegenerate },
    { key: "remove" as const, icon: Trash2, label: copy.videoActionRemove },
  ];
}

function getVideoToolbarUtilities(copy: ReturnType<typeof getCanvasPageCopy>) {
  return [
    { key: "fullscreen" as const, icon: Expand, tooltip: copy.fullscreen },
    { key: "download" as const, icon: Download, tooltip: copy.download },
  ];
}
const CANVAS_CONNECTION_HANDLE_OUTSET_PX = 14;

function getEdgeInsertNodeOptions(copy: ReturnType<typeof getCanvasPageCopy>) {
  return [
    { kind: "text" as const, label: copy.textType, icon: Type },
    { kind: "image" as const, label: copy.imageType, icon: ImageIcon },
    { kind: "video" as const, label: copy.videoType, icon: Video },
  ];
}

function buildImageAssetFileName(label: string) {
  const sanitized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${sanitized || "canvas-image"}-${Date.now().toString(36)}.png`;
}

function createDefaultCropPresentation() {
  const presentation = createDefaultImagePresentation();

  return {
    ...presentation,
    crop: {
      ...presentation.crop,
      x: 0.04,
      y: 0.04,
      width: 0.92,
      height: 0.92,
      aspectLabel: IMAGE_CROP_ASPECT_OPTIONS_FALLBACK[0].label,
    },
  };
}

function CanvasToolbarTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="group/tooltip relative flex items-center justify-center">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-[90] mb-2 -translate-x-1/2 -translate-y-1 whitespace-nowrap rounded-[10px] bg-[#161616] px-2.5 py-1 text-[11px] font-medium text-white opacity-0 shadow-[0_14px_32px_-20px_rgba(15,23,42,0.48)] transition-all duration-150 group-hover/tooltip:translate-y-0 group-hover/tooltip:opacity-100 dark:bg-white dark:text-[#111827]">
        {label}
      </div>
    </div>
  );
}

function CanvasToolbarIconButton({
  tooltip,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tooltip: string;
  children: ReactNode;
}) {
  return (
    <CanvasToolbarTooltip label={tooltip}>
      <button
        type="button"
        aria-label={tooltip}
        className={className}
        {...props}
      >
        {children}
      </button>
    </CanvasToolbarTooltip>
  );
}

function CanvasTextFormattingGroup({
  textNode,
  onUpdate,
  compact,
  showColorControl = false,
  showTooltips = true,
}: {
  textNode: CanvasTextNodeData["textNode"];
  onUpdate: CanvasTextNodeData["onUpdate"];
  compact: boolean;
  showColorControl?: boolean;
  showTooltips?: boolean;
}) {
  const copy = useCanvasCopy();
  const segmentButtonClass = compact
    ? "flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[11px] font-semibold transition-colors"
    : "flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-[14px] font-semibold transition-colors";
  const iconSizeClass = compact ? "h-3.5 w-3.5" : "h-4 w-4";
  const dividerClass = compact ? "h-6 w-px" : "h-8 w-px";
  const iconButtonClass = (active: boolean) =>
    cn(
      segmentButtonClass,
      active
        ? "bg-[#111827] text-white dark:bg-white dark:text-[#111827]"
        : "text-[#5f6774] hover:bg-[#f3f4f6] dark:text-slate-300 dark:hover:bg-white/6",
    );

  return (
    <>
      {showColorControl ? (
        <>
          <CanvasToolbarTooltip label={copy.textColor}>
            <label
              className={cn(
                "relative flex cursor-pointer items-center justify-center rounded-full bg-[#f4f5f7] dark:bg-[#202734]",
                compact ? "h-7 w-7" : "h-10 w-10",
              )}
            >
              <input
                type="color"
                value={textNode.color}
                className="sr-only"
                onChange={(event) =>
                  onUpdate(textNode.id, {
                    color: event.target.value,
                  })
                }
              />
              <span
                className={cn(
                  "rounded-full border border-black/10",
                  compact ? "h-5 w-5" : "h-7 w-7",
                )}
                style={{ backgroundColor: textNode.color }}
              />
            </label>
          </CanvasToolbarTooltip>
          <div className={cn(dividerClass, "bg-black/8 dark:bg-white/10")} />
        </>
      ) : null}

      {TEXT_PRESET_BUTTONS.map((preset) => {
        const activePatch = TEXT_PRESET_PATCHES[preset.key];
        const isActive =
          textNode.fontSize === activePatch.fontSize &&
          textNode.fontWeight === activePatch.fontWeight;
        const Icon = preset.icon;
        const tooltipLabel =
          preset.key === "h1"
            ? copy.heading1
            : preset.key === "h2"
              ? copy.heading2
              : preset.key === "h3"
                ? copy.heading3
                : copy.bodyPreset;
        const button = (
          <button
            key={preset.key}
            type="button"
            aria-label={tooltipLabel}
            className={cn(
              segmentButtonClass,
              isActive
                ? "bg-[#111827] text-white dark:bg-white dark:text-[#111827]"
                : "text-[#5f6774] hover:bg-[#f3f4f6] dark:text-slate-300 dark:hover:bg-white/6",
            )}
            onClick={() => onUpdate(textNode.id, activePatch)}
          >
            {Icon ? <Icon className={iconSizeClass} /> : preset.label}
          </button>
        );

        if (!showTooltips) {
          return button;
        }

        return (
          <CanvasToolbarTooltip key={preset.key} label={tooltipLabel}>
            {button}
          </CanvasToolbarTooltip>
        );
      })}

      <div className={cn(dividerClass, "bg-black/8 dark:bg-white/10")} />

      {showTooltips ? (
        <CanvasToolbarIconButton
          tooltip={copy.bold}
          className={iconButtonClass(textNode.fontWeight >= 600)}
          onClick={() =>
            onUpdate(textNode.id, {
              fontWeight: textNode.fontWeight >= 600 ? 500 : 700,
            })
          }
        >
          <Bold className={iconSizeClass} />
        </CanvasToolbarIconButton>
      ) : (
        <button
          type="button"
          aria-label={copy.bold}
          className={iconButtonClass(textNode.fontWeight >= 600)}
          onClick={() =>
            onUpdate(textNode.id, {
              fontWeight: textNode.fontWeight >= 600 ? 500 : 700,
            })
          }
        >
          <Bold className={iconSizeClass} />
        </button>
      )}

      {showTooltips ? (
        <CanvasToolbarIconButton
          tooltip={copy.italic}
          className={iconButtonClass(textNode.fontFamily === "Georgia")}
          onClick={() =>
            onUpdate(textNode.id, {
              fontFamily: textNode.fontFamily === "Georgia" ? "Inter" : "Georgia",
            })
          }
        >
          <Italic className={iconSizeClass} />
        </CanvasToolbarIconButton>
      ) : (
        <button
          type="button"
          aria-label={copy.italic}
          className={iconButtonClass(textNode.fontFamily === "Georgia")}
          onClick={() =>
            onUpdate(textNode.id, {
              fontFamily: textNode.fontFamily === "Georgia" ? "Inter" : "Georgia",
            })
          }
        >
          <Italic className={iconSizeClass} />
        </button>
      )}

      <div className={cn(dividerClass, "bg-black/8 dark:bg-white/10")} />

      {[
        { align: "left" as const, icon: AlignLeft, tooltip: copy.alignLeft },
        { align: "center" as const, icon: AlignCenter, tooltip: copy.alignCenter },
        { align: "right" as const, icon: AlignRight, tooltip: copy.alignRight },
      ].map(({ align, icon: Icon, tooltip }) =>
        showTooltips ? (
          <CanvasToolbarIconButton
            key={align}
            tooltip={tooltip}
            className={iconButtonClass(textNode.align === align)}
            onClick={() =>
              onUpdate(textNode.id, {
                align,
              })
            }
          >
            <Icon className={iconSizeClass} />
          </CanvasToolbarIconButton>
        ) : (
          <button
            key={align}
            type="button"
            aria-label={tooltip}
            className={iconButtonClass(textNode.align === align)}
            onClick={() =>
              onUpdate(textNode.id, {
                align,
              })
            }
          >
            <Icon className={iconSizeClass} />
          </button>
        ),
      )}
    </>
  );
}

function getTextHandleBaseTransform(side: "left" | "right") {
  return side === "left" ? "translate(-100%, -50%)" : "translate(100%, -50%)";
}

function getTextConnectorHiddenTransform(side: "left" | "right") {
  return side === "left" ? "translate(45%, -50%)" : "translate(-45%, -50%)";
}

function getTextConnectorVisibleTransform(side: "left" | "right") {
  return getTextHandleBaseTransform(side);
}

function setTextConnectorTransform(
  element: HTMLDivElement | null,
  offsetX = 0,
  offsetY = 0,
) {
  if (!element) {
    return;
  }

  element.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
}

function updateTextConnectorTransform(
  container: HTMLDivElement | null,
  element: HTMLDivElement | null,
  zoom: number,
  clientX: number,
  clientY: number,
) {
  if (!container || !element) {
    return;
  }

  const safeZoom = Math.max(zoom, 0.001);
  const rect = container.getBoundingClientRect();
  const maxOffsetX = Math.max(0, rect.width / 2 / safeZoom);
  const maxOffsetY = Math.max(0, rect.height / 2 / safeZoom);
  const offsetX = (clientX - (rect.left + rect.width / 2)) / safeZoom;
  const offsetY = (clientY - (rect.top + rect.height / 2)) / safeZoom;

  setTextConnectorTransform(
    element,
    Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX)),
    Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY)),
  );
}

function CanvasConnectionControl({
  side,
  selected,
  nodeHovered = false,
  toneClassName,
  clipSlideFromNode = false,
}: {
  side: "left" | "right";
  selected: boolean;
  nodeHovered?: boolean;
  toneClassName: string;
  clipSlideFromNode?: boolean;
}) {
  const { zoom } = useViewport();
  const hitAreaRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const [isHandleHovered, setIsHandleHovered] = useState(false);
  const [showPlus, setShowPlus] = useState(false);
  const connectorVisible = selected || nodeHovered || isHandleHovered;
  const wrapperTransform = clipSlideFromNode
    ? getTextConnectorVisibleTransform(side)
    : connectorVisible
      ? getTextConnectorVisibleTransform(side)
      : getTextConnectorHiddenTransform(side);
  const shellTransform = clipSlideFromNode
    ? connectorVisible
      ? "translateX(0px)"
      : side === "left"
        ? "translateX(8px)"
        : "translateX(-8px)"
    : "translateX(0px)";

  return (
    <>
      <Handle
        id={side === "left" ? CANVAS_TARGET_HANDLE_ID : CANVAS_SOURCE_HANDLE_ID}
        type={side === "left" ? "target" : "source"}
        position={side === "left" ? Position.Left : Position.Right}
        className={cn(
          "nodrag nopan !h-7 !w-7 !rounded-full !border-0 !bg-transparent transition-opacity",
          connectorVisible ? "!opacity-100" : "!opacity-0",
        )}
        style={{ transform: getTextHandleBaseTransform(side) }}
        onPointerEnter={(event) => {
          setIsHandleHovered(true);
          setShowPlus(true);
          updateTextConnectorTransform(
            hitAreaRef.current,
            orbRef.current,
            zoom,
            event.clientX,
            event.clientY,
          );
        }}
        onPointerMove={(event) => {
          setIsHandleHovered(true);
          setShowPlus(true);
          updateTextConnectorTransform(
            hitAreaRef.current,
            orbRef.current,
            zoom,
            event.clientX,
            event.clientY,
          );
        }}
        onPointerLeave={() => {
          setIsHandleHovered(false);
          setShowPlus(false);
          setTextConnectorTransform(orbRef.current);
        }}
      />
      <div
        ref={hitAreaRef}
        className={cn(
          "pointer-events-none absolute top-1/2 z-30 flex h-7 w-7 items-center justify-center",
          toneClassName,
          side === "left" ? "left-0" : "right-0",
        )}
        style={{
          opacity: clipSlideFromNode ? 1 : connectorVisible ? 1 : 0,
          transform: wrapperTransform,
          transitionDuration: "140ms",
          transitionProperty: "opacity, transform",
          transitionTimingFunction: "ease-out",
        }}
      >
        <div
          className="flex h-full w-full items-center justify-center will-change-[opacity,transform]"
          style={{
            opacity: connectorVisible ? 1 : 0,
            transform: shellTransform,
            transitionDuration: "140ms",
            transitionProperty: "opacity, transform",
            transitionTimingFunction: "ease-out",
          }}
        >
          <div
            ref={orbRef}
            className="flex h-3 w-3 items-center justify-center rounded-full border-[1.5px] border-current bg-white/95 will-change-transform dark:bg-[#11161d]/95"
          >
            {showPlus ? (
              <Plus className="h-[7px] w-[7px] stroke-[2.25]" />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function CanvasNodeTypeLabel({
  icon: Icon,
  label,
  overlayScale,
}: {
  icon: LucideIcon;
  label: string;
  overlayScale: number;
}) {
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-20 -translate-y-[calc(100%+4px)]">
      <div
        className="flex items-center gap-1 text-[8px] font-medium tracking-[0.02em] text-[#9ea5b0] dark:text-white/34"
        style={{
          transform: `scale(${overlayScale})`,
          transformOrigin: "left bottom",
        }}
      >
        <Icon className="h-2.5 w-2.5 shrink-0" />
        <span className="whitespace-nowrap">{label}</span>
      </div>
    </div>
  );
}

function formatClipSeconds(value: number) {
  const safeValue = Math.max(0, value);
  const minutes = Math.floor(safeValue / 60);
  const seconds = Math.floor(safeValue % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

function resolveVideoClipBounds(params: {
  totalDuration: number;
  trimStartSeconds: number;
  durationSeconds: number;
}) {
  const safeDurationSeconds = Math.max(0.5, params.durationSeconds || 0.5);
  const derivedTotalDuration = Math.max(
    safeDurationSeconds,
    params.trimStartSeconds + safeDurationSeconds,
    0.5,
  );
  const safeTotalDuration =
    Number.isFinite(params.totalDuration) && params.totalDuration > 0
      ? Math.max(params.totalDuration, safeDurationSeconds)
      : derivedTotalDuration;
  const start = clamp(
    Number.isFinite(params.trimStartSeconds) ? params.trimStartSeconds : 0,
    0,
    Math.max(safeTotalDuration - 0.5, 0),
  );
  const end = Math.min(
    safeTotalDuration,
    Math.max(start + 0.5, start + safeDurationSeconds),
  );

  return {
    totalDuration: safeTotalDuration,
    start,
    end,
  };
}

function CanvasTextLoadingSkeleton({
  lineHeight,
  className,
}: {
  lineHeight: number;
  className?: string;
}) {
  const safeLineHeight = Math.max(8, Math.round(lineHeight));

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 flex flex-col gap-2.5",
        className,
      )}
    >
      {["96%", "74%", "32%"].map((width, index) => (
        <div
          key={width}
          className="animate-pulse rounded-full bg-[#d1d6de] dark:bg-white/10"
          style={{
            height: safeLineHeight,
            width,
            animationDelay: `${index * 120}ms`,
          }}
        />
      ))}
    </div>
  );
}

function CanvasImageGenerationProgress({
  imageUrl,
  label,
  progress,
}: {
  imageUrl: string | null | undefined;
  label: string;
  progress: number | null;
}) {
  const hasImage = !!imageUrl;
  const safeProgress = Math.max(0, Math.min(100, progress ?? 0));

  return (
    <div className="absolute inset-0 overflow-hidden rounded-[10px]">
      {hasImage ? (
        <SessionImage
          src={imageUrl}
          alt={label}
          wrapperClassName="absolute inset-0 h-full w-full"
          className="pointer-events-none h-full w-full scale-[1.08] select-none object-cover blur-2xl saturate-[0.86] brightness-[1.03]"
          disableReveal
          draggable={false}
        />
      ) : (
        <div className="absolute inset-[-8%] scale-[1.06] bg-[radial-gradient(circle_at_50%_66%,rgba(227,126,98,0.54),transparent_18%),radial-gradient(circle_at_51%_38%,rgba(120,170,221,0.28),transparent_20%),linear-gradient(90deg,rgba(91,145,226,0.64)_0%,rgba(233,238,244,0.92)_44%,rgba(69,137,222,0.66)_100%)] blur-2xl dark:bg-[radial-gradient(circle_at_50%_66%,rgba(226,124,97,0.48),transparent_18%),radial-gradient(circle_at_51%_38%,rgba(99,157,219,0.24),transparent_20%),linear-gradient(90deg,rgba(58,109,183,0.68)_0%,rgba(156,164,175,0.72)_46%,rgba(45,110,191,0.72)_100%)]" />
      )}
      <div className="canvas-image-progress-shell absolute inset-0 bg-[linear-gradient(180deg,rgba(224,231,239,0.38)_0%,rgba(210,219,229,0.3)_50%,rgba(202,212,223,0.34)_100%)] backdrop-blur-[12px] dark:bg-[linear-gradient(180deg,rgba(44,50,58,0.42)_0%,rgba(33,38,45,0.34)_50%,rgba(27,31,37,0.38)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_48%,rgba(255,255,255,0.16),transparent_30%),linear-gradient(90deg,rgba(82,103,133,0.12)_0%,rgba(255,255,255,0.03)_42%,rgba(69,88,116,0.08)_100%)] dark:bg-[radial-gradient(circle_at_16%_48%,rgba(255,255,255,0.06),transparent_30%),linear-gradient(90deg,rgba(146,166,192,0.08)_0%,rgba(255,255,255,0.01)_42%,rgba(107,126,151,0.05)_100%)]" />
      <div
        className="canvas-image-progress-fill absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${safeProgress}%` }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(246,249,252,0.7)_52%,rgba(238,243,248,0.76)_100%)] backdrop-blur-[14px] dark:bg-[linear-gradient(180deg,rgba(97,109,124,0.42)_0%,rgba(74,86,99,0.46)_52%,rgba(60,70,82,0.5)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(128,149,179,0.16)_0%,rgba(255,255,255,0.08)_34%,rgba(110,131,161,0.09)_100%)] dark:bg-[linear-gradient(90deg,rgba(198,212,231,0.08)_0%,rgba(255,255,255,0.02)_34%,rgba(154,171,193,0.05)_100%)]" />
        <div className="absolute inset-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" />
        <div className="canvas-image-progress-sheen absolute inset-y-[-8%] left-[-34%] w-[34%] bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.12)_18%,rgba(255,255,255,0.62)_52%,rgba(255,255,255,0.18)_82%,rgba(255,255,255,0)_100%)] opacity-85 blur-md dark:bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(226,235,245,0.05)_18%,rgba(236,243,251,0.24)_52%,rgba(221,231,242,0.08)_82%,rgba(255,255,255,0)_100%)]" />
        <div className="absolute inset-y-0 right-0 w-px bg-white/70 dark:bg-[#dde6f2]/24" />
        <div className="absolute inset-y-[8%] right-[-1px] w-[3px] rounded-full bg-white/72 shadow-[0_0_16px_rgba(255,255,255,0.45)] dark:bg-[#eef4fb]/24 dark:shadow-[0_0_18px_rgba(214,226,241,0.16)]" />
      </div>
      <div className="absolute inset-0 rounded-[10px] ring-1 ring-inset ring-white/36 dark:ring-white/12" />
    </div>
  );
}

function CanvasTextGraphNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const copy = useCanvasCopy();
  const { resolvedTheme } = useTheme();
  const { addToast } = useToast();
  const { zoom } = useViewport();
  const isDark = resolvedTheme === "dark";
  const nodeData = data as CanvasTextNodeData;
  const [isNodeHovered, setIsNodeHovered] = useState(false);
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const isRunning = nodeData.isRunning;
  const overlayScale = useMemo(() => getFloatingOverlayScale(zoom), [zoom]);
  const typeLabelScale = useMemo(() => getTypeLabelOverlayScale(zoom), [zoom]);
  const editorFontSize = Math.max(
    13,
    Math.min(22, Math.round(nodeData.textNode.fontSize * 0.9)),
  );
  const editorLineHeight = Math.max(
    18,
    Math.round(editorFontSize * 1.42),
  );
  const expandedEditorFontSize = Math.max(
    18,
    Math.min(30, nodeData.textNode.fontSize),
  );
  const expandedEditorLineHeight = Math.max(
    30,
    Math.round(expandedEditorFontSize * 1.7),
  );
  const textNodeWidth = nodeData.textNode.width;
  const textNodeHeight = nodeData.textNode.height;
  const textNodeFontFamily = nodeData.textNode.fontFamily;
  const textNodeFontSize = nodeData.textNode.fontSize;
  const textNodeFontWeight = nodeData.textNode.fontWeight;
  const expandedEditorRef = useRef<HTMLTextAreaElement>(null);
  const inlineEditorRef = useRef<HTMLTextAreaElement>(null);
  const contentCommitTimeoutRef = useRef<number | null>(null);
  const draftContentRef = useRef(nodeData.textNode.content);
  const isItalic = nodeData.textNode.fontFamily === "Georgia";

  const handleCopyText = useCallback(async () => {
    const text = draftContentRef.current;

    if (text.trim().length === 0) {
      addToast(copy.noTextToCopy, "info");
      return;
    }

    if (!navigator.clipboard?.writeText) {
      addToast(copy.clipboardUnsupported, "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      addToast(copy.textCopied, "success");
    } catch {
      addToast(copy.copyFailed, "error");
    }
  }, [addToast, copy.clipboardUnsupported, copy.copyFailed, copy.noTextToCopy, copy.textCopied]);

  const syncInlineEditorHeight = useCallback(
    (editor: HTMLTextAreaElement | null) => {
      if (!editor) {
        return;
      }

      editor.style.height = "0px";
      const maxEditorHeight = editor.parentElement?.clientHeight ?? editor.scrollHeight;
      const nextEditorHeight = Math.min(
        maxEditorHeight,
        Math.max(editorLineHeight, editor.scrollHeight),
      );
      editor.style.height = `${nextEditorHeight}px`;
      editor.style.overflowY =
        editor.scrollHeight > maxEditorHeight ? "auto" : "hidden";
    },
    [editorLineHeight],
  );

  const syncMirroredEditors = useCallback(
    (source: HTMLTextAreaElement | null, nextContent: string) => {
      const inlineEditor = inlineEditorRef.current;
      const expandedEditor = expandedEditorRef.current;

      if (inlineEditor && inlineEditor !== source && inlineEditor.value !== nextContent) {
        inlineEditor.value = nextContent;
        syncInlineEditorHeight(inlineEditor);
      }

      if (
        expandedEditor &&
        expandedEditor !== source &&
        expandedEditor.value !== nextContent
      ) {
        expandedEditor.value = nextContent;
      }
    },
    [syncInlineEditorHeight],
  );

  const commitEditorContent = useCallback(
    (nextContent: string) => {
      if (nextContent === nodeData.textNode.content) {
        return;
      }

      nodeData.onContentChange(nodeData.textNode.id, nextContent);
    },
    [nodeData],
  );

  const flushPendingContentCommit = useCallback(
    (contentOverride?: string) => {
      if (contentCommitTimeoutRef.current !== null) {
        window.clearTimeout(contentCommitTimeoutRef.current);
        contentCommitTimeoutRef.current = null;
      }

      commitEditorContent(contentOverride ?? draftContentRef.current);
    },
    [commitEditorContent],
  );

  const schedulePendingContentCommit = useCallback(
    (nextContent: string) => {
      if (contentCommitTimeoutRef.current !== null) {
        window.clearTimeout(contentCommitTimeoutRef.current);
      }

      contentCommitTimeoutRef.current = window.setTimeout(() => {
        contentCommitTimeoutRef.current = null;
        commitEditorContent(nextContent);
      }, 480);
    },
    [commitEditorContent],
  );

  const handleEditorChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const nextContent = event.target.value;
      draftContentRef.current = nextContent;
      syncMirroredEditors(event.currentTarget, nextContent);

      if (event.currentTarget === inlineEditorRef.current) {
        syncInlineEditorHeight(event.currentTarget);
      }

      schedulePendingContentCommit(nextContent);
    },
    [schedulePendingContentCommit, syncInlineEditorHeight, syncMirroredEditors],
  );

  useEffect(() => {
    if (!textEditorOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const expandedEditor = expandedEditorRef.current;
      if (expandedEditor && expandedEditor.value !== draftContentRef.current) {
        expandedEditor.value = draftContentRef.current;
      }

      expandedEditor?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [textEditorOpen]);

  useEffect(() => {
    if (contentCommitTimeoutRef.current !== null) {
      return;
    }

    if (draftContentRef.current === nodeData.textNode.content) {
      return;
    }

    draftContentRef.current = nodeData.textNode.content;
    syncMirroredEditors(null, nodeData.textNode.content);
  }, [nodeData.textNode.content, syncMirroredEditors]);

  useEffect(() => {
    return () => {
      if (contentCommitTimeoutRef.current !== null) {
        window.clearTimeout(contentCommitTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isRunning) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      syncInlineEditorHeight(inlineEditorRef.current);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    isRunning,
    syncInlineEditorHeight,
    textNodeFontFamily,
    textNodeFontSize,
    textNodeFontWeight,
    textNodeHeight,
    textNodeWidth,
  ]);

  return (
    <div
      className={cn(
        "group/node relative h-full w-full overflow-visible",
        nodeData.connectionTargetHighlightSide &&
          "canvas-node-connection-target-shell",
        getConnectionTargetHighlightShellClassName(
          nodeData.connectionTargetHighlightSide,
        ),
      )}
      onPointerEnter={() => setIsNodeHovered(true)}
      onPointerLeave={() => setIsNodeHovered(false)}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={56}
        keepAspectRatio={false}
        autoScale
        color="#3b82f6"
        handleClassName="!h-2 !w-2 !rounded-[2px] !border-2 !border-[#3b82f6] !bg-white dark:!bg-[#11161d]"
        lineClassName="!border-[#3b82f6]/70"
        onResizeEnd={(_, params) =>
          nodeData.onResizeEnd(
            nodeData.textNode.id,
            params.width,
            params.height,
          )
        }
      />
      {selected ? (
        <div className="nodrag nopan absolute left-1/2 top-0 z-40 -translate-x-1/2 -translate-y-[calc(100%+20px)]">
          <div
            className="flex items-center gap-1 rounded-full border border-black/8 bg-white/96 px-2 py-1.5 shadow-[0_16px_32px_-24px_rgba(15,23,42,0.32)] backdrop-blur dark:border-white/10 dark:bg-[#151b24]/96"
            style={{
              transform: `scale(${overlayScale})`,
              transformOrigin: "center bottom",
            }}
          >
            <CanvasTextFormattingGroup
              textNode={nodeData.textNode}
              onUpdate={nodeData.onUpdate}
              compact
              showColorControl
            />
            <div className="h-6 w-px bg-black/8 dark:bg-white/10" />
            <CanvasToolbarIconButton
              tooltip={copy.copyText}
              className="nodrag nopan flex h-7 w-7 items-center justify-center rounded-full text-[#5f6774] transition-colors hover:bg-[#f3f4f6] dark:text-slate-300 dark:hover:bg-white/6"
              onClick={handleCopyText}
            >
              <Copy className="h-3.5 w-3.5" />
            </CanvasToolbarIconButton>
            <CanvasToolbarIconButton
              tooltip={copy.expandEditor}
              className="nodrag nopan flex h-7 w-7 items-center justify-center rounded-full text-[#5f6774] transition-colors hover:bg-[#f3f4f6] dark:text-slate-300 dark:hover:bg-white/6"
              onClick={() => setTextEditorOpen(true)}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </CanvasToolbarIconButton>
          </div>
        </div>
      ) : null}

      <CanvasNodeTypeLabel
        icon={Type}
        label={copy.textType}
        overlayScale={typeLabelScale}
      />
      <CanvasConnectionControl
        side="left"
        selected={selected}
        nodeHovered={isNodeHovered}
        toneClassName="text-[#5f6774] dark:text-slate-300"
        clipSlideFromNode
      />
      <CanvasConnectionControl
        side="right"
        selected={selected}
        nodeHovered={isNodeHovered}
        toneClassName="text-[#5f6774] dark:text-slate-300"
        clipSlideFromNode
      />
      <div
        className={cn(
          "relative isolate flex h-full w-full flex-col rounded-[10px] border-[1.5px] bg-[#eef0f3]/96 p-2 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.24)] transition-[border-color,box-shadow,transform,filter] dark:bg-[#171717]",
          nodeData.connectionTargetHighlightSide && "canvas-node-connection-target",
          getConnectionTargetHighlightClassName(
            nodeData.connectionTargetHighlightSide,
          ),
          selected
            ? "border-[#7c8698] shadow-[0_18px_30px_-20px_rgba(15,23,42,0.34)]"
            : "border-[#d8dde6] hover:border-[#c9d1dd] dark:border-white/12",
        )}
      >
        <div className="relative min-h-0 flex-1">
          {isRunning ? (
            <CanvasTextLoadingSkeleton
              lineHeight={editorFontSize * 0.44}
              className="px-0.5 py-1"
            />
          ) : null}
          {!isRunning ? (
            <textarea
              ref={inlineEditorRef}
              rows={1}
              wrap="soft"
              defaultValue={nodeData.textNode.content}
              onBlur={() => flushPendingContentCommit()}
              onChange={handleEditorChange}
              placeholder={copy.startCreating}
              spellCheck={false}
              className="nodrag nopan block w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-sans text-[#7a828f] outline-none placeholder:text-[#7a828f]/76 dark:text-slate-300 dark:placeholder:text-slate-400"
              style={{
                color: isDark && nodeData.textNode.color === "#111111"
                  ? "#e5e7eb"
                  : nodeData.textNode.color,
                fontStyle: isItalic ? "italic" : "normal",
                fontWeight: nodeData.textNode.fontWeight,
                fontSize: `${editorFontSize}px`,
                lineHeight: `${editorLineHeight}px`,
                textAlign: nodeData.textNode.align,
              }}
            />
          ) : null}
        </div>
      </div>
      <Dialog open={textEditorOpen} onOpenChange={setTextEditorOpen}>
        <DialogContent className="[&>button]:hidden max-w-[min(92vw,980px)] gap-0 overflow-hidden rounded-[24px] border border-black/8 bg-white/98 p-0 text-[#1f2937] shadow-[0_36px_90px_-44px_rgba(15,23,42,0.3)] dark:border-white/10 dark:bg-[#242424]/98 dark:text-white">
          <div className="flex h-[min(74vh,640px)] flex-col">
            <div className="flex items-center justify-between border-b border-black/6 px-5 py-3.5 dark:border-white/8">
              <div className="flex min-w-[72px] items-center">
                <button
                  type="button"
                  aria-label={copy.copyText}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[#5f6774] transition-colors hover:bg-black/[0.04] dark:text-slate-300 dark:hover:bg-white/6"
                  onClick={handleCopyText}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-black/[0.025] px-2 py-1 dark:bg-white/[0.04]">
                <CanvasTextFormattingGroup
                  textNode={nodeData.textNode}
                  onUpdate={nodeData.onUpdate}
                  compact={false}
                  showTooltips={false}
                />
              </div>
              <div className="flex min-w-[72px] items-center justify-end">
                <button
                  type="button"
                  aria-label={copy.close}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[#5f6774] transition-colors hover:bg-black/[0.04] dark:text-slate-300 dark:hover:bg-white/6"
                  onClick={() => setTextEditorOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 px-8 py-7">
              <div className="relative h-full w-full">
                {isRunning ? (
                  <CanvasTextLoadingSkeleton
                    lineHeight={expandedEditorFontSize * 0.42}
                    className="px-1 py-1.5"
                  />
                ) : null}
                {!isRunning ? (
                  <textarea
                    ref={expandedEditorRef}
                    defaultValue={nodeData.textNode.content}
                    onBlur={() => flushPendingContentCommit()}
                    onChange={handleEditorChange}
                    placeholder={copy.writeOrRefineText}
                    spellCheck={false}
                    className="h-full w-full resize-none border-0 bg-transparent p-0 font-sans outline-none placeholder:text-[#7a828f]/76 dark:placeholder:text-slate-400"
                    style={{
                      color: isDark && nodeData.textNode.color === "#111111"
                        ? "#e5e7eb"
                        : nodeData.textNode.color,
                      fontStyle: isItalic ? "italic" : "normal",
                      fontWeight: nodeData.textNode.fontWeight,
                      fontSize: `${expandedEditorFontSize}px`,
                      lineHeight: `${expandedEditorLineHeight}px`,
                      textAlign: nodeData.textNode.align,
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CanvasImageGraphNode({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const copy = useCanvasCopy();
  const reactFlow = useReactFlow<CanvasFlowNode, CanvasFlowEdge>();
  const { zoom } = useViewport();
  const { addToast } = useToast();
  const setCroppingImageNodeId = useCanvasStore(
    (state) => state.setCroppingImageNodeId,
  );
  const nodeData = data as CanvasImageNodeData;
  const [isNodeHovered, setIsNodeHovered] = useState(false);
  const imageToolbarActions = getVisibleImageToolbarActions(copy);
  const imageToolbarUtilities = getImageToolbarUtilities(copy);
  const imageCropAspectOptions = getImageCropAspectOptions(copy);
  const [activeToolbarAction, setActiveToolbarAction] = useState(
    imageToolbarActions[0]?.label ?? copy.imageActionRedraw,
  );
  const [cropMode, setCropMode] = useState(false);
  const [cropAspectMenuOpen, setCropAspectMenuOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);
  const [draftPresentation, setDraftPresentation] = useState<CanvasImagePresentation>(
    () => ({
      ...createDefaultCropPresentation(),
      crop: {
        ...createDefaultCropPresentation().crop,
        aspectLabel: copy.freeAspect,
      },
    }),
  );
  const [imageNaturalSize, setImageNaturalSize] = useState(() => ({
    width: Math.max(1, Math.round(nodeData.imageNode.width)),
    height: Math.max(1, Math.round(nodeData.imageNode.height)),
  }));
  const [cropDragState, setCropDragState] = useState<{
    mode: "move" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
    startPoint: CanvasPoint;
    startCrop: CanvasImagePresentation["crop"];
  } | null>(null);
  const isRunning = nodeData.isRunning;
  const hasImage = Boolean(nodeData.imageNode.image_url);
  const overlayScale = useMemo(() => getFloatingOverlayScale(zoom), [zoom]);
  const typeLabelScale = useMemo(() => getTypeLabelOverlayScale(zoom), [zoom]);
  const lastAutoSizedRef = useRef("");
  const cropFrameRef = useRef<HTMLDivElement>(null);

  const resetCropDraft = useCallback(() => {
    setDraftPresentation((current) => ({
      ...createDefaultCropPresentation(),
      crop: {
        ...current.crop,
        ...createDefaultCropPresentation().crop,
        aspectLabel: copy.freeAspect,
      },
    }));
    setCropAspectMenuOpen(false);
    setCropDragState(null);
  }, [copy.freeAspect]);

  const handleImageLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const naturalWidth = Math.round(event.currentTarget.naturalWidth);
      const naturalHeight = Math.round(event.currentTarget.naturalHeight);

      if (naturalWidth <= 0 || naturalHeight <= 0) {
        return;
      }

      setImageNaturalSize((current) =>
        current.width === naturalWidth && current.height === naturalHeight
          ? current
          : {
              width: naturalWidth,
              height: naturalHeight,
            },
      );

      const targetDimensions = getDefaultDisplayImageDimensions(
        naturalWidth,
        naturalHeight,
      );
      const nextKey = `${nodeData.imageNode.image_url}:${targetDimensions.width}x${targetDimensions.height}`;
      if (lastAutoSizedRef.current === nextKey) {
        return;
      }

      lastAutoSizedRef.current = nextKey;

      if (
        !shouldAutoCorrectImageNodeSize({
          nodeWidth: nodeData.imageNode.width,
          nodeHeight: nodeData.imageNode.height,
          naturalWidth,
          naturalHeight,
          targetWidth: targetDimensions.width,
          targetHeight: targetDimensions.height,
        })
      ) {
        return;
      }

      nodeData.onResizeEnd(
        nodeData.imageNode.id,
        targetDimensions.width,
        targetDimensions.height,
      );
    },
    [nodeData],
  );

  const getCropPointerPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = cropFrameRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        return null;
      }

      return {
        x: clamp((clientX - rect.left) / rect.width, 0, 1),
        y: clamp((clientY - rect.top) / rect.height, 0, 1),
      } satisfies CanvasPoint;
    },
    [],
  );

  useEffect(() => {
    if (!cropDragState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const currentPoint = getCropPointerPoint(event.clientX, event.clientY);
      if (!currentPoint) {
        return;
      }

      setDraftPresentation((current) => ({
        ...current,
        crop: updateCropFromPointer({
          crop: cropDragState.startCrop,
          mode: cropDragState.mode,
          startPoint: cropDragState.startPoint,
          currentPoint,
        }),
      }));
    };

    const handlePointerStop = () => {
      setCropDragState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerStop);
    window.addEventListener("pointercancel", handlePointerStop);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerStop);
      window.removeEventListener("pointercancel", handlePointerStop);
    };
  }, [cropDragState, getCropPointerPoint]);

  const handleCropPointerDown = useCallback(
    (mode: "move" | ImageCropHandleMode) =>
      (event: ReactPointerEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();

        const point = getCropPointerPoint(event.clientX, event.clientY);
        if (!point) {
          return;
        }

        setCropDragState({
          mode,
          startPoint: point,
          startCrop: draftPresentation.crop,
        });
      },
    [draftPresentation.crop, getCropPointerPoint],
  );

  const handleCropAspectChange = useCallback(
    (ratio: number | null, label: string) => {
      setDraftPresentation((current) => ({
        ...current,
        crop: applyCropAspect(current.crop, ratio, label),
      }));
    },
    [],
  );

  const handleEnterCropMode = useCallback(() => {
    resetCropDraft();
    setCropMode(true);

    const flowNode = reactFlow.getNode(id);
    if (!flowNode) {
      return;
    }

    const nodeWidth =
      flowNode.width ??
      (typeof flowNode.style?.width === "number" ? flowNode.style.width : 220);
    const nodeHeight =
      flowNode.height ??
      (typeof flowNode.style?.height === "number" ? flowNode.style.height : 220);
    const targetViewportWidth = window.innerWidth * 0.84;
    const targetViewportHeight = window.innerHeight * 0.76;
    const fitZoom = Math.min(
      targetViewportWidth / Math.max(nodeWidth, 1),
      targetViewportHeight / Math.max(nodeHeight, 1),
    );
    const nextZoom = clamp(fitZoom, Math.max(zoom, 1.85), MAX_CANVAS_ZOOM);

    void reactFlow.setCenter(
      flowNode.position.x + nodeWidth / 2,
      flowNode.position.y + nodeHeight / 2,
      {
        zoom: nextZoom,
        duration: 220,
      },
    );
  }, [id, reactFlow, resetCropDraft, zoom]);

  useEffect(() => {
    if (selected || !cropMode) {
      return;
    }

    setCropMode(false);
    setCropDragState(null);
  }, [cropMode, selected]);

  useEffect(() => {
    setCroppingImageNodeId(cropMode ? nodeData.imageNode.id : null);

    return () => {
      setCroppingImageNodeId(null);
    };
  }, [cropMode, nodeData.imageNode.id, setCroppingImageNodeId]);

  useEffect(() => {
    if (!cropMode && !previewDialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (cropMode) {
        setCropMode(false);
        resetCropDraft();
        return;
      }

      setPreviewDialogOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [cropMode, previewDialogOpen, resetCropDraft]);

  const handleImageUtility = useCallback(
    (utility: ReturnType<typeof getImageToolbarUtilities>[number]["key"]) => {
      if (!nodeData.imageNode.image_url) {
        addToast(copy.noImageToOperate, "info", 1800);
        return;
      }

      if (utility === "crop") {
        handleEnterCropMode();
        return;
      }

      if (utility === "fullscreen") {
        setPreviewDialogOpen(true);
        return;
      }

      downloadImage(nodeData.imageNode.image_url);
    },
    [addToast, copy.noImageToOperate, handleEnterCropMode, nodeData.imageNode.image_url],
  );

  const handleSaveCrop = useCallback(async () => {
    if (!nodeData.imageNode.image_url || isApplyingCrop) {
      return;
    }

    setIsApplyingCrop(true);

    try {
      const { file } = await createCroppedImageFile({
        imageUrl: nodeData.imageNode.image_url,
        fileName: buildImageAssetFileName(nodeData.nodeLabel),
        presentation: draftPresentation,
      });

      await nodeData.onReplaceImage(nodeData.imageNode.id, file);
      setCropMode(false);
      resetCropDraft();
      addToast(copy.imageCropped, "success", 1800);
    } catch (error) {
      console.error("Failed to crop canvas image:", error);
      addToast(copy.imageCropFailed, "error", 1800);
    } finally {
      setIsApplyingCrop(false);
    }
  }, [
    addToast,
    copy.imageCropFailed,
    copy.imageCropped,
    draftPresentation,
    isApplyingCrop,
    nodeData,
    resetCropDraft,
  ]);

  const cropBoxStyle = useMemo<CSSProperties>(
    () => ({
      left: `${draftPresentation.crop.x * 100}%`,
      top: `${draftPresentation.crop.y * 100}%`,
      width: `${draftPresentation.crop.width * 100}%`,
      height: `${draftPresentation.crop.height * 100}%`,
    }),
    [draftPresentation.crop],
  );
  const cropHandleStyles = useMemo(() => {
    const handleScale = clamp(1 / Math.max(zoom, 0.25), 0.5, 0.88);

    return {
      corner: {
        width: `${11 * handleScale}px`,
        height: `${11 * handleScale}px`,
        borderRadius: `${3.5 * handleScale}px`,
      } satisfies CSSProperties,
      horizontal: {
        width: `${28 * handleScale}px`,
        height: `${6 * handleScale}px`,
        borderRadius: `${999 * handleScale}px`,
      } satisfies CSSProperties,
      vertical: {
        width: `${6 * handleScale}px`,
        height: `${28 * handleScale}px`,
        borderRadius: `${999 * handleScale}px`,
      } satisfies CSSProperties,
    };
  }, [zoom]);
  const cropFrameStyle = useMemo<CSSProperties>(() => {
    const imageAspect = imageNaturalSize.width / Math.max(imageNaturalSize.height, 1);
    const nodeAspect =
      nodeData.imageNode.width / Math.max(nodeData.imageNode.height, 1);

    return {
      aspectRatio: `${imageNaturalSize.width} / ${imageNaturalSize.height}`,
      width: imageAspect >= nodeAspect ? "100%" : "auto",
      height: imageAspect >= nodeAspect ? "auto" : "100%",
      maxWidth: "100%",
      maxHeight: "100%",
    };
  }, [
    imageNaturalSize.height,
    imageNaturalSize.width,
    nodeData.imageNode.height,
    nodeData.imageNode.width,
  ]);

  return (
    <div
      className={cn(
        "group/node relative h-full w-full overflow-visible",
        nodeData.connectionTargetHighlightSide &&
          "canvas-node-connection-target-shell",
        getConnectionTargetHighlightShellClassName(
          nodeData.connectionTargetHighlightSide,
        ),
      )}
      onPointerEnter={() => setIsNodeHovered(true)}
      onPointerLeave={() => setIsNodeHovered(false)}
    >
      <NodeResizer
        isVisible={selected && !cropMode}
        minWidth={72}
        minHeight={72}
        keepAspectRatio
        autoScale
        color="#3b82f6"
        handleClassName="!h-2 !w-2 !rounded-[2px] !border-2 !border-[#3b82f6] !bg-white dark:!bg-[#11161d]"
        lineClassName="!border-[#3b82f6]/60"
        onResizeEnd={(_, params) =>
          nodeData.onResizeEnd(
            nodeData.imageNode.id,
            params.width,
            params.height,
          )
        }
      />
      <CanvasNodeTypeLabel
        icon={ImageIcon}
        label={copy.imageType}
        overlayScale={typeLabelScale}
      />
      {selected && !hasImage && !isRunning ? (
        <div className="nodrag nopan absolute left-1/2 top-0 z-40 -translate-x-1/2 -translate-y-[calc(100%+20px)]">
          <div
            className="flex items-center whitespace-nowrap rounded-full border border-black/8 bg-white/96 p-[6px] shadow-[0_16px_32px_-24px_rgba(15,23,42,0.32)] backdrop-blur dark:border-white/10 dark:bg-[#151b24]/96"
            style={{
              transform: `scale(${overlayScale})`,
              transformOrigin: "center bottom",
            }}
          >
            <button
              type="button"
              className="pointer-events-auto nodrag nopan flex h-7 items-center gap-1.5 rounded-full px-3.5 text-[#344154] transition-colors hover:bg-[#f3f4f6] dark:text-slate-100 dark:hover:bg-white/6"
              onClick={() => nodeData.onRequestUpload(nodeData.imageNode.id)}
            >
              <Upload className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap text-[11px] font-semibold">
                {copy.upload}
              </span>
            </button>
          </div>
        </div>
      ) : null}
      {selected && hasImage && !isRunning && !cropMode ? (
        <div className="nodrag nopan absolute left-1/2 top-0 z-40 -translate-x-1/2 -translate-y-[calc(100%+20px)]">
          <div
            className="flex items-center gap-1 whitespace-nowrap rounded-full border border-black/8 bg-white/96 px-2 py-1.5 shadow-[0_16px_32px_-24px_rgba(15,23,42,0.24)] backdrop-blur dark:border-white/10 dark:bg-[#151b24]/96"
            style={{
              transform: `scale(${overlayScale})`,
              transformOrigin: "center bottom",
            }}
          >
            {imageToolbarActions.map(({ icon: Icon, label }) => (
              <button
                key={label}
                type="button"
                className={cn(
                  "nodrag nopan flex min-h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  activeToolbarAction === label
                    ? "bg-[#111827] text-white dark:bg-white dark:text-[#111827]"
                    : "text-[#5f6774] hover:bg-[#f3f4f6] dark:text-slate-300 dark:hover:bg-white/6",
                )}
                onClick={() => setActiveToolbarAction(label)}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{label}</span>
              </button>
            ))}
            {imageToolbarActions.length > 0 && imageToolbarUtilities.length > 0 ? (
              <div className="h-6 w-px bg-black/8 dark:bg-white/10" />
            ) : null}
            {imageToolbarUtilities.map(({ icon: Icon, key, tooltip }) => (
              <CanvasToolbarIconButton
                key={key}
                tooltip={tooltip}
                className="nodrag nopan flex h-7 w-7 items-center justify-center rounded-full text-[#5f6774] transition-colors hover:bg-[#f3f4f6] dark:text-slate-300 dark:hover:bg-white/6"
                onClick={() => handleImageUtility(key)}
              >
                <Icon className="h-3.5 w-3.5" />
              </CanvasToolbarIconButton>
            ))}
          </div>
        </div>
      ) : null}
      <CanvasConnectionControl
        side="left"
        selected={selected}
        nodeHovered={isNodeHovered}
        toneClassName="text-[#5f6774] dark:text-white/56"
        clipSlideFromNode
      />
      <CanvasConnectionControl
        side="right"
        selected={selected}
        nodeHovered={isNodeHovered}
        toneClassName="text-[#5f6774] dark:text-white/56"
        clipSlideFromNode
      />
      <div
        className={cn(
          "relative isolate flex h-full w-full overflow-visible rounded-[10px] border shadow-[0_18px_30px_-24px_rgba(15,23,42,0.24)] transition-[border-color,box-shadow,transform,filter]",
          nodeData.connectionTargetHighlightSide && "canvas-node-connection-target",
          getConnectionTargetHighlightClassName(
            nodeData.connectionTargetHighlightSide,
          ),
          selected
            ? "border-[#4f8ef7] shadow-[0_18px_30px_-22px_rgba(79,111,232,0.28)]"
            : "border-[#d1d7df] hover:border-[#c5ccd6] dark:border-white/16",
        )}
      >
        <div className="relative min-h-0 h-full w-full overflow-hidden rounded-[10px] bg-[#eef0f3] dark:bg-[#242424]">
          {isRunning ? (
            <CanvasImageGenerationProgress
              imageUrl={nodeData.imageNode.image_url || null}
              label={nodeData.nodeLabel}
              progress={nodeData.generationProgress}
            />
          ) : cropMode && nodeData.imageNode.image_url ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#eef0f3] dark:bg-[#242424]">
              <div
                ref={cropFrameRef}
                className="relative overflow-visible"
                style={cropFrameStyle}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={nodeData.imageNode.image_url}
                  alt=""
                  className="block h-full w-full select-none"
                  draggable={false}
                  onLoad={handleImageLoad}
                />
                <div
                  className="absolute cursor-move border border-white shadow-[0_0_0_999px_rgba(245,247,250,0.58)]"
                  style={{
                    ...cropBoxStyle,
                    borderWidth: IMAGE_CROP_BORDER_WIDTH_PX,
                  }}
                  onPointerDown={handleCropPointerDown("move")}
                >
                  {IMAGE_CROP_HANDLES.map((handle) => (
                    <button
                      key={handle.mode}
                      type="button"
                      aria-label={copy.adjustCropHandle}
                      className={cn(
                        "absolute p-0 border border-[#b4bcc8] bg-white shadow-[0_8px_18px_-14px_rgba(15,23,42,0.34)] transition-shadow hover:shadow-[0_10px_18px_-12px_rgba(15,23,42,0.36)]",
                        handle.className,
                      )}
                      style={{
                        ...(handle.shape === "horizontal"
                          ? cropHandleStyles.horizontal
                          : handle.shape === "vertical"
                            ? cropHandleStyles.vertical
                            : cropHandleStyles.corner),
                        ...handle.anchorStyle,
                        cursor: handle.cursor,
                        touchAction: "none",
                      }}
                      onPointerDown={handleCropPointerDown(handle.mode)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : nodeData.imageNode.image_url ? (
            <SessionImage
              src={nodeData.imageNode.image_url}
              alt={nodeData.nodeLabel}
              wrapperClassName="h-full w-full"
              className="pointer-events-none h-full w-full select-none object-contain"
              disableReveal
              draggable={false}
              onLoad={handleImageLoad}
              onDragStart={(event) => event.preventDefault()}
            />
          ) : (
            <div className="flex h-full min-h-[56px] items-center justify-center text-[#98a2b3] dark:text-white/28">
              <ImageIcon className="h-7 w-7" strokeWidth={1.8} />
            </div>
          )}
        </div>
      </div>
      {selected && hasImage && !isRunning && cropMode ? (
        <div className="nodrag nopan absolute left-1/2 top-full z-[170] -translate-x-1/2 translate-y-4">
          <div
            className="pointer-events-auto relative flex items-center rounded-[16px] bg-white/96 p-2.5 text-[#4d5561] shadow-[0_18px_42px_-30px_rgba(15,23,42,0.18)] backdrop-blur-2xl"
            style={{
              transform: `scale(${overlayScale})`,
              transformOrigin: "center top",
            }}
          >
            {cropAspectMenuOpen ? (
              <div className="absolute bottom-full left-1/2 mb-3 flex -translate-x-1/2 items-center gap-1 rounded-[16px] bg-white/98 p-2 shadow-[0_18px_36px_-18px_rgba(15,23,42,0.2)]">
                {imageCropAspectOptions.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={cn(
                      "min-w-[56px] whitespace-nowrap rounded-[10px] px-3 py-2 text-[12px] font-medium transition-colors",
                      draftPresentation.crop.aspectLabel === option.label
                        ? "bg-[#111827] text-white"
                        : "text-[#5f6774] hover:bg-[#f3f4f6]",
                    )}
                    onClick={() => {
                      handleCropAspectChange(option.ratio, option.label);
                      setCropAspectMenuOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#6b7280] transition-colors hover:bg-black/[0.06] hover:text-[#111827]"
              onClick={() => {
                setCropMode(false);
                resetCropDraft();
              }}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mx-1 h-4 w-px bg-black/10" />
            <button
              type="button"
              className="flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-medium text-[#2f3540] transition-colors hover:bg-black/[0.06]"
              onClick={() => setCropAspectMenuOpen((current) => !current)}
            >
              <Crop className="h-4.5 w-4.5" />
              <span className="whitespace-nowrap">{copy.aspectRatio}</span>
            </button>
            <button
              type="button"
              className="ml-2 flex h-9 items-center gap-2 rounded-[10px] bg-[#111111] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#000000] disabled:cursor-not-allowed disabled:bg-[#9ca3af]"
              disabled={isApplyingCrop}
              onClick={() => {
                void handleSaveCrop();
              }}
            >
              <Check className="h-4 w-4" />
              <span className="whitespace-nowrap">
                {isApplyingCrop ? copy.saving : copy.confirmCrop}
              </span>
            </button>
          </div>
        </div>
      ) : null}
      {previewDialogOpen &&
      nodeData.imageNode.image_url &&
      typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[150] bg-black/45 backdrop-blur-[2px]"
              data-canvas-zoom-relay=""
              onClick={() => setPreviewDialogOpen(false)}
            >
              <div className="flex h-full w-full items-center justify-center p-8">
                <div
                  className="relative inline-flex items-start"
                  onClick={(event) => event.stopPropagation()}
                >
                  <SessionImage
                    src={nodeData.imageNode.image_url}
                    alt=""
                    wrapperClassName="max-h-[88vh] max-w-[calc(100vw-180px)]"
                    className="max-h-[88vh] w-auto max-w-[calc(100vw-180px)] object-contain"
                    disableReveal
                    draggable={false}
                    onLoad={handleImageLoad}
                    onDragStart={(event) => event.preventDefault()}
                  />
                  <div className="absolute left-full top-0 ml-3 flex flex-col gap-2 max-md:left-auto max-md:right-0 max-md:top-full max-md:mt-3 max-md:flex-row">
                    <CanvasToolbarIconButton
                      tooltip={copy.closeAction}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/94 text-[#4d5561] shadow-[0_16px_30px_-22px_rgba(15,23,42,0.26)] transition-colors hover:bg-white"
                      onClick={() => {
                        setPreviewDialogOpen(false);
                      }}
                    >
                      <X className="h-4.5 w-4.5" />
                    </CanvasToolbarIconButton>
                    <CanvasToolbarIconButton
                      tooltip={copy.download}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/94 text-[#4d5561] shadow-[0_16px_30px_-22px_rgba(15,23,42,0.26)] transition-colors hover:bg-white"
                      onClick={() => {
                        downloadImage(nodeData.imageNode.image_url);
                      }}
                    >
                      <Download className="h-4.5 w-4.5" />
                    </CanvasToolbarIconButton>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function CanvasVideoGraphNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const copy = useCanvasCopy();
  const { zoom } = useViewport();
  const { addToast } = useToast();
  const nodeData = data as CanvasVideoNodeData;
  const isRunning = nodeData.isRunning;
  const [isNodeHovered, setIsNodeHovered] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const videoToolbarActions = getVideoToolbarActions(copy);
  const videoToolbarUtilities = getVideoToolbarUtilities(copy);
  const [activeToolbarAction, setActiveToolbarAction] =
    useState<ReturnType<typeof getVideoToolbarActions>[number]["key"]>("regenerate");
  const [clipEditorOpen, setClipEditorOpen] = useState(false);
  const [clipMuted, setClipMuted] = useState(true);
  const [clipPlaying, setClipPlaying] = useState(false);
  const [previewMuted, setPreviewMuted] = useState(true);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(
    Math.max(0, nodeData.videoNode.trimStartSeconds ?? 0),
  );
  const [previewMediaDuration, setPreviewMediaDuration] = useState(
    Math.max(
      0.5,
      (nodeData.videoNode.trimStartSeconds ?? 0) +
        Math.max(0.5, nodeData.videoNode.durationSeconds),
    ),
  );
  const [clipTotalDuration, setClipTotalDuration] = useState(
    Math.max(
      5,
      (nodeData.videoNode.trimStartSeconds ?? 0) + nodeData.videoNode.durationSeconds,
    ),
  );
  const [clipStart, setClipStart] = useState(nodeData.videoNode.trimStartSeconds ?? 0);
  const [clipEnd, setClipEnd] = useState(
    Math.max(
      nodeData.videoNode.durationSeconds,
      (nodeData.videoNode.trimStartSeconds ?? 0) + nodeData.videoNode.durationSeconds,
    ),
  );
  const [clipCurrentTime, setClipCurrentTime] = useState(clipStart);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const clipPreviewRef = useRef<HTMLVideoElement>(null);
  const title = nodeData.videoNode.title.trim() || copy.nodeVideoLabel;
  const hasVideoAsset = Boolean(
    nodeData.videoNode.videoUrl || nodeData.videoNode.posterUrl,
  );
  const overlayScale = useMemo(() => getFloatingOverlayScale(zoom), [zoom]);
  const typeLabelScale = useMemo(() => getTypeLabelOverlayScale(zoom), [zoom]);
  const selectedClipDuration = Math.max(0.5, clipEnd - clipStart);
  const selectionStartPercent =
    clipTotalDuration > 0 ? (clipStart / clipTotalDuration) * 100 : 0;
  const selectionWidthPercent =
    clipTotalDuration > 0 ? (selectedClipDuration / clipTotalDuration) * 100 : 100;
  const previewClipBounds = useMemo(
    () =>
      resolveVideoClipBounds({
        totalDuration: previewMediaDuration,
        trimStartSeconds: nodeData.videoNode.trimStartSeconds ?? 0,
        durationSeconds: nodeData.videoNode.durationSeconds,
      }),
    [
      nodeData.videoNode.durationSeconds,
      nodeData.videoNode.trimStartSeconds,
      previewMediaDuration,
    ],
  );
  const previewProgressValue = clamp(
    previewCurrentTime,
    previewClipBounds.start,
    previewClipBounds.end,
  );
  const previewVideoKey = `${nodeData.videoNode.videoUrl ?? ""}:${nodeData.videoNode.trimStartSeconds ?? 0}:${nodeData.videoNode.durationSeconds}`;
  const showVideoPreviewControls =
    Boolean(nodeData.videoNode.videoUrl) &&
    !isRunning &&
    (isNodeHovered || selected);

  useEffect(() => {
    const media = clipPreviewRef.current;
    if (!media) {
      return;
    }

    media.muted = clipMuted;
  }, [clipEditorOpen, clipMuted]);

  useEffect(() => {
    const media = previewVideoRef.current;
    if (!media) {
      return;
    }

    media.muted = previewMuted;
  }, [previewMuted]);

  useEffect(() => {
    if (!clipEditorOpen && !previewDialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (clipEditorOpen) {
        setClipEditorOpen(false);
        clipPreviewRef.current?.pause();
        setClipPlaying(false);
        return;
      }

      setPreviewDialogOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [clipEditorOpen, previewDialogOpen]);

  const resetClipDraft = (totalDurationOverride?: number) => {
    const nextStart = Math.max(0, nodeData.videoNode.trimStartSeconds ?? 0);
    const nextTotal = Math.max(
      totalDurationOverride ?? 0,
      5,
      nextStart + Math.max(0.5, nodeData.videoNode.durationSeconds),
    );
    const nextEnd = Math.min(
      nextTotal,
      Math.max(nextStart + 0.5, nextStart + nodeData.videoNode.durationSeconds),
    );

    setClipTotalDuration(nextTotal);
    setClipStart(nextStart);
    setClipEnd(nextEnd);
    setClipCurrentTime(nextStart);
    setClipPlaying(false);
  };

  const handleToggleClipPlayback = () => {
    const media = clipPreviewRef.current;
    if (!media) {
      addToast(copy.noPlayableVideoForClip, "info", 1800);
      return;
    }

    if (media.paused) {
      if (media.currentTime < clipStart || media.currentTime >= clipEnd) {
        media.currentTime = clipStart;
      }
      void media.play().catch(() => {
        addToast(copy.videoPreviewUnavailable, "error", 1800);
      });
      return;
    }

    media.pause();
  };

  const handleClipStartChange = (nextValue: number) => {
    const nextStart = Math.min(nextValue, clipEnd - 0.5);
    setClipStart(nextStart);
    setClipCurrentTime((current) => Math.max(nextStart, Math.min(current, clipEnd)));
    if (clipPreviewRef.current) {
      clipPreviewRef.current.currentTime = nextStart;
    }
  };

  const handleClipEndChange = (nextValue: number) => {
    const nextEnd = Math.max(nextValue, clipStart + 0.5);
    setClipEnd(nextEnd);
    if (clipPreviewRef.current && clipPreviewRef.current.currentTime > nextEnd) {
      clipPreviewRef.current.currentTime = clipStart;
      setClipCurrentTime(clipStart);
    }
  };

  const handleSaveClip = () => {
    const nextStart = Number(clipStart.toFixed(2));
    const nextDuration = Number(Math.max(0.5, clipEnd - clipStart).toFixed(2));

    nodeData.onUpdate(nodeData.videoNode.id, {
      trimStartSeconds: nextStart,
      durationSeconds: nextDuration,
    });
    setClipEditorOpen(false);
    setClipPlaying(false);
    clipPreviewRef.current?.pause();
    addToast(copy.videoClipSaved, "success", 1800);
  };

  const handleVideoToolbarAction = (
    action: ReturnType<typeof getVideoToolbarActions>[number]["key"],
  ) => {
    setActiveToolbarAction(action);

    if (action === "remove") {
      nodeData.onUpdate(nodeData.videoNode.id, {
        posterUrl: null,
        videoUrl: null,
        status: "idle",
        trimStartSeconds: 0,
        durationSeconds: 4,
      });
      setClipEditorOpen(false);
      setClipPlaying(false);
      addToast(copy.videoRemoved, "success", 1800);
      return;
    }

    addToast(copy.videoRegeneratePlaceholder, "info", 1800);
  };

  const handleVideoUtility = (
    utility: ReturnType<typeof getVideoToolbarUtilities>[number]["key"],
  ) => {
    if (utility === "fullscreen") {
      if (!nodeData.videoNode.videoUrl) {
        addToast(copy.noFullscreenVideo, "info", 1800);
        return;
      }

      previewVideoRef.current?.pause();
      setPreviewPlaying(false);
      setPreviewDialogOpen(true);
      return;
    }

    if (utility === "download" && nodeData.videoNode.videoUrl) {
      const link = document.createElement("a");
      link.href = nodeData.videoNode.videoUrl;
      link.download = `${title || "video"}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    addToast(copy.noDownloadVideo, "info", 1800);
  };

  const handleTogglePreviewPlayback = useCallback(() => {
    const media = previewVideoRef.current;
    if (!media || !nodeData.videoNode.videoUrl) {
      addToast(copy.noPlayableVideo, "info", 1800);
      return;
    }

    if (media.paused) {
      if (
        media.currentTime < previewClipBounds.start ||
        media.currentTime >= previewClipBounds.end
      ) {
        media.currentTime = previewClipBounds.start;
        setPreviewCurrentTime(previewClipBounds.start);
      }

      void media.play().catch(() => {
        addToast(copy.videoPreviewUnavailable, "error", 1800);
      });
      return;
    }

    media.pause();
  }, [
    addToast,
    copy.noPlayableVideo,
    copy.videoPreviewUnavailable,
    nodeData.videoNode.videoUrl,
    previewClipBounds.end,
    previewClipBounds.start,
    setPreviewCurrentTime,
  ]);

  const handlePreviewSeek = useCallback(
    (nextValue: number) => {
      const nextTime = clamp(
        nextValue,
        previewClipBounds.start,
        previewClipBounds.end,
      );
      const media = previewVideoRef.current;
      if (media) {
        media.currentTime = nextTime;
      }
      setPreviewCurrentTime(nextTime);
    },
    [previewClipBounds.end, previewClipBounds.start, setPreviewCurrentTime],
  );
  const stopVideoNodeInteraction = useCallback((event: SyntheticEvent) => {
    event.stopPropagation();
  }, []);

  return (
    <div
      className={cn(
        "group/node relative h-full w-full overflow-visible",
        nodeData.connectionTargetHighlightSide &&
          "canvas-node-connection-target-shell",
        getConnectionTargetHighlightShellClassName(
          nodeData.connectionTargetHighlightSide,
        ),
      )}
      onPointerEnter={() => setIsNodeHovered(true)}
      onPointerLeave={() => setIsNodeHovered(false)}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={180}
        minHeight={100}
        keepAspectRatio
        autoScale
        color="#3b82f6"
        handleClassName="!h-2 !w-2 !rounded-[2px] !border-2 !border-[#3b82f6] !bg-white dark:!bg-[#11161d]"
        lineClassName="!border-[#3b82f6]/60"
        onResizeEnd={(_, params) =>
          nodeData.onResizeEnd(
            nodeData.videoNode.id,
            params.width,
            params.height,
          )
        }
      />
      <CanvasConnectionControl
        side="left"
        selected={selected}
        nodeHovered={isNodeHovered}
        toneClassName="text-[#5f6774] dark:text-white/56"
        clipSlideFromNode
      />
      <CanvasConnectionControl
        side="right"
        selected={selected}
        nodeHovered={isNodeHovered}
        toneClassName="text-[#5f6774] dark:text-white/56"
        clipSlideFromNode
      />
      <CanvasNodeTypeLabel
        icon={Video}
        label={copy.videoType}
        overlayScale={typeLabelScale}
      />
      {selected && !hasVideoAsset && !isRunning ? (
        <div className="nodrag nopan absolute left-1/2 top-0 z-40 -translate-x-1/2 -translate-y-[calc(100%+20px)]">
          <div
            className="flex items-center whitespace-nowrap rounded-full border border-black/8 bg-white/96 p-[6px] shadow-[0_16px_32px_-24px_rgba(15,23,42,0.32)] backdrop-blur dark:border-white/10 dark:bg-[#151b24]/96"
            style={{
              transform: `scale(${overlayScale})`,
              transformOrigin: "center bottom",
            }}
          >
            <button
              type="button"
              className="pointer-events-auto nodrag nopan flex h-7 items-center gap-1.5 rounded-full px-3.5 text-[#344154] transition-colors hover:bg-[#f3f4f6] dark:text-slate-100 dark:hover:bg-white/6"
              onPointerDown={stopVideoNodeInteraction}
              onClick={(event) => {
                event.stopPropagation();
                nodeData.onRequestUpload(nodeData.videoNode.id);
              }}
            >
              <Upload className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap text-[11px] font-semibold">
                {copy.upload}
              </span>
            </button>
          </div>
        </div>
      ) : null}
      {selected && hasVideoAsset ? (
        <div className="nodrag nopan absolute left-1/2 top-0 z-40 -translate-x-1/2 -translate-y-[calc(100%+20px)]">
          <div
            className="flex items-center gap-1 whitespace-nowrap rounded-full border border-black/8 bg-white/96 px-2 py-1.5 shadow-[0_16px_32px_-24px_rgba(15,23,42,0.24)] backdrop-blur dark:border-white/10 dark:bg-[#151b24]/96"
            style={{
              transform: `scale(${overlayScale})`,
              transformOrigin: "center bottom",
            }}
          >
            {videoToolbarActions.map(({ key, icon: Icon, label }) => {
              const isActive = activeToolbarAction === key;

              return (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    "nodrag nopan flex min-h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    isActive
                      ? "bg-[#111827] text-white dark:bg-white dark:text-[#111827]"
                      : "text-[#5f6774] hover:bg-[#f3f4f6] dark:text-slate-300 dark:hover:bg-white/6",
                  )}
                  onPointerDown={stopVideoNodeInteraction}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleVideoToolbarAction(key);
                  }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="whitespace-nowrap">{label}</span>
                </button>
              );
            })}
            {videoToolbarActions.length > 0 && videoToolbarUtilities.length > 0 ? (
              <div className="h-6 w-px bg-black/8 dark:bg-white/10" />
            ) : null}
            {videoToolbarUtilities.map(({ key, icon: Icon, tooltip }) => (
              <CanvasToolbarIconButton
                key={key}
                tooltip={tooltip}
                className="nodrag nopan flex h-7 w-7 items-center justify-center rounded-full text-[#5f6774] transition-colors hover:bg-[#f3f4f6] dark:text-slate-300 dark:hover:bg-white/6"
                onPointerDown={stopVideoNodeInteraction}
                onClick={(event) => {
                  event.stopPropagation();
                  handleVideoUtility(key);
                }}
              >
                <Icon className="h-3.5 w-3.5" />
              </CanvasToolbarIconButton>
            ))}
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          "relative isolate flex h-full w-full rounded-[10px] border shadow-[0_18px_30px_-24px_rgba(15,23,42,0.24)] transition-[border-color,box-shadow,transform,filter]",
          nodeData.connectionTargetHighlightSide && "canvas-node-connection-target",
          getConnectionTargetHighlightClassName(
            nodeData.connectionTargetHighlightSide,
          ),
          selected
            ? "border-[#4f8ef7] shadow-[0_18px_30px_-22px_rgba(79,111,232,0.28)]"
            : "border-[#d1d7df] hover:border-[#c5ccd6] dark:border-white/16",
        )}
      >
        <div className="relative min-h-0 h-full w-full overflow-hidden rounded-[10px] bg-[#eef0f3] dark:bg-[#242424]">
          {isRunning ? (
            <CanvasImageGenerationProgress
              imageUrl={nodeData.videoNode.posterUrl || null}
              label={title}
              progress={nodeData.generationProgress}
            />
          ) : nodeData.videoNode.videoUrl ? (
            <video
              key={previewVideoKey}
              ref={previewVideoRef}
              src={nodeData.videoNode.videoUrl}
              poster={nodeData.videoNode.posterUrl ?? undefined}
              className="pointer-events-none h-full w-full select-none object-cover"
              playsInline
              preload="metadata"
              muted={previewMuted}
              onLoadStart={() => {
                setPreviewPlaying(false);
                setPreviewMediaDuration(
                  Math.max(
                    0.5,
                    (nodeData.videoNode.trimStartSeconds ?? 0) +
                      Math.max(0.5, nodeData.videoNode.durationSeconds),
                  ),
                );
                setPreviewCurrentTime(
                  Math.max(0, nodeData.videoNode.trimStartSeconds ?? 0),
                );
              }}
              onLoadedMetadata={() => {
                const media = previewVideoRef.current;
                if (!media) {
                  return;
                }

                const nextBounds = resolveVideoClipBounds({
                  totalDuration: media.duration,
                  trimStartSeconds: nodeData.videoNode.trimStartSeconds ?? 0,
                  durationSeconds: nodeData.videoNode.durationSeconds,
                });

                setPreviewMediaDuration(nextBounds.totalDuration);
                media.currentTime = nextBounds.start;
                setPreviewCurrentTime(nextBounds.start);
                void media.play().catch(() => {
                  setPreviewPlaying(false);
                });
              }}
              onPlay={() => setPreviewPlaying(true)}
              onPause={() => setPreviewPlaying(false)}
              onEnded={() => {
                const media = previewVideoRef.current;
                if (media) {
                  media.currentTime = previewClipBounds.end;
                }
                setPreviewCurrentTime(previewClipBounds.end);
                setPreviewPlaying(false);
              }}
              onTimeUpdate={() => {
                const media = previewVideoRef.current;
                if (!media) {
                  return;
                }

                const nextBounds = resolveVideoClipBounds({
                  totalDuration: media.duration,
                  trimStartSeconds: nodeData.videoNode.trimStartSeconds ?? 0,
                  durationSeconds: nodeData.videoNode.durationSeconds,
                });

                setPreviewMediaDuration(nextBounds.totalDuration);

                if (media.currentTime >= nextBounds.end) {
                  media.pause();
                  media.currentTime = nextBounds.end;
                  setPreviewCurrentTime(nextBounds.end);
                  setPreviewPlaying(false);
                  return;
                }

                setPreviewCurrentTime(
                  clamp(media.currentTime, nextBounds.start, nextBounds.end),
                );
              }}
            />
          ) : nodeData.videoNode.posterUrl ? (
            <SessionImage
              src={nodeData.videoNode.posterUrl}
              alt={title}
              wrapperClassName="h-full w-full"
              className="pointer-events-none h-full w-full select-none object-cover"
              disableReveal
              draggable={false}
              onDragStart={(event) => event.preventDefault()}
            />
          ) : null}
          {!isRunning && nodeData.videoNode.videoUrl && showVideoPreviewControls ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                className="pointer-events-auto nodrag nopan flex h-14 w-14 items-center justify-center rounded-full bg-[#233547]/88 text-white shadow-[0_18px_38px_-24px_rgba(0,0,0,0.56)] transition-colors hover:bg-[#2a3f54]"
                onPointerDown={stopVideoNodeInteraction}
                onClick={(event) => {
                  event.stopPropagation();
                  handleTogglePreviewPlayback();
                }}
              >
                {previewPlaying ? (
                  <Pause className="h-7 w-7" />
                ) : (
                  <Play className="h-7 w-7 fill-current" />
                )}
              </button>
            </div>
          ) : !isRunning && !hasVideoAsset ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <PlayCircle
                className={cn(
                  "h-7 w-7",
                  hasVideoAsset
                    ? "text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.28)]"
                    : "text-[#98a2b3] dark:text-white/28",
                )}
                strokeWidth={1.8}
              />
            </div>
          ) : null}
          {nodeData.videoNode.videoUrl && showVideoPreviewControls ? (
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-black/44 px-3 py-3 text-white backdrop-blur-[2px]">
              <input
                type="range"
                min={previewClipBounds.start}
                max={previewClipBounds.end}
                step={0.05}
                value={previewProgressValue}
                onPointerDown={stopVideoNodeInteraction}
                onClick={stopVideoNodeInteraction}
                onChange={(event) =>
                  handlePreviewSeek(Number(event.target.value))
                }
                className="pointer-events-auto nodrag nopan h-1.5 flex-1 cursor-pointer accent-white"
                aria-label={copy.videoProgress}
              />
              <button
                type="button"
                className="pointer-events-auto nodrag nopan flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/16"
                onPointerDown={stopVideoNodeInteraction}
                onClick={(event) => {
                  event.stopPropagation();
                  setPreviewMuted((current) => !current);
                }}
                aria-label={previewMuted ? copy.unmutePreview : copy.mutePreview}
              >
                {previewMuted ? (
                  <VolumeX className="h-4.5 w-4.5" />
                ) : (
                  <Volume2 className="h-4.5 w-4.5" />
                )}
              </button>
            </div>
          ) : null}
        </div>
        <div className="sr-only">
          {title}
        </div>
      </div>
      <Dialog
        open={clipEditorOpen}
        onOpenChange={(open) => {
          if (open) {
            resetClipDraft();
          }
          setClipEditorOpen(open);
          if (!open) {
            clipPreviewRef.current?.pause();
            setClipPlaying(false);
          }
        }}
      >
        <DialogContent className="max-w-[1180px] overflow-hidden border-white/10 bg-[#080808] p-0 text-white shadow-[0_40px_100px_-42px_rgba(0,0,0,0.85)]">
          <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center gap-2 text-[18px] font-medium text-white/72">
              <Video className="h-5 w-5" />
              <span>{copy.videoDialogTitle}</span>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#111111]">
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-black">
                {nodeData.videoNode.videoUrl ? (
                  <video
                    ref={clipPreviewRef}
                    src={nodeData.videoNode.videoUrl}
                    poster={nodeData.videoNode.posterUrl ?? undefined}
                    className="h-full w-full object-cover"
                    playsInline
                    muted={clipMuted}
                    onLoadedMetadata={() => {
                      const media = clipPreviewRef.current;
                      if (!media || !Number.isFinite(media.duration) || media.duration <= 0) {
                        return;
                      }

                      const nextTotal = media.duration;
                      const nextStart = Math.min(
                        clipStart,
                        Math.max(nextTotal - 0.5, 0),
                      );
                      const nextEnd = Math.min(
                        nextTotal,
                        Math.max(nextStart + 0.5, clipEnd),
                      );

                      setClipTotalDuration(nextTotal);
                      setClipStart(nextStart);
                      setClipEnd(nextEnd);
                      media.currentTime = nextStart;
                      setClipCurrentTime(nextStart);
                    }}
                    onPlay={() => setClipPlaying(true)}
                    onPause={() => setClipPlaying(false)}
                    onTimeUpdate={() => {
                      const media = clipPreviewRef.current;
                      if (!media) {
                        return;
                      }

                      if (media.currentTime > clipEnd) {
                        media.currentTime = clipStart;
                        if (!media.paused) {
                          void media.play().catch(() => {
                            setClipPlaying(false);
                          });
                        }
                        setClipCurrentTime(clipStart);
                        return;
                      }

                      setClipCurrentTime(media.currentTime);
                    }}
                  />
                ) : nodeData.videoNode.posterUrl ? (
                  <SessionImage
                    src={nodeData.videoNode.posterUrl}
                    alt={title}
                    wrapperClassName="h-full w-full"
                    className="h-full w-full object-cover"
                    disableReveal
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#101010] text-white/28">
                    <PlayCircle className="h-16 w-16" strokeWidth={1.6} />
                  </div>
                )}

                <button
                  type="button"
                  className="absolute left-6 top-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#233547]/92 text-white shadow-[0_18px_38px_-24px_rgba(0,0,0,0.56)] transition-colors hover:bg-[#2a3f54]"
                  onClick={() => setClipMuted((current) => !current)}
                >
                  <VolumeX className="h-7 w-7" />
                </button>

                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/82 via-black/18 to-transparent px-7 py-6 text-white">
                  <div className="flex items-center gap-5">
                    <button
                      type="button"
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-white/0 text-white transition-colors hover:bg-white/10"
                      onClick={handleToggleClipPlayback}
                    >
                      {clipPlaying ? (
                        <Pause className="h-7 w-7" />
                      ) : (
                        <Play className="h-7 w-7 fill-current" />
                      )}
                    </button>
                    <span className="text-[18px] font-medium">
                      {formatClipSeconds(clipCurrentTime)}
                    </span>
                  </div>
                  <span className="text-[18px] font-medium">
                    {formatClipSeconds(clipEnd)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-end gap-4">
              <button
                type="button"
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/8 text-white transition-colors hover:bg-white/12"
                onClick={() => {
                  setClipEditorOpen(false);
                  clipPreviewRef.current?.pause();
                  setClipPlaying(false);
                }}
              >
                <X className="h-8 w-8" />
              </button>

              <div className="min-w-0 flex-1 rounded-[28px] border border-white/10 bg-[#101010] p-3">
                <div className="relative h-20 overflow-hidden rounded-[20px]">
                  <div className="grid h-full grid-cols-10 gap-[1px] bg-white/6">
                    {Array.from({ length: 10 }).map((_, index) => (
                      <div
                        key={`frame-${index}`}
                        className="relative h-full overflow-hidden bg-[#1a1a1a]"
                      >
                        {nodeData.videoNode.posterUrl ? (
                          <SessionImage
                            src={nodeData.videoNode.posterUrl}
                            alt={title}
                            wrapperClassName="h-full w-full"
                            className="h-full w-full object-cover"
                            disableReveal
                          />
                        ) : (
                          <div className="h-full w-full bg-[linear-gradient(135deg,#111827,#1f2937)]" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 bg-black/52"
                    style={{ width: `${selectionStartPercent}%` }}
                  />
                  <div
                    className="pointer-events-none absolute inset-y-0 right-0 bg-black/52"
                    style={{
                      width: `${Math.max(0, 100 - selectionStartPercent - selectionWidthPercent)}%`,
                    }}
                  />
                  <div
                    className="pointer-events-none absolute inset-y-1 rounded-[18px] border-[3px] border-white shadow-[0_0_0_1px_rgba(255,255,255,0.2)]"
                    style={{
                      left: `${selectionStartPercent}%`,
                      width: `${selectionWidthPercent}%`,
                    }}
                  />
                  <div
                    className="pointer-events-none absolute inset-y-4 w-1.5 rounded-full bg-white"
                    style={{ left: `calc(${selectionStartPercent}% - 3px)` }}
                  />
                  <div
                    className="pointer-events-none absolute inset-y-4 w-1.5 rounded-full bg-white"
                    style={{
                      left: `calc(${selectionStartPercent + selectionWidthPercent}% - 3px)`,
                    }}
                  />
                  <div
                    className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-[#262626] px-4 py-1.5 text-[16px] font-semibold text-white"
                  >
                    {selectedClipDuration.toFixed(2)}s
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  <label className="grid gap-1.5 text-sm text-white/72">
                    <div className="flex items-center justify-between">
                      <span>{copy.startLabel}</span>
                      <span>{formatClipSeconds(clipStart)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(clipTotalDuration, 0.5)}
                      step={0.1}
                      value={clipStart}
                      onChange={(event) =>
                        handleClipStartChange(Number(event.target.value))
                      }
                      className="h-2 w-full cursor-pointer accent-white"
                    />
                  </label>

                  <label className="grid gap-1.5 text-sm text-white/72">
                    <div className="flex items-center justify-between">
                      <span>{copy.endLabel}</span>
                      <span>{formatClipSeconds(clipEnd)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(clipTotalDuration, 0.5)}
                      step={0.1}
                      value={clipEnd}
                      onChange={(event) =>
                        handleClipEndChange(Number(event.target.value))
                      }
                      className="h-2 w-full cursor-pointer accent-white"
                    />
                  </label>
                </div>
              </div>

              <button
                type="button"
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-[#111111] transition-colors hover:bg-white/92"
                onClick={handleSaveClip}
              >
                <Check className="h-8 w-8" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {previewDialogOpen &&
      nodeData.videoNode.videoUrl &&
      typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[150] bg-black/45 backdrop-blur-[2px]"
              data-canvas-zoom-relay=""
              onClick={() => setPreviewDialogOpen(false)}
            >
              <div className="flex h-full w-full items-center justify-center p-8">
                <div
                  className="relative inline-flex items-start"
                  onClick={(event) => event.stopPropagation()}
                >
                  <video
                    src={nodeData.videoNode.videoUrl}
                    poster={nodeData.videoNode.posterUrl ?? undefined}
                    className="max-h-[88vh] w-auto max-w-[calc(100vw-180px)] rounded-[18px] bg-black object-contain shadow-[0_26px_64px_-30px_rgba(0,0,0,0.55)]"
                    controls
                    autoPlay
                    playsInline
                    muted={previewMuted}
                  />
                  <div className="absolute left-full top-0 ml-3 flex flex-col gap-2 max-md:left-auto max-md:right-0 max-md:top-full max-md:mt-3 max-md:flex-row">
                    <CanvasToolbarIconButton
                      tooltip={copy.closeAction}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/94 text-[#4d5561] shadow-[0_16px_30px_-22px_rgba(15,23,42,0.26)] transition-colors hover:bg-white"
                      onClick={() => {
                        setPreviewDialogOpen(false);
                      }}
                    >
                      <X className="h-4.5 w-4.5" />
                    </CanvasToolbarIconButton>
                    <CanvasToolbarIconButton
                      tooltip={copy.download}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/94 text-[#4d5561] shadow-[0_16px_30px_-22px_rgba(15,23,42,0.26)] transition-colors hover:bg-white"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = nodeData.videoNode.videoUrl!;
                        link.download = `${title || "video"}.mp4`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      <Download className="h-4.5 w-4.5" />
                    </CanvasToolbarIconButton>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function CanvasShapeGraphNode({
  data,
  selected,
  width,
  height,
}: NodeProps<CanvasFlowNode>) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const nodeData = data as CanvasShapeNodeData;
  const resolvedWidth = width ?? nodeData.annotation.width;
  const resolvedHeight = height ?? nodeData.annotation.height;
  const { annotation } = nodeData;
  const strokeColor = resolveCanvasForegroundColor(
    annotation.strokeColor,
    isDark,
  );
  const polylinePoints = useMemo(
    () =>
      annotation.points && annotation.points.length >= 2
        ? annotation.points
        : [
            { x: 0, y: resolvedHeight },
            { x: resolvedWidth, y: 0 },
          ],
    [annotation.points, resolvedHeight, resolvedWidth],
  );

  return (
    <div className="relative h-full w-full overflow-visible">
      <NodeResizer
        isVisible={selected}
        minWidth={
          annotation.kind === "line" || annotation.kind === "arrow" ? 8 : 40
        }
        minHeight={
          annotation.kind === "line" || annotation.kind === "arrow" ? 8 : 40
        }
        color="#3b82f6"
        autoScale
        handleClassName="!h-2 !w-2 !rounded-[2px] !border-2 !border-[#3b82f6] !bg-white dark:!bg-[#11161d]"
        lineClassName="!border-[#3b82f6]"
        onResizeEnd={(_, params) =>
          nodeData.onResizeEnd(annotation.id, params.width, params.height)
        }
      />
      <div
        className={cn("h-full w-full", selected && "ring-2 ring-[#3b82f6]/18")}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${resolvedWidth} ${resolvedHeight}`}
          className="overflow-visible"
        >
          {annotation.kind === "rectangle" ? (
            <rect
              x="4"
              y="4"
              width={Math.max(0, resolvedWidth - 8)}
              height={Math.max(0, resolvedHeight - 8)}
              fill={annotation.fillColor}
              stroke={strokeColor}
              strokeWidth={annotation.strokeWidth}
            />
          ) : null}
          {annotation.kind === "ellipse" ? (
            <ellipse
              cx={resolvedWidth / 2}
              cy={resolvedHeight / 2}
              rx={Math.max(12, resolvedWidth / 2 - 6)}
              ry={Math.max(12, resolvedHeight / 2 - 6)}
              fill={annotation.fillColor}
              stroke={strokeColor}
              strokeWidth={annotation.strokeWidth}
            />
          ) : null}
          {annotation.kind === "polygon" || annotation.kind === "star" ? (
            <polygon
              points={buildShapePoints(
                annotation.kind,
                resolvedWidth,
                resolvedHeight,
              )}
              fill={annotation.fillColor}
              stroke={strokeColor}
              strokeWidth={annotation.strokeWidth}
            />
          ) : null}
          {annotation.kind === "line" ? (
            <polyline
              points={polylinePoints
                .map((point) => `${point.x},${point.y}`)
                .join(" ")}
              fill="none"
              stroke={strokeColor}
              strokeWidth={annotation.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {annotation.kind === "arrow" ? (
            <>
              <defs>
                <marker
                  id={`shape-arrow-${annotation.id}`}
                  markerWidth="12"
                  markerHeight="12"
                  refX="10"
                  refY="6"
                  orient="auto"
                >
                  <path d="M 0 0 L 12 6 L 0 12 z" fill={strokeColor} />
                </marker>
              </defs>
              <polyline
                points={polylinePoints
                  .map((point) => `${point.x},${point.y}`)
                  .join(" ")}
                fill="none"
                stroke={strokeColor}
                strokeWidth={annotation.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd={`url(#shape-arrow-${annotation.id})`}
              />
            </>
          ) : null}
        </svg>
      </div>
    </div>
  );
}

function CanvasStrokeGraphNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const nodeData = data as CanvasStrokeNodeData;
  const strokeColor = resolveCanvasForegroundColor(
    nodeData.annotation.strokeColor,
    isDark,
  );

  return (
    <div
      className={cn(
        "relative h-full w-full rounded-[10px]",
        selected && "ring-2 ring-[#3b82f6]/18",
      )}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${nodeData.annotation.width} ${nodeData.annotation.height}`}
        className="overflow-visible"
      >
        <path
          d={buildStrokePath(nodeData.annotation.points)}
          fill="none"
          stroke={strokeColor}
          strokeWidth={nodeData.annotation.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function CanvasGraphEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  selected,
  data,
}: EdgeProps<CanvasFlowEdge>) {
  const copy = useCanvasCopy();
  const relationType = data?.relationType ?? "primary";
  const isHighlighted = selected || data?.isConnectedToSelectedNode;
  const [isHovered, setIsHovered] = useState(false);
  const [isInsertMenuOpen, setIsInsertMenuOpen] = useState(false);
  const insertMenuRef = useRef<HTMLDivElement>(null);
  const edgeInsertNodeOptions = getEdgeInsertNodeOptions(copy);
  const stroke = isHighlighted ? "#3b82f6" : "#c1c7d0";
  const insertKinds = data?.insertKinds ?? [];
  const resolvedSourceX =
    sourcePosition === Position.Left
      ? sourceX + CANVAS_CONNECTION_HANDLE_OUTSET_PX
      : sourcePosition === Position.Right
        ? sourceX - CANVAS_CONNECTION_HANDLE_OUTSET_PX
        : sourceX;
  const resolvedTargetX =
    targetPosition === Position.Left
      ? targetX + CANVAS_CONNECTION_HANDLE_OUTSET_PX
      : targetPosition === Position.Right
        ? targetX - CANVAS_CONNECTION_HANDLE_OUTSET_PX
        : targetX;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: resolvedSourceX,
    sourceY,
    sourcePosition,
    targetX: resolvedTargetX,
    targetY,
    targetPosition,
    curvature: relationType === "prompt" ? 0.18 : 0.24,
  });

  useEffect(() => {
    if (!isInsertMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        insertMenuRef.current &&
        event.target instanceof Node &&
        !insertMenuRef.current.contains(event.target)
      ) {
        setIsInsertMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isInsertMenuOpen]);

  return (
    <>
      <g
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: "pointer" }}
      >
        {isHovered ? (
          <BaseEdge
            id={`${id}-hover`}
            path={edgePath}
            interactionWidth={0}
            style={{
              stroke: "#d7dde6",
              strokeWidth: isHighlighted ? 4.5 : 4,
              strokeOpacity: 0.9,
              strokeLinecap: "round",
              strokeLinejoin: "round",
            }}
          />
        ) : null}
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            stroke,
            strokeWidth: isHighlighted ? 1.5 : 1.35,
            strokeOpacity: isHighlighted ? 0.98 : 0.94,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            cursor: "pointer",
          }}
        />
      </g>
      {selected ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-auto absolute z-30"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <div
              ref={insertMenuRef}
              className="relative flex items-center gap-1.5 rounded-full border border-black/6 bg-white/98 p-1 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-[#10161d]/98"
            >
              {isInsertMenuOpen ? (
                <div className="absolute bottom-[calc(100%+8px)] left-1/2 w-[152px] -translate-x-1/2 rounded-[14px] border border-black/6 bg-white/98 p-1.5 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-[#10161d]/98">
                  <div className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7a828f] dark:text-slate-400">
                    {copy.addNode}
                  </div>
                  <div className="flex flex-col gap-1">
                    {edgeInsertNodeOptions.map(({ kind, label, icon: Icon }) => {
                      const isEnabled = insertKinds.includes(kind);

                      return (
                        <button
                          key={kind}
                          type="button"
                          disabled={!isEnabled}
                          onClick={() => {
                            if (!isEnabled || !data) {
                              return;
                            }

                            setIsInsertMenuOpen(false);
                            data.onInsertNode(id, kind);
                          }}
                          className={cn(
                            "flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[12px] font-medium transition-colors",
                            isEnabled
                              ? "text-foreground hover:bg-black/[0.04] dark:text-slate-100 dark:hover:bg-white/[0.06]"
                              : "cursor-not-allowed text-[#9ea5b0] opacity-55 dark:text-slate-500",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                              isEnabled
                                ? "bg-black/[0.04] dark:bg-white/[0.06]"
                                : "bg-black/[0.025] dark:bg-white/[0.03]",
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setIsInsertMenuOpen((current) => !current)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-black/[0.04] dark:text-slate-100 dark:hover:bg-white/[0.06]"
                title={copy.insertNode}
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsInsertMenuOpen(false);
                  data?.onDelete(id);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#b24b43] transition-colors hover:bg-[#fff1f0] dark:text-[#ff9b92] dark:hover:bg-[#251715]"
                title={copy.deleteEdge}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const canvasWorkspaceNodeTypes = {
  canvasImage: CanvasImageGraphNode,
  canvasShape: CanvasShapeGraphNode,
  canvasStroke: CanvasStrokeGraphNode,
  canvasText: CanvasTextGraphNode,
  canvasVideo: CanvasVideoGraphNode,
};

export const canvasWorkspaceEdgeTypes = {
  canvasGraph: CanvasGraphEdge,
};
