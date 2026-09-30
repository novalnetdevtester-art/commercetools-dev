import { Static, Type } from '@sinclair/typebox';

export enum PaymentOutcome {
  AUTHORIZED = 'Authorized',
  REJECTED = 'Rejected',
}

export const PaymentOutcomeSchema = Type.Enum(PaymentOutcome);

export const PaymentRequestSchema = Type.Object({
  paymentMethod: Type.Object({
    type: Type.String(),
    accHolder: Type.Optional(Type.String()),
    birthdate: Type.Optional(Type.String()),
    accountNumber: Type.Optional(Type.String()),
    routingNumber: Type.Optional(Type.String()),
    panHash: Type.Optional(Type.String()),
    uniqueId: Type.Optional(Type.String()),
    doRedirect: Type.Optional(Type.String()),
    returnUrl: Type.Optional(Type.String()),
  }),
  paymentOutcome: PaymentOutcomeSchema,
  lang: Type.Optional(Type.String()),
  path: Type.Optional(Type.String()),
});

export type PaymentRequestSchemaDTO = Static<typeof PaymentRequestSchema>;
