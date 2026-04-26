/**
 * Run all SQL migrations + seed against DATABASE_URL from .env.local.
 * Idempotent: each migration file is guarded inside the SQL itself
 * (CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE FUNCTION / etc.).
 *
 * Usage:
 *   npx tsx scripts/db/migrate.ts            # run all migrations + seed
 *   npx tsx scripts/db/migrate.ts --no-seed  # migrations only
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { Client } from "pg";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

// Parse the URL manually so we pass password as a separate field. This avoids
// double-decoding issues with special characters like "@" in the password.
function parseConn(url: string) {
  const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:/]+)(?::(\d+))?\/([^?]+)/);
  if (!m) throw new Error("Could not parse DATABASE_URL");
  return {
    user: decodeURIComponent(m[1]),
    password: decodeURIComponent(m[2]),
    host: m[3],
    port: m[4] ? Number(m[4]) : 5432,
    database: m[5],
  };
}
const conn = parseConn(connectionString);

const args = new Set(process.argv.slice(2));
const runSeed = !args.has("--no-seed");

async function runFile(client: Client, file: string, label: string) {
  const sql = await readFile(file, "utf8");
  console.log(`\n▶ ${label}: ${path.basename(file)} (${sql.length} bytes)`);
  try {
    await client.query(sql);
    console.log(`  ✓ applied`);
  } catch (err: unknown) {
    const e = err as { message?: string; position?: string };
    console.error(`  ✗ failed: ${e.message ?? err}`);
    throw err;
  }
}

async function main() {
  const client = new Client({
    host: conn.host,
    port: conn.port,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log(`Connected to Postgres @ ${conn.host}:${conn.port}/${conn.database} as ${conn.user}.`);

  try {
    // Ensure pgvector + pgcrypto extensions (idempotent).
    await client.query(`create extension if not exists pgcrypto;`);
    await client.query(`create extension if not exists vector;`);
    console.log("Extensions ensured: pgcrypto, vector.");

    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const f of files) {
      await runFile(client, path.join(migrationsDir, f), "migration");
    }

    if (runSeed) {
      const seedPath = path.join(process.cwd(), "supabase", "seed.sql");
      await runFile(client, seedPath, "seed");
    } else {
      console.log("\n(Seed skipped per --no-seed flag.)");
    }

    const subj = await client.query(
      `select count(*)::int as n from public.subjects`,
    );
    const topics = await client.query(
      `select count(*)::int as n from public.topics`,
    );
    console.log(
      `\nDB state: subjects=${subj.rows[0].n}, topics=${topics.rows[0].n}`,
    );
  } finally {
    await client.end();
  }
  console.log("\n✓ Done.");
}

main().catch((err) => {
  console.error("\nMigration run failed.");
  console.error(err);
  process.exit(1);
});
