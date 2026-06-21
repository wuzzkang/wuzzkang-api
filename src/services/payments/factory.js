/**
 * @fileoverview Payment Provider Factory
 *
 * WHY A FACTORY:
 * The Factory Pattern complements the Adapter Pattern by providing a single,
 * centralized location to determine which payment provider to use.
 * Controllers and routes only ever call `PaymentFactory.getProvider()` —
 * they have zero knowledge of which concrete class is being used.
 *
 * TO SWITCH PROVIDERS IN PRODUCTION:
 * 1. Create your new provider (e.g., `MidtransProvider`) extending `PaymentGatewayInterface`.
 * 2. Import it here.
 * 3. Update the `getProvider()` return value. No other file needs to change.
 */

import { DummyPaymentProvider } from './dummy.provider.js';

/**
 * Factory for selecting and instantiating the appropriate payment gateway provider.
 */
export const PaymentFactory = {
    /**
     * Returns the currently configured payment gateway provider instance.
     *
     * @returns {import('./interface.js').PaymentGatewayInterface} An instance of the active payment provider.
     */
    getProvider() {
        // TODO: In production, check `process.env.PAYMENT_PROVIDER` and
        // return the corresponding adapter (e.g., MidtransProvider).
        // Example:
        //   if (process.env.PAYMENT_PROVIDER === 'midtrans') return new MidtransProvider();
        //   if (process.env.PAYMENT_PROVIDER === 'xendit') return new XenditProvider();

        return new DummyPaymentProvider();
    },
};
