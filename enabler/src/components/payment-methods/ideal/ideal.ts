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

export class IdealBuilder implements PaymentComponentBuilder {

  public componentHasSubmit = true;

  constructor(private baseOptions: BaseOptions) {}

  build(config: ComponentOptions): PaymentComponent {

    return new Ideal(this.baseOptions, config);
  }
}

export class Ideal extends BaseComponent {

  private showPayButton: boolean;

  constructor(
    baseOptions: BaseOptions,
    componentOptions: ComponentOptions
  ) {

    // Keep internal type safe
    super(PaymentMethod.ideal, baseOptions, componentOptions);

    this.showPayButton =
      componentOptions?.showPayButton ?? false;
  }

  mount(selector: string) {

    // Fix invalid selector issue
    const safeSelector = selector.replace(/\|/g, '\\|');

    const container = document.querySelector(safeSelector);

    if (!container) {

      console.error(
        'Container not found:',
        safeSelector
      );

      return;
    }

    container.insertAdjacentHTML(
      "afterbegin",
      this._getTemplate()
    );

    // Update storefront payment label
    setTimeout(() => {
      const labels = document.querySelectorAll('label');
      labels.forEach((label) => {
        const text = label.textContent?.trim().toLowerCase();
        if (text?.includes('ideal')) {
          label.textContent = 'iDEAL | Wero';
        }
      });
    }, 300);

    if (this.showPayButton) {
      const button = document.querySelector("#purchaseOrderForm-paymentButton");
      if (button) {
        button.addEventListener("click", (e) => {
            e.preventDefault();
            this.submit();
          }
        );
      }
    }
  }

  async submit() {

    this.sdk.init({
      environment: this.environment
    });

    const pathLocale =
      window.location.pathname.split("/")[1];

    const url = new URL(window.location.href);

    const baseSiteUrl = url.origin;

    try {

      const requestData:
        PaymentRequestSchemaDTO = {

        paymentMethod: {
          type: 'IDEAL',
        },

        paymentOutcome:
          PaymentOutcome.AUTHORIZED,

        lang: pathLocale ?? 'de',

        path: baseSiteUrl,
      };

      const response = await fetch(
        this.processorUrl + "/redirectPayment",
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "X-Session-Id":
              this.sessionId,
          },

          body: JSON.stringify(
            requestData
          ),
        }
      );

      if (!response.ok) {

        const errorText =
          await response.text();

        console.error(
          'HTTP error response:',
          errorText
        );

        throw new Error(
          `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();

      window.location.href =
        data.txnSecret;

    } catch (e) {

      console.error(
        'Error details:',
        {
          message: e.message,
          stack: e.stack,
          name: e.name
        }
      );

      this.onError(
        "Some error occurred. Please try again."
      );
    }
  }

  private _getTemplate() {

    return this.showPayButton
      ? `
    <div class="${styles.wrapper}">

      <p>
        Pay easily with iDEAL | Wero and transfer the shopping amount within the specified date.
      </p>

      <button
        class="${buttonStyles.button}
        ${buttonStyles.fullWidth}
        ${styles.submitButton}"

        id="purchaseOrderForm-paymentButton"
      >
        Pay Now
      </button>

    </div>
    `
      : "";
  }
}