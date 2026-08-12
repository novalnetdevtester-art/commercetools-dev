"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestContextPlugin = exports.getFutureOrderNumberFromContext = exports.getMerchantReturnUrlFromContext = exports.getProcessorUrlFromContext = exports.getPaymentInterfaceFromContext = exports.getAllowedPaymentMethodsFromContext = exports.getCartIdFromContext = exports.getCtSessionIdFromContext = exports.updateRequestContext = exports.setRequestContext = exports.getRequestContext = void 0;
const paymentSdk = __importStar(require("@commercetools/connect-payments-sdk"));
const request_context_1 = require("@fastify/request-context");
const crypto_1 = require("crypto");
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const getRequestContext = () => {
    return request_context_1.requestContext.get("request") ?? {};
};
exports.getRequestContext = getRequestContext;
const setRequestContext = (ctx) => {
    request_context_1.requestContext.set("request", ctx);
};
exports.setRequestContext = setRequestContext;
const updateRequestContext = (ctx) => {
    const currentContext = (0, exports.getRequestContext)();
    (0, exports.setRequestContext)({
        ...currentContext,
        ...ctx,
    });
};
exports.updateRequestContext = updateRequestContext;
const getCtSessionIdFromContext = () => {
    const contextData = (0, exports.getRequestContext)();
    return paymentSdk.getCtSessionIdFromContext(contextData);
};
exports.getCtSessionIdFromContext = getCtSessionIdFromContext;
const getCartIdFromContext = () => {
    const contextData = (0, exports.getRequestContext)();
    return paymentSdk.getCartIdFromContext(contextData);
};
exports.getCartIdFromContext = getCartIdFromContext;
const getAllowedPaymentMethodsFromContext = () => {
    const contextData = (0, exports.getRequestContext)();
    return paymentSdk.getAllowedPaymentMethodsFromContext(contextData);
};
exports.getAllowedPaymentMethodsFromContext = getAllowedPaymentMethodsFromContext;
const getPaymentInterfaceFromContext = () => {
    const contextData = (0, exports.getRequestContext)();
    return paymentSdk.getPaymentInterfaceFromContext(contextData);
};
exports.getPaymentInterfaceFromContext = getPaymentInterfaceFromContext;
const getProcessorUrlFromContext = () => {
    const contextData = (0, exports.getRequestContext)();
    return paymentSdk.getProcessorUrlFromContext(contextData);
};
exports.getProcessorUrlFromContext = getProcessorUrlFromContext;
const getMerchantReturnUrlFromContext = () => {
    const contextData = (0, exports.getRequestContext)();
    return paymentSdk.getMerchantReturnUrlFromContext(contextData);
};
exports.getMerchantReturnUrlFromContext = getMerchantReturnUrlFromContext;
const getFutureOrderNumberFromContext = () => {
    const contextData = (0, exports.getRequestContext)();
    return paymentSdk.getFutureOrderNumberFromContext(contextData);
};
exports.getFutureOrderNumberFromContext = getFutureOrderNumberFromContext;
exports.requestContextPlugin = (0, fastify_plugin_1.default)(async (fastify) => {
    // Enhance the request object with a correlationId property
    fastify.decorateRequest("correlationId", "");
    // Propagate the correlationId from the request header to the request object
    fastify.addHook("onRequest", (req, reply, done) => {
        req.correlationId = req.headers["x-correlation-id"]
            ? req.headers["x-correlation-id"]
            : undefined;
        done();
    });
    // Register the request context
    await fastify.register(request_context_1.fastifyRequestContext, {
        defaultStoreValues: (req) => ({
            request: {
                path: req.url,
                pathTemplate: req.routeOptions.url,
                pathParams: req.params,
                query: req.query,
                correlationId: req.correlationId || (0, crypto_1.randomUUID)().toString(),
                requestId: req.id,
            },
        }),
        hook: "onRequest",
    });
});
