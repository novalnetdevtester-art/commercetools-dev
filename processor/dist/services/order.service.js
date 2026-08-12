"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderByOrderNumber = getOrderByOrderNumber;
exports.getOrderIdFromOrderNumber = getOrderIdFromOrderNumber;
const ct_client_1 = require("../utils/ct-client");
const logger_1 = require("../libs/logger");
async function getOrderByOrderNumber(orderNumber) {
    try {
        const response = await ct_client_1.projectApiRoot
            .orders()
            .withOrderNumber({ orderNumber })
            .get()
            .execute();
        return response.body;
    }
    catch (error) {
        logger_1.log.error("Error fetching order by order number", { orderNumber, error });
        return null;
    }
}
async function getOrderIdFromOrderNumber(orderNumber) {
    const order = await getOrderByOrderNumber(orderNumber);
    return order?.id ?? null;
}
