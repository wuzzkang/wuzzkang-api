import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config/index.js';

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);

const email = 'mhdarifsetiawan01@wuzzkang.com';
const password = 'TestPassword123!';

async function getTestToken() {
    console.log('🔄 Memeriksa akun pengujian...');

    // 1. Coba login terlebih dahulu
    let { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    // 2. Jika gagal (akun belum ada), lakukan pendaftaran menggunakan Admin API
    if (error && error.message.includes('Invalid login credentials')) {
        console.log('⚠️ Akun belum ada. Membuat akun menggunakan Admin API (Bypass konfirmasi email)...');
        const signupRes = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Force confirm
            user_metadata: {
                full_name: 'Kang Arif',
                avatar_url: 'https://ui-avatars.com/api/?name=Kang+Arif'
            }
        });

        if (signupRes.error) {
            console.error('❌ Pembuatan Akun Gagal:', signupRes.error.message);
            return;
        }

        console.log('✅ Akun Berhasil Dibuat! (Trigger di database seharusnya sudah membuat profil Anda)');

        // Coba login ulang setelah akun dibuat
        const loginRes = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (loginRes.error) {
            console.error('❌ Login Otomatis Gagal:', loginRes.error.message);
            return;
        }
        data = loginRes.data;
    } else if (error) {
        console.error('❌ Login Gagal:', error.message);
        return;
    }

    // 3. Menampilkan Token JWT
    console.log('\n======================================================');
    console.log('🎉 BERHASIL MENDAPATKAN JWT TOKEN');
    console.log('======================================================\n');

    console.log('User ID:', data.user.id);
    console.log('Email:', data.user.email);
    console.log('\n👇 COPY TOKEN DI BAWAH INI UNTUK PENGUJIAN CURL 👇\n');
    console.log(data.session.access_token);
    console.log('\n======================================================\n');
}

getTestToken();
