"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRoutes = void 0;
const order_service_1 = require("../services/order.service");
const context_1 = require("../libs/fastify/context/context");
const crypto_1 = __importDefault(require("crypto"));
const novalnet_payment_dto_1 = require("../dtos/novalnet-payment.dto");
const logger_1 = require("../libs/logger");
const config_1 = require("../config/config");
const paymentRoutes = async (fastify, opts) => {
    fastify.post("/directPayment", {
        preHandler: [opts.sessionHeaderAuthHook.authenticate()],
        schema: {
            body: novalnet_payment_dto_1.PaymentRequestSchema,
            response: {
                200: novalnet_payment_dto_1.PaymentResponseSchema,
            },
        },
    }, async (request, reply) => {
        const resp = await opts.paymentService.createDirectPayment({
            data: request.body,
        });
        if (resp?.transactionStatus == "FAILURE") {
            const baseUrl = request.body.path + "/checkout";
            return reply.code(302).redirect(baseUrl);
        }
        return reply.status(200).send(resp);
    });
    fastify.post("/redirectPayment", {
        preHandler: [opts.sessionHeaderAuthHook.authenticate()],
        schema: {
            body: novalnet_payment_dto_1.PaymentRequestSchema,
            response: {
                200: novalnet_payment_dto_1.PaymentResponseSchema,
            },
        },
    }, async (request, reply) => {
        try {
            const resp = await opts.paymentService.createRedirectPayment({
                data: request.body,
            });
            return reply.status(200).send(resp);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            logger_1.log.error("Error details:", {
                message: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
                name: error instanceof Error ? error.name : undefined,
            });
            return reply.status(500).send({ paymentReference: "error" });
        }
    });
    fastify.get("/success", async (request, reply) => {
        const query = request.query;
        const accessKey = String((0, config_1.getConfig)()?.novalnetPublicKey ?? "");
        const reverseKey = accessKey.split("").reverse().join("");
        if (query.tid && query.status && query.checksum && query.txn_secret) {
            const tokenString = `${query.tid}${query.txn_secret}${query.status}${reverseKey}`;
            const orderNumber = query.orderNumber;
            if (!orderNumber) {
                return reply.code(400).send("Missing orderNumber");
            }
            const generatedChecksum = crypto_1.default
                .createHash("sha256")
                .update(tokenString)
                .digest("hex");
            if (generatedChecksum === query.checksum) {
                try {
                    const requestData = {
                        interfaceId: query.tid,
                        ctId: query.ctsid,
                        ctPaymentId: query.ctPaymentID,
                        pspReference: query.pspReference,
                        lang: query.lang,
                        path: query.path,
                    };
                    const jsonBody = JSON.stringify(requestData);
                    const result = await opts.paymentService.transactionUpdate({
                        data: jsonBody,
                    });
                    const orderId = await (0, order_service_1.getOrderIdFromOrderNumber)(orderNumber);
                    if (!orderId)
                        return reply.code(404).send("Order not found");
                    const requestPath = requestData?.path ?? "";
                    const requestlang = requestData?.lang ?? "";
                    const thirdPartyUrl = requestPath + "/" + requestlang + "/thank-you/?orderId=" + orderId;
                    return reply.code(302).redirect(thirdPartyUrl);
                }
                catch (error) {
                    logger_1.log.error("Error processing payment:", error);
                    return reply.code(400).send("Payment processing failed");
                }
            }
            else {
                logger_1.log.error("Checksum verification failed", {
                    expected: generatedChecksum,
                    received: query.checksum,
                });
                return reply.code(400).send("Checksum verification failed.");
            }
        }
        else {
            return reply.code(400).send("Missing required query parameters.");
        }
    });
    fastify.get("/failure", async (request, reply) => {
        const query = request.query;
        const baseUrl = query.path + "/checkout";
        const redirectUrl = new URL(baseUrl);
        if (query.paymentReference) {
            redirectUrl.searchParams.set("paymentReference", query.paymentReference);
        }
        if (query.ctsid) {
            redirectUrl.searchParams.set("ctsid", query.ctsid);
        }
        if (query.orderNumber) {
            redirectUrl.searchParams.set("orderNumber", query.orderNumber);
        }
        if (query.ctPaymentID) {
            redirectUrl.searchParams.set("ctPaymentID", query.ctPaymentID);
        }
        if (query.pspReference) {
            redirectUrl.searchParams.set("pspReference", query.pspReference);
        }
        try {
            const requestData = {
                paymentReference: query.paymentReference,
                ctsid: query.ctsid,
                orderNumber: query.orderNumber,
                ctPaymentID: query.ctPaymentID,
                pspReference: query.pspReference,
                tid: query.tid,
                status_text: query.status_text,
                payment_type: query.payment_type,
            };
            const jsonBody = JSON.stringify(requestData);
            const result = await opts.paymentService.failureResponse({
                data: jsonBody, // send JSON string
            });
            return reply.code(302).redirect(redirectUrl.toString());
        }
        catch (error) {
            logger_1.log.error("Error processing payment:", error);
            return reply.code(400).send("Payment processing failed");
        }
    });
    fastify.post("/webhook", async (req, reply) => {
        try {
            const body = req.body;
            const responseData = Array.isArray(body) ? body : [body];
            const webhook = responseData[0];
            const serviceResponse = await opts.paymentService.createWebhook(responseData);
            return reply.code(200).send({
                success: true,
                data: serviceResponse,
            });
        }
        catch (error) {
            logger_1.log.error(error);
            return reply.code(500).send({
                success: false,
                message: "Webhook processing failed",
            });
        }
    });
    fastify.post("/getconfig", async (req, reply) => {
        const clientKey = String((0, config_1.getConfig)()?.novalnetClientkey ?? "");
        return reply.code(200).send({ paymentReference: clientKey });
    });
    fastify.post("/getCustomerAddress", async (req, reply) => {
        const cartId = (0, context_1.getCartIdFromContext)();
        const resp = await opts.paymentService.getCustomerAddress({
            data: req.body,
            cartId,
        });
        return reply.code(200).send(resp);
    });
};
exports.paymentRoutes = paymentRoutes;
