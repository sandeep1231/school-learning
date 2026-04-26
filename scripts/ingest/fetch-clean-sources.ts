/**
 * Phase 7.2 — procure clean Unicode Class 9 textbook PDFs.
 *
 * BSE Odisha's official PDFs use a legacy AU_OTF-style Odia font that extracts
 * as CP1252 mojibake. We replace them with NCERT Class 9 PDFs (Unicode-clean)
 * for shared subjects (MTH, GSC, SSC, SLE, TLH) and keep FLO on a best-effort
 * path. NCERT URLs follow the pattern:
 *   https://ncert.nic.in/textbook/pdf/<code>.pdf
 * where <code> is like `iemh101` (English math ch1), `jesc101` (science ch1).
 *
 * Output: data/raw/clean/<subject-code>/<source>/<filename>.pdf
 * Leaves data/raw/*.pdf untouched (those become reference only).
 *
 * Run:   npx tsx scripts/ingest/fetch-clean-sources.ts [--subject=MTH]
 */
import "dotenv/config";
import { mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const CLEAN_DIR = join(process.cwd(), "data", "raw", "clean");

interface Source {
  subject: "MTH" | "GSC" | "SSC" | "SLE" | "TLH" | "FLO";
  provider: "ncert" | "bse" | "diksha";
  filename: string;
  url: string;
  language: "en" | "or" | "hi";
}

/**
 * NCERT Class 9 catalogue.
 * Codes decoded from ncert.nic.in/textbook.php?fe*=* and ?iemh*=* etc.
 *   iemh = English medium math     jemh = Hindi medium math
 *   iesc = English medium science  jesc = Hindi medium science
 *   iess = English medium social   jess = Hindi medium social
 *   iee1 = Beehive (English L2)    iel1 = Moments
 *   ihhd = Hindi Kshitij           ihhk = Kritika
 *   ihhs = Sparsh (Hindi)          ihhn = Sanchayan
 */
const NCERT_CLASS9: Source[] = [
  // Mathematics — preface + up to 15 chapters (2024 revision has 12; 404s are skipped)
  {
    subject: "MTH",
    provider: "ncert",
    filename: "ncert_mth_prelim.pdf",
    url: "https://ncert.nic.in/textbook/pdf/iemhps.pdf",
    language: "en",
  },
  ...Array.from({ length: 15 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      subject: "MTH" as const,
      provider: "ncert" as const,
      filename: `ncert_mth_ch${n}.pdf`,
      url: `https://ncert.nic.in/textbook/pdf/iemh1${n}.pdf`,
      language: "en" as const,
    };
  }),
  // Science — 12 chapters
  ...Array.from({ length: 12 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      subject: "GSC" as const,
      provider: "ncert" as const,
      filename: `ncert_gsc_ch${n}.pdf`,
      url: `https://ncert.nic.in/textbook/pdf/iesc1${n}.pdf`,
      language: "en" as const,
    };
  }),
  // Social Science: India & Contemporary World-I (History, 5 ch) — hes1XX
  ...Array.from({ length: 5 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      subject: "SSC" as const,
      provider: "ncert" as const,
      filename: `ncert_ssc_history_ch${n}.pdf`,
      url: `https://ncert.nic.in/textbook/pdf/iess3${n}.pdf`,
      language: "en" as const,
    };
  }),
  // Contemporary India-I (Geography, 6 ch)
  ...Array.from({ length: 6 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      subject: "SSC" as const,
      provider: "ncert" as const,
      filename: `ncert_ssc_geog_ch${n}.pdf`,
      url: `https://ncert.nic.in/textbook/pdf/iess1${n}.pdf`,
      language: "en" as const,
    };
  }),
  // Democratic Politics-I (Civics, 5 ch)
  ...Array.from({ length: 5 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      subject: "SSC" as const,
      provider: "ncert" as const,
      filename: `ncert_ssc_civics_ch${n}.pdf`,
      url: `https://ncert.nic.in/textbook/pdf/iess2${n}.pdf`,
      language: "en" as const,
    };
  }),
  // Economics (5 ch)
  ...Array.from({ length: 5 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      subject: "SSC" as const,
      provider: "ncert" as const,
      filename: `ncert_ssc_econ_ch${n}.pdf`,
      url: `https://ncert.nic.in/textbook/pdf/iess4${n}.pdf`,
      language: "en" as const,
    };
  }),
  // English — Beehive (main reader, 11 units)
  ...Array.from({ length: 11 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      subject: "SLE" as const,
      provider: "ncert" as const,
      filename: `ncert_sle_beehive_ch${n}.pdf`,
      url: `https://ncert.nic.in/textbook/pdf/iebe1${n}.pdf`,
      language: "en" as const,
    };
  }),
  // English — Moments (supplementary, 9 stories)
  ...Array.from({ length: 9 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      subject: "SLE" as const,
      provider: "ncert" as const,
      filename: `ncert_sle_moments_ch${n}.pdf`,
      url: `https://ncert.nic.in/textbook/pdf/iemo1${n}.pdf`,
      language: "en" as const,
    };
  }),
  // Hindi — Kshitij (17 lessons) — NCERT code `ihhd1XX`
  ...Array.from({ length: 17 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      subject: "TLH" as const,
      provider: "ncert" as const,
      filename: `ncert_tlh_kshitij_ch${n}.pdf`,
      url: `https://ncert.nic.in/textbook/pdf/ihhd1${n}.pdf`,
      language: "hi" as const,
    };
  }),
  // Hindi — Kritika (5 lessons) — NCERT code `ihhk1XX`
  ...Array.from({ length: 5 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      subject: "TLH" as const,
      provider: "ncert" as const,
      filename: `ncert_tlh_kritika_ch${n}.pdf`,
      url: `https://ncert.nic.in/textbook/pdf/ihhk1${n}.pdf`,
      language: "hi" as const,
    };
  }),
  // Hindi — Sparsh (Hindi-B reader, 13 lessons) — NCERT code `ihsp1XX`
  ...Array.from({ length: 13 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      subject: "TLH" as const,
      provider: "ncert" as const,
      filename: `ncert_tlh_sparsh_ch${n}.pdf`,
      url: `https://ncert.nic.in/textbook/pdf/ihsp1${n}.pdf`,
      language: "hi" as const,
    };
  }),
  // Hindi — Sanchayan (supplementary, 6 lessons) — NCERT code `ihsn1XX`
  ...Array.from({ length: 6 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      subject: "TLH" as const,
      provider: "ncert" as const,
      filename: `ncert_tlh_sanchayan_ch${n}.pdf`,
      url: `https://ncert.nic.in/textbook/pdf/ihsn1${n}.pdf`,
      language: "hi" as const,
    };
  }),
];

/**
 * BSE Odisha — FLO (Odia First Language) is the hard one. Try the official
 * CDN with known filenames first; those might be Unicode-clean even when
 * the Akruti-family mirrors we already have are not. If all fail, we fall
 * back to sourcing from DIKSHA in a later step.
 *
 * NOTE: URLs below are best guesses based on typical BSE CDN layout — we log
 *       and continue on any 404 rather than blowing up. Confirmed URLs can
 *       be added later.
 */
const BSE_FLO: Source[] = [
  // Best-effort BSE CDN guesses
  {
    subject: "FLO",
    provider: "bse",
    filename: "bse_flo_sahitya_dhara.pdf",
    url: "https://cdn.bseodisha.ac.in/images12/CL-9-Sahitya-Dhara.pdf",
    language: "or",
  },
  {
    subject: "FLO",
    provider: "bse",
    filename: "bse_flo_vyakarana.pdf",
    url: "https://cdn.bseodisha.ac.in/images12/CL-9-Odia-Vyakarana.pdf",
    language: "or",
  },
  // Odisha state e-textbook portal alternates
  {
    subject: "FLO",
    provider: "diksha",
    filename: "odisha_flo_sahitya_dhara.pdf",
    url: "https://schooleducation.odisha.gov.in/sites/default/files/textbook/2024-04/Sahitya%20Dhara%20IX.pdf",
    language: "or",
  },
  {
    subject: "FLO",
    provider: "diksha",
    filename: "odisha_flo_odia_vyakarana.pdf",
    url: "https://schooleducation.odisha.gov.in/sites/default/files/textbook/2024-04/Odia%20Vyakarana%20IX.pdf",
    language: "or",
  },
];

const ALL: Source[] = [...NCERT_CLASS9, ...BSE_FLO];

async function download(s: Source): Promise<"ok" | "skip" | "fail"> {
  const dir = join(CLEAN_DIR, s.subject, s.provider);
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, s.filename);
  if (existsSync(dest) && statSync(dest).size > 10_000) return "skip";

  try {
    const res = await fetch(s.url, {
      headers: { "User-Agent": "Mozilla/5.0 SikhyaSathi-Ingest/1.0" },
    });
    if (!res.ok) {
      console.warn(`  ✗ ${s.filename}: HTTP ${res.status}`);
      return "fail";
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 5_000 || !buf.slice(0, 4).toString().startsWith("%PDF")) {
      console.warn(`  ✗ ${s.filename}: not a PDF (${buf.length} bytes)`);
      return "fail";
    }
    writeFileSync(dest, buf);
    console.log(`  ✓ ${s.filename}  (${(buf.length / 1024).toFixed(0)} KB)`);
    return "ok";
  } catch (e) {
    console.warn(`  ✗ ${s.filename}: ${(e as Error).message}`);
    return "fail";
  }
}

async function main() {
  const args = process.argv.slice(2);
  const subjectArg = args.find((a) => a.startsWith("--subject="))?.split("=")[1];
  const list = subjectArg ? ALL.filter((s) => s.subject === subjectArg) : ALL;
  console.log(`Fetching ${list.length} sources${subjectArg ? ` for ${subjectArg}` : ""}…`);

  const tally = { ok: 0, skip: 0, fail: 0 };
  const failed: string[] = [];
  for (const s of list) {
    const r = await download(s);
    tally[r]++;
    if (r === "fail") failed.push(`${s.subject} ${s.filename} ← ${s.url}`);
  }

  console.log(`\nDone.  ok=${tally.ok}  skip=${tally.skip}  fail=${tally.fail}`);
  if (failed.length) {
    console.log(`\nFailed URLs (add alternatives or purchase):`);
    failed.forEach((f) => console.log(`  - ${f}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
