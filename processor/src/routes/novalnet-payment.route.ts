import { SessionHeaderAuthenticationHook } from "@commercetools/connect-payments-sdk";
import { getOrderIdFromOrderNumber } from "../services/order.service";
import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { getCartIdFromContext } from "../libs/fastify/context/context";
import crypto from "crypto";
import {
  PaymentRequestSchema,
  PaymentRequestSchemaDTO,
  PaymentResponseSchema,
  PaymentResponseSchemaDTO,
} from "../dtos/novalnet-payment.dto";
import { NovalnetPaymentService } from "../services/novalnet-payment.service";
import { log } from "../libs/logger";
import { getConfig } from "../config/config";
type PaymentRoutesOptions = {
  paymentService: NovalnetPaymentService;
  sessionHeaderAuthHook: SessionHeaderAuthenticationHook;
};
export const paymentRoutes = async (
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & PaymentRoutesOptions,
) => {
  fastify.post<{
    Body: PaymentRequestSchemaDTO;
    Reply: PaymentResponseSchemaDTO;
  }>(
    "/directPayment",
    {
      preHandler: [opts.sessionHeaderAuthHook.authenticate()],
      schema: {
        body: PaymentRequestSchema,
        response: {
          200: PaymentResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        log.info("Direct payment request received", {
          paymentMethod: request.body?.paymentMethod?.type,
          paymentOutcome: request.body?.paymentOutcome,
        });

        const resp = await opts.paymentService.createDirectPayment({
          data: request.body,
        });

        log.info("Direct payment response", {
          transactionStatus: resp?.transactionStatus,
          paymentReference: resp?.paymentReference,
        });

        if (resp?.transactionStatus === "FAILURE") {
          log.error("Direct payment failed", {
            transactionStatus: resp?.transactionStatus,
            transactionStatusText: resp?.transactionStatusText,
          });

        const baseUrl = request.body.path + "/checkout";
        return reply.code(302).redirect(baseUrl);

        }

        return reply.code(200).send(resp);
      } catch (error) {
        log.error("Direct payment processing error", {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        return reply.code(500).send({
          paymentReference: "",
          transactionStatus: "FAILURE",
          transactionStatusText: "Payment processing failed",
        });
      }
    }
  );

  fastify.post<{
    Body: PaymentRequestSchemaDTO;
    Reply: PaymentResponseSchemaDTO;
  }>(
    "/redirectPayment",
    {
      preHandler: [opts.sessionHeaderAuthHook.authenticate()],

      schema: {
        body: PaymentRequestSchema,
        response: {
          200: PaymentResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
          log.info("Redirect payment request received", {
          paymentMethod: request.body?.paymentMethod?.type,
          paymentOutcome: request.body?.paymentOutcome,
        });
        const resp = await opts.paymentService.createRedirectPayment({
          data: request.body,
        });
        log.info("Redirect payment response", {
          transactionStatus: resp?.transactionStatus,
          paymentReference: resp?.paymentReference,
        });
        return reply.status(200).send(resp);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        log.error("Error details:", {
          message: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined,
        });
        return reply.status(500).send({ paymentReference: "error" });
      }
    },
  );

  fastify.get("/success", async (request, reply) => {
    const query = request.query as {
      tid?: string;
      status?: string;
      checksum?: string;
      txn_secret?: string;
      paymentReference?: string;
      ctsid?: string;
      orderNumber?: string;
      ctPaymentID?: string;
      pspReference?: string;
      lang?: string;
      path?: string;
    };

    const accessKey = String(getConfig()?.novalnetPublicKey ?? "");
    const reverseKey = accessKey.split("").reverse().join("");

    if (query.tid && query.status && query.checksum && query.txn_secret) {
      const tokenString = `${query.tid}${query.txn_secret}${query.status}${reverseKey}`;
      const orderNumber = query.orderNumber as string | undefined;

      if (!orderNumber) {
        return reply.code(400).send("Missing orderNumber");
      }
      const generatedChecksum = crypto
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

          const orderId = await getOrderIdFromOrderNumber(orderNumber);
          if (!orderId) return reply.code(404).send("Order not found");
          const requestPath = requestData?.path ?? "";
          const requestlang = requestData?.lang ?? "";
          const thirdPartyUrl =
            requestPath + "/" + requestlang + "/thank-you/?orderId=" + orderId;
          return reply.code(302).redirect(thirdPartyUrl);
        } catch (error) {
          log.error("Error processing payment:", error);
          return reply.code(400).send("Payment processing failed");
        }
      } else {
        log.error("Checksum verification failed", {
          expected: generatedChecksum,
          received: query.checksum,
        });
        return reply.code(400).send("Checksum verification failed.");
      }
    } else {
      return reply.code(400).send("Missing required query parameters.");
    }
  });

  fastify.get("/failure", async (request, reply) => {
    const query = request.query as {
      paymentReference?: string;
      ctsid?: string;
      orderNumber?: string;
      ctPaymentID?: string;
      pspReference?: string;
      tid?: string;
      status_text?: string;
      payment_type?: string;
      path?: string;
    };

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
    } catch (error) {
      log.error("Error processing payment:", error);
      return reply.code(400).send("Payment processing failed");
    }
  });

  fastify.post<{ Body: any }>("/webhook", async (req, reply) => {
    try {
      const body = req.body as Record<string, any> | any[];
      const responseData = Array.isArray(body) ? body : [body];
      const webhook = responseData[0] as Record<string, any>;
      const serviceResponse =
        await opts.paymentService.createWebhook(responseData);
      return reply.code(200).send({
        success: true,
        data: serviceResponse,
      });
    } catch (error) {
      log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Webhook processing failed",
      });
    }
  });

  fastify.post("/getCreditcardConfig", async (req, reply) => {
    const config = getConfig();
  
    const clientKey = String(
      config?.novalnetClientkey ?? "",
    );
  
    const inline = String(
      config?.novalnet_CREDITCARD_DisplayInline ?? "0",
    );
  
    return reply.code(200).send({
      paymentReference: clientKey,
      inline,
    });
  });

  fastify.post<{ Body: PaymentRequestSchemaDTO }>(
    "/getCustomerAddress",
    async (
      req: FastifyRequest<{ Body: PaymentRequestSchemaDTO }>,
      reply: FastifyReply,
    ) => {
      const cartId = getCartIdFromContext();
      const resp = await opts.paymentService.getCustomerAddress({
        data: req.body,
        cartId,
      } as any);
      return reply.code(200).send(resp);
    },
  );
};
