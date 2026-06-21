/**
 * @fileoverview Dummy Payment Provider (for Local Testing & CI)
 *
 * WHY THIS EXISTS:
 * Per the Adapter Pattern, we ALWAYS implement a DummyProvider before connecting
 * to a real payment SDK (Midtrans, Xendit). This allows:
 * - Full local testing without external dependencies.
 * - CI pipelines to run without needing real API credentials.
 * - Safe load testing without triggering real financial transactions.
 *
 * When ready for production, create a `MidtransProvider` or `XenditProvider`
 * that extend `PaymentGatewayInterface` and swap it in `PaymentFactory`.
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
     * Simulates creating a payment transaction.
     *
     * @param {number} amount - The amount in the smallest currency unit.
     * @param {string} userId - The ID of the user.
     * @param {string} orderId - A unique order identifier.
     * @returns {Promise<{ checkoutUrl: string, token: string }>} Simulated checkout details.
     */
    async createTransaction(amount, userId, orderId) {
        const mockToken = `dummy-token-${orderId}-${Date.now()}`;
        const checkoutUrl = `/mock-checkout?token=${mockToken}`;

        console.log(
            `[DummyPaymentProvider] Simulating transaction creation:`,
            { orderId, userId, amount, checkoutUrl }
        );

        return {
            checkoutUrl,
            token: mockToken,
        };
    }

    /**
     * Simulates webhook signature verification.
     * In a real provider (e.g., Midtrans), this would compute an HMAC-SHA512
     * hash and compare it against the provider's signature header.
     *
     * @param {Object} payload - The webhook payload.
     * @param {string} signature - The signature from the request header.
     * @returns {boolean} Always returns true in dummy mode.
     */
    verifyWebhook(payload, signature) {
        console.log(`[DummyPaymentProvider] Simulating webhook verification (always passes).`);
        return true;
    }

    /**
     * Processes a verified webhook by crediting the user's wallet.
     * Expects `payload.userId` and `payload.amount`.
     *
     * @param {Object} payload - The verified webhook payload.
     * @param {string} payload.userId - The ID of the user to credit.
     * @param {number} payload.amount - The amount to credit.
     * @param {string} payload.orderId - The order ID (for logging).
     * @returns {Promise<void>}
     */
    async processWebhook(payload) {
        const { userId, amount, orderId } = payload;

        console.log(
            `[DummyPaymentProvider] Processing successful payment for order ${orderId}. Crediting ${amount} to user ${userId}.`
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
     * Returns the success response payload for the Dummy Provider.
     * Simulates a simple 200 OK acknowledgement back to the payment gateway.
     *
     * @param {Object} payload - The processed webhook payload.
     * @returns {{ status: string, message: string }} Standard success ACK.
     */
    getSuccessResponse(payload) {
        return {
            status: 'success',
            message: 'Webhook received',
        };
    }
}
