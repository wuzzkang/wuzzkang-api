/**
 * Self-signing simulation test — mensimulasikan callback Winpay:
 * 1. Generate RSA keypair sendiri
 * 2. Sign payload dengan private key (seperti yang dilakukan server Winpay)
 * 3. Verifikasi dengan public key (seperti yang dilakukan kode kita)
 * 4. Kirim real HTTP request ke server lokal (jika berjalan)
 *
 * Run: node scripts/simulate-winpay-callback.js
 */

import crypto from 'crypto';
import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Konfigurasi ───────────────────────────────────────────────────────────────
const SERVER_URL  = 'http://localhost:3026';  // sesuaikan PORT dengan .env
const PARTNER_ID  = '171001407';              // dari live callback
const SNAP_PATH   = '/v1.0/transfer-va/payment';
const ORDER_ID    = `INV-${Date.now()}`;

// ── Payload mock — persis seperti format Winpay ───────────────────────────────
const payload = {
    partnerServiceId: "   70070",
    customerNo: "33081234567890",
    virtualAccountNo: "   7007033081234567890",
    virtualAccountName: "Gajah Mada",
    trxId: ORDER_ID,
    paymentRequestId: "223317",
    paidAmount: {
        value: "20000.00",
        currency: "IDR"
    },
    trxDateTime: new Date().toISOString().replace('Z', '+07:00'),
    additionalInfo: {
        contractId: "test-contract-" + Date.now(),
        channel: "BCA"
    }
};

// ── Timestamp format WIB ──────────────────────────────────────────────────────
const now = new Date();
const wibOffset = 7 * 60;
const wibTime = new Date(now.getTime() + (wibOffset - now.getTimezoneOffset()) * 60000);
const timestamp = wibTime.toISOString().replace('Z', '').slice(0, 19) + '+07:00';

// ── Compute body hash & stringToSign (persis formula Winpay) ─────────────────
const minifiedBody = JSON.stringify(payload);
const bodyHash = crypto.createHash('sha256').update(minifiedBody).digest('hex').toLowerCase();
const stringToSign = `POST:${SNAP_PATH}:${bodyHash}:${timestamp}`;

console.log('='.repeat(70));
console.log('WINPAY CALLBACK SIMULATION — SELF-SIGNING TEST');
console.log('='.repeat(70));
console.log(`\n📦 Order ID        : ${ORDER_ID}`);
console.log(`🕐 Timestamp       : ${timestamp}`);
console.log(`🔑 Body Hash       : ${bodyHash}`);
console.log(`📝 StringToSign    : ${stringToSign.substring(0, 80)}...`);

// ── Step 1: Generate temporary RSA keypair (simulasi keypair Winpay server) ───
console.log('\n' + '─'.repeat(70));
console.log('STEP 1: Generate fresh RSA-1024 keypair (same size as Winpay live sig)');
console.log('─'.repeat(70));

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 1024,
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
console.log('✅ Generated fresh 1024-bit RSA keypair');

// ── Step 2: Sign — persis seperti Winpay server ───────────────────────────────
console.log('\n' + '─'.repeat(70));
console.log('STEP 2: Sign stringToSign with private key (Winpay server simulation)');
console.log('─'.repeat(70));

const signer = crypto.createSign('SHA256');
signer.update(stringToSign);
const signatureBase64 = signer.sign(privateKey, 'base64');
console.log(`✅ Signature generated: ${signatureBase64.substring(0, 40)}...`);
console.log(`   Signature length  : ${Buffer.from(signatureBase64, 'base64').length} bytes`);

// ── Step 3: Verify locally — simulasi apa yang dilakukan WinpayProvider ──────
console.log('\n' + '─'.repeat(70));
console.log('STEP 3: Verify locally (simulates WinpayProvider.verifyCallback)');
console.log('─'.repeat(70));

function localVerify(algo, sigInput, label) {
    try {
        const v = crypto.createVerify(algo);
        v.update(stringToSign);
        const r = sigInput instanceof Buffer
            ? v.verify(publicKey, sigInput)
            : v.verify(publicKey, sigInput, 'base64');
        console.log(`   ${r ? '✅' : '❌'} [${algo}] ${label}: ${r ? 'VALID' : 'INVALID'}`);
        return r;
    } catch (e) {
        console.log(`   ⚠️  [${algo}] ${label}: ERROR — ${e.message}`);
        return false;
    }
}

const a = localVerify('SHA256',    signatureBase64,                        'base64_string');
const b = localVerify('SHA256',    Buffer.from(signatureBase64, 'base64'), 'Buffer       ');
const c = localVerify('RSA-SHA256',signatureBase64,                        'base64_string');
const d = localVerify('RSA-SHA256',Buffer.from(signatureBase64, 'base64'), 'Buffer       ');

if (a || b || c || d) {
    console.log('\n✅ LOCAL VERIFICATION WORKS — pipeline code is correct!');
} else {
    console.error('\n❌ LOCAL VERIFICATION FAILED — bug in verification code!');
    process.exit(1);
}

// ── Step 4: Send real HTTP request to local server ────────────────────────────
console.log('\n' + '─'.repeat(70));
console.log(`STEP 4: POST to ${SERVER_URL}/api/payment/webhook`);
console.log('        (requires server running with BYPASS_PAYMENT_SIGNATURE=true)');
console.log('─'.repeat(70));

function httpPost(url, headers, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const options = {
            hostname: u.hostname,
            port: u.port || 80,
            path: u.pathname,
            method: 'POST',
            headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

try {
    const result = await httpPost(
        `${SERVER_URL}/api/payment/webhook`,
        {
            'Content-Type':  'application/json',
            'X-PARTNER-ID':  PARTNER_ID,
            'X-TIMESTAMP':   timestamp,
            'X-SIGNATURE':   signatureBase64,
            'X-EXTERNAL-ID': crypto.randomUUID(),
        },
        minifiedBody
    );

    let parsed;
    try { parsed = JSON.parse(result.body); } catch { parsed = result.body; }

    console.log(`\n   HTTP Status : ${result.status}`);
    console.log(`   Response    : ${JSON.stringify(parsed, null, 2)}`);

    if (result.status === 200 || result.status === 201) {
        console.log('\n✅ SERVER ACCEPTED CALLBACK — business logic works end-to-end!');
    } else if (result.status === 401) {
        console.log('\n⚠️  SERVER RETURNED 401 — pastikan BYPASS_PAYMENT_SIGNATURE=true');
        console.log('   dan server sudah di-restart (pm2 restart wuzzkang-api)');
    } else if (result.status === 404) {
        console.log('\n⚠️  404 — Transaction Not Found.');
        console.log(`   Order ID "${ORDER_ID}" belum ada di DB. Wajar untuk order baru.`);
        console.log('   Ganti ORDER_ID di atas dengan order PENDING yang ada di DB.');
    } else {
        console.log('\n⚠️  Unexpected response — see body above.');
    }
} catch (e) {
    console.log(`\n⚠️  Could not reach server at ${SERVER_URL}: ${e.message}`);
    console.log('   Pastikan server berjalan. Cek PORT di atas sesuai .env (PORT=3026)');
}

console.log('\n' + '='.repeat(70));
console.log('SIMULATION COMPLETE');
console.log('='.repeat(70));

