/**
 * @fileoverview Dummy Payment Provider (for Local Development & CI)
 *
 * WHY THIS EXISTS:
 * Per the Adapter Pattern, we ALWAYS implement a DummyProvider before connecting
 * to a real payment SDK. This allows:
 * - Full local testing without external dependencies.
 * - CI pipelines to run without needing real API credentials.
 * - Safe load testing without triggering real financial transactions.
 *
 * When ready for production, create a `WinpayProvider` (or other) that extends
 * `PaymentGatewayInterface`, registers its env config in `PaymentFactory`, and
 * gets swapped in automatically when `NODE_ENV === 'production'`.
 */

import { PaymentGatewayInterface } from './interface.js';
import { walletService } from '../wallet.service.js';

/**
 * Dummy payment provider for local development and testing.
 * Simulates the full payment lifecycle without real API calls.
 *
 * @extends {PaymentGatewayInterface}
 */
export class DummyPaymentProvider extends PaymentGatewayInterface {
    /**
     * @param {Object} [config={}] - Optional config injected by PaymentFactory.
     *                               Not used by the dummy provider itself, but
     *                               accepted to fulfil the standard constructor contract.
     */
    constructor(config = {}) {
        super(config);
    }

    /**
     * Simulates creating a payment transaction.
     *
     * @param {number} amount  - The amount (e.g., in IDR).
     * @param {string} userId  - The ID of the user.
     * @param {string} orderId - A unique order identifier.
     * @returns {Promise<{ checkoutUrl: string, token: string }>}
     */
    async createTransaction(amount, userId, orderId) {
        const mockToken = `dummy-token-${orderId}-${Date.now()}`;
        const checkoutUrl = `/mock-checkout?token=${mockToken}`;

        console.log('[DummyPaymentProvider] Simulating transaction creation:', {
            orderId, userId, amount, checkoutUrl,
        });

        return { checkoutUrl, token: mockToken };
    }

    /**
     * Simulates webhook signature verification.
     * Always returns `true` — no crypto operations performed.
     *
     * @param {Object} payload   - Webhook payload.
     * @param {string} signature - Signature header value.
     * @returns {boolean} Always `true`.
     */
    verifyWebhook(payload, signature) {
        console.log('[DummyPaymentProvider] Simulating webhook verification (always passes).');
        return true;
    }

    /**
     * Simulates provider callback signature verification.
     * Always returns `true` — no crypto operations performed.
     *
     * Real implementation (WinpayProvider) will verify RSA-SHA256
     * using `WINPAY_PUBLIC_KEY` from this.config.
     *
     * @param {Object} payload   - Callback payload.
     * @param {string} signature - Provider's signature.
     * @returns {boolean} Always `true`.
     */
    verifyCallback(payload, signature) {
        console.log('[DummyPaymentProvider] Simulating callback verification (always passes).');
        return true;
    }

    /**
     * Processes a verified webhook by crediting the user's wallet.
     *
     * @param {Object} payload          - Verified webhook payload.
     * @param {string} payload.userId   - User to credit.
     * @param {number} payload.amount   - Amount to credit.
     * @param {string} payload.orderId  - Order ID (for audit log).
     * @returns {Promise<void>}
     */
    async processWebhook(payload) {
        const { userId, amount, orderId } = payload;

        console.log(
            `[DummyPaymentProvider] Processing successful payment for order ${orderId}.` +
            ` Crediting ${amount} to user ${userId}.`
        );

        await walletService.addTransaction(
            userId,
            amount,
            'topup',
            `Top-up via Dummy Provider. Order ID: ${orderId}`
        );

        console.log(`[DummyPaymentProvider] Wallet credited successfully for user ${userId}.`);
    }

    /**
     * Returns the success ACK response for the Dummy Provider.
     *
     * @param {Object} payload - The processed webhook payload.
     * @returns {{ status: string, message: string }}
     */
    getSuccessResponse(payload) {
        return {
            status: 'success',
            message: 'Webhook received',
        };
    }
}
