import { getRequestConfig } from "next-intl/server";
import { getMessages } from "@/i18n/messages";
import { resolveRequestLocale } from "@/lib/server/request-locale";

export default getRequestConfig(async () => {
  const locale = await resolveRequestLocale();

  return {
    locale,
    messages: getMessages(locale),
  };
});
