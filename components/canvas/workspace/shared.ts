import {
  ArrowUpRight,
  Circle,
  Hand,
  MousePointer2,
  Slash,
  Square,
  Star,
  Triangle,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { Edge, Node, Viewport } from "@xyflow/react";
import { ASPECT_RATIO_PICKER_ORDER } from "@/components/create/AspectRatioOptionCard";
import {
  getCanvasActionDefinition,
  type CanvasActionType,
} from "@/lib/canvas/actions";
import type { CanvasOperationParams } from "@/lib/canvas/edit-router";
import type {
  CanvasImageNode,
  CanvasLink,
  CanvasNodeKind,
  CanvasOperation,
  CanvasProject,
  CanvasTextNode,
  CanvasVideoNode,
} from "@/lib/supabase/types";
import type { AspectRatio } from "@/store/generate-store";

export type GraphPayload = {
  project: CanvasProject;
  textNodes: CanvasTextNode[];
  imageNodes: CanvasImageNode[];
  videoNodes: CanvasVideoNode[];
  operations: CanvasOperation[];
  links: CanvasLink[];
};

export type CanvasToolMode = "select" | "hand" | "shape" | "draw" | "text";
export type CanvasPrimaryToolMode = Extract<CanvasToolMode, "select" | "hand">;
export type CanvasShapeKind =
  | "rectangle"
  | "line"
  | "arrow"
  | "ellipse"
  | "polygon"
  | "star";
export type CanvasToolbarHoverMenu = "primary" | "shape";

export type PendingCanvasImageNode = CanvasImageNode & {
  isPlaceholder: true;
};

export type PendingCanvasBranch = {
  operation: CanvasOperation;
  inputNodeIds: string[];
  placeholderNodes: PendingCanvasImageNode[];
};

export type CanvasPoint = {
  x: number;
  y: number;
};

export type CanvasGestureEvent = Event & {
  scale?: number;
  clientX?: number;
  clientY?: number;
};

export type CanvasShapeAnnotation = {
  id: string;
  kind: CanvasShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  points?: CanvasPoint[];
};

export type CanvasTextAnnotation = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  align: "left" | "center" | "right";
};

export type CanvasStrokeAnnotation = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  points: CanvasPoint[];
  strokeColor: string;
  strokeWidth: number;
};

export type CanvasImageCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: number | null;
  aspectLabel: string;
};

export type CanvasImagePresentation = {
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  crop: CanvasImageCrop;
};

export type CanvasTextStyleDefaults = Pick<
  CanvasTextAnnotation,
  "color" | "fontFamily" | "fontWeight" | "fontSize" | "align"
>;

export type CanvasAnnotationStorage = {
  texts: CanvasTextAnnotation[];
  shapes: CanvasShapeAnnotation[];
  strokes: CanvasStrokeAnnotation[];
  imagePresentations: Record<string, CanvasImagePresentation>;
};

export type CanvasAlignmentGuide = {
  orientation: "vertical" | "horizontal";
  value: number;
  start: number;
  end: number;
};

export type CanvasDrawingDraft = {
  points: CanvasPoint[];
};

export type CanvasShapeDraft = {
  kind: CanvasShapeKind;
  start: CanvasPoint;
  current: CanvasPoint;
};

export type CanvasCropDialogState = {
  open: boolean;
  nodeId: string | null;
  draftPresentation: CanvasImagePresentation | null;
};

export type CanvasImageExpandPreview = {
  canvasWidth: number;
  canvasHeight: number;
  imageWidth: number;
  imageHeight: number;
};

export type CanvasConnectionTargetSide = "left" | "right" | "top" | "bottom";

export type CanvasConnectionTargetHighlight = {
  flowNodeId: string;
  side: CanvasConnectionTargetSide;
};

export type CanvasImageNodeData = {
  imageNode: CanvasImageNode | PendingCanvasImageNode;
  nodeLabel: string;
  isRunning: boolean;
  generationProgress: number | null;
  connectionTargetHighlightSide: CanvasConnectionTargetSide | null;
  onResizeEnd: (nodeId: string, width: number, height: number) => void;
  onReplaceImage: (nodeId: string, file: File) => Promise<void>;
  onRequestUpload: (nodeId: string) => void;
  quickCreateOptions: CanvasQuickCreateOption[];
  onQuickCreate: (option: CanvasQuickCreateOption) => void;
};

export type CanvasQuickCreateOption = {
  kind: CanvasNodeKind;
  label: string;
  relationType: Extract<CanvasLink["relation_type"], "prompt" | "reference" | "primary">;
};

export type CanvasOperationMetaItem = {
  label: string;
  value: string;
};

export type CanvasOperationNodeData = {
  operation: CanvasOperation;
  label: string;
  inputNodeIds: string[];
  isExpanded: boolean;
  isSubmitting: boolean;
  promptText: string;
  metaItems: CanvasOperationMetaItem[];
  onToggleExpand: (operationId: string) => void;
  onEditOperation: (operationId: string) => void;
  onRerunOperation: (operationId: string) => void;
};

export type CanvasShapeNodeData = {
  annotation: CanvasShapeAnnotation;
  onResizeEnd: (nodeId: string, width: number, height: number) => void;
  onCommitPolyline: (nodeId: string, points: CanvasPoint[]) => void;
};

export type CanvasTextNodeData = {
  textNode: CanvasTextNode;
  summary: string;
  isRunning: boolean;
  connectionTargetHighlightSide: CanvasConnectionTargetSide | null;
  onResizeEnd: (nodeId: string, width: number, height: number) => void;
  onContentChange: (nodeId: string, nextContent: string) => void;
  onUpdate: (nodeId: string, patch: Partial<CanvasTextNode>) => void;
  onDuplicate: (nodeId: string) => void;
  onFocusComposer: (nodeId: string) => void;
  quickCreateOptions: CanvasQuickCreateOption[];
  onQuickCreate: (option: CanvasQuickCreateOption) => void;
};

export type CanvasVideoNodeData = {
  videoNode: CanvasVideoNode;
  primarySourceLabel: string | null;
  isRunning: boolean;
  generationProgress: number | null;
  connectionTargetHighlightSide: CanvasConnectionTargetSide | null;
  onResizeEnd: (nodeId: string, width: number, height: number) => void;
  onRequestUpload: (nodeId: string) => void;
  onUpdate: (nodeId: string, patch: Partial<CanvasVideoNode>) => void;
};

export type CanvasStrokeNodeData = {
  annotation: CanvasStrokeAnnotation;
};

export type CanvasEdgeData = {
  relationType: CanvasLink["relation_type"];
  sourceKind: CanvasNodeKind;
  targetKind: CanvasNodeKind;
  isConnectedToSelectedNode: boolean;
  insertKinds: CanvasNodeKind[];
  onDelete: (edgeId: string) => void;
  onInsertNode: (edgeId: string, kind: CanvasNodeKind) => void;
};

export type CanvasFlowNode = Node<
  | CanvasImageNodeData
  | CanvasOperationNodeData
  | CanvasShapeNodeData
  | CanvasTextNodeData
  | CanvasVideoNodeData
  | CanvasStrokeNodeData
>;
export type CanvasFlowEdge = Edge<CanvasEdgeData>;

export type CombinedGraphPayload = {
  project: CanvasProject;
  textNodes: CanvasTextNode[];
  imageNodes: Array<CanvasImageNode | PendingCanvasImageNode>;
  videoNodes: CanvasVideoNode[];
  operations: CanvasOperation[];
  links: CanvasLink[];
};

export const DEFAULT_NODE_WIDTH = 220;
export const DEFAULT_NODE_HEIGHT = 220;
export const MIN_CANVAS_ZOOM = 0.1;
export const MAX_CANVAS_ZOOM = 5;
export const CANVAS_NODE_DRAG_MIME = "application/x-muses-canvas-node-kind";
export const CANVAS_SOURCE_HANDLE_ID = "source";
export const CANVAS_TARGET_HANDLE_ID = "target";
export const QUICK_EDIT_CREDIT_COST = 2;
export const GENERATED_NODE_X_OFFSET = 360;
export const GENERATED_NODE_Y_OFFSET = 260;
export const REVISION_BRANCH_GAP = 72;
export const EXPAND_SCALE_OPTIONS = [1.5, 2, 3] as const;
export const EXPAND_ASPECT_RATIO_OPTIONS = ["1:1", "3:4", "9:16", "4:3"] as const;
export const EXPAND_COMPOSER_WIDTH = 760;
const ANNOTATION_STORAGE_PREFIX = "muses.canvas.annotations.";
const ALIGNMENT_THRESHOLD = 6;
export const DEFAULT_DRAW_COLOR = "#111111";
export const DEFAULT_DRAW_WIDTH = 10;
export const CANVAS_EDGE_COLORS = {
  prompt: "#6b7280",
  primary: "#4f6fe8",
  reference: "#d4a23a",
  input: "#94a3b8",
  output: "#4f6fe8",
} as const;
export const MIN_CROP_SIZE = 0.12;
export const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#2563eb\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 12a9 9 0 1 0 3-6.7\"/><path d=\"M3 3v5h5\"/></svg>',
)}") 12 12, grab`;
export const DEFAULT_TEXT_STYLE: CanvasTextStyleDefaults = {
  color: "#111111",
  fontFamily: "Inter",
  fontWeight: 400,
  fontSize: 80,
  align: "left",
};
export const PRIMARY_TOOL_MENU_ITEMS = [
  {
    mode: "select" as const,
    label: "Select",
    shortcut: "V",
    icon: MousePointer2,
  },
  {
    mode: "hand" as const,
    label: "Hand Tool",
    shortcut: "H",
    icon: Hand,
  },
];
export const TEXT_FONT_FAMILY_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Georgia", label: "Georgia" },
  { value: "Helvetica Neue", label: "Helvetica Neue" },
  { value: "Times New Roman", label: "Times New Roman" },
];
export const TEXT_FONT_WEIGHT_OPTIONS = [
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
];
export const TEXT_ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];
export const SHAPE_MENU_ITEMS: Array<{
  kind: CanvasShapeKind;
  label: string;
  shortcut: string;
  icon: typeof Square;
}> = [
  { kind: "rectangle", label: "Rectangle", shortcut: "R", icon: Square },
  { kind: "line", label: "Line", shortcut: "L", icon: Slash },
  { kind: "arrow", label: "Arrow", shortcut: "Shift L", icon: ArrowUpRight },
  { kind: "ellipse", label: "Ellipse", shortcut: "O", icon: Circle },
  { kind: "polygon", label: "Polygon", shortcut: "P", icon: Triangle },
  { kind: "star", label: "Star", shortcut: "S", icon: Star },
];

export const CROP_ASPECT_OPTIONS = ASPECT_RATIO_PICKER_ORDER.filter(
  (ratio): ratio is Exclude<AspectRatio, "auto"> => ratio !== "auto",
);

export const IMAGE_ROTATE_HANDLE_POSITIONS = [
  {
    key: "top-left",
    className: "left-0 top-0 -translate-x-[145%] -translate-y-[145%]",
  },
  {
    key: "top-right",
    className: "right-0 top-0 translate-x-[145%] -translate-y-[145%]",
  },
  {
    key: "bottom-right",
    className: "bottom-0 right-0 translate-x-[145%] translate-y-[145%]",
  },
  {
    key: "bottom-left",
    className: "bottom-0 left-0 -translate-x-[145%] translate-y-[145%]",
  },
] as const;

type ExpandScaleOption = (typeof EXPAND_SCALE_OPTIONS)[number];
type ExpandAspectRatioOption = (typeof EXPAND_ASPECT_RATIO_OPTIONS)[number];

export function formatCanvasDimensions(width: number, height: number) {
  return `${Math.round(width)} x ${Math.round(height)}`;
}

export function getCanvasOperationNodeSize(params: {
  label: string;
  isExpanded: boolean;
}) {
  if (params.isExpanded) {
    return {
      width: 320,
      height: 236,
    };
  }

  return {
    width: clamp(96 + params.label.length * 11, 156, 220),
    height: 72,
  };
}

export function normalizeNodeIdList(ids: string[]) {
  return Array.from(new Set(ids)).sort();
}

export function getFlowNodeId(kind: CanvasNodeKind, id: string) {
  return `${kind}:${id}`;
}

export function parseFlowNodeId(value: string) {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex === -1) {
    return null;
  }

  const kind = value.slice(0, separatorIndex);
  const id = value.slice(separatorIndex + 1);
  if (
    id.length === 0 ||
    (kind !== "text" && kind !== "image" && kind !== "video")
  ) {
    return null;
  }

  return {
    kind: kind as CanvasNodeKind,
    id,
  };
}

export function getCanvasLinkRelationForKinds(
  sourceKind: CanvasNodeKind,
  targetKind: CanvasNodeKind,
): Extract<CanvasLink["relation_type"], "prompt" | "reference" | "primary"> | null {
  if (sourceKind === "text" && targetKind === "text") {
    return "prompt";
  }

  if (sourceKind === "text" && targetKind === "image") {
    return "prompt";
  }

  if (sourceKind === "text" && targetKind === "video") {
    return "prompt";
  }

  if (sourceKind === "image" && targetKind === "image") {
    return "reference";
  }

  if (sourceKind === "image" && targetKind === "text") {
    return "reference";
  }

  if (sourceKind === "image" && targetKind === "video") {
    return "primary";
  }

  if (sourceKind === "video" && targetKind === "text") {
    return "reference";
  }

  return null;
}

export function getQuickCreateOptionsForNode(
  kind: CanvasNodeKind,
  labels: {
    nodeTextLabel: string;
    nodeImageLabel: string;
    nodeVideoLabel: string;
    referenceImageNodeLabel: string;
  },
) {
  switch (kind) {
    case "text":
      return [
        { kind: "image", label: labels.nodeImageLabel, relationType: "prompt" },
        { kind: "video", label: labels.nodeVideoLabel, relationType: "prompt" },
      ] satisfies CanvasQuickCreateOption[];
    case "image":
      return [
        {
          kind: "image",
          label: labels.referenceImageNodeLabel,
          relationType: "reference",
        },
        { kind: "text", label: labels.nodeTextLabel, relationType: "reference" },
        { kind: "video", label: labels.nodeVideoLabel, relationType: "primary" },
      ] satisfies CanvasQuickCreateOption[];
    case "video":
      return [
        { kind: "text", label: labels.nodeTextLabel, relationType: "reference" },
      ] satisfies CanvasQuickCreateOption[];
    default:
      return [] as CanvasQuickCreateOption[];
  }
}

export function getInsertKindsForEdge(
  sourceKind: CanvasNodeKind,
  targetKind: CanvasNodeKind,
): CanvasNodeKind[] {
  const candidateKinds: CanvasNodeKind[] = ["text", "image", "video"];

  return candidateKinds.filter((kind) => {
    const sourceRelation = getCanvasLinkRelationForKinds(sourceKind, kind);
    const targetRelation = getCanvasLinkRelationForKinds(kind, targetKind);
    return sourceRelation !== null && targetRelation !== null;
  });
}

export function getTextNodeSummary(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "No summary yet.";
  }

  if (normalized.length <= 96) {
    return normalized;
  }

  return `${normalized.slice(0, 93).trimEnd()}...`;
}

export function getConnectionTargetHighlightClassName(
  side: CanvasConnectionTargetSide | null,
) {
  if (!side) {
    return null;
  }

  return `canvas-node-connection-target-${side}`;
}

export function getConnectionTargetHighlightShellClassName(
  side: CanvasConnectionTargetSide | null,
) {
  if (!side) {
    return null;
  }

  return `canvas-node-connection-target-shell-${side}`;
}

export function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function stableSerializeValue(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerializeValue(item)).join(",")}]`;
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(
      ([key, entryValue]) =>
        `${JSON.stringify(key)}:${stableSerializeValue(entryValue)}`,
    )
    .join(",")}}`;
}

export function areCanvasOperationParamsEqual(
  left: CanvasOperationParams | null,
  right: CanvasOperationParams | null,
) {
  return stableSerializeValue(left) === stableSerializeValue(right);
}

export function getCanvasOperationParams(operation: CanvasOperation) {
  if (
    !operation.params_json ||
    typeof operation.params_json !== "object" ||
    Array.isArray(operation.params_json)
  ) {
    return {} as Record<string, unknown>;
  }

  return operation.params_json as Record<string, unknown>;
}

export function getCanvasOperationStoredPosition(operation: CanvasOperation) {
  const params = getCanvasOperationParams(operation);
  const ui =
    params.ui && typeof params.ui === "object" && !Array.isArray(params.ui)
      ? (params.ui as Record<string, unknown>)
      : null;
  const position =
    ui?.position &&
    typeof ui.position === "object" &&
    !Array.isArray(ui.position)
      ? (ui.position as Record<string, unknown>)
      : null;
  const x = position?.x;
  const y = position?.y;

  if (typeof x !== "number" || typeof y !== "number") {
    return null;
  }

  return { x, y };
}

export function buildCanvasOperationMetaItems(
  operation: CanvasOperation,
): CanvasOperationMetaItem[] {
  const params = getCanvasOperationParams(operation);
  const items: CanvasOperationMetaItem[] = [
    {
      label: "Engine",
      value: operation.engine ? operation.engine.toUpperCase() : "LOCAL",
    },
  ];
  const outputCount =
    typeof params.outputCount === "number" && params.outputCount > 0
      ? params.outputCount
      : null;
  const size =
    typeof params.size === "string" && params.size.trim().length > 0
      ? params.size.trim()
      : null;
  const mode =
    typeof params.mode === "string" && params.mode.trim().length > 0
      ? params.mode.trim()
      : null;
  const expandScale = getExpandScaleValue(params as CanvasOperationParams);

  if (outputCount) {
    items.push({
      label: "Outputs",
      value: `${outputCount}`,
    });
  }

  if (operation.action_type === "expand") {
    items.push({
      label: "Scale",
      value: `${expandScale}x`,
    });
    items.push({
      label: "Ratio",
      value: size ?? "Original",
    });
  } else if (size) {
    items.push({
      label: "Size",
      value: size,
    });
  }

  if (mode) {
    items.push({
      label: "Mode",
      value: mode,
    });
  }

  return items;
}

export function withCanvasOperationStoredPosition(
  operation: CanvasOperation,
  position: { x: number; y: number },
) {
  const params = getCanvasOperationParams(operation);
  const ui =
    params.ui && typeof params.ui === "object" && !Array.isArray(params.ui)
      ? (params.ui as Record<string, unknown>)
      : {};

  return {
    ...operation,
    params_json: {
      ...params,
      ui: {
        ...ui,
        position,
      },
    },
  } satisfies CanvasOperation;
}

export function getCanvasOperationRerunParams(operation: CanvasOperation) {
  const params = { ...getCanvasOperationParams(operation) };

  delete params.outputCount;
  delete params.size;
  delete params.actionLabel;
  delete params.ui;

  return Object.keys(params).length > 0 ? params : null;
}

export function resolveCanvasActionOutputCount(
  actionType: CanvasActionType,
  requestedCount: number | null | undefined,
) {
  const action = getCanvasActionDefinition(actionType);
  if (action.maxOutputs <= 1) {
    return 1;
  }

  if (typeof requestedCount === "number" && Number.isFinite(requestedCount)) {
    return clamp(Math.round(requestedCount), 1, action.maxOutputs);
  }

  return action.defaultOutputs;
}

export function createId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function areCropsEqual(
  left: CanvasImageCrop | null | undefined,
  right: CanvasImageCrop | null | undefined,
) {
  if (!left || !right) {
    return left === right;
  }

  const epsilon = 0.0005;
  return (
    Math.abs(left.x - right.x) < epsilon &&
    Math.abs(left.y - right.y) < epsilon &&
    Math.abs(left.width - right.width) < epsilon &&
    Math.abs(left.height - right.height) < epsilon &&
    left.aspectLabel === right.aspectLabel &&
    left.aspectRatio === right.aspectRatio
  );
}

export function normalizeDegrees(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function createDefaultCrop(): CanvasImageCrop {
  return {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    aspectRatio: null,
    aspectLabel: "Free",
  };
}

export function createDefaultImagePresentation(): CanvasImagePresentation {
  return {
    rotation: 0,
    flipX: false,
    flipY: false,
    crop: createDefaultCrop(),
  };
}

export function getImagePresentation(
  presentations: Record<string, CanvasImagePresentation>,
  nodeId: string,
) {
  return presentations[nodeId] ?? createDefaultImagePresentation();
}

export function getImageDisplayStyle(
  presentation: CanvasImagePresentation,
  options?: {
    includeTransform?: boolean;
    applyCrop?: boolean;
  },
): CSSProperties {
  const crop =
    options?.applyCrop === false ? createDefaultCrop() : presentation.crop;
  const safeWidth = Math.max(crop.width, MIN_CROP_SIZE);
  const safeHeight = Math.max(crop.height, MIN_CROP_SIZE);
  const includeTransform = options?.includeTransform ?? true;

  return {
    position: "absolute",
    left: `${(-crop.x / safeWidth) * 100}%`,
    top: `${(-crop.y / safeHeight) * 100}%`,
    width: `${100 / safeWidth}%`,
    height: `${100 / safeHeight}%`,
    objectFit: "cover",
    transform: includeTransform
      ? `rotate(${normalizeDegrees(presentation.rotation)}deg) scaleX(${
          presentation.flipX ? -1 : 1
        }) scaleY(${presentation.flipY ? -1 : 1})`
      : undefined,
    transformOrigin: "center center",
  };
}

export function applyCropAspect(
  crop: CanvasImageCrop,
  nextAspectRatio: number | null,
  label: string,
) {
  if (!nextAspectRatio) {
    return {
      ...crop,
      aspectRatio: null,
      aspectLabel: label,
    };
  }

  const centerX = crop.x + crop.width / 2;
  const centerY = crop.y + crop.height / 2;
  const area = Math.max(crop.width * crop.height, MIN_CROP_SIZE ** 2);
  let width = Math.sqrt(area * nextAspectRatio);
  let height = width / nextAspectRatio;

  const maxWidth = Math.min(centerX * 2, (1 - centerX) * 2, 1);
  const maxHeight = Math.min(centerY * 2, (1 - centerY) * 2, 1);

  if (width > maxWidth) {
    width = maxWidth;
    height = width / nextAspectRatio;
  }
  if (height > maxHeight) {
    height = maxHeight;
    width = height * nextAspectRatio;
  }

  width = clamp(width, MIN_CROP_SIZE, 1);
  height = clamp(height, MIN_CROP_SIZE, 1);

  return {
    x: clamp(centerX - width / 2, 0, 1 - width),
    y: clamp(centerY - height / 2, 0, 1 - height),
    width,
    height,
    aspectRatio: nextAspectRatio,
    aspectLabel: label,
  };
}

export function parseAspectRatioValue(ratio: Exclude<AspectRatio, "auto">) {
  const [width, height] = ratio.split(":").map(Number);
  return width / height;
}

export function isExpandScaleOption(value: unknown): value is ExpandScaleOption {
  return (
    typeof value === "number" &&
    EXPAND_SCALE_OPTIONS.some((option) => Math.abs(option - value) < 0.001)
  );
}

export function getExpandScaleValue(
  params: CanvasOperationParams | null | undefined,
) {
  return isExpandScaleOption(params?.expandScale)
    ? params.expandScale
    : EXPAND_SCALE_OPTIONS[0];
}

export function getExpandAspectRatioValue(
  size: string | null | undefined,
): ExpandAspectRatioOption | "original" {
  return EXPAND_ASPECT_RATIO_OPTIONS.includes(size as ExpandAspectRatioOption)
    ? (size as ExpandAspectRatioOption)
    : "original";
}

export function getExpandedCanvasDimensions(params: {
  width: number;
  height: number;
  scale: number;
  aspectRatio: number;
}) {
  const minWidth = Math.max(1, params.width * params.scale);
  const minHeight = Math.max(1, params.height * params.scale);
  let nextWidth = minWidth;
  let nextHeight = nextWidth / params.aspectRatio;

  if (nextHeight < minHeight) {
    nextHeight = minHeight;
    nextWidth = nextHeight * params.aspectRatio;
  }

  return {
    width: nextWidth,
    height: nextHeight,
  };
}

export function normalizeCrop(crop: CanvasImageCrop): CanvasImageCrop {
  const width = clamp(crop.width, MIN_CROP_SIZE, 1);
  const height = clamp(crop.height, MIN_CROP_SIZE, 1);

  return {
    ...crop,
    x: clamp(crop.x, 0, 1 - width),
    y: clamp(crop.y, 0, 1 - height),
    width,
    height,
  };
}

export function updateCropFromPointer(params: {
  crop: CanvasImageCrop;
  mode: "move" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
  startPoint: CanvasPoint;
  currentPoint: CanvasPoint;
}) {
  const dx = params.currentPoint.x - params.startPoint.x;
  const dy = params.currentPoint.y - params.startPoint.y;

  if (params.mode === "move") {
    return normalizeCrop({
      ...params.crop,
      x: params.crop.x + dx,
      y: params.crop.y + dy,
    });
  }

  let left = params.crop.x;
  let top = params.crop.y;
  let right = params.crop.x + params.crop.width;
  let bottom = params.crop.y + params.crop.height;

  if (params.mode === "nw") {
    left = clamp(params.crop.x + dx, 0, right - MIN_CROP_SIZE);
    top = clamp(params.crop.y + dy, 0, bottom - MIN_CROP_SIZE);
  }
  if (params.mode === "n") {
    top = clamp(params.crop.y + dy, 0, bottom - MIN_CROP_SIZE);
  }
  if (params.mode === "ne") {
    right = clamp(right + dx, left + MIN_CROP_SIZE, 1);
    top = clamp(params.crop.y + dy, 0, bottom - MIN_CROP_SIZE);
  }
  if (params.mode === "e") {
    right = clamp(right + dx, left + MIN_CROP_SIZE, 1);
  }
  if (params.mode === "se") {
    right = clamp(right + dx, left + MIN_CROP_SIZE, 1);
    bottom = clamp(bottom + dy, top + MIN_CROP_SIZE, 1);
  }
  if (params.mode === "s") {
    bottom = clamp(bottom + dy, top + MIN_CROP_SIZE, 1);
  }
  if (params.mode === "sw") {
    left = clamp(params.crop.x + dx, 0, right - MIN_CROP_SIZE);
    bottom = clamp(bottom + dy, top + MIN_CROP_SIZE, 1);
  }
  if (params.mode === "w") {
    left = clamp(params.crop.x + dx, 0, right - MIN_CROP_SIZE);
  }

  let width = right - left;
  let height = bottom - top;

  if (params.crop.aspectRatio) {
    const aspectRatio = params.crop.aspectRatio;
    const centerX = params.crop.x + params.crop.width / 2;
    const centerY = params.crop.y + params.crop.height / 2;

    if (params.mode === "n" || params.mode === "s") {
      width = height * aspectRatio;
      const maxWidth = Math.min(centerX * 2, (1 - centerX) * 2, 1);

      if (width > maxWidth) {
        width = maxWidth;
        height = width / aspectRatio;
      }

      left = clamp(centerX - width / 2, 0, 1 - width);
      right = left + width;

      if (params.mode === "n") {
        top = bottom - height;
      } else {
        bottom = top + height;
      }
    } else if (params.mode === "e" || params.mode === "w") {
      height = width / aspectRatio;
      const maxHeight = Math.min(centerY * 2, (1 - centerY) * 2, 1);

      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
      }

      top = clamp(centerY - height / 2, 0, 1 - height);
      bottom = top + height;

      if (params.mode === "w") {
        left = right - width;
      } else {
        right = left + width;
      }
    } else {
      if (width / Math.max(height, 0.0001) > aspectRatio) {
        width = height * aspectRatio;
      } else {
        height = width / aspectRatio;
      }

      if (params.mode === "nw") {
        left = right - width;
        top = bottom - height;
      }
      if (params.mode === "ne") {
        top = bottom - height;
      }
      if (params.mode === "sw") {
        left = right - width;
      }
    }
  }

  return normalizeCrop({
    ...params.crop,
    x: left,
    y: top,
    width,
    height,
  });
}

export function averagePosition(
  nodes: Array<Pick<CanvasImageNode, "x" | "y" | "width" | "height">>,
) {
  if (nodes.length === 0) {
    return { x: 80, y: 80 };
  }

  return {
    x: nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length,
    y: nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length,
  };
}

export function sortCanvasOperationsByCreatedAt(
  left: Pick<CanvasOperation, "id" | "created_at">,
  right: Pick<CanvasOperation, "id" | "created_at">,
) {
  const createdAtDiff =
    new Date(left.created_at).getTime() - new Date(right.created_at).getTime();

  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return left.id.localeCompare(right.id);
}

export function getCanvasOperationRevisionLevel(params: {
  operation: Pick<CanvasOperation, "id" | "created_at" | "revision_of_operation_id">;
  operations: Array<
    Pick<CanvasOperation, "id" | "created_at" | "revision_of_operation_id">
  >;
}) {
  const allOperations = params.operations.some(
    (item) => item.id === params.operation.id,
  )
    ? params.operations
    : [...params.operations, params.operation];
  const operationsById = new Map(
    allOperations.map((operation) => [operation.id, operation]),
  );
  const memo = new Map<string, number>();

  const resolveRevisionLevel = (
    operation: Pick<
      CanvasOperation,
      "id" | "created_at" | "revision_of_operation_id"
    >,
  ): number => {
    const cached = memo.get(operation.id);
    if (typeof cached === "number") {
      return cached;
    }

    if (!operation.revision_of_operation_id) {
      memo.set(operation.id, 0);
      return 0;
    }

    const parentOperation = operationsById.get(operation.revision_of_operation_id);
    const siblings = allOperations
      .filter(
        (item) => item.revision_of_operation_id === operation.revision_of_operation_id,
      )
      .sort(sortCanvasOperationsByCreatedAt);
    const siblingIndex = Math.max(
      0,
      siblings.findIndex((item) => item.id === operation.id),
    );
    const level =
      (parentOperation ? resolveRevisionLevel(parentOperation) : 0) +
      siblingIndex +
      1;

    memo.set(operation.id, level);
    return level;
  };

  return resolveRevisionLevel(params.operation);
}

export function getCanvasRevisionBranchShiftY(params: {
  inputNodes: Array<Pick<CanvasImageNode, "height">>;
  revisionLevel: number;
}) {
  if (params.revisionLevel <= 0) {
    return 0;
  }

  const primaryHeight = params.inputNodes[0]?.height ?? DEFAULT_NODE_HEIGHT;
  return (
    params.revisionLevel *
    Math.max(primaryHeight + REVISION_BRANCH_GAP, GENERATED_NODE_Y_OFFSET)
  );
}

export function getGeneratedNodePositions(params: {
  count: number;
  inputNodes: Array<Pick<CanvasImageNode, "x" | "y" | "width" | "height">>;
  revisionLevel?: number;
}) {
  const pivot = averagePosition(params.inputNodes);
  const rightMost = params.inputNodes.reduce(
    (max, node) => Math.max(max, node.x + node.width),
    pivot.x,
  );
  const baseX = rightMost + GENERATED_NODE_X_OFFSET;
  const branchShiftY = getCanvasRevisionBranchShiftY({
    inputNodes: params.inputNodes,
    revisionLevel: params.revisionLevel ?? 0,
  });
  const startY = pivot.y - ((params.count - 1) * GENERATED_NODE_Y_OFFSET) / 2;

  return Array.from({ length: params.count }, (_, index) => ({
    x: baseX,
    y: startY + branchShiftY + index * GENERATED_NODE_Y_OFFSET,
  }));
}

export function getGeneratedNodeDimensions(
  inputNodes: Array<Pick<CanvasImageNode, "width" | "height">>,
) {
  return {
    width: inputNodes[0]?.width ?? DEFAULT_NODE_WIDTH,
    height: inputNodes[0]?.height ?? DEFAULT_NODE_HEIGHT,
  };
}

export function isPolylineShape(annotation: CanvasShapeAnnotation) {
  return annotation.kind === "line" || annotation.kind === "arrow";
}

export function getDefaultPolylinePoints(
  kind: CanvasShapeKind,
  width: number,
  height: number,
) {
  const clampedWidth = Math.max(width, 8);
  const clampedHeight = Math.max(height, 8);

  if (kind === "line" || kind === "arrow") {
    return [
      { x: 0, y: clampedHeight },
      { x: clampedWidth, y: 0 },
    ];
  }

  return [];
}

export function getShapePoints(annotation: CanvasShapeAnnotation) {
  if (annotation.points && annotation.points.length >= 2) {
    return annotation.points;
  }

  return getDefaultPolylinePoints(
    annotation.kind,
    annotation.width,
    annotation.height,
  );
}

export function normalizePolylinePoints(points: CanvasPoint[]) {
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));

  return {
    x: minX,
    y: minY,
    width: Math.max(8, maxX - minX),
    height: Math.max(8, maxY - minY),
    points: points.map((point) => ({
      x: point.x - minX,
      y: point.y - minY,
    })),
  };
}

export function scalePolylinePoints(
  points: CanvasPoint[],
  fromWidth: number,
  fromHeight: number,
  toWidth: number,
  toHeight: number,
) {
  const safeWidth = Math.max(fromWidth, 1);
  const safeHeight = Math.max(fromHeight, 1);

  return points.map((point) => ({
    x: (point.x / safeWidth) * toWidth,
    y: (point.y / safeHeight) * toHeight,
  }));
}

export function buildShapeAnnotationFromDrag(
  kind: CanvasShapeKind,
  start: CanvasPoint,
  current: CanvasPoint,
) {
  if (kind === "line" || kind === "arrow") {
    const normalized = normalizePolylinePoints([start, current]);
    return {
      id: createId("shape"),
      kind,
      x: normalized.x,
      y: normalized.y,
      width: normalized.width,
      height: normalized.height,
      strokeColor: DEFAULT_DRAW_COLOR,
      fillColor: "transparent",
      strokeWidth: 3,
      points: normalized.points,
    } satisfies CanvasShapeAnnotation;
  }

  const minX = Math.min(start.x, current.x);
  const minY = Math.min(start.y, current.y);
  const width = Math.max(8, Math.abs(current.x - start.x));
  const height = Math.max(8, Math.abs(current.y - start.y));

  return {
    id: createId("shape"),
    kind,
    x: minX,
    y: minY,
    width,
    height,
    strokeColor: DEFAULT_DRAW_COLOR,
    fillColor: "transparent",
    strokeWidth: 3,
  } satisfies CanvasShapeAnnotation;
}

export function isPlaceholderNode(
  node: CanvasImageNode | PendingCanvasImageNode,
): node is PendingCanvasImageNode {
  return "isPlaceholder" in node && node.isPlaceholder;
}

export function formatCanvasNodeLabel(index: number, template: string) {
  return template.replace("{index}", String(index).padStart(4, "0"));
}

export function buildOperationPosition(params: {
  operation: CanvasOperation;
  operations: Array<
    Pick<CanvasOperation, "id" | "created_at" | "revision_of_operation_id">
  >;
  imageNodeMap: Map<string, CanvasImageNode | PendingCanvasImageNode>;
  links: CanvasLink[];
}) {
  const storedPosition = getCanvasOperationStoredPosition(params.operation);
  if (storedPosition) {
    return storedPosition;
  }

  const inputNodes = params.links
    .filter(
      (link) =>
        link.target_kind === "operation" &&
        link.target_id === params.operation.id &&
        link.source_kind === "image",
    )
    .map((link) => params.imageNodeMap.get(link.source_id))
    .filter((node): node is CanvasImageNode | PendingCanvasImageNode => !!node);

  const outputNodes = params.links
    .filter(
      (link) =>
        link.source_kind === "operation" &&
        link.source_id === params.operation.id &&
        link.target_kind === "image",
    )
    .map((link) => params.imageNodeMap.get(link.target_id))
    .filter((node): node is CanvasImageNode | PendingCanvasImageNode => !!node);

  const inputCenter =
    inputNodes.length > 0
      ? {
          x:
            inputNodes.reduce((sum, node) => sum + node.x + node.width / 2, 0) /
            inputNodes.length,
          y:
            inputNodes.reduce(
              (sum, node) => sum + node.y + node.height / 2,
              0,
            ) / inputNodes.length,
        }
      : { x: 140, y: 140 };
  const revisionLevel = getCanvasOperationRevisionLevel({
    operation: params.operation,
    operations: params.operations,
  });
  const branchShiftY = getCanvasRevisionBranchShiftY({
    inputNodes,
    revisionLevel,
  });

  if (outputNodes.length === 0) {
    return {
      x: inputCenter.x + 160,
      y: inputCenter.y + 18 + branchShiftY,
    };
  }

  const outputCenter = {
    x:
      outputNodes.reduce((sum, node) => sum + node.x + node.width / 2, 0) /
      outputNodes.length,
    y:
      outputNodes.reduce((sum, node) => sum + node.y + node.height / 2, 0) /
      outputNodes.length,
  };

  return {
    x: (inputCenter.x + outputCenter.x) / 2,
    y: (inputCenter.y + outputCenter.y) / 2,
  };
}

export function downloadImage(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function getOverlayBox(
  node: CanvasFlowNode,
  viewport: Viewport,
  container: HTMLDivElement | null,
) {
  const rawWidth =
    node.width ??
    (typeof node.style?.width === "number"
      ? node.style.width
      : DEFAULT_NODE_WIDTH);
  const rawHeight =
    node.height ??
    (typeof node.style?.height === "number"
      ? node.style.height
      : DEFAULT_NODE_HEIGHT);

  const x = viewport.x + node.position.x * viewport.zoom;
  const y = viewport.y + node.position.y * viewport.zoom;
  const width = rawWidth * viewport.zoom;
  const height = rawHeight * viewport.zoom;
  const containerWidth = container?.clientWidth ?? 0;
  const containerHeight = container?.clientHeight ?? 0;

  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    toolbarTop: Math.max(88, y - 66),
    composerTop: clamp(
      y + height + 22,
      112,
      Math.max(112, containerHeight - 186),
    ),
    containerWidth,
    containerHeight,
  };
}

export function buildShapePoints(
  kind: CanvasShapeKind,
  width: number,
  height: number,
) {
  const w = Math.max(width, 24);
  const h = Math.max(height, 24);

  switch (kind) {
    case "polygon": {
      const padding = 6;
      return `${w / 2},${padding} ${w - padding},${h - padding} ${padding},${h - padding}`;
    }
    case "star": {
      const cx = w / 2;
      const cy = h / 2;
      const outer = Math.min(w, h) / 2 - 8;
      const inner = outer * 0.45;
      const points = Array.from({ length: 10 }, (_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI) / 5;
        const radius = index % 2 === 0 ? outer : inner;
        return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`;
      });
      return points.join(" ");
    }
    default:
      return "";
  }
}

export function buildStrokePath(points: CanvasPoint[]) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x} ${point.y}`;
  }

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    const previous = points[index - 1];
    const midX = (previous.x + point.x) / 2;
    const midY = (previous.y + point.y) / 2;
    return `${path} Q ${previous.x} ${previous.y} ${midX} ${midY}`;
  }, "");
}

function getAnnotationStorageKey(projectId: string) {
  return `${ANNOTATION_STORAGE_PREFIX}${projectId}`;
}

export function readCanvasAnnotations(projectId: string): CanvasAnnotationStorage {
  if (typeof window === "undefined") {
    return {
      texts: [],
      shapes: [],
      strokes: [],
      imagePresentations: {},
    };
  }

  try {
    const raw = window.localStorage.getItem(getAnnotationStorageKey(projectId));
    if (!raw) {
      return {
        texts: [],
        shapes: [],
        strokes: [],
        imagePresentations: {},
      };
    }

    const parsed = JSON.parse(raw) as {
      texts?: CanvasTextAnnotation[];
      shapes?: CanvasShapeAnnotation[];
      strokes?: CanvasStrokeAnnotation[];
      imagePresentations?: Record<string, CanvasImagePresentation>;
      notes?: Array<{
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
        text: string;
      }>;
    };

    return {
      texts:
        parsed.texts ??
        (parsed.notes ?? []).map((note) => ({
          ...note,
          ...DEFAULT_TEXT_STYLE,
        })),
      shapes: parsed.shapes ?? [],
      strokes: parsed.strokes ?? [],
      imagePresentations: parsed.imagePresentations ?? {},
    };
  } catch {
    return {
      texts: [],
      shapes: [],
      strokes: [],
      imagePresentations: {},
    };
  }
}

export function writeCanvasAnnotations(params: {
  projectId: string;
  annotations: CanvasAnnotationStorage;
}) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getAnnotationStorageKey(params.projectId),
    JSON.stringify(params.annotations),
  );
}

export function createPlaceholderBranch(params: {
  operation: CanvasOperation;
  operations: Array<
    Pick<CanvasOperation, "id" | "created_at" | "revision_of_operation_id">
  >;
  inputNodes: CanvasImageNode[];
  outputCount: number;
}) {
  const revisionLevel = getCanvasOperationRevisionLevel({
    operation: params.operation,
    operations: params.operations,
  });
  const positions = getGeneratedNodePositions({
    count: params.outputCount,
    inputNodes: params.inputNodes,
    revisionLevel,
  });
  const dimensions = getGeneratedNodeDimensions(params.inputNodes);

  return {
    operation: params.operation,
    inputNodeIds: params.inputNodes.map((node) => node.id),
    placeholderNodes: Array.from({ length: params.outputCount }, (_, index) => ({
      id: `pending-${params.operation.id}-${index}`,
      project_id: params.operation.project_id,
      image_url: "",
      origin_type: "generated" as const,
      source_generation_id: params.operation.generation_id,
      source_generation_image_index: index,
      x: positions[index]?.x ?? 0,
      y: positions[index]?.y ?? 0,
      width: dimensions.width,
      height: dimensions.height,
      prompt: params.operation.prompt,
      model: params.operation.model_id,
      size: "auto",
      created_at: params.operation.created_at,
      updated_at: params.operation.updated_at,
      isPlaceholder: true as const,
    })),
  } satisfies PendingCanvasBranch;
}

function getNodeRect(node: CanvasFlowNode) {
  const width =
    node.width ??
    (typeof node.style?.width === "number"
      ? node.style.width
      : DEFAULT_NODE_WIDTH);
  const height =
    node.height ??
    (typeof node.style?.height === "number"
      ? node.style.height
      : DEFAULT_NODE_HEIGHT);

  return {
    left: node.position.x,
    right: node.position.x + width,
    top: node.position.y,
    bottom: node.position.y + height,
    centerX: node.position.x + width / 2,
    centerY: node.position.y + height / 2,
    width,
    height,
  };
}

export function calculateAlignmentGuides(
  draggedNode: CanvasFlowNode,
  flowNodes: CanvasFlowNode[],
) {
  const guides: CanvasAlignmentGuide[] = [];
  const current = getNodeRect(draggedNode);
  let bestVertical: {
    diff: number;
    guide: CanvasAlignmentGuide;
  } | null = null;
  let bestHorizontal: {
    diff: number;
    guide: CanvasAlignmentGuide;
  } | null = null;

  for (const otherNode of flowNodes) {
    if (
      otherNode.id === draggedNode.id ||
      otherNode.id.startsWith("operation:") ||
      draggedNode.id.startsWith("operation:")
    ) {
      continue;
    }

    const other = getNodeRect(otherNode);
    const verticalChecks = [
      { current: current.left, other: other.left },
      { current: current.centerX, other: other.centerX },
      { current: current.right, other: other.right },
    ];
    const horizontalChecks = [
      { current: current.top, other: other.top },
      { current: current.centerY, other: other.centerY },
      { current: current.bottom, other: other.bottom },
    ];

    for (const check of verticalChecks) {
      const diff = Math.abs(check.current - check.other);
      if (diff <= ALIGNMENT_THRESHOLD) {
        const guide = {
          orientation: "vertical" as const,
          value: check.other,
          start: Math.min(current.top, other.top) - 48,
          end: Math.max(current.bottom, other.bottom) + 48,
        };

        if (!bestVertical || diff < bestVertical.diff) {
          bestVertical = { diff, guide };
        }
      }
    }

    for (const check of horizontalChecks) {
      const diff = Math.abs(check.current - check.other);
      if (diff <= ALIGNMENT_THRESHOLD) {
        const guide = {
          orientation: "horizontal" as const,
          value: check.other,
          start: Math.min(current.left, other.left) - 48,
          end: Math.max(current.right, other.right) + 48,
        };

        if (!bestHorizontal || diff < bestHorizontal.diff) {
          bestHorizontal = { diff, guide };
        }
      }
    }
  }

  if (bestVertical) {
    guides.push(bestVertical.guide);
  }
  if (bestHorizontal) {
    guides.push(bestHorizontal.guide);
  }

  return guides;
}

export function updateAnnotationDimensions<T extends { id: string }>(
  items: T[],
  id: string,
  patch: Partial<T>,
) {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function removeGenerationImagesFromList<
  T extends {
    id: string;
    result_urls: string[] | null;
  },
>(
  items: T[],
  targets: Array<{
    generationId: string;
    imageIndex: number;
  }>,
) {
  const targetMap = new Map<string, Set<number>>();
  for (const target of targets) {
    if (!targetMap.has(target.generationId)) {
      targetMap.set(target.generationId, new Set());
    }
    targetMap.get(target.generationId)?.add(target.imageIndex);
  }

  return items.flatMap((item) => {
    const indexes = targetMap.get(item.id);
    if (!indexes) {
      return [item];
    }

    const nextUrls = (item.result_urls ?? []).filter(
      (_, index) => !indexes.has(index),
    );
    if (nextUrls.length === 0) {
      return [];
    }

    return [
      {
        ...item,
        result_urls: nextUrls,
      },
    ];
  });
}
