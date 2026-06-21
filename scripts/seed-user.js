/**
 * @file scripts/seed-user.js
 * @description Seed script — membuat dummy auth user di Supabase untuk keperluan webhook testing.
 *
 * CARA MENJALANKAN:
 *   nvm use 24 && node scripts/seed-user.js
 *
 * CATATAN:
 *   - Butuh SUPABASE_URL & SUPABASE_SERVICE_KEY di file .env
 *   - Menggunakan supabase.auth.admin (service role) → bypass RLS
 *   - Idempotent: jika email sudah terdaftar, script akan memberi tahu tanpa crash
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// ── Validasi env ──────────────────────────────────────────────────────────────
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: SUPABASE_URL atau SUPABASE_SERVICE_KEY tidak ditemukan di .env');
    process.exit(1);
}

// ── Admin client (service role — punya akses auth.admin) ──────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─────────────────────────────────────────────────────────────────────────────
async function seed() {
    const email = `seed-user-${Date.now()}@wuzzkang-test.internal`;
    const password = 'SeedPass1234!';

    console.log('🌱 Membuat dummy user...');
    console.log(`   Email    : ${email}`);

    const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // skip OTP verification
    });

    if (error) {
        // Idempotent guard: jika user sudah ada, log info dan exit sukses
        if (error.message?.toLowerCase().includes('already registered')) {
            console.warn('⚠️  User dengan email ini sudah terdaftar. Tidak ada yang diubah.');
            process.exit(0);
        }
        throw error;
    }

    const userId = data.user.id;

    console.log('\n✅ Dummy user berhasil dibuat!');
    console.log('────────────────────────────────────────');
    console.log(`   USER ID  : ${userId}`);
    console.log(`   Email    : ${email}`);
    console.log(`   Password : ${password}`);
    console.log('────────────────────────────────────────');
    console.log('\n👾 Gunakan USER ID ini untuk webhook test:');
    console.log(`\n   curl -X POST http://localhost:3000/api/payments/webhook \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -H "x-signature: dummy-sig" \\`);
    console.log(`     -d '{"userId":"${userId}","amount":50000,"orderId":"order-test-1"}'`);
    console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
try {
    await seed();
    process.exit(0);
} catch (err) {
    console.error('\n❌ Error seeding user:', err.message ?? err);
    process.exit(1);
}
