// scripts/test-sandbox.js
import { WinpayProvider } from '../src/services/payments/winpay.provider.js';
import dotenv from 'dotenv';
dotenv.config();

async function runSandboxTest() {
    console.log('🚀 Starting Real Sandbox Test...');

    // Konfigurasi disederhanakan
    const config = {
        partnerId: process.env.WINPAY_PARTNER_ID,
        winpayPublicKey: process.env.WINPAY_PUBLIC_KEY,
        baseUrl: 'https://sandbox-api.bmstaging.id/snap'
    };

    const provider = new WinpayProvider(config);

    try {
        const orderId = `INV-${Date.now()}`;
        const amount = 50000;

        // PENTING: customerNo HARUS NUMERIC STRING.
        // Jangan gunakan 'user-12345' karena mengandung huruf.
        const customerNo = '089612345678';

        console.log(`Creating transaction for Order: ${orderId}`);
        console.log(`CustomerNo: ${customerNo}`);

        // Memanggil provider dengan customerNo numerik
        const result = await provider.createTransaction(amount, customerNo, orderId);

        console.log('✅ Success! Winpay Response:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Failed! Error Details:');
        console.error(error.message);
    }
}

runSandboxTest();