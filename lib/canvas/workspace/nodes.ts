import type { HandleType } from "@xyflow/react";
import { DEFAULT_PROVIDER_SETTINGS } from "@/lib/provider-settings";
import type {
  CanvasImageNode,
  CanvasNodeKind,
  CanvasTextNode,
  CanvasVideoNode,
} from "@/lib/supabase/types";

function createCanvasNodeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export const DEFAULT_TEXT_NODE_TITLE = "Untitled text";
export const DEFAULT_TEXT_NODE_WIDTH = 200;
export const DEFAULT_TEXT_NODE_HEIGHT = 200;
export const DEFAULT_IMAGE_NODE_WIDTH = DEFAULT_TEXT_NODE_WIDTH;
export const DEFAULT_IMAGE_NODE_HEIGHT = Math.round(
  (DEFAULT_IMAGE_NODE_WIDTH * 16) / 9,
);
export const DEFAULT_VIDEO_NODE_WIDTH = 384;
export const DEFAULT_VIDEO_NODE_HEIGHT = 216;
export const DEFAULT_TEXT_NODE_MODEL = DEFAULT_PROVIDER_SETTINGS.defaults.textModel;
export const DEFAULT_IMAGE_NODE_MODEL = DEFAULT_PROVIDER_SETTINGS.defaults.imageModel;
export const DEFAULT_VIDEO_NODE_MODEL = DEFAULT_PROVIDER_SETTINGS.defaults.videoModel;

export function getCompactCanvasImageDimensions(width: number, height: number) {
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

export function getDerivedTextNodeSummary(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  if (normalized.length <= 96) {
    return normalized;
  }

  return `${normalized.slice(0, 93).trimEnd()}...`;
}

export function deriveTextNodeTitle(content: string) {
  const summary = getDerivedTextNodeSummary(content);
  return summary || DEFAULT_TEXT_NODE_TITLE;
}

export function shouldAutoUpdateTextNodeTitle(title: string, content: string) {
  const trimmedTitle = title.trim();

  if (trimmedTitle.length === 0 || trimmedTitle === DEFAULT_TEXT_NODE_TITLE) {
    return true;
  }

  const currentSummary = getDerivedTextNodeSummary(content);
  return currentSummary.length > 0 && trimmedTitle === currentSummary;
}

export function buildDefaultTextNode(
  projectId: string,
  position: { x: number; y: number },
  model = DEFAULT_TEXT_NODE_MODEL,
) {
  const now = new Date().toISOString();

  return {
    id: createCanvasNodeId("text"),
    project_id: projectId,
    x: position.x,
    y: position.y,
    width: DEFAULT_TEXT_NODE_WIDTH,
    height: DEFAULT_TEXT_NODE_HEIGHT,
    title: DEFAULT_TEXT_NODE_TITLE,
    content: "",
    model,
    color: "#111111",
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 14,
    align: "left" as const,
    created_at: now,
    updated_at: now,
  } satisfies CanvasTextNode;
}

export function buildDefaultImageNode(
  projectId: string,
  position: { x: number; y: number },
  model = DEFAULT_IMAGE_NODE_MODEL,
) {
  const now = new Date().toISOString();

  return {
    id: createCanvasNodeId("image"),
    project_id: projectId,
    image_url: "",
    origin_type: "draft" as const,
    source_generation_id: null,
    source_generation_image_index: null,
    x: position.x,
    y: position.y,
    width: DEFAULT_IMAGE_NODE_WIDTH,
    height: DEFAULT_IMAGE_NODE_HEIGHT,
    prompt: "",
    model,
    size: "9:16",
    created_at: now,
    updated_at: now,
  } satisfies CanvasImageNode;
}

export function buildDefaultVideoNode(
  projectId: string,
  position: { x: number; y: number },
  model = DEFAULT_VIDEO_NODE_MODEL,
) {
  const now = new Date().toISOString();

  return {
    id: createCanvasNodeId("video"),
    project_id: projectId,
    x: position.x,
    y: position.y,
    width: DEFAULT_VIDEO_NODE_WIDTH,
    height: DEFAULT_VIDEO_NODE_HEIGHT,
    title: "Video Node",
    prompt: "",
    model,
    size: "16:9",
    trimStartSeconds: 0,
    durationSeconds: 4,
    motionStrength: 50,
    status: "idle" as const,
    posterUrl: null,
    videoUrl: null,
    created_at: now,
    updated_at: now,
  } satisfies CanvasVideoNode;
}

export function getDefaultNodeDimensions(kind: CanvasNodeKind) {
  switch (kind) {
    case "text":
      return {
        width: DEFAULT_TEXT_NODE_WIDTH,
        height: DEFAULT_TEXT_NODE_HEIGHT,
      };
    case "image":
      return {
        width: DEFAULT_IMAGE_NODE_WIDTH,
        height: DEFAULT_IMAGE_NODE_HEIGHT,
      };
    case "video":
      return {
        width: DEFAULT_VIDEO_NODE_WIDTH,
        height: DEFAULT_VIDEO_NODE_HEIGHT,
      };
  }
}

export function getNodePlacementForConnection(
  kind: CanvasNodeKind,
  anchor: { x: number; y: number },
  sourceHandleType: HandleType,
) {
  const { width, height } = getDefaultNodeDimensions(kind);
  const handleCenterOffset = 3.5;

  return {
    x:
      sourceHandleType === "target"
        ? anchor.x - width - handleCenterOffset
        : anchor.x + handleCenterOffset,
    y: anchor.y - height / 2,
  };
}
