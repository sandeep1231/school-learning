import { config } from "dotenv";
config({ path: ".env.local" });
import { getSubjectByCode, listChaptersBySubject, listTopicsByChapter } from "../../lib/curriculum/db";

async function main() {
  const board = "BSE_ODISHA";
  
  // 1. Class 6 FLO
  console.log("--- Class 6 FLO Chapters ---");
  const subjects = [];
  // Since we don't know the subjects yet, let's look at all subjects first via getSubjectByCode
  // But wait, getSubjectByCode is probably searching by the 'code' property and board and class.
  // The DbSubject type had 'classLevel', so let's check that too.
  
  // Actually, let's just try to list some chapters or topics if we can find any subject
  const floSubject = await getSubjectByCode(board, 6, "FLO");
  console.log("FLO Subject:", JSON.stringify(floSubject, null, 2));
  
  if (floSubject) {
    const floChapters = await listChaptersBySubject(floSubject.id);
    for (const ch of floChapters) {
      console.log(`ID: ${ch.id}, Order: ${ch.order}, Slug: ${ch.slug}, Title: ${ch.title.en}`);
    }
    
    const rainChapter = floChapters.find(ch => ch.slug === "rain") || floChapters.find(ch => ch.order === 1);
    if (rainChapter) {
      console.log(`--- Topics for Chapter: ${rainChapter.slug} ---`);
      const topics = await listTopicsByChapter(rainChapter.id);
      for (const t of topics) {
        console.log(`Topic: ${t.title.en} (Order: ${t.order})`);
      }
    }
  }

  // 2. Class 7 SSC
  console.log("\n--- Class 7 SSC Chapters ---");
  const sscSubject = await getSubjectByCode(board, 7, "SSC");
  console.log("SSC Subject:", JSON.stringify(sscSubject, null, 2));
  if (sscSubject) {
    const sscChapters = await listChaptersBySubject(sscSubject.id);
    for (const ch of sscChapters) {
      console.log(`Order: ${ch.order}, Slug: ${ch.slug}, Title: ${ch.title.en}`);
    }
    console.log(`Total Class 7 SSC Chapters: ${sscChapters.length}`);
  }
}

main().catch(console.error);
