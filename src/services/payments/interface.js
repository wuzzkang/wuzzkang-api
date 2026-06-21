/**
 * @fileoverview Payment Gateway Interface (Adapter Pattern)
 *
 * PURPOSE OF THIS PATTERN:
 * We use the Adapter Pattern to decouple our business logic from any specific
 * payment provider (Winpay, Midtrans, Xendit, etc.).
 *
 * This means:
 * - Our controllers/services call a CONSISTENT interface, never a specific vendor SDK.
 * - Swapping payment providers requires ZERO changes to business logic.
 * - Testing is trivial: just use DummyPaymentProvider instead of a real provider.
 *
 * HOW TO ADD A NEW PROVIDER:
 * 1. Create a new class that extends `PaymentGatewayInterface`.
 * 2. Accept a `config` object in the constructor.
 * 3. Implement all abstract methods.
 * 4. Register it in `PaymentFactory.PROVIDERS` and add its env config loader.
 */

/**
 * Abstract base class for payment gateway adapters.
 * All real and mock payment providers MUST extend this class and implement
 * all methods defined here.
 *
 * @abstract
 */
export class PaymentGatewayInterface {
    /**
     * @param {Object} config - Provider-specific configuration (API keys, URLs, etc.)
     *                          Injected by `PaymentFactory` from `process.env`.
     */
    constructor(config = {}) {
        this.config = config;
    }

    /**
     * Creates a new payment transaction and returns a checkout URL.
     *
     * @param {number} amount - The transaction amount (e.g., in IDR / cents).
     * @param {string} userId - The ID of the user initiating the payment.
     * @param {string} orderId - A unique order identifier for this transaction.
     * @returns {Promise<{ checkoutUrl: string, token: string }>} Checkout URL and transaction token.
     * @throws {Error} Method not implemented.
     */
    async createTransaction(amount, userId, orderId) {
        throw new Error(`Method 'createTransaction' not implemented by ${this.constructor.name}.`);
    }

    /**
     * Verifies the authenticity of an incoming webhook payload using a provider-specific
     * signature strategy.
     *
     * - `DummyProvider`:  Always returns `true` (no-op for local testing).
     * - `WinpayProvider`: Verifies RSA-SHA256 signature using `WINPAY_PUBLIC_KEY`.
     *
     * @param {Object} payload   - The raw webhook payload object from the request body.
     * @param {string} signature - The signature from the request header (e.g., `x-signature`).
     * @returns {boolean} `true` if the signature is valid, `false` otherwise.
     * @throws {Error} Method not implemented.
     */
    verifyWebhook(payload, signature) {
        throw new Error(`Method 'verifyWebhook' not implemented by ${this.constructor.name}.`);
    }

    /**
     * Verifies an inbound callback from the provider after a payment event.
     * Distinct from `verifyWebhook` in that this is for provider-initiated async
     * callbacks (e.g., payment status updates from Winpay).
     *
     * - `DummyProvider`:  Always returns `true`.
     * - `WinpayProvider`: Verifies RSA-SHA256 signature using `WINPAY_PUBLIC_KEY`.
     *
     * @param {Object} payload   - The callback payload object.
     * @param {string} signature - The provider's signature (from request header or body field).
     * @returns {boolean} `true` if the callback is authentic, `false` otherwise.
     * @throws {Error} Method not implemented.
     */
    verifyCallback(payload, signature) {
        throw new Error(`Method 'verifyCallback' not implemented by ${this.constructor.name}.`);
    }

    /**
     * Processes a verified webhook payload and fulfills the associated business action
     * (e.g., crediting a user's wallet on successful payment).
     *
     * @param {Object} payload - The verified webhook payload object.
     * @returns {Promise<void>}
     * @throws {Error} Method not implemented.
     */
    async processWebhook(payload) {
        throw new Error(`Method 'processWebhook' not implemented by ${this.constructor.name}.`);
    }

    /**
     * Returns the success response payload to send back to the payment gateway
     * after a webhook has been successfully processed.
     *
     * WHY THIS METHOD:
     * Different payment gateways expect DIFFERENT response formats for webhook ACKs.
     * - Winpay expects `{ status: 'OK' }`.
     * - Midtrans expects `{ status: '200' }`.
     * - Xendit expects an empty 200, or `{ success: true }`.
     * - DummyProvider can return anything for testing.
     * By delegating this to the provider, the controller stays 100% generic
     * and requires no provider-specific `if/else` logic.
     *
     * @param {Object} payload - The processed webhook payload.
     * @returns {Object} The JSON object to send back to the payment gateway.
     * @throws {Error} Method not implemented.
     */
    getSuccessResponse(payload) {
        throw new Error(`Method 'getSuccessResponse' not implemented by ${this.constructor.name}.`);
    }
}
