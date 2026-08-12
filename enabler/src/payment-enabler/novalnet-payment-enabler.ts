import { InvoiceBuilder } from "../components/payment-methods/invoice/invoice";
import { PrepaymentBuilder } from "../components/payment-methods/prepayment/prepayment";
import { GuaranteedInvoiceBuilder } from "../components/payment-methods/GuaranteedInvoice/GuaranteedInvoice";
import { GuaranteedSepaBuilder } from "../components/payment-methods/GuaranteedSepa/GuaranteedSepa";
import { IdealBuilder } from "../components/payment-methods/ideal/ideal";
import { PaypalBuilder } from "../components/payment-methods/paypal/paypal";
import { OnlinebanktransferBuilder } from "../components/payment-methods/onlinebanktransfer/onlinebanktransfer";
import { AlipayBuilder } from "../components/payment-methods/alipay/alipay";
import { BancontactBuilder } from "../components/payment-methods/bancontact/bancontact";
import { BlikBuilder } from "../components/payment-methods/blik/blik";
import { EpsBuilder } from "../components/payment-methods/eps/eps";
import { MbwayBuilder } from "../components/payment-methods/mbway/mbway";
import { MultibancoBuilder } from "../components/payment-methods/multibanco/multibanco";
import { PostfinanceBuilder } from "../components/payment-methods/postfinance/postfinance";
import { PostfinancecardBuilder } from "../components/payment-methods/postfinancecard/postfinancecard";
import { Przelewy24Builder } from "../components/payment-methods/przelewy24/przelewy24";
import { TrustlyBuilder } from "../components/payment-methods/trustly/trustly";
import { TwintBuilder } from "../components/payment-methods/twint/twint";
import { WechatpayBuilder } from "../components/payment-methods/wechatpay/wechatpay";
import { SepaBuilder } from "../components/payment-methods/sepa/sepa";
import { AchBuilder } from "../components/payment-methods/ach/ach";
import { CreditcardBuilder } from "../components/payment-methods/creditcard/creditcard";
import { FakeSdk } from "../fake-sdk";
import {
  EnablerOptions,
  PaymentComponentBuilder,
  PaymentEnabler,
  PaymentResult,
} from "./payment-enabler";

declare global {
  interface ImportMeta {
    env: any;
  }
}

export type BaseOptions = {
  sdk: FakeSdk;
  processorUrl: string;
  sessionId: string;
  environment: string;
  locale?: string;
  onComplete: (result: PaymentResult) => void;
  onError: (error: any, context?: { paymentReference?: string }) => void;
};

export class NovalnetPaymentEnabler implements PaymentEnabler {
  setupData: Promise<{ baseOptions: BaseOptions }>;

  constructor(options: EnablerOptions) {
    this.setupData = NovalnetPaymentEnabler._Setup(options);
  }

  private static _Setup = async (
    options: EnablerOptions
  ): Promise<{ baseOptions: BaseOptions }> => {
    // Fetch SDK config from processor if needed, for example:

    // const configResponse = await fetch(instance.processorUrl + '/config', {
    //   method: 'GET',
    //   headers: { 'Content-Type': 'application/json', 'X-Session-Id': options.sessionId },
    // });

    // const configJson = await configResponse.json();

    const sdkOptions = {
      // environment: configJson.environment,
      environment: "test",
    };

    return Promise.resolve({
      baseOptions: {
        sdk: new FakeSdk(sdkOptions),
        processorUrl: options.processorUrl,
        sessionId: options.sessionId,
        environment: sdkOptions.environment,
        onComplete: options.onComplete || (() => {}),
        onError: options.onError || (() => {}),
      },
    });
  };

  async createComponentBuilder(
    type: string
  ): Promise<PaymentComponentBuilder | never> {
  
    const { baseOptions } = await this.setupData;
  
    // Normalize incoming payment type
    const normalizedType = type
      ?.trim()
      .toLowerCase();
  
    // Convert Merchant Center label to internal type
    let paymentType = normalizedType;
  
    if (normalizedType.includes('ideal')) {
      paymentType = 'ideal';
    }
  
    if (normalizedType.includes('direct debit sepa') || normalizedType.includes('sepa') || normalizedType.includes('Direct Debit SEPA')) {
      paymentType = 'sepa';
    }

    if (normalizedType.includes('direct debit ach') || normalizedType.includes('ach') || normalizedType.includes('Direct Debit ACH')) {
      paymentType = 'ach';
    }

    if (normalizedType.includes('online bank transfer') || normalizedType.includes('onlinebanktransfer') || normalizedType.includes('Online bank transfer')) {
      paymentType = 'onlinebanktransfer';
    }

    if (normalizedType.includes('credit/debit cards') || normalizedType.includes('creditcard') || normalizedType.includes('Credit/Debit Cards')) {
      paymentType = 'creditcard';
    }

    if (normalizedType.includes('mb way') || normalizedType.includes('mbway') || normalizedType.includes('MB Way')) {
      paymentType = 'mbway';
    }

    if (normalizedType.includes('invoice with payment guarantee') || normalizedType.includes('GuaranteedInvoice') || normalizedType.includes('Invoice with payment guarantee')) {
      paymentType = 'GuaranteedInvoice';
    }

    if (normalizedType.includes('direct debit sepa with payment guarantee') || normalizedType.includes('GuaranteedSepa') || normalizedType.includes('Direct Debit SEPA with payment guarantee')) {
      paymentType = 'GuaranteedSepa';
    }

    if (normalizedType.includes('postFinance card') || normalizedType.includes('postfinancecard') || normalizedType.includes('PostFinance Card')) {
      paymentType = 'postfinancecard';
    }

    if (normalizedType.includes('postFinance e-finance') || normalizedType.includes('postfinance') || normalizedType.includes('PostFinance E-Finance')) {
      paymentType = 'postfinance';
    }

    const supportedMethods = {
      invoice: InvoiceBuilder,
      prepayment: PrepaymentBuilder,
      guaranteedinvoice: GuaranteedInvoiceBuilder,
      guaranteedsepa: GuaranteedSepaBuilder,
      ideal: IdealBuilder,
      paypal: PaypalBuilder,
      onlinebanktransfer: OnlinebanktransferBuilder,
      alipay: AlipayBuilder,
      bancontact: BancontactBuilder,
      blik: BlikBuilder,
      eps: EpsBuilder,
      mbway: MbwayBuilder,
      multibanco: MultibancoBuilder,
      postfinance: PostfinanceBuilder,
      postfinancecard: PostfinancecardBuilder,
      przelewy24: Przelewy24Builder,
      trustly: TrustlyBuilder,
      twint: TwintBuilder,
      wechatpay: WechatpayBuilder,
      sepa: SepaBuilder,
      ach: AchBuilder,
      creditcard: CreditcardBuilder,
    };
  
    const Builder = supportedMethods[paymentType];
  
    if (!Builder) {
      throw new Error(`Unsupported payment type: ${type}`);
    }
  
    return new Builder(baseOptions);
  }

}
