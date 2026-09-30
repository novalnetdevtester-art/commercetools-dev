export type NovalnetOrderStates = {
  orderState: "Open" | "Confirmed" | "Cancelled";
  paymentState: "Pending" | "Paid" | "BalanceDue" | "CreditOwed" | "Failed";
};

export type NovalnetOrderStateInput = {
  status?: string;
  eventType?: string;
  isPartialCapture?: boolean;
  isPartialCredit?: boolean;
  isPartialCancel?: boolean;
};

export function mapNovalnetOrderStates({
  status,
  eventType,
  isPartialCapture = false,
  isPartialCredit = false,
  isPartialCancel = false,
}: NovalnetOrderStateInput): NovalnetOrderStates | null {
  const paymentStatus = String(status ?? "").toUpperCase();
  const event = String(eventType ?? "").toUpperCase();

  switch (event) {
    case "TRANSACTION_CAPTURE":
      if (paymentStatus !== "CONFIRMED") break;
      return isPartialCapture
        ? { orderState: "Open", paymentState: "BalanceDue" }
        : { orderState: "Confirmed", paymentState: "Paid" };
    case "TRANSACTION_CANCEL":
      return isPartialCancel
        ? { orderState: "Open", paymentState: "BalanceDue" }
        : { orderState: "Cancelled", paymentState: "Failed" };
    case "CHARGEBACK":
    case "RETURN_DEBIT":
    case "REVERSAL":
      return { orderState: "Cancelled", paymentState: "Failed" };
    case "CREDIT":
      return isPartialCredit
        ? { orderState: "Open", paymentState: "BalanceDue" }
        : { orderState: "Confirmed", paymentState: "Paid" };
    case "TRANSACTION_REFUND":
      return { orderState: "Confirmed", paymentState: "Paid" };
    case "TRANSACTION_UPDATE":
      break;
  }

  switch (paymentStatus) {
    case "CONFIRMED":
      return { orderState: "Confirmed", paymentState: "Paid" };
    case "PENDING":
    case "ON_HOLD":
      return { orderState: "Open", paymentState: "Pending" };
    case "FAILURE":
    case "CANCELLED":
      return { orderState: "Cancelled", paymentState: "Failed" };
    default:
      return null;
  }
}
