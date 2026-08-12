import { projectApiRoot } from "./ct-client";
import { log } from "../libs/logger";

export const createTransactionCommentsType = async () => {
  try {
    await projectApiRoot
      .types()
      .withKey({ key: "novalnet-custom-field" })
      .get()
      .execute();
    log.info(
      "[custom-types] novalnet-custom-field type already exists — skipping creation",
    );
    return;
  } catch {
    log.info("[custom-types] novalnet-custom-field type not found — creating");
  }

  try {
    await projectApiRoot
      .types()
      .post({
        body: {
          key: "novalnet-custom-field",
          name: { en: "Novalnet Transaction Comments" },
          resourceTypeIds: ["transaction"],
          fieldDefinitions: [
            {
              name: "transactionComments",
              label: { en: "Transaction Comments" },
              type: { name: "String" },
              required: false,
            },
          ],
        },
      })
      .execute();
  } catch (err) {
    log.error(
      "[custom-types] Failed to create novalnet-custom-field type",
      err,
    );
    throw err;
  }
  log.info("[custom-types] novalnet-custom-field type created successfully");
};

export const createOrderPaymentCommentsType = async () => {
  try {
    await projectApiRoot
      .types()
      .withKey({ key: "order-payment-comments" })
      .get()
      .execute();
    log.info(
      "[custom-types] order-payment-comments type already exists — skipping creation",
    );
    return;
  } catch {
    log.info("[custom-types] order-payment-comments type not found — creating");
  }

  try {
    await projectApiRoot
      .types()
      .post({
        body: {
          key: "order-payment-comments",
          name: { en: "Order Payment Comments" },
          resourceTypeIds: ["order"],
          fieldDefinitions: [
            {
              name: "paymentComments",
              label: { en: "Payment Comments" },
              type: { name: "String" },
              required: false,
            },
          ],
        },
      })
      .execute();
  } catch (err) {
    log.error(
      "[custom-types] Failed to create order-payment-comments type",
      err,
    );
    throw err;
  }
  log.info("[custom-types] order-payment-comments type created successfully");
};

export const initCustomTypes = async () => {
  await createTransactionCommentsType();
  await createOrderPaymentCommentsType();
};

// Re-export apiRoot alias used by ct-custom-object.service.ts
export { projectApiRoot as apiRoot };
