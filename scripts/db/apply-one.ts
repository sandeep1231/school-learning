import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import { Client } from "pg";
config({ path: ".env.local" });
const url = process.env.DATABASE_URL!;
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+)(?::(\d+))?\/([^?]+)/)!;
const c = new Client({ user: decodeURIComponent(m[1]), password: decodeURIComponent(m[2]), host: m[3], port: m[4] ? Number(m[4]) : 5432, database: m[5], ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  const file = process.argv[2];
  const sql = await readFile(file, "utf8");
  await c.query(sql);
  console.log("applied", file);
  const r = await c.query("select table_name from information_schema.tables where table_schema='public' and table_name in ('practice_items','attempts','item_flags') order by table_name");
  console.log(r.rows);
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
