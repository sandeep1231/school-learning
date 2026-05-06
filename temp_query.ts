import { config } from 'dotenv'; config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function run() {
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('--- Distinct board, class_level counts ---');
  const { data: counts, error: err1 } = await supa
    .from('subjects')
    .select('board, class_level');
    
  if (err1) {
    console.error(err1);
  } else {
    const grouped = counts.reduce((acc, curr) => {
      const key = curr.board + '|' + curr.class_level;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const result = Object.entries(grouped).map(([key, count]) => {
      const [board, class_level] = key.split('|');
      return { board, class_level, count };
    }).sort((a, b) => (a.board + a.class_level).localeCompare(b.board + b.class_level));
    console.log(JSON.stringify(result, null, 2));
  }

  console.log('\n--- First 20 subjects ---');
  const { data: subjects, error: err2 } = await supa
    .from('subjects')
    .select('id, code, name, board, class_level')
    .limit(20);
    
  if (err2) {
    console.error(err2);
  } else {
    console.log(JSON.stringify(subjects, null, 2));
  }
}

run();
