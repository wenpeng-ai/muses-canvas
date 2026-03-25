import path from "node:path";
import {
  getProviderDefinition,
  getProviderPlatformConfig,
  getProviderPlatformDisplayName,
  isProviderModelEnabled,
  providerSupportsInlineVideoImageInput,
  providerCanRunKind,
  resolveProviderModelSelection,
  type ProviderModelKind,
  type ProviderRuntimeKind,
  type ProviderSettings,
} from "@/lib/provider-settings";
import { VIDEO_IMAGE_INPUT_URL_REQUIRED_ERROR } from "@/lib/provider-runtime-errors";
import { readMediaFile } from "@/lib/server/local-canvas-store";
import {
  generateImagesWithGoogle,
  generateTextWithGoogle,
  generateVideoWithGoogle,
} from "@/lib/server/google-provider";

type PersistableImage = {
  buffer: Buffer<ArrayBufferLike>;
  mimeType: string;
};

type RunTextParams = {
  settings: ProviderSettings;
  model: string;
  instruction: string;
  sourceText: string;
};

type RunImageParams = {
  settings: ProviderSettings;
  model: string;
  prompt: string;
  promptTexts: string[];
  imageUrls: string[];
  aspectRatio: string;
};

type RunVideoParams = {
  settings: ProviderSettings;
  model: string;
  prompt: string;
  promptTexts: string[];
  imageUrls: string[];
  durationSeconds: number;
  aspectRatio: string;
};

type ImageRunResult = {
  images: PersistableImage[];
  text: string;
  omittedImageCount: number;
};

type PersistableVideo = {
  buffer: Buffer<ArrayBufferLike>;
  mimeType: string;
};

type VideoRunResult = {
  videos: PersistableVideo[];
  omittedImageCount: number;
};

type TestProviderModelParams = {
  settings: ProviderSettings;
  model: string;
  kind: ProviderModelKind;
};

type TestProviderModelResult = {
  message: string;
  mode: "runtime" | "probe";
};

type OpenAICompatibleMessage =
  | {
      role: "system" | "user" | "assistant";
      content: string;
    }
  | {
      role: "system" | "user" | "assistant";
      content: Array<
        | { type: "text"; text: string }
        | {
            type: "image_url";
            image_url: {
              url: string;
            };
          }
      >;
    };

type JsonRecord = Record<string, unknown>;

const LOCAL_MEDIA_PREFIX = "/api/media/";
const KNOWN_PROVIDER_ENDPOINT_SUFFIXES = [
  "/chat/completions",
  "/images/generations",
  "/images/edits",
  "/videos/generations",
  "/messages",
  "/models",
] as const;
const ASYNC_IMAGE_TASK_PENDING_STATUSES = new Set<string>([
  "pending",
  "processing",
  "queued",
  "running",
  "in_progress",
] as const);
const ASYNC_IMAGE_TASK_SUCCESS_STATUSES = new Set<string>([
  "completed",
  "succeeded",
  "success",
  "done",
] as const);
const ASYNC_IMAGE_TASK_FAILURE_STATUSES = new Set<string>([
  "failed",
  "error",
  "cancelled",
  "canceled",
] as const);
const XAI_VIDEO_PENDING_STATUSES = new Set<string>([
  "pending",
  "processing",
  "queued",
  "running",
] as const);
const XAI_VIDEO_SUCCESS_STATUSES = new Set<string>([
  "completed",
  "succeeded",
  "success",
  "done",
] as const);
const XAI_VIDEO_FAILURE_STATUSES = new Set<string>([
  "failed",
  "expired",
  "error",
  "cancelled",
  "canceled",
] as const);

function getContentTypeFromExtension(fileName: string) {
  const extension = path.extname(fileName).replace(".", "").toLowerCase();

  switch (extension) {
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
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

function normalizeUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function isDirectHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function createProviderRuntimeError(message: string, code: string) {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveEndpointUrl(baseUrl: string, endpointPath: string) {
  const normalizedBaseUrl = normalizeUrl(baseUrl);
  const normalizedEndpointPath = endpointPath.startsWith("/")
    ? endpointPath
    : `/${endpointPath}`;

  if (!normalizedBaseUrl) {
    return normalizedEndpointPath;
  }

  if (normalizedBaseUrl.endsWith(normalizedEndpointPath)) {
    return normalizedBaseUrl;
  }

  for (const suffix of KNOWN_PROVIDER_ENDPOINT_SUFFIXES) {
    if (normalizedBaseUrl.endsWith(suffix)) {
      return `${normalizedBaseUrl.slice(0, -suffix.length)}${normalizedEndpointPath}`;
    }
  }

  return `${normalizedBaseUrl}${normalizedEndpointPath}`;
}

function buildTextRewritePrompt(params: {
  instruction: string;
  sourceText: string;
}) {
  return [
    "You are rewriting a canvas text node.",
    "Return only the final revised text with no commentary.",
    "",
    "Current text:",
    params.sourceText.trim() || "(empty)",
    "",
    "Rewrite instruction:",
    params.instruction.trim(),
  ].join("\n");
}

function buildImagePrompt(params: {
  prompt: string;
  promptTexts: string[];
  hasReferences: boolean;
}) {
  return [
    "Create or edit an image for a node on an infinite canvas.",
    params.promptTexts.length > 0
      ? `Additional prompt context:\n${params.promptTexts
          .map((text, index) => `${index + 1}. ${text.trim()}`)
          .join("\n")}`
      : null,
    params.prompt.trim()
      ? `Primary instruction:\n${params.prompt.trim()}`
      : "Primary instruction:\nUse the connected images as the full design context.",
    params.hasReferences
      ? "Use every provided image as reference context."
      : "No reference image is attached, so generate from text only.",
  ]
    .filter(Boolean)
    .join("\n\n");
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
      : "Primary instruction:\nAnimate the provided image into a short video.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function mapAspectRatioToXai(aspectRatio: string) {
  switch (aspectRatio) {
    case "1:1":
    case "16:9":
    case "9:16":
    case "4:3":
    case "3:4":
    case "3:2":
    case "2:3":
      return aspectRatio;
    case "1280x720":
      return "16:9";
    case "720x1280":
      return "9:16";
    default:
      return "16:9";
  }
}

function clampVideoDurationSeconds(value: number) {
  if (value >= 8) {
    return 8;
  }

  if (value >= 6) {
    return 6;
  }

  return 4;
}

async function readImageInput(imageUrl: string) {
  if (imageUrl.startsWith("data:")) {
    const [meta, encoded] = imageUrl.split(",", 2);
    const mimeType =
      meta.match(/^data:(.*?);base64$/)?.[1]?.trim() || "image/png";

    return {
      buffer: Buffer.from(encoded ?? "", "base64"),
      mimeType,
    } satisfies PersistableImage;
  }

  const localMediaFile = getLocalMediaFileName(imageUrl);
  if (localMediaFile) {
    try {
      return {
        buffer: await readMediaFile(localMediaFile),
        mimeType: getContentTypeFromExtension(localMediaFile),
      } satisfies PersistableImage;
    } catch (error) {
      if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") {
        throw new Error(
          `The linked local media file "${localMediaFile}" is missing from data/media. Replace or re-import the source image, then try again.`,
        );
      }

      throw error;
    }
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to load image input: ${response.status}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: response.headers.get("content-type") || "image/png",
  } satisfies PersistableImage;
}

async function toDataUrl(imageUrl: string) {
  if (imageUrl.startsWith("data:")) {
    return imageUrl;
  }

  const image = await readImageInput(imageUrl);
  return `data:${image.mimeType};base64,${image.buffer.toString("base64")}`;
}

async function ensureRemoteImageInput(params: {
  imageUrl: string;
  providerLabel: string;
  supportsInline: boolean;
}) {
  const normalized = params.imageUrl.trim();

  if (params.supportsInline) {
    return toDataUrl(normalized);
  }

  if (isDirectHttpUrl(normalized)) {
    return normalized;
  }

  throw createProviderRuntimeError(
    `${params.providerLabel} 当前只接受可直接访问的图片 URL。请先给图片节点插入一个 http(s) 地址，再重新生成视频。`,
    VIDEO_IMAGE_INPUT_URL_REQUIRED_ERROR,
  );
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const record = payload as JsonRecord;
  if (
    record.error &&
    typeof record.error === "object" &&
    typeof (record.error as JsonRecord).message === "string"
  ) {
    return (record.error as JsonRecord).message as string;
  }

  if (typeof record.message === "string") {
    return record.message;
  }

  return fallback;
}

function extractOpenAICompatibleText(payload: JsonRecord) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const firstChoice =
    choices[0] && typeof choices[0] === "object"
      ? (choices[0] as JsonRecord)
      : null;
  const message =
    firstChoice?.message && typeof firstChoice.message === "object"
      ? (firstChoice.message as JsonRecord)
      : null;

  if (typeof message?.content === "string") {
    return message.content.trim();
  }

  if (Array.isArray(message?.content)) {
    return message.content
      .map((part) => {
        if (!part || typeof part !== "object") {
          return "";
        }

        const record = part as JsonRecord;
        if (typeof record.text === "string") {
          return record.text;
        }

        if (
          record.type === "output_text" &&
          typeof record.text === "string"
        ) {
          return record.text;
        }

        return "";
      })
      .filter((value) => value.trim().length > 0)
      .join("\n")
      .trim();
  }

  return "";
}

function dataUrlToImage(value: string) {
  const [meta, encoded] = value.split(",", 2);
  if (!meta || !encoded) {
    return null;
  }

  const mimeType =
    meta.match(/^data:(.*?);base64$/)?.[1]?.trim() || "image/png";

  return {
    buffer: Buffer.from(encoded, "base64"),
    mimeType,
  } satisfies PersistableImage;
}

function extractOpenAICompatibleImages(payload: JsonRecord) {
  const images: PersistableImage[] = [];
  const choices = Array.isArray(payload.choices) ? payload.choices : [];

  for (const choice of choices) {
    if (!choice || typeof choice !== "object") {
      continue;
    }

    const message =
      "message" in choice && choice.message && typeof choice.message === "object"
        ? (choice.message as JsonRecord)
        : null;

    if (!message) {
      continue;
    }

    const directImages = Array.isArray(message.images) ? message.images : [];
    for (const image of directImages) {
      if (!image || typeof image !== "object") {
        continue;
      }

      const record = image as JsonRecord;
      const imageUrl =
        typeof record.image_url === "string"
          ? record.image_url
          : record.image_url &&
              typeof record.image_url === "object" &&
              typeof (record.image_url as JsonRecord).url === "string"
            ? ((record.image_url as JsonRecord).url as string)
            : null;
      if (!imageUrl?.startsWith("data:")) {
        continue;
      }

      const parsed = dataUrlToImage(imageUrl);
      if (parsed) {
        images.push(parsed);
      }
    }

    if (!Array.isArray(message.content)) {
      continue;
    }

    for (const part of message.content) {
      if (!part || typeof part !== "object") {
        continue;
      }

      const record = part as JsonRecord;
      const imageUrl =
        record.type === "image_url" &&
        record.image_url &&
        typeof record.image_url === "object" &&
        typeof (record.image_url as JsonRecord).url === "string"
          ? ((record.image_url as JsonRecord).url as string)
          : null;

      if (!imageUrl?.startsWith("data:")) {
        continue;
      }

      const parsed = dataUrlToImage(imageUrl);
      if (parsed) {
        images.push(parsed);
      }
    }
  }

  return images;
}

function appendImageResult(
  images: PersistableImage[],
  value: unknown,
  mimeType = "image/png",
) {
  if (typeof value !== "string") {
    return;
  }

  const normalized = value.trim();
  if (!normalized) {
    return;
  }

  if (normalized.startsWith("data:")) {
    const parsed = dataUrlToImage(normalized);
    if (parsed) {
      images.push(parsed);
    }
    return;
  }

  if (/^https?:\/\//i.test(normalized)) {
    images.push({
      buffer: Buffer.alloc(0),
      mimeType: normalized,
    });
    return;
  }

  const compact = normalized.replace(/\s+/g, "");
  if (
    compact.length >= 128 &&
    /^[A-Za-z0-9+/=]+$/.test(compact) &&
    compact.length % 4 === 0
  ) {
    images.push({
      buffer: Buffer.from(compact, "base64"),
      mimeType,
    });
  }
}

function appendImageResultsFromUnknown(
  images: PersistableImage[],
  value: unknown,
  depth = 0,
) {
  if (depth > 4 || value == null) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendImageResultsFromUnknown(images, item, depth + 1);
    }
    return;
  }

  if (typeof value === "string") {
    appendImageResult(images, value);
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const record = value as JsonRecord;

  appendImageResult(images, record.b64_json, "image/png");
  appendImageResult(images, record.base64, "image/png");
  appendImageResult(images, record.b64, "image/png");
  appendImageResult(images, record.image_base64, "image/png");
  appendImageResult(images, record.image_b64, "image/png");
  appendImageResult(images, record.url);
  appendImageResult(images, record.image_url);
  appendImageResult(images, record.image);
  appendImageResultsFromUnknown(images, record.image_urls, depth + 1);
  appendImageResultsFromUnknown(images, record.result_urls, depth + 1);
  appendImageResultsFromUnknown(images, record.output_urls, depth + 1);
  appendImageResultsFromUnknown(images, record.task_result, depth + 1);
  appendImageResultsFromUnknown(images, record.response, depth + 1);

  appendImageResultsFromUnknown(images, record.data, depth + 1);
  appendImageResultsFromUnknown(images, record.images, depth + 1);
  appendImageResultsFromUnknown(images, record.output, depth + 1);
  appendImageResultsFromUnknown(images, record.result, depth + 1);
  appendImageResultsFromUnknown(images, record.results, depth + 1);
}

function extractOpenAIImageResults(payload: JsonRecord) {
  const images: PersistableImage[] = [];
  appendImageResultsFromUnknown(images, payload);
  return images;
}

function extractStringField(record: JsonRecord, keys: readonly string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function extractNestedTaskId(value: unknown, depth = 0): string | null {
  if (depth > 6 || !value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractNestedTaskId(item, depth + 1);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  const record = value as JsonRecord;
  const direct = extractStringField(record, [
    "task_id",
    "taskId",
    "async_task_id",
    "asyncTaskId",
  ]);
  if (direct) {
    return direct;
  }

  for (const nestedValue of Object.values(record)) {
    const nested = extractNestedTaskId(nestedValue, depth + 1);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function extractAsyncImageTaskStatus(value: unknown, depth = 0): string {
  if (depth > 6 || !value || typeof value !== "object") {
    return "";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractAsyncImageTaskStatus(item, depth + 1);
      if (nested) {
        return nested;
      }
    }

    return "";
  }

  const record = value as JsonRecord;
  const direct = extractStringField(record, [
    "status",
    "task_status",
    "taskStatus",
    "state",
  ]).toLowerCase();
  if (direct) {
    return direct;
  }

  for (const nestedValue of Object.values(record)) {
    const nested = extractAsyncImageTaskStatus(nestedValue, depth + 1);
    if (nested) {
      return nested;
    }
  }

  return "";
}

function extractAsyncImageTaskId(payload: JsonRecord) {
  const explicitTaskId = extractNestedTaskId(payload);
  if (explicitTaskId) {
    return explicitTaskId;
  }

  const status = extractAsyncImageTaskStatus(payload);
  const id = extractStringField(payload, ["id"]);
  const objectType = extractStringField(payload, ["object", "type"]).toLowerCase();
  const taskType =
    payload.task_info &&
    typeof payload.task_info === "object" &&
    typeof (payload.task_info as JsonRecord).type === "string"
      ? ((payload.task_info as JsonRecord).type as string).toLowerCase()
      : "";

  if (!id) {
    return null;
  }

  if (taskType === "image") {
    return id;
  }

  if (
    ASYNC_IMAGE_TASK_PENDING_STATUSES.has(status) ||
    ASYNC_IMAGE_TASK_SUCCESS_STATUSES.has(status) ||
    ASYNC_IMAGE_TASK_FAILURE_STATUSES.has(status)
  ) {
    return id;
  }

  if (objectType.includes("task") || id.startsWith("task-")) {
    return id;
  }

  return null;
}

async function pollAsyncImageTask(params: {
  baseUrl: string;
  apiKey: string;
  providerLabel: string;
  taskId: string;
}) {
  let lastPayload: JsonRecord | null = null;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (attempt > 0) {
      await sleep(1500);
    }

    const response = await fetch(
      resolveEndpointUrl(params.baseUrl, `/tasks/${encodeURIComponent(params.taskId)}`),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
        },
      },
    );

    const raw = await response.text();
    const payload = parseJson(raw);

    if (!response.ok) {
      throw new Error(
        extractErrorMessage(
          payload,
          `${params.providerLabel} task lookup failed with status ${response.status}.`,
        ),
      );
    }

    if (!payload || typeof payload !== "object") {
      throw new Error(`${params.providerLabel} task lookup returned an invalid response.`);
    }

    lastPayload = payload as JsonRecord;
    const status = extractAsyncImageTaskStatus(lastPayload);

    if (ASYNC_IMAGE_TASK_SUCCESS_STATUSES.has(status)) {
      return lastPayload;
    }

    if (ASYNC_IMAGE_TASK_FAILURE_STATUSES.has(status)) {
      throw new Error(
        extractErrorMessage(
          lastPayload,
          `${params.providerLabel} image task failed.`,
        ),
      );
    }

    const images = extractOpenAIImageResults(lastPayload);
    if (images.length > 0) {
      return lastPayload;
    }
  }

  throw new Error(
    `${params.providerLabel} image task is still processing. Please try again in a moment.`,
  );
}

async function resolveRemoteImageResults(images: PersistableImage[]) {
  const resolved: PersistableImage[] = [];

  for (const image of images) {
    if (
      image.buffer.byteLength === 0 &&
      (image.mimeType.startsWith("http://") || image.mimeType.startsWith("https://"))
    ) {
      resolved.push(await readImageInput(image.mimeType));
      continue;
    }

    resolved.push(image);
  }

  return resolved;
}

async function callOpenAICompatibleChat(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: OpenAICompatibleMessage[];
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}) {
  const response = await fetch(resolveEndpointUrl(params.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
      ...params.headers,
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      ...params.body,
    }),
  });

  const raw = await response.text();
  const payload = parseJson(raw);

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(
        payload,
        `Provider request failed with status ${response.status}.`,
      ),
    );
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Provider returned an invalid response.");
  }

  return payload as JsonRecord;
}

async function callAnthropicMessages(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  userContent: string;
}) {
  const response = await fetch(resolveEndpointUrl(params.baseUrl, "/messages"), {
    method: "POST",
    headers: {
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 2048,
      system: params.system,
      messages: [
        {
          role: "user",
          content: params.userContent,
        },
      ],
    }),
  });

  const raw = await response.text();
  const payload = parseJson(raw);

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(
        payload,
        `Anthropic request failed with status ${response.status}.`,
      ),
    );
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Anthropic returned an invalid response.");
  }

  const content = Array.isArray((payload as JsonRecord).content)
    ? ((payload as JsonRecord).content as unknown[])
    : [];
  const text = content
    .map((part) => {
      if (!part || typeof part !== "object") {
        return "";
      }

      const record = part as JsonRecord;
      return record.type === "text" && typeof record.text === "string"
        ? record.text
        : "";
    })
    .filter((value) => value.trim().length > 0)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Anthropic returned no text.");
  }

  return { text };
}

function mapAspectRatioToOpenAIImageSize(aspectRatio: string) {
  switch (aspectRatio) {
    case "2:3":
    case "3:4":
    case "9:16":
    case "1:2":
      return "1024x1536";
    case "3:2":
    case "4:3":
    case "16:9":
    case "21:9":
    case "2:1":
      return "1536x1024";
    case "1:1":
    default:
      return "1024x1024";
  }
}

function mapAspectRatioToGrok(aspectRatio: string) {
  switch (aspectRatio) {
    case "1:1":
    case "3:4":
    case "4:3":
    case "9:16":
    case "16:9":
      return aspectRatio;
    case "2:3":
    case "1:2":
      return "9:16";
    case "3:2":
    case "2:1":
    case "21:9":
    default:
      return "16:9";
  }
}

async function runOpenAIImage(params: {
  providerId: ReturnType<typeof resolveProviderModelSelection>["providerId"];
  providerLabel: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  promptTexts: string[];
  imageUrls: string[];
  aspectRatio: string;
}) {
  const isGrok = params.providerId === "grok";
  async function requestImageRun(imageUrls: string[]) {
    const instruction = buildImagePrompt({
      prompt: params.prompt,
      promptTexts: params.promptTexts,
      hasReferences: imageUrls.length > 0,
    });
    const path = imageUrls.length > 0 ? "/images/edits" : "/images/generations";
    const body: Record<string, unknown> = isGrok
      ? {
          model: params.model,
          prompt: instruction,
          aspect_ratio: mapAspectRatioToGrok(params.aspectRatio),
          response_format: "b64_json",
        }
      : {
          model: params.model,
          prompt: instruction,
          size: mapAspectRatioToOpenAIImageSize(params.aspectRatio),
          output_format: "png",
        };

    if (imageUrls.length > 0) {
      body.images = isGrok
        ? await Promise.all(
            imageUrls.map(async (imageUrl) => ({
              type: "image_url",
              url: await toDataUrl(imageUrl),
            })),
          )
        : await Promise.all(
            imageUrls.map(async (imageUrl) => ({
              image_url: await toDataUrl(imageUrl),
            })),
          );
    }

    const response = await fetch(resolveEndpointUrl(params.baseUrl, path), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const raw = await response.text();
    const payload = parseJson(raw);

    if (!response.ok) {
      throw new Error(
        extractErrorMessage(
          payload,
          `${params.providerLabel} image request failed with status ${response.status}.`,
        ),
      );
    }

    if (!payload || typeof payload !== "object") {
      throw new Error(
        `${params.providerLabel} image request returned an invalid response.`,
      );
    }

    let effectivePayload = payload as JsonRecord;
    let images = await resolveRemoteImageResults(
      extractOpenAIImageResults(effectivePayload),
    );

    if (images.length === 0) {
      const taskId = extractAsyncImageTaskId(effectivePayload);
      if (taskId) {
        effectivePayload = await pollAsyncImageTask({
          baseUrl: params.baseUrl,
          apiKey: params.apiKey,
          providerLabel: params.providerLabel,
          taskId,
        });
        images = await resolveRemoteImageResults(
          extractOpenAIImageResults(effectivePayload),
        );
      }
    }

    if (images.length === 0) {
      throw new Error(`${params.providerLabel} returned no images.`);
    }

    return {
      images,
      text:
        typeof effectivePayload.revised_prompt === "string"
          ? (effectivePayload.revised_prompt as string)
          : "",
    };
  }

  if (params.providerId === "custom" && params.imageUrls.length > 0) {
    try {
      const result = await requestImageRun(params.imageUrls);
      return {
        ...result,
        omittedImageCount: 0,
      };
    } catch {
      const fallback = await requestImageRun([]);
      return {
        ...fallback,
        omittedImageCount: params.imageUrls.length,
      };
    }
  }

  const result = await requestImageRun(params.imageUrls);
  return {
    ...result,
    omittedImageCount: 0,
  };
}

function extractXaiVideoRequestId(payload: JsonRecord) {
  const requestId =
    typeof payload.request_id === "string"
      ? payload.request_id
      : typeof payload.requestId === "string"
        ? payload.requestId
        : typeof payload.task_id === "string"
          ? payload.task_id
          : typeof payload.taskId === "string"
            ? payload.taskId
            : typeof payload.id === "string"
              ? payload.id
              : "";

  return requestId.trim();
}

function resolveXaiVideoTaskEndpoint(payload: JsonRecord, requestId: string) {
  const objectType = typeof payload.object === "string" ? payload.object.trim() : "";
  if (requestId.startsWith("task-") || objectType.endsWith(".task")) {
    return `/tasks/${requestId}`;
  }

  return `/videos/${requestId}`;
}

function extractFirstString(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const next: string = extractFirstString(item);
      if (next) {
        return next;
      }
    }
  }

  if (value && typeof value === "object") {
    const record = value as JsonRecord;

    for (const key of ["url", "video_url", "videoUrl", "output_url", "outputUrl"]) {
      const next: string = extractFirstString(record[key]);
      if (next) {
        return next;
      }
    }
  }

  return "";
}

function extractXaiVideoResultUrl(payload: JsonRecord) {
  return (
    extractFirstString(payload.results) ||
    extractFirstString(payload.result) ||
    extractFirstString(payload.outputs) ||
    extractFirstString(payload.output) ||
    ""
  );
}

function isUnsupportedXaiVideoLookupRoute(payload: JsonRecord) {
  return /invalid url/i.test(extractErrorMessage(payload, ""));
}

function extractXaiVideoStatus(payload: JsonRecord) {
  const status =
    typeof payload.status === "string"
      ? payload.status
      : typeof payload.state === "string"
        ? payload.state
        : "";

  return status.trim().toLowerCase();
}

function extractXaiVideoUrl(payload: JsonRecord) {
  const video =
    payload.video && typeof payload.video === "object"
      ? (payload.video as JsonRecord)
      : null;

  if (typeof video?.url === "string" && video.url.trim()) {
    return video.url.trim();
  }

  if (typeof payload.url === "string" && payload.url.trim()) {
    return payload.url.trim();
  }

  const resultUrl = extractXaiVideoResultUrl(payload);
  if (resultUrl) {
    return resultUrl;
  }

  return "";
}

async function pollXaiVideoGeneration(params: {
  baseUrl: string;
  apiKey: string;
  providerLabel: string;
  requestId: string;
  taskEndpoint: string;
}) {
  let activeTaskEndpoint = params.taskEndpoint;
  const fallbackTaskEndpoint = activeTaskEndpoint.startsWith("/tasks/")
    ? `/videos/${params.requestId}`
    : `/tasks/${params.requestId}`;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (attempt > 0) {
      await sleep(5_000);
    }

    const candidateEndpoints = Array.from(
      new Set([activeTaskEndpoint, fallbackTaskEndpoint]),
    );
    let resolvedPayload: JsonRecord | null = null;

    for (const taskEndpoint of candidateEndpoints) {
      const response = await fetch(
        resolveEndpointUrl(params.baseUrl, taskEndpoint),
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${params.apiKey}`,
          },
        },
      );
      const raw = await response.text();
      const payload = parseJson(raw);

      if (!response.ok) {
        if (isUnsupportedXaiVideoLookupRoute((payload as JsonRecord | null) ?? {})) {
          continue;
        }

        throw new Error(
          extractErrorMessage(
            payload,
            `${params.providerLabel} video task lookup failed with status ${response.status}.`,
          ),
        );
      }

      if (!payload || typeof payload !== "object") {
        throw new Error(`${params.providerLabel} video task lookup returned an invalid response.`);
      }

      activeTaskEndpoint = taskEndpoint;
      resolvedPayload = payload as JsonRecord;
      break;
    }

    if (!resolvedPayload) {
      throw new Error(
        `${params.providerLabel} video task lookup is not supported by ${params.taskEndpoint}.`,
      );
    }

    const status = extractXaiVideoStatus(resolvedPayload);
    if (XAI_VIDEO_SUCCESS_STATUSES.has(status)) {
      const videoUrl = extractXaiVideoUrl(resolvedPayload);
      if (!videoUrl) {
        throw new Error(`${params.providerLabel} returned no video URL.`);
      }

      return {
        videoUrl,
      };
    }

    if (XAI_VIDEO_FAILURE_STATUSES.has(status)) {
      throw new Error(
        extractErrorMessage(resolvedPayload, `${params.providerLabel} video generation failed.`),
      );
    }

    if (!XAI_VIDEO_PENDING_STATUSES.has(status)) {
      const videoUrl = extractXaiVideoUrl(resolvedPayload);
      if (videoUrl) {
        return {
          videoUrl,
        };
      }
    }
  }

  throw new Error(
    `${params.providerLabel} video generation is still processing. Please try again in a moment.`,
  );
}

async function runXaiCompatibleVideo(params: {
  providerLabel: string;
  providerId: ReturnType<typeof resolveProviderModelSelection>["providerId"];
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  promptTexts: string[];
  imageUrl: string;
  aspectRatio: string;
  durationSeconds: number;
}) {
  const imageDataUrl = await toDataUrl(params.imageUrl);

  async function requestVideo(imageFieldMode: "object" | "string") {
    const response = await fetch(
      resolveEndpointUrl(params.baseUrl, "/videos/generations"),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: params.model,
          prompt: buildVideoPrompt({
            prompt: params.prompt,
            promptTexts: params.promptTexts,
          }),
          image:
            imageFieldMode === "string"
              ? imageDataUrl
              : {
                  url: imageDataUrl,
                },
          duration: Math.max(1, Math.min(15, Math.round(params.durationSeconds || 4))),
          aspect_ratio: mapAspectRatioToXai(params.aspectRatio),
          resolution: "720p",
        }),
      },
    );
    const raw = await response.text();
    const payload = parseJson(raw);

    if (!response.ok) {
      throw new Error(
        extractErrorMessage(
          payload,
          `${params.providerLabel} video request failed with status ${response.status}.`,
        ),
      );
    }

    if (!payload || typeof payload !== "object") {
      throw new Error(`${params.providerLabel} video request returned an invalid response.`);
    }

    return payload as JsonRecord;
  }

  function resolveExpectedImageFieldMode(error: unknown) {
    if (!(error instanceof Error)) {
      return null;
    }

    const message = error.message;
    if (
      /cannot unmarshal object/i.test(message) &&
      /UnifiedVideoGenerationRequest\.image/i.test(message) &&
      /type string/i.test(message)
    ) {
      return "string" as const;
    }

    if (
      /cannot unmarshal string/i.test(message) &&
      /UnifiedVideoGenerationRequest\.image/i.test(message)
    ) {
      return "object" as const;
    }

    return null;
  }

  const preferredImageFieldMode = params.providerId === "custom" ? "string" : "object";
  let payload: JsonRecord;

  try {
    payload = await requestVideo(preferredImageFieldMode);
  } catch (error) {
    const expectedImageFieldMode = resolveExpectedImageFieldMode(error);
    if (
      expectedImageFieldMode &&
      expectedImageFieldMode !== preferredImageFieldMode
    ) {
      payload = await requestVideo(expectedImageFieldMode);
    } else {
      throw error;
    }
  }

  const directVideoUrl = extractXaiVideoUrl(payload);
  const requestId = extractXaiVideoRequestId(payload);
  const taskEndpoint = requestId
    ? resolveXaiVideoTaskEndpoint(payload, requestId)
    : "";

  const videoUrl =
    directVideoUrl ||
    (requestId
      ? (
          await pollXaiVideoGeneration({
            baseUrl: params.baseUrl,
            apiKey: params.apiKey,
            providerLabel: params.providerLabel,
            requestId,
            taskEndpoint,
          })
        ).videoUrl
      : "");

  if (!videoUrl) {
    throw new Error(`${params.providerLabel} returned no video URL.`);
  }

  const video = await readImageInput(videoUrl);

  return {
    videos: [
      {
        buffer: video.buffer,
        mimeType: video.mimeType,
      },
    ],
    omittedImageCount: 0,
  } satisfies VideoRunResult;
}

function appendPathSegment(baseUrl: string, segment: string) {
  const normalizedBaseUrl = normalizeUrl(baseUrl);
  const encodedSegment = encodeURIComponent(segment);

  return normalizedBaseUrl.endsWith(`/${encodedSegment}`)
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/${encodedSegment}`;
}

async function requestConnectivityProbe(params: {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  fallbackError: string;
}) {
  const response = await fetch(params.url, {
    method: params.method ?? "GET",
    headers: params.headers,
    body: params.body ? JSON.stringify(params.body) : undefined,
  });

  const raw = await response.text();
  const payload = parseJson(raw);

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, params.fallbackError));
  }

  return {
    status: response.status,
    payload:
      payload && typeof payload === "object" ? (payload as JsonRecord) : null,
  };
}

async function probeOpenAICompatibleConnection(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  providerLabel: string;
  headers?: Record<string, string>;
}) {
  const result = await requestConnectivityProbe({
    url: resolveEndpointUrl(params.baseUrl, "/models"),
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      ...params.headers,
    },
    fallbackError: `${params.providerLabel} connectivity probe failed.`,
  });

  const data = Array.isArray(result.payload?.data) ? result.payload.data : [];
  const modelListed = data.some(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof (item as JsonRecord).id === "string" &&
      (item as JsonRecord).id === params.model,
  );

  return modelListed
    ? `${params.providerLabel} 已连通，上游模型列表中找到了 ${params.model}。`
    : `${params.providerLabel} 已连通，上游模型列表请求成功。`;
}

async function probeGoogleModelConnection(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  providerLabel: string;
}) {
  await requestConnectivityProbe({
    url: appendPathSegment(params.baseUrl, params.model),
    headers: {
      "x-goog-api-key": params.apiKey,
    },
    fallbackError: `${params.providerLabel} connectivity probe failed.`,
  });

  return `${params.providerLabel} 已连通，已成功读取模型 ${params.model} 的元数据。`;
}

async function probeGenericEndpointConnection(params: {
  baseUrl: string;
  apiKey?: string;
  providerLabel: string;
}) {
  const url = normalizeUrl(params.baseUrl);
  const headers = params.apiKey?.trim()
    ? {
        Authorization: `Bearer ${params.apiKey.trim()}`,
      }
    : undefined;

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (response.status === 405) {
    return `${params.providerLabel} 已连通，端点可达但不接受 GET 探测（405）。`;
  }

  const raw = await response.text();
  const payload = parseJson(raw);

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `${params.providerLabel} 端点可达，但鉴权失败（${response.status}）。`,
      );
    }

    throw new Error(
      extractErrorMessage(
        payload,
        `${params.providerLabel} endpoint probe failed with status ${response.status}.`,
      ),
    );
  }

  return `${params.providerLabel} 已连通，端点探测返回 ${response.status}。`;
}

function assertProviderReady(
  settings: ProviderSettings,
  resolved: ReturnType<typeof resolveProviderModelSelection>,
  kind: ProviderRuntimeKind,
) {
  const providerLabel = getProviderPlatformDisplayName(
    resolved.platformId,
    settings,
    resolved.providerId,
  );
  const config = getProviderPlatformConfig(
    settings,
    resolved.platformId,
    resolved.providerId,
  );
  if (!config.apiKey.trim()) {
    throw new Error(`${providerLabel} API key is missing.`);
  }

  if (
    !providerCanRunKind(resolved.providerId, kind) &&
    !(kind === "video" && config.baseUrl.trim().length > 0)
  ) {
    throw new Error(
      `${providerLabel} is saved for presets, but ${kind} runtime is not wired yet.`,
    );
  }

  return config;
}

export async function runTextWithProvider(params: RunTextParams) {
  const resolved = resolveProviderModelSelection(params.model, "text", params.settings);
  if (!isProviderModelEnabled(params.settings, resolved.value)) {
    throw new Error(
      `${getProviderPlatformDisplayName(resolved.platformId, params.settings, resolved.providerId)} model ${resolved.modelId} is disabled.`,
    );
  }
  const config = assertProviderReady(params.settings, resolved, "text");
  const provider = getProviderDefinition(resolved.providerId);
  const providerLabel = getProviderPlatformDisplayName(
    resolved.platformId,
    params.settings,
    resolved.providerId,
  );
  const instruction = buildTextRewritePrompt({
    instruction: params.instruction,
    sourceText: params.sourceText,
  });

  if (provider.transport === "google") {
    return generateTextWithGoogle({
      config,
      model: resolved.modelId,
      instruction: params.instruction,
      sourceText: params.sourceText,
    });
  }

  if (provider.transport === "anthropic") {
    return callAnthropicMessages({
      baseUrl: config.baseUrl || provider.defaultBaseUrl,
      apiKey: config.apiKey,
      model: resolved.modelId,
      system:
        "You rewrite canvas text nodes. Return only the final revised text with no commentary.",
      userContent: instruction,
    });
  }

  const payload = await callOpenAICompatibleChat({
    baseUrl: config.baseUrl || provider.defaultBaseUrl,
    apiKey: config.apiKey,
    model: resolved.modelId,
    headers:
      provider.transport === "openrouter"
        ? {
            "HTTP-Referer": "https://canvas.local",
            "X-Title": "Canvas Open Source",
          }
        : undefined,
    messages: [
      {
        role: "system",
        content:
          "You rewrite canvas text nodes. Return only the final revised text with no commentary.",
      },
      {
        role: "user",
        content: instruction,
      },
    ],
  });

  const text = extractOpenAICompatibleText(payload);
  if (!text) {
    throw new Error(`${providerLabel} returned no text.`);
  }

  return { text };
}

export async function runImageWithProvider(
  params: RunImageParams,
): Promise<ImageRunResult> {
  const resolved = resolveProviderModelSelection(params.model, "image", params.settings);
  if (!isProviderModelEnabled(params.settings, resolved.value)) {
    throw new Error(
      `${getProviderPlatformDisplayName(resolved.platformId, params.settings, resolved.providerId)} model ${resolved.modelId} is disabled.`,
    );
  }
  const config = assertProviderReady(params.settings, resolved, "image");
  const provider = getProviderDefinition(resolved.providerId);
  const providerLabel = getProviderPlatformDisplayName(
    resolved.platformId,
    params.settings,
    resolved.providerId,
  );
  const supportsInlineVideoInput = providerSupportsInlineVideoImageInput(
    resolved.providerId,
  );
  const uniqueImageUrls = Array.from(
    new Set(params.imageUrls.map((value) => value.trim()).filter(Boolean)),
  );

  if (provider.transport === "google") {
    const result = await generateImagesWithGoogle({
      config,
      model: resolved.modelId,
      prompt: params.prompt,
      promptTexts: params.promptTexts,
      imageUrls: uniqueImageUrls,
      aspectRatio: params.aspectRatio,
    });

    return {
      images: result.images,
      text: result.text,
      omittedImageCount: result.omittedImageCount,
    };
  }

  if (
    provider.transport === "openai-images" ||
    (provider.transport === "openai-compatible" &&
      resolved.providerId === "custom")
  ) {
    return runOpenAIImage({
      providerId: resolved.providerId,
      providerLabel,
      baseUrl: config.baseUrl || provider.defaultBaseUrl,
      apiKey: config.apiKey,
      model: resolved.modelId,
      prompt: params.prompt,
      promptTexts: params.promptTexts,
      imageUrls: uniqueImageUrls.slice(0, 16),
      aspectRatio: params.aspectRatio,
    });
  }

  if (provider.transport === "openrouter") {
    const instruction = buildImagePrompt({
      prompt: params.prompt,
      promptTexts: params.promptTexts,
      hasReferences: uniqueImageUrls.length > 0,
    });
    const message: OpenAICompatibleMessage =
      uniqueImageUrls.length > 0
        ? {
            role: "user",
            content: [
              { type: "text", text: instruction },
              ...(
                await Promise.all(
                  uniqueImageUrls.slice(0, 8).map(async (imageUrl) => ({
                    type: "image_url" as const,
                    image_url: {
                      url: await toDataUrl(imageUrl),
                    },
                  })),
                )
              ),
            ],
          }
        : {
            role: "user",
            content: instruction,
          };

    const payload = await callOpenAICompatibleChat({
      baseUrl: config.baseUrl || provider.defaultBaseUrl,
      apiKey: config.apiKey,
      model: resolved.modelId,
      headers: {
        "HTTP-Referer": "https://canvas.local",
        "X-Title": "Canvas Open Source",
      },
      body: {
        modalities: ["image", "text"],
        image_config: {
          aspect_ratio: params.aspectRatio,
        },
      },
      messages: [message],
    });

    const images = extractOpenAICompatibleImages(payload);
    if (images.length === 0) {
      throw new Error(`${providerLabel} returned no images.`);
    }

    return {
      images,
      text: extractOpenAICompatibleText(payload),
      omittedImageCount: Math.max(0, uniqueImageUrls.length - Math.min(uniqueImageUrls.length, 8)),
    };
  }

  throw new Error(`${providerLabel} image runtime is not supported yet.`);
}

export async function runVideoWithProvider(
  params: RunVideoParams,
): Promise<VideoRunResult> {
  const resolved = resolveProviderModelSelection(params.model, "video", params.settings);
  if (!isProviderModelEnabled(params.settings, resolved.value)) {
    throw new Error(
      `${getProviderPlatformDisplayName(resolved.platformId, params.settings, resolved.providerId)} model ${resolved.modelId} is disabled.`,
    );
  }

  const config = assertProviderReady(params.settings, resolved, "video");
  const provider = getProviderDefinition(resolved.providerId);
  const providerLabel = getProviderPlatformDisplayName(
    resolved.platformId,
    params.settings,
    resolved.providerId,
  );
  const supportsInlineVideoInput = providerSupportsInlineVideoImageInput(
    resolved.providerId,
  );
  const uniqueImageUrls = Array.from(
    new Set(params.imageUrls.map((value) => value.trim()).filter(Boolean)),
  );

  if (uniqueImageUrls.length === 0) {
    throw new Error("Connect an Image Node as the primary input first.");
  }

  const preparedImageUrls = await Promise.all(
    uniqueImageUrls.map((imageUrl) =>
      ensureRemoteImageInput({
        imageUrl,
        providerLabel,
        supportsInline: supportsInlineVideoInput,
      }),
    ),
  );

  if (resolved.providerId === "veo") {
    const result = await generateVideoWithGoogle({
      config,
      model: resolved.modelId,
      prompt: params.prompt,
      promptTexts: params.promptTexts,
      imageUrl: preparedImageUrls[0],
      referenceImageUrls: preparedImageUrls.slice(1),
      aspectRatio: params.aspectRatio,
      durationSeconds: clampVideoDurationSeconds(params.durationSeconds),
    });

    return {
      videos: [result.video],
      omittedImageCount: result.omittedReferenceImageCount,
    };
  }

  if (
    resolved.providerId === "grok" ||
    resolved.providerId === "custom" ||
    provider.transport === "openai-compatible" ||
    provider.transport === "openai-images"
  ) {
    return runXaiCompatibleVideo({
      providerLabel,
      providerId: resolved.providerId,
      baseUrl: config.baseUrl || provider.defaultBaseUrl,
      apiKey: config.apiKey,
      model: resolved.modelId,
      prompt: params.prompt,
      promptTexts: params.promptTexts,
      imageUrl: preparedImageUrls[0],
      aspectRatio: params.aspectRatio,
      durationSeconds: params.durationSeconds,
    });
  }

  throw new Error(`${providerLabel} video runtime is not supported yet.`);
}

export async function testProviderModelConnection(
  params: TestProviderModelParams,
): Promise<TestProviderModelResult> {
  const resolved = resolveProviderModelSelection(
    params.model,
    params.kind,
    params.settings,
  );

  if (!isProviderModelEnabled(params.settings, resolved.value)) {
    throw new Error(
      `${getProviderPlatformDisplayName(resolved.platformId, params.settings, resolved.providerId)} model ${resolved.modelId} is disabled.`,
    );
  }

  const provider = getProviderDefinition(resolved.providerId);
  const providerLabel = getProviderPlatformDisplayName(
    resolved.platformId,
    params.settings,
    resolved.providerId,
  );
  const config = getProviderPlatformConfig(
    params.settings,
    resolved.platformId,
    resolved.providerId,
  );

  if (params.kind === "text" && providerCanRunKind(resolved.providerId, "text")) {
    const result = await runTextWithProvider({
      settings: params.settings,
      model: resolved.value,
      instruction: "Reply with OK only.",
      sourceText: "ping",
    });

    return {
      mode: "runtime",
      message: `${resolved.modelId} 已通过真实文本请求验证，返回：${result.text.slice(0, 48) || "OK"}`,
    };
  }

  if (params.kind === "image" && providerCanRunKind(resolved.providerId, "image")) {
    const result = await runImageWithProvider({
      settings: params.settings,
      model: resolved.value,
      prompt: "Generate a minimal test image with a single solid color.",
      promptTexts: [],
      imageUrls: [],
      aspectRatio: "1:1",
    });

    if (result.images.length === 0) {
      throw new Error(`${resolved.modelId} 没有返回测试图像。`);
    }

    return {
      mode: "runtime",
      message: `${resolved.modelId} 已通过真实图像请求验证，成功返回 ${result.images.length} 张测试图像。`,
    };
  }

  if (provider.transport === "anthropic") {
    if (!config.apiKey.trim()) {
      throw new Error(`${providerLabel} API key is missing.`);
    }

    await callAnthropicMessages({
      baseUrl: config.baseUrl || provider.defaultBaseUrl,
      apiKey: config.apiKey,
      model: resolved.modelId,
      system: "Reply with OK only.",
      userContent: "ping",
    });

    return {
      mode: "probe",
      message: `${resolved.modelId} 已通过 Anthropic Messages API 探测。`,
    };
  }

  if (
    provider.transport === "openai-compatible" ||
    provider.transport === "openai-images" ||
    provider.transport === "openrouter"
  ) {
    if (!config.apiKey.trim()) {
      throw new Error(`${providerLabel} API key is missing.`);
    }

    return {
      mode: "probe",
      message: await probeOpenAICompatibleConnection({
        baseUrl: config.baseUrl || provider.defaultBaseUrl,
        apiKey: config.apiKey,
        model: resolved.modelId,
        providerLabel,
        headers:
          provider.transport === "openrouter"
            ? {
                "HTTP-Referer": "https://canvas.local",
                "X-Title": "Canvas Open Source",
              }
            : undefined,
      }),
    };
  }

  if (provider.transport === "google" || resolved.providerId === "veo") {
    if (!config.apiKey.trim()) {
      throw new Error(`${providerLabel} API key is missing.`);
    }

    return {
      mode: "probe",
      message: await probeGoogleModelConnection({
        baseUrl: config.baseUrl || provider.defaultBaseUrl,
        apiKey: config.apiKey,
        model: resolved.modelId,
        providerLabel,
      }),
    };
  }

  if (resolved.providerId === "sora") {
    if (!config.apiKey.trim()) {
      throw new Error(`${providerLabel} API key is missing.`);
    }

    return {
      mode: "probe",
      message: await probeOpenAICompatibleConnection({
        baseUrl: config.baseUrl || provider.defaultBaseUrl,
        apiKey: config.apiKey,
        model: resolved.modelId,
        providerLabel,
      }),
    };
  }

  if (config.baseUrl.trim()) {
    return {
      mode: "probe",
      message: await probeGenericEndpointConnection({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        providerLabel,
      }),
    };
  }

  throw new Error(`${providerLabel} 当前没有可探测的 API 地址，请先填写 Base URL。`);
}
