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

export class SepaBuilder
  implements PaymentComponentBuilder {

  public componentHasSubmit = true;

  constructor(
    private baseOptions: BaseOptions
  ) {}

  build(
    config: ComponentOptions
  ): PaymentComponent {

    return new Sepa(
      this.baseOptions,
      config
    );
  }
}

export class Sepa extends BaseComponent {

  private showPayButton: boolean;

  constructor(
    baseOptions: BaseOptions,
    componentOptions: ComponentOptions
  ) {

    super(
      PaymentMethod.sepa,
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
          .includes('sepa')
      ) {

        paymentLabel.textContent =
          'Direct Debit SEPA';
      }

    }, 100);

    /**
     * Bind button event
     */
    if (this.showPayButton) {

      const button =
        document.querySelector(
          "#sepa-payment-button"
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

    /**
     * Init SDK
     */
    this.sdk.init({
      environment:
        this.environment
    });

    const pathLocale =
      window.location.pathname
        .split("/")[1];

    const url =
      new URL(window.location.href);

    const baseSiteUrl =
      url.origin;

    try {

      /**
       * Form values
       */
      const accountHolderInput =
        document.getElementById(
          'nn_account_holder'
        ) as HTMLInputElement;

      const ibanInput =
        document.getElementById(
          'nn_sepa_account_no'
        ) as HTMLInputElement;

      const bicInput =
        document.getElementById(
          'nn_sepa_bic'
        ) as HTMLInputElement;

      const accountHolder =
        accountHolderInput?.value
          ?.trim() ?? '';

      const iban =
        ibanInput?.value
          ?.trim() ?? '';

      const bic =
        bicInput?.value
          ?.trim() ?? '';

      /**
       * Basic validation
       */
      if (!accountHolder) {

        this.onError(
          "Please enter account holder name"
        );

        return;
      }

      if (!iban) {

        this.onError(
          "Please enter IBAN"
        );

        return;
      }

      /**
       * Request payload
       */
      const requestData:
        PaymentRequestSchemaDTO = {

        paymentMethod: {

          type:
            "DIRECT_DEBIT_SEPA",

          accHolder:
            accountHolder,

          iban:
            iban,

          bic:
            bic,
        },

        paymentOutcome:
          PaymentOutcome.AUTHORIZED,

        lang:
          pathLocale ?? 'de',

        path:
          baseSiteUrl,
      };

      /**
       * API request
       */
      const response =
        await fetch(
          this.processorUrl +
          "/directPayment",
          {

            method: "POST",

            headers: {

              "Content-Type":
                "application/json",

              "X-Session-Id":
                this.sessionId,
            },

            body:
              JSON.stringify(
                requestData
              ),
          }
        );

      /**
       * Validate response
       */
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

      console.log(
        'SEPA payment response:',
        data
      );

      /**
       * Success
       */
      if (
        data.paymentReference
      ) {

        this.onComplete &&
          this.onComplete({

            isSuccess: true,

            paymentReference:
              data.paymentReference,
          });

      } else {

        this.onError(
          "Some error occurred. Please try again."
        );
      }

    } catch (e: any) {

      console.error(
        'SEPA submit error:',
        {

          message:
            e?.message,

          stack:
            e?.stack,
        }
      );

      this.onError(
        "Some error occurred. Please try again."
      );
    }
  }

  private _getTemplate() {

    const payButton =
      this.showPayButton
        ? `
          <button
            class="
              ${buttonStyles.button}
              ${buttonStyles.fullWidth}
              ${styles.submitButton}
            "

            id="sepa-payment-button"

            type="button"
          >
            Pay Now
          </button>
        `
        : "";

    return `

      <div
        class="${styles.wrapper}"

        style="
          width:100%;
          display:flex;
          flex-direction:column;
          gap:20px;
          margin-top:20px;
        "
      >

        <p>
          Pay conveniently using
          Direct Debit SEPA.
        </p>

        <div
          id="nn_sepa_form"

          style="
            width:100%;
            display:flex;
            flex-direction:column;
            gap:20px;
          "
        >

          <!-- Account Holder -->
          <div
            style="
              display:flex;
              flex-direction:column;
              width:100%;
            "
          >

            <label
              for="nn_account_holder"

              style="
                font-size:14px;
                font-weight:600;
                color:#333;
                margin-bottom:6px;
              "
            >
              Account Holder
              <span style="color:red;">
                *
              </span>
            </label>

            <input
              type="text"

              id="nn_account_holder"

              name="nn_account_holder"

              autocomplete="off"

              style="
                padding:12px 14px;
                border:1px solid #d4d4d4;
                border-radius:6px;
                font-size:15px;
              "
            />
          </div>

          <!-- IBAN -->
          <div
            style="
              display:flex;
              flex-direction:column;
              width:100%;
            "
          >

            <label
              for="nn_sepa_account_no"

              style="
                font-size:14px;
                font-weight:600;
                color:#333;
                margin-bottom:6px;
              "
            >
              IBAN
              <span style="color:red;">
                *
              </span>
            </label>

            <input
              type="text"

              id="nn_sepa_account_no"

              name="nn_sepa_account_no"

              autocomplete="off"

              style="
                padding:12px 14px;
                border:1px solid #d4d4d4;
                border-radius:6px;
                font-size:15px;
                text-transform:uppercase;
              "
            />
          </div>

          <!-- BIC -->
          <div
            style="
              display:flex;
              flex-direction:column;
              width:100%;
            "
          >

            <label
              for="nn_sepa_bic"

              style="
                font-size:14px;
                font-weight:600;
                color:#333;
                margin-bottom:6px;
              "
            >
              BIC
            </label>

            <input
              type="text"

              id="nn_sepa_bic"

              name="nn_sepa_bic"

              autocomplete="off"

              style="
                padding:12px 14px;
                border:1px solid #d4d4d4;
                border-radius:6px;
                font-size:15px;
              "
            />
          </div>

          ${payButton}

        </div>

      </div>
    `;
  }
}