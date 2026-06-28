/**
 * Diagnostic script: exhaustively test all path × algorithm × signature-format
 * combinations against the live Winpay callback values.
 * Run with: node scripts/diagnose-winpay-sig.js
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── Live values from the real callback log ────────────────────────────────────

const RAW_BODY = '{"partnerServiceId":"   70070","customerNo":"33081234567890","virtualAccountNo":"   7007033081234567890","virtualAccountName":"Gajah Mada","trxId":"INV-1782662112964","paymentRequestId":"223317","paidAmount":{"value":"20000.00","currency":"IDR"},"trxDateTime":"2026-06-28T22:55:34+07:00","additionalInfo":{"contractId":"bc5ea03a4c-928f-49f6-abeb-be85032b17c8","channel":"BCA"}}';

const SIGNATURE = 'iexyl/HnxonDg2YvkP9qtIRGWuLznUvtuExCw1u3dREefIxE0nm5QzelMj2eOY+XuucVIV1b219mikDAYLRsvXwhLu1MEpUYZbeIXfkmJhg80+26GI9ph7ydAkFYOw1kgn2l3YFjwe9YPGFMhstZ8MZ2e7FGXOWHrC77d3OH0Pk=';
const TIMESTAMP = '2026-06-28T22:55:34+07:00';
const METHOD = 'POST';

// ── Candidate paths ───────────────────────────────────────────────────────────
// Winpay sample code uses: /billing/notification/v1.0/transfer-va/payment
const PATHS_TO_TRY = [
    '/v1.0/transfer-va/payment',                       // kita pakai sebelumnya
    '/billing/notification/v1.0/transfer-va/payment',  // dari sample code resmi Winpay
    '/api/payment/webhook/v1.0/transfer-va/payment',   // req.originalUrl dari log
];

// ── Body hash ─────────────────────────────────────────────────────────────────
const bodyHash = crypto.createHash('sha256').update(RAW_BODY).digest('hex').toLowerCase();

console.log('='.repeat(70));
console.log('WINPAY SIGNATURE DIAGNOSTIC — PATH & ALGO EXHAUSTIVE TEST');
console.log('='.repeat(70));
console.log(`\n📋 Raw Body length   : ${RAW_BODY.length} chars`);
console.log(`🔑 Body Hash sha256  : ${bodyHash}`);
console.log(`✉️  Signature length  : ${Buffer.from(SIGNATURE, 'base64').length} bytes`);

// ── Load public key ───────────────────────────────────────────────────────────
const pemPath = path.join(ROOT, 'winpay_public_key.pem');
let currentKey = null;
try {
    currentKey = fs.readFileSync(pemPath, 'utf8').trim();
    console.log(`\n📂 Key file: ${pemPath}`);
    console.log(`   Preview : ${currentKey.split('\n')[1]?.substring(0, 40)}...`);
} catch (e) {
    console.log(`\n⚠️  Cannot read ${pemPath}: ${e.message}`);
    process.exit(1);
}

// ── Try every path × algorithm × signature-format combination ─────────────────
const ALGORITHMS = ['SHA256', 'RSA-SHA256'];

console.log('\n' + '─'.repeat(70));
console.log('EXHAUSTIVE COMBINATION TEST:');
console.log('─'.repeat(70));

let foundValid = false;

for (const testPath of PATHS_TO_TRY) {
    const stringToSign = `${METHOD}:${testPath}:${bodyHash}:${TIMESTAMP}`;
    console.log(`\n📍 Path: "${testPath}"`);

    for (const algo of ALGORITHMS) {
        // Method A: base64 string (our current approach)
        try {
            const v = crypto.createVerify(algo);
            v.update(stringToSign);
            const r = v.verify(currentKey, SIGNATURE, 'base64');
            if (r) foundValid = true;
            console.log(`   ${r ? '✅' : '❌'} [${algo}] sig=base64_string → ${r ? '✅ VALID ← MATCH!' : 'invalid'}`);
        } catch (e) {
            console.log(`   ⚠️  [${algo}] sig=base64_string → ERROR: ${e.message}`);
        }

        // Method B: raw Buffer (Winpay sample code style)
        try {
            const v = crypto.createVerify(algo);
            v.update(stringToSign);
            const r = v.verify(currentKey, Buffer.from(SIGNATURE, 'base64'));
            if (r) foundValid = true;
            console.log(`   ${r ? '✅' : '❌'} [${algo}] sig=Buffer       → ${r ? '✅ VALID ← MATCH!' : 'invalid'}`);
        } catch (e) {
            console.log(`   ⚠️  [${algo}] sig=Buffer       → ERROR: ${e.message}`);
        }
    }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(70));
if (foundValid) {
    console.log('🎉 FOUND VALID COMBINATION! See ✅ lines above.');
    console.log('   Update webhook.controller.js to use the correct path.');
} else {
    console.log('💀 NO VALID COMBINATION FOUND.');
    console.log('   The public key does not match what Winpay used to sign.');
    console.log('   Get the correct public key from the Winpay portal.');
}
console.log('='.repeat(70));
