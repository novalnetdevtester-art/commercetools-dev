import {
  Cart,
  healthCheckCommercetoolsPermissions,
  statusHandler,
} from "@commercetools/connect-payments-sdk";
import { ConfigResponse, StatusResponse } from "./types/operation.type";
import { Address, Customer } from "@commercetools/platform-sdk";
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

type NovalnetConfig = {
  testMode: string;
  paymentAction: string;
  dueDate: string;
  minimumAmount: string;
  enforce3d: string;
  displayInline: string;
  allowb2bCustomers: string;
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
    allowb2bCustomers: String(
      config?.[`novalnet_${upperType}_Allowb2bCustomers`],
    ),
    forceNonGuarantee: String(
      config?.[`novalnet_${upperType}_ForceNonGuarantee`],
    ),
  };
}

function getPaymentDueDate(configuredDueDate: number | string): string | null {
  const days = Number(configuredDueDate);
  if (isNaN(days)) {
    return null;
  }
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + days);
  const formattedDate = dueDate.toISOString().split("T")[0];
  return formattedDate;
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

  public customerDetails(customer: Customer) {
    return customer;
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
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error("Transaction missing id");
    const transactionComments = `Novalnet Transaction ID: ${
      parsedData.tid ?? "NN/A"
    }\nPayment Type: ${parsedData.payment_type ?? "NN/A"}\n${
      parsedData.status_text ?? "NN/A"
    }`;

    await projectApiRoot
      .payments()
      .withId({ ID: parsedData.ctPaymentID })
      .post({
        body: {
          version,
          actions: [
            {
              action: "setTransactionCustomField",
              transactionId: txId,
              name: "transactionComments",
              value: transactionComments,
            },
          ],
        },
      })
      .execute();
    log.info("[failureResponse] Payment failure comments saved", {
      ctPaymentID: parsedData.ctPaymentID,
    });
  }

  public async getConfigValues({ data }: { data: any }) {
    try {
      const clientKey = String(getConfig()?.novalnetClientkey ?? "");
      return { paymentReference: clientKey };
    } catch (err) {
      return { paymentReference: "" };
    }
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
      const merchantReturnUrl =
        getMerchantReturnUrlFromContext() || config.merchantReturnUrl;
      const novalnetPayload = {
        transaction: {
          tid: parsedData?.interfaceId ?? "",
        },
      };

      let responseData: any;
      const accessKey = String(getConfig()?.novalnetPublicKey ?? "");
      const base64Key = btoa(accessKey);
      const lang = parsedData?.lang;

      log.info(
        "[transactionUpdate] Fetching transaction details from Novalnet",
        { tid: parsedData?.interfaceId },
      );
      try {
        const novalnetResponse = await fetch(
          "https://payport.novalnet.de/v2/transaction/details",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              "X-NN-Access-Key": base64Key,
            },
            body: JSON.stringify(novalnetPayload),
          },
        );

        if (!novalnetResponse.ok) {
          throw new Error(`Novalnet API error: ${novalnetResponse.status}`);
        }

        responseData = await novalnetResponse.json();
        log.info("[transactionUpdate] Novalnet transaction details fetched", {
          status: responseData?.transaction?.status,
          tid: responseData?.transaction?.tid,
        });
      } catch (err) {
        log.error(
          "[transactionUpdate] Failed to fetch Novalnet transaction details",
          err,
        );
        throw new Error("Payment verification failed");
      }

      const pspReference = parsedData.pspReference;
      if (!pspReference) {
        throw new Error("Missing pspReference");
      }

      const tid = responseData?.transaction?.tid ?? "";
      const paymentType = responseData?.transaction?.payment_type ?? "";
      const isTestMode = responseData?.transaction?.test_mode == 1;
      const status = responseData?.transaction?.status;
      const state =
        status === "PENDING" || status === "ON_HOLD"
          ? "Pending"
          : status === "CONFIRMED"
            ? "Success"
            : status === "CANCELLED"
              ? "Canceled"
              : "Failure";
      const statusCode = responseData?.transaction?.status_code ?? "";
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
      const transactionComments =
        lang === "en"
          ? localizedTransactionComments.en
          : localizedTransactionComments.de;

      const raw = await this.ctPaymentService.getPayment({
        id: parsedData.ctPaymentId,
      } as any);

      const payment = (raw as any)?.body ?? raw;
      const version = payment.version;
      if (!payment?.transactions?.length) {
        throw new Error("No transactions on payment");
      }
      const tx = payment.transactions.find(
        (t: any) => t.interactionId === pspReference,
      );
      if (!tx?.id) {
        throw new Error("Transaction not found for PSP reference");
      }

      const txId = tx.id;
      const transactionCommentsText =
        typeof transactionComments === "string"
          ? transactionComments
          : String(transactionComments ?? "");
      const actions: PaymentUpdateAction[] = [
        {
          action: "setTransactionCustomType",
          transactionId: txId,
          type: {
            key: "novalnet-custom-field",
            typeId: "type",
          },
        },
        {
          action: "setTransactionCustomField",
          transactionId: txId,
          name: "transactionComments",
          value: transactionCommentsText,
        },
        {
          action: "setStatusInterfaceCode",
          interfaceCode: String(statusCode),
        },
        {
          action: "changeTransactionState",
          transactionId: txId,
          state,
        },
      ];

      await projectApiRoot
        .payments()
        .withId({ ID: parsedData.ctPaymentId })
        .post({
          body: {
            version,
            actions,
          },
        })
        .execute();
      log.info("[transactionUpdate] Payment updated in CT", {
        ctPaymentId: parsedData.ctPaymentId,
        state,
        statusCode,
      });

      const updatedPaymentRoot = await projectApiRoot
        .payments()
        .withId({ ID: parsedData.ctPaymentId })
        .get()
        .execute();

      const orderSearch = await projectApiRoot
        .orders()
        .get({
          queryArgs: {
            where: `paymentInfo(payments(id="${parsedData.ctPaymentId}"))`,
            limit: 1,
          },
        })
        .execute();

      const orderRoot = orderSearch.body.results?.[0];
      if (!orderRoot) {
        log.info(
          "[transactionUpdate] No order linked to this payment – nothing to sync yet",
          { ctPaymentId: parsedData.ctPaymentId },
        );
        return;
      }

      const orderId = orderRoot.id;
      const updatedTransaction = updatedPaymentRoot.body.transactions?.find(
        (t) => t.id === txId,
      );

      const paymentComment =
        updatedTransaction?.custom?.fields?.transactionComments ??
        transactionCommentsText;

      const order = await projectApiRoot
        .orders()
        .withId({ ID: orderId })
        .get()
        .execute();

      await projectApiRoot
        .orders()
        .withId({ ID: orderId })
        .post({
          body: {
            version: order.body.version,
            actions: [
              {
                action: "setCustomType",
                type: {
                  key: "order-payment-comments",
                  typeId: "type",
                },
              },
              {
                action: "setCustomField",
                name: "paymentComments",
                value: paymentComment,
              },
            ],
          },
        })
        .execute();

      try {
        const container = "nn-private-data";
        const key = `${parsedData.ctPaymentId}-${pspReference}`;
        await customObjectService.upsert(container, key, {
          tid,
          paymentMethod: paymentType,
          status,
          orderNo: responseData?.transaction?.order_no ?? "",
          cMail: responseData?.customer?.email ?? "",
          additionalInfo: {
            comments: transactionComments,
          },
        });
      } catch (err) {
        log.error("CustomObject error", err);
        throw err;
      }

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
      allowb2bCustomers,
      forceNonGuarantee,
    } = getNovalnetConfigValues(type, config);
    await createTransactionCommentsType();
    const ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });

    const deliveryAddress = await this.ctcc(ctCart);
    const billingAddress = await this.ctbb(ctCart);
    const parsedCart = typeof ctCart === "string" ? JSON.parse(ctCart) : ctCart;
    const dueDateValue = getPaymentDueDate(dueDate);
    const lang = String(request.data?.lang ?? "en") as SupportedLocale;
    const orderNumber = getFutureOrderNumberFromContext();
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

      /* ================= Address check ================= */
      const sameAddress =
        billingAddress?.city === deliveryAddress?.city &&
        billingAddress?.country === deliveryAddress?.country &&
        billingAddressStreetName === deliveryAddressStreetName &&
        billingAddressStreetNumber === deliveryAddressStreetNumber &&
        billingAddress?.postalCode === deliveryAddress?.postalCode;

      /* ================= Country check ================= */
      const billingCountry = billingAddress && billingAddress.country;
      const isEuropean = billingCountry
        ? this.getEuropeanRegionCountryCodes().includes(billingCountry)
        : false;

      /* ================= Currency check ================= */
      const isEur =
        String(parsedCart?.taxedPrice?.totalGross?.currencyCode) === "EUR";

      /* ================= Amount check ================= */
      const orderTotal = Number(
        parsedCart?.taxedPrice?.totalGross?.centAmount ?? 0,
      );
      const minAmount = Number(minimumAmount) || 0;
      const amountValid = orderTotal >= minAmount;
      /* ================= B2B country check ================= */
      const countryAllowed =
        allowb2bCustomers &&
        billingCountry &&
        ["DE", "AT", "CH"].includes(billingCountry);

      /* ================= FINAL DECISION ================= */
      const guaranteePayment =
        Boolean(sameAddress) &&
        Boolean(isEuropean) &&
        Boolean(isEur) &&
        Boolean(amountValid) &&
        Boolean(countryAllowed);

      /* ================= Force non-guarantee ================= */
      const isForceNonGuarantee =
        forceNonGuarantee !== undefined &&
        forceNonGuarantee !== null &&
        !Number.isNaN(Number(forceNonGuarantee)) &&
        Number(forceNonGuarantee) !== 0;
      if (isForceNonGuarantee && guaranteePayment) {
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

    if (!company) {
      const rawBirthDate = request.data.paymentMethod?.birthdate;
      if (typeof rawBirthDate === "string" && rawBirthDate.trim() !== "") {
        birthDate = this.formatBirthDateToYMD(rawBirthDate);
      }
    }

    if (
      String(request.data.paymentMethod.type).toUpperCase() ===
      "DIRECT_DEBIT_SEPA"
    ) {
      transaction.payment_data = {
        account_holder: String(request.data.paymentMethod.accHolder),
        iban: String(request.data.paymentMethod.iban),
      };
    }
    if (
      String(request.data.paymentMethod.type).toUpperCase() ===
        "DIRECT_DEBIT_SEPA" &&
      String(request.data.paymentMethod.bic) != ""
    ) {
      transaction.payment_data = {
        bic: String(request.data.paymentMethod.bic),
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
    if (
      String(request.data.paymentMethod.type).toUpperCase() === "CREDITCARD"
    ) {
      if (enforce3d == "1") {
        transaction.enforce_3d = 1;
      }
      transaction.payment_data = {
        pan_hash: String(request.data.paymentMethod.panHash),
        unique_id: String(request.data.paymentMethod.uniqueId),
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
        signature: String(getConfig()?.novalnetPrivateKey),
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
    if (paymentAction === "authorize") {
      const orderTotal = String(parsedCart?.taxedPrice?.totalGross?.centAmount);
      paymentActionUrl = orderTotal >= minimumAmount ? "authorize" : "payment";
    }
    const url =
      paymentActionUrl === "payment"
        ? "https://payport.novalnet.de/v2/payment"
        : "https://payport.novalnet.de/v2/authorize";
    let responseData: any;
    try {
      const accessKey = String(getConfig()?.novalnetPublicKey ?? "");
      const base64Key = btoa(accessKey);
      const novalnetResponse = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-NN-Access-Key": base64Key,
        },
        body: JSON.stringify(novalnetPayload),
      });

      if (!novalnetResponse.ok) {
        throw new Error(`Novalnet API error: ${novalnetResponse.status}`);
      }

      responseData = await novalnetResponse.json();
    } catch (err) {
      log.error("Failed to process payment with Novalnet:", err);
      throw new Error("Payment processing failed");
    }
    const parsedResponse = responseData;
    const statusCode = parsedResponse?.transaction?.status_code;
    const status = parsedResponse?.transaction?.status;

    const state =
      status === "PENDING" || status === "ON_HOLD"
        ? "Pending"
        : status === "CONFIRMED"
          ? "Success"
          : status === "CANCELLED"
            ? "Canceled"
            : "Failure";
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
        type: "Authorization",
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

    // Re-read payment to ensure transactionComments is persisted
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
    // Store for later Order sync (because Order does NOT exist yet)
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

    // Never try to read Order here — it does not exist yet
    return {
      paymentReference: ctPayment.id,
      novalnetResponse: parsedResponse,
      transactionStatus: parsedResponse?.transaction?.status,
      transactionStatusText: parsedResponse?.transaction?.status_text,
    };
  }

  getEuropeanRegionCountryCodes(): string[] {
    return [
      "AT",
      "BE",
      "BG",
      "CY",
      "CZ",
      "DE",
      "DK",
      "EE",
      "ES",
      "FI",
      "FR",
      "GR",
      "HR",
      "HU",
      "IE",
      "IT",
      "LT",
      "LU",
      "LV",
      "MT",
      "NL",
      "PL",
      "PT",
      "RO",
      "SE",
      "SI",
      "SK",
      "UK",
      "CH",
    ];
  }

  formatBirthDateToYMD(dateStr: string): string | undefined {
    const parts = dateStr.split("-");
    if (parts.length !== 3) {
      return undefined;
    }

    const [day, month, year] = parts;
    if (!day || !month || !year) {
      return undefined;
    }

    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
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

  private async syncPaymentToOrder(paymentId: string, pspReference: string) {
    // 1. Wait for Order to exist
    const order = await this.waitForOrderByPayment(paymentId);

    if (!order) {
      log.warn("Order not found yet – will sync on next webhook", {
        paymentId,
        pspReference,
      });
      return;
    }

    // 2. Load Payment
    const paymentRes = await projectApiRoot
      .payments()
      .withId({ ID: paymentId })
      .get()
      .execute();

    const payment = paymentRes.body;

    const tx = payment.transactions?.find(
      (t) => t.interactionId === pspReference,
    );

    if (!tx) {
      log.warn("Transaction not found for PSP reference", {
        paymentId,
        pspReference,
      });
      return;
    }

    const comment = tx.custom?.fields?.transactionComments;
    if (!comment) return;

    // 3. Write into Order
    await projectApiRoot
      .orders()
      .withId({ ID: order.id })
      .post({
        body: {
          version: order.version,
          actions: [
            {
              action: "setCustomType",
              type: {
                key: "order-payment-comments",
                typeId: "type",
              },
            },
            {
              action: "setCustomField",
              name: "paymentComments",
              value: comment,
            },
          ],
        },
      })
      .execute();

    log.info("Payment comments synced to Order", {
      orderId: order.id,
      paymentId,
    });
  }

  public async createWebhook(
    webhookData: any[],
    req?: FastifyRequest,
  ): Promise<any> {
    if (!Array.isArray(webhookData) || webhookData.length === 0) {
      throw new Error("Invalid webhook payload");
    }

    const webhook = webhookData[0];
    await this.validateRequiredParameters(webhook);
    await this.validateChecksum(webhook);
    if (req) {
      await this.validateIpAddress(req);
    }
    const eventType = webhook.event?.type;
    const status = webhook.result?.status;
    const lang = webhook.custom?.lang;
    this.getOrderDetails(webhook);
    if (status !== "SUCCESS") {
      return { message: "Webhook ignored (non-success)" };
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
        transactionComments = await this.handleChargeback(webhook);
        break;

      case "PAYMENT_REMINDER_1":
      case "PAYMENT_REMINDER_2":
        transactionComments = await this.handlePaymentReminder(webhook);
        break;

      case "SUBMISSION_TO_COLLECTION_AGENCY":
        transactionComments = await this.handleCollectionSubmission(webhook);
        break;

      default:
        log.warn(`Unhandled Novalnet event type: ${eventType}`);
    }

    return {
      message: transactionComments,
      eventType,
    };
  }

  public async handlePayment(webhook: any) {
    const transactionComments = `Novalnet Transaction ID: ${
      webhook.transaction.tid ?? "NN/A"
    }\nPayment Type: ${webhook.transaction.payment_type ?? "NN/A"}\n${
      webhook.result.status_text ?? "NN/A"
    }`;
    const raw = await this.ctPaymentService.getPayment({
      id: webhook.custom.inputval1,
    } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find(
      (t: any) => t.interactionId === webhook?.custom.inputval2,
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error("Transaction missing id");
    const existingComments: string =
      tx.custom?.fields?.transactionComments ?? "";
    const updatedTransactionComments = existingComments
      ? `${existingComments}\n\n---\n${transactionComments}`
      : transactionComments;
    const statusCode = webhook?.transaction?.status_code ?? "";
    const updatedPayment = await projectApiRoot
      .payments()
      .withId({ ID: webhook.custom.inputval1 })
      .post({
        body: {
          version,
          actions: [
            {
              action: "setTransactionCustomField",
              transactionId: txId,
              name: "transactionComments",
              value: updatedTransactionComments,
            },
            {
              action: "setStatusInterfaceCode",
              interfaceCode: String(statusCode),
            },
            {
              action: "changeTransactionState",
              transactionId: txId,
              state: "Success",
            },
          ],
        },
      })
      .execute();
    await this.syncPaymentToOrder(
      webhook?.custom.inputval1,
      webhook?.custom.inputval2,
    );
    return transactionComments;
  }

  public async handleTransactionCapture(webhook: any) {
    const { date, time } = this.getFormattedDateTime();
    const supportedLocales: SupportedLocale[] = ["en", "de"];
    const lang = webhook.custom.lang;
    const localizedTransactionComments = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = [
          t(locale, "webhook.captureComment", { date, time }),
        ].join("\n");
        return acc;
      },
      {} as Record<SupportedLocale, string>,
    );
    const transactionComments =
      lang == "en"
        ? localizedTransactionComments.en
        : localizedTransactionComments.de;
    const status = webhook?.transaction?.status;
    const state =
      status === "PENDING" || status === "ON_HOLD"
        ? "Pending"
        : status === "CONFIRMED"
          ? "Success"
          : status === "CANCELLED"
            ? "Canceled"
            : "Failure";
    const raw = await this.ctPaymentService.getPayment({
      id: webhook.custom.inputval1,
    } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find(
      (t: any) => t.interactionId === webhook.custom.inputval2,
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error("Transaction missing id");
    const existingComments: string =
      tx.custom?.fields?.transactionComments ?? "";
    const updatedTransactionComments = existingComments
      ? `${existingComments}\n\n---\n${transactionComments}`
      : transactionComments;
    const statusCode = webhook?.transaction?.status_code ?? "";
    const updatedPayment = await projectApiRoot
      .payments()
      .withId({ ID: webhook.custom.inputval1 })
      .post({
        body: {
          version,
          actions: [
            {
              action: "setTransactionCustomField",
              transactionId: txId,
              name: "transactionComments",
              value: updatedTransactionComments,
            },
            {
              action: "setStatusInterfaceCode",
              interfaceCode: String(statusCode),
            },
            {
              action: "changeTransactionState",
              transactionId: txId,
              state: state,
            },
          ],
        },
      })
      .execute();
    await this.syncPaymentToOrder(
      webhook?.custom.inputval1,
      webhook?.custom.inputval2,
    );
    return transactionComments;
  }

  public async handleTransactionCancel(webhook: any) {
    const { date, time } = this.getFormattedDateTime();
    const lang = webhook.custom.lang;
    const supportedLocales: SupportedLocale[] = ["en", "de"];
    const localizedTransactionComments = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = [t(locale, "webhook.cancelComment", { date, time })].join(
          "\n",
        );
        return acc;
      },
      {} as Record<SupportedLocale, string>,
    );
    const transactionComments =
      lang == "de"
        ? localizedTransactionComments.de
        : localizedTransactionComments.en;
    const status = webhook?.transaction?.status;
    const state =
      status === "PENDING" || status === "ON_HOLD"
        ? "Pending"
        : status === "CONFIRMED"
          ? "Success"
          : status === "CANCELLED"
            ? "Canceled"
            : "Failure";
    const raw = await this.ctPaymentService.getPayment({
      id: webhook.custom.inputval1,
    } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find(
      (t: any) => t.interactionId === webhook.custom.inputval2,
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error("Transaction missing id");
    const existingComments: string =
      tx.custom?.fields?.transactionComments ?? "";
    const updatedTransactionComments = existingComments
      ? `${existingComments}\n\n---\n${transactionComments}`
      : transactionComments;
    const statusCode = webhook?.transaction?.status_code ?? "";
    const updatedPayment = await projectApiRoot
      .payments()
      .withId({ ID: webhook.custom.inputval1 })
      .post({
        body: {
          version,
          actions: [
            {
              action: "setTransactionCustomField",
              transactionId: txId,
              name: "transactionComments",
              value: updatedTransactionComments,
            },
            {
              action: "setStatusInterfaceCode",
              interfaceCode: String(statusCode),
            },
            {
              action: "changeTransactionState",
              transactionId: txId,
              state: state,
            },
          ],
        },
      })
      .execute();
    await this.syncPaymentToOrder(
      webhook?.custom.inputval1,
      webhook?.custom.inputval2,
    );
    return transactionComments;
  }

  public async handleTransactionRefund(webhook: any) {
    const eventTID = webhook.event.tid;
    const currency = webhook.transaction.currency;
    const { date, time } = this.getFormattedDateTime();
    const refundedAmount = webhook.transaction.refund.amount;
    const refundTID = webhook.transaction.refund.tid ?? "";
    const lang = webhook.custom.lang;

    const supportedLocales: SupportedLocale[] = ["en", "de"];
    const localizedTransactionComments = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = [
          t(locale, "webhook.refundComment", {
            eventTID,
            refundedAmount,
            currency,
          }),
        ].join("\n");
        return acc;
      },
      {} as Record<SupportedLocale, string>,
    );

    const localizedTransactionComment = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = [
          t(locale, "webhook.refundTIDComment", {
            eventTID,
            refundedAmount,
            currency,
            refundTID,
          }),
        ].join("\n");
        return acc;
      },
      {} as Record<SupportedLocale, string>,
    );
    const refundComment =
      lang == "de"
        ? localizedTransactionComments.de
        : localizedTransactionComments.en;
    const refundTIDComment =
      lang == "de"
        ? localizedTransactionComment.de
        : localizedTransactionComment.en;
    const transactionComments = refundTID ? refundTIDComment : refundComment;
    const raw = await this.ctPaymentService.getPayment({
      id: webhook.custom.inputval1,
    } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find(
      (t: any) => t.interactionId === webhook.custom.inputval2,
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error("Transaction missing id");
    const existingComments: string =
      tx.custom?.fields?.transactionComments ?? "";
    const updatedTransactionComments = existingComments
      ? `${existingComments}\n\n---\n${transactionComments}`
      : transactionComments;
    const statusCode = webhook?.transaction?.status_code ?? "";
    const status = webhook?.transaction?.status;
    const state =
      status === "PENDING" || status === "ON_HOLD"
        ? "Pending"
        : status === "CONFIRMED"
          ? "Success"
          : status === "CANCELLED"
            ? "Canceled"
            : "Failure";
    const updatedPayment = await projectApiRoot
      .payments()
      .withId({ ID: webhook.custom.inputval1 })
      .post({
        body: {
          version,
          actions: [
            {
              action: "setTransactionCustomField",
              transactionId: txId,
              name: "transactionComments",
              value: updatedTransactionComments,
            },
            {
              action: "setStatusInterfaceCode",
              interfaceCode: String(statusCode),
            },
          ],
        },
      })
      .execute();
    await this.syncPaymentToOrder(
      webhook?.custom.inputval1,
      webhook?.custom.inputval2,
    );
    return transactionComments;
  }

  public async handleTransactionUpdate(webhook: any) {
    const eventTID = webhook.event.tid;
    const amount = String(webhook.transaction.amount / 100);
    const currency = webhook.transaction.currency;
    const dueDate = webhook.transaction.due_date;
    const { date, time } = this.getFormattedDateTime();
    const lang = webhook.custom.lang;

    const amountUpdateComment = await this.localcomments(
      "webhook.amountUpdateComment",
      { eventTID: eventTID, amount: amount, currency: currency },
    );
    const dueDateUpdateComment = await this.localcomments(
      "webhook.dueDateUpdateComment",
      {
        eventTID: eventTID,
        amount: amount,
        currency: currency,
        dueDate: dueDate,
      },
    );

    const orderDetails = await this.getOrderDetails(webhook);
    let transactionComments = "";
    if (
      ["DUE_DATE", "AMOUNT", "AMOUNT_DUE_DATE"].includes(
        webhook.transaction.update_type,
      )
    ) {
      transactionComments =
        lang == "en" ? amountUpdateComment.en : amountUpdateComment.de;
      if (webhook.transaction.due_date) {
        const dueDate = webhook.transaction.due_date;
        transactionComments =
          lang == "en" ? dueDateUpdateComment.en : dueDateUpdateComment.de;
      }
    }

    const pendingToComplete = await this.localcomments(
      "webhook.pendingToComplete",
      { eventTID: eventTID, date: date, time: time },
    );
    const onholdToComplete = await this.localcomments(
      "webhook.onholdToComplete",
      { eventTID: eventTID, date: date, time: time },
    );
    const confirmComments = await this.localcomments("webhook.confirmComment", {
      date,
      time,
    });
    const cancelComments = await this.localcomments("webhook.cancelComment", {
      date,
      time,
    });

    if (
      orderDetails.status != webhook.transaction.status &&
      ["PENDING", "ON_HOLD"].includes(orderDetails.status)
    ) {
      if (webhook.transaction.status === "CONFIRMED") {
        transactionComments =
          lang == "en" ? pendingToComplete.en : pendingToComplete.de;
      } else if (webhook.transaction.status === "ON_HOLD") {
        transactionComments =
          lang == "en" ? onholdToComplete.en : onholdToComplete.de;
      } else {
        transactionComments =
          lang == "en" ? cancelComments.en : cancelComments.de;
      }
    } else if (orderDetails.status === "ON_HOLD") {
      if (webhook.transaction.status === "CONFIRMED") {
        transactionComments =
          lang == "en" ? confirmComments.en : confirmComments.de;
      } else {
        transactionComments =
          lang == "en" ? cancelComments.en : cancelComments.de;
      }
    }

    const raw = await this.ctPaymentService.getPayment({
      id: webhook.custom.inputval1,
    } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find(
      (t: any) => t.interactionId === webhook.custom.inputval2,
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error("Transaction missing id");
    const existingComments: string =
      tx.custom?.fields?.transactionComments ?? "";
    const updatedTransactionComments = existingComments
      ? `${existingComments}\n\n---\n${transactionComments}`
      : transactionComments;
    const statusCode = webhook?.transaction?.status_code ?? "";
    const status = webhook?.transaction?.status;
    const state =
      status === "PENDING" || status === "ON_HOLD"
        ? "Pending"
        : status === "CONFIRMED"
          ? "Success"
          : status === "CANCELLED"
            ? "Canceled"
            : "Failure";
    const updatedPayment = await projectApiRoot
      .payments()
      .withId({ ID: webhook.custom.inputval1 })
      .post({
        body: {
          version,
          actions: [
            {
              action: "setTransactionCustomField",
              transactionId: txId,
              name: "transactionComments",
              value: updatedTransactionComments,
            },
            {
              action: "setStatusInterfaceCode",
              interfaceCode: String(statusCode),
            },
            {
              action: "changeTransactionState",
              transactionId: txId,
              state: state,
            },
          ],
        },
      })
      .execute();
    await this.syncPaymentToOrder(
      webhook?.custom.inputval1,
      webhook?.custom.inputval2,
    );
    return transactionComments;
  }

  public async handleCredit(webhook: any) {
    const eventTID = webhook.event.tid;
    const transactionID = webhook.transaction.tid;
    const parentTID = webhook.event.parent_tid ?? eventTID;
    const amount = String(webhook.transaction.amount / 100);
    const currency = webhook.transaction.currency;
    const { date, time } = this.getFormattedDateTime();
    const supportedLocales: SupportedLocale[] = ["en", "de"];
    const lang = webhook.custom.lang;
    const localizedTransactionComments = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = [
          t(locale, "webhook.creditComment", {
            parentTID,
            amount,
            currency,
            date,
            time,
            transactionID,
          }),
        ].join("\n");
        return acc;
      },
      {} as Record<SupportedLocale, string>,
    );
    const transactionComments =
      lang == "en"
        ? localizedTransactionComments.en
        : localizedTransactionComments.de;
    const raw = await this.ctPaymentService.getPayment({
      id: webhook.custom.inputval1,
    } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find(
      (t: any) => t.interactionId === webhook.custom.inputval2,
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error("Transaction missing id");
    const existingComments: string =
      tx.custom?.fields?.transactionComments ?? "";
    const updatedTransactionComments = existingComments
      ? `${existingComments}\n\n---\n${transactionComments}`
      : transactionComments;
    const statusCode = webhook?.transaction?.status_code ?? "";
    const status = webhook?.transaction?.status;
    const state =
      status === "PENDING" || status === "ON_HOLD"
        ? "Pending"
        : status === "CONFIRMED"
          ? "Success"
          : status === "CANCELLED"
            ? "Canceled"
            : "Failure";
    const updatedPayment = await projectApiRoot
      .payments()
      .withId({ ID: webhook.custom.inputval1 })
      .post({
        body: {
          version,
          actions: [
            {
              action: "setTransactionCustomField",
              transactionId: txId,
              name: "transactionComments",
              value: updatedTransactionComments,
            },
            {
              action: "setStatusInterfaceCode",
              interfaceCode: String(statusCode),
            },
            {
              action: "changeTransactionState",
              transactionId: txId,
              state: state,
            },
          ],
        },
      })
      .execute();
    await this.syncPaymentToOrder(
      webhook?.custom.inputval1,
      webhook?.custom.inputval2,
    );
    return transactionComments;
  }

  public async handleChargeback(webhook: any) {
    const eventTID = webhook.event.tid;
    const transactionID = webhook.transaction.tid;
    const parentTID = webhook.event.parent_tid ?? eventTID;
    const amount = String(webhook.transaction.amount / 100);
    const currency = webhook.transaction.currency;
    const { date, time } = this.getFormattedDateTime();
    const supportedLocales: SupportedLocale[] = ["en", "de"];
    const lang = webhook.custom.lang;
    const localizedTransactionComments = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = [
          t(locale, "webhook.chargebackComment", {
            parentTID,
            amount,
            currency,
            date,
            time,
            eventTID,
          }),
        ].join("\n");
        return acc;
      },
      {} as Record<SupportedLocale, string>,
    );
    const transactionComments =
      lang == "en"
        ? localizedTransactionComments.en
        : localizedTransactionComments.de;
    const raw = await this.ctPaymentService.getPayment({
      id: webhook.custom.inputval1,
    } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find(
      (t: any) => t.interactionId === webhook.custom.inputval2,
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error("Transaction missing id");
    const existingComments: string =
      tx.custom?.fields?.transactionComments ?? "";
    const updatedTransactionComments = existingComments
      ? `${existingComments}\n\n---\n${transactionComments}`
      : transactionComments;
    const status = webhook?.transaction?.status;
    const state =
      status === "PENDING" || status === "ON_HOLD"
        ? "Pending"
        : status === "CONFIRMED"
          ? "Success"
          : status === "CANCELLED"
            ? "Canceled"
            : "Failure";
    const statusCode = webhook?.transaction?.status_code ?? "";
    const updatedPayment = await projectApiRoot
      .payments()
      .withId({ ID: webhook.custom.inputval1 })
      .post({
        body: {
          version,
          actions: [
            {
              action: "setTransactionCustomField",
              transactionId: txId,
              name: "transactionComments",
              value: updatedTransactionComments,
            },
            {
              action: "setStatusInterfaceCode",
              interfaceCode: String(statusCode),
            },
            {
              action: "changeTransactionState",
              transactionId: txId,
              state: state,
            },
          ],
        },
      })
      .execute();
    await this.syncPaymentToOrder(
      webhook?.custom.inputval1,
      webhook?.custom.inputval2,
    );
    return transactionComments;
  }

  public async handlePaymentReminder(webhook: any) {
    const { date, time } = this.getFormattedDateTime();
    const reminderIndex = webhook.event.type.split("_")[2];
    const supportedLocales: SupportedLocale[] = ["en", "de"];
    const lang = webhook.custom.lang;
    const localizedTransactionComments = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = [
          t(locale, "webhook.paymentRemainderComment", { reminderIndex }),
        ].join("\n");
        return acc;
      },
      {} as Record<SupportedLocale, string>,
    );
    const transactionComments =
      lang == "de"
        ? localizedTransactionComments.de
        : localizedTransactionComments.en;
    const raw = await this.ctPaymentService.getPayment({
      id: webhook.custom.inputval1,
    } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find(
      (t: any) => t.interactionId === webhook.custom.inputval2,
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error("Transaction missing id");
    const existingComments: string =
      tx.custom?.fields?.transactionComments ?? "";
    const updatedTransactionComments = existingComments
      ? `${existingComments}\n\n---\n${transactionComments}`
      : transactionComments;
    const statusCode = webhook?.transaction?.status_code ?? "";
    const updatedPayment = await projectApiRoot
      .payments()
      .withId({ ID: webhook.custom.inputval1 })
      .post({
        body: {
          version,
          actions: [
            {
              action: "setTransactionCustomField",
              transactionId: txId,
              name: "transactionComments",
              value: updatedTransactionComments,
            },
          ],
        },
      })
      .execute();
    await this.syncPaymentToOrder(
      webhook?.custom.inputval1,
      webhook?.custom.inputval2,
    );
    return transactionComments;
  }

  public async handleCollectionSubmission(webhook: any) {
    const { date, time } = this.getFormattedDateTime();
    const reminderIndex = webhook.event.type.split("_")[2];
    const lang = webhook.custom.lang;
    const supportedLocales: SupportedLocale[] = ["en", "de"];
    const localizedTransactionComments = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = [
          t(locale, "webhook.collectionSubmissionComment", { reminderIndex }),
        ].join("\n");
        return acc;
      },
      {} as Record<SupportedLocale, string>,
    );
    const transactionComments =
      lang == "de"
        ? localizedTransactionComments.de
        : localizedTransactionComments.en;
    const raw = await this.ctPaymentService.getPayment({
      id: webhook.custom.inputval1,
    } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find(
      (t: any) => t.interactionId === webhook.custom.inputval2,
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error("Transaction missing id");
    const existingComments: string =
      tx.custom?.fields?.transactionComments ?? "";
    const updatedTransactionComments = existingComments
      ? `${existingComments}\n\n---\n${transactionComments}`
      : transactionComments;
    const statusCode = webhook?.transaction?.status_code ?? "";
    const updatedPayment = await projectApiRoot
      .payments()
      .withId({ ID: webhook.custom.inputval1 })
      .post({
        body: {
          version,
          actions: [
            {
              action: "setTransactionCustomField",
              transactionId: txId,
              name: "transactionComments",
              value: updatedTransactionComments,
            },
          ],
        },
      })
      .execute();
    await this.syncPaymentToOrder(
      webhook?.custom.inputval1,
      webhook?.custom.inputval2,
    );
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
          throw new Error(`Missing parameter ${param} in ${category}`);
        }
      }
    }
  }

  public async validateIpAddress(req: FastifyRequest): Promise<void> {
    const novalnetHost = "pay-nn.de";
    const { address: novalnetHostIP } = await dns.lookup(novalnetHost);

    if (!novalnetHostIP) {
      throw new Error("Novalnet HOST IP missing");
    }

    const requestReceivedIP = await this.getRemoteAddress(req, novalnetHostIP);
    const webhookTestMode = String(getConfig()?.novalnetWebhookTestMode);
    if (novalnetHostIP !== requestReceivedIP && webhookTestMode == "0") {
      throw new Error(`Unauthorized access from the IP ${requestReceivedIP}`);
    }
  }

  public async getRemoteAddress(
    req: FastifyRequest,
    novalnetHostIP: string,
  ): Promise<string> {
    const headers = req.headers;

    const ipKeys = [
      "HTTP_X_FORWARDED_HOST",
      "HTTP_X_FORWARDED_FOR",
      "HTTP_X_REAL_IP",
      "HTTP_CLIENT_IP",
      "HTTP_X_FORWARDED",
      "HTTP_X_CLUSTER_CLIENT_IP",
      "HTTP_FORWARDED_FOR",
      "HTTP_FORWARDED",
      "REMOTE_ADDR",
    ];

    for (const key of ipKeys) {
      const value = headers[key] as string | undefined;

      if (value) {
        if (key === "HTTP_X_FORWARDED_FOR" || key === "HTTP_X_FORWARDED_HOST") {
          const forwardedIPs = value.split(",").map((ip) => ip.trim());
          return forwardedIPs.includes(novalnetHostIP)
            ? novalnetHostIP
            : forwardedIPs[0];
        }
        return value;
      }
    }
    return req.ip;
  }

  public validateChecksum(payload: any) {
    const accessKey = String(getConfig()?.novalnetPublicKey ?? "");
    if (!accessKey) {
      log.warn("NOVALNET_ACCESS_KEY not configured");
      return;
    }

    let token = payload.event.tid + payload.event.type + payload.result.status;
    if (payload.transaction?.amount) {
      token += payload.transaction.amount;
    }

    if (payload.transaction?.currency) {
      token += payload.transaction.currency;
    }

    token += accessKey.split("").reverse().join("");
    const generatedChecksum = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    if (generatedChecksum !== payload.event.checksum) {
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

  public async updatePaymentStatusByPaymentId(
    paymentId: string,
    transactionId: string,
    newState: "Initial" | "Pending" | "Success" | "Failure" | "Paid",
  ) {
    const paymentRes = await projectApiRoot
      .payments()
      .withId({ ID: paymentId })
      .get()
      .execute();

    const payment = paymentRes.body;

    const updatedPayment = await projectApiRoot
      .payments()
      .withId({ ID: paymentId })
      .post({
        body: {
          version: payment.version,
          actions: [
            {
              action: "changeTransactionState",
              transactionId,
              state: newState,
            },
          ],
        },
      })
      .execute();

    return updatedPayment.body;
  }

  public async getTransactionComment(paymentId: string, pspReference: string) {
    const response = await projectApiRoot
      .payments()
      .withId({ ID: paymentId })
      .get()
      .execute();
    const payment = response.body;
    const tx = payment.transactions?.find(
      (t: any) =>
        t.interactionId === pspReference ||
        String(t.interactionId) === String(pspReference),
    );

    if (!tx) throw new Error("Transaction not found");
    const comment = tx.custom?.fields?.transactionComments ?? null;

    return comment;
  }

  public getFormattedDateTime(): { date: string; time: string } {
    const now = new Date();
    return {
      date: now.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      time: now.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),
    };
  }

  public async createRedirectPayment(
    request: CreatePaymentRequest,
  ): Promise<PaymentResponseSchemaDTO> {
    const type = String(request.data?.paymentMethod?.type);
    const lang = String(request.data?.lang);
    const path = String(request.data?.path);
    const config = getConfig();
    await createTransactionCommentsType();
    const { testMode, paymentAction } = getNovalnetConfigValues(type, config);
    const cartId = getCartIdFromContext();
    const ctCart = await this.ctCartService.getCart({
      id: cartId,
    });

    const deliveryAddress = await this.ctcc(ctCart);
    const billingAddress = await this.ctbb(ctCart);
    const parsedCart = typeof ctCart === "string" ? JSON.parse(ctCart) : ctCart;
    const processorURL = Context.getProcessorUrlFromContext();
    const sessionId = Context.getCtSessionIdFromContext();
    const paymentAmount = await this.ctCartService.getPaymentAmount({
      cart: ctCart,
    });

    const deliveryStreet = this.splitStreetByComma(deliveryAddress?.streetName);
    const billingStreet = this.splitStreetByComma(billingAddress?.streetName);

    const deliveryAddressStreetName = deliveryStreet.streetName;
    const deliveryAddressStreetNumber = deliveryStreet.streetNumber;

    const billingAddressStreetName = billingStreet.streetName;
    const billingAddressStreetNumber = billingStreet.streetNumber;

    const paymentInterface = getPaymentInterfaceFromContext() || "mock";
    const ctPayment = await this.ctPaymentService.createPayment({
      amountPlanned: paymentAmount,
      paymentMethodInfo: {
        paymentInterface,
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

    const transactionComments = `Novalnet Transaction ID: ${"N/A"}\nPayment Type: ${"N/A"}\nStatus: ${"N/A"}`;
    const pspReference = randomUUID().toString();

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference,
      paymentMethod: request.data.paymentMethod.type,
      transaction: {
        type: "Authorization",
        amount: ctPayment.amountPlanned,
        interactionId: pspReference,
        state: "Pending",
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

    const paymentRef = (updatedPayment as any)?.id ?? ctPayment.id;
    const orderNumber = getFutureOrderNumberFromContext() ?? "";
    const ctPaymentId = ctPayment.id;
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

    const url = new URL("/success", processorURL);
    url.searchParams.append("paymentReference", paymentRef);
    url.searchParams.append("ctsid", sessionId);
    url.searchParams.append("orderNumber", orderNumber);
    url.searchParams.append("ctPaymentID", ctPaymentId);
    url.searchParams.append("pspReference", pspReference);
    url.searchParams.append("lang", lang);
    url.searchParams.append("path", path);
    const returnUrl = url.toString();

    const urlFailure = new URL("/failure", processorURL);
    urlFailure.searchParams.append("paymentReference", paymentRef);
    urlFailure.searchParams.append("ctsid", sessionId);
    urlFailure.searchParams.append("orderNumber", orderNumber);
    urlFailure.searchParams.append("ctPaymentID", ctPaymentId);
    urlFailure.searchParams.append("pspReference", pspReference);
    urlFailure.searchParams.append("lang", lang);
    urlFailure.searchParams.append("path", path);
    const errorReturnUrl = urlFailure.toString();

    const novalnetPayload = {
      merchant: {
        signature: String(getConfig()?.novalnetPrivateKey ?? ""),
        tariff: String(getConfig()?.novalnetTariff ?? ""),
      },
      customer: {
        billing: {
          city: String(billingAddress?.city),
          country_code: String(billingAddress?.country),
          house_no: String(billingAddressStreetNumber),
          street: String(billingAddressStreetName),
          zip: String(billingAddress?.postalCode),
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
      },
      transaction: {
        test_mode: Number(testMode) === 0 ? "0" : "1",
        payment_type: type.toUpperCase(),
        amount: String(parsedCart?.taxedPrice?.totalGross?.centAmount),
        currency: String(parsedCart?.taxedPrice?.totalGross?.currencyCode),
        return_url: returnUrl,
        error_return_url: errorReturnUrl,
        order_no: orderNumber,
      },
      custom: {
        input1: "ctpayment-id",
        inputval1: String(ctPaymentId ?? "ctpayment-id not available"),
        input2: "pspReference",
        inputval2: String(pspReference ?? "0"),
        input3: "lang",
        inputval3: String(lang ?? "lang-no-longer-available"),
      },
    };
    let parsedResponse: any = {};
    try {
      const accessKey = String(getConfig()?.novalnetPublicKey ?? "");
      const base64Key = btoa(accessKey);
      const novalnetResponse = await fetch(
        "https://payport.novalnet.de/v2/payment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-NN-Access-Key": base64Key,
          },
          body: JSON.stringify(novalnetPayload),
        },
      );
      if (!novalnetResponse.ok) {
        throw new Error(`Novalnet API error: ${novalnetResponse.status}`);
      }
      parsedResponse = await novalnetResponse.json();
    } catch (err) {
      log.error("Failed to process payment with Novalnet:", err);
      throw new Error("Payment initialization failed");
    }

    // Check for Novalnet API errors
    if (parsedResponse?.result?.status !== "SUCCESS") {
      log.error("Novalnet API error - Status not SUCCESS:", {
        status: parsedResponse?.result?.status,
        statusText: parsedResponse?.result?.status_text,
        fullResponse: parsedResponse,
      });
      throw new Error(
        parsedResponse?.result?.status_text || "Payment initialization failed",
      );
    }
    const redirectResult = parsedResponse?.result?.redirect_url;
    const txnSecret = parsedResponse?.transaction?.txn_secret;
    if (!txnSecret) {
      log.error("No txn_secret in Novalnet response:", {
        transaction: parsedResponse?.transaction,
        fullResponse: parsedResponse,
      });
      throw new Error(
        "Payment initialization failed - missing transaction secret",
      );
    }
    return {
      paymentReference: paymentRef,
      txnSecret: redirectResult,
    };
  }

  public async localcomments(hook: any, params: TransactionCommentParams) {
    const supportedLocales: SupportedLocale[] = ["en", "de"];
    const normalized: Record<string, string> = {
      eventTID: params.eventTID ?? "-",
      parentTID: params.parentTID ?? "-",
      amount:
        params.amount !== null && params.amount !== undefined
          ? String(params.amount)
          : "-",
      currency: params.currency ?? "-",
      date: params.date ?? "-",
      time: params.time ?? "-",
      transactionID: params.transactionID ?? "-",
      dueDate: params.dueDate ?? "-",
    };

    const localizedTransactionComments = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = t(locale, hook, normalized);
        return acc;
      },
      {} as Record<SupportedLocale, string>,
    );

    return localizedTransactionComments;
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
