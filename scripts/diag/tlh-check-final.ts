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

  // Check columns of chapters table
  const { data: cols, error: colErr } = await supa.rpc('get_table_info', { table_name: 'chapters' }); 
  // If RPC doesn't exist, try a simple select
  const { data: firstRow, error: rowErr } = await supa.from('chapters').select('*').limit(1);
  if (rowErr) console.log('Error fetching chapters row:', rowErr.message);
  else console.log('Columns in chapters:', Object.keys(firstRow[0]));

  const { data: chapters, error } = await supa
    .from('chapters')
    .select('id, name_en, subject_id');
  
  if (error) {
      console.log('Error with name_en, trying name:', error.message);
      const { data: chapters2 } = await supa.from('chapters').select('id, name, subject_id');
      console.log('Chapters count (select id, name, subject_id):', chapters2?.length);
  } else {
      console.log('Chapters count (select id, name_en, subject_id):', chapters?.length);
  }

  const { data: allChapters } = await supa.from('chapters').select('id, subject_id');
  const tlhChapters = allChapters?.filter(c => c.subject_id === sub.id) || [];
  console.log('TLH Chapters count:', tlhChapters.length);
  const tlhChapterIds = tlhChapters.map(c => c.id);

  if (tlhChapterIds.length > 0) {
      const { data: topics } = await supa.from('topics').select('id, name_en, slug, chapter_id').in('chapter_id', tlhChapterIds);
      if (!topics) {
          const { data: topics2 } = await supa.from('topics').select('id, title, slug, chapter_id').in('chapter_id', tlhChapterIds);
          console.log('Topics count (via title):', topics2?.length);
          console.table(topics2?.slice(0, 5));
      } else {
          console.log('Topics count (via name_en):', topics.length);
          console.table(topics.slice(0, 5));
      }
  }
}

checkTLH();
