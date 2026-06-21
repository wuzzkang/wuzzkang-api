/**
 * @fileoverview Payment Webhook Controller
 *
 * This controller handles all inbound webhook calls from a payment gateway.
 * It is intentionally PROVIDER-AGNOSTIC: it only interacts with the
 * `PaymentGatewayInterface` via the `PaymentFactory`, never with a
 * concrete SDK like Midtrans or Xendit directly.
 *
 * This design means swapping payment providers requires ZERO changes here.
 */

import { PaymentFactory } from '../services/payments/factory.js';

/**
 * Handles an inbound payment gateway webhook.
 *
 * Flow:
 * 1. Get the active payment provider from the factory.
 * 2. Verify the webhook signature for authenticity.
 * 3. Process the webhook (e.g., credit user wallet).
 * 4. Return the provider-specific success response.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function handleWebhook(req, res) {
    // Step 1: Obtain the currently configured provider via the Factory.
    // We never import DummyPaymentProvider (or any real provider) directly here.
    const provider = await PaymentFactory.getProvider();

    const payload = req.body;

    // The signature header name varies by provider (e.g., 'x-callback-token' for Xendit,
    // 'x-midtrans-signature-key' for Midtrans). We use a generic fallback here.
    const signature = req.headers['x-signature'] ?? '';

    // Step 2: Verify the webhook signature.
    // This is a critical security check to ensure the request originates
    // from the legitimate payment gateway and not a malicious actor.
    const isValid = provider.verifyWebhook(payload, signature);

    if (!isValid) {
        console.warn('[PaymentController] Invalid webhook signature received.');
        return res.status(400).send('Invalid Signature');
    }

    // Step 3: Process the webhook (e.g., topup user wallet).
    try {
        await provider.processWebhook(payload);

        // Step 4: Return the provider-specific success response.
        // WHY `getSuccessResponse()`:
        // Each payment gateway expects a DIFFERENT acknowledgement format.
        // By asking the provider to define its own success response, this
        // controller remains completely generic — no provider-specific
        // `if/else` blocks needed here now or in the future.
        const successResponse = provider.getSuccessResponse(payload);
        return res.status(200).json(successResponse);

    } catch (error) {
        console.error(`[PaymentController] Error processing webhook: ${error.message}`);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
