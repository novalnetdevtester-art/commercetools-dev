"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupFastify = void 0;
const autoload_1 = __importDefault(require("@fastify/autoload"));
const cors_1 = __importDefault(require("@fastify/cors"));
const formbody_1 = __importDefault(require("@fastify/formbody"));
const fastify_1 = __importDefault(require("fastify"));
const node_crypto_1 = require("node:crypto");
const path_1 = require("path");
const config_1 = require("../config/config");
const context_1 = require("../libs/fastify/context/context");
const error_handler_1 = require("../libs/fastify/error-handler");
const setupFastify = async () => {
    const server = (0, fastify_1.default)({
        logger: {
            level: config_1.config.loggerLevel,
        },
        genReqId: () => (0, node_crypto_1.randomUUID)().toString(),
        requestIdLogLabel: "requestId",
        requestIdHeader: "x-request-id",
    });
    server.setErrorHandler(error_handler_1.errorHandler);
    await server.register(cors_1.default, {
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-Correlation-ID",
            "X-Request-ID",
            "X-Session-ID",
        ],
        origin: "*",
    });
    await server.register(formbody_1.default);
    await server.register(context_1.requestContextPlugin);
    await server.register(autoload_1.default, {
        dir: (0, path_1.join)(__dirname, "plugins"),
    });
    return server;
};
exports.setupFastify = setupFastify;
