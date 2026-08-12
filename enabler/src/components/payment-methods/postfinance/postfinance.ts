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

export class PostfinanceBuilder
  implements PaymentComponentBuilder {

  public componentHasSubmit = true;

  constructor(
    private baseOptions: BaseOptions
  ) {}

  build(
    config: ComponentOptions
  ): PaymentComponent {

    return new Postfinance(
      this.baseOptions,
      config
    );
  }
}

export class Postfinance extends BaseComponent {

  private showPayButton: boolean;

  constructor(
    baseOptions: BaseOptions,
    componentOptions: ComponentOptions
  ) {

    super(
      PaymentMethod.postfinance,
      baseOptions,
      componentOptions
    );

    this.showPayButton =
      componentOptions?.showPayButton ?? false;
  }

  mount(selector: string) {

    /**
     * Fix commercetools selector issue
     */
    const safeSelector =
      '#' + CSS.escape(
        selector.substring(1)
      );

    const container =
      document.querySelector(
        safeSelector
      );

    if (!container) {

      console.error(
        'Container not found:',
        safeSelector
      );

      return;
    }

    /**
     * Same behavior as iDEAL
     * Prevent radio button removal
     */
    container.insertAdjacentHTML(
      "afterbegin",
      this._getTemplate()
    );

    /**
     * Update only current payment label
     */
    setTimeout(() => {

      const paymentLabel =
        container.querySelector(
          'label'
        );

      if (
        paymentLabel &&
        paymentLabel.textContent
          ?.toLowerCase()
          .includes('postfinance')
      ) {

        paymentLabel.textContent =
          'PostFinance E-Finance';
      }

    }, 100);

    /**
     * Bind button event
     */
    if (this.showPayButton) {

      const button =
        document.querySelector(
          "#purchaseOrderForm-paymentButton"
        );

      if (button) {

        button.addEventListener(
          "click",
          (e) => {

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

    const url =
      new URL(window.location.href);

    const baseSiteUrl =
      url.origin;

    try {

      const requestData:
        PaymentRequestSchemaDTO = {

        paymentMethod: {
          type: "POSTFINANCE_EFINANCE",
        },

        paymentOutcome:
          PaymentOutcome.AUTHORIZED,

        lang:
          pathLocale ?? 'de',

        path:
          baseSiteUrl,
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

      const data =
        await response.json();

      window.location.href =
        data.txnSecret;

    } catch (e) {

      console.error(
        'PostFinance E-Finance payment error:',
        e
      );

      this.onError(
        "Some error occurred. Please try again."
      );
    }
  }

  private _getTemplate() {

    const locale =
      document.documentElement.lang || "en";

    const description =
      locale.startsWith("de")
        ? "Bezahlen Sie bequem mit PostFinance E-Finance."
        : "Pay easily with PostFinance E-Finance.";

    return this.showPayButton
      ? `
      <div class="${styles.wrapper}">

        <p>
          ${description}
        </p>

        <button
          class="${buttonStyles.button}
          ${buttonStyles.fullWidth}
          ${styles.submitButton}"
          id="purchaseOrderForm-paymentButton"
        >
          ${locale.startsWith("de")
            ? "Bezahlen"
            : "Pay Now"}
        </button>

      </div>
      `
      : "";
  }
}