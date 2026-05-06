import { config } from 'dotenv'; config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function run() {
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('--- Subjects (id, code, board, class_level) ---');
  const { data: subjects, error: err2 } = await supa
    .from('subjects')
    .select('id, code, board, class_level')
    .limit(20);
    
  if (err2) {
    console.error(err2);
  } else {
    console.log(JSON.stringify(subjects, null, 2));
  }
}

run();
