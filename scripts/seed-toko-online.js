import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('products')
    .upsert([
      {
        id: 'toko-online',
        name: 'Toko Online',
        is_active: true,
        cost: 10000,
        unit: 'Toko'
      }
    ]);
  if (error) {
    console.error('Error seeding toko-online product:', error);
    process.exit(1);
  }
  console.log('✅ Toko Online product seeded successfully!');
  process.exit(0);
}

run();
