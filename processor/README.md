# Novalnet Payment Integration Processor

This module provides a backend service based on [commercetools Connect](https://docs.commercetools.com/connect) that processes payment operations initiated from commercetools Checkout and communicates with the Novalnet Payment Gateway.

The processor is responsible for creating payments, handling direct and redirect payment flows, processing webhooks, synchronizing commercetools Payments and Orders, and maintaining transaction history throughout the payment lifecycle.

The module also provides post-deployment and pre-undeployment scripts that can perform connector-specific initialization and cleanup actions.

## Features

- Direct payment processing
- Redirect payment processing
- Authorization and Payment modes
- Configurable minimum amount for authorization
- Guaranteed payment validation
- Webhook handling
- Localized transaction comments (English and German)

---

## Getting Started

Run the following commands inside the `processor` directory.

### Install dependencies

```bash
npm install
```

### Build the application

```bash
npm run build
```

The compiled output is generated inside the `dist` folder.

### Run tests

```bash
npm test
```

### Start the application

```bash
npm run start
```

### Run development server

```bash
npm run dev
```

### Fix lint issues

```bash
npm run lint:fix
```

### Verify lint

```bash
npm run lint
```

### Run post-deploy

```bash
npm run connector:post-deploy
```

### Run pre-undeploy

```bash
npm run connector:pre-undeploy
```

---

## Running the Application

Configuration is loaded from:

```
processor/src/config/config.ts
```

using environment variables supplied through:

- `.env`
- `connect.yaml`
- commercetools Connect deployment configuration

The commercetools API Client must include the following scopes.

- `manage_payments`
- `manage_orders`
- `manage_types`
- `view_types`
- `manage_checkout_payment_intents`
- `view_sessions`
- `introspect_oauth_tokens`

---

## Authentication

The processor supports multiple authentication mechanisms.

- `oauth2`
- `session`
- `jwt`

### OAuth2

The connector authenticates with commercetools using OAuth2 credentials configured through Connect.

For details refer to the commercetools OAuth documentation.

### Session

The connector relies on commercetools Session Service to exchange information between the Enabler and Processor.

Example:

```http
POST https://session.<region>.commercetools.com/<project-key>/sessions
Authorization: Bearer <token>

{
  "cart": {
    "cartRef": {
      "id": "<cart-id>"
    }
  },
  "metadata": {
    "allowedPaymentMethods": [
      "CREDITCARD",
      "PAYPAL",
      "DIRECT_DEBIT_SEPA"
    ]
  }
}
```

The returned Session ID must be supplied as:

```
x-session-id
```

### JWT

For local development:

```bash
docker compose up -d
```

Obtain a JWT:

```bash
curl http://localhost:9000/jwt/token
```

Use:

```
Authorization: Bearer <token>
```

---

# Payment Flow

## Direct Payment

Supported methods include:

- Credit Card
- Direct Debit SEPA
- ACH
- Invoice
- Guaranteed payments

Flow:

1. Create commercetools Payment.
2. Attach Payment to Cart.
3. Call Novalnet Payment or Authorization API.
4. Update Payment transaction.
5. Synchronize Order and Payment states.

## Redirect Payment

Supported methods include:

- PayPal
- TWINT
- Przelewy24
- EPS
- Bancontact
- Multibanco
- Trustly
- WeChat Pay
- Online Bank Transfer

Flow:

1. Create Pending Authorization.
2. Redirect customer to Novalnet.
3. Customer returns to Success or Failure route.
4. Verify payment through Transaction Details API.
5. Synchronize Payment and Order.

---

# Webhook Handling

The processor automatically handles:

| Event | Action |
|--------|--------|
| PAYMENT | Initial payment |
| TRANSACTION_CAPTURE | Capture |
| TRANSACTION_CANCEL | Cancel |
| TRANSACTION_REFUND | Refund |
| CREDIT | Partial and Full credit |
| TRANSACTION_UPDATE | Amount, Due Date and Status updates |
| CHARGEBACK | Chargeback |


---

# Guaranteed Payment Validation

Supported methods:

- Guaranteed Invoice
- Guaranteed Direct Debit SEPA

The connector validates:

- Matching billing and shipping addresses
- Supported European countries
- EUR currency
- Minimum amount (€99.90)
- Merchant guarantee configuration

When "Force Non-Guaranteed Payment" is enabled, guaranteed payments automatically fall back to their standard payment methods.

---

# Configuration

The processor is configured through `connect.yaml`.

## commercetools Configuration

| Variable | Description |
|-----------|-------------|
| `CTP_PROJECT_KEY` | commercetools Project Key |
| `CTP_CLIENT_ID` | API Client ID |
| `CTP_CLIENT_SECRET` | API Client Secret |
| `CTP_AUTH_URL` | Authentication endpoint |
| `CTP_API_URL` | API endpoint |
| `CTP_SESSION_URL` | Session service |
| `CTP_JWKS_URL` | JWT key endpoint |
| `CTP_JWT_ISSUER` | JWT issuer |

## Novalnet Credentials

| Variable | Description |
|-----------|-------------|
| `NOVALNET_PUBLIC_KEY` | Merchant Signature |
| `NOVALNET_PRIVATE_KEY` | Access Key |
| `NOVALNET_TARIFF_KEY` | Tariff ID |
| `NOVALNET_CLIENT_KEY` | Client Key |
| `NOVALNET_WEBHOOK_TEST_MODE` | Webhook Test Mode |

## Payment Method Configuration

Every payment method supports its own configuration.

| Variable | Purpose |
|-----------|----------|
| `*_TEST_MODE` | Enable Test Mode |
| `*_PAYMENT_ACTION` | Payment or Authorization |
| `*_PAYMENT_ACTION_MINIMUM_AMOUNT` | Minimum Authorization Amount |
| `*_DUE_DATE` | Due date for Invoice/SEPA |
| `*_ALLOW_B2B_CUSTOMERS` | Guaranteed payment B2B option |
| `*_FORCE_NON_GUARANTEED_PAYMENT` | Guaranteed payment fallback |
| `NOVALNET_CREDITCARD_ENFORCE_3D_SECURE_PAYMENT_OUTSIDE_EU` | Force 3D Secure |
| `NOVALNET_CREDITCARD_DISPLAY_INLINE_CREDITCARD_FORM` | Inline Card Form |

Example:

```
NOVALNET_SEPA_PAYMENT_ACTION=authorize
NOVALNET_SEPA_PAYMENT_ACTION_MINIMUM_AMOUNT=10000
```

---