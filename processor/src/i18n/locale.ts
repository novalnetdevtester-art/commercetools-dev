import { SupportedLocale } from "./index";

const SUPPORTED_LOCALES: SupportedLocale[] = ["en", "de"];

export function normalizeLocale(locale?: string): SupportedLocale {
  if (locale && SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
    return locale as SupportedLocale;
  }
  return "en"; // fallback
}
