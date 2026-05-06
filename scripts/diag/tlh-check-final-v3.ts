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
  process.stdout.write('Subject: ' + JSON.stringify(sub) + '\n');

  const { data: chapters } = await supa.from('chapters').select('id, subject_id, title_en').eq('subject_id', sub.id);
  process.stdout.write('TLH Chapters count: ' + (chapters?.length || 0) + '\n');
  const tlhChapterIds = chapters?.map(c => c.id) || [];

  if (tlhChapterIds.length > 0) {
      const { data: firstTopic } = await supa.from('topics').select('*').limit(1);
      if (firstTopic && firstTopic.length > 0) {
          const keys = Object.keys(firstTopic[0]);
          process.stdout.write('Columns in topics: ' + keys.join(', ') + '\n');
          const titleCol = keys.find(k => k.includes('title')) || 'title';
          const { data: topics } = await supa.from('topics').select('id, ' + titleCol + ', slug, chapter_id').in('chapter_id', tlhChapterIds);
          
          process.stdout.write('Topics count for TLH: ' + (topics?.length || 0) + '\n');
          if (topics && topics.length > 0) {
              const nullSlugCount = topics.filter(t => !t.slug).length;
              process.stdout.write('Topics with null/empty slug: ' + nullSlugCount + '\n');
              process.stdout.write('Sample Topics (5):\n');
              console.table(topics.slice(0, 5));
          }
      }
  }
}

checkTLH();
