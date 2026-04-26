/**
 * Smoke test for Phase 5 retrieveForScope. Requires DB + GOOGLE_API_KEY.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { retrieveForScope } from "../../lib/ai/rag";

async function main() {
  const query = "What is a set? Give an example.";

  console.log("=== subject-scope (MTH) ===");
  const a = await retrieveForScope({
    query,
    board: "BSE_ODISHA",
    classLevel: 9,
    subjectCode: "MTH",
    k: 3,
    language: "or",
  });
  console.log(`hits: ${a.length}`);
  a.forEach((c, i) =>
    console.log(`  ${i + 1}. score=${c.score.toFixed(3)} p${c.page} ${c.content.slice(0, 80)}...`),
  );

  console.log("\n=== board+class only (subject=any) ===");
  const b = await retrieveForScope({
    query,
    board: "BSE_ODISHA",
    classLevel: 9,
    k: 3,
    language: "or",
  });
  console.log(`hits: ${b.length}`);
  b.forEach((c, i) =>
    console.log(`  ${i + 1}. score=${c.score.toFixed(3)} p${c.page} ${c.content.slice(0, 80)}...`),
  );

  console.log("\n=== unconstrained (baseline) ===");
  const c = await retrieveForScope({ query, k: 3, language: "or" });
  console.log(`hits: ${c.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
