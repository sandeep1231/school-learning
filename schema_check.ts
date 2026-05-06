
import { createAdminClient } from './lib/supabase/admin';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function run() {
  const supabase = createAdminClient();
  const tables = ['subjects', 'chapters', 'topics', 'lessons', 'practice_items', 'chunks'];
  for (const table of tables) {
    console.log('--- ' + table + ' ---');
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log('Error querying ' + table + ':', error.message);
    } else if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]).join(', '));
    } else {
      console.log('No data found in ' + table + ' (checking if it exists at all)');
      const { error: tableError } = await supabase.from(table).select('count').limit(1);
      if (tableError) console.log('Table likely does not exist:', tableError.message);
      else console.log('Table exists but is empty.');
    }
  }
}
run();

