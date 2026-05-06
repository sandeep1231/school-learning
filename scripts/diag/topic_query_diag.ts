import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function checkTopic() {
    const slug = 'c9-gsc-ch19-t6';
    const { data: topic, error: topicError } = await supa
        .from('topics')
        .select('*, chapter:chapters(*)')
        .eq('slug', slug)
        .single();

    if (topicError || !topic) {
        console.error('Topic not found:', topicError);
        return;
    }

    console.log('Results:');
    console.log('topic title_en:', topic.title_en);
    console.log('title_or:', topic.title_or);
    console.log('chapter title_en:', topic.chapter?.title_en);
    console.log('learning_objectives:', JSON.stringify(topic.learning_objectives));
    console.log('approx_duration_min:', topic.approx_duration_min);
}

checkTopic();
