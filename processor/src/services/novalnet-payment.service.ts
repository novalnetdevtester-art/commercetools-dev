import {
  Cart,
  healthCheckCommercetoolsPermissions,
  statusHandler,
} from "@commercetools/connect-payments-sdk";
import { ConfigResponse, StatusResponse } from "./types/operation.type";
import { Address, Customer, OrderUpdateAction } from "@commercetools/platform-sdk";
import { SupportedPaymentComponentsSchemaDTO } from "../dtos/operations/payment-componets.dto";
import packageJSON from "../../package.json";
import { AbstractPaymentService } from "./abstract-payment.service";
import { getConfig } from "../config/config";
import { appLogger, paymentSDK } from "../payment-sdk";
import crypto, { randomUUID } from "crypto";
import dns from "dns/promises";
import { FastifyRequest } from "fastify";
import {
  CreatePaymentRequest,
  NovalnetPaymentServiceOptions,
} from "./types/novalnet-payment.type";
import {
  PaymentMethodType,
  PaymentResponseSchemaDTO,
} from "../dtos/novalnet-payment.dto";
import {
  getCartIdFromContext,
  getFutureOrderNumberFromContext,
  getMerchantReturnUrlFromContext,
  getPaymentInterfaceFromContext,
} from "../libs/fastify/context/context";
import { log } from "../libs/logger";
import * as Context from "../libs/fastify/context/context";
import {
  createOrderPaymentCommentsType,
  createTransactionCommentsType,
} from "../utils/custom-fields";
import { projectApiRoot } from "../utils/ct-client";
import customObjectService from "./ct-custom-object.service";
import { SupportedLocale, t } from "../i18n";
import { PaymentUpdateAction } from "@commercetools/platform-sdk";
import JSONbig from "json-bigint";
import { mapNovalnetOrderStates } from "./novalnet-order-state.service";
import type {
  NovalnetOrderStateInput,
  NovalnetOrderStates,
} from "./novalnet-order-state.service";

type NovalnetConfig = {
  testMode: string;
  paymentAction: string;
  dueDate: string;
  minimumAmount: string;
  enforce3d: string;
  displayInline: string;
  forceNonGuarantee: string;
};

type TransactionCommentParams = {
  eventTID?: string | null;
  parentTID?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  date?: string | null;
  time?: string | null;
  transactionID?: string | null;
  dueDate?: string | null;
};

function getNovalnetConfigValues(
  type: string,
  config: Record<string, any>,
): NovalnetConfig {
  const upperType = type.toUpperCase();
  return {
    testMode: String(config?.[`novalnet_${upperType}_TestMode`]),
    paymentAction: String(config?.[`novalnet_${upperType}_PaymentAction`]),
    dueDate: String(config?.[`novalnet_${upperType}_DueDate`]),
    minimumAmount: String(config?.[`novalnet_${upperType}_MinimumAmount`]),
    enforce3d: String(config?.[`novalnet_${upperType}_Enforce3d`]),
    displayInline: String(config?.[`novalnet_${upperType}_DisplayInline`]),
    forceNonGuarantee: String(
      config?.[`novalnet_${upperType}_ForceNonGuarantee`],
    ),
  };
}

function getPaymentDueDate(
  paymentType: string,
  configuredDueDate?: number | string | null,
): string {
  let days = Number(configuredDueDate);
  const type = paymentType.toUpperCase();

  if (!configuredDueDate || Number.isNaN(days) || days <= 0) {
    days = 14;
  }

  switch (type) {
    case "DIRECT_DEBIT_SEPA":
    case "GUARANTEED_DIRECT_DEBIT_SEPA":
      days = Math.max(2, Math.min(14, days));
      break;

    case "PREPAYMENT":
      days = Math.max(7, Math.min(28, days));
      break;

    case "INVOICE":
    case "GUARANTEED_INVOICE":
      days = Math.max(8, days);
      break;

    default:
      break;
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + days);

  return dueDate.toISOString().split("T")[0];
}

export class NovalnetPaymentService extends AbstractPaymentService {
  constructor(opts: NovalnetPaymentServiceOptions) {
    super(opts.ctCartService, opts.ctPaymentService);
  }

  public async config(): Promise<ConfigResponse> {
    const config = getConfig();
    return {
      clientKey: config.mockClientKey,
      environment: config.mockEnvironment,
    };
  }

  public async status(): Promise<StatusResponse> {
    const handler = await statusHandler({
      timeout: getConfig().healthCheckTimeout,
      log: appLogger,
      checks: [
        healthCheckCommercetoolsPermissions({
          requiredPermissions: [
            "manage_payments",
            "view_sessions",
            "view_api_clients",
            "manage_orders",
            "introspect_oauth_tokens",
            "manage_checkout_payment_intents",
            "manage_types",
          ],
          ctAuthorizationService: paymentSDK.ctAuthorizationService,
          projectKey: getConfig().projectKey,
        }),
        async () => {
          try {
            const paymentMethods = "card";
            return {
              name: "Mock Payment API",
              status: "UP",
              message: "Mock api is working",
              details: {
                paymentMethods,
              },
            };
          } catch (e) {
            return {
              name: "Mock Payment API",
              status: "DOWN",
              message:
                "The mock payment API is down for some reason. Please check the logs for more details.",
              details: {
                error: e,
              },
            };
          }
        },
      ],
      metadataFn: async () => ({
        name: packageJSON.name,
        description: packageJSON.description,
        "@commercetools/connect-payments-sdk":
          packageJSON.dependencies["@commercetools/connect-payments-sdk"],
      }),
    })();
    return handler.body;
  }

  public async getSupportedPaymentComponents(): Promise<SupportedPaymentComponentsSchemaDTO> {
    return {
      components: [
        { type: PaymentMethodType.INVOICE },
        { type: PaymentMethodType.PREPAYMENT },
        { type: PaymentMethodType.GUARANTEED_INVOICE },
        { type: PaymentMethodType.GUARANTEED_SEPA },
        { type: PaymentMethodType.IDEAL },
        { type: PaymentMethodType.PAYPAL },
        { type: PaymentMethodType.ONLINE_BANK_TRANSFER },
        { type: PaymentMethodType.ALIPAY },
        { type: PaymentMethodType.BANCONTACT },
        { type: PaymentMethodType.BLIK },
        { type: PaymentMethodType.EPS },
        { type: PaymentMethodType.MBWAY },
        { type: PaymentMethodType.MULTIBANCO },
        { type: PaymentMethodType.POSTFINANCE },
        { type: PaymentMethodType.POSTFINANCE_CARD },
        { type: PaymentMethodType.PRZELEWY24 },
        { type: PaymentMethodType.TRUSTLY },
        { type: PaymentMethodType.TWINT },
        { type: PaymentMethodType.WECHATPAY },
        { type: PaymentMethodType.SEPA },
        { type: PaymentMethodType.ACH },
        { type: PaymentMethodType.CREDITCARD },
      ],
    };
  }

  public ctcc(cart: Cart) {
    return paymentSDK.ctCartService.getOneShippingAddress({ cart });
  }

  public ctbb(cart: Cart) {
    return cart.billingAddress ?? null;
  }

  public async failureResponse({ data }: { data: any }) {
    const parsedData = typeof data === "string" ? JSON.parse(data) : data;

    log.info("[failureResponse] Processing payment failure", {
      ctPaymentID: parsedData.ctPaymentID,
      pspReference: parsedData.pspReference,
    });

    await createTransactionCommentsType();

    const raw = await this.ctPaymentService.getPayment({
      id: parsedData.ctPaymentID,
    } as any);

    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;

    const tx = payment.transactions?.find(
      (t: any) => t.interactionId === parsedData.pspReference,
    );

    if (!tx) {
      throw new Error("Transaction not found");
    }

    const txId = tx.id;

    if (!txId) {
      throw new Error("Transaction missing id");
    }

    const transactionComments = `Novalnet Transaction ID: ${
      parsedData.tid ?? "NN/A"
    }\nPayment Type: ${parsedData.payment_type ?? "NN/A"}\n${
      parsedData.status_text ?? "NN/A"
    }`;

    const actions: PaymentUpdateAction[] = [];
    
    if (!tx.custom?.type) {
      actions.push({
        action: "setTransactionCustomType",
        transactionId: txId,
        type: {
          key: "novalnet-custom-field",
          typeId: "type",
        },
      });
    }

    actions.push({
      action: "setTransactionCustomField",
      transactionId: txId,
      name: "transactionComments",
      value: transactionComments,
    });

    actions.push({
      action: "changeTransactionState",
      transactionId: txId,
      state: "Failure",
    });

    await projectApiRoot
      .payments()
      .withId({ ID: parsedData.ctPaymentID })
      .post({
        body: {
          version,
          actions,
        },
      })
      .execute();
    
    log.info("[failureResponse] Payment failure comments saved", {
      ctPaymentID: parsedData.ctPaymentID,
      transactionId: txId,
    });
  }

  public async getCustomerAddress(
    request: CreatePaymentRequest,
  ): Promise<PaymentResponseSchemaDTO> {
    const cartId = request.cartId;
    if (!cartId) {
      log.warn("service-customer-address - missing cartId");
      return { paymentReference: "customAddress" };
    }
    let ctCart: any;
    try {
      ctCart = await this.ctCartService.getCart({ id: cartId });
    } catch (err) {
      log.error("Failed to fetch cart", err);
      return { paymentReference: "customAddress" };
    }

    const shippingAddress: Address | null = ctCart.shippingAddress ?? null;
    const billingAddress: Address | null = ctCart.billingAddress ?? null;
    let firstName: string =
      shippingAddress?.firstName ?? ctCart.customerFirstName ?? "";
    let lastName: string =
      shippingAddress?.lastName ?? ctCart.customerLastName ?? "";
    let email: string = ctCart.customerEmail ?? "";

    if (ctCart.customerId) {
      try {
        const apiRoot =
          (this as any).projectApiRoot ??
          (globalThis as any).projectApiRoot ??
          projectApiRoot;
        const customerRes = await apiRoot
          .customers()
          .withId({ ID: ctCart.customerId })
          .get()
          .execute();

        const ctCustomer: Customer = customerRes.body;
        if (!firstName) firstName = ctCustomer.firstName ?? "";
        if (!lastName) lastName = ctCustomer.lastName ?? "";
        if (!email) email = ctCustomer.email ?? "";
      } catch (err) {
        log.warn("Failed to fetch customer data, using cart only", {
          cartCustomerId: ctCart.customerId,
          error: String(err),
        });
      }
    }
    const result: PaymentResponseSchemaDTO = {
      paymentReference: "customAddress",
      firstName,
      lastName,
      email,
      shippingAddress,
      billingAddress,
    } as any;

    return result;
  }

  public async transactionUpdate({ data }: { data: any }) {
    try {
      const parsedData = typeof data === "string" ? JSON.parse(data) : data;
      if (!parsedData?.ctPaymentId) {
        throw new Error("Missing ctPaymentId in transactionUpdate");
      }

      log.info("[transactionUpdate] Starting transaction update", {
        ctPaymentId: parsedData.ctPaymentId,
        pspReference: parsedData.pspReference,
      });

      const config = getConfig();
      await createTransactionCommentsType();
      await createOrderPaymentCommentsType();
      getMerchantReturnUrlFromContext() || config.merchantReturnUrl;

      const novalnetPayload = {
        transaction: { tid: parsedData?.interfaceId ?? "" },
      };
      const lang = parsedData?.lang as SupportedLocale;

      log.info("[transactionUpdate] Fetching transaction details from Novalnet", {
        tid: parsedData?.interfaceId,
      });

      let responseData: any;
      try {
        responseData = await this.callNovalnet(
          "https://payport.novalnet.de/v2/transaction/details",
          novalnetPayload,
        );
      } catch (err) {
        log.error("[transactionUpdate] Failed to fetch Novalnet transaction details", err);
        throw new Error("Payment verification failed");
      }

      const pspReference = parsedData.pspReference;
      if (!pspReference) {
        throw new Error("Missing pspReference");
      }

      const tid = responseData?.transaction?.tid ?? "";
      const paymentType = responseData?.transaction?.payment_type ?? "";
      const isTestMode = responseData?.transaction?.test_mode == 1;
      const status = String(responseData?.transaction?.status ?? "").toUpperCase();
      const { state, transactionType } = this.getTransactionStatus(status);
      const statusCode = responseData?.transaction?.status_code ?? "";
      const locale = lang === "en" ? "en" : "de";
      const transactionComments = [
        t(locale, "payment.transactionId", { tid }),
        t(locale, "payment.paymentType", { type: paymentType }),
        isTestMode ? t(locale, "payment.testMode") : "",
      ].join("\n");

      const { txId } = await this.updatePaymentTransaction({
        paymentId: parsedData.ctPaymentId,
        pspReference,
        transactionComments,
        statusCode,
        state,
        appendComments: false,
        setCustomType: true,
        errorMessage: "Transaction not found for PSP reference",
      });

      await this.addSettlementTransactionIfRequired({
        paymentId: parsedData.ctPaymentId,
        pspReference,
        amount: responseData?.transaction?.amount,
        currency: responseData?.transaction?.currency,
        transactionType,
        status,
      });
		
      const updatedPaymentRoot = await projectApiRoot
        .payments()
        .withId({ ID: parsedData.ctPaymentId })
        .get()
        .execute();

      const orderSearch = await projectApiRoot.orders().get({
        queryArgs: {
          where: `paymentInfo(payments(id="${parsedData.ctPaymentId}"))`,
          limit: 1,
        },
      }).execute();

      const orderRoot = orderSearch.body.results?.[0];
      if (!orderRoot) {
        log.info("[transactionUpdate] No order linked to this payment – nothing to sync yet", {
          ctPaymentId: parsedData.ctPaymentId,
        });
        return;
      }

      const orderId = orderRoot.id;
      const updatedTransaction = updatedPaymentRoot.body.transactions?.find(
        (t) => t.id === txId,
      );
      const paymentComment =
        updatedTransaction?.custom?.fields?.transactionComments ?? transactionComments;

      const order = await projectApiRoot.orders().withId({ ID: orderId }).get().execute();
      let canWriteOrderComment = true;
      if (order.body.custom?.type) {
        const type = await projectApiRoot.types().withKey({ key: "order-payment-comments" }).get().execute();
        if (order.body.custom.type.id !== type.body.id) {
          log.warn("[ORDER_SYNC] Order uses another Custom Type; comment remains on Payment", { orderId });
          canWriteOrderComment = false;
        }
      }
      const commentActions: OrderUpdateAction[] = [];
      if (!order.body.custom?.type) {
        commentActions.push({
          action: "setCustomType",
          type: { key: "order-payment-comments", typeId: "type" },
        });
      }
      commentActions.push({
        action: "setCustomField",
        name: "paymentComments",
        value: paymentComment,
      });
      if (canWriteOrderComment) await projectApiRoot.orders().withId({ ID: orderId }).post({
        body: {
          version: order.body.version,
          actions: commentActions,
        },
      }).execute();

      try {
        const container = "nn-private-data";
        const key = `${parsedData.ctPaymentId}-${pspReference}`;
        await customObjectService.upsert(container, key, {
          tid,
          paymentMethod: paymentType,
          status,
          orderNo: responseData?.transaction?.order_no ?? "",
          cMail: responseData?.customer?.email ?? "",
          additionalInfo: { comments: transactionComments },
        });
      } catch (err) {
        log.error("CustomObject error", err);
        throw err;
      }
		
	 // const orderStates = this.mapNovalnetOrderStates({
	  //  status,
	  //});
	
	  //await this.updateOrderStates({
	  //  paymentId: parsedData.ctPaymentId,
	   // ...orderStates,
	  //});
		
      log.info("[transactionUpdate] Order payment comments synced", {
        orderId,
        ctPaymentId: parsedData.ctPaymentId,
      });

      return {
        paymentReference: responseData?.custom?.paymentRef ?? "",
      };
    } catch (err) {
      log.error("[transactionUpdate] FAILED", err);
      throw err;
    }
  }

  public async createDirectPayment(
    request: CreatePaymentRequest,
  ): Promise<PaymentResponseSchemaDTO> {
    const type = String(request.data?.paymentMethod?.type);
    const config = getConfig();
    const {
      testMode,
      paymentAction,
      dueDate,
      minimumAmount,
      enforce3d,
      displayInline,
      forceNonGuarantee,
    } = getNovalnetConfigValues(type, config);
    await createTransactionCommentsType();
    const ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });

    const deliveryAddress = await this.ctcc(ctCart);
    const billingAddress = await this.ctbb(ctCart);
    const parsedCart = typeof ctCart === "string" ? JSON.parse(ctCart) : ctCart;
    const dueDateValue = getPaymentDueDate(type, dueDate);
    const lang = String(request.data?.lang ?? "en") as SupportedLocale;
    const orderNumber = getFutureOrderNumberFromContext() ?? "";
    const transaction: Record<string, any> = {
      test_mode: Number(testMode) === 0 ? "0" : "1",
      payment_type: String(request.data.paymentMethod.type),
      amount: String(parsedCart?.taxedPrice?.totalGross?.centAmount),
      currency: String(parsedCart?.taxedPrice?.totalGross?.currencyCode),
      order_no: String(orderNumber),
    };
    const deliveryStreet = this.splitStreetByComma(deliveryAddress?.streetName);
    const billingStreet = this.splitStreetByComma(billingAddress?.streetName);

    const deliveryAddressStreetName = deliveryStreet.streetName;
    const deliveryAddressStreetNumber = deliveryStreet.streetNumber;

    const billingAddressStreetName = billingStreet.streetName;
    const billingAddressStreetNumber = billingStreet.streetNumber;

    if (dueDateValue) {
      transaction.due_date = dueDateValue;
    }

    if (
      ["GUARANTEED_DIRECT_DEBIT_SEPA", "GUARANTEED_INVOICE"].includes(
        String(request.data.paymentMethod.type).toUpperCase(),
      )
    ) {
      const paymentType = String(request.data.paymentMethod.type).toUpperCase();

      const sameAddress =
        billingAddress?.city === deliveryAddress?.city &&
        billingAddress?.country === deliveryAddress?.country &&
        billingAddressStreetName === deliveryAddressStreetName &&
        billingAddressStreetNumber === deliveryAddressStreetNumber &&
        billingAddress?.postalCode === deliveryAddress?.postalCode;

      const billingCountry = billingAddress && billingAddress.country;

      const isEur =
        String(parsedCart?.taxedPrice?.totalGross?.currencyCode) === "EUR";

      const orderTotal = Number(
        parsedCart?.taxedPrice?.totalGross?.centAmount ?? 0,
      );
      
      const amountValid = orderTotal >= 999;

      const countryAllowed =
        billingCountry &&
        ["DE", "AT", "CH"].includes(billingCountry);

      const guaranteePayment =
        Boolean(sameAddress) &&
        Boolean(isEur) &&
        Boolean(amountValid) &&
        Boolean(countryAllowed);

      const isForceNonGuarantee =
        forceNonGuarantee !== undefined &&
        forceNonGuarantee !== null &&
        !Number.isNaN(Number(forceNonGuarantee)) &&
        Number(forceNonGuarantee) !== 0;

      if (!guaranteePayment && !isForceNonGuarantee) {
        throw new Error(
        "Guaranteed payment is not available. Please choose another payment method."
        );
      }
		
      if (isForceNonGuarantee && !guaranteePayment) {
        if (paymentType === "GUARANTEED_DIRECT_DEBIT_SEPA") {
          transaction.payment_type = "DIRECT_DEBIT_SEPA";
        }

        if (paymentType === "GUARANTEED_INVOICE") {
          transaction.payment_type = "INVOICE";
        }
      }
    }

    const company = billingAddress?.additionalAddressInfo ?? "";
    
    let birthDate: string | undefined;
    
    const rawBirthDate =
      request.data.paymentMethod?.birthdate ??
      "";
    
    
    if (typeof rawBirthDate === "string" && rawBirthDate.trim()) {
      birthDate = this.formatBirthDateToYMD(rawBirthDate);
    }

    if (
      String(request.data.paymentMethod.type).toUpperCase() === "DIRECT_DEBIT_SEPA" ||
      String(request.data.paymentMethod.type).toUpperCase() === "GUARANTEED_DIRECT_DEBIT_SEPA"
    ) {
      transaction.payment_data = {
        account_holder: String(request.data.paymentMethod.accHolder),
        iban: String(request.data.paymentMethod.iban),
        bic: String(request.data.paymentMethod.bic ?? ""),
      };
    }
    
    if (
      String(request.data.paymentMethod.type).toUpperCase() ===
      "DIRECT_DEBIT_ACH"
    ) {
      transaction.payment_data = {
        account_holder: String(request.data.paymentMethod.accHolder),
        account_number: String(request.data.paymentMethod.accountNumber),
        routing_number: String(request.data.paymentMethod.routingNumber),
      };
    }
    

    const ctPayment = await this.ctPaymentService.createPayment({
      amountPlanned: await this.ctCartService.getPaymentAmount({
        cart: ctCart,
      }),
      paymentMethodInfo: {
        paymentInterface: getPaymentInterfaceFromContext() || "mock",
      },
      ...(ctCart.customerId && {
        customer: { typeId: "customer", id: ctCart.customerId },
      }),
      ...(!ctCart.customerId &&
        ctCart.anonymousId && {
          anonymousId: ctCart.anonymousId,
        }),
    });

    await this.ctCartService.addPayment({
      resource: { id: ctCart.id, version: ctCart.version },
      paymentId: ctPayment.id,
    });

    const pspReference = randomUUID().toString();
    const processorURL = Context.getProcessorUrlFromContext();
    const sessionId = Context.getCtSessionIdFromContext();

    const hookUrl = new URL(
      "/novalnletWebhook",
      processorURL,
    );
    
    transaction.hook_url = hookUrl.toString();

    if (String(request.data.paymentMethod.type).toUpperCase() === "CREDITCARD") {
      transaction.payment_data = {
        pan_hash: String(
          request.data.paymentMethod.panHash ?? "",
        ),
        unique_id: String(
          request.data.paymentMethod.uniqueId ?? "",
        ),
      };

      if (String(enforce3d) === "1") {
        const {
          returnUrl,
          errorReturnUrl
        } =
          this.createPaymentReturnUrls({
            processorURL,
            sessionId,
            paymentReference: ctPayment.id,
            orderNumber,
            ctPaymentID: ctPayment.id,
            pspReference,
            lang,
            path: String(
              request.data?.path ?? "",
            ),
          });

        transaction.enforce_3d = 1;

        transaction.return_url =
          returnUrl;

        transaction.error_return_url =
          errorReturnUrl;
      }
    }

    let firstName = "";
    let lastName = "";

    if (ctCart.customerId) {
      const customerRes = await projectApiRoot
        .customers()
        .withId({ ID: ctCart.customerId })
        .get()
        .execute();

      const ctCustomer: Customer = customerRes.body;

      firstName = ctCustomer.firstName ?? "";
      lastName = ctCustomer.lastName ?? "";
    } else {
      firstName = ctCart.shippingAddress?.firstName ?? "";
      lastName = ctCart.shippingAddress?.lastName ?? "";
    }

    const novalnetPayload = {
      merchant: {
        signature: String(getConfig()?.novalnetPublicKey),
        tariff: String(getConfig()?.novalnetTariff),
      },
      customer: {
        billing: {
          city: String(billingAddress?.city),
          country_code: String(billingAddress?.country),
          house_no: String(billingAddressStreetNumber),
          street: String(billingAddressStreetName),
          zip: String(billingAddress?.postalCode),
          ...(company && {
            company: company,
          }),
        },
        shipping: {
          city: String(deliveryAddress?.city),
          country_code: String(deliveryAddress?.country),
          house_no: String(deliveryAddressStreetNumber),
          street: String(deliveryAddressStreetName),
          zip: String(deliveryAddress?.postalCode),
        },
        first_name: firstName,
        last_name: lastName,
        email: parsedCart.customerEmail,
        ...(birthDate && {
          birth_date: birthDate,
        }),
      },
      transaction,
      custom: {
        input1: "ctpayment-id",
        inputval1: String(ctPayment.id ?? "ctpayment-id not available"),
        input2: "pspReference",
        inputval2: String(pspReference ?? "0"),
        input3: "lang",
        inputval3: String(lang ?? "lang not available"),
      },
    };

    let paymentActionUrl = "payment";
    
    if (paymentAction?.toLowerCase() === "authorize") {
    
      const orderTotal =
        Number(parsedCart?.taxedPrice?.totalGross?.centAmount ?? 0);
    
      const authorizeAmount =
        Number(minimumAmount ?? 0);

      if (authorizeAmount <= 0) {
    
        paymentActionUrl = "authorize";
    
      } else {
        paymentActionUrl =
          orderTotal >= authorizeAmount
            ? "authorize"
            : "payment";
      }
    }
    
    const url =
      paymentActionUrl === "payment"
        ? "https://payport.novalnet.de/v2/payment"
        : "https://payport.novalnet.de/v2/authorize";
        
    let responseData: any;
    try {
      responseData = await this.callNovalnet(url, novalnetPayload);
    } catch (err) {
      log.error("Failed to process payment with Novalnet:", err);
      throw new Error("Payment processing failed");
    }
    const parsedResponse = responseData;
    if (String(request.data.paymentMethod.type).toUpperCase() === "CREDITCARD" && String(enforce3d) === "1" && parsedResponse?.result?.redirect_url ) {
      log.info("enfore 3D", {
        status: parsedResponse?.result?.status,
        statusText: parsedResponse?.result?.status_text,
      });

      await this.createPendingPaymentTransaction({
        paymentId: ctPayment.id,
        amount: ctPayment.amountPlanned,
        pspReference,
        paymentMethod:
          parsedResponse?.transaction?.payment_type ??
          request.data.paymentMethod.type,
      });
		
      const redirectUrl = parsedResponse?.result?.redirect_url;
		
      return {
      paymentReference: ctPayment.id,
      txnSecret: redirectUrl,
      };
    }
	  
    const statusCode = parsedResponse?.transaction?.status_code;
    const status = String(parsedResponse?.transaction?.status ?? "").toUpperCase();
    const { state, transactionType } = this.getTransactionStatus(status);
    const transactions = parsedResponse?.transaction;
    const amount = transactions?.amount;
    const tid = transactions?.tid;
    const paymentType = transactions?.payment_type;
    const isTestMode = transactions?.test_mode == 1;
    const bankDetails = transactions?.bank_details;
    const accountHolder = bankDetails?.account_holder;
    const iban = bankDetails?.iban;
    const bic = bankDetails?.bic;
    const bankName = bankDetails?.bank_name;
    const bankPlace = bankDetails?.bank_place;

    const supportedLocales: SupportedLocale[] = ["en", "de"];
    const localizedTransactionComments = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = [
          t(locale, "payment.transactionId", { tid }),
          t(locale, "payment.paymentType", { type: paymentType }),
          isTestMode ? t(locale, "payment.testMode") : "",
        ].join("\n");
        return acc;
      },
      {} as Record<SupportedLocale, string>,
    );

    let localizedBankDetailsComment: Partial<Record<SupportedLocale, string>> =
      {};
    if (bankDetails) {
      localizedBankDetailsComment = supportedLocales.reduce(
        (acc, locale) => {
          acc[locale] = [
            t(locale, "payment.referenceText", { amount }),
            t(locale, "payment.accountHolder", { accountHolder }),
            t(locale, "payment.iban", { iban }),
            t(locale, "payment.bic", { bic }),
            t(locale, "payment.bankName", { bankName }),
            t(locale, "payment.bankPlace", { bankPlace }),
            t(locale, "payment.transactionId", { tid }),
          ].join("\n");
          return acc;
        },
        {} as Record<SupportedLocale, string>,
      );
    }

    let transactionComments = localizedTransactionComments[lang];
    if (localizedBankDetailsComment[lang]) {
      transactionComments += `\n\n${localizedBankDetailsComment[lang]}`;
    }

    await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference,
      paymentMethod: request.data.paymentMethod.type,
      transaction: {
        type: transactionType,
        amount: ctPayment.amountPlanned,
        interactionId: pspReference,
        state: state,
        custom: {
          type: {
            typeId: "type",
            key: "novalnet-custom-field",
          },
          fields: {
            transactionComments,
          },
        },
      } as unknown as any,
    } as any);

    const raw = await this.ctPaymentService.getPayment({
      id: ctPayment.id,
    } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find(
      (t: any) => t.interactionId === pspReference,
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    const transactionCommentsText =
      typeof transactionComments === "string"
        ? transactionComments
        : String(transactionComments ?? "");

    const updatedPayment = await projectApiRoot
      .payments()
      .withId({ ID: ctPayment.id })
      .post({
        body: {
          version,
          actions: [
            {
              action: "setStatusInterfaceCode",
              interfaceCode: String(statusCode),
            },
          ],
        },
      })
      .execute();

    const updatedPaymentRoot = await projectApiRoot
      .payments()
      .withId({ ID: ctPayment.id })
      .get()
      .execute();

    const updatedTransaction = updatedPaymentRoot.body.transactions?.find(
      (t) => t.interactionId === pspReference,
    );

    const paymentComment =
      updatedTransaction?.custom?.fields?.transactionComments ??
      transactionCommentsText;
    
    await customObjectService.upsert(
      "nn-private-data",
      `${ctPayment.id}-${pspReference}`,
      {
        paymentId: ctPayment.id,
        pspReference,
        orderNo: parsedResponse?.transaction?.order_no ?? "",
        tid: parsedResponse?.transaction?.tid ?? "",
        paymentMethod: parsedResponse?.transaction?.payment_type ?? "",
        status: parsedResponse?.transaction?.status ?? "",
        amount: parsedResponse?.transaction?.amount ?? "",
        comments: paymentComment,
        email: parsedResponse?.customer?.email ?? "",
      },
    );
	  
    return {
      paymentReference: ctPayment.id,
      transactionStatus: parsedResponse?.result?.status === "FAILURE"
        ? "FAILURE" : parsedResponse?.transaction?.status,
      transactionStatusText: parsedResponse?.result?.status_text ??
        parsedResponse?.transaction?.status_text,
    };
  }

  private formatBirthDateToYMD(dateStr: string): string | undefined {
    if (!dateStr) return undefined;
  
    const value = dateStr.trim();
  
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
  
    let match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }
  
    match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }
  
    match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }
    
    return undefined;
  }

  public async waitForOrderByPayment(
    paymentId: string,
    retries = 10,
    delayMs = 1500,
  ): Promise<{ id: string; version: number } | null> {
    for (let i = 0; i < retries; i++) {
      const res = await projectApiRoot
        .orders()
        .get({
          queryArgs: {
            where: `paymentInfo(payments(id="${paymentId}"))`,
            limit: 1,
          },
        })
        .execute();

      const order = res.body.results?.[0];
      if (order) return { id: order.id, version: order.version };

      await new Promise((r) => setTimeout(r, delayMs));
    }
    return null;
  }

  private async syncPaymentToOrder(
    paymentId: string,
    pspReference: string,
  ): Promise<void> {
  
    log.info("[ORDER_SYNC] START", {
      paymentId,
      pspReference,
    });
  
    const rawPayment =
      await this.ctPaymentService.getPayment({
        id: paymentId,
      } as any);
  
    const payment = (rawPayment as any)?.body ?? rawPayment;
  
    const transaction = [...(payment.transactions ?? [])]
      .reverse()
      .find((t: any) => t.interactionId === pspReference);
  
    if (!transaction) {
      log.warn("[ORDER_SYNC] Matching transaction not found", {
        paymentId,
        pspReference,
      });
      return;
    }
  
  const orderRef = await this.waitForOrderByPayment(paymentId);
  
  if (!orderRef) {
    log.warn("[ORDER_SYNC] No order linked to payment", {
      paymentId,
      pspReference,
    });
    return;
  }
  
  const orderResponse = await projectApiRoot
    .orders()
    .withId({ ID: orderRef.id })
    .get()
    .execute();
  
  const order = orderResponse.body;
  
    const paymentComment =
      transaction.custom?.fields?.transactionComments ?? "";
  
    log.info("[ORDER_SYNC] Order fetched", {
      orderId: order.id,
      version: order.version,
    });
  
    const orderCommentType = await projectApiRoot
      .types()
      .withKey({ key: "order-payment-comments" })
      .get()
      .execute()
      .catch(() => null);
  
    const actions: any[] = [];
  
    if (orderCommentType) {

      if (order.custom?.type && order.custom.type.id !== orderCommentType.body.id) {
        log.warn("[ORDER_SYNC] Order uses another Custom Type; comment remains on Payment", { orderId: order.id });
        return;
      }
  
      if (!order.custom?.type) actions.push({
        action: "setCustomType",
        type: {
          key: "order-payment-comments",
          typeId: "type",
        },
      });
  
      actions.push({
        action: "setCustomField",
        name: "paymentComments",
        value: paymentComment,
      });
  
      log.info("[ORDER_SYNC] Custom type found", {
        orderId: order.id,
        typeKey: "order-payment-comments",
      });
  
    } else {
  
      log.log(
        "[ORDER_SYNC] order-payment-comments type not found. Skipping custom field update.",
        {
          orderId: order.id,
          typeKey: "order-payment-comments",
        },
      );
    }
  
    if (actions.length > 0) {
  
      log.info("[ORDER_SYNC] Updating Order", {
        orderId: order.id,
        actions: actions.map(a => a.action),
      });
  
      const updatedOrder = await projectApiRoot
        .orders()
        .withId({ ID: order.id })
        .post({
          body: {
            version: order.version,
            actions,
          },
        })
        .execute();
    }
  
    log.info("[ORDER_SYNC] COMPLETED", {
      orderId: order.id,
      paymentId,
      pspReference,
    });
  }

  private async getOrderByPaymentId(paymentId: string) {
    const result = await projectApiRoot
      .orders()
      .get({
        queryArgs: {
          where: `paymentInfo(payments(id="${paymentId}"))`,
          limit: 1,
        },
      })
      .execute();

    return result.body.results[0] ?? null;
  }

  private getTransactionStatus(status?: string): {
    state: "Initial" | "Pending" | "Success" | "Failure";
    transactionType:
      | "Authorization"
      | "Charge"
      | "CancelAuthorization";
  } {
    switch (String(status ?? "").toUpperCase()) {

    case "PENDING":
      return {
        state: "Pending",
        transactionType: "Authorization",
      };

    case "ON_HOLD":
      return {
        state: "Success",
        transactionType: "Authorization",
      };

      case "CONFIRMED":
        return {
          state: "Success",
          transactionType: "Charge",
        };

      case "CANCELLED":
        return {
          state: "Failure",
          transactionType: "CancelAuthorization",
        };

      default:
        return {
          state: "Failure",
          transactionType: "Authorization",
        };
    }
  }
		
private mapNovalnetOrderStates(input: NovalnetOrderStateInput): NovalnetOrderStates | null {
  return mapNovalnetOrderStates(input);
}

private async getModificationFlags(paymentId: string, eventType: string, status?: string): Promise<{
  isPartialCapture?: boolean;
  isPartialChargeback?: boolean;
} | null> {
  const captureEvent = eventType === "TRANSACTION_CAPTURE" || eventType === "TRANSACTION_UPDATE";
  const chargebackEvent = ["CHARGEBACK", "RETURN_DEBIT", "REVERSAL"].includes(eventType);
  if (!captureEvent && !chargebackEvent) return {};

  const payment = (await projectApiRoot.payments().withId({ ID: paymentId }).get().execute()).body;
  const captured = payment.transactions
    .filter((tx) => tx.type === "Charge" && tx.state === "Success")
    .reduce((sum, tx) => sum + tx.amount.centAmount, 0);
  if (captured > payment.amountPlanned.centAmount) {
    throw new Error("Captured amount exceeds the planned Payment amount");
  }
  if (eventType === "TRANSACTION_CAPTURE" && captured <= 0) return null;
  if (eventType === "TRANSACTION_UPDATE" && status === "CONFIRMED" && captured <= 0) return null;
  if (chargebackEvent) {
    if (captured <= 0) return null;
    const chargedBack = payment.transactions
      .filter((tx) => tx.type === "Chargeback" && tx.state === "Success")
      .reduce((sum, tx) => sum + tx.amount.centAmount, 0);
    if (chargedBack > captured) {
      throw new Error("Chargeback amount exceeds captured Payment amount");
    }
    return { isPartialChargeback: captured > chargedBack };
  }
  return {
    isPartialCapture: captured < payment.amountPlanned.centAmount,
  };
}
	
	private async updateOrderStates({
	  paymentId,
	  paymentState,
	}: {
	  paymentId: string;
	  paymentState: NovalnetOrderStates["paymentState"];
	}): Promise<void> {
	
	  let order = await this.getOrderByPaymentId(paymentId);
	  if (!order) {
	    const orderRef = await this.waitForOrderByPayment(paymentId, 5, 1000);
	    if (orderRef) {
	      order = (await projectApiRoot.orders().withId({ ID: orderRef.id }).get().execute()).body;
	    }
	  }
	
    if (!order) throw new Error(`Order not linked to Payment ${paymentId}`);
	
	  const actions: any[] = [];
	
	  if (order.paymentState !== paymentState) {
	    actions.push({
	      action: "changePaymentState",
	      paymentState,
	    });
	  }
	
	  if (!actions.length) {
	    return;
	  }
	
	  await projectApiRoot
	    .orders()
	    .withId({ ID: order.id })
	    .post({
	      body: {
	        version: order.version,
	        actions,
	      },
	    })
	    .execute();
	
	  log.info("[ORDER_STATE] Updated", {
	    orderId: order.id,
	    paymentId,
	    paymentState,
	  });
	}
	
  private async callNovalnet<T = any>(url: string, payload: unknown): Promise<T> {
    const accessKey = String(getConfig()?.novalnetPrivateKey ?? "");
  
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-NN-Access-Key": btoa(accessKey),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Novalnet API error: ${response.status}`);
    }

    const responseText = await response.text();
  
    const parsed = JSONbig({ storeAsString: true }).parse(responseText);
  
    return JSON.parse(JSON.stringify(parsed)) as T;
  }

  private async updatePaymentTransaction({
    paymentId,
    pspReference,
    transactionComments,
    statusCode,
    state,
    appendComments = true,
    setCustomType = false,
    setStatusInterfaceCode = true,
    changeTransactionState = true,
    errorMessage = "Transaction not found",
  }: {
    paymentId: string;
    pspReference: string;
    transactionComments: string;
    statusCode?: string;
    state?: "Initial" | "Pending" | "Success" | "Failure";
    appendComments?: boolean;
    setCustomType?: boolean;
    setStatusInterfaceCode?: boolean;
    changeTransactionState?: boolean;
    errorMessage?: string;
  }) {

    const raw =
      await this.ctPaymentService.getPayment({
        id: paymentId,
      } as any);

    const payment = (raw as any)?.body ?? raw;

    let tx = payment.transactions.find(
      (tx: any) => tx.interactionId === pspReference,
    );
    
    if (!tx) {
      tx = payment.transactions.find(
        (tx: any) =>
          tx.type === "Charge" &&
          tx.interactionId === `${pspReference}-Charge`,
      );
    }
    
    if (!tx) {
      log.error("[PAYMENT_TX] Transaction not found", {
        paymentId,
        pspReference,
      });
    
      throw new Error(errorMessage);
    }

    const existingComments =
      tx.custom?.fields?.transactionComments ?? "";

    const currentInterfaceCode =
      payment.paymentStatus?.interfaceCode ?? "";

    const alreadyUpdated =
      tx.state === state &&
      currentInterfaceCode === String(statusCode ?? "") &&
      existingComments === transactionComments;

    if (alreadyUpdated) {

      log.info("[PAYMENT_TX] Already updated", {
        paymentId,
        transactionId: tx.id,
      });

      return {
        txId: tx.id,
        comments: existingComments,
      };
    }

    const finalComments =
      appendComments && existingComments
        ? `${existingComments}\n\n---\n${transactionComments}`
        : transactionComments;

    const actions: PaymentUpdateAction[] = [];

    if (setCustomType && !tx.custom?.type) {
      actions.push({
        action: "setTransactionCustomType",
        transactionId: tx.id,
        type: {
          key: "novalnet-custom-field",
          typeId: "type",
        },
      });
    }

    if (existingComments !== finalComments) {
      actions.push({
        action: "setTransactionCustomField",
        transactionId: tx.id,
        name: "transactionComments",
        value: finalComments,
      });
    }
    
    if (
      setStatusInterfaceCode &&
      currentInterfaceCode !== String(statusCode ?? "")
    ) {
      actions.push({
        action: "setStatusInterfaceCode",
        interfaceCode: String(statusCode ?? ""),
      });
    }
    
    if (
      changeTransactionState &&
      state &&
      tx.state !== state
    ) {
      actions.push({
        action: "changeTransactionState",
        transactionId: tx.id,
        state,
      });
    }

      if (actions.length === 0) {
    
      log.info("[PAYMENT_TX] Already synchronized", {
        paymentId,
        transactionId: tx.id,
        transactionState: tx.state,
        interfaceCode: currentInterfaceCode,
      });
    
      return {
        txId: tx.id,
        comments: existingComments,
      };
    }

    log.info("[PAYMENT_TX] Updating Payment", {
      paymentId,
      transactionId: tx.id,
      actions: actions.map(a => a.action),
    });

    await projectApiRoot
      .payments()
      .withId({ ID: paymentId })
      .post({
        body: {
          version: payment.version,
          actions,
        },
      })
      .execute();

    log.info("[PAYMENT_TX] Payment updated", {
      paymentId,
      transactionId: tx.id,
    });

    return {
      txId: tx.id,
      comments: finalComments,
    };
  }

  private async processWebhookTransaction({
    webhook,
    transactionComments,
    state,
    setStatusInterfaceCode = true,
    changeTransactionState = true,
    skipSettlement = false,
  }: {
    webhook: any;
    transactionComments: string;
    state?: "Initial" | "Pending" | "Success" | "Failure";
    setStatusInterfaceCode?: boolean;
    changeTransactionState?: boolean;
    skipSettlement?: boolean;
  }) {

    const paymentId =
      webhook.custom?.["ctpayment-id"] ??
      webhook.custom?.inputval1;

    const pspReference =
      webhook.custom?.pspReference ??
      webhook.custom?.inputval2;

    const status = String(
      webhook.transaction?.status ?? "",
    ).toUpperCase();

    const mapped = this.getTransactionStatus(status);
    const effectiveState = state ?? mapped.state;

    log.info("[WEBHOOK_TX] START", {
      paymentId,
      pspReference,
      eventType: webhook.event?.type,
      status,
    });

    await this.updatePaymentTransaction({
      paymentId,
      pspReference,
      transactionComments,
      statusCode: webhook.transaction?.status_code,
      state: effectiveState,
      setStatusInterfaceCode,
      changeTransactionState,
    });

    if (!skipSettlement &&
        mapped.transactionType !== "CancelAuthorization") {

      log.info("[WEBHOOK_TX] Settlement validation", {
        paymentId,
        transactionType: mapped.transactionType,
      });

      await this.addSettlementTransactionIfRequired({
        paymentId,
        pspReference,
        amount: webhook.transaction?.amount,
        currency: webhook.transaction?.currency,
        transactionType: mapped.transactionType,
        status,
      });
    }

    await this.syncPaymentToOrder(paymentId, pspReference);

    log.info("[WEBHOOK_TX] COMPLETED", {
      paymentId,
      pspReference,
    });

    return transactionComments;
  }

  public async createWebhook(
    webhookData: any[],
    req?: FastifyRequest,
  ): Promise<any> {

    if (!Array.isArray(webhookData) || webhookData.length === 0) {
      log.error("Invalid webhook payload");
      throw new Error("Invalid webhook payload");
    }

    const webhook = webhookData[0];
      
    await this.validateRequiredParameters(webhook);
      
    await this.validateChecksum(webhook);

    if (req) {
      await this.validateIpAddress(req);
    }

    const eventType = String(webhook.event?.type ?? "").toUpperCase();
    if (
      String(webhook.custom?.shop_invoked ?? "") === "1"
    ) {
      log.info("[PAYMENT_INTENT] Webhook already handled in shop", {
        eventType,
        tid: webhook.event?.tid,
      });
      return {
        success: true,
        eventType,
        message: "Already handled in the shop / Payment Intent",
      };
    }

    await this.getOrderDetails(webhook);

    log.info("Order details resolved");

    const status = String(webhook.result?.status ?? "").toUpperCase();

    log.info("Processing Novalnet webhook", {
      eventType,
      status,
      tid: webhook?.event?.tid,
      paymentType: webhook?.transaction?.payment_type,
    });

    if (status !== "SUCCESS") {

      log.warn("Webhook ignored (non-success)", {
        eventType,
        status,
        tid: webhook?.event?.tid,
      });

      return {
        success: true,
        message: "Webhook ignored (non-success)",
      };
    }

    let transactionComments: string | undefined;

    switch (eventType) {

      case "PAYMENT":
        transactionComments = await this.handlePayment(webhook);
        break;

      case "TRANSACTION_CAPTURE":
        transactionComments = await this.handleTransactionCapture(webhook);
        break;

      case "TRANSACTION_CANCEL":
        transactionComments = await this.handleTransactionCancel(webhook);
        break;

      case "TRANSACTION_REFUND":
        transactionComments = await this.handleTransactionRefund(webhook);
        break;

      case "TRANSACTION_UPDATE":
        transactionComments = await this.handleTransactionUpdate(webhook);
        break;

      case "CREDIT":
        transactionComments = await this.handleCredit(webhook);
        break;

      case "CHARGEBACK":
      case "RETURN_DEBIT":
      case "REVERSAL":
          transactionComments = await this.handleChargeback(webhook);
          break;

      default:

        log.warn("Unhandled Novalnet event type", {
          eventType,
          tid: webhook?.event?.tid,
        });

        return {
          success: true,
          skipped: true,
          eventType,
        };
    }

  if (
    transactionComments !== "Transaction not found" &&
    [
      "PAYMENT",
      "TRANSACTION_CAPTURE",
      "TRANSACTION_CANCEL",
      "TRANSACTION_REFUND",
      "TRANSACTION_UPDATE",
      "CHARGEBACK",
      "RETURN_DEBIT",
      "REVERSAL",
    ].includes(eventType)
  ) {
    const paymentId = webhook.custom?.["ctpayment-id"] ?? webhook.custom?.inputval1;
    if (!paymentId) throw new Error("Missing payment reference for Order state update");
    try {
      const flags = eventType === "PAYMENT"
        ? {}
        : await this.getModificationFlags(
            paymentId, eventType, String(webhook.transaction?.status ?? "").toUpperCase(),
          );
      if (flags) {
        const states = this.mapNovalnetOrderStates({
          status: webhook.transaction?.status,
          eventType,
          ...flags,
        });
        if (states) await this.updateOrderStates({ paymentId, ...states });
      }
    } catch (error) {
      log.error("[ORDER_STATE] State synchronization failed", {
        paymentId,
        eventType,
        error,
      });
      throw error;
    }
  }
    log.info("Webhook processed", {
      eventType,
      tid: webhook?.event?.tid,
    });

    return {
      success: true,
      eventType,
      message: transactionComments,
    };
  }

  private async handlePayment(
    webhook: Record<string, any>,
  ): Promise<string> {

    const paymentId =
      webhook.custom?.["ctpayment-id"] ??
      webhook.custom?.inputval1;

    const pspReference =
      webhook.custom?.pspReference ??
      webhook.custom?.inputval2;

    const tid = String(webhook.event?.tid ?? "");
    const novalnetStatus = String(
      webhook.transaction?.status ?? "",
    ).toUpperCase();

    if (!paymentId || !pspReference) {
      log.error("[PAYMENT] Missing payment reference", {
        paymentId,
        pspReference,
        tid,
      });
      throw new Error("Missing payment reference");
    }

    log.info("[PAYMENT] START", {
      paymentId,
      pspReference,
      tid,
      eventType: webhook.event?.type,
      paymentType: webhook.transaction?.payment_type,
      status: novalnetStatus,
    });

    const raw = await this.ctPaymentService.getPayment({
      id: paymentId,
    } as any);

    const payment = (raw as any)?.body ?? raw;

    log.info("[PAYMENT] Payment fetched", {
      paymentId,
      version: payment.version,
      interfaceId: payment.interfaceId,
      transactionCount: payment.transactions?.length ?? 0,
    });

    const tx = [...(payment.transactions ?? [])]
      .reverse()
      .find((t: any) => t.interactionId === pspReference);

    if (!tx) {
      log.warn("[PAYMENT] Matching transaction not found", {
        paymentId,
        pspReference,
        availableInteractionIds:
          payment.transactions?.map((t: any) => t.interactionId),
      });

      return "Transaction not found";
    }

    const mapped = this.getTransactionStatus(novalnetStatus);

    const order = await this.getOrderByPaymentId(paymentId);
    
    const lang = webhook.custom?.lang as SupportedLocale;
    const locale: SupportedLocale = lang === "en" ? "en" : "de";
    
    const transactionComments =
      this.buildTransactionComments(
        webhook,
        locale,
      );

    if (["CANCELLED", "DEACTIVATED"].includes(novalnetStatus)) {
      const cancellationInteractionId = `${pspReference}-CancelAuthorization`;
      if (payment.transactions?.some(
        (transaction: any) =>
          transaction.type === "CancelAuthorization" &&
          transaction.state === "Success" &&
          transaction.interactionId === cancellationInteractionId,
      )) {
        return "Already synchronized";
      }

      const cancellationComments = this.buildTransactionComments(
        { ...webhook, event: { ...webhook.event, type: "TRANSACTION_CANCEL" } },
        locale,
      );
      await this.processWebhookTransaction({
        webhook,
        transactionComments: cancellationComments,
        changeTransactionState: false,
        skipSettlement: true,
      });
      await this.addSettlementTransactionIfRequired({
        paymentId,
        pspReference,
        transactionType: "CancelAuthorization",
        amount: webhook.transaction?.amount,
        currency: webhook.transaction?.currency,
        status: novalnetStatus,
      });
      return cancellationComments;
    }

    const currentComments =
      tx.custom?.fields?.transactionComments ?? "";

    const currentInterfaceCode =
      payment.paymentStatus?.interfaceCode ?? "";

    const newInterfaceCode = String(
      webhook.transaction?.status_code ?? "",
    );

    const alreadySynced =
      tx.type === mapped.transactionType &&
      tx.state === mapped.state &&
      currentInterfaceCode === newInterfaceCode;

    if (alreadySynced) {

      log.info("[PAYMENT] Already synchronized", {
        paymentId,
        pspReference,
        transactionType: tx.type,
        transactionState: tx.state,
      });

      return "Already synchronized";
    }

    await this.processWebhookTransaction({
      webhook,
      transactionComments,
      state: mapped.state,
    });

    log.info("[PAYMENT] COMPLETED", {
      paymentId,
      pspReference,
      tid,
    });

    return transactionComments;
  }
  
  private async handleTransactionCapture(
    webhook: Record<string, any>,
  ): Promise<string> {

    const paymentId =
      webhook.custom?.["ctpayment-id"] ??
      webhook.custom?.inputval1;

    const pspReference =
      webhook.custom?.pspReference ??
      webhook.custom?.inputval2;

    const tid = String(webhook.event?.tid ?? "");

    if (!paymentId || !pspReference) {
      log.error("[CAPTURE] Missing payment reference", {
        paymentId,
        pspReference,
        tid,
      });
      throw new Error("Missing payment reference");
    }

    log.info("[CAPTURE] START", {
      paymentId,
      pspReference,
      tid,
      eventType: webhook.event?.type,
      paymentType: webhook.transaction?.payment_type,
      status: webhook.transaction?.status,
    });

    const raw = await this.ctPaymentService.getPayment({
      id: paymentId,
    } as any);

    const payment = (raw as any)?.body ?? raw;

    const tx = [...(payment.transactions ?? [])]
      .reverse()
      .find((t: any) => t.interactionId === pspReference);

    if (!tx) {
      log.error("[CAPTURE] Matching transaction not found", {
        paymentId,
        pspReference,
        availableInteractionIds:
          payment.transactions?.map((t: any) => t.interactionId),
      });
      throw new Error("Transaction not found");
    }

    const currentInterfaceCode =
      payment.paymentStatus?.interfaceCode ?? "";

    const newInterfaceCode = String(
      webhook.transaction?.status_code ?? "",
    );

    const alreadyCaptured =
      tx.type === "Charge" &&
      tx.state === "Success" &&
      currentInterfaceCode === newInterfaceCode;

    if (alreadyCaptured) {

      log.info("[CAPTURE] Already synchronized", {
        paymentId,
        pspReference,
        transactionType: tx.type,
        transactionState: tx.state,
      });

      return "Already synchronized";
    }

    const order = await this.getOrderByPaymentId(paymentId);
    
    const lang = webhook.custom?.lang as SupportedLocale;
    const locale: SupportedLocale = lang === "en" ? "en" : "de";
    
    const transactionComments =
      this.buildTransactionComments(
        webhook,
        locale,
      );

    await this.processWebhookTransaction({
      webhook,
      transactionComments,
      state: "Success",
    });

    log.info("[CAPTURE] COMPLETED", {
      paymentId,
      pspReference,
      tid,
    });

    return transactionComments;
  }
  
  private async handleTransactionCancel(
    webhook: Record<string, any>,
  ): Promise<string> {

    const paymentId =
      webhook.custom?.["ctpayment-id"] ??
      webhook.custom?.inputval1;

    const pspReference =
      webhook.custom?.pspReference ??
      webhook.custom?.inputval2;

    const tid = String(webhook.event?.tid ?? "");

    if (!paymentId || !pspReference) {
      log.error("[CANCEL] Missing payment reference", {
        paymentId,
        pspReference,
        tid,
      });
      throw new Error("Missing payment reference");
    }

    log.info("[CANCEL] START", {
      paymentId,
      pspReference,
      tid,
      eventType: webhook.event?.type,
      paymentType: webhook.transaction?.payment_type,
      status: webhook.transaction?.status,
    });

    const raw = await this.ctPaymentService.getPayment({
      id: paymentId,
    } as any);

    const payment = (raw as any)?.body ?? raw;

    const tx = [...(payment.transactions ?? [])]
      .reverse()
      .find((t: any) => t.interactionId === pspReference);

    if (!tx) {
      log.error("[CANCEL] Matching transaction not found", {
        paymentId,
        pspReference,
        availableInteractionIds:
          payment.transactions?.map((t: any) => t.interactionId),
      });
      throw new Error("Transaction not found");
    }

    const currentInterfaceCode =
      payment.paymentStatus?.interfaceCode ?? "";

    const newInterfaceCode = String(
      webhook.transaction?.status_code ?? "",
    );

    const alreadyCancelled =
      tx.type === "CancelAuthorization" &&
      tx.state === "Failure" &&
      currentInterfaceCode === newInterfaceCode;

    if (alreadyCancelled) {

      log.info("[CANCEL] Already synchronized", {
        paymentId,
        pspReference,
        transactionType: tx.type,
        transactionState: tx.state,
      });

      return "Already synchronized";
    }

    const order = await this.getOrderByPaymentId(paymentId);
    
    const lang = webhook.custom?.lang as SupportedLocale;
    const locale: SupportedLocale = lang === "en" ? "en" : "de";
    
    const transactionComments =
      this.buildTransactionComments(
        webhook,
        locale,
      );

    await this.processWebhookTransaction({
      webhook,
      transactionComments,
      state: "Failure",
      changeTransactionState: false,
      skipSettlement: true,
    });

    await this.addSettlementTransactionIfRequired({
      paymentId, pspReference, transactionType: "CancelAuthorization",
      amount: webhook.transaction?.amount,
      currency: webhook.transaction?.currency,
      status: String(webhook.transaction?.status ?? ""),
    });

    log.info("[CANCEL] COMPLETED", {
      paymentId,
      pspReference,
      tid,
    });

    return transactionComments;
  }
  
  private async handleTransactionRefund(
    webhook: Record<string, any>,
  ): Promise<string> {

    const paymentId =
      webhook.custom?.["ctpayment-id"] ??
      webhook.custom?.inputval1;

    const pspReference =
      webhook.custom?.pspReference ??
      webhook.custom?.inputval2;

    const parentTid = String(
      webhook.event?.parent_tid ?? "",
    );

    const refundTid = String(
      webhook.transaction?.refund?.tid ?? "",
    );

    const refundAmount = Number(
      webhook.transaction?.refund?.amount ?? 0,
    );

    const totalRefunded = Number(
      webhook.transaction?.refunded_amount ?? 0,
    );

    const originalAmount = Number(
      webhook.transaction?.amount ?? 0,
    );

    log.info("[REFUND] START", {
      paymentId,
      pspReference,
      parentTid,
      refundTid,
      refundAmount,
      totalRefunded,
      originalAmount,
      paymentType: webhook.transaction?.payment_type,
    });

    if (!paymentId || !pspReference || !refundTid) {
      log.error("[REFUND] Missing mandatory data", {
        paymentId,
        pspReference,
        refundTid,
      });
      throw new Error("Missing refund reference");
    }

    const payment = (
      await projectApiRoot
        .payments()
        .withId({ ID: paymentId })
        .get()
        .execute()
    ).body;

    const chargeTransaction =
      payment.transactions?.find(
        t =>
          t.type === "Charge" &&
          t.state === "Success",
      );

    if (!chargeTransaction) {
      log.error("[REFUND] Charge validation failed", {
        paymentId,
      });
      throw new Error(
        "Successful Charge transaction not found",
      );
    }

    const webhookPspReference = String(webhook.custom?.pspReference ?? "");
    
    const originalTransaction = payment.transactions.find(
      (tx) =>
        tx.interactionId === webhookPspReference &&
        (tx.type === "Authorization" || tx.type === "Charge"),
    );
    
    if (!originalTransaction) {
      log.error("[REFUND] Original transaction not found", {
        paymentId,
        webhookPspReference,
        paymentInterfaceId: payment.interfaceId,
        transactions: payment.transactions.map((tx) => ({
          id: tx.id,
          type: tx.type,
          state: tx.state,
          interactionId: tx.interactionId,
        })),
      });
    
      throw new Error("Original transaction not found");
    }

    const existingRefund =
      payment.transactions?.find(
        t => t.interactionId === refundTid,
      );

    if (existingRefund) {

      log.info("[REFUND] Already synchronized", {
        paymentId,
        refundTid,
      });

      return "Already synchronized";
    }

    const ctRefunded =
      payment.transactions
        ?.filter(
          t =>
            t.type === "Refund" &&
            t.state === "Success",
        )
        .reduce(
          (sum, t) =>
            sum +
            Number(
              t.amount?.centAmount ?? 0,
            ),
          0,
        ) ?? 0;

    if (refundAmount <= 0) {
      log.error("[REFUND] Invalid refund amount", {
        refundAmount,
      });
      throw new Error("Invalid refund amount");
    }

    if (totalRefunded > originalAmount) {
      log.error("[REFUND] Refunded amount exceeds payment amount", {
        totalRefunded,
        originalAmount,
      });
      throw new Error("Refund exceeds payment amount");
    }

    if (
      ctRefunded + refundAmount !==
      totalRefunded
    ) {
      log.error("[REFUND] Refund reconciliation mismatch", {
        paymentId,
        ctRefunded,
        refundAmount,
        totalRefunded,
      });

      throw new Error(
        "Refund reconciliation mismatch",
      );
    }

    const order = await this.getOrderByPaymentId(paymentId);
    
    const lang = webhook.custom?.lang as SupportedLocale;
    const locale: SupportedLocale = lang === "en" ? "en" : "de";
    
    const transactionComments =
      this.buildTransactionComments(
        webhook,
        locale,
      );

    const updated =
      await projectApiRoot
        .payments()
        .withId({ ID: paymentId })
        .post({
          body: {
            version: payment.version,
            actions: [
              {
                action: "addTransaction",
                transaction: {
                  type: "Refund",
                  amount: {
                    centAmount: refundAmount,
                    currencyCode:
                      webhook.transaction.currency,
                  },
                  state: "Success",
                  interactionId: refundTid,
                  custom: {
                    type: {
                      key: "novalnet-custom-field",
                      typeId: "type",
                    },
                    fields: {
                      transactionComments:
                        transactionComments,
                    },
                  },
                },
              },
              {
                action: "setStatusInterfaceCode",
                interfaceCode: String(
                  webhook.transaction?.status_code ??
                    "",
                ),
              },
            ],
          },
        })
        .execute();

    await customObjectService.upsert(
      "nn-private-data",
      `${paymentId}-${pspReference}`,
      {
        tid: parentTid,
        paymentMethod:
          webhook.transaction?.payment_type,
        status:
          webhook.transaction?.status,
        orderNo:
          webhook.transaction?.order_no,
        refundedAmount:
          totalRefunded,
        lastRefundTid:
          refundTid,
        lastRefundAmount:
          refundAmount,
        additionalInfo: {
          comments: transactionComments,
        },
      },
    );

    await this.syncPaymentToOrder(
      paymentId,
      pspReference,
    );

    log.info("[REFUND] COMPLETED", {
      paymentId,
      refundTid,
    });

    return transactionComments;
  }

  private async handleTransactionUpdate(
    webhook: Record<string, any>,
  ): Promise<string> {
    const parsedData = webhook.custom;
    const paymentId = parsedData?.["ctpayment-id"];
    const pspReference = parsedData?.pspReference;
    const lang = parsedData?.lang as SupportedLocale;
    const locale = lang === "en" ? "en" : "de";

    if (!paymentId || !pspReference) {
      throw new Error("Missing ctpayment-id or pspReference");
    }

    const updateType = String(
      webhook.transaction?.update_type ?? "",
    ).toUpperCase();

    const status = String(
      webhook.transaction?.status ?? "",
    ).toUpperCase();

    const transactionComments = this.buildTransactionComments(
      webhook,
      locale,
    );

    log.info("[TRANSACTION_UPDATE] Processing", {
      paymentId,
      pspReference,
      updateType,
      status,
      amount: webhook.transaction?.amount,
      dueDate: webhook.transaction?.due_date,
    });

    const statusCode =
      status === "CONFIRMED"
        ? "100"
        : status === "ON_HOLD"
          ? "98"
          : String(webhook.transaction?.status_code ?? "");

    await this.updatePaymentTransaction({
      paymentId,
      pspReference,
      transactionComments,
      statusCode,
      state: status === "CONFIRMED" || status === "ON_HOLD" ? "Success" : "Pending",
      appendComments: true,
      setCustomType: true,
      errorMessage: "Authorization transaction not found",
    });

    if (status === "CONFIRMED") {
      const payment = (await projectApiRoot.payments()
        .withId({ ID: paymentId }).get().execute()).body;
      const original = payment.transactions.find((tx) => tx.interactionId === pspReference);
      if (original?.type === "Authorization") {
        await this.addSettlementTransactionIfRequired({
          paymentId, pspReference, transactionType: "Charge",
          amount: webhook.transaction?.amount,
          currency: webhook.transaction?.currency, status,
        });
      }
    }

    await this.syncPaymentToOrder(
      paymentId,
      pspReference,
    );

    log.info("[TRANSACTION_UPDATE] Completed", {
      paymentId,
      updateType,
      statusCode,
    });

    return transactionComments;
  }
  
  public async handleCredit(
    webhook: Record<string, any>,
  ): Promise<string> {
    const paymentId =
      webhook.custom?.["ctpayment-id"] ??
      webhook.custom?.inputval1;

    const pspReference =
      webhook.custom?.pspReference ??
      webhook.custom?.inputval2;

    if (!paymentId || !pspReference) {
      throw new Error("Missing ctpayment-id or pspReference");
    }

    const lang = webhook.custom?.lang as SupportedLocale;
    const locale = lang === "en" ? "en" : "de";

    const eventTID = String(webhook.event?.tid ?? "");
    const parentTID = String(
      webhook.event?.parent_tid ?? eventTID,
    );

    const creditAmount = Number(webhook.transaction?.amount ?? 0); // cents
    const currency = String(webhook.transaction?.currency ?? "");

    const transactionComments = this.buildTransactionComments(
      webhook,
      locale,
    );

    log.info("[CREDIT] Webhook received", {
      paymentId,
      pspReference,
      eventTID,
      parentTID,
      paymentType: webhook.transaction?.payment_type,
      creditAmount,
      currency,
      status: webhook.transaction?.status,
    });

    const raw = await this.ctPaymentService.getPayment({
      id: paymentId,
    } as any);

    const payment = (raw as any)?.body ?? raw;

    const authorization = payment.transactions.find(
      (tx: any) =>
        tx.type === "Authorization" &&
        tx.interactionId === pspReference,
    );

    if (!authorization) {
      log.error("[CREDIT] Authorization transaction not found", {
        paymentId,
        pspReference,
      });
      throw new Error("Authorization transaction not found");
    }

    const plannedAmount = authorization.amount.centAmount;

    const container = "nn-private-data";
    const key = `${paymentId}-${pspReference}`;

    let customObject: any = null;
    let creditedAmount = 0;

    try {
      const response = await projectApiRoot
        .customObjects()
        .withContainerAndKey({
          container,
          key,
        })
        .get()
        .execute();

      customObject = response.body;
      creditedAmount = Number(
        customObject.value?.creditedAmount ?? 0,
      );

    } catch {
      log.info("[CREDIT] No existing credit state found", {
        paymentId,
        key,
      });
      creditedAmount = 0;
    }

    if (!eventTID || !Number.isSafeInteger(creditAmount) || creditAmount <= 0 ||
        currency !== payment.amountPlanned.currencyCode) {
      throw new Error("Invalid credit TID, amount or currency");
    }
    const creditEvents: Record<string, number> = {
      ...(customObject?.value?.creditEvents ?? {}),
    };
    if (creditEvents[eventTID] != null && creditEvents[eventTID] !== creditAmount) {
      throw new Error("Credit TID already used for another amount");
    }
    if (creditEvents[eventTID] == null) {
      creditedAmount += creditAmount;
      if (creditedAmount > plannedAmount) throw new Error("Credit exceeds planned amount");
      creditEvents[eventTID] = creditAmount;
      await customObjectService.upsert(container, key, {
        ...(customObject?.value ?? {}), creditedAmount, creditEvents,
      });
    }

    const fullyPaid = creditedAmount >= plannedAmount;

    log.info("[CREDIT] Credit calculation", {
      paymentId,
      currentCredit: creditAmount,
      totalCredited: creditedAmount,
      plannedAmount,
      remainingAmount: Math.max(
        plannedAmount - creditedAmount,
        0,
      ),
      fullyPaid,
    });

    log.info("[CREDIT] Payment update decision", {
      paymentId,
      state: fullyPaid ? "Success" : "Pending",
      interfaceCode: fullyPaid ? "100" : "98",
      skipSettlement: true,
    });

    if (fullyPaid) {
      await this.addSettlementTransactionIfRequired({
        paymentId, pspReference, transactionType: "Charge",
        amount: creditedAmount, currency, status: "CONFIRMED",
      });
    }

    await this.processWebhookTransaction({
      webhook,
      transactionComments,
      state: fullyPaid ? "Success" : "Pending",
      setStatusInterfaceCode: false,
      skipSettlement: true,
    });

    if (fullyPaid) {
      log.info("[CREDIT] Full payment received. Updating interface code.", {
        paymentId,
        statusCode: "100",
      });

      await this.updatePaymentTransaction({
        paymentId,
        pspReference,
        transactionComments,
        statusCode: "100",
        state: "Success",
        appendComments: true,
        setStatusInterfaceCode: true,
        changeTransactionState: false,
      });
    }
      
    const existingComments =
      customObject?.value?.additionalInfo?.comments ?? "";

    const finalComments = existingComments
      ? `${existingComments}\n\n---\n${transactionComments}`
      : transactionComments;
      
    await customObjectService.upsert(
      container,
      key,
      {
        ...(customObject?.value ?? {}),
        creditedAmount,
        creditEvents,
        additionalInfo: {
          ...(customObject?.value?.additionalInfo ?? {}),
          comments: finalComments,
          lastCreditTid: eventTID,
          lastCreditAmount: creditAmount,
        },
      },
    );


  try {
    const states = this.mapNovalnetOrderStates({
      status: webhook.transaction?.status,
      eventType: "CREDIT",
      isPartialCredit: !fullyPaid,
    });
    if (states) await this.updateOrderStates({ paymentId, ...states });
  } catch (error) {
    log.error("[ORDER_STATE] Credit state synchronization failed", {
      paymentId,
      eventTID,
      error,
    });
    throw error;
  }

    log.info("[CREDIT] Completed", {
      paymentId,
      eventTID,
      parentTID,
      creditedAmount,
      plannedAmount,
      remainingAmount: Math.max(
        plannedAmount - creditedAmount,
        0,
      ),
      fullyPaid,
      statusCode: fullyPaid ? "100" : "98",
    });

    return transactionComments;
  }

	public async handleChargeback(
	  webhook: Record<string, any>,
	): Promise<string> {
	  const paymentId =
	    webhook.custom?.["ctpayment-id"] ??
	    webhook.custom?.inputval1;
	
	  const pspReference =
	    webhook.custom?.pspReference ??
	    webhook.custom?.inputval2;
	
	  if (!paymentId || !pspReference) {
	    throw new Error("Missing ctpayment-id or pspReference");
	  }
	
	  const lang = webhook.custom?.lang as SupportedLocale;
	  const locale = lang === "en" ? "en" : "de";
	
	  const transactionComments = this.buildTransactionComments(
	    webhook,
	    locale,
	  );
	
	  log.info("[CHARGEBACK] Webhook received", {
	    paymentId,
	    pspReference,
	    eventType: webhook.event?.type,
	    eventTid: webhook.event?.tid,
	    parentTid: webhook.event?.parent_tid,
	    amount: webhook.transaction?.amount,
	    currency: webhook.transaction?.currency,
	    status: webhook.transaction?.status,
	  });
	
	  await this.updatePaymentTransaction({
		paymentId,
		pspReference: pspReference,
		transactionComments,
		statusCode: webhook.transaction?.status_code,
		state: "Failure",
		appendComments: true,
		setCustomType: true,
		setStatusInterfaceCode: true,
		changeTransactionState: false,
		errorMessage: "Charge transaction not found",
	  });

      const eventTid = String(webhook.event?.tid ?? "");
      if (!eventTid) throw new Error("Missing chargeback event TID");
      const root = projectApiRoot.payments().withId({ ID: paymentId });
      const latest = (await root.get().execute()).body;
      if (!latest.transactions.some((tx) => tx.type === "Chargeback" && tx.interactionId === eventTid)) {
        await root.post({ body: { version: latest.version, actions: [{
          action: "addTransaction",
          transaction: {
            type: "Chargeback", state: "Success", interactionId: eventTid,
            amount: {
              centAmount: Number(webhook.transaction?.amount),
              currencyCode: String(webhook.transaction?.currency ?? latest.amountPlanned.currencyCode),
            },
          },
        }] } }).execute();
      }

	  await this.syncPaymentToOrder(paymentId, pspReference);
	
	  const container = "nn-private-data";
	  const key = `${paymentId}-${pspReference}`;
	
	  let customObject: any = null;
	
	  try {
	    const response = await projectApiRoot
	      .customObjects()
	      .withContainerAndKey({
	        container,
	        key,
	      })
	      .get()
	      .execute();
	
	    customObject = response.body;
	  } catch {
	    customObject = null;
	  }
	
	  const existingComments =
	    customObject?.value?.additionalInfo?.comments ?? "";
	
	  const finalComments = existingComments
	    ? `${existingComments}\n\n---\n${transactionComments}`
	    : transactionComments;
	
	  await customObjectService.upsert(
	    container,
	    key,
	    {
	      ...(customObject?.value ?? {}),
	      status: "FAILURE",
	      additionalInfo: {
	        ...(customObject?.value?.additionalInfo ?? {}),
	        comments: finalComments,
	        lastChargebackTid: String(webhook.event?.tid ?? ""),
	        lastChargebackAmount: Number(
	          webhook.transaction?.amount ?? 0,
	        ),
	      },
	    },
	  );
	
	  log.info("[CHARGEBACK] Completed", {
	    paymentId,
	    pspReference,
	  });
	
	  return transactionComments;
	}

  public async validateRequiredParameters(payload: any) {
    const mandatory: Record<string, string[]> = {
      event: ["type", "checksum", "tid"],
      merchant: ["vendor", "project"],
      result: ["status"],
      transaction: ["tid", "payment_type", "status"],
    };
    for (const category of Object.keys(mandatory)) {
      if (!payload[category]) {
        throw new Error(`Missing category: ${category}`);
      }

      for (const param of mandatory[category]) {
        if (!payload[category][param]) {
          log.info(`Missing parameter ${param} in ${category}`);
          throw new Error(`Missing parameter ${param} in ${category}`);
        }
      }
    }
  }

  public async validateIpAddress(
    req: FastifyRequest
  ): Promise<void> {

    const webhookTestMode =
      String(getConfig()?.novalnetWebhookTestMode);

    if (webhookTestMode === "1") {
      return;
    }

    const novalnetHostIPs =
      await dns.resolve4("pay-nn.de");

    if (!novalnetHostIPs.length) {

      log.error("Novalnet HOST IP missing");

      throw new Error("Novalnet HOST IP missing");
    }

    const isAuthorized =
      this.validateRequestIp(req, novalnetHostIPs);

    if (!isAuthorized) {

      log.warn("Unauthorized webhook IP", {
        requestIp: req.ip,
        forwardedFor: req.headers["x-forwarded-for"],
        realIp: req.headers["x-real-ip"],
        allowedIps: novalnetHostIPs,
      });

      throw new Error(
        `Unauthorized access from IP ${req.ip}`
      );
    }
  }

  private validateRequestIp(
    req: FastifyRequest,
    novalnetHostIPs: string[]
  ): boolean {
  
    const headers = req.headers;
  
    const remoteAddrHeaders = [
      "x-forwarded-host",
      "x-client-ip",
      "x-real-ip",
      "x-forwarded-for",
      "x-forwarded",
      "x-cluster-client-ip",
      "forwarded-for",
      "forwarded",
    ];
  
    for (const header of remoteAddrHeaders) {
  
      const value = headers[header] as string | undefined;
  
      if (!value) {
        continue;
      }
  
      const headerValues =
        value.split(",").map(v => v.trim());
  
      if (
        headerValues.some(ip => novalnetHostIPs.includes(ip))
      ) {
        return true;
      }
    }
  
    return novalnetHostIPs.includes(req.ip);
  }

  private async validateChecksum(
    webhook: Record<string, any>,
  ): Promise<void> {
  
    const tid = webhook.event?.tid;
    const eventType = webhook.event?.type;
    const resultStatus = webhook.result?.status;
    const amount = webhook.transaction?.amount;
    const currency = webhook.transaction?.currency;
  
    let checksumString =
      String(tid ?? "") +
      String(eventType ?? "") +
      String(resultStatus ?? "");
  
    if (amount !== undefined) {
      checksumString += String(amount);
    }
  
    if (currency) {
      checksumString += String(currency);
    }
  
    const accessKey = String(getConfig()?.novalnetPrivateKey ?? "").trim();
    const reversedKey = accessKey.split("").reverse().join("");
  
    if (accessKey) {
      checksumString += reversedKey;
    }
  
    const generatedChecksum = crypto
      .createHash("sha256")
      .update(checksumString)
      .digest("hex");
  
    log.info("[CHECKSUM][HASH]", {
      generatedChecksum,
      receivedChecksum: webhook.event?.checksum,
      matched: generatedChecksum === webhook.event?.checksum,
    });
  
    if (generatedChecksum !== webhook.event?.checksum) {
  
      log.error("[CHECKSUM][FAILED]", { eventType, tid });
  
      throw new Error("Checksum validation failed");
    }
  }
  
  public async getOrderDetails(payload: any) {
    const paymentIdValue = payload.custom.inputval1;
    const pspReference = payload.custom.inputval2;
    const container = "nn-private-data";
    const key = `${paymentIdValue}-${pspReference}`;
    const obj = await customObjectService.get(container, key);
    if (!obj) {
      log.warn("CustomObject missing after upsert (unexpected)", {
        container,
        key,
      });
      return {};
    }
    return obj.value;
  }

  public async createRedirectPayment(
    request: CreatePaymentRequest,
  ): Promise<PaymentResponseSchemaDTO> {
    const type = String(
      request.data?.paymentMethod?.type,
    );

    const lang = String(
      request.data?.lang ?? "en",
    );

    const path = String(
      request.data?.path ?? "",
    );

    const config = getConfig();

    await createTransactionCommentsType();

    const {
      testMode,
      paymentAction,
      enforce3d,
    } = getNovalnetConfigValues(
      type,
      config,
    );

    const cartId =
      getCartIdFromContext();

    const ctCart =
      await this.ctCartService.getCart({
        id: cartId,
      });

    const deliveryAddress =
      await this.ctcc(ctCart);

    const billingAddress =
      await this.ctbb(ctCart);

    const parsedCart =
      typeof ctCart === "string"
        ? JSON.parse(ctCart)
        : ctCart;

    const processorURL =
      Context.getProcessorUrlFromContext();

    const sessionId =
      Context.getCtSessionIdFromContext();

    const paymentAmount =
      await this.ctCartService.getPaymentAmount({
        cart: ctCart,
      });

    const deliveryStreet =
      this.splitStreetByComma(
        deliveryAddress?.streetName,
      );

    const billingStreet =
      this.splitStreetByComma(
        billingAddress?.streetName,
      );

    const deliveryAddressStreetName =
      deliveryStreet.streetName;

    const deliveryAddressStreetNumber =
      deliveryStreet.streetNumber;

    const billingAddressStreetName =
      billingStreet.streetName;

    const billingAddressStreetNumber =
      billingStreet.streetNumber;

    const paymentInterface =
      getPaymentInterfaceFromContext() ||
      "mock";

    const ctPayment =
      await this.ctPaymentService.createPayment({
        amountPlanned: paymentAmount,

        paymentMethodInfo: {
          paymentInterface,
        },

        ...(ctCart.customerId && {
          customer: {
            typeId: "customer",
            id: ctCart.customerId,
          },
        }),

        ...(!ctCart.customerId &&
          ctCart.anonymousId && {
            anonymousId:
              ctCart.anonymousId,
          }),
      });

    await this.ctCartService.addPayment({
      resource: {
        id: ctCart.id,
        version: ctCart.version,
      },

      paymentId: ctPayment.id,
    });

    const pspReference =
      randomUUID().toString();

    const transactionComments =
      `Novalnet Transaction ID: N/A\n` +
      `Payment Type: N/A\n` +
      `Status: N/A`;

    await this.ctPaymentService.updatePayment({
      id: ctPayment.id,

      pspReference,

      paymentMethod:
        request.data.paymentMethod.type,

      transaction: {
        type: "Authorization",

        amount:
          ctPayment.amountPlanned,

        interactionId:
          pspReference,

        state: "Pending",

        custom: {
          type: {
            typeId: "type",
            key:
              "novalnet-custom-field",
          },

          fields: {
            transactionComments,
          },
        },
      } as unknown as any,
    } as any);
    
    const orderNumber =
      getFutureOrderNumberFromContext() ??
      "";

    const ctPaymentId =
      ctPayment.id;

    let firstName = "";
    let lastName = "";

    if (ctCart.customerId) {
      const customerRes =
        await projectApiRoot
          .customers()
          .withId({
            ID: ctCart.customerId,
          })
          .get()
          .execute();

      const ctCustomer =
        customerRes.body;

      firstName =
        ctCustomer.firstName ?? "";

      lastName =
        ctCustomer.lastName ?? "";
    } else {
      firstName =
        ctCart.shippingAddress
          ?.firstName ?? "";

      lastName =
        ctCart.shippingAddress
          ?.lastName ?? "";
    }

    const {
      returnUrl,
      errorReturnUrl
    } =
      this.createPaymentReturnUrls({
        processorURL,
        sessionId,
        paymentReference: ctPayment.id,
        orderNumber,
        ctPaymentID: ctPayment.id,
        pspReference,
        lang,
        path: String(
          request.data?.path ?? "",
        ),
      });

    const hookUrl = new URL(
      "/novalnletWebhook",
      processorURL,
    );
      
    const transaction: Record<
      string,
      any
    > = {
      test_mode:
        Number(testMode) === 0
          ? "0"
          : "1",

      payment_type:
        type.toUpperCase(),

      amount:
        String(
          parsedCart?.taxedPrice
            ?.totalGross
            ?.centAmount,
        ),

      currency:
        String(
          parsedCart?.taxedPrice
            ?.totalGross
            ?.currencyCode,
        ),

      return_url:
        returnUrl,

      error_return_url:
        errorReturnUrl,

      hook_url:
        hookUrl.toString(),

      order_no:
        orderNumber,
    };

    if (
      type.toUpperCase() ===
      "CREDITCARD"
    ) {
      const panHash =
        String(
          request.data
            .paymentMethod
            ?.panHash ?? "",
        );

      const uniqueId =
        String(
          request.data
            .paymentMethod
            ?.uniqueId ?? "",
        );

      if (!panHash || !uniqueId) {
        throw new Error(
          "Credit card pan_hash or unique_id is missing",
        );
      }

      if (enforce3d === "1") {
        transaction.enforce_3d = 1;
      }

      transaction.payment_data = {
        pan_hash:
          panHash,

        unique_id:
          uniqueId,
      };
    }

    const novalnetPayload = {
      merchant: {
        signature:
          String(
            getConfig()
              ?.novalnetPublicKey ??
              "",
          ),

        tariff:
          String(
            getConfig()
              ?.novalnetTariff ??
              "",
          ),
      },

      customer: {
        billing: {
          city:
            String(
              billingAddress?.city,
            ),

          country_code:
            String(
              billingAddress?.country,
            ),

          house_no:
            String(
              billingAddressStreetNumber,
            ),

          street:
            String(
              billingAddressStreetName,
            ),

          zip:
            String(
              billingAddress?.postalCode,
            ),
        },

        shipping: {
          city:
            String(
              deliveryAddress?.city,
            ),

          country_code:
            String(
              deliveryAddress?.country,
            ),

          house_no:
            String(
              deliveryAddressStreetNumber,
            ),

          street:
            String(
              deliveryAddressStreetName,
            ),

          zip:
            String(
              deliveryAddress?.postalCode,
            ),
        },

        first_name:
          firstName,

        last_name:
          lastName,

        email:
          parsedCart.customerEmail,
      },

      transaction,

      custom: {
        input1:
          "ctpayment-id",

        inputval1:
          String(
            ctPaymentId ??
              "ctpayment-id not available",
          ),

        input2:
          "pspReference",

        inputval2:
          String(
            pspReference ?? "0",
          ),

        input3:
          "lang",

        inputval3:
          String(
            lang ??
              "lang-no-longer-available",
          ),
      },
    };

    let parsedResponse: any = {};

    try {
      parsedResponse = await this.callNovalnet(
        "https://payport.novalnet.de/v2/payment",
        novalnetPayload,
      );
    } catch (err) {
      log.error(
        "Failed to process redirect payment with Novalnet:",
        err,
      );

      throw new Error(
        "Payment initialization failed",
      );
    }

    if (
      parsedResponse?.result
        ?.status !== "SUCCESS"
    ) {
      log.error(
        "Novalnet API error - Status not SUCCESS:",
        {
          status:
            parsedResponse
              ?.result
              ?.status,

          statusText:
            parsedResponse
              ?.result
              ?.status_text,

        },
      );

      throw new Error(
        parsedResponse
          ?.result
          ?.status_text ||
          "Payment initialization failed",
      );
    }

    const redirectUrl =
      parsedResponse
        ?.result
        ?.redirect_url;

    const txnSecret =
      parsedResponse
        ?.transaction
        ?.txn_secret;

    if (!txnSecret) {
      log.error(
        "No txn_secret in Novalnet response:",
        {
          transaction:
            parsedResponse
              ?.transaction,

        },
      );

      throw new Error(
        "Payment initialization failed - missing transaction secret",
      );
    }

    return {
      paymentReference:
        ctPaymentId,

      txnSecret:
        redirectUrl,
    };
  }

  public createPaymentReturnUrls({
  processorURL,
  sessionId,
  paymentReference,
  orderNumber,
  ctPaymentID,
  pspReference,
  lang,
  path,
}: {
  processorURL: string;
  sessionId: string;
  paymentReference: string;
  orderNumber: string;
  ctPaymentID: string;
  pspReference: string;
  lang: string;
  path: string;
}): {
  returnUrl: string;
  errorReturnUrl: string;
} {
  const successUrl = new URL(
    "/success",
    processorURL,
  );

  successUrl.searchParams.set(
    "paymentReference",
    paymentReference,
  );

  successUrl.searchParams.set(
    "ctsid",
    sessionId,
  );

  successUrl.searchParams.set(
    "orderNumber",
    orderNumber,
  );

  successUrl.searchParams.set(
    "ctPaymentID",
    ctPaymentID,
  );

  successUrl.searchParams.set(
    "pspReference",
    pspReference,
  );

  successUrl.searchParams.set(
    "lang",
    lang,
  );

  successUrl.searchParams.set(
    "path",
    path,
  );

  const failureUrl = new URL(
    "/failure",
    processorURL,
  );

  failureUrl.searchParams.set(
    "paymentReference",
    paymentReference,
  );

  failureUrl.searchParams.set(
    "ctsid",
    sessionId,
  );

  failureUrl.searchParams.set(
    "orderNumber",
    orderNumber,
  );

  failureUrl.searchParams.set(
    "ctPaymentID",
    ctPaymentID,
  );

  failureUrl.searchParams.set(
    "pspReference",
    pspReference,
  );

  failureUrl.searchParams.set(
    "lang",
    lang,
  );

  failureUrl.searchParams.set(
    "path",
    path,
  );

  return {
    returnUrl: successUrl.toString(),
    errorReturnUrl: failureUrl.toString()
  };
}

private async createPendingPaymentTransaction({
  paymentId,
  amount,
  pspReference,
  paymentMethod,
}: {
  paymentId: string;
  amount: any;
  pspReference: string;
  paymentMethod: string;
}) {
  await this.ctPaymentService.updatePayment({
    id: paymentId,
    pspReference,
    paymentMethod,
    transaction: {
      type: "Authorization",
      amount,
      interactionId: pspReference,
      state: "Pending",
    },
  } as any);
}

private async addSettlementTransactionIfRequired({
    paymentId,
    pspReference,
    amount,
    currency,
    transactionType,
    status,
  }: {
    paymentId: string;
    pspReference: string;
    amount?: string | number;
    currency?: string;
    transactionType: "Authorization" | "Charge" | "CancelAuthorization";
    status: string;
  }) {
    if (transactionType === "Authorization") return;

    const paymentRes = await projectApiRoot
      .payments()
      .withId({ ID: paymentId })
      .get()
      .execute();

    const payment = paymentRes.body;
    const interactionId = `${pspReference}-${transactionType}`;
    const alreadyAdded = payment.transactions?.some(
      (transaction) => transaction.interactionId === interactionId,
    );

    if (alreadyAdded) {
      log.info("Settlement transaction already exists", {
        paymentId,
        transactionType,
        interactionId,
      });
      return;
    }

    const transactionAmount = amount != null
      ? {
          centAmount: Number(amount),
          currencyCode: String(currency ?? payment.amountPlanned.currencyCode),
        }
      : payment.amountPlanned;

    await projectApiRoot
      .payments()
      .withId({ ID: paymentId })
      .post({
        body: {
          version: payment.version,
          actions: [
            {
              action: "addTransaction",
              transaction: {
                type: transactionType,
                amount: transactionAmount,
                interactionId,
                state: "Success",
              },
            },
          ],
        },
      })
      .execute();
  }

private buildTransactionComments(
  webhook: Record<string, any>,
  locale: SupportedLocale,
): string {
  const eventType = String(webhook.event?.type ?? "");
  const eventTID = String(webhook.event?.tid ?? "");
  const parentTID = String(webhook.event?.parent_tid ?? "");

  const paymentType = webhook.transaction?.payment_type ?? "";
  const isTestMode = Number(webhook.transaction?.test_mode) === 1;

  const localeCode = locale === "de" ? "de-DE" : "en-GB";

  let date = "";
  let time = "";

  if (webhook.transaction?.date) {
    [date, time] = String(webhook.transaction.date).split(" ");
  } else {
    const now = new Date();

    date = new Intl.DateTimeFormat(localeCode, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Berlin",
    }).format(now);

    time = new Intl.DateTimeFormat(localeCode, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Europe/Berlin",
    }).format(now);
  }

  switch (eventType) {
    case "PAYMENT": {
      const comments: string[] = [
        t(locale, "payment.transactionId", { tid: eventTID }),
        t(locale, "payment.paymentType", { type: paymentType }),
      ];

      if (isTestMode) {
        comments.push(t(locale, "payment.testMode"));
      }

      const bankDetails = webhook.transaction?.bank_details;

      if (bankDetails) {
        comments.push("");
        comments.push(
          t(locale, "payment.referenceText", {
            amount: String(webhook.transaction?.amount ?? ""),
          }),
        );
        comments.push(
          t(locale, "payment.accountHolder", {
            accountHolder: String(bankDetails.account_holder ?? ""),
          }),
        );
        comments.push(
          t(locale, "payment.iban", {
            iban: String(bankDetails.iban ?? ""),
          }),
        );
        comments.push(
          t(locale, "payment.bic", {
            bic: String(bankDetails.bic ?? ""),
          }),
        );
        comments.push(
          t(locale, "payment.bankName", {
            bankName: String(bankDetails.bank_name ?? ""),
          }),
        );
        comments.push(
          t(locale, "payment.bankPlace", {
            bankPlace: String(bankDetails.bank_place ?? ""),
          }),
        );
      }

      return comments.join("\n");
    }

    case "TRANSACTION_CAPTURE":
      return t(locale, "callback.captureComment", {
        date,
        time,
      });

    case "TRANSACTION_CANCEL":
      return t(locale, "callback.cancelComment", {
        date,
        time,
      });

    case "TRANSACTION_REFUND":
      return t(locale, "callback.refundComment", {
        eventTID: parentTID,
        refundTID: eventTID,
        refundedAmount: (
          Number(webhook.transaction?.refund?.amount ?? 0) / 100
        ).toFixed(2),
        currency:
          webhook.transaction?.refund?.currency ??
          webhook.transaction?.currency,
      });

    case "CREDIT": {
	  return t(locale, "callback.creditComment", {
	    parentTID,
	    amount: (
	      Number(webhook.transaction?.amount ?? 0) / 100
	    ).toFixed(2),
	    currency: webhook.transaction?.currency ?? "",
	    date,
	    time,
	    transactionID: eventTID,
	  });
    }

    case "TRANSACTION_UPDATE": {
      const updateType = String(
        webhook.transaction?.update_type ?? "",
      ).toUpperCase();

      const formattedAmount = (
        Number(webhook.transaction?.amount ?? 0) / 100
      ).toFixed(2);

      switch (updateType) {
        case "AMOUNT":
          return t(locale, "callback.amountUpdateComment", {
            eventTID,
            amount: formattedAmount,
            currency: webhook.transaction?.currency,
          });

        case "DUE_DATE":
        case "AMOUNT_DUE_DATE":
          return t(locale, "callback.dueDateUpdateComment", {
            eventTID,
            amount: formattedAmount,
            currency: webhook.transaction?.currency,
            dueDate: String(webhook.transaction?.due_date ?? ""),
          });

        case "STATUS":
          return t(locale, "callback.onholdToComplete", {
            eventTID,
            date,
            time,
          });

        default:
          return "";
      }
    }
    case "CHARGEBACK":
    case "RETURN_DEBIT":
    case "REVERSAL":
      return t(locale, "callback.chargebackComment", {
      parentTID,
      amount: (
        Number(webhook.transaction?.amount ?? 0) / 100
      ).toFixed(2),
      currency: webhook.transaction?.currency ?? "",
      date,
      time,
      eventTID,
      });
		  
    default:
      return "";
  }
} 

  public splitStreetByComma(street?: string): {
    streetName: string;
    streetNumber: string;
  } {
    if (!street) {
      return { streetName: "", streetNumber: "" };
    }

    const parts = street.split(",");

    if (parts.length < 2) {
      return { streetName: street.trim(), streetNumber: "" };
    }

    return {
      streetName: parts[0].trim(),
      streetNumber: parts.slice(1).join(",").trim(),
    };
  }
}
