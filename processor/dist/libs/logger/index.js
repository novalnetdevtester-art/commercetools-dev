"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = void 0;
const loggers_1 = require("@commercetools-backend/loggers");
const connect_payments_sdk_1 = require("@commercetools/connect-payments-sdk");
const context_1 = require("../fastify/context/context");
const config_1 = require("../../config/config");
exports.log = (0, loggers_1.createApplicationLogger)({
    formatters: [
        (0, connect_payments_sdk_1.defaultFieldsFormatter)({
            projectKey: config_1.config.projectKey,
            version: process.env.npm_package_version,
            name: process.env.npm_package_name,
            correlationId: () => (0, context_1.getRequestContext)().correlationId,
            pathTemplate: () => (0, context_1.getRequestContext)().pathTemplate,
            path: () => (0, context_1.getRequestContext)().path,
        }),
    ],
});
