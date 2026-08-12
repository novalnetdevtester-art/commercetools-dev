"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = exports.config = void 0;
exports.config = {
    // Required by Payment SDK
    projectKey: process.env.CTP_PROJECT_KEY,
    clientId: process.env.CTP_CLIENT_ID,
    clientSecret: process.env.CTP_CLIENT_SECRET,
    jwksUrl: process.env.CTP_JWKS_URL ||
        "https://mc-api.europe-west1.gcp.commercetools.com/.well-known/jwks.json",
    jwtIssuer: process.env.CTP_JWT_ISSUER ||
        "https://mc-api.europe-west1.gcp.commercetools.com",
    checkoutUrl: process.env.CTP_CHECKOUT_URL ||
        "https://checkout.europe-west1.gcp.commercetools.com",
    authUrl: process.env.CTP_AUTH_URL ||
        "https://auth.europe-west1.gcp.commercetools.com",
    apiUrl: process.env.CTP_API_URL || "https://api.europe-west1.gcp.commercetools.com",
    sessionUrl: process.env.CTP_SESSION_URL ||
        "https://session.europe-west1.gcp.commercetools.com/",
    healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || "5000"),
    // Required by logger
    loggerLevel: process.env.LOGGER_LEVEL || "info",
    // Update with specific payment providers config
    mockClientKey: process.env.MOCK_CLIENT_KEY,
    mockEnvironment: process.env.MOCK_ENVIRONMENT,
    // Update with specific payment providers config
    novalnetPublicKey: process.env.NOVALNET_PUBLIC_KEY,
    novalnetPrivateKey: process.env.NOVALNET_PRIVATE_KEY,
    novalnetTariff: process.env.NOVALNET_TARIFF_KEY,
    novalnetClientkey: process.env.NOVALNET_CLIENT_KEY,
    novalnetWebhookURL: process.env.NOVALNET_WEBHOOK_URL,
    novalnetWebhookTestMode: process.env.NOVALNET_WEBHOOK_TEST_MODE,
    merchanturl: process.env.MERCHANT_RETURN_URL || "",
    url: process.env.URL || "",
    novalnet_INVOICE_TestMode: process.env.NOVALNET_INVOICE_TEST_MODE || "0",
    novalnet_PREPAYMENT_TestMode: process.env.NOVALNET_PREPAYMENT_TEST_MODE || "0",
    novalnet_SEPA_TestMode: process.env.NOVALNET_SEPA_TEST_MODE || "0",
    novalnet_GUARANTEED_INVOICE_TestMode: process.env.NOVALNET_GUARANTEED_INVOICE_TEST_MODE || "0",
    novalnet_GUARANTEED_SEPA_TestMode: process.env.NOVALNET_GUARANTEED_SEPA_TEST_MODE || "0",
    novalnet_CREDITCARD_TestMode: process.env.NOVALNET_CREDITCARD_TEST_MODE || "0",
    novalnet_ACH_TestMode: process.env.NOVALNET_ACH_TEST_MODE || "0",
    novalnet_MULTIBANCO_TestMode: process.env.NOVALNET_MULTIBANCO_TEST_MODE || "0",
    novalnet_ALIPAY_TestMode: process.env.NOVALNET_ALIPAY_TEST_MODE || "0",
    novalnet_BANCONTACT_TestMode: process.env.NOVALNET_BANCONTACT_TEST_MODE || "0",
    novalnet_BLIK_TestMode: process.env.NOVALNET_BLIK_TEST_MODE || "0",
    novalnet_EPS_TestMode: process.env.NOVALNET_EPS_TEST_MODE || "0",
    novalnet_MBWAY_TestMode: process.env.NOVALNET_MBWAY_TEST_MODE || "0",
    novalnet_PAYPAL_TestMode: process.env.NOVALNET_PAYPAL_TEST_MODE || "0",
    novalnet_POSTFINANCE_TestMode: process.env.NOVALNET_POSTFINANCE_TEST_MODE || "0",
    novalnet_POSTFINANCE_CARD_TestMode: process.env.NOVALNET_POSTFINANCE_CARD_TEST_MODE || "0",
    novalnet_ONLINE_BANK_TRANSFER_TestMode: process.env.NOVALNET_ONLINE_BANK_TRANSFER_TEST_MODE || "0",
    novalnet_PRZELEWY24_TestMode: process.env.NOVALNET_PRZELEWY24_TEST_MODE || "0",
    novalnet_TRUSTLY_TestMode: process.env.NOVALNET_TRUSTLY_TEST_MODE || "0",
    novalnet_TWINT_TestMode: process.env.NOVALNET_TWINT_TEST_MODE || "0",
    novalnet_WECHATPAY_TestMode: process.env.NOVALNET_WECHATPAY_TEST_MODE || "0",
    novalnet_INVOICE_DueDate: process.env.NOVALNET_INVOICE_DUE_DATE || "0",
    novalnet_PREPAYMENT_DueDate: process.env.NOVALNET_PREPAYMENT_DUE_DATE || "0",
    novalnet_SEPA_DueDate: process.env.NOVALNET_SEPA_DUE_DATE || "0",
    novalnet_INVOICE_PaymentAction: process.env.NOVALNET_INVOICE_PAYMENT_ACTION || "",
    novalnet_PREPAYMENT_PaymentAction: process.env.NOVALNET_PREPAYMENT_PAYMENT_ACTION || "",
    novalnet_SEPA_PaymentAction: process.env.NOVALNET_SEPA_PAYMENT_ACTION || "",
    novalnet_GUARANTEED_INVOICE_PaymentAction: process.env.NOVALNET_GUARANTEED_INVOICE_PAYMENT_ACTION || "",
    novalnet_GUARANTEED_SEPA_PaymentAction: process.env.NOVALNET_GUARANTEED_SEPA_PAYMENT_ACTION || "",
    novalnet_CREDITCARD_PaymentAction: process.env.NOVALNET_CREDITCARD_PAYMENT_ACTION || "",
    novalnet_INVOICE_MinimumAmount: process.env.NOVALNET_INVOICE_PAYMENT_ACTION_MINIMUM_AMOUNT || "0",
    novalnet_PREPAYMENT_MinimumAmount: process.env.NOVALNET_PREPAYMENT_PAYMENT_ACTION_MINIMUM_AMOUNT || "0",
    novalnet_SEPA_MinimumAmount: process.env.NOVALNET_SEPA_PAYMENT_ACTION_MINIMUM_AMOUNT || "0",
    novalnet_GUARANTEED_INVOICE_MinimumAmount: process.env.NOVALNET_GUARANTEED_INVOICE_PAYMENT_ACTION_MINIMUM_AMOUNT ||
        "0",
    novalnet_GUARANTEED_SEPA_MinimumAmount: process.env.NOVALNET_GUARANTEED_SEPA_PAYMENT_ACTION_MINIMUM_AMOUNT || "0",
    novalnet_CREDITCARD_MinimumAmount: process.env.NOVALNET_CREDITCARD_PAYMENT_ACTION_MINIMUM_AMOUNT || "0",
    novalnet_CREDITCARD_Enforce3d: process.env.NOVALNET_CREDITCARD_ENFORCE_3D_SECURE_PAYMENT_OUTSIDE_EU || "",
    novalnet_CREDITCARD_DisplayInline: process.env.NOVALNET_CREDITCARD_DISPLAY_INLINE_CREDITCARD_FORM || "",
    novalnet_GUARANTEED_INVOICE_Allowb2bCustomers: process.env.NOVALNET_GUARANTEED_INVOICE_ALLOW_B2B_CUSTOMERS || "0",
    novalnet_GUARANTEED_INVOICE_ForceNonGuarantee: process.env.NOVALNET_GUARANTEED_INVOICE_FORCE_NON_GUARANTEED_PAYMENT || "0",
    novalnet_GUARANTEED_SEPA_Allowb2bCustomers: process.env.NOVALNET_GUARANTEED_SEPA_ALLOW_B2B_CUSTOMERS || "0",
    novalnet_GUARANTEED_SEPA_ForceNonGuarantee: process.env.NOVALNET_GUARANTEED_SEPA_FORCE_NON_GUARANTEED_PAYMENT || "0",
    // Payment Providers config
    returnurl: process.env.RETURN_URL,
    merchantReturnUrl: process.env.MERCHANT_RETURN_URL || "",
    // TODO review these configurations are maded
    // supportedUIElements: convertStringCommaSeparatedValuesToArray(process.env.SUPPORTED_UI_ELEMENTS),
    // enableStoreDetails: process.env.ENABLE_STORE_DETAILS === 'true' ? true : false,
    // sellerReturnUrl: process.env.SELLER_RETURN_URL || ''
};
// Config loaded successfully
const getConfig = () => {
    return exports.config;
};
exports.getConfig = getConfig;
