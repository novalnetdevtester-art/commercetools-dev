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

export class OnlinebanktransferBuilder
  implements PaymentComponentBuilder {

  public componentHasSubmit = true;

  constructor(
    private baseOptions: BaseOptions
  ) {}

  build(
    config: ComponentOptions
  ): PaymentComponent {

    return new Onlinebanktransfer(
      this.baseOptions,
      config
    );
  }
}

export class Onlinebanktransfer
  extends BaseComponent {

  private showPayButton: boolean;

  private isSubmitting = false;

  constructor(
    baseOptions: BaseOptions,
    componentOptions: ComponentOptions
  ) {

    super(
      PaymentMethod.onlinebanktransfer,
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
          .includes('onlinebanktransfer')
      ) {

        paymentLabel.textContent =
          'Online bank transfer';
      }

    }, 100);

    /**
     * Bind button event
     */
    if (this.showPayButton) {

      const button =
        document.querySelector(
          "#onlinebanktransfer-paymentButton"
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
          type: "ONLINE_BANK_TRANSFER",
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

      if (
        data?.txnSecret
      ) {

        window.location.href =
          data.txnSecret;

      } else {

        console.error(
          'Missing txnSecret:',
          data
        );

        this.onError(
          "Payment redirect failed."
        );
      }

    } catch (e) {

      console.error(
        'Online bank transfer error:',
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
        ? "Bezahlen Sie bequem per Online-Überweisung."
        : "Pay easily with Online Bank Transfer.";

    return `
      <div
        id="novalnet-onlinebanktransfer-wrapper"
        class="${styles.wrapper}"
      >

        <p>
          ${description}
        </p>

        ${
          this.showPayButton
            ? `
            <button
              class="${buttonStyles.button}
              ${buttonStyles.fullWidth}
              ${styles.submitButton}"

              type="button"

              id="onlinebanktransfer-paymentButton"
            >
              ${
                locale.startsWith("de")
                  ? "Bezahlen"
                  : "Pay Now"
              }
            </button>
            `
            : ""
        }

      </div>
    `;
  }
}