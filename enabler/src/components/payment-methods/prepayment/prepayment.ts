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

export class PrepaymentBuilder implements PaymentComponentBuilder {
  public componentHasSubmit = true;
  constructor(private baseOptions: BaseOptions) {}

  build(config: ComponentOptions): PaymentComponent {
    return new Prepayment(this.baseOptions, config);
  }
}

export class Prepayment extends BaseComponent {
  private showPayButton: boolean;

  constructor(baseOptions: BaseOptions, componentOptions: ComponentOptions) {
    super(PaymentMethod.prepayment, baseOptions, componentOptions);
    this.showPayButton = componentOptions?.showPayButton ?? false;
  }


  mount(selector: string) {

    // Escape selector safely
    const safeSelector = selector.replace(/\|/g, '\\|');
    const container = document.querySelector(safeSelector);
    if (!container) {
      console.error('Container not found:', safeSelector);
      return;
    }

    container.insertAdjacentHTML("beforeend",this._getTemplate());
    if (this.showPayButton) {
      const button = document.querySelector("#purchaseOrderForm-paymentButton");
      if (button) {
        button.addEventListener("click",
          (e) => {
          e.preventDefault();
          this.submit();
          }
        );
      }
    }
  }

  async submit() {
    // here we would call the SDK to submit the payment
    this.sdk.init({ environment: this.environment });
    const pathLocale = window.location.pathname.split("/")[1];
    const url = new URL(window.location.href);
    const baseSiteUrl = url.origin;

    try {
      // start original
 
      const requestData: PaymentRequestSchemaDTO = {
        paymentMethod: {
          type: "PREPAYMENT",
        },
        paymentOutcome: PaymentOutcome.AUTHORIZED,
        lang: pathLocale ?? 'de',
        path: baseSiteUrl,
      };

      const response = await fetch(this.processorUrl + "/directPayment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.sessionId,
        },
        body: JSON.stringify(requestData),
      });
      const data = await response.json();
      if (data.paymentReference) {
        this.onComplete &&
          this.onComplete({
            isSuccess: true,
            paymentReference: data.paymentReference,
          });
      } else {
        this.onError("Some error occurred. Please try again.");
      }
    } catch (e) {
      this.onError("Some error occurred. Please try again.");
    }
  }

  private _getTemplate() {
    const locale = document.documentElement.lang || "en";
    const description = locale.startsWith("de") ? "Bezahlen Sie ganz einfach per Vorauskasse und überweisen Sie den Kaufbetrag innerhalb der angegebenen Frist." : "Pay easily with Prepayment and transfer the shopping amount within the specified date.";
    return this.showPayButton
      ? `<div class="${styles.wrapper}">
        <p> ${description} </p>
        <button class="${buttonStyles.button} ${buttonStyles.fullWidth} ${styles.submitButton}" id="purchaseOrderForm-paymentButton">
          ${locale.startsWith("de") ? "Bezahlen" : "Pay"}
        </button>
      </div>`
      : "";
  }

}
