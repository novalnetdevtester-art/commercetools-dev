import autoLoad from "@fastify/autoload";
import cors from "@fastify/cors";
import fastifyFormBody from "@fastify/formbody";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { join } from "path";
import { config } from "../config/config";
import { requestContextPlugin } from "../libs/fastify/context/context";
import { errorHandler } from "../libs/fastify/error-handler";

export const setupFastify = async () => {
  const server = Fastify({
    logger: {
      level: config.loggerLevel,
    },
    genReqId: () => randomUUID().toString(),
    requestIdHeader: 'x-request-id',
    logController: { requestIdLogLabel: 'requestId' },
  });

  server.setErrorHandler(errorHandler);

  await server.register(cors, {
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Correlation-ID",
      "X-Request-ID",
      "X-Session-ID",
    ],
    origin: "*",
  });

  await server.register(fastifyFormBody);

  await server.register(requestContextPlugin);

  await server.register(autoLoad, {
    dir: join(__dirname, "plugins"),
  });

  return server;
};
