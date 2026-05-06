import "dotenv/config";
import { config } from "dotenv";
import { createAdminClient } from "../../lib/supabase/admin";

config({ path: ".env.local" });

async function main() {
  const sb = createAdminClient();
  const { data: sample, count } = await sb
    .from("chunks")
    .select("id, page, document_id, topic_id, chapter_id", { count: "exact" })
    .limit(5);
  console.log("total chunks:", count);
  console.log("sample:", JSON.stringify(sample, null, 2));

  const { count: withPage } = await sb
    .from("chunks")
    .select("id", { count: "exact", head: true })
    .not("page", "is", null);
  console.log("with non-null page:", withPage);

  const { count: linkedToTopic } = await sb
    .from("chunks")
    .select("id", { count: "exact", head: true })
    .not("topic_id", "is", null);
  console.log("linked to topic:", linkedToTopic);

  const { count: linkedToChapter } = await sb
    .from("chunks")
    .select("id", { count: "exact", head: true })
    .not("chapter_id", "is", null);
  console.log("linked to chapter:", linkedToChapter);

  // Look at one document's chunk pages.
  const { data: docs } = await sb
    .from("documents")
    .select("id, title")
    .like("title", "[C8]%English_Story%")
    .limit(1);
  if (docs && docs[0]) {
    const docId = docs[0].id;
    console.log("\nsampling document:", docs[0].title, docId);
    const { data: dchunks } = await sb
      .from("chunks")
      .select("id, page, topic_id, chapter_id")
      .eq("document_id", docId)
      .order("page", { ascending: true })
      .limit(10);
    console.log("first 10 chunks:", JSON.stringify(dchunks, null, 2));
    const { data: pgRange } = await sb.rpc("noop_does_not_exist").select; // ignore
    // page range:
    const { data: minRow } = await sb
      .from("chunks")
      .select("page")
      .eq("document_id", docId)
      .order("page", { ascending: true })
      .limit(1)
      .maybeSingle();
    const { data: maxRow } = await sb
      .from("chunks")
      .select("page")
      .eq("document_id", docId)
      .order("page", { ascending: false })
      .limit(1)
      .maybeSingle();
    console.log("page min/max:", minRow?.page, maxRow?.page);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
