"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.translations = void 0;
exports.normalizeLocale = normalizeLocale;
exports.t = t;
const en_json_1 = __importDefault(require("./en.json"));
const de_json_1 = __importDefault(require("./de.json"));
/**
 * Translation dictionaries
 */
exports.translations = {
    en: en_json_1.default,
    de: de_json_1.default,
};
/**
 * Normalize raw locale string (from order.locale, headers, etc.)
 * Always returns a SupportedLocale
 */
function normalizeLocale(locale) {
    if (locale === "de")
        return "de";
    return "en"; // default fallback
}
/**
 * Translate helper
 *
 * @param locale - normalized locale (en, de)
 * @param key - dot notation key (payment.transactionId)
 * @param params - placeholder replacements
 */
function t(locale, key, params = {}) {
    const dict = exports.translations[locale];
    let text = key
        .split(".")
        .reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : undefined), dict) ?? key;
    Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`{{${k}}}`, "g"), v);
    });
    return text;
}
