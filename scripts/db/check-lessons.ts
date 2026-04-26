import { config } from "dotenv";
import { Client } from "pg";
config({ path: ".env.local" });
const url = process.env.DATABASE_URL!;
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+)(?::(\d+))?\/([^?]+)/)!;
const c = new Client({
  user: decodeURIComponent(m[1]),
  password: decodeURIComponent(m[2]),
  host: m[3],
  port: m[4] ? Number(m[4]) : 5432,
  database: m[5],
  ssl: { rejectUnauthorized: false },
});
(async () => {
  await c.connect();
  const r = await c.query(
    "select t.slug, lv.variant, length(lv.body_md) as body_len, jsonb_array_length(coalesce((lv.parent_prompts->'questions'),'[]'::jsonb)) as q_count from lesson_variants lv join topics t on t.id=lv.topic_id order by t.slug, lv.variant",
  );
  console.table(r.rows);
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
