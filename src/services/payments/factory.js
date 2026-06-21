/**
 * @fileoverview Payment Provider Factory (Lazy Loading & Config Injection)
 *
 * WHY A FACTORY:
 * The Factory Pattern complements the Adapter Pattern by providing a single,
 * centralized location to determine which payment provider to use.
 *
 * REFACTOR LOGIC:
 * 1. Lazy Loading: Providers are only imported when needed.
 * 2. Config Injection: Factory reads process.env and injects specific config into the provider.
 * 3. Environment Aware: Switches between Dummy and Production providers based on NODE_ENV.
 */

/**
 * Factory for selecting and instantiating the appropriate payment gateway provider.
 */
export const PaymentFactory = {
    /**
     * Cache for the instantiated provider to avoid redundant setup.
     * @type {import('./interface.js').PaymentGatewayInterface|null}
     */
    _instance: null,

    /**
     * Returns the currently configured payment gateway provider instance.
     * Uses lazy loading to import and instantiate the provider on first call.
     *
     * @returns {Promise<import('./interface.js').PaymentGatewayInterface>}
     */
    async getProvider() {
        if (this._instance) return this._instance;

        const providerType = process.env.PAYMENT_PROVIDER || (process.env.NODE_ENV === 'production' ? 'winpay' : 'dummy');

        console.log(`[PaymentFactory] Initializing provider: ${providerType}`);

        let provider;
        switch (providerType) {
            case 'winpay':
                const { WinpayProvider } = await import('./winpay.provider.js');
                provider = new WinpayProvider(this._getWinpayConfig());
                break;

            case 'dummy':
            default:
                const { DummyPaymentProvider } = await import('./dummy.provider.js');
                provider = new DummyPaymentProvider(this._getDummyConfig());
                break;
        }

        this._instance = provider;
        return provider;
    },

    /**
     * Helper to clear the cached instance (useful for testing).
     */
    clearInstance() {
        this._instance = null;
    },

    /**
     * Loads configuration for Winpay from environment variables.
     * @private
     */
    _getWinpayConfig() {
        return {
            partnerId: process.env.WINPAY_PARTNER_ID,
            privateKey: process.env.OUR_PRIVATE_KEY,
            winpayPublicKey: process.env.WINPAY_PUBLIC_KEY,
            baseUrl: process.env.WINPAY_BASE_URL,
        };
    },

    /**
     * Loads configuration for Dummy provider.
     * @private
     */
    _getDummyConfig() {
        return {
            // Dummy provider doesn't strictly need config, but we pass it for consistency
            env: process.env.NODE_ENV,
        };
    },
};
