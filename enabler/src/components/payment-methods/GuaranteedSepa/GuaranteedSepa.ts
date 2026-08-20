import {
  ComponentOptions,
  PaymentComponent,
  PaymentComponentBuilder,
  PaymentMethod,
} from "../../../payment-enabler/payment-enabler";

import { BaseComponent } from "../../base";
import styles from "../../../style/style.module.scss";
import buttonStyles from "../../../style/button.module.scss";

import {
  PaymentOutcome,
  PaymentRequestSchemaDTO,
} from "../../../dtos/novalnet-payment.dto";

import { BaseOptions } from "../../../payment-enabler/novalnet-payment-enabler";

declare global {
  interface Window {
    NovalnetUtility?: {
      checkIban: (event: Event, bicDivId: string) => boolean;
      formatIban: (event: Event, bicDivId: string) => boolean | void;
      setBirthDateFormat: (format: string) => void;
      isNumericBirthdate: (
        input: HTMLInputElement,
        event: KeyboardEvent
      ) => boolean | void;
      validateDateFormat: (value: string) => boolean;
    };
  }
}

export class GuaranteedSepaBuilder
  implements PaymentComponentBuilder {

  public componentHasSubmit = true;

  constructor(
    private baseOptions: BaseOptions
  ) {}

  build(
    config: ComponentOptions
  ): PaymentComponent {

    return new GuaranteedSepa(
      this.baseOptions,
      config
    );
  }
}

export class GuaranteedSepa extends BaseComponent {

  private showPayButton: boolean;

  constructor(
    baseOptions: BaseOptions,
    componentOptions: ComponentOptions
  ) {

    super(
      PaymentMethod.GuaranteedSepa,
      baseOptions,
      componentOptions
    );

    this.showPayButton =
      componentOptions?.showPayButton ?? false;
  }

  async mount(selector: string) {

    const safeSelector =
      "#" + CSS.escape(
        selector.substring(1)
      );

    const container =
      document.querySelector(
        safeSelector
      );

    if (!container) {

      console.error(
        "[Guaranteed SEPA] Container not found:",
        safeSelector
      );

      return;
    }

    await this.loadNovalnetUtility();

    container.insertAdjacentHTML(
      "afterbegin",
      this.getTemplate()
    );

    setTimeout(() => {

      const label =
        container.querySelector(
          "label"
        );

      if (
        label &&
        label.textContent
          ?.toLowerCase()
          .includes("guaranteed")
      ) {

        label.textContent =
          "Direct Debit SEPA with payment guarantee";
      }

      this.initializeIbanHandling();
      this.initializeDobHandling();

    }, 100);

    if (this.showPayButton) {

      document
        .querySelector(
          "#guaranteed-sepa-payment-button"
        )
        ?.addEventListener(
          "click",
          (e) => {

            e.preventDefault();

            this.submit();
          }
        );
    }
  }

  private async loadNovalnetUtility(): Promise<void> {

    if (window.NovalnetUtility) {
      return;
    }

    await new Promise<void>((resolve, reject) => {

      const script =
        document.createElement("script");

      script.src =
        "https://cdn.novalnet.de/js/v2/NovalnetUtility-1.1.2.js";

      script.async = true;

      script.onload = () => {
        resolve();
      };

      script.onerror = reject;

      document.head.appendChild(script);
    });
  }

  private initializeIbanHandling() {

    const ibanInput =
      document.getElementById(
        "nn_guaranteesepa_account_no"
      ) as HTMLInputElement | null;

    if (!ibanInput) {

      console.warn(
        "[Guaranteed SEPA] IBAN input not found"
      );

      return;
    }

    const handleIban = (event: Event) => {

      try {

        const shouldShowBic =
          window.NovalnetUtility?.formatIban(
            event,
            "nn_guaranteesepa_bic_div"
          );

        const bicContainer =
          document.getElementById(
            "nn_guaranteesepa_bic_div"
          );

        if (!bicContainer) return;

        if (typeof shouldShowBic === "boolean") {

          bicContainer.style.display =
            shouldShowBic
              ? "flex"
              : "none";
        }

      } catch (err) {

        console.error(
          "[Guaranteed SEPA] IBAN formatting error",
          err
        );
      }
    };

    ibanInput.addEventListener(
      "keyup",
      handleIban
    );

    ibanInput.addEventListener(
      "change",
      handleIban
    );

    ibanInput.addEventListener(
      "blur",
      handleIban
    );

    const bicDiv =
      document.getElementById(
        "nn_guaranteesepa_bic_div"
      );

    if (bicDiv) {

      bicDiv.style.display = "none";
      bicDiv.style.flexDirection = "column";
      bicDiv.style.width = "100%";
    }
  }

  private initializeDobHandling() {

    const dobInput =
      document.getElementById(
        "nn_guaranteesepa_dob"
      ) as HTMLInputElement | null;

    if (
      !dobInput ||
      !window.NovalnetUtility
    ) {

      console.warn(
        "[Guaranteed SEPA] DOB initialization skipped"
      );

      return;
    }

    window.NovalnetUtility.setBirthDateFormat(
      "DD.MM.YYYY"
    );

    dobInput.addEventListener(
      "keydown",
      (event) => {

        window.NovalnetUtility?.isNumericBirthdate(
          dobInput,
          event as KeyboardEvent
        );
      }
    );

    dobInput.addEventListener(
      "blur",
      () => {

        const valid =
          window.NovalnetUtility?.validateDateFormat(
            dobInput.value
          );
      }
    );
  }

  async submit() {

    this.sdk.init({
      environment:
        this.environment,
    });

    const locale =
      window.location.pathname.split("/")[1] ?? "de";

    const baseUrl =
      window.location.origin;

    try {

      const accountHolder =
        (
          document.getElementById(
            "nn_guaranteesepa_account_holder"
          ) as HTMLInputElement
        )?.value.trim();

      const iban =
        (
          document.getElementById(
            "nn_guaranteesepa_account_no"
          ) as HTMLInputElement
        )?.value.trim();

      const bic =
        (
          document.getElementById(
            "nn_sepa_bic"
          ) as HTMLInputElement
        )?.value.trim();

      const birthDate =
        (
          document.getElementById(
            "nn_guaranteesepa_dob"
          ) as HTMLInputElement
        )?.value.trim();

      if (!accountHolder) {

        this.onError(
          "Please enter account holder name."
        );

        return;
      }

      if (!iban) {

        this.onError(
          "Please enter IBAN."
        );

        return;
      }

      if (!birthDate) {

        this.onError(
          "Please enter Date of Birth."
        );

        return;
      }

      const validDob =
        window.NovalnetUtility?.validateDateFormat(
          birthDate
        );

      if (!validDob) {

        this.onError(
          "Please enter a valid Date of Birth."
        );

        return;
      }

      const requestData:
        PaymentRequestSchemaDTO = {

        paymentMethod: {

          type:
            "GUARANTEED_DIRECT_DEBIT_SEPA",

          accHolder:
            accountHolder,

          iban,
          bic,
          birthDate,
        },

        paymentOutcome:
          PaymentOutcome.AUTHORIZED,

        lang: locale,
        path: baseUrl,
      };

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
            body: JSON.stringify(
              requestData
            ),
          }
        );

      if (!response.ok) {

        const text =
          await response.text();

        console.error(
          "[Guaranteed SEPA] HTTP Error",
          text
        );

        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      if (data?.paymentReference) {

        this.onComplete?.({
          isSuccess: true,
          paymentReference:
            data.paymentReference,
        });

        return;
      }

      this.onError(
        data?.transactionStatusText ||
          "Payment failed. Please try again."
      );

    } catch (err) {

      console.error(
        "[Guaranteed SEPA] Submit error",
        err
      );

      this.onError(
        "Some error occurred. Please try again."
      );
    }
  }

  private getTemplate() {

    const payButton =
      this.showPayButton
        ? `
        <button
          class="${buttonStyles.button} ${buttonStyles.fullWidth} ${styles.submitButton}"
          id="guaranteed-sepa-payment-button"
          type="button"
        >
          Pay Now
        </button>
      `
        : "";

    return `
      <div
        class="${styles.wrapper}"
        style="display:flex;flex-direction:column;gap:20px;width:100%;margin-top:20px;"
      >

        <p>
          Pay conveniently using Direct Debit SEPA with payment guarantee.
        </p>

        <div style="display:flex;flex-direction:column;gap:20px;width:100%;">

          <div style="display:flex;flex-direction:column;">
            <label
              for="nn_guaranteesepa_account_holder"
              style="font-size:14px;font-weight:600;margin-bottom:6px;"
            >
              Account Holder
              <span style="color:red;">*</span>
            </label>

            <input
              type="text"
              id="nn_guaranteesepa_account_holder"
              style="padding:12px 14px;border:1px solid #d4d4d4;border-radius:6px;font-size:15px;"
            />
          </div>

          <div style="display:flex;flex-direction:column;">
            <label
              for="nn_guaranteesepa_account_no"
              style="font-size:14px;font-weight:600;margin-bottom:6px;"
            >
              IBAN
              <span style="color:red;">*</span>
            </label>

            <input
              type="text"
              id="nn_guaranteesepa_account_no"
              style="padding:12px 14px;border:1px solid #d4d4d4;border-radius:6px;font-size:15px;text-transform:uppercase;"
            />
          </div>

          <div
            id="nn_guaranteesepa_bic_div"
            style="display:none;flex-direction:column;width:100%;"
          >
            <label
              for="nn_sepa_bic"
              style="font-size:14px;font-weight:600;margin-bottom:6px;"
            >
              BIC
              <span style="color:red;">*</span>
            </label>
          
            <input
              type="text"
              id="nn_sepa_bic"
              name="nn_sepa_bic"
              style="
                width:100%;
                box-sizing:border-box;
                padding:12px 14px;
                border:1px solid #d4d4d4;
                border-radius:6px;
                font-size:15px;
              "
            />
          </div>

          <div style="display:flex;flex-direction:column;">
            <label
              for="nn_guaranteesepa_dob"
              style="font-size:14px;font-weight:600;margin-bottom:6px;"
            >
              Date of Birth
              <span style="color:red;">*</span>
            </label>

            <input
              type="text"
              id="nn_guaranteesepa_dob"
              placeholder="DD.MM.YYYY"
              maxlength="10"
              autocomplete="bday"
              style="padding:12px 14px;border:1px solid #d4d4d4;border-radius:6px;font-size:15px;"
            />
          </div>

          ${payButton}

        </div>
      </div>
    `;
  }
}
