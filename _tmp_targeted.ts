/**
 * Final spot-check: do my new resolveTopicUuidByslug + topicHas* queries
 * agree on the real slugs the DB uses?
 */
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { createAdminClient } from "./lib/supabase/admin";
dotenvConfig({ path: ".env.local" });

const SLUGS = [
  "mth-1-1",
  "mth-2-1",
  "ssc-6-1",
  "ssc-e1-1",
  "c9-gsc-ch16-t1",
  "c9-flo-ch12-t1",
  "c9-tlh-ch12-t1",
  "c9-sle-ch14-t1",
];

(async () => {
  const sb = createAdminClient();
  console.log(`\n${"slug".padEnd(20)} | uuid (8 chars) | lessons | pub-practice`);
  console.log("-".repeat(70));
  for (const slug of SLUGS) {
    const { data: t } = await sb
      .from("topics")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!t) {
      console.log(`${slug.padEnd(20)} | NOT FOUND`);
      continue;
    }
    const [{ count: lc }, { count: pc }] = await Promise.all([
      sb
        .from("lesson_variants")
        .select("id", { head: true, count: "exact" })
        .eq("topic_id", t.id),
      sb
        .from("practice_items")
        .select("id", { head: true, count: "exact" })
        .eq("scope_type", "topic")
        .eq("scope_id", t.id)
        .eq("status", "published"),
    ]);
    console.log(
      `${slug.padEnd(20)} | ${t.id.slice(0, 8)}…   |   ${String(lc).padStart(3)}   |     ${String(pc).padStart(3)}`,
    );
  }
})();
