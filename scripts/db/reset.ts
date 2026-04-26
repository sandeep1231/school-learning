import { config as loadEnv } from "dotenv";
import { Client } from "pg";
import path from "node:path";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

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

  try {
    await client.query("drop schema if exists public cascade;");
    await client.query("create schema public;");
    await client.query("grant usage on schema public to postgres, anon, authenticated, service_role;");
    await client.query("grant all on schema public to postgres, service_role;");
    console.log("public schema reset");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
