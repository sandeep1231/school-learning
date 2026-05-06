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
    .select('id, title')
    .eq('subject_id', sub.id);
  
  const chapterIds = chapters?.map(c => c.id) || [];
  console.log('Chapter Count:', chapterIds.length);
  if (chapters && chapters.length > 0) {
     console.log('Sample Chapters (3):', chapters.slice(0, 3));
  }

  // Check if ANY topics exist in the DB first
  const { count } = await supa
    .from('topics')
    .select('*', { count: 'exact', head: true });
  console.log('Global Topics Count:', count);

  const { data: topics } = await supa
    .from('topics')
    .select('id, title, slug, chapter_id')
    .in('chapter_id', chapterIds.length ? chapterIds : ['00000000-0000-0000-0000-000000000000']);

  const topicsList = topics || [];
  console.log('Topics for TLH Class 9:', topicsList.length);

  // If zero, maybe they are linked to wrong chapters or no chapters?
  // Let's check a few chapters to see if they have topics in the DB
  if (chapterIds.length > 0) {
      const { data: someTopics } = await supa.from('topics').select('chapter_id').limit(10);
      console.log('Global sample topic chapter_ids:', someTopics?.map(t => t.chapter_id));
  }

  const nullSlugCount = topicsList.filter(t => !t.slug).length;
  console.log('Topics with null/empty slug:', nullSlugCount);

  console.log('Sample Topics (5):');
  console.table(topicsList.slice(0, 5));
}

checkTLH();
