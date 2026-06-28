/**
 * @fileoverview Winpay Payment Provider (Clean Architecture Refactor)
 *
 * This provider implements the Winpay API specification.
 * Business logic is kept here, while utility and crypto functions are moved to src/utils/.
 */

import crypto from 'crypto';
import { PaymentGatewayInterface } from './interface.js';
import { generateTimestamp, sortObject } from '../../utils/helpers.js';
import { sanitizeKey, loadPrivateKey, loadPublicKey, generateSnapSignature, verifySnapSignature } from '../../utils/crypto.utils.js';

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

        // Winpay Public Key for callback verification: Load from file
        try {
            this.winpayPublicKey = loadPublicKey('winpay_public_key.pem');
        } catch (error) {
            console.warn(`[WinpayProvider] Failed to load winpay_public_key.pem, falling back to config: ${error.message}`);
            this.winpayPublicKey = sanitizeKey(config.winpayPublicKey);
        }
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
    verifyCallback(payload, signature, method, url, timestamp, rawBody = null) {
        console.log('[WinpayProvider] verifyCallback called with:', {
            method,
            url,
            timestamp,
            signaturePreview: signature ? signature.substring(0, 40) + '...' : 'MISSING',
            rawBodyAvailable: !!rawBody,
            rawBodyPreview: rawBody ? rawBody.substring(0, 100) : null,
        });

        this.lastVerificationError = null;

        if (!signature) {
            console.error('[WinpayProvider] Signature is missing in headers.');
            this.lastVerificationError = { message: 'Signature is missing in headers.' };
            return false;
        }

        // Prepare extensive list of candidate paths
        const pathsSet = new Set([url, url.split('?')[0]]);

        // Add official Winpay SNAP payment callback path (from documentation)
        pathsSet.add('/v1.0/transfer-va/payment');

        // Extract SNAP path portion (starts with /v1.0/) from url parameter
        const snapPathMatch = url.match(/\/v1\.0\/.*/);
        if (snapPathMatch) {
            pathsSet.add(snapPathMatch[0]);
            pathsSet.add(snapPathMatch[0].split('?')[0]);
        }

        // Add relative paths without /api prefix
        if (url.startsWith('/api')) {
            const relativePath = url.substring(4);
            pathsSet.add(relativePath);
            pathsSet.add(relativePath.split('?')[0]);

            // Also try relative SNAP path
            const relativeSnapMatch = relativePath.match(/\/v1\.0\/.*/);
            if (relativeSnapMatch) {
                pathsSet.add(relativeSnapMatch[0]);
            }
        }

        const paths = Array.from(pathsSet).filter(p => p);

        // Prepare candidate bodies
        const bodies = [];

        // Prioritas 1: raw body persis seperti yang diterima (paling akurat)
        // Winpay hanya melakukan minify, tidak sorting — raw body adalah kandidat terbaik
        if (rawBody) {
            bodies.push({ name: 'Raw Body As-Is', val: rawBody });
            bodies.push({ name: 'Raw Body Stripped Whitespace', val: rawBody.replace(/\s+/g, '') });
        }

        // Prioritas 2: JSON.stringify biasa tanpa sorting (sesuai docs Winpay)
        bodies.push({ name: 'Minified JSON.stringify', val: JSON.stringify(payload) });

        // Prioritas 3: sorted — hanya sebagai fallback terakhir
        bodies.push({ name: 'Sorted Minified', val: JSON.stringify(sortObject(payload)) });

        console.log(`[WinpayProvider] Signature verification attempt for ${method} ${url}.`);
        console.log(` - Loaded Public Key Content:\n${this.winpayPublicKey || '(empty)'}`);
        console.log(` - Received Signature: "${signature ? signature.substring(0, 30) + '...' : 'empty'}"`);

        // Try verifying all combinations of paths and bodies
        for (const pathCandidate of paths) {
            for (const bodyCandidate of bodies) {
                const bodyHash = crypto
                    .createHash('sha256')
                    .update(bodyCandidate.val)
                    .digest('hex')
                    .toLowerCase(); // WAJIB lowercase sesuai dokumentasi Winpay

                const stringToSign = `${method}:${pathCandidate}:${bodyHash}:${timestamp}`;
                
                console.log(` -> Candidate Path: "${pathCandidate}" | Body: "${bodyCandidate.name}"`);
                console.log(`    └─ stringToSign: "${stringToSign}"`);
                console.log(`    └─ bodyHash: "${bodyHash}"`);

                try {
                    const verifier = crypto.createVerify('RSA-SHA256');
                    verifier.update(stringToSign);
                    const isValid = verifier.verify(this.winpayPublicKey, signature, 'base64');

                    if (isValid) {
                        console.log(`[WinpayProvider] ✅ Signature VALID`);
                        console.log(` - Path: "${pathCandidate}"`);
                        console.log(` - Body type: "${bodyCandidate.name}"`);
                        console.log(` - stringToSign: "${stringToSign}"`);
                        return true;
                    }
                } catch (err) {
                    console.error(`[WinpayProvider] Error verifying combination:`, err.message);
                }
            }
        }

        // If we reached here, all combinations failed. Print details for debugging.
        console.error(`[WinpayProvider] All signature combinations failed for ${method} ${url}`);
        
        this.lastVerificationError = {
            message: 'All signature combinations failed validation.',
            timestamp,
            checkedPaths: paths,
            checkedBodies: bodies.map(b => {
                const hash = crypto.createHash('sha256').update(b.val).digest('hex').toLowerCase();
                return {
                    name: b.name,
                    hash,
                    bodyPreview: b.val.substring(0, 150)
                };
            }),
            senderSignature: signature
        };

        return false;
    }

    /**
     * Verifies a webhook signature.
     */
    verifyWebhook(payload, signature, method = 'POST', url = '/api/payments/webhook', timestamp = '', rawBody = null) {
        if (process.env.BYPASS_PAYMENT_SIGNATURE === 'true') {
            console.warn('[WinpayProvider] ⚠️ WARNING: Bypassing signature verification because BYPASS_PAYMENT_SIGNATURE=true in .env');
            return true;
        }
        return this.verifyCallback(payload, signature, method, url, timestamp, rawBody);
    }

    /**
     * Creates a new payment transaction (VA) via Winpay SNAP API.
     *
     * @param {number} amount - The transaction amount.
     * @param {string} customerNo - The ID of the user/customer.
     * @param {string} orderId - A unique order identifier.
     * @returns {Promise<{ checkoutUrl: string, token: string, vaNumber?: string }>}
     */
    async createTransaction(amount, customerNo, orderId, channel = 'CIMB') {
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
                channel: channel
            }
        };

        try {
            const sortedPayload = sortObject(payload);
            const minifiedBody = JSON.stringify(sortedPayload);
            const headers = this._getHeaders(minifiedBody, method, url);

            console.log('[WinpayProvider] Outgoing request to Winpay:', {
                url: `${this.config.baseUrl}${url}`,
                headers: {
                    ...headers,
                    // Redact signature in log if too long, or print it
                    'X-SIGNATURE': headers['X-SIGNATURE'] ? `${headers['X-SIGNATURE'].substring(0, 20)}...` : undefined
                },
                payload
            });

            const response = await fetch(`${this.config.baseUrl}${url}`, {
                method,
                headers,
                body: minifiedBody,
            });

            console.log(`[WinpayProvider] Received response from Winpay: Status ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[WinpayProvider] Winpay response error content:`, errorText);
                throw new Error(`HTTP Error ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log(`[WinpayProvider] Winpay response JSON:`, JSON.stringify(result, null, 2));

            if (!result.responseCode || !result.responseCode.startsWith('200')) {
                throw new Error(`Winpay Error: ${result.responseCode || 'Unknown Code'} - ${result.responseMessage || 'No message'}`);
            }

            return {
                checkoutUrl: '',
                token: result.virtualAccountData?.paymentRequestId || orderId,
                vaNumber: result.virtualAccountData?.virtualAccountNo ? String(result.virtualAccountData.virtualAccountNo).trim() : undefined,
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

            console.log(`[WinpayProvider] Inquiry Status Response Status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[WinpayProvider] Inquiry Status Error content:`, errorText);
                throw new Error(`HTTP Error ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log(`[WinpayProvider] Inquiry Status Response JSON:`, JSON.stringify(result, null, 2));
            return result;
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
            responseCode: '2002500',
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
