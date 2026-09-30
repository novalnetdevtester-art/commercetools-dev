# Novalnet Payment Connector for commercetools

The **Novalnet Payment Connector** is a commercetools Connect application that integrates the Novalnet Payment Gateway with **commercetools Checkout**. It supports direct and redirect payment methods, authorization and payment flows, guaranteed payment validation, webhook processing, and automatic synchronization of Payments and Orders throughout the payment lifecycle.

The connector is built using the **commercetools Connect Payment SDK** and follows commercetools Connect deployment standards.

## Features

* Direct and Redirect payment flows
* Credit Card 3D Secure support
* Authorization and Payment modes
* Configurable minimum amount for authorization
* Guaranteed payment eligibility validation
* Optional fallback to non-guaranteed payments
* Webhook processing for major payment events
* English and German transaction comments
* commercetools Connect compatible deployment

## Supported Payment Methods

| Payment Method               | Flow              |
| ---------------------------- | ----------------- |
| Credit Card                  | Direct / Redirect |
| Direct Debit SEPA            | Direct            |
| Guaranteed Direct Debit SEPA | Direct            |
| Direct Debit ACH             | Direct            |
| Invoice                      | Direct            |
| Guaranteed Invoice           | Direct            |
| Prepayment                   | Direct            |
| PayPal                       | Redirect          |
| Online Bank Transfer         | Redirect          |
| Przelewy24                   | Redirect          |
| EPS                          | Redirect          |
| Bancontact                   | Redirect          |
| Multibanco                   | Redirect          |
| Alipay                       | Redirect          |
| WeChat Pay                   | Redirect          |
| Trustly                      | Redirect          |
| TWINT                        | Redirect          |
| PostFinance                  | Redirect          |
| PostFinance Card             | Redirect          |
| MB WAY                       | Redirect          |
| BLIK                         | Redirect          |

## Project Structure

```
.
├── enabler/
│   ├── src/
│   ├── test/
│   └── README.md
├── processor/
│   ├── src/
│   ├── test/
│   └── README.md
├── connect.yaml
├── docker-compose.yml
└── README.md
```

## Modules

### Enabler

The **Enabler** provides the frontend integration between commercetools Checkout and Novalnet's secure payment components.

Responsibilities include:

* Loading Novalnet payment libraries.
* Rendering secure payment forms.
* Initializing payment methods.
* Collecting payment data securely.
* Communicating with the Processor.

### Processor

The **Processor** is the backend middleware responsible for:

* Creating payments.
* Calling Novalnet APIs.
* Processing redirect callbacks.
* Handling webhooks.
* Updating commercetools Payments.
* Synchronizing Orders.
* Maintaining transaction history.

## Payment Flow

### Direct Payment

Used for payment methods such as Credit Card, SEPA, ACH, Invoice, and Guaranteed payments.

```
Customer
   │
Checkout
   │
Processor
   │
Create Payment
   │
Novalnet Payment/Authorization API
   │
Update Payment
   │
Sync Order & Payment States
```

### Redirect Payment

Used for payment methods such as PayPal, TWINT, Przelewy24, EPS, Bancontact, and other redirect payment methods.

```
Customer
   │
Checkout
   │
Processor
   │
Create Pending Authorization
   │
Redirect to Novalnet
   │
Customer completes payment
   │
Success / Failure Route
   │
Transaction Details API
   │
Update Payment
   │
Sync Order & Payment States
```

## Authorization Logic

The connector supports both:

* `payment`
* `authorize`

Each payment method can be configured independently.

When **Authorize** is selected, the connector also supports a configurable **minimum amount**.

Example:

| Order Amount | Minimum Amount | Result        |
| ------------ | -------------- | ------------- |
| €50          | €100           | Payment       |
| €120         | €100           | Authorization |

## Guaranteed Payments

Supported methods:

* Guaranteed Invoice
* Guaranteed Direct Debit SEPA

Before processing a guaranteed payment, the connector validates:

* Billing and shipping addresses match.
* Supported European country.
* EUR currency.
* Minimum amount (€99.90).
* Merchant guarantee configuration.
* B2B eligibility (where applicable).

If **Force Non-Guaranteed Payment** is enabled, guaranteed payments automatically fall back to their standard payment methods when guarantee conditions are not met.

## Webhook Processing

The connector processes the following Novalnet webhook events.

| Event               | Action                              |
| ------------------- | ----------------------------------- |
| PAYMENT             | Initial payment                     |
| TRANSACTION_CAPTURE | Capture                             |
| TRANSACTION_CANCEL  | Cancel                              |
| TRANSACTION_REFUND  | Refund                              |
| CREDIT              | Partial and Full credit             |
| TRANSACTION_UPDATE  | Amount, Due Date and Status updates |
| CHARGEBACK          | Chargeback                          |


## Transaction History

The connector maintains transaction history across:

* Payment Transaction Custom Fields
* Order Custom Fields
* Custom Objects (`nn-private-data`)

This preserves:

* Transaction IDs
* Payment Type
* Capture history
* Refund history
* Credit history
* Chargeback history
* Transaction updates
* Test Mode information

## Configuration

Configuration is managed through **commercetools Connect** using `connect.yaml`.

### commercetools Configuration

Required commercetools settings include:

* Project Key
* Client ID
* Client Secret
* Auth URL
* API URL
* Session URL
* JWKS URL
* JWT Issuer

### Novalnet Configuration

Required Novalnet settings include:

* Public Key
* Private Key
* Tariff ID
* Client Key

Each payment method also supports its own configuration for:

* Test Mode
* Payment Action
* Minimum Authorization Amount
* Due Date
* Guaranteed Payment options
* Credit Card 3D Secure settings

Refer to **connect.yaml** for the complete configuration list.

## Local Development

### Environment Setup

Inside each module:

```bash
cp .env.template .env
```

Populate the environment variables with:

* commercetools credentials
* Novalnet credentials
* Merchant configuration

### Start Development Environment

```bash
docker compose up
```

This starts:

* JWT Server
* Enabler
* Processor

## Build

Install dependencies:

```bash
npm install
```

Build the project:

```bash
npm run build
```

## Deployment

The connector is deployed through **commercetools Connect**.

Deployment consists of:

* **Enabler** (Assets)
* **Processor** (Service)

The deployment configuration is defined in `connect.yaml`.

Post-deployment and pre-undeployment tasks are executed automatically using the configured deployment scripts.

## Additional Documentation

For module-specific implementation details, refer to:

* **Enabler:** `enabler/README.md`
* **Processor:** `processor/README.md`
* **Deployment:** `connect.yaml`

