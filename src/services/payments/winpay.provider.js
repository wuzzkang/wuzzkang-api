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
        // 1. Minify request body with sorted keys (Canonical JSON)
        const sortedPayload = this._sortObject(payload);
        const minifiedBody = JSON.stringify(sortedPayload);

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

        // 1. Minify body with sorted keys
        const sortedPayload = this._sortObject(payload);
        const minifiedBody = JSON.stringify(sortedPayload);

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
     */
    verifyWebhook(payload, signature) {
        return this.verifyCallback(payload, signature, 'POST', '/api/payments/webhook', payload.timestamp || '');
    }

    /**
     * Creates a new payment transaction (VA or QRIS) via Winpay SNAP API.
     *
     * @param {number} amount - The transaction amount.
     * @param {string} userId - The ID of the user.
     * @param {string} orderId - A unique order identifier.
     * @returns {Promise<{ checkoutUrl: string, token: string, vaNumber?: string, qrisString?: string }>}
     */
    async createTransaction(amount, userId, orderId) {
        const url = '/v1.0/transfer-va/create-va';
        const method = 'POST';
        const payload = {
            partnerServiceId: '',
            customerNo: userId.substring(0, 20),
            virtualAccountNo: '',
            virtualAccountName: 'WuzzKang User',
            trxId: orderId,
            totalAmount: {
                value: amount.toFixed(2),
                currency: 'IDR',
            },
            additionalInfo: {
                userId: userId,
            },
        };

        console.log(`[WinpayProvider] Creating transaction for order ${orderId}...`);

        try {
            const headers = this._getHeaders(payload, method, url);
            const response = await fetch(`${this.config.baseUrl}${url}`, {
                method,
                headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP Error ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log(`[WinpayProvider] Response from Winpay:`, JSON.stringify(result));

            if (result.responseCode !== '2000000') {
                throw new Error(`Winpay Error: ${result.responseCode} - ${result.responseMessage}`);
            }

            return {
                checkoutUrl: '',
                token: result.virtualAccountData?.paymentRequestId || orderId,
                vaNumber: result.virtualAccountData?.virtualAccountNo,
            };
        } catch (error) {
            console.error(`[WinpayProvider] createTransaction failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Inquires the status of a transaction from Winpay (Safety Net).
     *
     * @param {string} orderId - The unique order identifier.
     * @returns {Promise<Object>} The transaction status data.
     */
    async inquiryStatus(orderId) {
        const url = '/v1.0/transfer-va/status';
        const method = 'POST';
        const payload = {
            partnerServiceId: '',
            customerNo: '',
            virtualAccountNo: '',
            trxId: orderId,
        };

        console.log(`[WinpayProvider] Inquiring status for order ${orderId}...`);

        try {
            const headers = this._getHeaders(payload, method, url);
            const response = await fetch(`${this.config.baseUrl}${url}`, {
                method,
                headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP Error ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log(`[WinpayProvider] Inquiry result:`, JSON.stringify(result));

            return result;
        } catch (error) {
            console.error(`[WinpayProvider] inquiryStatus failed: ${error.message}`);
            throw error;
        }
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
     * Generates standard SNAP headers for Winpay requests.
     *
     * @param {Object} payload - The request body.
     * @param {string} method - HTTP method.
     * @param {string} url - Endpoint URL.
     * @returns {Object} Headers object.
     * @private
     */
    _getHeaders(payload, method, url) {
        // SNAP standard: ISO 8601 without milliseconds
        const timestamp = new Date().toISOString().split('.')[0] + 'Z';
        const signature = this.generateSignature(payload, method, url, timestamp);

        return {
            'Content-Type': 'application/json',
            'X-PARTNER-ID': this.config.partnerId,
            'X-TIMESTAMP': timestamp,
            'X-SIGNATURE': signature,
            'X-EXTERNAL-ID': crypto.randomUUID(),
            'CHANNEL-ID': 'API',
        };
    }

    /**
     * Recursively sorts object keys for canonical JSON representation.
     * 
     * @param {any} obj - The object or value to sort.
     * @returns {any} Sorted object or value.
     * @private
     */
    _sortObject(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map((item) => this._sortObject(item));
        }

        const sortedKeys = Object.keys(obj).sort();
        const result = {};

        for (const key of sortedKeys) {
            result[key] = this._sortObject(obj[key]);
        }

        return result;
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
