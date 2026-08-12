"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApiRoot = exports.projectApiRoot = void 0;
const sdk_client_v2_1 = require("@commercetools/sdk-client-v2");
const platform_sdk_1 = require("@commercetools/platform-sdk");
const config_1 = require("../config/config");
const authMiddlewareOptions = {
    host: config_1.config.authUrl,
    projectKey: config_1.config.projectKey,
    credentials: {
        clientId: config_1.config.clientId,
        clientSecret: config_1.config.clientSecret,
    },
};
const httpMiddlewareOptions = {
    host: config_1.config.apiUrl,
};
const ctpClient = new sdk_client_v2_1.ClientBuilder()
    .withClientCredentialsFlow(authMiddlewareOptions)
    .withHttpMiddleware(httpMiddlewareOptions)
    .build();
exports.projectApiRoot = (0, platform_sdk_1.createApiBuilderFromCtpClient)(ctpClient).withProjectKey({ projectKey: config_1.config.projectKey });
// Alias used by order.service.ts
const getApiRoot = () => exports.projectApiRoot;
exports.getApiRoot = getApiRoot;
