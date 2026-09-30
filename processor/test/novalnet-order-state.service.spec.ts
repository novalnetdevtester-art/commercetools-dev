import { mapNovalnetOrderStates } from "../src/services/novalnet-order-state.service";

describe("Novalnet financial Order state mapping", () => {
  test.each([
    ["ON_HOLD", "Pending"],
    ["PENDING", "Pending"],
    ["CONFIRMED", "Paid"],
    ["FAILURE", "Failed"],
  ])("%s maps to paymentState %s", (status, paymentState) => {
    expect(mapNovalnetOrderStates({ status })?.paymentState).toBe(paymentState);
  });

  test("partial capture leaves a balance due", () => {
    expect(mapNovalnetOrderStates({
      eventType: "TRANSACTION_CAPTURE", status: "CONFIRMED", isPartialCapture: true,
    })?.paymentState).toBe("BalanceDue");
  });

  test("a refund is not a purchase on credit", () => {
    expect(mapNovalnetOrderStates({
      eventType: "TRANSACTION_REFUND", status: "CONFIRMED",
    })?.paymentState).toBe("Paid");
  });
});
