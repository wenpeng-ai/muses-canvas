import { normalizeEditableProviderSettings } from "@/lib/provider-settings";
import {
  loadProviderSettingsRecord,
  saveProviderSettings,
} from "@/lib/server/local-canvas-store";
import {
  getErrorMessage,
  jsonResponse,
  readJsonBody,
  errorResponse,
} from "@/lib/server/route-utils";

export async function GET() {
  const record = await loadProviderSettingsRecord();
  const settings = normalizeEditableProviderSettings(record.value);

  return jsonResponse({
    settings,
    hasStoredValue: record.hasStoredValue,
  });
}

export async function PATCH(request: Request) {
  try {
    const payload = normalizeEditableProviderSettings(
      await readJsonBody<Record<string, unknown>>(request, {}),
    );

    await saveProviderSettings(payload);
    const record = await loadProviderSettingsRecord();

    return jsonResponse({
      settings: payload,
      hasStoredValue: record.hasStoredValue,
    });
  } catch (error) {
    return errorResponse(getErrorMessage(error, "Failed to save provider settings"));
  }
}
