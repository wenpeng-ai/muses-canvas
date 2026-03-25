import {
  getEffectiveDefaultProviderModelValue,
  normalizeEditableProviderSettings,
  normalizeProviderSettings,
  type ProviderSettings,
} from "@/lib/provider-settings";
import {
  persistGeneratedImages,
  persistGeneratedVideos,
} from "@/lib/server/provider-local-media";
import { loadProviderSettings } from "@/lib/server/local-canvas-store";
import {
  runImageWithProvider,
  runTextWithProvider,
  runVideoWithProvider,
} from "@/lib/server/provider-runner";
import {
  errorResponse,
  getErrorMessage,
  jsonResponse,
  readJsonBody,
} from "@/lib/server/route-utils";

type ProviderRunRequestBase = {
  settings?: Partial<ProviderSettings>;
};

type TextRunRequest = ProviderRunRequestBase & {
  kind: "text";
  model: string;
  instruction: string;
  sourceText: string;
};

type ImageRunRequest = ProviderRunRequestBase & {
  kind: "image";
  model: string;
  prompt: string;
  promptTexts?: string[];
  imageUrls?: string[];
  aspectRatio?: string;
};

type VideoRunRequest = ProviderRunRequestBase & {
  kind: "video";
  model: string;
  prompt: string;
  promptTexts?: string[];
  imageUrls?: string[];
  aspectRatio?: string;
  durationSeconds?: number;
};

function resolveRunSettings(value: unknown) {
  if (!value || typeof value !== "object" || !("settings" in value)) {
    return null;
  }

  return normalizeEditableProviderSettings(
    (value as ProviderRunRequestBase).settings,
  );
}

function isTextRunRequest(value: unknown): value is TextRunRequest {
  return (
    !!value &&
    typeof value === "object" &&
    "kind" in value &&
    value.kind === "text" &&
    "instruction" in value &&
    typeof value.instruction === "string" &&
    "sourceText" in value &&
    typeof value.sourceText === "string" &&
    "model" in value &&
    typeof value.model === "string"
  );
}

function isImageRunRequest(value: unknown): value is ImageRunRequest {
  return (
    !!value &&
    typeof value === "object" &&
    "kind" in value &&
    value.kind === "image" &&
    "prompt" in value &&
    typeof value.prompt === "string" &&
    "model" in value &&
    typeof value.model === "string"
  );
}

function isVideoRunRequest(value: unknown): value is VideoRunRequest {
  return (
    !!value &&
    typeof value === "object" &&
    "kind" in value &&
    value.kind === "video" &&
    "prompt" in value &&
    typeof value.prompt === "string" &&
    "model" in value &&
    typeof value.model === "string"
  );
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<unknown>(request, {});
    const requestSettings = resolveRunSettings(body);
    const settings =
      requestSettings ??
      normalizeProviderSettings(await loadProviderSettings());
    const defaultTextModel = getEffectiveDefaultProviderModelValue("text", settings, {
      configuredOnly: true,
    });
    const defaultImageModel = getEffectiveDefaultProviderModelValue("image", settings, {
      configuredOnly: true,
    });
    const defaultVideoModel = getEffectiveDefaultProviderModelValue("video", settings, {
      configuredOnly: true,
    });

    if (isTextRunRequest(body)) {
      if (!body.model && !defaultTextModel) {
        throw new Error("No configured text model is available.");
      }

      const result = await runTextWithProvider({
        settings,
        model: body.model || defaultTextModel,
        instruction: body.instruction,
        sourceText: body.sourceText,
      });

      return jsonResponse({
        text: result.text,
      });
    }

    if (isImageRunRequest(body)) {
      if (!body.model && !defaultImageModel) {
        throw new Error("No configured image model is available.");
      }

      const promptTexts = Array.isArray(body.promptTexts)
        ? body.promptTexts.filter((value): value is string => typeof value === "string")
        : [];
      const imageUrls = Array.isArray(body.imageUrls)
        ? body.imageUrls.filter((value): value is string => typeof value === "string")
        : [];

      const result = await runImageWithProvider({
        settings,
        model: body.model || defaultImageModel,
        prompt: body.prompt,
        promptTexts,
        imageUrls,
        aspectRatio: body.aspectRatio || settings.defaults.imageAspectRatio,
      });
      const persisted = await persistGeneratedImages({
        model: body.model || defaultImageModel,
        prompt: body.prompt,
        images: result.images,
        referenceImages: imageUrls,
      });

      return jsonResponse({
        imageUrls: persisted.imageUrls,
        generationId: persisted.generation.id,
        omittedImageCount: result.omittedImageCount,
        responseText: result.text,
      });
    }

    if (isVideoRunRequest(body)) {
      if (!body.model && !defaultVideoModel) {
        throw new Error("No configured video model is available.");
      }

      const promptTexts = Array.isArray(body.promptTexts)
        ? body.promptTexts.filter((value): value is string => typeof value === "string")
        : [];
      const imageUrls = Array.isArray(body.imageUrls)
        ? body.imageUrls.filter((value): value is string => typeof value === "string")
        : [];

      const result = await runVideoWithProvider({
        settings,
        model: body.model || defaultVideoModel,
        prompt: body.prompt,
        promptTexts,
        imageUrls,
        aspectRatio: body.aspectRatio || "16:9",
        durationSeconds:
          typeof body.durationSeconds === "number" ? body.durationSeconds : 4,
      });
      const persisted = await persistGeneratedVideos({
        model: body.model || defaultVideoModel,
        prompt: body.prompt,
        videos: result.videos,
        referenceImages: imageUrls,
      });

      return jsonResponse({
        videoUrls: persisted.videoUrls,
        generationId: persisted.generation.id,
        omittedImageCount: result.omittedImageCount,
      });
    }

    return errorResponse("Unsupported provider run request.");
  } catch (error) {
    const errorCode =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: unknown }).code
        : null;

    return errorResponse(getErrorMessage(error, "Provider request failed."), {
      extras: typeof errorCode === "string" ? { code: errorCode } : undefined,
    });
  }
}
