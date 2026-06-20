// scripts/test-connection.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function testConnection() {
    console.log("🔍 Testing connection to:", SUPABASE_URL);

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error("❌ Error: SUPABASE_URL atau SUPABASE_SERVICE_KEY tidak ditemukan di .env");
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    try {
        // Mencoba melakukan query sederhana (cek kesehatan)
        const { data, error } = await supabase.from('projects').select('count', { count: 'exact', head: true });

        if (error) throw error;

        console.log("✅ Berhasil! Koneksi ke Supabase stabil.");
    } catch (err) {
        console.error("❌ Gagal terhubung ke Supabase:", err.message);
    }
}

testConnection();