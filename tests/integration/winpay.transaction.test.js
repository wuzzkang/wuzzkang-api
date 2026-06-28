import crypto from 'crypto';
import fs from 'fs';
import { jest } from '@jest/globals';

// Mock walletService before importing anything that might use it
jest.unstable_mockModule('../../src/services/wallet.service.js', () => ({
    walletService: {
        addTransaction: jest.fn(),
    },
}));

const { PaymentFactory } = await import('../../src/services/payments/factory.js');
const { WinpayProvider } = await import('../../src/services/payments/winpay.provider.js');

describe('WinpayProvider Integration Test — createTransaction', () => {
    const originalEnv = process.env;
    let winpayProvider;

    // Generate real RSA keys for testing to avoid "DECODER routines::unsupported"
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    beforeAll(async () => {
        process.env = {
            ...originalEnv,
            NODE_ENV: 'production',
            PAYMENT_PROVIDER: 'winpay',
            WINPAY_PARTNER_ID: 'PARTNER-123',
            WINPAY_PUBLIC_KEY: publicKey,
            WINPAY_BASE_URL: 'https://api.winpay.id',
        };

        // Mock fs.readFileSync to return our test private key
        jest.spyOn(fs, 'readFileSync').mockReturnValue(privateKey);

        PaymentFactory.clearInstance();
        winpayProvider = await PaymentFactory.getProvider();
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    beforeEach(() => {
        if (typeof global.fetch === 'undefined') {
            global.fetch = jest.fn();
        } else {
            jest.spyOn(global, 'fetch').mockClear();
        }
        // Mock console.log to capture stringToSign and signature
        jest.spyOn(console, 'log').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should successfully generate a Virtual Account', async () => {
        const mockResponse = {
            responseCode: '2000000',
            responseMessage: 'Successful',
            virtualAccountData: {
                virtualAccountNo: '1234567890',
                paymentRequestId: 'req-abc-123',
            },
        };

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        // Capture stringToSign and signature by wrapping generateSignature
        const originalGenerateSignature = winpayProvider.generateSignature.bind(winpayProvider);
        const generateSignatureSpy = jest.spyOn(winpayProvider, 'generateSignature').mockImplementation((minifiedBody, method, url, timestamp) => {
            const bodyHash = crypto.createHash('sha256').update(minifiedBody).digest('hex').toLowerCase();
            const stringToSign = `${method}:${url}:${bodyHash}:${timestamp}`;

            // We use the real implementation but log the intermediate values
            const signature = originalGenerateSignature(minifiedBody, method, url, timestamp);

            process.stdout.write(`\n[DEBUG] stringToSign: ${stringToSign}\n`);
            process.stdout.write(`[DEBUG] signature: ${signature}\n\n`);

            return signature;
        });

        const result = await winpayProvider.createTransaction(50000, 'user-123', 'order-456');

        expect(result.vaNumber).toBe('1234567890');
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/v1.0/transfer-va/create-va'),
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'X-PARTNER-ID': winpayProvider.config.partnerId,
                    'X-SIGNATURE': expect.any(String),
                    'X-TIMESTAMP': expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/),
                    'CHANNEL-ID': 'WEB',
                }),
            })
        );
    });

    test('should throw error when Winpay returns non-2000000 code', async () => {
        const mockErrorResponse = {
            responseCode: '4010001',
            responseMessage: 'Unauthorized',
        };

        global.fetch = jest.fn().mockResolvedValue({
            ok: true, // API returned 200 but with error code in body
            json: async () => mockErrorResponse,
        });

        await expect(winpayProvider.createTransaction(50000, 'user-123', 'order-456'))
            .rejects.toThrow('Winpay Error: 4010001 - Unauthorized');
    });

    test('should throw error when fetch fails (HTTP Error)', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error',
        });

        await expect(winpayProvider.createTransaction(50000, 'user-123', 'order-456'))
            .rejects.toThrow('HTTP Error 500: Internal Server Error');
    });

    describe('verifyCallback / verifyWebhook', () => {
        const testPayload = {
            trxId: 'order-123',
            amount: 50000,
            status: 'SUCCESS',
        };
        const testRawBody = JSON.stringify(testPayload);
        const testTimestamp = '2026-06-28T21:00:00+07:00';
        const testUrl = '/api/payments/webhook';
        const testMethod = 'POST';

        // Helper to generate a valid signature for verification
        const generateTestSignature = (bodyStr, method, path, timestamp) => {
            const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('hex').toLowerCase();
            const stringToSign = `${method}:${path}:${bodyHash}:${timestamp}`;
            const signer = crypto.createSign('RSA-SHA256');
            signer.update(stringToSign);
            return signer.sign(privateKey, 'base64');
        };

        test('should successfully verify when using rawBody matching signed content', () => {
            const signature = generateTestSignature(testRawBody, testMethod, testUrl, testTimestamp);
            
            const isValid = winpayProvider.verifyCallback(
                testPayload,
                signature,
                testMethod,
                testUrl,
                testTimestamp,
                testRawBody
            );

            expect(isValid).toBe(true);
        });

        test('should successfully verify when rawBody has whitespaces but signature is based on rawBody', () => {
            const prettyRawBody = JSON.stringify(testPayload, null, 2);
            // Sign the pretty raw body
            const signature = generateTestSignature(prettyRawBody, testMethod, testUrl, testTimestamp);

            const isValid = winpayProvider.verifyCallback(
                testPayload,
                signature,
                testMethod,
                testUrl,
                testTimestamp,
                prettyRawBody
            );

            expect(isValid).toBe(true);
        });

        test('should fallback to Minified JSON.stringify when rawBody is not matching or missing', () => {
            // Sign minified JSON string
            const signature = generateTestSignature(JSON.stringify(testPayload), testMethod, testUrl, testTimestamp);

            const isValid = winpayProvider.verifyCallback(
                testPayload,
                signature,
                testMethod,
                testUrl,
                testTimestamp,
                null // no rawBody
            );

            expect(isValid).toBe(true);
        });

        test('should fail verification if signature does not match any candidate', () => {
            const isValid = winpayProvider.verifyCallback(
                testPayload,
                'invalid-signature',
                testMethod,
                testUrl,
                testTimestamp,
                testRawBody
            );

            expect(isValid).toBe(false);
        });

        test('should bypass verification if BYPASS_PAYMENT_SIGNATURE is "true"', () => {
            const oldBypass = process.env.BYPASS_PAYMENT_SIGNATURE;
            process.env.BYPASS_PAYMENT_SIGNATURE = 'true';

            const isValid = winpayProvider.verifyWebhook(
                testPayload,
                'any-bad-signature',
                testMethod,
                testUrl,
                testTimestamp,
                testRawBody
            );

            expect(isValid).toBe(true);

            // Restore
            process.env.BYPASS_PAYMENT_SIGNATURE = oldBypass;
        });
    });
});
