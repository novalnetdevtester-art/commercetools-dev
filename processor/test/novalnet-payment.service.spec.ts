import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import {
  ConfigResponse,
  ModifyPayment,
  StatusResponse,
} from "../src/services/types/operation.type";
import { paymentSDK } from "../src/payment-sdk";
import { DefaultPaymentService } from "@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment.service";
import { DefaultCartService } from "@commercetools/connect-payments-sdk/dist/commercetools/services/ct-cart.service";
import {
  mockGetPaymentResult,
  mockGetPaymentResultWithoutTransactions,
  mockUpdatePaymentResult,
  mockUpdatePaymentResultWithRefundTransaction,
} from "./utils/novalnet-payment-results";
import { mockGetCartResult } from "./utils/mock-cart-data";
import * as Config from "../src/config/config";
import {
  CreatePaymentRequest,
  NovalnetPaymentServiceOptions,
} from "../src/services/types/novalnet-payment.type";
import { AbstractPaymentService } from "../src/services/abstract-payment.service";
import { NovalnetPaymentService } from "../src/services/novalnet-payment.service";
import * as FastifyContext from "../src/libs/fastify/context/context";
import * as StatusHandler from "@commercetools/connect-payments-sdk/dist/api/handlers/status.handler";

import { HealthCheckResult } from "@commercetools/connect-payments-sdk";
import {
  PaymentMethodType,
  PaymentOutcome,
} from "../src/dtos/novalnet-payment.dto";
import { TransactionDraftDTO } from "../src/dtos/operations/transaction.dto";
interface FlexibleConfig {
  [key: string]: string; // Adjust the type according to your config values
}

function setupMockConfig(keysAndValues: Record<string, string>) {
  const mockConfig: FlexibleConfig = {};
  Object.keys(keysAndValues).forEach((key) => {
    mockConfig[key] = keysAndValues[key];
  });

  jest.spyOn(Config, "getConfig").mockReturnValue(mockConfig as any);
}

describe("novalnet-payment.service", () => {
  const opts: NovalnetPaymentServiceOptions = {
    ctCartService: paymentSDK.ctCartService,
    ctPaymentService: paymentSDK.ctPaymentService,
  };
  const paymentService: AbstractPaymentService = new NovalnetPaymentService(
    opts,
  );

  const novalnetPaymentService = paymentService as NovalnetPaymentService;
  beforeEach(() => {
    jest.setTimeout(10000);
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("getConfig", async () => {
    // Setup mock config for a system using `clientKey`
    setupMockConfig({ mockClientKey: "", mockEnvironment: "test" });

    const result: ConfigResponse = await paymentService.config();

    // Assertions can remain the same or be adapted based on the abstracted access
    expect(result?.clientKey).toStrictEqual("");
    expect(result?.environment).toStrictEqual("test");
  });

  test("getSupportedPaymentComponents", async () => {
    const result: ConfigResponse =
      await paymentService.getSupportedPaymentComponents();
    expect(result?.components).toHaveLength(22);
    expect(result?.components[1]?.type).toStrictEqual("Invoice");
    expect(result?.components[2]?.type).toStrictEqual("Prepayment");
    expect(result?.components[2]?.type).toStrictEqual(
      "Invoice with payment guarantee",
    );
    expect(result?.components[2]?.type).toStrictEqual(
      "Direct Debit SEPA with payment guarantee",
    );
    expect(result?.components[3]?.type).toStrictEqual("ideal | Wero");
    expect(result?.components[4]?.type).toStrictEqual("PayPal");
    expect(result?.components[5]?.type).toStrictEqual("Online bank transfer");
    expect(result?.components[6]?.type).toStrictEqual("Alipay");
    expect(result?.components[7]?.type).toStrictEqual("Bancontact");
    expect(result?.components[8]?.type).toStrictEqual("Blik");
    expect(result?.components[9]?.type).toStrictEqual("eps");
    expect(result?.components[10]?.type).toStrictEqual("MB Way");
    expect(result?.components[11]?.type).toStrictEqual("Multibanco");
    expect(result?.components[13]?.type).toStrictEqual("PostFinance E-Finance");
    expect(result?.components[14]?.type).toStrictEqual("PostFinance Card");
    expect(result?.components[15]?.type).toStrictEqual("Przelewy24");
    expect(result?.components[16]?.type).toStrictEqual("Trustly");
    expect(result?.components[17]?.type).toStrictEqual("TWINT");
    expect(result?.components[18]?.type).toStrictEqual("wechatpay");
    expect(result?.components[19]?.type).toStrictEqual("Direct Debit SEPA");
    expect(result?.components[20]?.type).toStrictEqual("Direct Debit ACH");
    expect(result?.components[21]?.type).toStrictEqual("Credit/Debit Cards");
    expect(result?.dropins).toHaveLength(0);
  });

  test("getStatus", async () => {
    const mockHealthCheckFunction: () => Promise<HealthCheckResult> =
      async () => {
        const result: HealthCheckResult = {
          name: "CoCo Permissions",
          status: "DOWN",
          message: "CoCo Permissions are not available",
          details: {},
        };
        return result;
      };

    jest
      .spyOn(StatusHandler, "healthCheckCommercetoolsPermissions")
      .mockReturnValue(mockHealthCheckFunction);
    const paymentService: AbstractPaymentService = new NovalnetPaymentService(
      opts,
    );
    const result: StatusResponse = await paymentService.status();

    expect(result?.status).toBeDefined();
    expect(result?.checks).toHaveLength(2);
    expect(result?.status).toStrictEqual("Partially Available");
    expect(result?.checks[0]?.name).toStrictEqual("CoCo Permissions");
    expect(result?.checks[0]?.status).toStrictEqual("DOWN");
    expect(result?.checks[0]?.details).toStrictEqual({});
    expect(result?.checks[0]?.message).toBeDefined();
    expect(result?.checks[1]?.name).toStrictEqual("Mock Payment API");
    expect(result?.checks[1]?.status).toStrictEqual("UP");
    expect(result?.checks[1]?.details).toBeDefined();
    expect(result?.checks[1]?.message).toBeDefined();
  });

  test("cancelPayment", async () => {
    const modifyPaymentOpts: ModifyPayment = {
      paymentId: "dummy-paymentId",
      data: {
        actions: [
          {
            action: "cancelPayment",
          },
        ],
      },
    };
    jest
      .spyOn(DefaultPaymentService.prototype, "getPayment")
      .mockReturnValue(Promise.resolve(mockGetPaymentResult));
    jest
      .spyOn(DefaultPaymentService.prototype, "updatePayment")
      .mockReturnValue(Promise.resolve(mockUpdatePaymentResult));

    const result = await paymentService.modifyPayment(modifyPaymentOpts);
    expect(result?.outcome).toStrictEqual("approved");
  });

  test("create card payment", async () => {
    const createPaymentOpts: CreatePaymentRequest = {
      data: {
        paymentMethod: {
          type: PaymentMethodType.IDEAL,
        },
        paymentOutcome: PaymentOutcome.AUTHORIZED,
      },
    };
    jest
      .spyOn(DefaultCartService.prototype, "getCart")
      .mockReturnValue(Promise.resolve(mockGetCartResult()));
    jest
      .spyOn(DefaultPaymentService.prototype, "createPayment")
      .mockReturnValue(Promise.resolve(mockGetPaymentResult));
    jest
      .spyOn(DefaultCartService.prototype, "addPayment")
      .mockReturnValue(Promise.resolve(mockGetCartResult()));
    jest
      .spyOn(FastifyContext, "getProcessorUrlFromContext")
      .mockReturnValue("http://127.0.0.1");
    jest
      .spyOn(DefaultPaymentService.prototype, "updatePayment")
      .mockReturnValue(Promise.resolve(mockGetPaymentResult));

    const result =
      await novalnetPaymentService.createDirectPayment(createPaymentOpts);
    expect(result?.paymentReference).toStrictEqual("123456");
  });

  test("create invoice payment", async () => {
    const createPaymentOpts: CreatePaymentRequest = {
      data: {
        paymentMethod: {
          type: PaymentMethodType.INVOICE,
        },
        paymentOutcome: PaymentOutcome.AUTHORIZED,
      },
    };
    jest
      .spyOn(DefaultCartService.prototype, "getCart")
      .mockReturnValue(Promise.resolve(mockGetCartResult()));
    jest
      .spyOn(DefaultPaymentService.prototype, "createPayment")
      .mockReturnValue(Promise.resolve(mockGetPaymentResult));
    jest
      .spyOn(DefaultCartService.prototype, "addPayment")
      .mockReturnValue(Promise.resolve(mockGetCartResult()));
    jest
      .spyOn(FastifyContext, "getProcessorUrlFromContext")
      .mockReturnValue("http://127.0.0.1");
    jest
      .spyOn(DefaultPaymentService.prototype, "updatePayment")
      .mockReturnValue(Promise.resolve(mockGetPaymentResult));

    const result =
      await novalnetPaymentService.createDirectPayment(createPaymentOpts);
    expect(result?.paymentReference).toStrictEqual("123456");
  });

  test("create prepayment payment successfully", async () => {
    const createPaymentOpts: CreatePaymentRequest = {
      data: {
        paymentMethod: {
          type: PaymentMethodType.PREPAYMENT,
          accHolder: "This is a test feild",
          accountNumber: "123456",
          routingNumber: "This is a test invoice",
        },
        paymentOutcome: PaymentOutcome.AUTHORIZED,
      },
    };
    jest
      .spyOn(DefaultCartService.prototype, "getCart")
      .mockReturnValue(Promise.resolve(mockGetCartResult()));
    jest
      .spyOn(DefaultPaymentService.prototype, "createPayment")
      .mockReturnValue(Promise.resolve(mockGetPaymentResult));
    jest
      .spyOn(DefaultCartService.prototype, "addPayment")
      .mockReturnValue(Promise.resolve(mockGetCartResult()));
    jest
      .spyOn(FastifyContext, "getProcessorUrlFromContext")
      .mockReturnValue("http://127.0.0.1");
    jest
      .spyOn(DefaultPaymentService.prototype, "updatePayment")
      .mockReturnValue(Promise.resolve(mockGetPaymentResult));

    const result =
      await novalnetPaymentService.createDirectPayment(createPaymentOpts);
    expect(result?.paymentReference).toStrictEqual("123456");
  });

  describe("handleTransaction", () => {
    test("should create the payment in CoCo and return it with a success state", async () => {
      const createPaymentOpts: TransactionDraftDTO = {
        cartId: "dd4b7669-698c-4175-8e4c-bed178abfed3",
        paymentInterface: "42251cfc-0660-4ab3-80f6-c32829aa7a8b",
        amount: {
          centAmount: 1000,
          currencyCode: "EUR",
        },
      };

      jest
        .spyOn(DefaultCartService.prototype, "getCart")
        .mockReturnValueOnce(Promise.resolve(mockGetCartResult()));
      jest
        .spyOn(DefaultPaymentService.prototype, "createPayment")
        .mockReturnValueOnce(Promise.resolve(mockGetPaymentResult));
      jest
        .spyOn(DefaultCartService.prototype, "addPayment")
        .mockReturnValueOnce(Promise.resolve(mockGetCartResult()));
      jest
        .spyOn(DefaultPaymentService.prototype, "updatePayment")
        .mockReturnValue(Promise.resolve(mockUpdatePaymentResult));
    });

    test("should create the payment in CoCo and return it with a failed state", async () => {
      const createPaymentOpts: TransactionDraftDTO = {
        cartId: "dd4b7669-698c-4175-8e4c-bed178abfed3",
        paymentInterface: "42251cfc-0660-4ab3-80f6-c32829aa7a8b",
        amount: {
          centAmount: 10000,
          currencyCode: "EUR",
        },
      };

      jest
        .spyOn(DefaultCartService.prototype, "getCart")
        .mockReturnValueOnce(Promise.resolve(mockGetCartResult()));
      jest
        .spyOn(DefaultPaymentService.prototype, "createPayment")
        .mockReturnValueOnce(Promise.resolve(mockGetPaymentResult));
      jest
        .spyOn(DefaultCartService.prototype, "addPayment")
        .mockReturnValueOnce(Promise.resolve(mockGetCartResult()));
      jest
        .spyOn(DefaultPaymentService.prototype, "updatePayment")
        .mockReturnValue(Promise.resolve(mockUpdatePaymentResult));
    });
  });

  describe("reversePayment", () => {
    test("it should fail because there are no transactions to revert", async () => {
      const modifyPaymentOpts: ModifyPayment = {
        paymentId: "dummy-paymentId",
        data: {
          actions: [
            {
              action: "reversePayment",
            },
          ],
        },
      };
      jest
        .spyOn(DefaultPaymentService.prototype, "getPayment")
        .mockReturnValue(
          Promise.resolve(mockGetPaymentResultWithoutTransactions),
        );
      jest
        .spyOn(DefaultPaymentService.prototype, "updatePayment")
        .mockReturnValue(Promise.resolve(mockUpdatePaymentResult));
      jest
        .spyOn(DefaultPaymentService.prototype, "updatePayment")
        .mockReturnValue(Promise.resolve(mockUpdatePaymentResult));

      const result = paymentService.modifyPayment(modifyPaymentOpts);
      await expect(result).rejects.toThrow(
        "There is no successful payment transaction to reverse.",
      );
    });

    test("it should successfully revert transaction", async () => {
      const modifyPaymentOpts: ModifyPayment = {
        paymentId: "dummy-paymentId",
        data: {
          actions: [
            {
              action: "reversePayment",
            },
          ],
        },
      };
      jest
        .spyOn(DefaultPaymentService.prototype, "getPayment")
        .mockReturnValue(Promise.resolve(mockGetPaymentResult));
      jest
        .spyOn(DefaultPaymentService.prototype, "updatePayment")
        .mockReturnValue(
          Promise.resolve(mockUpdatePaymentResultWithRefundTransaction),
        );

      const result = await paymentService.modifyPayment(modifyPaymentOpts);
      expect(result?.outcome).toStrictEqual("approved");
    });
  });
});
