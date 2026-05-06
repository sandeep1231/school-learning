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

  const { data: chapters } = await supa
    .from('chapters')
    .select('id, title, subject_id');
  
  const tlhChapters = chapters?.filter(c => c.subject_id === sub.id) || [];
  console.log('Chapters found via filtered array:', tlhChapters.length);
  
  const { data: chaptersFixed } = await supa
    .from('chapters')
    .select('id, title, subject_id')
    .eq('subject_id', sub.id);

  console.log('Chapters found via EQ filter:', chaptersFixed?.length);
  const chapterIds = chaptersFixed?.map(c => c.id) || [];

  const { data: topics } = await supa
    .from('topics')
    .select('id, title, slug, chapter_id')
    .in('chapter_id', chapterIds.length ? chapterIds : ['00000000-0000-0000-0000-000000000000']);

  console.log('Topics found:', topics?.length);

  if (topics && topics.length > 0) {
    const nullSlugCount = topics.filter(t => !t.slug).length;
    console.log('Topics with null/empty slug:', nullSlugCount);
    console.log('Sample Topics (5):');
    console.table(topics.slice(0, 5));
  }
}

checkTLH();
