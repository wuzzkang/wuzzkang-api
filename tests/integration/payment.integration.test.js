import { jest } from '@jest/globals';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../src/config/index.js';
import { walletService } from '../../src/services/wallet.service.js';
import { app } from '../../server.js';

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);

describe('Payment Webhook E2E Integration Test', () => {
    let dummyUserId;
    let server;
    let API_URL;
    const testAmount = 50000;
    const testOrderId = `test-order-${Date.now()}`;

    beforeAll(async () => {
        // 0. Start local server on a random port
        server = app.listen(0);
        const { port } = server.address();
        API_URL = `http://localhost:${port}/api/payments/webhook`;
        console.log(`[Setup] Test server started at ${API_URL}`);

        console.log('[Setup] Creating dummy user...');

        // 1. Create a dummy user in auth.users
        const { data: userData, error: userError } = await supabase.auth.admin.createUser({
            email: `test-${Date.now()}@example.com`,
            password: 'password123',
            email_confirm: true
        });

        if (userError) {
            console.error('[Setup] Error creating auth user:', userError.message);
            throw userError;
        }

        dummyUserId = userData.user.id;
        console.log(`[Setup] Dummy user created with ID: ${dummyUserId}`);

        // 2. Ensure profile exists (walletService.getBalance calls get_or_create_profile RPC)
        await walletService.getBalance(dummyUserId);
        console.log('[Setup] Profile ensured.');
    });

    afterAll(async () => {
        console.log('[Cleanup] Closing test server...');
        if (server) server.close();

        console.log('[Cleanup] Deleting dummy user...');
        if (dummyUserId) {
            const { error } = await supabase.auth.admin.deleteUser(dummyUserId);
            if (error) {
                console.error('[Cleanup] Error deleting dummy user:', error.message);
            } else {
                console.log('[Cleanup] Dummy user deleted.');
            }
        }
    });

    it('should credit user balance when a valid webhook is received', async () => {
        // 1. Check initial balance
        const initialBalance = await walletService.getBalance(dummyUserId);
        console.log(`[Test] Initial balance: ${initialBalance}`);

        // 2. Hit the webhook endpoint
        console.log(`[Test] Hitting webhook at ${API_URL}...`);
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-signature': 'dummy-sig' // DummyProvider always returns true for verification
            },
            body: JSON.stringify({
                userId: dummyUserId,
                amount: testAmount,
                orderId: testOrderId
            })
        });

        const result = await response.json();
        console.log('[Test] Webhook response:', result);

        // 3. Assertions on response
        expect(response.status).toBe(200);
        expect(result).toEqual({
            status: 'success',
            message: 'Webhook received'
        });

        // 4. Verify balance update in database
        const finalBalance = await walletService.getBalance(dummyUserId);
        console.log(`[Test] Final balance: ${finalBalance}`);

        expect(Number(finalBalance)).toBe(Number(initialBalance) + testAmount);
    });
});
