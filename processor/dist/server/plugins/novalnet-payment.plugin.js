"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const payment_sdk_1 = require("../../payment-sdk");
const novalnet_payment_route_1 = require("../../routes/novalnet-payment.route");
const novalnet_payment_service_1 = require("../../services/novalnet-payment.service");
async function default_1(server) {
    const novalnetPaymentService = new novalnet_payment_service_1.NovalnetPaymentService({
        ctCartService: payment_sdk_1.paymentSDK.ctCartService,
        ctPaymentService: payment_sdk_1.paymentSDK.ctPaymentService,
    });
    await server.register(novalnet_payment_route_1.paymentRoutes, {
        paymentService: novalnetPaymentService,
        sessionHeaderAuthHook: payment_sdk_1.paymentSDK.sessionHeaderAuthHookFn,
    });
}
