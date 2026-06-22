/**
 * @fileoverview Winpay Payment Provider (Clean Architecture Refactor)
 *
 * This provider implements the Winpay API specification.
 * Business logic is kept here, while utility and crypto functions are moved to src/utils/.
 */

import crypto from 'crypto';
import { PaymentGatewayInterface } from './interface.js';
import { generateTimestamp, sortObject } from '../../utils/helpers.js';
import { sanitizeKey, loadPrivateKey, generateSnapSignature, verifySnapSignature } from '../../utils/crypto.utils.js';

/**
 * Winpay payment provider implementation.
 *
 * @extends {PaymentGatewayInterface}
 */
export class WinpayProvider extends PaymentGatewayInterface {
    /**
     * @param {Object} config - Configuration injected by PaymentFactory.
     * @param {string} config.partnerId - Winpay Partner ID.
     * @param {string} config.baseUrl - Winpay API Base URL.
     * @param {string} config.winpayPublicKey - Winpay RSA Public Key (PEM).
     */
    constructor(config) {
        super(config);

        // Private Key Loading: Moved to utility
        this.privateKey = loadPrivateKey('our_winpay_private.pem');

        // Winpay Public Key for callback verification
        this.winpayPublicKey = sanitizeKey(config.winpayPublicKey);
    }

    /**
     * Generates a digital signature for a Winpay request.
     */
    generateSignature(minifiedBody, method, url, timestamp) {
        return generateSnapSignature(this.privateKey, minifiedBody, method, url, timestamp);
    }

    /**
     * Verifies the signature of an inbound callback from Winpay.
     */
    verifyCallback(payload, signature, method, url, timestamp) {
        if (!signature) return false;

        const sortedPayload = sortObject(payload);
        const minifiedBody = JSON.stringify(sortedPayload);

        return verifySnapSignature(this.winpayPublicKey, minifiedBody, signature, method, url, timestamp);
    }

    /**
     * Verifies a webhook signature.
     */
    verifyWebhook(payload, signature) {
        return this.verifyCallback(payload, signature, 'POST', '/api/payments/webhook', payload.timestamp || '');
    }

    /**
     * Creates a new payment transaction (VA) via Winpay SNAP API.
     *
     * @param {number} amount - The transaction amount.
     * @param {string} customerNo - The ID of the user/customer.
     * @param {string} orderId - A unique order identifier.
     * @returns {Promise<{ checkoutUrl: string, token: string, vaNumber?: string }>}
     */
    async createTransaction(amount, customerNo, orderId) {
        const url = '/v1.0/transfer-va/create-va';
        const method = 'POST';

        const payload = {
            customerNo: String(customerNo),
            virtualAccountName: "Gajah Mada",
            trxId: orderId,
            totalAmount: {
                value: amount.toFixed(2),
                currency: "IDR"
            },
            virtualAccountTrxType: "c",
            expiredDate: generateTimestamp(25),
            additionalInfo: {
                channel: "CIMB"
            }
        };

        try {
            const sortedPayload = sortObject(payload);
            const minifiedBody = JSON.stringify(sortedPayload);
            const headers = this._getHeaders(minifiedBody, method, url);

            const response = await fetch(`${this.config.baseUrl}${url}`, {
                method,
                headers,
                body: minifiedBody,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP Error ${response.status}: ${errorText}`);
            }

            const result = await response.json();

            if (!result.responseCode.startsWith('200')) {
                throw new Error(`Winpay Error: ${result.responseCode} - ${result.responseMessage}`);
            }

            return {
                checkoutUrl: '',
                token: result.virtualAccountData?.paymentRequestId || orderId,
                vaNumber: result.virtualAccountData?.virtualAccountNo,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Inquires the status of a transaction from Winpay.
     */
    async inquiryStatus(orderId) {
        const url = '/v1.0/transfer-va/status';
        const method = 'POST';
        const payload = {
            trxId: orderId,
        };

        try {
            const sortedPayload = sortObject(payload);
            const minifiedBody = JSON.stringify(sortedPayload);
            const headers = this._getHeaders(minifiedBody, method, url);

            const response = await fetch(`${this.config.baseUrl}${url}`, {
                method,
                headers,
                body: minifiedBody,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP Error ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Processes a verified webhook.
     */
    async processWebhook(payload) {
        const { walletService } = await import('../wallet.service.js');
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
     * @private
     */
    _getHeaders(minifiedBody, method, url) {
        const timestamp = generateTimestamp();
        const signature = this.generateSignature(minifiedBody, method, url, timestamp);

        return {
            'Content-Type': 'application/json',
            'X-PARTNER-ID': this.config.partnerId,
            'X-TIMESTAMP': timestamp,
            'X-SIGNATURE': signature,
            'X-EXTERNAL-ID': crypto.randomUUID(),
            'CHANNEL-ID': 'WEB',
        };
    }
}
