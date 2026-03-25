import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, SUPPORTED_LOCALE_CODES } from "@/lib/locale-config";

export const routing = defineRouting({
  locales: [...SUPPORTED_LOCALE_CODES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "never",
});
