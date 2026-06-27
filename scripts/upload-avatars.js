import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function upload() {
    try {
        const groomData = fs.readFileSync('/home/bms-del112/BMS/personal-project/wuzzkang/wuzzkang-dashboard/public/groom-avatar.jpg');
        const brideData = fs.readFileSync('/home/bms-del112/BMS/personal-project/wuzzkang/wuzzkang-dashboard/public/bride-avatar.jpg');

        console.log('Uploading groom-avatar...');
        const { data: gData, error: gErr } = await supabase.storage
            .from('wuzzkang-bucket')
            .upload('defaults/groom-avatar.jpg', groomData, { contentType: 'image/jpeg', upsert: true });
        if (gErr) throw gErr;

        console.log('Uploading bride-avatar...');
        const { data: bData, error: bErr } = await supabase.storage
            .from('wuzzkang-bucket')
            .upload('defaults/bride-avatar.jpg', brideData, { contentType: 'image/jpeg', upsert: true });
        if (bErr) throw bErr;

        const { data: gUrl } = supabase.storage.from('wuzzkang-bucket').getPublicUrl('defaults/groom-avatar.jpg');
        const { data: bUrl } = supabase.storage.from('wuzzkang-bucket').getPublicUrl('defaults/bride-avatar.jpg');

        console.log('--- PUBLIC URLs ---');
        console.log('Groom Avatar:', gUrl.publicUrl);
        console.log('Bride Avatar:', bUrl.publicUrl);
    } catch (err) {
        console.error('Upload failed:', err);
    }
}
upload();
