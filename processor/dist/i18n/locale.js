"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLocale = normalizeLocale;
const SUPPORTED_LOCALES = ["en", "de"];
function normalizeLocale(locale) {
    if (locale && SUPPORTED_LOCALES.includes(locale)) {
        return locale;
    }
    return "en"; // fallback
}
