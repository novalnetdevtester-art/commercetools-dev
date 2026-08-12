"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthErrorResponse = exports.ErrorResponse = exports.ErrorObject = void 0;
const typebox_1 = require("@sinclair/typebox");
/**
 * Represents https://docs.commercetools.com/api/errors#errorobject
 */
exports.ErrorObject = typebox_1.Type.Object({
    code: typebox_1.Type.String(),
    message: typebox_1.Type.String(),
}, { additionalProperties: true });
/**
 * Represents https://docs.commercetools.com/api/errors#errorresponse
 */
exports.ErrorResponse = typebox_1.Type.Object({
    statusCode: typebox_1.Type.Integer(),
    message: typebox_1.Type.String(),
    errors: typebox_1.Type.Array(exports.ErrorObject),
});
/**
 * Represents https://docs.commercetools.com/api/errors#autherrorresponse
 */
exports.AuthErrorResponse = typebox_1.Type.Composite([
    exports.ErrorResponse,
    typebox_1.Type.Object({
        error: typebox_1.Type.String(),
        error_description: typebox_1.Type.Optional(typebox_1.Type.String()),
    }),
]);
