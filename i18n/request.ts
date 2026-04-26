import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["en", "or", "hi"] as const;
export const defaultLocale = "en" as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  // Phase 15 — honour an explicit user preference set by the onboarding
  // modal (writes the standard NEXT_LOCALE cookie). Falls back to the
  // request locale (next-intl default), then to `en`.
  let cookieLocale: string | undefined;
  try {
    const jar = await cookies();
    cookieLocale = jar.get("NEXT_LOCALE")?.value;
  } catch {
    // headers() unavailable in some build contexts — ignore.
  }
  const candidate = cookieLocale ?? requested;
  const locale = (locales as readonly string[]).includes(candidate ?? "")
    ? (candidate as Locale)
    : defaultLocale;
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
