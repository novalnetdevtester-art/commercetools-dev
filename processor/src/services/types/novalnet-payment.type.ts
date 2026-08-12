import { PaymentRequestSchemaDTO } from "../../dtos/novalnet-payment.dto";
import {
  CommercetoolsCartService,
  CommercetoolsPaymentService,
} from "@commercetools/connect-payments-sdk";
export type NovalnetPaymentServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
};

export type CreatePaymentRequest = {
  data: PaymentRequestSchemaDTO;
  cartId?: string;
};

export interface UpdatePayment {
  id: string;
  pspReference?: string;
  paymentMethod?: string;
  transaction?: {
    type: string;
    amount: any;
    interactionId?: string;
    state?: string;
  };
  paymentStatus?: {
    interfaceCode: string;
    interfaceText: string;
  };
}
