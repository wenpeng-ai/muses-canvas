import { cookies, headers } from "next/headers";
import {
  LOCALE_COOKIE_NAME,
  normalizeLocale,
  resolvePreferredLocale,
} from "@/lib/locale-config";

export async function resolveRequestLocale() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  if (cookieLocale) {
    return normalizeLocale(cookieLocale);
  }

  const headerStore = await headers();
  return resolvePreferredLocale(headerStore.get("accept-language"));
}
