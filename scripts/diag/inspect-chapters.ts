import { config } from "dotenv";
config({ path: ".env.local" });

import {
  getSubjectByCode,
  listChaptersBySubject,
  listTopicsByChapter,
} from "../../lib/curriculum/db";

async function main() {
  for (const [code, cls] of [
    ["FLO", 6],
    ["SSC", 7],
    ["SLE", 8],
  ] as const) {
    console.log(`\n=== ${code} class ${cls} ===`);
    const sub = await getSubjectByCode(code, "BSE_ODISHA", cls);
    if (!sub) {
      console.log("  (no subject row)");
      continue;
    }
    const chs = await listChaptersBySubject(sub.id);
    console.log(`  ${chs.length} chapters`);
    for (const ch of chs.slice(0, 5)) {
      const tops = await listTopicsByChapter(ch.id);
      console.log(`    ord=${ch.order} slug="${ch.slug}" title="${ch.title.en}" topics=${tops.length}`);
    }
    if (chs.length > 5) console.log(`    ... (+${chs.length - 5} more)`);
  }
}
main().then(() => process.exit(0));
