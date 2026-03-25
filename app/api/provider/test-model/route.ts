import {
  DEFAULT_PROVIDER_SETTINGS,
  normalizeEditableProviderSettings,
  resolveProviderModelSelection,
  type ProviderCustomModel,
  type ProviderModelKind,
  type ProviderPlatform,
  type ProviderSettings,
} from "@/lib/provider-settings";
import { testProviderModelConnection } from "@/lib/server/provider-runner";
import {
  errorResponse,
  getErrorMessage,
  jsonResponse,
  readJsonBody,
} from "@/lib/server/route-utils";

type TestModelRequest = {
  model?: string;
  kind?: ProviderModelKind;
  platform?: ProviderPlatform;
  customModel?: ProviderCustomModel | null;
  imageAspectRatio?: string;
  settings?: Partial<ProviderSettings>;
};

function isProviderModelKind(value: unknown): value is ProviderModelKind {
  return value === "text" || value === "image" || value === "video";
}

function isProviderPlatform(value: unknown): value is ProviderPlatform {
  return (
    !!value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string" &&
    "providerId" in value &&
    typeof value.providerId === "string" &&
    "apiKey" in value &&
    typeof value.apiKey === "string" &&
    "baseUrl" in value &&
    typeof value.baseUrl === "string"
  );
}

function isProviderCustomModel(value: unknown): value is ProviderCustomModel {
  return (
    !!value &&
    typeof value === "object" &&
    "platformId" in value &&
    typeof value.platformId === "string" &&
    "providerId" in value &&
    typeof value.providerId === "string" &&
    "modelId" in value &&
    typeof value.modelId === "string" &&
    "kind" in value &&
    isProviderModelKind(value.kind) &&
    "label" in value &&
    typeof value.label === "string" &&
    "description" in value &&
    typeof value.description === "string"
  );
}

function buildMinimalTestSettings(body: TestModelRequest) {
  if (!isProviderPlatform(body.platform) || typeof body.model !== "string") {
    return normalizeEditableProviderSettings(body.settings);
  }

  const defaults = {
    ...DEFAULT_PROVIDER_SETTINGS.defaults,
    imageAspectRatio:
      typeof body.imageAspectRatio === "string" &&
      body.imageAspectRatio.trim().length > 0
        ? body.imageAspectRatio.trim()
        : DEFAULT_PROVIDER_SETTINGS.defaults.imageAspectRatio,
  };

  if (body.kind === "text") {
    defaults.textModel = body.model;
  } else if (body.kind === "image") {
    defaults.imageModel = body.model;
  } else {
    defaults.videoModel = body.model;
  }

  return normalizeEditableProviderSettings({
    platforms: [
      {
        id: body.platform.id,
        providerId: body.platform.providerId,
        apiKey: body.platform.apiKey,
        baseUrl: body.platform.baseUrl,
        displayName: body.platform.displayName ?? "",
      },
    ],
    defaults,
    customModels:
      isProviderCustomModel(body.customModel) ? [body.customModel] : [],
    hiddenPresetModels: [],
    disabledModelValues: [],
  });
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<TestModelRequest>(request, {});

    if (!isProviderModelKind(body.kind)) {
      return errorResponse("缺少有效的模型类型。", {
        extras: { ok: false },
      });
    }

    if (typeof body.model !== "string" || body.model.trim().length === 0) {
      return errorResponse("缺少有效的模型标识。", {
        extras: { ok: false },
      });
    }

    const settings = buildMinimalTestSettings(body);
    const resolved = resolveProviderModelSelection(
      body.model,
      body.kind,
      settings,
    );
    const effectiveSettings: ProviderSettings = {
      ...settings,
      disabledModelValues: settings.disabledModelValues.filter(
        (value) => value !== resolved.value,
      ),
    };
    await testProviderModelConnection({
      settings: effectiveSettings,
      model: resolved.value,
      kind: body.kind,
    });

    return jsonResponse({
      ok: true,
      message: `${resolved.modelId} 测试通过。`,
    });
  } catch (error) {
    return errorResponse(getErrorMessage(error, "模型测试失败。"), {
      extras: { ok: false },
    });
  }
}
