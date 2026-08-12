"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRoot = exports.initCustomTypes = exports.createOrderPaymentCommentsType = exports.createTransactionCommentsType = void 0;
const ct_client_1 = require("./ct-client");
Object.defineProperty(exports, "apiRoot", { enumerable: true, get: function () { return ct_client_1.projectApiRoot; } });
const logger_1 = require("../libs/logger");
const createTransactionCommentsType = async () => {
    try {
        await ct_client_1.projectApiRoot
            .types()
            .withKey({ key: "novalnet-custom-field" })
            .get()
            .execute();
        logger_1.log.info("[custom-types] novalnet-custom-field type already exists — skipping creation");
        return;
    }
    catch {
        logger_1.log.info("[custom-types] novalnet-custom-field type not found — creating");
    }
    try {
        await ct_client_1.projectApiRoot
            .types()
            .post({
            body: {
                key: "novalnet-custom-field",
                name: { en: "Novalnet Transaction Comments" },
                resourceTypeIds: ["transaction"],
                fieldDefinitions: [
                    {
                        name: "transactionComments",
                        label: { en: "Transaction Comments" },
                        type: { name: "String" },
                        required: false,
                    },
                ],
            },
        })
            .execute();
    }
    catch (err) {
        logger_1.log.error("[custom-types] Failed to create novalnet-custom-field type", err);
        throw err;
    }
    logger_1.log.info("[custom-types] novalnet-custom-field type created successfully");
};
exports.createTransactionCommentsType = createTransactionCommentsType;
const createOrderPaymentCommentsType = async () => {
    try {
        await ct_client_1.projectApiRoot
            .types()
            .withKey({ key: "order-payment-comments" })
            .get()
            .execute();
        logger_1.log.info("[custom-types] order-payment-comments type already exists — skipping creation");
        return;
    }
    catch {
        logger_1.log.info("[custom-types] order-payment-comments type not found — creating");
    }
    try {
        await ct_client_1.projectApiRoot
            .types()
            .post({
            body: {
                key: "order-payment-comments",
                name: { en: "Order Payment Comments" },
                resourceTypeIds: ["order"],
                fieldDefinitions: [
                    {
                        name: "paymentComments",
                        label: { en: "Payment Comments" },
                        type: { name: "String" },
                        required: false,
                    },
                ],
            },
        })
            .execute();
    }
    catch (err) {
        logger_1.log.error("[custom-types] Failed to create order-payment-comments type", err);
        throw err;
    }
    logger_1.log.info("[custom-types] order-payment-comments type created successfully");
};
exports.createOrderPaymentCommentsType = createOrderPaymentCommentsType;
const initCustomTypes = async () => {
    await (0, exports.createTransactionCommentsType)();
    await (0, exports.createOrderPaymentCommentsType)();
};
exports.initCustomTypes = initCustomTypes;
