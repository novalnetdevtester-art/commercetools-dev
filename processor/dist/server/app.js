"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const payment_sdk_1 = require("../payment-sdk");
const novalnet_payment_service_1 = require("../services/novalnet-payment.service");
const paymentService = new novalnet_payment_service_1.NovalnetPaymentService({
    ctCartService: payment_sdk_1.paymentSDK.ctCartService,
    ctPaymentService: payment_sdk_1.paymentSDK.ctPaymentService,
});
exports.app = {
    services: {
        paymentService,
    },
};
