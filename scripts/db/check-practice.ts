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
    "select t.slug, pi.kind, pi.difficulty, count(*)::int as n from practice_items pi join topics t on t.id=pi.scope_id where pi.status='published' group by t.slug, pi.kind, pi.difficulty order by t.slug, pi.kind, pi.difficulty",
  );
  console.table(r.rows);
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
