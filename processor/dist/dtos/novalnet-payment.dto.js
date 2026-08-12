"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentRequestSchema = exports.PaymentOutcomeSchema = exports.PaymentResponseSchema = exports.PaymentMethodType = exports.PaymentOutcome = void 0;
const typebox_1 = require("@sinclair/typebox");
var PaymentOutcome;
(function (PaymentOutcome) {
    PaymentOutcome["AUTHORIZED"] = "Authorized";
    PaymentOutcome["REJECTED"] = "Rejected";
})(PaymentOutcome || (exports.PaymentOutcome = PaymentOutcome = {}));
var PaymentMethodType;
(function (PaymentMethodType) {
    PaymentMethodType["INVOICE"] = "Invoice";
    PaymentMethodType["PREPAYMENT"] = "Prepayment";
    PaymentMethodType["GUARANTEED_INVOICE"] = "Invoice with payment guarantee";
    PaymentMethodType["GUARANTEED_SEPA"] = "Direct Debit SEPA with payment guarantee";
    PaymentMethodType["IDEAL"] = "ideal | Wero";
    PaymentMethodType["PAYPAL"] = "PayPal";
    PaymentMethodType["ONLINE_BANK_TRANSFER"] = "Online bank transfer";
    PaymentMethodType["ALIPAY"] = "Alipay";
    PaymentMethodType["BANCONTACT"] = "Bancontact";
    PaymentMethodType["BLIK"] = "Blik";
    PaymentMethodType["EPS"] = "eps";
    PaymentMethodType["MBWAY"] = "MB Way";
    PaymentMethodType["MULTIBANCO"] = "Multibanco";
    PaymentMethodType["POSTFINANCE"] = "PostFinance E-Finance";
    PaymentMethodType["POSTFINANCE_CARD"] = "PostFinance Card";
    PaymentMethodType["PRZELEWY24"] = "Przelewy24";
    PaymentMethodType["TRUSTLY"] = "Trustly";
    PaymentMethodType["TWINT"] = "TWINT";
    PaymentMethodType["WECHATPAY"] = "wechatpay";
    PaymentMethodType["SEPA"] = "Direct Debit SEPA";
    PaymentMethodType["ACH"] = "Direct Debit ACH";
    PaymentMethodType["CREDITCARD"] = "Credit/Debit Cards";
})(PaymentMethodType || (exports.PaymentMethodType = PaymentMethodType = {}));
exports.PaymentResponseSchema = typebox_1.Type.Object({
    paymentReference: typebox_1.Type.String(),
    txnSecret: typebox_1.Type.Optional(typebox_1.Type.String()),
    novalnetResponse: typebox_1.Type.Optional(typebox_1.Type.String()),
    transactionStatus: typebox_1.Type.Optional(typebox_1.Type.String()),
    transactionStatusText: typebox_1.Type.Optional(typebox_1.Type.String()),
});
exports.PaymentOutcomeSchema = typebox_1.Type.Enum(PaymentOutcome);
exports.PaymentRequestSchema = typebox_1.Type.Object({
    paymentMethod: typebox_1.Type.Object({
        type: typebox_1.Type.String(),
        accHolder: typebox_1.Type.Optional(typebox_1.Type.String()),
        birthdate: typebox_1.Type.Optional(typebox_1.Type.String()),
        iban: typebox_1.Type.Optional(typebox_1.Type.String()),
        bic: typebox_1.Type.Optional(typebox_1.Type.String()),
        accountNumber: typebox_1.Type.Optional(typebox_1.Type.String()),
        routingNumber: typebox_1.Type.Optional(typebox_1.Type.String()),
        panHash: typebox_1.Type.Optional(typebox_1.Type.String()),
        uniqueId: typebox_1.Type.Optional(typebox_1.Type.String()),
        doRedirect: typebox_1.Type.Optional(typebox_1.Type.String()),
        returnUrl: typebox_1.Type.Optional(typebox_1.Type.String()),
    }),
    paymentOutcome: exports.PaymentOutcomeSchema,
    lang: typebox_1.Type.Optional(typebox_1.Type.String()),
    path: typebox_1.Type.Optional(typebox_1.Type.String()),
});
