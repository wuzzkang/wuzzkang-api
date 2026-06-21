/**
 * @fileoverview Winpay Payment Provider (Production-Grade RSA Integration)
 *
 * This provider implements the Winpay API specification, specifically focusing on:
 * 1. RSA-SHA256 Digital Signatures for request integrity.
 * 2. RSA-SHA256 Verification for inbound callbacks and webhooks.
 *
 * SECURITY STANDARDS:
 * - Uses Node.js native `crypto` module.
 * - Sanitizes PEM keys from environment variables.
 * - Implements the precise signature formula: Method:URL:Hash(Body):Timestamp.
 */

import crypto from 'crypto';
import { PaymentGatewayInterface } from './interface.js';
import { walletService } from '../wallet.service.js';

/**
 * Winpay payment provider implementation.
 *
 * @extends {PaymentGatewayInterface}
 */
export class WinpayProvider extends PaymentGatewayInterface {
    /**
     * @param {Object} config - Configuration injected by PaymentFactory.
     * @param {string} config.partnerId - Winpay Partner ID.
     * @param {string} config.privateKey - Our RSA Private Key (PEM).
     * @param {string} config.winpayPublicKey - Winpay RSA Public Key (PEM).
     * @param {string} config.baseUrl - Winpay API Base URL.
     */
    constructor(config) {
        super(config);

        // Sanitize keys to ensure multi-line PEM format is correctly interpreted by Node.js crypto
        this.privateKey = this._sanitizeKey(config.privateKey);
        this.winpayPublicKey = this._sanitizeKey(config.winpayPublicKey);
    }

    /**
     * Generates a digital signature for a Winpay request.
     * 
     * Formula: 
     * stringToSign = HTTPMethod + ":" + EndpointUrl + ":" + Lowercase(HexEncode(SHA-256(MinifiedRequestBody))) + ":" + TimeStamp
     *
     * @param {Object} payload - The request body object.
     * @param {string} method - HTTP method (e.g., 'POST').
     * @param {string} url - The endpoint URL (e.g., '/v1.0/qr/qr-mpm-generate').
     * @param {string} timestamp - ISO8601 timestamp.
     * @returns {string} Base64 encoded RSA-SHA256 signature.
     */
    generateSignature(payload, method, url, timestamp) {
        // 1. Minify request body
        const minifiedBody = JSON.stringify(payload);

        // 2. SHA-256 Hash of the body (Hex encoded, lowercase)
        const bodyHash = crypto
            .createHash('sha256')
            .update(minifiedBody)
            .digest('hex')
            .toLowerCase();

        // 3. Construct String to Sign
        const stringToSign = `${method}:${url}:${bodyHash}:${timestamp}`;

        // 4. Sign using RSA-SHA256
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(stringToSign);

        // 5. Return Base64 encoded signature
        return signer.sign(this.privateKey, 'base64');
    }

    /**
     * Verifies the signature of an inbound callback from Winpay.
     *
     * @param {Object} payload - The callback payload.
     * @param {string} signature - The signature from Winpay.
     * @param {string} method - HTTP method of the callback.
     * @param {string} url - The callback URL.
     * @param {string} timestamp - The timestamp from Winpay headers.
     * @returns {boolean} True if signature is valid.
     */
    verifyCallback(payload, signature, method, url, timestamp) {
        if (!signature) return false;

        // 1. Minify body
        const minifiedBody = JSON.stringify(payload);

        // 2. SHA-256 Hash
        const bodyHash = crypto
            .createHash('sha256')
            .update(minifiedBody)
            .digest('hex')
            .toLowerCase();

        // 3. Construct String to Verify
        const stringToVerify = `${method}:${url}:${bodyHash}:${timestamp}`;

        // 4. Verify using Winpay's Public Key
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(stringToVerify);

        return verifier.verify(this.winpayPublicKey, signature, 'base64');
    }

    /**
     * Verifies a webhook signature.
     * (Implementation depends on Winpay's specific webhook signature strategy)
     */
    verifyWebhook(payload, signature) {
        // For now, we use the same RSA logic as callback if applicable,
        // or a simplified version if webhooks use a different strategy.
        // Placeholder for specific webhook logic.
        return this.verifyCallback(payload, signature, 'POST', '/api/payments/webhook', payload.timestamp || '');
    }

    /**
     * Creates a transaction (VA/QRIS) via Winpay API.
     * (To be implemented in Task 6.3)
     */
    async createTransaction(amount, userId, orderId) {
        throw new Error('Method not yet implemented. Coming in Task 6.3.');
    }

    /**
     * Processes a verified webhook.
     */
    async processWebhook(payload) {
        const { userId, amount, orderId } = payload;
        await walletService.addTransaction(userId, amount, 'topup', `Top-up via Winpay. Order ID: ${orderId}`, orderId);
    }

    /**
     * Returns success ACK for Winpay.
     */
    getSuccessResponse(payload) {
        return {
            responseCode: '2000000',
            responseMessage: 'Successful',
        };
    }

    /**
     * Sanitizes PEM key by replacing literal \n with actual newlines.
     * @private
     */
    _sanitizeKey(key) {
        if (!key) return '';
        return key.replace(/\\n/g, '\n');
    }
}
