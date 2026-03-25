import path from "node:path";
import { getGoogleImageInputLimit } from "@/lib/provider-settings";
import { readMediaFile } from "@/lib/server/local-canvas-store";

type GoogleProviderConfig = {
  apiKey: string;
  baseUrl: string;
};

type GoogleGenerateContentRequest = {
  config: GoogleProviderConfig;
  model: string;
  parts: Array<
    | { text: string }
    | {
        inline_data: {
          mime_type: string;
          data: string;
        };
      }
  >;
  generationConfig?: Record<string, unknown>;
};

type GoogleInlineImage = {
  buffer: Buffer<ArrayBufferLike>;
  mimeType: string;
};

type GoogleGenerateTextParams = {
  config: GoogleProviderConfig;
  model: string;
  instruction: string;
  sourceText: string;
};

type GoogleGenerateImageParams = {
  config: GoogleProviderConfig;
  model: string;
  prompt: string;
  promptTexts: string[];
  imageUrls: string[];
  aspectRatio: string;
};

type GoogleGenerateVideoParams = {
  config: GoogleProviderConfig;
  model: string;
  prompt: string;
  promptTexts: string[];
  imageUrl: string;
  referenceImageUrls?: string[];
  aspectRatio: string;
  durationSeconds: number;
};

type GoogleInlineVideo = {
  buffer: Buffer<ArrayBufferLike>;
  mimeType: string;
};

const GOOGLE_GENERATE_CONTENT_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";
const LOCAL_MEDIA_PREFIX = "/api/media/";
const GOOGLE_VIDEO_POLL_INTERVAL_MS = 10_000;
const GOOGLE_VIDEO_POLL_MAX_ATTEMPTS = 48;

function getContentTypeFromExtension(fileName: string) {
  const extension = path.extname(fileName).replace(".", "").toLowerCase();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "png":
    default:
      return "image/png";
  }
}

function getLocalMediaFileName(imageUrl: string) {
  return imageUrl.startsWith(LOCAL_MEDIA_PREFIX)
    ? imageUrl.slice(LOCAL_MEDIA_PREFIX.length)
    : null;
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const error =
    record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>)
      : null;

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message;
  }

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }

  return fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readImageUrl(imageUrl: string) {
  if (imageUrl.startsWith("data:")) {
    const [meta, encoded] = imageUrl.split(",", 2);
    const mimeType =
      meta.match(/^data:(.*?);base64$/)?.[1]?.trim() || "image/png";

    return {
      buffer: Buffer.from(encoded ?? "", "base64"),
      mimeType,
    } satisfies GoogleInlineImage;
  }

  const localMediaFile = getLocalMediaFileName(imageUrl);
  if (localMediaFile) {
    return {
      buffer: await readMediaFile(localMediaFile),
      mimeType: getContentTypeFromExtension(localMediaFile),
    } satisfies GoogleInlineImage;
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to load image input: ${response.status}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: response.headers.get("content-type") || "image/png",
  } satisfies GoogleInlineImage;
}

async function buildInlineImageParts(imageUrls: string[]) {
  const images = await Promise.all(imageUrls.map((url) => readImageUrl(url)));

  return images.map((image) => ({
    inline_data: {
      mime_type: image.mimeType,
      data: image.buffer.toString("base64"),
    },
  }));
}

function normalizeGoogleApiBase(configuredBaseUrl: string) {
  const normalized =
    configuredBaseUrl.trim().replace(/\/+$/, "") || GOOGLE_GENERATE_CONTENT_URL;

  if (normalized.endsWith("/models")) {
    return {
      apiBaseUrl: normalized.slice(0, -"/models".length),
      modelsBaseUrl: normalized,
    };
  }

  if (normalized.includes("/models/")) {
    const [apiBaseUrl] = normalized.split("/models/", 1);
    return {
      apiBaseUrl,
      modelsBaseUrl: `${apiBaseUrl}/models`,
    };
  }

  return {
    apiBaseUrl: normalized,
    modelsBaseUrl: `${normalized}/models`,
  };
}

async function callGoogleGenerateContent(params: GoogleGenerateContentRequest) {
  if (!params.config.apiKey.trim()) {
    throw new Error("Google API key is missing.");
  }

  const { modelsBaseUrl } = normalizeGoogleApiBase(params.config.baseUrl);
  const response = await fetch(
    `${modelsBaseUrl}/${encodeURIComponent(params.model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": params.config.apiKey.trim(),
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: params.parts,
          },
        ],
        ...(params.generationConfig
          ? { generationConfig: params.generationConfig }
          : {}),
      }),
    },
  );

  const rawText = await response.text();
  const payload = parseJson(rawText);

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(
        payload,
        `Google provider request failed with status ${response.status}.`,
      ),
    );
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Google provider returned an invalid response.");
  }

  return payload as Record<string, unknown>;
}

function extractCandidateParts(payload: Record<string, unknown>) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const firstCandidate = candidates[0];

  if (!firstCandidate || typeof firstCandidate !== "object") {
    return [];
  }

  const content =
    "content" in firstCandidate &&
    firstCandidate.content &&
    typeof firstCandidate.content === "object"
      ? (firstCandidate.content as Record<string, unknown>)
      : null;

  return Array.isArray(content?.parts) ? content.parts : [];
}

function extractTextFromPayload(payload: Record<string, unknown>) {
  return extractCandidateParts(payload)
    .map((part) => {
      if (!part || typeof part !== "object") {
        return "";
      }

      const record = part as Record<string, unknown>;
      return typeof record.text === "string" ? record.text : "";
    })
    .filter((text) => text.trim().length > 0)
    .join("\n")
    .trim();
}

function extractImagesFromPayload(payload: Record<string, unknown>) {
  const parts = extractCandidateParts(payload);
  const images: GoogleInlineImage[] = [];

  for (const part of parts) {
    if (!part || typeof part !== "object") {
      continue;
    }

    const record = part as Record<string, unknown>;
    const inlineData =
      (record.inlineData && typeof record.inlineData === "object"
        ? (record.inlineData as Record<string, unknown>)
        : null) ||
      (record.inline_data && typeof record.inline_data === "object"
        ? (record.inline_data as Record<string, unknown>)
        : null) ||
      null;

    if (!inlineData) {
      continue;
    }

    const data = typeof inlineData.data === "string" ? inlineData.data : null;
    const mimeType =
      (typeof inlineData.mimeType === "string" ? inlineData.mimeType : null) ||
      (typeof inlineData.mime_type === "string" ? inlineData.mime_type : null) ||
      "image/png";

    if (!data) {
      continue;
    }

    images.push({
      buffer: Buffer.from(data, "base64"),
      mimeType,
    });
  }

  return images;
}

function buildVideoPrompt(params: {
  prompt: string;
  promptTexts: string[];
}) {
  return [
    params.promptTexts.length > 0
      ? `Additional prompt context:\n${params.promptTexts
          .map((text, index) => `${index + 1}. ${text.trim()}`)
          .join("\n")}`
      : null,
    params.prompt.trim()
      ? `Primary instruction:\n${params.prompt.trim()}`
      : "Primary instruction:\nAnimate the provided image into a short cinematic video.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function callGoogleGenerateVideoOperation(params: GoogleGenerateVideoParams) {
  if (!params.config.apiKey.trim()) {
    throw new Error("Google API key is missing.");
  }

  const { modelsBaseUrl } = normalizeGoogleApiBase(params.config.baseUrl);
  const image = await readImageUrl(params.imageUrl);
  const referenceImages = await Promise.all(
    (params.referenceImageUrls ?? []).map(async (imageUrl) => {
      const referenceImage = await readImageUrl(imageUrl);

      return {
        image: {
          inlineData: {
            mimeType: referenceImage.mimeType,
            data: referenceImage.buffer.toString("base64"),
          },
        },
        referenceType: "asset",
      };
    }),
  );
  const response = await fetch(
    `${modelsBaseUrl}/${encodeURIComponent(params.model)}:predictLongRunning`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": params.config.apiKey.trim(),
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: buildVideoPrompt({
              prompt: params.prompt,
              promptTexts: params.promptTexts,
            }),
            image: {
              inlineData: {
                mimeType: image.mimeType,
                data: image.buffer.toString("base64"),
              },
            },
            ...(referenceImages.length > 0
              ? { referenceImages }
              : {}),
          },
        ],
        parameters: {
          aspectRatio: params.aspectRatio,
          durationSeconds: params.durationSeconds,
          personGeneration: "allow_adult",
        },
      }),
    },
  );

  const rawText = await response.text();
  const payload = parseJson(rawText);

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(
        payload,
        `Google video request failed with status ${response.status}.`,
      ),
    );
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Google video request returned an invalid response.");
  }

  return payload as Record<string, unknown>;
}

function extractOperationName(payload: Record<string, unknown>) {
  return typeof payload.name === "string" && payload.name.trim()
    ? payload.name
    : "";
}

function extractVideoUri(payload: Record<string, unknown>) {
  const response =
    payload.response && typeof payload.response === "object"
      ? (payload.response as Record<string, unknown>)
      : null;
  const generatedVideos = Array.isArray(response?.generatedVideos)
    ? response.generatedVideos
    : [];
  const firstGeneratedVideo =
    generatedVideos[0] && typeof generatedVideos[0] === "object"
      ? (generatedVideos[0] as Record<string, unknown>)
      : null;
  const directVideo =
    firstGeneratedVideo?.video && typeof firstGeneratedVideo.video === "object"
      ? (firstGeneratedVideo.video as Record<string, unknown>)
      : null;

  if (typeof directVideo?.uri === "string" && directVideo.uri.trim()) {
    return directVideo.uri;
  }

  if (
    typeof directVideo?.downloadUri === "string" &&
    directVideo.downloadUri.trim()
  ) {
    return directVideo.downloadUri;
  }

  const generateVideoResponse =
    response?.generateVideoResponse &&
    typeof response.generateVideoResponse === "object"
      ? (response.generateVideoResponse as Record<string, unknown>)
      : null;
  const generatedSamples = Array.isArray(generateVideoResponse?.generatedSamples)
    ? generateVideoResponse.generatedSamples
    : [];
  const firstSample =
    generatedSamples[0] && typeof generatedSamples[0] === "object"
      ? (generatedSamples[0] as Record<string, unknown>)
      : null;
  const video =
    firstSample?.video && typeof firstSample.video === "object"
      ? (firstSample.video as Record<string, unknown>)
      : null;

  if (typeof video?.uri === "string" && video.uri.trim()) {
    return video.uri;
  }

  if (typeof video?.downloadUri === "string" && video.downloadUri.trim()) {
    return video.downloadUri;
  }

  return "";
}

async function pollGoogleVideoOperation(params: {
  config: GoogleProviderConfig;
  operationName: string;
}) {
  const { apiBaseUrl } = normalizeGoogleApiBase(params.config.baseUrl);
  let lastPayload: Record<string, unknown> | null = null;

  for (let attempt = 0; attempt < GOOGLE_VIDEO_POLL_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await sleep(GOOGLE_VIDEO_POLL_INTERVAL_MS);
    }

    const response = await fetch(
      `${apiBaseUrl}/${params.operationName.replace(/^\/+/, "")}`,
      {
        method: "GET",
        headers: {
          "x-goog-api-key": params.config.apiKey.trim(),
        },
      },
    );
    const rawText = await response.text();
    const payload = parseJson(rawText);

    if (!response.ok) {
      throw new Error(
        extractErrorMessage(
          payload,
          `Google video operation lookup failed with status ${response.status}.`,
        ),
      );
    }

    if (!payload || typeof payload !== "object") {
      throw new Error("Google video operation lookup returned an invalid response.");
    }

    lastPayload = payload as Record<string, unknown>;

    if (lastPayload.error) {
      throw new Error(
        extractErrorMessage(lastPayload, "Google video generation failed."),
      );
    }

    if (lastPayload.done === true) {
      return lastPayload;
    }
  }

  throw new Error(
    "Google video generation is still processing. Please try again in a moment.",
  );
}

async function downloadGoogleVideo(params: {
  config: GoogleProviderConfig;
  videoUri: string;
}) {
  const response = await fetch(params.videoUri, {
    method: "GET",
    headers: {
      "x-goog-api-key": params.config.apiKey.trim(),
    },
  });

  if (!response.ok) {
    const rawText = await response.text();
    throw new Error(
      extractErrorMessage(
        parseJson(rawText),
        `Google video download failed with status ${response.status}.`,
      ),
    );
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: response.headers.get("content-type") || "video/mp4",
  } satisfies GoogleInlineVideo;
}

export async function generateTextWithGoogle(params: GoogleGenerateTextParams) {
  const payload = await callGoogleGenerateContent({
    config: params.config,
    model: params.model,
    parts: [
      {
        text: [
          "You are rewriting a canvas text node.",
          "Return only the final revised text with no commentary.",
          "",
          "Current text:",
          params.sourceText.trim() || "(empty)",
          "",
          "Rewrite instruction:",
          params.instruction.trim(),
        ].join("\n"),
      },
    ],
  });

  const text = extractTextFromPayload(payload);
  if (!text) {
    throw new Error("Google provider returned no text.");
  }

  return {
    text,
  };
}

export async function generateImagesWithGoogle(params: GoogleGenerateImageParams) {
  const maxInputs = getGoogleImageInputLimit(params.model);
  const uniqueImageUrls = Array.from(
    new Set(params.imageUrls.map((value) => value.trim()).filter(Boolean)),
  );
  const usedImageUrls = uniqueImageUrls.slice(0, maxInputs);
  const omittedImageCount = Math.max(0, uniqueImageUrls.length - usedImageUrls.length);
  const inlineImageParts = await buildInlineImageParts(usedImageUrls);
  const instruction = [
    "Create or edit an image for a node on an infinite canvas.",
    params.promptTexts.length > 0
      ? `Additional prompt context:\n${params.promptTexts
          .map((text, index) => `${index + 1}. ${text.trim()}`)
          .join("\n")}`
      : null,
    params.prompt.trim()
      ? `Primary instruction:\n${params.prompt.trim()}`
      : "Primary instruction:\nUse the connected images as the full design context.",
    inlineImageParts.length > 0
      ? "Use every provided image as reference context."
      : "No reference image is attached, so generate from text only.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const payload = await callGoogleGenerateContent({
    config: params.config,
    model: params.model,
    parts: [{ text: instruction }, ...inlineImageParts],
    generationConfig: {
      imageConfig: {
        aspectRatio: params.aspectRatio,
      },
    },
  });

  const images = extractImagesFromPayload(payload);
  if (images.length === 0) {
    throw new Error("Google provider returned no images.");
  }

  return {
    images,
    text: extractTextFromPayload(payload),
    usedImageCount: usedImageUrls.length,
    omittedImageCount,
  };
}

export async function generateVideoWithGoogle(params: GoogleGenerateVideoParams) {
  const uniqueReferenceImageUrls = Array.from(
    new Set(
      (params.referenceImageUrls ?? [])
        .map((value) => value.trim())
        .filter((value) => value.length > 0 && value !== params.imageUrl.trim()),
    ),
  );
  const supportsReferenceImages = params.model.startsWith("veo-3.1");
  const usedReferenceImageUrls = supportsReferenceImages
    ? uniqueReferenceImageUrls.slice(0, 3)
    : [];
  const effectiveDurationSeconds =
    usedReferenceImageUrls.length > 0 ? 8 : params.durationSeconds;
  const omittedReferenceImageCount = Math.max(
    0,
    uniqueReferenceImageUrls.length - usedReferenceImageUrls.length,
  );
  const operation = await callGoogleGenerateVideoOperation({
    ...params,
    durationSeconds: effectiveDurationSeconds,
    referenceImageUrls: usedReferenceImageUrls,
  });
  const operationName = extractOperationName(operation);

  if (!operationName) {
    throw new Error("Google video generation did not return an operation id.");
  }

  const finalOperation = await pollGoogleVideoOperation({
    config: params.config,
    operationName,
  });
  const videoUri = extractVideoUri(finalOperation);

  if (!videoUri) {
    throw new Error("Google video generation returned no downloadable video.");
  }

  return {
    video: await downloadGoogleVideo({
      config: params.config,
      videoUri,
    }),
    omittedReferenceImageCount,
  };
}
