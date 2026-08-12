/**
 * Extends the Commercetools SDK UpdatePayment type
 * to allow a paymentStatus block in updatePayment calls.
 */

export interface ExtendedUpdatePayment {
  id: string;
  pspReference?: string;
  paymentMethod?: string;
  paymentStatus?: {
    interfaceCode: string;
    interfaceText: string;
  };
  transaction?: {
    type: string;
    amount: any;
    interactionId?: string;
    state: string;
  };
}
