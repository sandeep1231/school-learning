/**
 * Download BSE Odisha Class 9 public syllabus + textbook PDFs into data/raw/.
 * Free-tier pipeline — no API keys needed for this step.
 *
 *   npm run ingest:fetch
 *
 * Then run `npm run ingest:embed` to chunk+embed them into Supabase.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SYLLABUS_PDF =
  "https://cdn.bseodisha.ac.in/images12/Subject_wise_syllabus_class_IX_25_26.pdf";
const TEXTBOOK_LIST = "https://bseodisha.ac.in/CL-IX-Text-Book.html";

const RAW_DIR = join(process.cwd(), "data", "raw");

async function download(url: string, filename: string): Promise<string> {
  mkdirSync(RAW_DIR, { recursive: true });
  const dest = join(RAW_DIR, filename);
  if (existsSync(dest)) {
    console.log(`[skip] ${filename} already present`);
    return dest;
  }
  console.log(`[get]  ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

async function main() {
  try {
    await download(SYLLABUS_PDF, "bse_class9_syllabus_25_26.pdf");
  } catch (e) {
    console.warn(`[warn] syllabus: ${(e as Error).message}`);
  }

  try {
    const res = await fetch(TEXTBOOK_LIST);
    const html = await res.text();
    writeFileSync(join(RAW_DIR, "cl_ix_textbook_list.html"), html);
    const pdfLinks = Array.from(
      html.matchAll(/href=["']([^"']+\.pdf)["']/gi),
    ).map((m) => new URL(m[1], TEXTBOOK_LIST).toString());
    console.log(`Found ${pdfLinks.length} textbook PDF links.`);
    for (const link of pdfLinks) {
      const name = decodeURIComponent(link.split("/").pop() ?? "textbook.pdf");
      try {
        await download(link, name);
      } catch (e) {
        console.warn(`[warn] ${name}: ${(e as Error).message}`);
      }
    }
  } catch (e) {
    console.warn(`[warn] textbook list: ${(e as Error).message}`);
  }

  console.log(
    `\nDone. Files are in data/raw/. Next: \`npm run ingest:embed\`.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
