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

  const { data: chapters } = await supa.from('chapters').select('id, subject_id, title_en').eq('subject_id', sub.id);
  console.log('TLH Chapters count:', chapters?.length);
  const tlhChapterIds = chapters?.map(c => c.id) || [];

  if (tlhChapterIds.length > 0) {
      // Check topics table columns
      const { data: firstTopic } = await supa.from('topics').select('*').limit(1);
      if (firstTopic && firstTopic.length > 0) {
          console.log('Columns in topics:', Object.keys(firstTopic[0]));
          
          const titleCol = Object.keys(firstTopic[0]).find(k => k.includes('title')) || 'title';
          const { data: topics } = await supa.from('topics').select(id, , slug, chapter_id).in('chapter_id', tlhChapterIds);
          
          console.log('Topics count for TLH:', topics?.length);
          if (topics && topics.length > 0) {
              const nullSlugCount = topics.filter(t => !t.slug).length;
              console.log('Topics with null/empty slug:', nullSlugCount);
              console.log('Sample Topics (5):');
              console.table(topics.slice(0, 5));
          }
      }
  }
}

checkTLH();
