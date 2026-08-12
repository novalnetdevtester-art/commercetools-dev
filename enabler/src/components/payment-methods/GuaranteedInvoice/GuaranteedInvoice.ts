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
  
  export class GuaranteedInvoiceBuilder implements PaymentComponentBuilder {
    public componentHasSubmit = true;
    constructor(private baseOptions: BaseOptions) {}
  
    build(config: ComponentOptions): PaymentComponent {
      return new GuaranteedInvoice(this.baseOptions, config);
    }
  }
  
  export class GuaranteedInvoice extends BaseComponent {
    private showPayButton: boolean;
  
    constructor(baseOptions: BaseOptions, componentOptions: ComponentOptions) {
      super(PaymentMethod.GuaranteedInvoice, baseOptions, componentOptions);
      this.showPayButton = componentOptions?.showPayButton ?? false;
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
            .includes('GuaranteedInvoice')
        ) {
  
          paymentLabel.textContent =
            'Invoice with payment guarantee';
        }
  
      }, 100);
  
      /**
       * Bind button event
       */
      if (this.showPayButton) {
  
        const button =
          document.querySelector(
            "#GuaranteedInvoiceForm-paymentButton"
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
      // Here we would call the SDK to sumbit the payment
      this.sdk.init({ environment: this.environment });
      const pathLocale = window.location.pathname.split("/")[1];
      const url = new URL(window.location.href);
      const baseSiteUrl = url.origin;
  
      try {
        const birthdateInput = document.getElementById("nn_birthdate") as HTMLInputElement;
        const birthdate = birthdateInput?.value.trim() ?? "";
        const requestData: PaymentRequestSchemaDTO = {
          paymentMethod: {
            type: "GUARANTEED_INVOICE",
            birthdate: birthdate
          },
          paymentOutcome: PaymentOutcome.AUTHORIZED,
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
    const payButton = this.showPayButton
        ? `
      <div class="${styles.wrapper}">
        <p>Pay easily with GuaranteedInvoice and transfer the shopping amount within the specified date.</p>
        <button class="${buttonStyles.button} ${buttonStyles.fullWidth} ${styles.submitButton}" id="GuaranteedInvoiceForm-paymentButton">Pay</button>
      </div>
      `
        : "";
        return `
        <div style="width:100%; display:flex; flex-direction:column;">
          <script type="text/javascript" src="https://cdn.novalnet.de/js/v2/NovalnetUtility.js"></script>

            <!-- Birthdate -->
            <div style="display:flex; flex-direction:column; width:100%;">
            <label for="nn_birthdate"
                style="font-size:14px; font-weight:600; color:#333; margin-bottom:6px;"
            >
                Birthdate (DD-MM-YYYY) <span style="color:red;">*</span>
            </label>

            <input
                type="text"
                id="nn_birthdate"
                name="nn_birthdate"
                placeholder="DD-MM-YYYY"
                maxlength="10"
                style="
                padding:12px 14px;
                border:1.5px solid #d4d4d4;
                border-radius:6px;
                font-size:15px;
                transition:all 0.2s ease-in-out;
                "
            />

            <span
                id="nn_birthdate_error"
                style="
                display:none;
                margin-top:4px;
                font-size:12px;
                color:#d70000;
                "
            >Invalid birthdate</span>
            </div> 
        </form>
        </div>
      `;     

    }
  }
  