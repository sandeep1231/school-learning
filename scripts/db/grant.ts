/**
 * Re-apply Supabase role grants on public schema.
 * Needed after a schema reset because Supabase's default-privileges magic
 * only kicks in for objects created under the normal managed DDL path.
 */
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
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const conn = parseConn(url);
  const client = new Client({ ...conn, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const sql = `
    -- Make sure the standard Supabase roles can see & use public.
    grant usage on schema public to anon, authenticated, service_role;

    -- Service role bypasses RLS but still needs explicit privilege grants.
    grant all on all tables    in schema public to service_role;
    grant all on all sequences in schema public to service_role;
    grant all on all functions in schema public to service_role;

    -- anon/authenticated get read+write subject to RLS policies.
    grant select, insert, update, delete on all tables    in schema public to authenticated;
    grant usage, select                   on all sequences in schema public to authenticated;
    grant execute                         on all functions in schema public to authenticated;

    grant select on all tables    in schema public to anon;
    grant usage, select on all sequences in schema public to anon;
    grant execute      on all functions in schema public to anon;

    -- Future objects inherit the same grants.
    alter default privileges in schema public
      grant all on tables    to service_role;
    alter default privileges in schema public
      grant all on sequences to service_role;
    alter default privileges in schema public
      grant all on functions to service_role;

    alter default privileges in schema public
      grant select, insert, update, delete on tables to authenticated;
    alter default privileges in schema public
      grant usage, select on sequences to authenticated;
    alter default privileges in schema public
      grant execute on functions to authenticated;

    alter default privileges in schema public
      grant select on tables to anon;
  `;
  await client.query(sql);
  await client.end();
  console.log("✓ grants applied to public schema");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
