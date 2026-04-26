import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { Client } from "pg";

dotenvConfig({ path: ".env.local" });

function parseConn(url: string) {
  const m = url.match(
    /^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:/]+)(?::(\d+))?\/([^?]+)/,
  );
  if (!m) throw new Error("Could not parse DATABASE_URL");
  return {
    user: decodeURIComponent(m[1]),
    password: decodeURIComponent(m[2]),
    host: m[3],
    port: m[4] ? Number(m[4]) : 5432,
    database: m[5],
  };
}

async function main() {
  const conn = parseConn(process.env.DATABASE_URL!);
  const client = new Client({ ...conn, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const docs = await client.query(
    `select d.title, d.language, d.source_type,
            (select count(*) from chunks c where c.document_id = d.id) as chunk_count
     from documents d order by d.title`,
  );
  console.log(`documents: ${docs.rowCount}`);
  for (const r of docs.rows) {
    console.log(
      `  · [${r.language}] ${r.title}  — ${r.chunk_count} chunks`,
    );
  }
  const total = await client.query(`select count(*) from chunks`);
  console.log(`\ntotal chunks: ${total.rows[0].count}`);
  await client.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
