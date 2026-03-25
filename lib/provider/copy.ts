import type { AppMessages } from "@/i18n/messages";
import enMessages from "@/messages/en.json";

export type ProviderSettingsCopy = {
  title: string;
  customProvider: string;
  selectProviderPlatform: string;
  modelName: string;
  modelIdPlaceholder: string;
  modelIdPlaceholderWithExample: string;
  preset: string;
  type: string;
  noPresetModels: string;
  addModelTitle: string;
  editPlatformTitle: string;
  providerPlatform: string;
  displayName: string;
  displayNamePlaceholder: string;
  displayNamePlaceholderWithExample: string;
  baseUrl: string;
  apiKey: string;
  selectProviderFirst: string;
  enterApiKeyForProvider: string;
  enterApiKey: string;
  enterBaseUrl: string;
  cancel: string;
  confirm: string;
  notSet: string;
  models: string;
  addModel: string;
  noAvailableModels: string;
  addPlatformAndModel: string;
  textKind: string;
  imageKind: string;
  videoKind: string;
  addModelTooltip: string;
  removePlatformTooltip: string;
  editPlatformTooltip: string;
  deletePlatformTitle: string;
  deletePlatformDescription: string;
  deletePlatformConfirm: string;
  deletePlatformCancel: string;
  deleteModelTitle: string;
  deleteModelDescription: string;
  deleteModelConfirm: string;
  deleteModelCancel: string;
  testing: string;
  test: string;
  delete: string;
  keepAtLeastOneModel: string;
  missingPlatformConfigForTest: string;
  modelTestPassed: string;
  modelTestFailed: string;
};

export function getProviderSettingsCopy(messages: AppMessages) {
  return {
    ...enMessages.copy.providerSettings,
    ...(messages.copy.providerSettings ?? {}),
  } as ProviderSettingsCopy;
}

export function formatProviderCopy(
  template: string,
  values: Record<string, string | number>,
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}
