import {
  ComponentOptions,
  PaymentComponent,
  PaymentComponentBuilder,
  PaymentMethod
} from '../../../payment-enabler/payment-enabler';
import { BaseComponent } from "../../base";
import styles from '../../../style/style.module.scss';
import buttonStyles from "../../../style/button.module.scss";
import {
  PaymentOutcome,
  PaymentRequestSchemaDTO,
} from "../../../dtos/novalnet-payment.dto";
import { BaseOptions } from "../../../payment-enabler/novalnet-payment-enabler";
import { checkoutFlow } from '@commercetools/checkout-browser-sdk';

export class TrustlyBuilder implements PaymentComponentBuilder {
  public componentHasSubmit = true;
  constructor(private baseOptions: BaseOptions) {}

  build(config: ComponentOptions): PaymentComponent {
    return new Trustly(this.baseOptions, config);
  }
}
 
export class Trustly extends BaseComponent {
  private showPayButton: boolean;

  constructor(baseOptions: BaseOptions, componentOptions: ComponentOptions) {
    super(PaymentMethod.trustly, baseOptions, componentOptions);
    this.showPayButton = componentOptions?.showPayButton ?? false;
  }

  mount(selector: string) {
    document
      .querySelector(selector)
      .insertAdjacentHTML("afterbegin", this._getTemplate());

    if (this.showPayButton) {
      document
        .querySelector("#purchaseOrderForm-paymentButton")
        .addEventListener("click", (e) => {
          e.preventDefault();
          this.submit();
        });
    }
  }

  async submit() {
    this.sdk.init({ environment: this.environment });
    const pathLocale = window.location.pathname.split("/")[1];
    const url = new URL(window.location.href);
    const baseSiteUrl = url.origin;

    try {
      const requestData: PaymentRequestSchemaDTO = {
        paymentMethod: {
          type: 'TRUSTLY',
        },
        paymentOutcome: PaymentOutcome.AUTHORIZED,
        lang: pathLocale ?? 'de',
        path: baseSiteUrl,
      };
      const response = await fetch(this.processorUrl + "/redirectPayment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.sessionId,
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      window.location.href = data.txnSecret;

    } catch (e) {
      console.error('Error details:', {
        message: e.message,
        stack: e.stack,
        name: e.name
      });
      this.onError("Some error occurred. Please try again.");
    }
  }



  private _getTemplate() {
    return this.showPayButton
      ? `
    <div class="${styles.wrapper}">
      <p>Pay easily with Trustly and transfer the shopping amount within the specified date.</p>
      <button class="${buttonStyles.button} ${buttonStyles.fullWidth} ${styles.submitButton}" id="purchaseOrderForm-paymentButton">Pay Now</button>
    </div>
    `
      : "";
  }
}
