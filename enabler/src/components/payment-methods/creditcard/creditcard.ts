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

export class CreditcardBuilder implements PaymentComponentBuilder {
  public componentHasSubmit = true;

  constructor(private baseOptions: BaseOptions) {}

  build(config: ComponentOptions): PaymentComponent {
    return new Creditcard(this.baseOptions, config);
  }
}

export class Creditcard extends BaseComponent {
  private showPayButton: boolean;

  constructor(baseOptions: BaseOptions, componentOptions: ComponentOptions) {
    super(PaymentMethod.creditcard, baseOptions, componentOptions);
    this.showPayButton = componentOptions?.showPayButton ?? false;
  }

  mount(selector: string) {
    const safeSelector = "#" + CSS.escape(selector.substring(1));
    const container = document.querySelector(safeSelector);

    if (!container) {
      console.error("Container not found:", safeSelector);
      return;
    }

    // Prevent duplicate iframe render
    if (container.querySelector("#novalnet_iframe")) {
      return;
    }

    container.insertAdjacentHTML("beforeend", this._getTemplate());

    // Wait for iframe element to actually be in the DOM via MutationObserver,
    // then load SDK and init form. Pay button is bound only after SDK is ready.
    this._waitForElement("#novalnet_iframe")
      .then(async () => {
        try {
          await this._loadNovalnetScriptOnce();

          const payButton = document.querySelector(
            "#purchaseOrderForm-paymentButton",
          ) as HTMLButtonElement | null;

          await this._initNovalnetCreditCardForm(payButton);

          // Bind pay button only after SDK is fully initialized
          if (
            this.showPayButton &&
            payButton &&
            !(payButton as any)._nnBound
          ) {
            (payButton as any)._nnBound = true;

            payButton.addEventListener("click", async (e) => {
              e.preventDefault();

              const NovalnetUtility = (window as any).NovalnetUtility;

              if (NovalnetUtility?.getPanHash) {
                try {
                  payButton.disabled = true;
                  await NovalnetUtility.getPanHash();
                } catch (error) {
                  payButton.disabled = false;
                  console.error("Error getting pan hash:", error);
                }
              } else {
                console.warn("NovalnetUtility.getPanHash not available");
              }
            });
          }
        } catch (err) {
          console.error("Failed to initialize Novalnet form:", err);
        }
      })
      .catch((err) => {
        console.error("Novalnet iframe element not found in DOM:", err);
      });
  }

  async submit() {
    this.sdk.init({ environment: this.environment });

    const pathLocale = window.location.pathname.split("/")[1];
    const baseSiteUrl = new URL(window.location.href).origin;

    try {
      const panhashInput = document.getElementById(
        "pan_hash",
      ) as HTMLInputElement;
      const uniqueIdInput = document.getElementById(
        "unique_id",
      ) as HTMLInputElement;
      const doRedirectInput = document.getElementById(
        "do_redirect",
      ) as HTMLInputElement;

      const panhash = panhashInput?.value.trim();
      const uniqueId = uniqueIdInput?.value.trim();
      const doRedirect = doRedirectInput?.value.trim();

      if (!panhash || !uniqueId) {
        this.onError("Credit card information is missing or invalid.");
        return;
      }

      const requestData: PaymentRequestSchemaDTO = {
        paymentMethod: {
          type: "CREDITCARD",
          panHash: panhash,
          uniqueId: uniqueId,
          doRedirect: doRedirect,
        },
        paymentOutcome: PaymentOutcome.AUTHORIZED,
        lang: pathLocale ?? "de",
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error("HTTP error:", errorText);
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      if (data.paymentReference) {
        this.onComplete?.({
          isSuccess: true,
          paymentReference: data.paymentReference,
        });
      } else {
        this.onError("Payment failed. Please try again.");
      }
    } catch (e) {
      console.error("Payment submit error:", e);
      this.onError("Some error occurred. Please try again.");
    }
  }

  private _getTemplate() {
    const payButton = this.showPayButton
      ? `
          <button
            class="${buttonStyles.button} ${buttonStyles.fullWidth} ${styles.submitButton}"
            id="purchaseOrderForm-paymentButton"
            type="button"
          >
            Pay
          </button>
        `
      : "";

    return `
      <div class="${styles.wrapper}">
        <iframe
          id="novalnet_iframe"
          frameborder="0"
          scrolling="no"
          style="min-width:40%;border:none;display:block;"
        ></iframe>
        <input type="hidden" id="pan_hash" name="pan_hash" />
        <input type="hidden" id="unique_id" name="unique_id" />
        <input type="hidden" id="do_redirect" name="do_redirect" />
        ${payButton}
      </div>
    `;
  }

  /**
   * Waits for a DOM element using MutationObserver instead of a blind setTimeout.
   * Resolves immediately if element already exists.
   */
  private _waitForElement(selector: string, timeout = 3000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) {
        resolve(el);
        return;
      }

      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) {
          observer.disconnect();
          resolve(found);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Loads the Novalnet SDK script once.
   * Handles the race condition where the script tag exists but hasn't finished
   * loading yet (e.g. on remount) — waits for it instead of returning early.
   */
  private async _loadNovalnetScriptOnce(): Promise<void> {
    if ((window as any).NovalnetUtility) {
      return;
    }

    const src = "https://cdn.novalnet.de/js/v2/NovalnetUtility-1.1.2.js";
    const existing = document.querySelector(
      `script[src="${src}"]`,
    ) as HTMLScriptElement | null;

    if (existing) {
      // Script tag exists but NovalnetUtility not ready yet — wait for it
      await new Promise<void>((resolve, reject) => {
        const poll = setInterval(() => {
          if ((window as any).NovalnetUtility) {
            clearInterval(poll);
            resolve();
          }
        }, 50);
        existing.addEventListener("load", () => { clearInterval(poll); resolve(); }, { once: true });
        existing.addEventListener("error", (e) => { clearInterval(poll); reject(e); }, { once: true });
        setTimeout(() => {
          clearInterval(poll);
          reject(new Error("NovalnetUtility load timeout"));
        }, 5000);
      });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.crossOrigin = "anonymous";

    const loadPromise = new Promise<void>((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
    });

    document.head.appendChild(script);
    await loadPromise;
  }

  private async _initNovalnetCreditCardForm(
    payButton: HTMLButtonElement | null,
  ): Promise<void> {
    const NovalnetUtility = (window as any).NovalnetUtility;

    if (!NovalnetUtility) {
      console.warn("NovalnetUtility not available.");
      return;
    }

    // Fetch client key from processor — include session header
    const res = await fetch(this.processorUrl + "/getconfig", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Session-Id": this.sessionId,
      },
      body: JSON.stringify({
        paymentMethod: { type: "CREDITCARD" },
        paymentOutcome: "AUTHORIZED",
      }),
    });

    const json = await res.json();

    if (!json?.paymentReference) {
      throw new Error("Missing client key from /getconfig");
    }

    this.clientKey = String(json.paymentReference);
    NovalnetUtility.setClientKey(this.clientKey);

    const lang = window.location.pathname.split("/")[1]?.toUpperCase();

    const configurationObject = {
      callback: {
        on_success: async (data: any) => {
          (document.getElementById("pan_hash") as HTMLInputElement).value =
            data.hash;
          (document.getElementById("unique_id") as HTMLInputElement).value =
            data.unique_id;
          (document.getElementById("do_redirect") as HTMLInputElement).value =
            data.do_redirect;

          if (payButton) payButton.disabled = false;

          await this.submit();
          return true;
        },

        on_error: (data: any) => {
          if (data?.error_message) {
            alert(data.error_message);
          }
          if (payButton) payButton.disabled = false;
          return false;
        },
      },

      iframe: {
        id: "novalnet_iframe",
        inline: 1,
        style: {
          container: "",
          input: "",
          label: "",
        },
        text: {
          lang,
          card_holder: {
            label: "Card holder name",
            place_holder: "Name on card",
          },
          card_number: {
            label: "Card number",
            place_holder: "XXXX XXXX XXXX XXXX",
          },
          expiry_date: {
            label: "Expiry date",
          },
          cvc: {
            label: "CVC/CVV/CID",
            place_holder: "XXX",
          },
        },
      },
    };

    NovalnetUtility.createCreditCardForm(configurationObject);
  }
}
