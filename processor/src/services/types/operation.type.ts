import { ConfigResponseSchemaDTO } from "../../dtos/operations/config.dto";
import {
  PaymentIntentRequestSchemaDTO,
  PaymentModificationStatus,
} from "../../dtos/operations/payment-intents.dto";
import { StatusResponseSchemaDTO } from "../../dtos/operations/status.dto";
export type PaymentProviderModificationResponse = {
  outcome: PaymentModificationStatus;
  pspReference: string;
};

export type ConfigResponse = ConfigResponseSchemaDTO;

export type StatusResponse = StatusResponseSchemaDTO;

export type ModifyPayment = {
  paymentId: string;
  data: PaymentIntentRequestSchemaDTO;
};
