import { normalizeLocale, type AppLocale } from "@/lib/locale-config";
import enMessages from "@/messages/en.json";
import jaMessages from "@/messages/ja.json";
import koMessages from "@/messages/ko.json";
import zhCNMessages from "@/messages/zh-CN.json";
import zhTWMessages from "@/messages/zh-TW.json";

export type AppMessages = typeof enMessages;

const MESSAGES: Record<AppLocale, AppMessages> = {
  en: enMessages,
  "zh-CN": zhCNMessages as AppMessages,
  "zh-TW": zhTWMessages as AppMessages,
  ja: jaMessages as AppMessages,
  ko: koMessages as AppMessages,
};

export function getMessages(locale: string): AppMessages {
  return MESSAGES[normalizeLocale(locale)] ?? enMessages;
}
