"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigResponseSchema = void 0;
const typebox_1 = require("@sinclair/typebox");
/**
 * Public shareable payment provider configuration. Do not include any sensitive data.
 */
exports.ConfigResponseSchema = typebox_1.Type.Any();
