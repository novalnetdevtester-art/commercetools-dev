"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportedPaymentComponentsSchema = exports.SupportedPaymentComponentsData = void 0;
const typebox_1 = require("@sinclair/typebox");
exports.SupportedPaymentComponentsData = typebox_1.Type.Object({
    type: typebox_1.Type.String(),
    subtypes: typebox_1.Type.Optional(typebox_1.Type.Array(typebox_1.Type.String())),
});
/**
 * Supported payment components schema.
 *
 * Example:
 * {
 *   "components": [
 *     {
 *       "type": "card"
 *     },
 *     {
 *       "type": "applepay"
 *     }
 *   ]
 * }
 */
exports.SupportedPaymentComponentsSchema = typebox_1.Type.Object({
    components: typebox_1.Type.Array(exports.SupportedPaymentComponentsData),
});
