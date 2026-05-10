/**
 * One-shot cleanup for existing lesson_variants rows.
 *
 * The lesson generator used to instruct the model to embed mermaid
 * diagrams and image markdown — both of which the LLM produced
 * inconsistently. Mermaid blocks frequently land in syntactic gray zones
 * that mermaid 11 rejects ("$...$" inside labels, colon-edge-labels,
 * Devanagari/Odia in node ids), and image URLs are typically
 * hallucinated (`example.com/foo.png`). The renderer now degrades both
 * gracefully, but the data itself is still cluttered.
 *
 * This script scans every `lesson_variants.body_md` and rewrites:
 *
 *   1. Fenced ```mermaid blocks  →  a "Diagram (described in text)"
 *      preamble + the source as an indented note. Keeps the diagram
 *      intent but removes the broken render.
 *
 *   2. Image markdown with placeholder URLs (example.com, placeholder,
 *      placehold.it, etc.)  →  removed; replaced with the alt text in
 *      italics so the lesson reads naturally without the broken icon.
 *
 *   3. Image markdown with any other URL is left alone (could be a real
 *      ingested asset).
 *
 * Idempotent. Safe to re-run. Pass --dry to preview the changes without
 * writing.
 *
 *   npx tsx scripts/content/cleanup-lesson-content.ts --dry
 *   npx tsx scripts/content/cleanup-lesson-content.ts
 *   npx tsx scripts/content/cleanup-lesson-content.ts --limit 50
 */
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { createAdminClient } from "../../lib/supabase/admin";
dotenvConfig({ path: ".env.local" });

type Args = { dryRun: boolean; limit: number | null };

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = { dryRun: false, limit: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry" || a === "--dry-run") out.dryRun = true;
    else if (a === "--limit") out.limit = Number(argv[++i]);
    else if (a.startsWith("--limit=")) out.limit = Number(a.slice(8));
  }
  return out;
}

const PLACEHOLDER_HOSTS = [
  "example.com",
  "example.org",
  "placeholder",
  "placehold.it",
  "placehold.co",
];

const MERMAID_BLOCK_RE = /```mermaid\s*\n([\s\S]*?)```/g;
const IMAGE_MD_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

function looksLikePlaceholderUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return PLACEHOLDER_HOSTS.some((h) => u.includes(h));
}

/**
 * Replace fenced ```mermaid blocks with a friendly "diagram described in
 * text" note. We keep the source as an indented quote so a future content
 * author can rewrite it as proper prose without losing the original
 * structure the model intended.
 */
function rewriteMermaid(body: string): { out: string; changed: boolean } {
  let changed = false;
  const out = body.replace(MERMAID_BLOCK_RE, (_match, source) => {
    changed = true;
    const indented = String(source)
      .split("\n")
      .map((l: string) => (l.length > 0 ? `> ${l}` : ">"))
      .join("\n");
    return `> 📊 **Diagram (described below).** Visualise the relationships in this lesson as the bullet steps that follow.\n${indented}\n`;
  });
  return { out, changed };
}

/**
 * Strip image markdown that points at placeholder URLs. Real-looking URLs
 * are left untouched (might be a future hosted asset). Replacement uses
 * the alt text wrapped in italics so the surrounding paragraph still
 * reads naturally.
 */
function rewriteImages(body: string): { out: string; changed: boolean } {
  let changed = false;
  const out = body.replace(IMAGE_MD_RE, (match, alt: string, url: string) => {
    if (!looksLikePlaceholderUrl(url)) return match;
    changed = true;
    const safeAlt = alt.trim() || "image";
    return `*[${safeAlt} — illustration omitted]*`;
  });
  return { out, changed };
}

async function main() {
  const args = parseArgs();
  const sb = createAdminClient();

  // Pull rows that have at least one of the patterns. Using ilike for
  // mermaid (rare enough to be a meaningful filter) and a separate pass
  // for image URLs.
  console.log("Scanning lesson_variants…");
  let from = 0;
  const PAGE = 200;
  let totalSeen = 0;
  let totalChanged = 0;
  let totalMermaid = 0;
  let totalImg = 0;

  for (;;) {
    const { data, error } = await sb
      .from("lesson_variants")
      .select("id, body_md")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error(error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      totalSeen += 1;
      const body = row.body_md as string;
      if (!body) continue;
      const hasMermaid = body.includes("```mermaid");
      const hasImg = /!\[[^\]]*\]\([^)]+\)/.test(body);
      if (!hasMermaid && !hasImg) continue;

      const m = rewriteMermaid(body);
      const i = rewriteImages(m.out);
      if (!m.changed && !i.changed) continue;

      totalChanged += 1;
      if (m.changed) totalMermaid += 1;
      if (i.changed) totalImg += 1;

      if (!args.dryRun) {
        const { error: upErr } = await sb
          .from("lesson_variants")
          .update({ body_md: i.out })
          .eq("id", row.id);
        if (upErr) {
          console.error(`update ${row.id} failed: ${upErr.message}`);
        }
      }
      if (args.limit && totalChanged >= args.limit) break;
    }

    if (data.length < PAGE) break;
    if (args.limit && totalChanged >= args.limit) break;
    from += PAGE;
  }

  console.log(
    `\n✓ scanned=${totalSeen} updated=${totalChanged} mermaidRewrites=${totalMermaid} imageRewrites=${totalImg}${
      args.dryRun ? " (dry run, no writes)" : ""
    }`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
