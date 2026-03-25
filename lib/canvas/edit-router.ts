import {
  getCanvasActionDefinition,
  type CanvasActionType,
  type CanvasEngine,
} from "@/lib/canvas/actions";

export type CanvasOperationParams = {
  outputCount?: number;
  size?: string;
  mode?: "balanced" | "precise";
  notes?: string;
  expandScale?: number;
};

export type ResolvedCanvasEditRequest = {
  actionType: CanvasActionType;
  engine: CanvasEngine;
  modelId: string;
  prompt: string;
  imageUrls: string[];
  outputCount: number;
  size?: string;
  params: CanvasOperationParams;
};

export const DEFAULT_CANVAS_QWEN_MODEL_ID =
  process.env.CANVAS_QWEN_IMAGE_MODEL_ID || "qwen-image-edit";

export const DEFAULT_CANVAS_WAN_MODEL_ID =
  process.env.CANVAS_WAN_IMAGE_MODEL_ID || "wan2.5-image-to-image";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizePrompt({
  actionType,
  prompt,
}: {
  actionType: CanvasActionType;
  prompt: string;
}) {
  const trimmedPrompt = prompt.trim();

  switch (actionType) {
    case "remove_bg":
      return (
        trimmedPrompt ||
        "Remove the background and keep the main subject cleanly isolated with a fully transparent alpha background, not a white or solid-color fill."
      );
    case "extract_subject":
      return trimmedPrompt || "Extract the main subject and simplify the background.";
    case "remove_watermark":
      return trimmedPrompt || "Remove unwanted watermark or text while preserving the original image.";
    case "detect":
      return trimmedPrompt || "Detect the requested subject or object in the image.";
    case "segment":
      return trimmedPrompt || "Segment and isolate the requested subject in the image.";
    default:
      return trimmedPrompt;
  }
}

export function resolveCanvasEditRequest(input: {
  actionType: CanvasActionType;
  prompt: string;
  imageUrls: string[];
  requestedEngine?: CanvasEngine | null;
  outputCount?: number | null;
  size?: string | null;
  params?: CanvasOperationParams | null;
}): ResolvedCanvasEditRequest {
  const definition = getCanvasActionDefinition(input.actionType);
  const requestedEngine = input.requestedEngine ?? definition.defaultEngine;
  const engine = definition.allowedEngines.includes(requestedEngine)
    ? requestedEngine
    : definition.defaultEngine;
  const imageUrls = input.imageUrls.filter(isNonEmptyString).slice(
    0,
    definition.maxInputs,
  );

  if (imageUrls.length < definition.minInputs) {
    throw new Error("canvas_reference_images_required");
  }

  const outputCount = Math.min(
    Math.max(input.outputCount ?? definition.defaultOutputs, 1),
    engine === "qwen" ? 1 : definition.maxOutputs,
  );

  const prompt = normalizePrompt({
    actionType: input.actionType,
    prompt: input.prompt,
  });
  const expandScale =
    typeof input.params?.expandScale === "number" && input.params.expandScale > 1
      ? input.params.expandScale
      : 1.5;
  const resolvedPrompt =
    input.actionType === "expand"
      ? [
          prompt,
          `Keep the original image centered and expand the canvas to ${expandScale}x the original size.`,
          "Keep the original aspect ratio for the expanded frame.",
        ]
          .filter((segment) => segment.trim().length > 0)
          .join(" ")
      : prompt;
  const resolvedSize =
    input.actionType === "expand" ? undefined : input.size ?? undefined;

  if (!resolvedPrompt) {
    throw new Error("canvas_prompt_required");
  }

  return {
    actionType: input.actionType,
    engine,
    modelId:
      engine === "qwen"
        ? DEFAULT_CANVAS_QWEN_MODEL_ID
        : DEFAULT_CANVAS_WAN_MODEL_ID,
    prompt: resolvedPrompt,
    imageUrls,
    outputCount,
    size: resolvedSize,
    params: input.params ?? {},
  };
}
