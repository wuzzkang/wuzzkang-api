import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Script untuk mengetes alur pembuatan transaksi dan simulasi webhook.
 */
async function runTest() {
    const BASE_URL = 'http://localhost:3026/api';

    // 1. Ganti dengan User ID yang valid dari database Supabase Anda
    const userId = '7bcf3271-0d70-4429-88d5-10b9e9e33b61';

    console.log('--- STEP 1: Create Transaction ---');
    try {
        const createRes = await fetch(`${BASE_URL}/payments/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: 50000,
                userId: userId,
                channel: 'CIMB'
            })
        });

        const transaction = await createRes.json();

        if (!createRes.ok) {
            console.error('❌ Gagal membuat transaksi:', transaction);
            return;
        }

        console.log('✅ Transaksi Berhasil Dibuat (PENDING):');
        console.log(JSON.stringify(transaction, null, 2));

        const orderId = transaction.order_id;

        console.log('\n--- STEP 2: Simulate Webhook (PAID) ---');
        console.log(`Simulasi callback untuk Order ID: ${orderId}`);

        // Payload simulasi dari Winpay
        const webhookPayload = {
            responseCode: '2000000',
            responseMessage: 'Successful',
            trxId: orderId,
            amount: {
                value: '50000.00',
                currency: 'IDR'
            }
        };

        // Catatan: Dalam testing real, Anda perlu generate signature yang valid.
        // Untuk testing lokal, Anda bisa menonaktifkan verifikasi signature sementara
        // atau menggunakan provider 'dummy'.

        const webhookRes = await fetch(`${BASE_URL}/payments/webhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-SIGNATURE': 'MOCK_SIGNATURE' // Ganti dengan signature asli jika verifikasi aktif
            },
            body: JSON.stringify(webhookPayload)
        });

        const webhookResult = await webhookRes.json();
        console.log('✅ Webhook Response:', webhookResult);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

console.log('Pastikan server sudah berjalan (npm run dev) sebelum menjalankan script ini.');
runTest();
