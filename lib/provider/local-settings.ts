import {
  EMPTY_PROVIDER_SETTINGS,
  normalizeEditableProviderSettings,
  type ProviderSettings,
} from "@/lib/provider-settings";
import {
  loadProviderSettingsFromApi,
  saveProviderSettingsToApi,
} from "@/lib/provider/api";

type ProviderSettingsServerLoadResult = {
  settings: ProviderSettings;
  hasStoredValue: boolean;
};

export async function loadLocalProviderSettings(): Promise<ProviderSettings> {
  if (typeof window === "undefined") {
    return EMPTY_PROVIDER_SETTINGS;
  }

  try {
    const result = await loadProviderSettingsFromApi();

    return result.hasStoredValue ? result.settings : EMPTY_PROVIDER_SETTINGS;
  } catch {
    return EMPTY_PROVIDER_SETTINGS;
  }
}

export async function saveLocalProviderSettings(
  settings: ProviderSettings,
): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  const normalizedSettings = normalizeEditableProviderSettings(settings);

  try {
    const result = await saveProviderSettingsToApi(normalizedSettings);

    if (!result.ok) {
      console.error(result.error ?? "Failed to save provider settings to local file.");
    }

    return result.ok;
  } catch {
    return false;
  }
}
