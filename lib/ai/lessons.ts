// Demo lesson generator for the Learn stage.
// In production, Gemini generates these grounded on RAG chunks from the
// actual textbook PDFs. In demo mode we ship a curated set of lessons
// lifted from the BSE Odisha Class 9 Madhyamik Bijaganit textbook and
// Bhugola O Arthaniti Ch.6.

import type { DemoTopic } from "@/lib/curriculum/bse-class9";
import { findTopic } from "@/lib/curriculum/bse-class9";

export type Lesson = {
  topicId: string;
  language: "en" | "or" | "hi";
  titleOr: string;
  titleEn: string;
  sections: Array<{ heading: string; body: string }>;
  workedExamples: Array<{ problem: string; solution: string }>;
  citations: Array<{ title: string; page?: string; url?: string }>;
};

const NCERT = "NCERT Mathematics IX";
const BSE_BIJAGANIT = "BSE Odisha — ମାଧ୍ୟମିକ ବୀଜଗଣିତ (Class IX)";
const BSE_BHUGOLA = "BSE Odisha — ଭୂଗୋଳ ଓ ଅର୍ଥନୀତି (Class IX)";

const LESSONS: Record<string, Lesson> = {
  "mth-1-1": {
    topicId: "mth-1-1",
    language: "or",
    titleOr: "ସେଟ୍ ଓ ଏହାର ଉପାଦାନ",
    titleEn: "Sets and their elements",
    sections: [
      {
        heading: "ସେଟ୍ କ'ଣ?",
        body:
          "ସେଟ୍ ହେଉଛି କେତେକ ନିର୍ଦ୍ଦିଷ୍ଟ ବସ୍ତୁର ସମାବେଶ। ପ୍ରତ୍ୟେକ ବସ୍ତୁକୁ ସେଟ୍ ର ଉପାଦାନ (element) କୁହାଯାଏ। ଯଦି 'x' ସେଟ୍ S ର ଉପାଦାନ, ତେବେ x ∈ S ଲେଖାଯାଏ; ନଚେତ x ∉ S।",
      },
      {
        heading: "ପ୍ରକାଶର ଦୁଇ ପ୍ରଣାଳୀ",
        body:
          "୧) ତାଲିକା ପ୍ରଣାଳୀ (Roster): S = {1, 2, 3, 4, 5}।\n୨) ସୂତ୍ର ପ୍ରଣାଳୀ (Set-builder): S = { x : x ଏକ ସ୍ୱାଭାବିକ ସଂଖ୍ୟା ଏବଂ 1 ≤ x ≤ 5 }।",
      },
      {
        heading: "ମୁଖ୍ୟ ସଂକଳ୍ପ",
        body:
          "• ସସୀମ ଓ ଅସୀମ ସେଟ୍\n• ଶୂନ୍ୟ ସେଟ୍ φ = { }\n• A ⊂ B: A, B ର ଉପସେଟ୍\n• ସମତା: A = B, ଯଦି A ⊂ B ଏବଂ B ⊂ A।",
      },
    ],
    workedExamples: [
      {
        problem:
          "S = { x : x ଏକ ସ୍ୱାଭାବିକ ସଂଖ୍ୟା ଏବଂ 2 ≤ x ≤ 6 } କୁ ତାଲିକା ପ୍ରଣାଳୀରେ ଲେଖ।",
        solution: "S = {2, 3, 4, 5, 6}।",
      },
      {
        problem: "A = {a, b, c} ର ଉପସେଟ୍ ଗୁଡ଼ିକ ଗଣନା କର।",
        solution:
          "φ, {a}, {b}, {c}, {a,b}, {a,c}, {b,c}, {a,b,c} — ମୋଟ ୨³ = ୮ ଟି।",
      },
    ],
    citations: [
      { title: BSE_BIJAGANIT, page: "୧-୩" },
      { title: NCERT, page: "Ch.1" },
    ],
  },

  "mth-1-3": {
    topicId: "mth-1-3",
    language: "or",
    titleOr: "ସଂଯୋଗ, ଛେଦ ଓ ଅନ୍ତର",
    titleEn: "Union, Intersection and Difference",
    sections: [
      {
        heading: "ତିନୋଟି ମୁଖ୍ୟ ପ୍ରକ୍ରିୟା",
        body:
          "ଦୁଇଟି ସେଟ୍ A ଓ B ମଧ୍ୟରେ ତିନିଗୋଟି ଦ୍ୱୈତ ପ୍ରକ୍ରିୟା:\n• ସଂଯୋଗ (Union) A ∪ B = { x : x ∈ A କିମ୍ବା x ∈ B }\n• ଛେଦ (Intersection) A ∩ B = { x : x ∈ A ଏବଂ x ∈ B }\n• ଅନ୍ତର (Difference) A − B = { x : x ∈ A ଏବଂ x ∉ B }।",
      },
      {
        heading: "ନିୟମଗୁଡ଼ିକ",
        body:
          "୧. କ୍ରମବିନିମୟୀ: A ∪ B = B ∪ A; A ∩ B = B ∩ A\n୨. ସହଯୋଗୀ: (A ∪ B) ∪ C = A ∪ (B ∪ C)\n୩. ବଣ୍ଟନ: A ∩ (B ∪ C) = (A ∩ B) ∪ (A ∩ C)",
      },
    ],
    workedExamples: [
      {
        problem: "A = {1,2,3,4}, B = {3,4,5,6} ହେଲେ A ∪ B ଓ A ∩ B ନିର୍ଣ୍ଣୟ କର।",
        solution:
          "A ∪ B = {1,2,3,4,5,6}\nA ∩ B = {3,4}। ଦ୍ରଷ୍ଟବ୍ୟ: |A ∪ B| = |A| + |B| − |A ∩ B| = 4 + 4 − 2 = 6।",
      },
    ],
    citations: [{ title: BSE_BIJAGANIT, page: "୩-୭" }],
  },

  "mth-2-1": {
    topicId: "mth-2-1",
    language: "or",
    titleOr: "ସ୍ୱାଭାବିକ, ପୂର୍ଣ୍ଣ, ପରିମେୟ ସଂଖ୍ୟା",
    titleEn: "Natural numbers, Integers and Rational numbers",
    sections: [
      {
        heading: "ସଂଖ୍ୟା ଗଣର ବିକାଶ",
        body:
          "ଗଣନା ପାଇଁ ସ୍ୱାଭାବିକ ସଂଖ୍ୟା ଜନ୍ମ ନେଇଥିଲା: N = {1, 2, 3, ...}। ଶୂନ୍ୟକୁ ମିଶାଇଲେ W = {0, 1, 2, ...}; ଋଣାତ୍ମକ ପୂର୍ଣ୍ଣ ସଂଖ୍ୟା ସହ ମିଶାଇଲେ Z = {..., −2, −1, 0, 1, 2, ...}।",
      },
      {
        heading: "ପରିମେୟ ସଂଖ୍ୟା",
        body:
          "ଯେକୌଣସି ସଂଖ୍ୟାକୁ p/q ଆକାରରେ ଲେଖିହେବ (ଯେଉଁଠାରେ p, q ∈ Z ଏବଂ q ≠ 0) ସେହି ସଂଖ୍ୟା ହେଉଛି ପରିମେୟ ସଂଖ୍ୟା। Q ସେଟ୍ ଯୋଗ, ବିୟୋଗ, ଗୁଣନ ଓ ହରଣ ପ୍ରକ୍ରିୟା ପ୍ରତି ସଂଭୁଦ୍ଧ (closed)।",
      },
      {
        heading: "N ⊂ Z ⊂ Q",
        body:
          "ପ୍ରତ୍ୟେକ ସ୍ୱାଭାବିକ ସଂଖ୍ୟା ଏକ ପୂର୍ଣ୍ଣ ସଂଖ୍ୟା, ଏବଂ ପ୍ରତ୍ୟେକ ପୂର୍ଣ୍ଣ ସଂଖ୍ୟା ଏକ ପରିମେୟ ସଂଖ୍ୟା। ଯଥା: 5 = 5/1; ସ୍ୱତରାଂ N ⊂ Z ⊂ Q।",
      },
    ],
    workedExamples: [
      {
        problem: "0.75 କୁ p/q ଆକାରରେ ଲେଖ।",
        solution: "0.75 = 75/100 = 3/4। ଏହା ଏକ ପରିମେୟ ସଂଖ୍ୟା।",
      },
    ],
    citations: [{ title: BSE_BIJAGANIT, page: "୨୦-୨୨" }],
  },

  "mth-2-2": {
    topicId: "mth-2-2",
    language: "or",
    titleOr: "ଅପରିମେୟ ସଂଖ୍ୟା",
    titleEn: "Irrational Numbers",
    sections: [
      {
        heading: "କ'ଣ ଅପରିମେୟ?",
        body:
          "ଯେଉଁ ସଂଖ୍ୟାକୁ p/q ଆକାରରେ ଲେଖିହୁଏ ନାହିଁ (ଯେଉଁଠାରେ p, q ∈ Z, q ≠ 0), ତାହା ଅପରିମେୟ ସଂଖ୍ୟା। ଯଥା: √2, √3, √5, π ଆଦି।",
      },
      {
        heading: "√2 ଅପରିମେୟ — ପ୍ରମାଣ (ବିରୋଧାଭାସ)",
        body:
          "ମନ କର √2 = p/q (p, q ର ସାଧାରଣ ଗୁଣନୀୟକ 1)। ତେଣୁ 2q² = p², ଅର୍ଥାତ୍ p² ଯୁଗ୍ମ, ତେଣୁ p ଯୁଗ୍ମ। p = 2k ରଖିଲେ q² = 2k², ତେଣୁ q ମଧ୍ୟ ଯୁଗ୍ମ। ମାତ୍ର p, q ଉଭୟ ଯୁଗ୍ମ ହେବା ଆମର ପୂର୍ବ ଅନୁମାନ ବିରୋଧୀ। ଅତଏବ √2 ପରିମେୟ ନୁହେଁ।",
      },
    ],
    workedExamples: [
      {
        problem: "3 + √2 ପରିମେୟ ନା ଅପରିମେୟ?",
        solution:
          "ମନ କର 3 + √2 = p/q (ପରିମେୟ)। ତାହେଲେ √2 = p/q − 3 = (p − 3q)/q, ଯାହା ପରିମେୟ ହେବ। ମାତ୍ର √2 ଅପରିମେୟ — ବିରୋଧାଭାସ। ତେଣୁ 3 + √2 ଅପରିମେୟ।",
      },
    ],
    citations: [{ title: BSE_BIJAGANIT, page: "୩୩-୩୫" }],
  },

  "ssc-6-1": {
    topicId: "ssc-6-1",
    language: "or",
    titleOr: "ସଡ଼କ ଦୁର୍ଘଟଣା",
    titleEn: "Road Accidents",
    sections: [
      {
        heading: "ବର୍ତ୍ତମାନର ପରିସ୍ଥିତି",
        body:
          "ସଡ଼କ ଦୁର୍ଘଟଣା ଭାରତ ସମେତ ସମଗ୍ର ପୃଥିବୀରେ ଏକ ଗମ୍ଭୀର ସମସ୍ୟା। ୨୦୨୧ ତଥ୍ୟ ଅନୁଯାୟୀ ଭାରତରେ ପ୍ରତିଦିନ ପ୍ରାୟ ୧୨୦୦ ରୁ ଊର୍ଦ୍ଧ୍ୱ ଦୁର୍ଘଟଣା ଘଟୁଛି ଏବଂ ପ୍ରାୟ ୪୪୦ ଜଣ ବ୍ୟକ୍ତି ପ୍ରାଣ ହରାଉଛନ୍ତି। ଶତକଡ଼ା ୭୦ଭାଗ ମୃତକଙ୍କ ବୟସ ୧୮ ରୁ ୪୫ ବର୍ଷ ମଧ୍ୟରେ।",
      },
      {
        heading: "ମୁଖ୍ୟ କାରଣ",
        body:
          "• ଦୃତ ଓ ବେପରୁଆ ଗାଡ଼ି ଚାଳନା\n• ଚାଳକଙ୍କର ଦକ୍ଷତା ଅଭାବ\n• ନିଶାଗ୍ରସ୍ତ ଗାଡ଼ି ଚାଳନା\n• ଯାନବାହନର ରକ୍ଷଣାବେକ୍ଷଣ ଅଭାବ\n• ଯାତାୟାତକାରୀଙ୍କ ଅସାବଧାନତା\n• ରାସ୍ତା ନିର୍ମାଣରେ ତ୍ରୁଟିବିଚ୍ୟୁତି",
      },
      {
        heading: "ପ୍ରତିକାର ବ୍ୟବସ୍ଥା",
        body:
          "• ରାସ୍ତାମାନଙ୍କର ନିୟମିତ ରକ୍ଷଣାବେକ୍ଷଣ\n• ହେଲମେଟ୍ ଓ ସିଟ୍ ବେଲ୍ଟ୍ ବ୍ୟବହାର\n• ଯାତାୟାତ ନିୟମ ପାଳନ\n• ଅତିରିକ୍ତ ବୋଝେଇ ଗାଡ଼ିକୁ ଯିବାକୁ ଅନୁମତି ନଦେବା",
      },
    ],
    workedExamples: [
      {
        problem: "ସଡ଼କ ଦୁର୍ଘଟଣା ଦୃଷ୍ଟିରୁ ଭାରତ ସମଗ୍ର ପୃଥିବୀରେ କେଉଁ ସ୍ଥାନରେ ?",
        solution: "ଭାରତ ପ୍ରଥମ ସ୍ଥାନରେ ରହିଛି।",
      },
      {
        problem: "ସର୍ବାଧିକ ଦୁର୍ଘଟଣା କେଉଁ ରାଜ୍ୟରେ ପଞ୍ଜିକୃତ ହୋଇଛି ?",
        solution: "ତାମିଲନାଡ଼ୁ।",
      },
    ],
    citations: [
      {
        title: BSE_BHUGOLA,
        page: "ଅଧ୍ୟାୟ-୬, ପୃ.୧-୩",
        url: "https://bseodisha.ac.in/CL-IX-Text-Book.html",
      },
    ],
  },
};

const FALLBACK_CITATIONS = [
  { title: "BSE Odisha Syllabus Class IX (2025–26)", page: "Subject-wise" },
  { title: NCERT, page: "Ch.1" },
];

export function getLesson(topicId: string): Lesson {
  const existing = LESSONS[topicId];
  if (existing) return existing;

  const topic = findTopic(topicId);
  const titleOr = topic?.title.or ?? topicId;
  const titleEn = topic?.title.en ?? topicId;
  const objectives = topic?.objectives ?? [];

  // Synthesised lesson for topics we haven't hand-written yet.
  return {
    topicId,
    language: "or",
    titleOr,
    titleEn,
    sections: [
      {
        heading: "ପରିଚୟ",
        body:
          `ଏହି ପାଠ "${titleOr}" ବିଷୟରେ। ଓଡ଼ିଶା ମାଧ୍ୟମିକ ଶିକ୍ଷା ପରିଷଦ ନବମ ଶ୍ରେଣୀ ପାଠ୍ୟକ୍ରମ ଅନୁଯାୟୀ ଏହା ${topic?.chapterTitle.or ?? ""} ଅଧ୍ୟାୟର ଏକ ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ ଭାଗ।` +
          (objectives.length
            ? `\n\n**ଶିକ୍ଷଣ ଲକ୍ଷ୍ୟ:**\n` +
              objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")
            : ""),
      },
      {
        heading: "ମୁଖ୍ୟ ବିନ୍ଦୁ",
        body:
          "ଏହି ଟପିକ୍ ର ପୂର୍ଣ୍ଣ ପାଠ AI ଦ୍ୱାରା ପ୍ରସ୍ତୁତ ହେବ, ଯେତେବେଳେ Gemini API କି ଓ Supabase ସଂଯୋଗ ସକ୍ରିୟ ହେବ। ଏପର୍ଯ୍ୟନ୍ତ ଦୟାକରି ଶିକ୍ଷଣ ଲକ୍ଷ୍ୟ ଗୁଡ଼ିକୁ ଧ୍ୟାନ ଦିଅନ୍ତୁ।",
      },
    ],
    workedExamples: [],
    citations: topic?.pageHint?.or
      ? [{ title: BSE_BIJAGANIT, page: topic.pageHint.or }]
      : FALLBACK_CITATIONS,
  };
}
