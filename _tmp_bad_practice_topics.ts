/**
 * Identify every topic whose published practice items violate the current
 * schema, so we can pass the slug list to `generate-practice --force`.
 *
 * Violations covered:
 *   - mcq missing/short misconceptions array
 *   - mcq with options.length != 4
 *   - topic with 0 published practice items (after generate failed)
 */
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { createAdminClient } from "./lib/supabase/admin";
dotenvConfig({ path: ".env.local" });

(async () => {
  const sb = createAdminClient();
  const { data: subs } = await sb
    .from("subjects")
    .select("id,code,class_level")
    .eq("board", "BSE_ODISHA")
    .in("class_level", [6, 7, 8, 9])
    .order("class_level");

  const badSlugs = new Set<string>();
  for (const s of subs ?? []) {
    const { data: chs } = await sb.from("chapters").select("id").eq("subject_id", s.id);
    const cIds = (chs ?? []).map((c: any) => c.id);
    if (cIds.length === 0) continue;
    const { data: tps } = await sb
      .from("topics")
      .select("id,slug")
      .in("chapter_id", cIds);
    const slugById = new Map<string, string>();
    for (const t of tps ?? []) slugById.set(t.id, t.slug);
    const tIds = (tps ?? []).map((t: any) => t.id);
    if (tIds.length === 0) continue;

    const { data: items } = await sb
      .from("practice_items")
      .select("scope_id,kind,payload,status")
      .eq("scope_type", "topic")
      .in("scope_id", tIds);
    const byTopic = new Map<string, any[]>();
    for (const it of items ?? []) {
      if (it.status !== "published") continue;
      (byTopic.get(it.scope_id) ?? byTopic.set(it.scope_id, []).get(it.scope_id))!.push(it);
    }
    for (const t of tps ?? []) {
      const its = byTopic.get(t.id) ?? [];
      if (its.length === 0) {
        badSlugs.add(t.slug);
        continue;
      }
      for (const it of its) {
        if (it.kind !== "mcq") continue;
        const p = it.payload ?? {};
        const opts = Array.isArray(p.options) ? p.options : [];
        const mis = Array.isArray(p.misconceptions) ? p.misconceptions : null;
        if (opts.length !== 4) badSlugs.add(t.slug);
        if (!mis || mis.length !== opts.length) badSlugs.add(t.slug);
      }
    }
  }
  const list = Array.from(badSlugs).sort();
  console.log(`Found ${list.length} topics needing practice regen:`);
  for (const s of list) console.log(`  ${s}`);
  console.log(`\nCSV: ${list.join(",")}`);
})();
