"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const payment_sdk_1 = require("../../payment-sdk");
const operation_route_1 = require("../../routes/operation.route");
const app_1 = require("../app");
async function default_1(server) {
    await server.register(operation_route_1.operationsRoute, {
        prefix: "/operations",
        paymentService: app_1.app.services.paymentService,
        jwtAuthHook: payment_sdk_1.paymentSDK.jwtAuthHookFn,
        oauth2AuthHook: payment_sdk_1.paymentSDK.oauth2AuthHookFn,
        sessionHeaderAuthHook: payment_sdk_1.paymentSDK.sessionHeaderAuthHookFn,
        authorizationHook: payment_sdk_1.paymentSDK.authorityAuthorizationHookFn,
    });
}
