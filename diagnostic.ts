
import { createAdminClient } from './lib/supabase/admin';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function run() {
  try {
    const supabase = createAdminClient();
    const board = 'BSE_ODISHA';
    const classLevels = [6, 7, 8, 9];

    console.log('Diagnostic Report for Board: ' + board);
    console.log('====================================');

    for (const level of classLevels) {
      console.log('\n--- Class Level ' + level + ' ---');

      const { data: levelSubjects, error: subErr } = await supabase
        .from('subjects')
        .select('id, code')
        .eq('board', board)
        .eq('class_level', level);
      
      if (subErr) { console.error('Error fetching subjects:', subErr.message); continue; }
      
      const subjectIds = levelSubjects.map(s => s.id);
      console.log('# of subjects: ' + levelSubjects.length);

      if (levelSubjects.length === 0) continue;

      const { data: chapters, error: chapErr } = await supabase
        .from('chapters')
        .select('id, subject_id')
        .in('subject_id', subjectIds);
      if (chapErr) console.error('Error fetching chapters:', chapErr.message);
      const chapterIds = chapters ? chapters.map(c => c.id) : [];
      console.log('# of chapters: ' + chapterIds.length);

      let topics: any[] = [];
      if (chapterIds.length > 0) {
        const { data, error } = await supabase
          .from('topics')
          .select('id, chapter_id, slug')
          .in('chapter_id', chapterIds);
        if (error) console.error('Error fetching topics:', error.message);
        else topics = data || [];
      }
      const topicIds = topics.map(t => t.id);
      console.log('# of topics: ' + topics.length);

      let topicsWithPractice = 0;
      if (topicIds.length > 0) {
        const { data, error } = await supabase
          .from('practice_items')
          .select('scope_id')
          .eq('scope_type', 'topic')
          .eq('status', 'published')
          .in('scope_id', topicIds);
        if (error) console.error('Error fetching practice items:', error.message);
        else {
          const uniqueTopicIds = new Set(data.map(p => p.scope_id));
          topicsWithPractice = uniqueTopicIds.size;
        }
      }
      console.log('# of topics that have at least one published practice item: ' + topicsWithPractice);
      console.log('# of topics that have at least one published lesson: (lessons table missing)');

      const { data: chunks, error: chunkErr } = await supabase
        .from('chunks')
        .select('id, topic_id, chapter_id, page')
        .in('chapter_id', chapterIds);
      
      const chunkData = chunks || [];
      console.log('# of chunks total (for these chapters): ' + chunkData.length);
      console.log('# of chunks linked to a topic: ' + chunkData.filter(c => c.topic_id).length);
      console.log('# of chunks linked to a chapter: ' + chunkData.filter(c => c.chapter_id).length);
      console.log('# of chunks with non-null page: ' + chunkData.filter(c => c.page !== null).length);

      console.log('\nPer-subject details:');
      for (const sub of levelSubjects) {
        const subChapters = chapters ? chapters.filter(c => c.subject_id === sub.id) : [];
        const subChapterIds = subChapters.map(c => c.id);
        const subTopics = topics.filter(t => subChapterIds.includes(t.chapter_id));
        const subTopicIds = subTopics.map(t => t.id);
        
        let subTopicsWithPractice = 0;
        if (subTopicIds.length > 0) {
          const { data } = await supabase
            .from('practice_items')
            .select('scope_id')
            .eq('scope_type', 'topic')
            .eq('status', 'published')
            .in('scope_id', subTopicIds);
          subTopicsWithPractice = new Set(data?.map(p => p.scope_id) || []).size;
        }

        console.log(- : Chapters: , Topics: , Practice: );
      }
    }
  } catch (e: any) {
    console.error('Fatal error:', e.message);
  }
}
run();

