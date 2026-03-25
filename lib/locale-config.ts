export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALE_CODES = [
  DEFAULT_LOCALE,
  "zh-CN",
  "zh-TW",
  "ja",
  "ko",
] as const;
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

export type AppLocale = (typeof SUPPORTED_LOCALE_CODES)[number];

export const LOCALE_OPTIONS: Array<{
  code: AppLocale;
  label: string;
  shortLabel: string;
}> = [
  { code: "en", label: "English", shortLabel: "EN" },
  { code: "zh-CN", label: "简体中文", shortLabel: "简中" },
  { code: "zh-TW", label: "繁體中文", shortLabel: "繁中" },
  { code: "ja", label: "日本語", shortLabel: "日本語" },
  { code: "ko", label: "한국어", shortLabel: "한국어" },
];

export function isSupportedLocale(value: string): value is AppLocale {
  return SUPPORTED_LOCALE_CODES.includes(value as AppLocale);
}

export function normalizeLocale(value: string | null | undefined): AppLocale {
  if (!value) {
    return DEFAULT_LOCALE;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_LOCALE;
  }

  if (isSupportedLocale(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.toLowerCase();
  if (normalized.startsWith("zh")) {
    return normalized.includes("tw") ||
      normalized.includes("hk") ||
      normalized.includes("mo") ||
      normalized.includes("hant")
      ? "zh-TW"
      : "zh-CN";
  }

  if (normalized.startsWith("ja")) {
    return "ja";
  }

  if (normalized.startsWith("ko")) {
    return "ko";
  }

  if (normalized.startsWith("en")) {
    return "en";
  }

  return DEFAULT_LOCALE;
}

export function resolvePreferredLocale(acceptLanguage: string | null | undefined) {
  if (!acceptLanguage) {
    return DEFAULT_LOCALE;
  }

  const requestedLocales = acceptLanguage
    .split(",")
    .map((item) => item.split(";", 1)[0]?.trim() ?? "")
    .filter(Boolean);

  for (const requestedLocale of requestedLocales) {
    const normalized = normalizeLocale(requestedLocale);
    if (isSupportedLocale(normalized)) {
      return normalized;
    }
  }

  return DEFAULT_LOCALE;
}
