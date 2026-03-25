import { requestJson } from "@/lib/client/json-fetch";
import {
  EMPTY_PROVIDER_SETTINGS,
  normalizeEditableProviderSettings,
  type ProviderCustomModel,
  type ProviderModelKind,
  type ProviderPlatform,
  type ProviderSettings,
} from "@/lib/provider-settings";

type ProviderSettingsResponse = {
  settings?: Partial<ProviderSettings>;
  hasStoredValue?: boolean;
};

type ProviderSettingsSaveResponse = {
  settings?: Partial<ProviderSettings>;
  hasStoredValue?: boolean;
  error?: string;
};

type TestProviderModelRequest = {
  model?: string;
  kind?: ProviderModelKind;
  platform?: ProviderPlatform;
  customModel?: ProviderCustomModel | null;
  imageAspectRatio?: string;
  settings?: Partial<ProviderSettings>;
};

type TestProviderModelResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

type ProviderRequestMessages = {
  failedMessage?: string;
  successMessage?: string;
};

type ProviderRunRequestBase = {
  settings?: Partial<ProviderSettings>;
};

type TextProviderRunRequest = ProviderRunRequestBase & {
  kind: "text";
  model: string;
  instruction: string;
  sourceText: string;
};

type ImageProviderRunRequest = ProviderRunRequestBase & {
  kind: "image";
  model: string;
  prompt: string;
  promptTexts?: string[];
  imageUrls?: string[];
  aspectRatio?: string;
};

type VideoProviderRunRequest = ProviderRunRequestBase & {
  kind: "video";
  model: string;
  prompt: string;
  promptTexts?: string[];
  imageUrls?: string[];
  aspectRatio?: string;
  durationSeconds?: number;
};

export async function loadProviderSettingsFromApi() {
  const { response, data } = await requestJson<ProviderSettingsResponse>(
    "/api/provider/settings",
    {
      cache: "no-store",
    },
    {},
  );
  const normalizedSettings = normalizeEditableProviderSettings(data.settings);

  return {
    ok: response.ok,
    settings: response.ok ? normalizedSettings : EMPTY_PROVIDER_SETTINGS,
    hasStoredValue: data.hasStoredValue === true,
  };
}

export async function saveProviderSettingsToApi(settings: ProviderSettings) {
  const normalizedSettings = normalizeEditableProviderSettings(settings);
  const { response, data } = await requestJson<ProviderSettingsSaveResponse>(
    "/api/provider/settings",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(normalizedSettings),
    },
    {},
  );

  return {
    ok: response.ok,
    error: data.error,
  };
}

export async function testProviderModelWithApi(
  payload: TestProviderModelRequest,
  messages?: ProviderRequestMessages,
) {
  const { response, data } = await requestJson<TestProviderModelResponse>(
    "/api/provider/test-model",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    {},
  );

  if (!response.ok || !data.ok) {
    throw new Error(
      data.error || data.message || messages?.failedMessage || "Test failed.",
    );
  }

  return {
    message:
      data.message ||
      messages?.successMessage ||
      (typeof payload.model === "string"
        ? `${payload.model} passed the test.`
        : "Test passed."),
  };
}

export async function runTextProviderRequest(
  payload: TextProviderRunRequest,
  messages?: ProviderRequestMessages,
) {
  const { response, data } = await requestJson<{
    text?: string;
    error?: string;
  }>(
    "/api/provider/run",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    {},
  );

  if (!response.ok || !data.text) {
    throw new Error(data.error || messages?.failedMessage || "Text generation failed.");
  }

  return {
    text: data.text,
  };
}

export async function runImageProviderRequest(
  payload: ImageProviderRunRequest,
  messages?: ProviderRequestMessages,
) {
  const { response, data } = await requestJson<{
    imageUrls?: string[];
    generationId?: string;
    omittedImageCount?: number;
    responseText?: string;
    error?: string;
  }>(
    "/api/provider/run",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    {},
  );

  if (!response.ok || !Array.isArray(data.imageUrls) || data.imageUrls.length === 0) {
    throw new Error(data.error || messages?.failedMessage || "Image generation failed.");
  }

  return {
    imageUrls: data.imageUrls,
    generationId: data.generationId ?? null,
    omittedImageCount: data.omittedImageCount ?? 0,
    responseText: data.responseText ?? null,
  };
}

export async function runVideoProviderRequest(
  payload: VideoProviderRunRequest,
  messages?: ProviderRequestMessages,
) {
  const { response, data } = await requestJson<{
    videoUrls?: string[];
    generationId?: string;
    omittedImageCount?: number;
    error?: string;
    code?: string;
  }>(
    "/api/provider/run",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    {},
  );

  if (!response.ok || !Array.isArray(data.videoUrls) || data.videoUrls.length === 0) {
    const error = new Error(
      data.error || messages?.failedMessage || "Video generation failed.",
    ) as Error & {
      code?: string;
    };
    error.code = data.code;
    throw error;
  }

  return {
    videoUrls: data.videoUrls,
    generationId: data.generationId ?? null,
    omittedImageCount: data.omittedImageCount ?? 0,
  };
}
