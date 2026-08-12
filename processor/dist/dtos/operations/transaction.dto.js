"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionResponse = exports.TransactionStatusState = exports.TransactionDraft = void 0;
const typebox_1 = require("@sinclair/typebox");
exports.TransactionDraft = typebox_1.Type.Object({
    cartId: typebox_1.Type.String({ format: "uuid" }),
    paymentInterface: typebox_1.Type.String({ format: "uuid" }),
    amount: typebox_1.Type.Optional(typebox_1.Type.Object({
        centAmount: typebox_1.Type.Number(),
        currencyCode: typebox_1.Type.String(),
    })),
    futureOrderNumber: typebox_1.Type.Optional(typebox_1.Type.String()),
});
const TransactionStatePending = typebox_1.Type.Literal("Pending", {
    description: "The authorization/capture has not happened yet. Most likely because we need to receive notification.",
});
const TransactionStateFailed = typebox_1.Type.Literal("Failed", {
    description: "Any error that occured for which the system can't recover automatically from.",
});
const TransactionStateComplete = typebox_1.Type.Literal("Completed", {
    description: "If there is a successful authorization/capture on the payment-transaction.",
});
exports.TransactionStatusState = typebox_1.Type.Union([
    TransactionStateComplete,
    TransactionStateFailed,
    TransactionStatePending,
]);
exports.TransactionResponse = typebox_1.Type.Object({
    transactionStatus: typebox_1.Type.Object({
        state: exports.TransactionStatusState,
        errors: typebox_1.Type.Array(typebox_1.Type.Object({
            code: typebox_1.Type.Literal("PaymentRejected"),
            message: typebox_1.Type.String(),
        })),
    }),
});
