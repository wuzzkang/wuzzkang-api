/**
 * @fileoverview E2E Integration Test — Payment Webhook
 * Phase 5b: Full end-to-end test hitting a real Supabase instance.
 *
 * FLOW:
 *   1. [Setup]   Create real auth user in Supabase
 *   2. [Setup]   Trigger profile creation via walletService.getBalance()
 *   3. [Test]    POST to /api/payments/webhook
 *   4. [Assert]  Response is 200 { status: 'success', message: 'Webhook received' }
 *   5. [Assert]  User balance increased by testAmount
 *   6. [Cleanup] Delete auth user (cascades to profile)
 *
 * PREREQUISITES:
 *   - .env must have valid SUPABASE_URL and SUPABASE_SERVICE_KEY
 *   - Run with: npm run test:integration
 *
 * WHY WE MOCK deployWorker:
 *   server.js calls startDeployWorker() at module-load time, which opens a
 *   persistent Redis connection (BullMQ). Mocking it prevents Redis errors
 *   in environments where Redis is not available during testing.
 */

import { jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. MOCK BullMQ deploy worker BEFORE importing server.js
//    (jest.unstable_mockModule must be called before dynamic import)
// ─────────────────────────────────────────────────────────────────────────────
jest.unstable_mockModule('../../src/queues/deployWorker.js', () => ({
    startDeployWorker: jest.fn(() => {
        console.log('[Mock] startDeployWorker called — no-op in test environment.');
    }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// 2. Dynamic imports (after mocking is set up)
// ─────────────────────────────────────────────────────────────────────────────
const { config } = await import('../../src/config/index.js');
const { walletService } = await import('../../src/services/wallet.service.js');
const { app } = await import('../../server.js');

// ─────────────────────────────────────────────────────────────────────────────
// 3. Supabase admin client (service role key — bypasses RLS)
// ─────────────────────────────────────────────────────────────────────────────
const supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────
describe('Payment Webhook — E2E Integration Test', () => {
    let dummyUserId;
    let server;
    let API_URL;

    const testAmount = 50000;
    const testOrderId = `test-order-${Date.now()}`;

    // ── beforeAll: spin up server + create dummy user ──────────────────────
    beforeAll(async () => {
        // --- Start Express on a random available port ---
        server = app.listen(0);
        const { port } = server.address();
        API_URL = `http://localhost:${port}/api/payments/webhook`;
        console.log(`\n[Setup] ✅ Test server started → ${API_URL}`);

        // --- Create dummy auth user ---
        console.log('[Setup] Creating dummy auth user in Supabase...');
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
            email: `test-${Date.now()}@wuzzkang-test.internal`,
            password: 'Test1234!',
            email_confirm: true,
        });

        if (userError) {
            console.error('[Setup] ❌ Failed to create auth user:', userError.message);
            throw userError;
        }

        dummyUserId = userData.user.id;
        console.log(`[Setup] ✅ Dummy auth user created:  ${dummyUserId}`);

        // --- Ensure profile row exists (calls get_or_create_profile RPC) ---
        // walletService.getBalance() calls the Supabase RPC that upserts a
        // profile row. Without this, the webhook's addTransaction() would
        // fail with a foreign key constraint on the profiles table.
        await walletService.getBalance(dummyUserId);
        console.log('[Setup] ✅ Profile ensured in DB via get_or_create_profile RPC.');
    });

    // ── afterAll: cleanup server + delete dummy user ───────────────────────
    afterAll(async () => {
        console.log('\n[Cleanup] Closing test server...');
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
        console.log('[Cleanup] ✅ Test server closed.');

        if (dummyUserId) {
            console.log(`[Cleanup] Deleting dummy auth user: ${dummyUserId}`);
            const { error } = await supabaseAdmin.auth.admin.deleteUser(dummyUserId);
            if (error) {
                // Non-fatal: log the error but don't fail the suite
                console.error('[Cleanup] ⚠️  Could not delete dummy user:', error.message);
            } else {
                console.log('[Cleanup] ✅ Dummy auth user deleted (profile cascade).');
            }
        }
    });

    // ── TEST CASE ──────────────────────────────────────────────────────────
    it('should credit user balance when a valid webhook is received', async () => {
        // ── Step 1: Record initial balance ───────────────────────────────
        const initialBalance = await walletService.getBalance(dummyUserId);
        console.log(`\n[Test] Initial balance : Rp ${initialBalance.toLocaleString('id-ID')}`);

        // ── Step 2: POST to /api/payments/webhook ─────────────────────
        console.log(`[Test] POSTing webhook to ${API_URL}...`);
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // DummyPaymentProvider.verifyWebhook() always returns true,
                // so any non-empty value works here.
                'x-signature': 'dummy-sig-always-passes',
            },
            body: JSON.stringify({
                userId: dummyUserId,
                amount: testAmount,
                orderId: testOrderId,
            }),
        });

        const result = await response.json();
        console.log('[Test] Webhook response:', JSON.stringify(result));

        // ── Step 3: Assert HTTP response ─────────────────────────────────
        expect(response.status).toBe(200);
        expect(result).toEqual({
            status: 'success',
            message: 'Webhook received',
        });

        // ── Step 4: Assert balance updated in DB ──────────────────────────
        const finalBalance = await walletService.getBalance(dummyUserId);
        console.log(`[Test] Final balance   : Rp ${finalBalance.toLocaleString('id-ID')}`);
        console.log(`[Test] Delta           : Rp ${(finalBalance - initialBalance).toLocaleString('id-ID')} (expected Rp ${testAmount.toLocaleString('id-ID')})`);

        expect(Number(finalBalance)).toBe(Number(initialBalance) + testAmount);
    });
});
