/**
 * Per-subject language profile for content generation.
 *
 * The user goal: a student opens an English subject and the lesson is
 * primarily in English, with Odia helper sentences after each section so
 * an Odia-native student can understand. Hindi subjects get the same
 * treatment with Odia helpers. Odia literature (FLO) stays in Odia with
 * English glosses for technical literary terms. Math/Science/Social
 * stay in the board primary (Odia for BSE_ODISHA) with English kept
 * verbatim for technical vocabulary.
 *
 * This module is shared by:
 *   - scripts/content/generate-lessons.ts
 *   - scripts/content/generate-practice.ts
 *
 * The returned `language` is the value stored in `lesson_variants.language`
 * (the row primary language). The `bilingualHelper` field controls whether
 * the prompt asks the model to weave a second-language helper sentence /
 * gloss after each section.
 */
import type { AppLanguage } from "@/lib/types";

export type SubjectLanguageProfile = {
  /** Stored in `lesson_variants.language`. The dominant language of the body. */
  language: AppLanguage;
  /** The secondary language for helper sentences / glosses (or null). */
  helper: AppLanguage | null;
  /** Human-readable label for the primary language (used in prompts). */
  primaryLabel: string;
  /** Human-readable label for the helper language (used in prompts). */
  helperLabel: string | null;
  /** Free-text bilingual instructions injected into the prompt. */
  bilingualInstruction: string;
};

const LANG_LABEL: Record<AppLanguage, string> = {
  en: "English",
  or: "Odia (ଓଡ଼ିଆ)",
  hi: "Hindi (हिन्दी)",
};

/**
 * Resolve the language profile for a (board, subjectCode) pair.
 *
 * Subject codes are the canonical codes used in `subjects.code`:
 *   FLO = First Language Odia (MIL)
 *   SLE = Second Language English
 *   TLH = Third Language Hindi
 *   SAN = Sanskrit (third/optional language)
 *   CMP = Computer Education / IT
 *   MTH = Mathematics
 *   GSC = General Science
 *   SSC = Social Science
 */
export function languageProfileFor(
  board: string,
  subjectCode: string,
): SubjectLanguageProfile {
  const isOdishaBoard = board === "BSE_ODISHA";
  const code = subjectCode.toUpperCase();

  // Sanskrit: Sanskrit is taught from Odia textbooks at BSE Odisha. The
  // pedagogically correct primary language is Odia (the student's medium
  // of instruction); Sanskrit shlokas, sutras, and sample sentences MUST
  // be kept verbatim in Devanagari. English glosses for grammar terms.
  if (code === "SAN") {
    return {
      language: "or",
      helper: "en",
      primaryLabel: LANG_LABEL.or,
      helperLabel: LANG_LABEL.en,
      bilingualInstruction: isOdishaBoard
        ? "LANGUAGE: This is a Sanskrit-learning subject taught through Odia. Write the lesson in Odia (ଓଡ଼ିଆ). Quote ALL Sanskrit shlokas, sutras, words, and example sentences VERBATIM in Devanagari script (संस्कृत) — do not translate them into Odia. After each Sanskrit quote, give the Odia meaning in parentheses or on the next line, e.g. \"वन्दना (ପ୍ରଣାମ)\". For grammar terminology (e.g. सन्धि, समास, विभक्ति, कारक), include the English meaning in parentheses on first use, e.g. \"विभक्ति (vibhakti — case marker)\"."
        : "LANGUAGE: Write the lesson in clear English. Quote Sanskrit text verbatim in Devanagari (संस्कृत) and give an English gloss after each quote.",
    };
  }

  // Computer Education: BSE Odisha textbooks are English-medium, but the
  // audience is Odia students. Same pattern as SLE — English body, Odia
  // helper paragraphs to make technical concepts accessible.
  if (code === "CMP") {
    return {
      language: "en",
      helper: isOdishaBoard ? "or" : null,
      primaryLabel: LANG_LABEL.en,
      helperLabel: isOdishaBoard ? LANG_LABEL.or : null,
      bilingualInstruction: isOdishaBoard
        ? "LANGUAGE: Write the lesson in clear, simple English suitable for a Class learner. Keep all technical computer terms (CPU, RAM, file, folder, browser, URL, hardware, software, etc.) in English. After each section heading, add a short helper paragraph in Odia (ଓଡ଼ିଆ) that explains the concept in 1–2 sentences so an Odia-native student can understand. When you introduce a key technical term in the Odia helper, you MAY include the English term in parentheses, e.g. \"ପ୍ରକ୍ରିୟାକାରୀ ମୀମାଂସା (CPU)\"."
        : "LANGUAGE: Write the lesson in clear, simple English. Keep all technical computer terms verbatim.",
    };
  }

  // English language subject: primary English, Odia helpers (BSE only).
  if (code === "SLE") {
    return {
      language: "en",
      helper: isOdishaBoard ? "or" : null,
      primaryLabel: LANG_LABEL.en,
      helperLabel: isOdishaBoard ? LANG_LABEL.or : null,
      bilingualInstruction: isOdishaBoard
        ? "LANGUAGE: This is an English-learning subject. Write the lesson in clear, simple English. After each section heading, add a short helper paragraph in Odia (ଓଡ଼ିଆ) that summarises the section in 1-2 sentences so an Odia-native student can follow. Inside English paragraphs, when you introduce a key English vocabulary word, you MAY include the Odia meaning in parentheses, e.g. \"melody (ସଙ୍ଗୀତ ସ୍ୱର)\". Keep example sentences in English."
        : "LANGUAGE: Write the lesson in clear, simple English suitable for a Class learner.",
    };
  }

  // Hindi language subject: primary Hindi, Odia helpers (BSE only).
  if (code === "TLH") {
    return {
      language: "hi",
      helper: isOdishaBoard ? "or" : null,
      primaryLabel: LANG_LABEL.hi,
      helperLabel: isOdishaBoard ? LANG_LABEL.or : null,
      bilingualInstruction: isOdishaBoard
        ? "LANGUAGE: This is a Hindi-learning subject. Write the lesson in clear, simple Hindi (Devanagari script). After each section heading, add a short helper paragraph in Odia (ଓଡ଼ିଆ) that explains the section in 1-2 sentences so an Odia-native student can understand. When you introduce a key Hindi word, you MAY include the Odia meaning in parentheses, e.g. \"विद्यालय (ବିଦ୍ୟାଳୟ)\". Keep example sentences in Hindi."
        : "LANGUAGE: Write the lesson in clear, simple Hindi (Devanagari script).",
    };
  }

  // Odia first language (literature/grammar). Primary Odia, English glosses.
  if (code === "FLO") {
    return {
      language: "or",
      helper: "en",
      primaryLabel: LANG_LABEL.or,
      helperLabel: LANG_LABEL.en,
      bilingualInstruction:
        "LANGUAGE: Write the lesson in Odia (ଓଡ଼ିଆ). For technical literary terms (e.g. ସନ୍ଧି, ସମାସ, ଅଳଙ୍କାର, ରସ), include the English meaning in parentheses on first use, e.g. \"ସନ୍ଧି (Sandhi — phonetic combination)\". Keep poem/prose excerpts verbatim in Odia.",
    };
  }

  // Math / Science / Social Science: board primary with English-kept terms.
  const boardPrimary: AppLanguage = isOdishaBoard ? "or" : "en";
  if (boardPrimary === "or") {
    return {
      language: "or",
      helper: "en",
      primaryLabel: LANG_LABEL.or,
      helperLabel: LANG_LABEL.en,
      bilingualInstruction:
        "LANGUAGE: Write the lesson in Odia (ଓଡ଼ିଆ). Keep all technical / scientific terms, formulas, units, variable names, and proper nouns verbatim in English (e.g. \"Newton's law\", \"photosynthesis\", \"$F = ma$\"). When you introduce a technical term in Odia, include the English term in parentheses on first use, e.g. \"ଗତିଶକ୍ତି (kinetic energy)\".",
    };
  }
  return {
    language: "en",
    helper: null,
    primaryLabel: LANG_LABEL.en,
    helperLabel: null,
    bilingualInstruction:
      "LANGUAGE: Write the lesson in clear English. Keep technical terms and formulas verbatim.",
  };
}
