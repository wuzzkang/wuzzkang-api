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
        const generateSignatureSpy = jest.spyOn(winpayProvider, 'generateSignature').mockImplementation((payload, method, url, timestamp) => {
            const bodyHash = winpayProvider._sortObject(payload);
            const stringToSign = `${method}:${url}:${crypto.createHash('sha256').update(JSON.stringify(bodyHash)).digest('hex').toLowerCase()}:${timestamp}`;

            // We use the real implementation but log the intermediate values
            const signature = originalGenerateSignature(payload, method, url, timestamp);

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
                    'X-PARTNER-ID': 'PARTNER-123',
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
});
