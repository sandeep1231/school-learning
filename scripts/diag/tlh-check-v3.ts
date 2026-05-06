import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function checkTLH() {
  const { data: sub } = await supa
    .from('subjects')
    .select('id, code, name_en')
    .eq('board', 'BSE_ODISHA')
    .eq('class_level', 9)
    .eq('code', 'TLH')
    .single();

  if (!sub) {
    console.log('Subject TLH not found');
    return;
  }
  console.log('Subject:', sub);

  const { data: chapters, error } = await supa
    .from('chapters')
    .select('id, title, subject_id');
  
  if (error) console.log('Error fetching chapters:', error);

  const tlhChapters = chapters?.filter(c => c.subject_id === sub.id) || [];
  console.log('Chapters found via manual filter:', tlhChapters.length);
  
  if (tlhChapters.length > 0) {
      console.log('One sample chapter:', tlhChapters[0]);
  } else {
      console.log('Sample subjects from chapters table:', [...new Set(chapters?.slice(0, 100).map(c => c.subject_id))]);
  }
}

checkTLH();
