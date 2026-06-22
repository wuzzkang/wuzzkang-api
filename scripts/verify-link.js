import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function verify() {
    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', '7bcf3271-0d70-4429-88d5-10b9e9e33b61')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }

    console.log('Latest Transaction:');
    console.log(JSON.stringify(data, null, 2));

    if (data.project_id) {
        console.log('✅ SUCCESS: project_id is populated:', data.project_id);
    } else {
        console.log('❌ FAILURE: project_id is empty');
    }
}

verify();
