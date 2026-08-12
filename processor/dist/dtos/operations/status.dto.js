"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusResponseSchema = void 0;
const typebox_1 = require("@sinclair/typebox");
/**
 * Status response schema.
 *
 * Example:
 * {
 *    "status": "OK",
 *    "timestamp": "2024-07-15T14:00:43.068Z",
 *    "version": "3.0.2",
 *    "metadata": {
 *        "name": "payment-integration-novalnet",
 *        "description": "Payment provider integration template",
 *        "@commercetools/connect-payments-sdk": "<version>"
 *    },
 *    "checks": [
 *        {
 *            "name": "CoCo Permissions",
 *            "status": "UP"
 *        },
 *        {
 *            "name": "Mock Payment API",
 *            "status": "UP"
 *        }
 *    ]
 *  }
 *
 *
 */
exports.StatusResponseSchema = typebox_1.Type.Object({
    status: typebox_1.Type.String(),
    timestamp: typebox_1.Type.String(),
    version: typebox_1.Type.String(),
    metadata: typebox_1.Type.Optional(typebox_1.Type.Any()),
    checks: typebox_1.Type.Array(typebox_1.Type.Object({
        name: typebox_1.Type.String(),
        status: typebox_1.Type.String(),
        details: typebox_1.Type.Optional(typebox_1.Type.Any()),
        message: typebox_1.Type.Optional(typebox_1.Type.String()),
    })),
});
